// EXPERIMENT (audit C2): build the AI's view of the level at send time from
// live tile state, instead of a sentence cached when the box was drawn.
import type { EditorScene } from "../phaser/editorScene.ts";

const MARGIN = 3;

function glyph(ground: number, item: number): string {
  if (item === 2) return "c";
  if (item === 3) return "f";
  switch (ground) {
    case 4:
      return "=";
    case 5:
    case 6:
      return "#";
    case 7:
      return "?";
    case 8:
      return "U";
    case 9:
      return "s";
    default:
      return ".";
  }
}

export function buildGridContext(box: any, scene: EditorScene): string {
  const b = box.getBounds();
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.width - 1;
  const y1 = b.y + b.height - 1;
  const gx0 = Math.max(0, x0 - MARGIN);
  const gx1 = Math.min(scene.map.width - 1, x1 + MARGIN);
  const gy0 = Math.max(0, y0 - MARGIN);
  const gy1 = Math.min(scene.map.height - 1, y1 + MARGIN);

  const rows: string[] = [];
  // Column ruler: last digit of x, with a full label every 5 columns.
  let tens = "      ";
  let ones = "      ";
  for (let x = gx0; x <= gx1; x++) {
    tens += x % 5 === 0 ? String(Math.floor(x / 10) % 10) : " ";
    ones += String(x % 10);
  }
  rows.push(tens, ones);
  const entities: string[] = [];
  for (let y = gy0; y <= gy1; y++) {
    let line = `y=${String(y).padStart(2, " ")} `;
    for (let x = gx0; x <= gx1; x++) {
      const g = scene.groundLayer.getTileAt(x, y);
      const c = scene.collectablesLayer.getTileAt(x, y);
      const gi = g ? g.index : -1;
      const ci = c ? c.index : -1;
      const ch = glyph(gi, ci);
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      // Outside the editable box: show content, but mark empty cells with ','
      line += inside ? ch : ch === "." ? "," : ch;
      if (ch === "s" || ch === "U") entities.push(`${ch === "s" ? "slime" : "ultra slime"} at (${x},${y})`);
      if (ch === "c" || ch === "f") entities.push(`${ch === "c" ? "coin" : "fruit"} at (${x},${y})`);
    }
    rows.push(line);
  }

  return (
    `[LEVEL VIEW — computed now from the live map]\n` +
    `Editable selection box: x=${x0}..${x1}, y=${y0}..${y1} (inclusive). You may only change cells inside it.\n` +
    `Coordinates are global. x grows to the right, y grows DOWNWARD (y=19 is the bottom row).\n` +
    `Legend: . empty (inside box)   , empty (outside box, not editable)   # grass/dirt block (tile 6/5)   = platform block (tile 4)   ? question block (tile 7)   c coin (tile 2)   f fruit (tile 3)   s slime (tile 9)   U ultra slime (tile 8).\n` +
    `A cell is 'standable' if it is empty and the cell directly below it is solid. The player spawns at (6,9) and travels left to right.\n` +
    rows.join("\n") +
    (entities.length ? `\nObjects in view: ${entities.join("; ")}.` : "\nObjects in view: none.")
  );
}

/** Compact, model-facing record of what the AI changed this turn. */
export function summarizeActions(
  toolCalls: { name: string; args: Record<string, any>; result: string }[],
): string {
  const WRITE = new Set(["placeSingleTile", "placeGridofTiles", "clearTiles", "undoRedo"]);
  const lines: string[] = [];
  for (const tc of toolCalls) {
    if (!WRITE.has(tc.name)) continue;
    const ok = !/❌|Cannot|Failed/i.test(String(tc.result));
    const a = tc.args ?? {};
    let what = "";
    if (tc.name === "placeSingleTile") what = `placed tile ${a.tileIndex} at (${a.x},${a.y})`;
    else if (tc.name === "placeGridofTiles") what = `placed tile ${a.tileIndex} in x=${a.xMin}..${a.xMax}, y=${a.yMin}..${a.yMax}`;
    else if (tc.name === "clearTiles") what = `cleared x=${a.xMin}..${a.xMax}, y=${a.yMin}..${a.yMax}`;
    else what = `${tc.name} ${JSON.stringify(a)}`;
    lines.push(`${ok ? "OK" : "REJECTED"}: ${what}`);
  }
  return lines.length ? `[ACTIONS THIS TURN — hidden from player]\n${lines.join("\n")}` : "";
}
