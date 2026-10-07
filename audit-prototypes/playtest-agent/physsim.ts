/**
 * Physics-faithful playtest agent for Pewter levels (audit prototype).
 *
 * - Player movement: the fork's own pure `stepMovement` (playerPhysics.ts).
 * - Body integration + tile collision: a line-by-line re-implementation of
 *   Phaser 3.90 Arcade (Body.update / World.computeVelocity /
 *   collideSpriteVsTilemapLayer / SeparateTile / TileCheckX|Y), fixed 1/60 step,
 *   TILE_BIAS 16, tile faces computed like CalculateFacesWithin.
 * - Search: A* over macro-actions (move -1/0/1 x jump held/not) applied for K
 *   frames, deduplicated on a quantised state. A found path is a concrete
 *   frame-by-frame input sequence that can be replayed in the real game.
 */
import {
  stepMovement,
  createMovementState,
  GRAVITY_PX,
  MAX_RUN_SPEED_PX,
  TERMINAL_VELOCITY_PX,
  PLAYER_BODY_PX,
  type PlayerMovementState,
} from "/home/user/partyd1/pewter-the-platformer/src/phaser/playerPhysics.ts";

export const T = 16;
export const DT = 1 / 60;
const BIAS = 16;
const BW = PLAYER_BODY_PX.width; // 10
const BH = PLAYER_BODY_PX.height; // 14

export type Grid = number[][]; // grid[y][x] = 1 solid

export interface Body {
  x: number; y: number; vx: number; vy: number;
  down: boolean; up: boolean; left: boolean; right: boolean;
  dx: number; dy: number;
  ms: PlayerMovementState; prevJump: boolean;
}

export class Level {
  W: number; H: number; s: Uint8Array; face: Uint8Array; // bits: 1 top 2 bottom 4 left 8 right
  constructor(public grid: Grid) {
    this.H = grid.length; this.W = grid[0].length;
    this.s = new Uint8Array(this.W * this.H); this.face = new Uint8Array(this.W * this.H);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) this.s[y * this.W + x] = grid[y][x] ? 1 : 0;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (!this.solid(x, y)) continue;
      let f = 0;
      if (!this.solid(x, y - 1)) f |= 1;
      if (!this.solid(x, y + 1)) f |= 2;
      if (!this.solid(x - 1, y)) f |= 4;
      if (!this.solid(x + 1, y)) f |= 8;
      this.face[y * this.W + x] = f;
    }
  }
  solid(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H && this.s[y * this.W + x] === 1; }
}

function tileCheckX(b: Body, faceL: boolean, faceR: boolean, l: number, r: number): number {
  let ox = 0;
  if (b.dx < 0) { if (faceR && b.x < r) { ox = b.x - r; if (ox < -BIAS) ox = 0; } }
  else if (b.dx > 0) { if (faceL && b.x + BW > l) { ox = b.x + BW - l; if (ox > BIAS) ox = 0; } }
  if (ox !== 0) { if (ox < 0) b.left = true; else b.right = true; b.x -= ox; b.vx = 0; }
  return ox;
}
function tileCheckY(b: Body, faceT: boolean, faceB: boolean, t: number, bot: number): number {
  let oy = 0;
  if (b.dy < 0) { if (faceB && b.y < bot) { oy = b.y - bot; if (oy < -BIAS) oy = 0; } }
  else if (b.dy > 0) { if (faceT && b.y + BH > t) { oy = b.y + BH - t; if (oy > BIAS) oy = 0; } }
  if (oy !== 0) { if (oy < 0) b.up = true; else b.down = true; b.y -= oy; b.vy = 0; }
  return oy;
}
const intersects = (b: Body, l: number, t: number, r: number, bot: number) =>
  !(b.x + BW <= l || b.y + BH <= t || b.x >= r || b.y >= bot);

