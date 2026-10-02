// Build a few validation levels embedded in the editor's 40x20 map, find agent paths, save inputs + sim trajectories.
import { Level, search, replay } from "./physsim.ts";
import fs from "fs";
const MW = 40, MH = 20;
function embed(grid: number[][], ox: number) {
  const H = grid.length, W = grid[0].length, oy = MH - H;
  const m = Array.from({ length: MH }, () => Array(MW).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[oy + y][ox + x] = grid[y][x];
  return { map: m, ox, oy, W, H };
}
function gapLevel(r: number, G: number) {
  const W = r + 1 + G + 3, H = 12, gy = 8;
  const g = Array.from({ length: H }, () => Array(W).fill(0));
  for (let x = 0; x <= r; x++) for (let y = gy; y < H; y++) g[y][x] = 1;
  for (let x = r + 1 + G; x < W; x++) for (let y = gy; y < H; y++) g[y][x] = 1;
  return g;
}
const z3 = JSON.parse(fs.readFileSync("../z3proto/exp_exploit.json", "utf8"));
const cases: any[] = [];
const pick = [
  { name: "gap12_runway7", grid: gapLevel(7, 12), start: [0, 7] },
  { name: "z3_style_seed2", grid: z3.find((r: any) => r.style && r.seed === 2).grid, start: [0, 7] },
  { name: "z3_style_seed8", grid: z3.find((r: any) => r.style && r.seed === 8).grid, start: [0, 7] },
];
for (const p of pick) {
  const e = embed(p.grid, 4);
  const L = new Level(e.map);
  const start = { x: e.ox + p.start[0], y: e.oy + p.start[1] };
  const res = search(L, start, { K: 4, qx: 4, qv: 32, goalCol: e.ox + e.W - 1, maxExpand: 3_000_000 });
  console.log(p.name, "found", res.found, "exhausted", res.exhausted, "expanded", res.expanded, "frames", res.frames, res.ms + "ms");
  if (res.found) cases.push({ name: p.name, map: e.map, start, inputs: res.inputs, traj: replay(L, start, res.inputs!) });
}
fs.writeFileSync("validation_cases.json", JSON.stringify(cases));
