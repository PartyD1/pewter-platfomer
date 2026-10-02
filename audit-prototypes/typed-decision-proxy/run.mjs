// Jev-shaped typed-decision proxy: Gemini answers ONLY independent Choice/Score/Noul questions
// (probability distributions over fixed labels) about engine-enumerated features. No prose, no coordinates.
// node run.mjs <reps> <temperature> <out.jsonl>
import fs from "node:fs";
import { CASES, SEL } from "./cases.mjs";
const [REPS = "3", TEMP = "0.3", OUT = "results.jsonl"] = process.argv.slice(2);
const key = process.env.VITE_LLM_API_KEY; const model = process.env.VITE_LLM_MODEL_NAME || "gemini-3.7-flash";
if (!key) { console.error("missing key env"); process.exit(1); }
const OPS = {
  add_collectables: "Add coins or fruit", add_enemy: "Add slimes or other enemies", add_platform: "Add a new platform or block structure",
  dig_pit: "Dig a pit or gap into the ground", build_staircase: "Build stairs / steps", remove_feature: "Remove an existing feature or objects",
  move_feature: "Move an existing feature or objects", increase_difficulty: "Make the area harder in a general way",
  decrease_difficulty: "Make the area easier in a general way",
  none_of_the_above: "Anything else: questions, undo, shapes or themes, resizing/modifying/replacing existing things, or requests that need several different targets",
};
const nums = (a, b) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [String(a + i), null]));
function questions(features) {
  const opsNoNone = Object.fromEntries(Object.entries(OPS).filter(([k]) => k !== "none_of_the_above"));
  return {
    operation: { type: "choice", instructions: "What is the main thing the user wants done?", criteria: OPS },
    secondary_operation: { type: "choice", instructions: "Does the request ALSO ask for a second, different action? If so which; otherwise none.", criteria: { ...opsNoNone, none: "No second action" } },
    target: { type: "choice", instructions: "Which existing thing is the request about (the thing to place relative to, remove, or move)?", criteria: { ground: "The ground surface in the selection", ...features, none: "No specific existing thing" } },
    second_target: { type: "choice", instructions: "If the request refers to TWO existing things (e.g. 'between X and Y'), the second one; otherwise none.", criteria: { ...features, none: "No second thing" } },
    placement: { type: "choice", instructions: "Where should new things go relative to the target?", criteria: {
      on_top_of_target: "Standing/resting on the target's top surface", floating_above_target: "In the air above the target",
      on_ground_under_target: "On the ground directly beneath the target", between_targets: "On the ground between the target and the second target",
      left_of_target: "To the left of the target", right_of_target: "To the right of the target", center_of_selection: "Near the middle of the selection",
      anywhere_in_selection: "Anywhere sensible in the selection", not_applicable: "Nothing new is being placed" } },
    entity: { type: "choice", instructions: "What kind of object is being added?", criteria: { coin: null, fruit: null, slime: null, ultra_slime: null, block: "Solid terrain blocks", none: "Nothing is being added" } },
    count: { type: "choice", instructions: "How many objects should be added?", criteria: { ...nums(1, 6), one_per_block: "One on each block of the target", unspecified: "Not stated" } },
    size: { type: "choice", instructions: "Requested width, number of steps, or size, in tiles", criteria: { ...nums(1, 8), unspecified: "Not stated" } },
    offset: { type: "choice", instructions: "Requested distance in tiles (e.g. 'floating 3 tiles above', 'move 3 tiles', 'lower by 2')", criteria: { ...nums(0, 6), unspecified: "Not stated" } },
    direction: { type: "choice", instructions: "Requested direction (for moving things, or which way stairs go up)", criteria: { left: null, right: null, up: null, down: null, none: "No direction stated" } },
    needs_clarification: { type: "noul", instructions: "The request is vague, ambiguous, or cannot be done with the options above, so the assistant should ask a follow-up question before acting" },
  };
}
const SYS = `You emulate a typed decision model (System-One style). You never write prose.
You receive a STATE and independent QUESTIONS. Each question lists its only allowed labels.
For every question, independently, give a probability distribution over exactly its labels (non-negative, summing to 1).
For a yes/no ("noul") question give only the probability of yes. Use only the STATE.`;
function schemaFor(qs) {
  const props = {};
  for (const [id, q] of Object.entries(qs)) {
    if (q.type === "noul") props[id] = { type: "NUMBER" };
    else { const labels = Object.keys(q.criteria); props[id] = { type: "OBJECT", properties: Object.fromEntries(labels.map((l) => [l, { type: "NUMBER" }])), required: labels }; }
  }
  return { type: "OBJECT", properties: props, required: Object.keys(qs) };
}
async function ask(c) {
  const qs = questions(c.features);
  const state = { request: c.request, selection: SEL, existing_things: c.features };
  const body = { systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ state, questions: qs }) }] }],
    generationConfig: { temperature: Number(TEMP), responseMimeType: "application/json", responseSchema: schemaFor(qs), thinkingConfig: { thinkingBudget: 0 } } };
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  const ms = Date.now() - t0; const j = await r.json();
  if (!r.ok) return { error: `${r.status} ${JSON.stringify(j).slice(0, 200)}`, ms };
  const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  let ans; try { ans = JSON.parse(txt); } catch { return { error: "bad json", ms }; }
  const out = {};
  for (const [id, q] of Object.entries(qs)) {
    if (q.type === "noul") { out[id] = { p: Math.max(0, Math.min(1, Number(ans[id]))) }; continue; }
    const pr = ans[id] || {}; let s = 0; for (const l of Object.keys(q.criteria)) s += Math.max(0, Number(pr[l]) || 0);
    const probs = Object.fromEntries(Object.keys(q.criteria).map((l) => [l, s ? Math.max(0, Number(pr[l]) || 0) / s : 0]));
    const top = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
    out[id] = { choice: top[0], p: top[1] };
  }
  return { ms, answers: out, usage: j.usageMetadata };
}
const f = fs.createWriteStream(OUT, { flags: "a" });
for (let rep = 1; rep <= Number(REPS); rep++) {
  for (const c of CASES) {
    let res; for (let t = 0; t < 3; t++) { try { res = await ask(c); if (!res.error) break; } catch (e) { res = { error: String(e) }; } await new Promise((r) => setTimeout(r, 1500)); }
    let ok = !res.error; const wrong = [];
    if (ok) for (const [field, acc] of Object.entries(c.expect)) {
      const a = res.answers[field]; const got = field === "needs_clarification" ? a.p >= 0.5 : a.choice;
      if (!acc.includes(got)) { ok = false; wrong.push(`${field}=${got}(${a.p.toFixed(2)})`); }
    }
    const rec = { id: c.id, rep, temp: Number(TEMP), ok, wrong, ms: res.ms, error: res.error, answers: res.answers, usage: res.usage };
    f.write(JSON.stringify(rec) + "\n");
    console.log(rep, c.id, ok ? "OK" : "WRONG", wrong.join(" "), res.ms + "ms", res.error || "");
  }
}
f.end();
