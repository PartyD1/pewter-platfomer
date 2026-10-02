// Runs the physics agent and the fork's reachability engine over level corpora.
// tsx agent_corpus.ts <corpus: z3|chunk|gemini|random> <shard> <nshards> <out.jsonl>
import fs from "fs";
import { Level, search } from "./physsim.ts";
import { computeReachability, type TileGridView } from "/home/user/partyd1/pewter-the-platformer/src/languageModel/reachability.ts";

const [corpus, shardS, nS, outPath] = process.argv.slice(2);
const shard = Number(shardS), nshards = Number(nS);
type Item = { name: string; grid: number[][]; start: { x: number; y: number }; goalCol: number; startBody?: { x: number; y: number }; meta?: any };
const items: Item[] = [];

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

if (corpus === "z3") {
  for (const r of JSON.parse(fs.readFileSync("../z3proto/exp_exploit.json", "utf8")))
    items.push({ name: `z3_${r.style ? "style" : "nostyle"}_${r.seed}`, grid: r.grid, start: { x: 0, y: 7 }, goalCol: 23, meta: { faithful: r.faithful_ok, arc: r.arc_ok, frontier_arc: r.frontier_arc_ok } });
} else if (corpus === "chunk") {
  for (const c of JSON.parse(fs.readFileSync("chunk_levels.json", "utf8")))
    items.push({ name: c.name, grid: c.grid, start: { x: 0, y: 7 }, goalCol: 23, meta: { desc: c.desc, slimes: c.slimes.length } });
} else if (corpus === "gemini") {
  const SOLID = (v: number) => v >= 4 && v <= 7;
  for (const cond of ["C0", "C1", "C2"]) for (const line of fs.readFileSync(`../eval/results/${cond}.jsonl`, "utf8").split("\n")) {
    if (!line.trim()) continue; const r = JSON.parse(line);
    if (!/^S0[34]|^S1[46]/.test(r.id)) continue;
    const g = r.grids.at(-1); if (!g) continue;
    const grid = g.G.map((row: number[]) => row.map((v) => (SOLID(v) ? 1 : 0)));
    items.push({ name: `${cond}_${r.id}_r${r.rep}`, grid, start: { x: 6, y: 9 }, goalCol: 23, startBody: { x: 95, y: 143 } });
  }
} else if (corpus === "random") {
  for (let seed = 1; seed <= 240; seed++) {
    const R = rng(seed * 7919); const W = 24, H = 12; const g = Array.from({ length: H }, () => Array(W).fill(0));
    let y = 8, x = 0; const col = (cx: number, top: number | null) => { if (top === null) return; for (let yy = top; yy < H; yy++) g[yy][cx] = 1; };
    const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    for (; x < 3; x++) col(x, y);
    while (x < W - 3) {
      const k = R();
      if (k < 0.22) { const n = ri(2, 4); for (let i = 0; i < n && x < W - 3; i++, x++) col(x, y); }
      else if (k < 0.45) { const w = ri(2, 12); for (let i = 0; i < w && x < W - 3; i++, x++) col(x, null); }
      else if (k < 0.62) { y = Math.max(3, Math.min(10, y + (R() < 0.6 ? -ri(1, 7) : ri(1, 5)))); for (let i = 0; i < 2 && x < W - 3; i++, x++) col(x, y); }
      else if (k < 0.80) { // floating platform over a pit
        const w = ri(4, 9); const pw = ri(2, 4); const ph = y - ri(2, 6); const p0 = x + ri(1, Math.max(1, w - pw - 1));
        for (let i = 0; i < w && x < W - 3; i++, x++) { if (x >= p0 && x < p0 + pw && ph >= 1) g[ph][x] = 1; }
      } else { // overhang / low ceiling over flat ground
        const n = ri(3, 6); const cy = y - ri(2, 4);
        for (let i = 0; i < n && x < W - 3; i++, x++) { col(x, y); if (cy >= 0) g[cy][x] = 1; }
      }
    }
    for (; x < W; x++) col(x, y);
    items.push({ name: `rand_${seed}`, grid: g, start: { x: 0, y: 7 }, goalCol: 23 });
  }
}

const view = (g: number[][]): TileGridView => ({ width: g[0].length, height: g.length, isSolid: (x, y) => x >= 0 && y >= 0 && x < g[0].length && y < g.length && g[y][x] === 1 });
const engineOK = (it: Item, tier: any) => { const r = computeReachability(view(it.grid), it.start, tier); return [...r.reachable].some((k) => Number(k.split(",")[0]) >= it.goalCol); };

const out = fs.createWriteStream(outPath, { flags: "a" });
items.forEach((it, i) => {
  if (i % nshards !== shard) return;
  const eng = { GUARANTEED: engineOK(it, "GUARANTEED"), NORMAL: engineOK(it, "NORMAL"), EXPERT: engineOK(it, "EXPERT") };
  const L = new Level(it.grid);
  let a = search(L, it.start, { K: 4, qx: 4, qv: 32, goalCol: it.goalCol, maxExpand: 1_500_000, startBody: it.startBody });
  let a2: any = null;
  if (!a.found) a2 = search(L, it.start, { K: 2, qx: 2, qv: 32, goalCol: it.goalCol, maxExpand: 2_500_000, startBody: it.startBody });
  const rec = { name: it.name, engine: eng, agent: { found: a.found, exhausted: a.exhausted, expanded: a.expanded, frames: a.frames, ms: a.ms },
    agent2: a2 && { found: a2.found, exhausted: a2.exhausted, expanded: a2.expanded, frames: a2.frames, ms: a2.ms }, meta: it.meta, grid: it.grid };
  out.write(JSON.stringify(rec) + "\n");
  console.log(it.name, JSON.stringify(eng), "agent", a.found, a.exhausted, a.ms + "ms", a2 ? `agent2 ${a2.found} ${a2.exhausted} ${a2.ms}ms` : "");
});
out.end();