function separateTile(b: Body, f: number, l: number, t: number, r: number, bot: number) {
  const faceT = !!(f & 1), faceB = !!(f & 2), faceL = !!(f & 4), faceR = !!(f & 8);
  const fh = faceL || faceR, fv = faceT || faceB;
  if (!fh && !fv) return;
  let minX = 0, minY = 1;
  const adx = Math.abs(b.dx), ady = Math.abs(b.dy);
  if (adx > ady) minX = -1; else if (adx < ady) minY = -1;
  if (b.dx !== 0 && b.dy !== 0 && fh && fv) {
    minX = Math.min(Math.abs(b.x - r), Math.abs(b.x + BW - l));
    minY = Math.min(Math.abs(b.y - bot), Math.abs(b.y + BH - t));
  }
  if (minX < minY) {
    if (fh) { const ox = tileCheckX(b, faceL, faceR, l, r); if (ox !== 0 && !intersects(b, l, t, r, bot)) return; }
    if (fv) tileCheckY(b, faceT, faceB, t, bot);
  } else {
    if (fv) { const oy = tileCheckY(b, faceT, faceB, t, bot); if (oy !== 0 && !intersects(b, l, t, r, bot)) return; }
    if (fh) tileCheckX(b, faceL, faceR, l, r);
  }
}

function collide(L: Level, b: Body) {
  let xs = Math.floor((b.x - T) / T), ys = Math.floor((b.y - T) / T);
  const xe = Math.ceil((b.x + BW) / T), ye = Math.ceil((b.y + BH) / T);
  let w = xe - xs, h = ye - ys;
  if (xs < 0) { w += xs; xs = 0; }
  if (ys < 0) { h += ys; ys = 0; }
  if (xs + w > L.W) w = Math.max(L.W - xs, 0);
  if (ys + h > L.H) h = Math.max(L.H - ys, 0);
  for (let ty = ys; ty < ys + h; ty++) for (let tx = xs; tx < xs + w; tx++) {
    const i = ty * L.W + tx;
    if (!L.s[i] || !L.face[i]) continue;
    const l = tx * T, t = ty * T;
    if (!intersects(b, l, t, l + T, t + T)) continue;
    separateTile(b, L.face[i], l, t, l + T, t + T);
  }
}

/** One rendered frame at 60fps: controller (stepMovement) then one Arcade step. */
export function frame(L: Level, b: Body, move: -1 | 0 | 1, jumpHeld: boolean) {
  const jumpJustPressed = jumpHeld && !b.prevJump;
  b.prevJump = jumpHeld;
  const r = stepMovement(b.ms, { moveInput: move, jumpHeld, jumpJustPressed }, b.vx, b.vy, b.down, DT);
  b.vx = r.velocityX; b.vy = r.velocityY;
  // Arcade step: resetFlags, integrate (gravity + maxVelocity clamp), collide
  b.down = b.up = b.left = b.right = false;
  const px = b.x, py = b.y;
  let vx = b.vx, vy = b.vy + GRAVITY_PX * DT;
  vx = Math.max(-MAX_RUN_SPEED_PX, Math.min(MAX_RUN_SPEED_PX, vx));
  vy = Math.max(-TERMINAL_VELOCITY_PX, Math.min(TERMINAL_VELOCITY_PX, vy));
  b.vx = vx; b.vy = vy;
  b.x += vx * DT; b.y += vy * DT;
  b.dx = b.x - px; b.dy = b.y - py;
  collide(L, b);
}

export function spawnBody(cellX: number, cellY: number): Body {
  // Body centred in the cell, feet on the cell below (sprite origin 0.5, offset 3,1).
  return { x: cellX * T + 3, y: (cellY + 1) * T - BH, vx: 0, vy: 0, down: true, up: false, left: false, right: false,
    dx: 0, dy: 0, ms: createMovementState(), prevJump: false };
}
const clone = (b: Body): Body => ({ ...b, ms: { ...b.ms } });

export interface SearchOpts { K?: number; maxExpand?: number; goalCol?: number; qx?: number; qv?: number; deathY?: number; startBody?: { x: number; y: number } }
export interface SearchResult { found: boolean; expanded: number; visited: number; frames?: number; ms: number; exhausted: boolean;
  inputs?: { move: -1 | 0 | 1; jump: boolean }[]; }

const ACTIONS: { move: -1 | 0 | 1; jump: boolean }[] = [
  { move: 1, jump: false }, { move: 1, jump: true }, { move: 0, jump: false },
  { move: 0, jump: true }, { move: -1, jump: false }, { move: -1, jump: true },
];

