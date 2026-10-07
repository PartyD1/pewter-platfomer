// Targeted blind-spot sweep: a pit of width G with a ceiling slab h tiles above the ground spanning the pit
// (open at the takeoff column so the engine's takeoff-headroom check passes), plus thin walls of height k.
import { Level, search } from "./physsim.ts";
import { computeReachability } from "/home/user/partyd1/pewter-the-platformer/src/languageModel/reachability.ts";
const W = 24, H = 12, gl = 8;
const eng = (g: number[][], tier: any) => { const r = computeReachability({ width: W, height: H, isSolid: (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] === 1 }, { x: 0, y: 7 }, tier); return [...r.reachable].some((k) => Number(k.split(",")[0]) >= W - 1); };
const agent = (g: number[][]) => { const L = new Level(g); const a = search(L, { x: 0, y: 7 }, { K: 4, qx: 4, qv: 32, goalCol: W - 1, maxExpand: 1_500_000 });
  if (a.found) return "beatable"; const a2 = search(L, { x: 0, y: 7 }, { K: 2, qx: 2, qv: 32, goalCol: W - 1, maxExpand: 3_000_000 }); return a2.found ? "beatable" : (a.exhausted && a2.exhausted ? "impossible" : "unknown"); };
const rows: string[] = []; let fp = 0, fn = 0, n = 0;
for (const G of [2, 3, 5, 7, 9, 11]) for (const h of [1, 2, 3, 4, 5]) {
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (y >= gl && !(x >= 8 && x < 8 + G)) ? 1 : 0));
  for (let x = 5; x < 8 + G + 2; x++) for (let y = 0; y <= gl - 1 - h; y++) g[y][x] = 1; // low tunnel: solid mass from the top down to h tiles above the ground, over the pit and 3/2 cols either side
  const e = eng(g, "NORMAL"), a = agent(g); n++;
  if (e && a === "impossible") fp++; if (!e && a === "beatable") fn++;
  rows.push(`pit ${G} under tunnel ${h} high: engine ${e ? "beatable" : "no"} | agent ${a}${e && a === "impossible" ? "  <-- FALSE 'BEATABLE'" : ""}`);
}
for (const k of [5, 6, 7, 8]) {
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, () => (y >= gl ? 1 : 0)));
  for (let y = gl - k; y < gl; y++) for (let x = 11; x <= 12; x++) if (y >= 0) g[y][x] = 1;
  const e = eng(g, "NORMAL"), a = agent(g); n++;
  if (e && a === "impossible") fp++; if (!e && a === "beatable") fn++;
  rows.push(`wall ${k} tall (2 wide): engine ${e ? "beatable" : "no"} | agent ${a}${e && a === "impossible" ? "  <-- FALSE 'BEATABLE'" : ""}`);
}
console.log(rows.join("\n")); console.log(`\n${n} cases: engine false 'beatable' ${fp}, engine false 'impossible' ${fn}`);
