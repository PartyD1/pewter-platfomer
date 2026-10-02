// Scores eval runs. Uses the fork's reachability engine (NORMAL tier) as the
// common playability yardstick for every build.
import fs from "node:fs";
import { computeReachability, type TileGridView } from "/home/user/partyd1/pewter-the-platformer/src/languageModel/reachability.ts";

type Grid = { G: number[][]; C: number[][]; active: number[] | null };
type Rec = any;

const SOLID = (v: number) => v >= 4 && v <= 7;
const isEmptyG = (v: number) => v <= 1;
const coins = (g: Grid, idx = 2) => {
  const out: [number, number][] = [];
  g.C.forEach((row, y) => row.forEach((v, x) => { if (v === idx) out.push([x, y]); }));
  return out;
};
const enemies = (g: Grid, idx: number) => {
  const out: [number, number][] = [];
  g.G.forEach((row, y) => row.forEach((v, x) => { if (v === idx) out.push([x, y]); }));
  return out;
};
const key = (p: [number, number]) => `${p[0]},${p[1]}`;
const sameSet = (a: [number, number][], b: [number, number][]) => a.length === b.length && a.every((p) => b.some((q) => q[0] === p[0] && q[1] === p[1]));
const groundIntactExcept = (g: Grid, exceptCols: Set<number> = new Set()) => {
  for (let x = 0; x < 40; x++) { if (exceptCols.has(x)) continue; for (let y = 15; y < 20; y++) if (!SOLID(g.G[y][x])) return false; }
  return true;
};
const pits = (g: Grid, x0 = 8, x1 = 22) => {
  const runs: [number, number][] = [];
  let s: number | null = null;
  for (let x = x0; x <= x1 + 1; x++) {
    const empty = x <= x1 && [15, 16, 17, 18, 19].every((y) => isEmptyG(g.G[y][x]));
    if (empty && s === null) s = x;
    if (!empty && s !== null) { runs.push([s, x - 1]); s = null; }
  }
  return runs;
};
const view = (g: Grid): TileGridView => ({
  width: 40, height: 20,
  // Enemies are NOT solid for playability purposes (the fork's adapter treats them as solid — a bug we avoid here).
  isSolid: (x, y) => x >= 0 && x < 40 && y >= 0 && y < 20 && SOLID(g.G[y][x]),
});
const reach = (g: Grid) => computeReachability(view(g), { x: 6, y: 9 }, "NORMAL");
const beatableTo = (g: Grid, xMin = 23) => { const r = reach(g); return [...r.reachable].some((k) => Number(k.split(",")[0]) >= xMin); };
const runsAtRow = (g: Grid, y: number, x0 = 8, x1 = 22) => {
  const out: [number, number][] = []; let s: number | null = null;
  for (let x = x0; x <= x1 + 1; x++) { const sol = x <= x1 && SOLID(g.G[y][x]); if (sol && s === null) s = x; if (!sol && s !== null) { out.push([s, x - 1]); s = null; } }
  return out;
};
const changedCells = (a: Grid, b: Grid) => { let n = 0; for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) if (a.G[y][x] !== b.G[y][x] || a.C[y][x] !== b.C[y][x]) n++; return n; };

