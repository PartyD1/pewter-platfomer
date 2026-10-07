import { Level, search } from "./physsim.ts";
function gapLevel(r: number, G: number) {
  const W = r + 1 + G + 3, H = 12, gy = 8;
  const g = Array.from({ length: H }, () => Array(W).fill(0));
  for (let x = 0; x <= r; x++) for (let y = gy; y < H; y++) g[y][x] = 1;
  for (let x = r + 1 + G; x < W; x++) for (let y = gy; y < H; y++) g[y][x] = 1;
  return g;
}
for (const [K, qx, qv] of [[4, 2, 32], [4, 4, 32], [2, 2, 32], [2, 4, 32]]) {
  const res = search(new Level(gapLevel(7, 13)), { x: 0, y: 7 }, { K, qx, qv, maxExpand: 3_000_000 });
  const ok = search(new Level(gapLevel(7, 12)), { x: 0, y: 7 }, { K, qx, qv, maxExpand: 3_000_000 });
  console.log(`K=${K} qx=${qx} qv=${qv}: gap13 found=${res.found} exhausted=${res.exhausted} expanded=${res.expanded} ${res.ms}ms | gap12 found=${ok.found} expanded=${ok.expanded} ${ok.ms}ms`);
}
