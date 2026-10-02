// Export the fork's physics-derived movement table so solvers can use it.
import fs from "node:fs";
import { gapLadder, maxStepUpTiles, movementFacts, reachableFrontier } from "/home/user/partyd1/pewter-the-platformer/src/phaser/movementCapabilities.ts";
const tiers = ["GUARANTEED", "NORMAL", "EXPERT"] as const;
const out: any = {};
const t0 = Date.now();
for (const t of tiers) {
  const f = movementFacts(t);
  const frontier: Record<number, { rise: number; gap: number }[]> = {};
  for (const runway of [0, 1, 2, 4, 7]) frontier[runway] = reachableFrontier(runway, t).map((r) => ({ rise: r.deltaYTiles, gap: r.gapTiles }));
  out[t] = { ladder: gapLadder(t), maxStepUp: maxStepUpTiles(t), maxGap: f.maxGapTiles, standingGap: f.standingGapTiles, impossibleGap: f.impossibleGapTiles, frontier };
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log("exported in", Date.now() - t0, "ms");
console.log(JSON.stringify(out.NORMAL.ladder), "stepUp", out.NORMAL.maxStepUp, "maxGap", out.NORMAL.maxGap);
console.log("NORMAL frontier runway 7:", JSON.stringify(out.NORMAL.frontier[7]));
console.log("NORMAL frontier runway 0:", JSON.stringify(out.NORMAL.frontier[0]));
