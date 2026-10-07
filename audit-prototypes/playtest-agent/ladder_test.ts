import { Level, search } from "./physsim.ts";
// Flat takeoff platform of (r+1) cells, gap of G empty columns, 3-cell landing. Ground row 4 of H=7.
function gapLevel(r: number, G: number, rise = 0) {
  const W = r + 1 + G + 3, H = 12, gy = 8;
  const g = Array.from({ length: H }, () => Array(W).fill(0));
  for (let x = 0; x <= r; x++) for (let y = gy; y < H; y++) g[y][x] = 1;
  for (let x = r + 1 + G; x < W; x++) for (let y = gy - rise; y < H; y++) g[y][x] = 1;
  return g;
}
const K = Number(process.argv[2] ?? 4);
for (const r of [0, 1, 2, 4, 7]) {
  let best = -1; const row: string[] = [];
  for (let G = 6; G <= 14; G++) {
    const res = search(new Level(gapLevel(r, G)), { x: 0, y: 7 }, { K, maxExpand: 400000 });
    row.push(`${G}:${res.found ? "Y" : res.exhausted ? "n" : "?"}`);
    if (res.found) best = G;
  }
  console.log(`K=${K} runway ${r}: max gap ${best}   ${row.join(" ")}`);
}