class Heap { a: number[] = []; k: number[] = [];
  push(v: number, key: number) { const a = this.a, k = this.k; a.push(v); k.push(key); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [a[p], a[i]] = [a[i], a[p]]; [k[p], k[i]] = [k[i], k[p]]; i = p; } }
  pop(): number { const a = this.a, k = this.k; const top = a[0]; const lv = a.pop()!, lk = k.pop()!;
    if (a.length) { a[0] = lv; k[0] = lk; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < a.length && k[l] < k[m]) m = l; if (r < a.length && k[r] < k[m]) m = r; if (m === i) break;
      [a[m], a[i]] = [a[i], a[m]]; [k[m], k[i]] = [k[i], k[m]]; i = m; } }
    return top; }
  get size() { return this.a.length; } }

export function search(L: Level, start: { x: number; y: number }, o: SearchOpts = {}): SearchResult {
  const K = o.K ?? 4, maxExpand = o.maxExpand ?? 3_000_000, goalCol = o.goalCol ?? L.W - 1;
  const qx = o.qx ?? 1, qv = o.qv ?? 16, deathY = o.deathY ?? L.H * T + 48;
  const t0 = Date.now();
  const goalX = goalCol * T;
  const nodes: { b: Body; parent: number; act: number; g: number }[] = [];
  const seen = new Set<number>();
  const keyOf = (b: Body) => {
    const fl = (b.down ? 1 : 0) | (b.ms.canCutJump ? 2 : 0) | (b.prevJump ? 4 : 0) | (b.ms.coyoteTimer > 0 ? 8 : 0) | (b.ms.jumpBufferTimer > 0 ? 16 : 0);
    const kx = Math.round(b.x / qx) + 1024, ky = Math.round(b.y / qx) + 1024;
    const kvx = Math.round(b.vx / qv) + 64, kvy = Math.round(b.vy / 25) + 64;
    return ((((kx * 4096 + ky) * 128 + kvx) * 128 + kvy) * 32) + fl;
  };
  const h = (b: Body) => Math.max(0, goalX - (b.x + BW)) / MAX_RUN_SPEED_PX * 60;
  const isGoal = (b: Body) => b.down && Math.floor((b.x + BW / 2) / T) >= goalCol;
  const b0 = spawnBody(start.x, start.y);
  if (o.startBody) { b0.x = o.startBody.x; b0.y = o.startBody.y; b0.down = false; }
  const heap = new Heap();
  nodes.push({ b: b0, parent: -1, act: -1, g: 0 }); seen.add(keyOf(b0)); heap.push(0, h(b0));
  let expanded = 0;
  while (heap.size) {
    const ni = heap.pop(); const n = nodes[ni];
    if (isGoal(n.b)) {
      const inputs: { move: -1 | 0 | 1; jump: boolean }[] = [];
      let c = ni; const acts: number[] = [];
      while (nodes[c].parent >= 0) { acts.push(nodes[c].act); c = nodes[c].parent; }
      acts.reverse(); for (const a of acts) for (let i = 0; i < K; i++) inputs.push(ACTIONS[a]);
      return { found: true, expanded, visited: seen.size, frames: n.g, ms: Date.now() - t0, exhausted: false, inputs };
    }
    if (++expanded > maxExpand) return { found: false, expanded, visited: seen.size, ms: Date.now() - t0, exhausted: false };
    for (let a = 0; a < ACTIONS.length; a++) {
      const b = clone(n.b); let dead = false;
      for (let i = 0; i < K; i++) { frame(L, b, ACTIONS[a].move, ACTIONS[a].jump); if (b.y > deathY) { dead = true; break; } }
      if (dead) continue;
      const k = keyOf(b); if (seen.has(k)) continue; seen.add(k);
      nodes.push({ b, parent: ni, act: a, g: n.g + K }); heap.push(nodes.length - 1, n.g + K + h(b));
    }
  }
  return { found: false, expanded, visited: seen.size, ms: Date.now() - t0, exhausted: true };
}

/** Replay an input list and return the per-frame trajectory (for engine validation). */
export function replay(L: Level, start: { x: number; y: number }, inputs: { move: -1 | 0 | 1; jump: boolean }[]) {
  const b = spawnBody(start.x, start.y); const traj: number[][] = [];
  for (const i of inputs) { frame(L, b, i.move, i.jump); traj.push([b.x, b.y, b.vx, b.vy, b.down ? 1 : 0]); }
  return traj;
}
