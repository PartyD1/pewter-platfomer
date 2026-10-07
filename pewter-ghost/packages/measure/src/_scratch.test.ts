import { test } from "vitest";
import { REFERENCE_ROWS } from "./__fixtures__/levels";
import { snapshotFromAscii, sliceLevel, restCuts, formatChunk } from "./index";
test("x", () => {
  const lvl = snapshotFromAscii(REFERENCE_ROWS);
  console.log(REFERENCE_ROWS.join("\n"));
  console.log(restCuts(lvl, lvl.entities));
  for (const c of sliceLevel(lvl, { source: "ref" })) console.log(c.id, c.startsAtRest, c.endsAtRest, "\n" + formatChunk(c));
});
