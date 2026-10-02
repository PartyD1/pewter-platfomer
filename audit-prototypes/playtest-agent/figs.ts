// Collect grids + agent trajectories for the artifact figures.
import fs from "fs";
import { Level, search, replay } from "./physsim.ts";
const z3 = JSON.parse(fs.readFileSync("../z3proto/exp_exploit.json", "utf8"));
const bench = JSON.parse(fs.readFileSync("../z3proto/bench.json", "utf8"));
const chunks = JSON.parse(fs.readFileSync("chunk_levels.json", "utf8"));
const demos = JSON.parse(fs.readFileSync("../z3proto/repair_demos.json", "utf8"));
const dis = JSON.parse(fs.readFileSync("disagreements.json", "utf8"));
const W = 24, H = 12, gl = 8;
function path(grid: number[][]) {
  const L = new Level(grid); let a = search(L, { x: 0, y: 7 }, { K: 4, qx: 4, qv: 32, goalCol: grid[0].length - 1, maxExpand: 2_000_000 });
  if (!a.found) a = search(L, { x: 0, y: 7 }, { K: 2, qx: 2, qv: 32, goalCol: grid[0].length - 1, maxExpand: 3_000_000 });
  if (!a.found) return null;
  return replay(L, { x: 0, y: 7 }, a.inputs!).map((t) => [+(t[0] + 5).toFixed(1), +(t[1] + 7).toFixed(1)]);
}
const tunnel = (G: number, h: number) => { const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (y >= gl && !(x >= 8 && x < 8 + G)) ? 1 : 0));
  for (let x = 5; x < 8 + G + 2; x++) for (let y = 0; y <= gl - 1 - h; y++) g[y][x] = 1; return g; };
const figs: any[] = [];
const add = (name: string, grid: number[][], extra: any = {}) => { figs.push({ name, grid, path: extra.noPath ? null : path(grid), ...extra }); console.log(name, figs.at(-1).path ? "path " + figs.at(-1).path.length : "no path"); };
add("z3-nostyle", z3.find((r: any) => !r.style && r.seed === 2).grid);
add("z3-style", z3.find((r: any) => r.style && r.seed === 1).grid);
add("clingo-style", bench.find((r: any) => r.solver === "clingo" && r.W === 24 && r.seed === 1).grid);
const ch = chunks.find((c: any) => c.name === "chunk_d3_mixed_3");
add("chunkgen", ch.grid, { coins: ch.coins, slimes: ch.slimes, desc: ch.desc });
const dA = demos["A_wide_pit_GUARANTEED_faithful"]; add("repair-pit", dA.grid, { base: dA.base });
add("repair-pit-before", dA.base, { noPath: true });
const dB = demos["B_tall_wall_NORMAL_faithful"]; add("wall-false-beatable", dB.base, { noPath: true, claim: [[10, 7], [14, 7]] });
const dB2 = demos["B_tall_wall_NORMAL_arcmin"]; add("wall-repair-arcmin", dB2.grid, { base: dB2.base });
add("tunnel-false-beatable", tunnel(9, 3), { noPath: true, claim: [[7, 7], [17, 7]] });
const r56 = dis.fn.find((r: any) => r.name === "rand_56"); add("rising-false-impossible", r56.grid);
fs.writeFileSync("../render/figs.json", JSON.stringify(figs));
