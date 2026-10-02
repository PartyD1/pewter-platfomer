import fs from "fs";
import { Level, search } from "./physsim.ts";
const d = JSON.parse(fs.readFileSync("../eval/falsify_grids.json", "utf8"));
const SOLID = (v: number) => v >= 4 && v <= 7;
let rows: string[] = [];
for (const [k, v] of Object.entries<any>(d)) {
  const res: string[] = [];
  for (const g of v.grids) {
    const grid = g.G.map((row: number[]) => row.map((x: number) => (SOLID(x) ? 1 : 0)));
    const L = new Level(grid);
    let a = search(L, { x: 6, y: 9 }, { K: 4, qx: 4, qv: 32, goalCol: 23, maxExpand: 1_500_000, startBody: { x: 95, y: 143 } });
    if (!a.found) a = search(L, { x: 6, y: 9 }, { K: 2, qx: 2, qv: 32, goalCol: 23, maxExpand: 2_500_000, startBody: { x: 95, y: 143 } });
    // also: are all coins collectable? count coins whose column has a reachable-ish path? skip; just exit reachability
    res.push(a.found ? "beatable" : a.exhausted ? "IMPOSSIBLE" : "unknown");
  }
  rows.push(`${k}: ${res.join(", ")}`);
}
console.log(rows.join("\n"));