type Check = { pass: boolean; note: string; parts?: Record<string, boolean> };
const CHECKS: Record<string, (r: Rec) => Check> = {
  S01_coins_on_platform: (r) => { const g = r.grids.at(-1); const want: [number, number][] = [12, 13, 14, 15, 16].map((x) => [x, 10]); const ok = sameSet(coins(g), want) && [12, 13, 14, 15, 16].every((x) => SOLID(g.G[11][x])); return { pass: ok, note: `coins=${coins(g).map(key).join(" ")}` }; },
  S02_slime_on_ground: (r) => { const g = r.grids.at(-1); const s = enemies(g, 9); const ok = s.length === 1 && s[0][1] === 14 && s[0][0] >= 12 && s[0][0] <= 18 && groundIntactExcept(g); return { pass: ok, note: `slimes=${s.map(key).join(" ")}` }; },
  S03_reachable_platform: (r) => {
    const g = r.grids.at(-1); const R = reach(g); let found = ""; let reachableOk = false;
    for (let y = 4; y <= 13; y++) for (const [a, b] of runsAtRow(g, y)) if (b - a + 1 >= 4) { found += ` y${y}:${a}-${b}`; for (let x = a; x <= b; x++) if (R.reachable.has(`${x},${y - 1}`)) reachableOk = true; }
    return { pass: !!found && reachableOk && groundIntactExcept(g), note: `runs:${found || " none"} reachable=${reachableOk}` };
  },
  S04_pit_3wide: (r) => { const g = r.grids.at(-1); const p = pits(g); const cols = new Set<number>(); p.forEach(([a, b]) => { for (let x = a; x <= b; x++) cols.add(x); }); const ok = p.length === 1 && p[0][1] - p[0][0] + 1 === 3 && groundIntactExcept(g, cols) && beatableTo(g); return { pass: ok, note: `pits=${JSON.stringify(p)} beatable=${beatableTo(g)}` }; },
  S05_remove_user_blocks: (r) => { const g = r.grids.at(-1); const gone = [17, 18, 19].every((x) => isEmptyG(g.G[11][x])); return { pass: gone && groundIntactExcept(g), note: `row11: ${[17, 18, 19].map((x) => g.G[11][x]).join(",")}` }; },
  S06_fruit_under_platform: (r) => { const g = r.grids.at(-1); const f = coins(g, 3); return { pass: sameSet(f, [[13, 14]]), note: `fruit=${f.map(key).join(" ")}` }; },
  S07_coins_between_pillars: (r) => { const g = r.grids.at(-1); const c = coins(g).sort((a, b) => a[0] - b[0]); const ok = c.length === 3 && c.every(([x, y]) => y === 14 && x > 10 && x < 18) && c[2][0] - c[0][0] === 2; return { pass: ok, note: `coins=${c.map(key).join(" ")}` }; },
  S08_staircase: (r) => {
    const g = r.grids.at(-1); const L: number[] = [];
    for (let x = 8; x <= 22; x++) { let top = 15; for (let y = 4; y < 15; y++) if (SOLID(g.G[y][x])) { top = y; break; } L.push(15 - top); }
    const runs: { h: number; w: number }[] = []; for (const h of L) { if (runs.length && runs.at(-1)!.h === h) runs.at(-1)!.w++; else runs.push({ h, w: 1 }); }
    let ok = false; for (let i = 0; i + 3 < runs.length; i++) { const s = runs.slice(i, i + 4); if (s[0].h >= 1 && s.every((q, k) => k === 0 || q.h === s[k - 1].h + 1) && s.every((q) => q.w <= 3)) ok = true; }
    return { pass: ok, note: `heights=${L.join("")}` };
  },
  S09_memory_move: (r) => { if (r.grids.length < 2) return { pass: false, note: "incomplete" }; const t1 = coins(r.grids[0]); const t2 = coins(r.grids[1]); const t1ok = t1.length === 4; const moved = sameSet(t2, t1.map(([x, y]) => [x + 3, y] as [number, number])); return { pass: t1ok && moved, note: `t1=${t1.map(key).join(" ")} t2=${t2.map(key).join(" ")}`, parts: { turn1: t1ok, turn2: t1ok && moved } }; },
  S10_memory_remove: (r) => { if (r.grids.length < 2) return { pass: false, note: "incomplete" }; const a = enemies(r.grids[0], 9).length; const b = enemies(r.grids[1], 9).length; const ok = a === 2 && b === 0 && groundIntactExcept(r.grids[1]); return { pass: ok, note: `slimes t1=${a} t2=${b}`, parts: { turn1: a === 2, turn2: a === 2 && b === 0 } }; },
  S11_moved_box: (r) => {
    if (r.grids.length < 3) return { pass: false, note: "incomplete" };
    const t1 = coins(r.grids[0]).some(([x]) => x >= 8 && x <= 14);
    const f = coins(r.grids[1], 3); const t2 = f.some(([x, y]) => x >= 16 && x <= 22 && y === 14);
    const s = enemies(r.grids[2], 9); const t3 = s.some(([x, y]) => x >= 16 && x <= 22 && y === 14);
    return { pass: t1 && t2 && t3, note: `box=${JSON.stringify(r.grids[1].active)} fruit=${f.map(key).join(" ")} slime=${s.map(key).join(" ")}`, parts: { turn1: t1, afterMove1: t2, afterMove2: t3 } };
  },
  S12_switched_box: (r) => { const g = r.grids.at(-1); const c = coins(g); const ok = c.length >= 1 && c.every(([x, y]) => x >= 8 && x <= 13 && y === 14); return { pass: ok, note: `active=${JSON.stringify(g.active)} coins=${c.map(key).join(" ")}` }; },
  S13_coin_above_slime: (r) => { const g = r.grids.at(-1); const c = coins(g); return { pass: sameSet(c, [[15, 12]]) && g.G[14][15] === 9, note: `coins=${c.map(key).join(" ")}` }; },
  S14_harder_but_beatable: (r) => {
    const g = r.grids.at(-1); const changed = changedCells(r.initial, g) > 0; const beat = beatableTo(g);
    let harder = pits(g).some(([a, b]) => b - a + 1 >= 2) || enemies(g, 9).length + enemies(g, 8).length > 0;
    for (let x = 8; x <= 22 && !harder; x++) for (let y = 4; y <= 13; y++) if (SOLID(g.G[y][x])) harder = true;
    return { pass: changed && beat && harder, note: `changed=${changed} beatable=${beat} harder=${harder} pits=${JSON.stringify(pits(g))}`, parts: { beatable: beat, harder } };
  },
  S15_keep_user_content: (r) => {
    const g = r.grids.at(-1); const userOk = [10, 11, 12, 13].every((x) => SOLID(g.G[11][x]) && g.C[10][x] === 2);
    const newRun = runsAtRow(g, 11).some(([a, b]) => a >= 15 && b - a + 1 >= 2);
    return { pass: userOk && newRun, note: `row11 runs=${JSON.stringify(runsAtRow(g, 11))} userIntact=${userOk}` };
  },
  S16_gap_with_coin: (r) => {
    const g = r.grids.at(-1); const p = pits(g); const c = coins(g);
    const pitOk = p.length === 1 && p[0][1] - p[0][0] + 1 === 4;
    const coinOk = pitOk && c.length === 1 && (c[0][0] === p[0][0] + 1 || c[0][0] === p[0][0] + 2) && c[0][1] <= 14 && c[0][1] >= 6;
    return { pass: pitOk && coinOk, note: `pits=${JSON.stringify(p)} coins=${c.map(key).join(" ")}`, parts: { pit: pitOk, coin: coinOk } };
  },
};

