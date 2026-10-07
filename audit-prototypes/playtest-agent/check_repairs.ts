import fs from "fs";
import { Level, search } from "./physsim.ts";
import { computeReachability } from "/home/user/partyd1/pewter-the-platformer/src/languageModel/reachability.ts";
const demos = JSON.parse(fs.readFileSync("../z3proto/repair_demos.json", "utf8"));
const eng = (g: number[][], tier: any) => { const r = computeReachability({ width: g[0].length, height: g.length, isSolid: (x, y) => x >= 0 && y >= 0 && x < g[0].length && y < g.length && g[y][x] === 1 }, { x: 0, y: 7 }, tier); return [...r.reachable].some((k) => Number(k.split(",")[0]) >= g[0].length - 1); };
const out: any = {};
for (const [name, d] of Object.entries<any>(demos)) {
  for (const [label, g] of [["before", d.base], ["after", d.grid]] as const) {
    const L = new Level(g as number[][]);
    let a = search(L, { x: 0, y: 7 }, { K: 4, qx: 4, qv: 32, goalCol: 23, maxExpand: 2_000_000 });
    if (!a.found) { const a2 = search(L, { x: 0, y: 7 }, { K: 2, qx: 2, qv: 32, goalCol: 23, maxExpand: 4_000_000 }); if (a2.found || !a.exhausted) a = a2; else a = { ...a, exhausted: a.exhausted && a2.exhausted }; }
    const rec = { engineNORMAL: eng(g as number[][], "NORMAL"), engineGUAR: eng(g as number[][], "GUARANTEED"), agentFound: a.found, agentExhausted: a.exhausted, frames: a.frames, ms: a.ms };
    out[`${name}:${label}`] = { ...rec, inputs: a.inputs };
    console.log(name, label, JSON.stringify(rec));
  }
}
fs.writeFileSync("repair_checks.json", JSON.stringify(out));
