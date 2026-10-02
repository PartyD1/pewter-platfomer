const key = process.env.VITE_LLM_API_KEY, model = process.env.VITE_LLM_MODEL_NAME;
const t0 = Date.now();
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with exactly: pong" }] }], generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } } }),
});
const j = await r.json();
console.log("status", r.status, "ms", Date.now() - t0, "model", model);
console.log(JSON.stringify(j).replace(key, "<redacted>").slice(0, 600));