const HEDGE = /couldn'?t|could not|unable|can'?t|cannot|wasn'?t able|not able|outside|sorry|failed/i;
function scoreFile(file: string) {
  const out: any[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    const chk = CHECKS[r.id] ? (r.harnessError && !r.grids.length ? { pass: false, note: "harness error" } : CHECKS[r.id](r)) : { pass: false, note: "no check" };
    const tools = r.turns.flatMap((t: any) => t.tools);
    const rejected = tools.filter((t: any) => /❌|Cannot place|outside the selection/i.test(t.result)).length;
    const writes = tools.filter((t: any) => ["placeSingleTile", "placeGridofTiles", "clearTiles"].includes(t.name)).length;
    const emptyReplies = r.turns.filter((t: any) => !t.reply.trim()).length;
    const lastReply = r.turns.at(-1)?.reply ?? "";
    out.push({
      cond: r.cond, id: r.id, rep: r.rep, pass: chk.pass, note: chk.note, parts: chk.parts,
      turns: r.turns.length, ms: r.turns.map((t: any) => t.ms), modelCalls: r.turns.map((t: any) => t.modelCalls),
      tools: tools.length, writes, rejected, emptyReplies,
      confidentWrong: !chk.pass && lastReply.trim().length > 0 && !HEDGE.test(lastReply),
      harnessError: r.harnessError ? String(r.harnessError).slice(0, 200) : undefined,
      lastReply: lastReply.slice(0, 240),
    });
  }
  return out;
}

const files = process.argv.slice(2);
const all = files.flatMap(scoreFile);
fs.writeFileSync("/tmp/claude-0/-home-user-pewter-platfomer/a4742603-f271-536f-ac31-6454ea7e2f31/scratchpad/eval/scored.json", JSON.stringify(all, null, 1));
const byCond: Record<string, any[]> = {};
for (const s of all) (byCond[s.cond] ??= []).push(s);
for (const [c, rows] of Object.entries(byCond)) {
  const n = rows.length, p = rows.filter((x) => x.pass).length;
  const ms = rows.flatMap((x) => x.ms).sort((a: number, b: number) => a - b);
  const calls = rows.flatMap((x) => x.modelCalls);
  console.log(`${c}: pass ${p}/${n} (${Math.round(100 * p / n)}%) | median turn ${ms[Math.floor(ms.length / 2)]}ms p90 ${ms[Math.floor(ms.length * 0.9)]}ms | mean model calls/turn ${(calls.reduce((a: number, b: number) => a + b, 0) / calls.length).toFixed(2)} | rejected calls ${rows.reduce((a, x) => a + x.rejected, 0)} | empty replies ${rows.reduce((a, x) => a + x.emptyReplies, 0)} | confident-but-wrong ${rows.filter((x) => x.confidentWrong).length}/${n - p} failures`);
}
const ids = [...new Set(all.map((s) => s.id))].sort();
console.log("\nper scenario (passes/runs):");
for (const id of ids) console.log(id.padEnd(28), Object.keys(byCond).map((c) => { const rows = byCond[c].filter((x) => x.id === id); return `${c}:${rows.filter((x) => x.pass).length}/${rows.length}`; }).join("  "));
