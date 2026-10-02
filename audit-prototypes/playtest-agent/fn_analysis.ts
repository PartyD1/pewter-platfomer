// For levels the fork's engine rejects but the agent beats: replay the agent's path, split it into
// airborne segments (takeoff cell -> landing cell) and label the first move the engine does not model.
import fs from "fs";
import { Level, search, spawnBody, frame, T } from "./physsim.ts";
import { maxGapForRunway, maxStepUpTiles } from "/home/user/partyd1/pewter-the-platformer/src/phaser/movementCapabilities.ts";
const d = JSON.parse(fs.readFileSync("disagreements.json", "utf8"));
const cats: Record<string, number> = {}; const examples: any[] = [];
for (const r of d.fn) {
  const L = new Level(r.grid);
  const res = search(L, { x: 0, y: 7 }, { K: 4, qx: 4, qv: 32, goalCol: 23, maxExpand: 1_500_000 });
  const inputs = res.found ? res.inputs! : search(L, { x: 0, y: 7 }, { K: 2, qx: 2, qv: 32, goalCol: 23, maxExpand: 2_500_000 }).inputs!;
  const b = spawnBody(0, 7); let wasDown = true; let take: any = null; const segs: any[] = [];
  const stand = (x: number, y: number) => !L.solid(x, y) && L.solid(x, y + 1);
  // supported cell: of the columns the body overlaps, the standable one nearest the body centre
  const supportCell = () => { const y = Math.floor((b.y + 13.99) / T); const xs = [Math.floor((b.x + 5) / T), Math.floor(b.x / T), Math.floor((b.x + 9.99) / T)];
    for (const x of xs) if (stand(x, y)) return { x, y }; return { x: xs[0], y }; };
  let last = supportCell();
  for (const inp of inputs) {
    frame(L, b, inp.move, inp.jump);
    if (wasDown && !b.down) take = { ...last };
    if (!wasDown && b.down && take) { segs.push({ from: take, to: supportCell() }); take = null; }
    wasDown = b.down; if (b.down) last = supportCell();
  }
  const runway = (x: number, y: number, dir: number) => { let k = 0; while (k < 7 && stand(x - dir * (k + 1), y)) k++; return k; };
  let label = "unclassified";
  for (const s of segs) {
    const dx = s.to.x - s.from.x, rise = s.from.y - s.to.y, dir = Math.sign(dx) || 1, gap = Math.abs(dx) - 1;
    const rw = runway(s.from.x, s.from.y, dir), lad = maxGapForRunway(rw, "EXPERT"), step = maxStepUpTiles("EXPERT");
    if (rise > step) { label = `climb above engine step-up (rise ${rise} > ${step})`; break; }
    if (Math.abs(dx) <= 1) continue;
    if (rise > 0 && gap > Math.max(0, lad - 2 * rise)) { label = `rising jump beyond 2x-rise penalty (rise ${rise}, gap ${gap}, runway ${rw}; engine allows ${Math.max(0, lad - 2 * rise)})`; break; }
    if (rise < 0 && gap > lad) { label = `descending jump longer than flat max (drop ${-rise}, gap ${gap}, runway ${rw}; engine allows ${lad})`; break; }
    if (rise === 0 && gap > lad) { label = `flat jump beyond runway rung (gap ${gap}, runway ${rw}; engine allows ${lad})`; break; }
  }
  const cat = label.split(" (")[0]; cats[cat] = (cats[cat] || 0) + 1;
  if (examples.filter((e) => e.cat === cat).length < 2) examples.push({ name: r.name, cat, label, grid: r.grid.map((row: number[]) => row.map((v) => (v ? "#" : ".")).join("")) });
}
for (const e of examples) { console.log("\n" + e.name, e.label); console.log(e.grid.join("\n")); }
console.log("\nCATEGORIES", JSON.stringify(cats));
