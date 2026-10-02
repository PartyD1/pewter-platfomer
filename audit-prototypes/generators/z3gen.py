"""Z3 level-section generator for Pewter (prototype, not production code).

Encodes the fork's reachability rules (src/languageModel/reachability.ts,
NORMAL tier, capability ladder exported from the frame-accurate jump solver)
as constraints over a W x H grid of Bool `solid[x][y]` (y grows downward), and
asks Z3 for a grid in which the exit column is reachable from the entry cell.

Modes:
  faithful : exactly the checker's rules (jumps ignore what is between takeoff
             and landing; only takeoff-column headroom is checked).
  arcsafe  : additionally requires the columns strictly between takeoff and
             landing to be empty from the higher of the two surfaces up to the
             jump apex (a conservative arc-clearance approximation).
Style constraints (optional): no isolated tiles, platforms >= 2 wide,
ground below the ground line has no caves.
"""
import json, sys, time, random, argparse
from z3 import (Bool, Int, Solver, And, Or, Not, Implies, If, Sum, sat, BoolVal,
                PbGe, PbLe, PbEq, set_param)

CAPS = json.load(open(__file__.rsplit("/", 1)[0] + "/caps.json"))

def ladder_gap(runway, tier="NORMAL"):
    best = 0
    for rung in CAPS[tier]["ladder"]:
        if runway >= rung["runwayTiles"]:
            best = rung["gapTiles"]
    return best

def build(W, H, *, mode="faithful", style=False, pits=0, pit_min=2, pit_max=6,
          entry_y=None, ground_line=None, coins=0, slimes=0, pinned=None,
          seed=0, tier="NORMAL", forbid=None, require_jump_gap=None, timeout_ms=120000):
    set_param("sat.random_seed", seed); set_param("smt.random_seed", seed)
    rnd = random.Random(seed)
    S = Solver(); S.set("timeout", timeout_ms)
    step_up = CAPS[tier]["maxStepUp"]
    RUNG = [r["runwayTiles"] for r in CAPS[tier]["ladder"]]
    MAXRUN = RUNG[-1]
    gl = ground_line if ground_line is not None else H - 4   # top row of default ground
    ey = entry_y if entry_y is not None else gl - 1

    solid = [[Bool(f"s_{x}_{y}") for y in range(H + 1)] for x in range(W)]
    # Row H is a virtual bottom: never solid (falling off the bottom = death).
    for x in range(W):
        S.add(Not(solid[x][H]))
    def sol(x, y):
        if x < 0 or x >= W or y < 0:
            return BoolVal(False)
        return solid[x][min(y, H)]
    def stand(x, y):
        if x < 0 or x >= W or y < 0 or y + 1 > H - 1:
            return BoolVal(False)
        return And(Not(solid[x][y]), solid[x][y + 1])
    ST = {(x, y): Bool(f"st_{x}_{y}") for x in range(W) for y in range(H)}
    for (x, y), v in ST.items():
        S.add(v == stand(x, y))

    # Entry: standable at (0, ey); keep a 2-tile landing pad so spawns are sane.
    S.add(ST[(0, ey)], ST[(1, ey)])

    reach = {(x, y): Bool(f"r_{x}_{y}") for x in range(W) for y in range(H)}
    dist = {(x, y): Int(f"d_{x}_{y}") for x in range(W) for y in range(H)}
    preds = {c: [] for c in reach}          # list of (pred_cell, condition)

    def runway_ge(x, y, d, k):
        return And([ST[(x - d * i, y)] for i in range(1, k + 1)]) if all(0 <= x - d * i < W for i in range(1, k + 1)) else BoolVal(False)

    def headroom(x, y, n):
        return And([Not(sol(x, y - i)) for i in range(1, n + 1) if y - i >= 0]) if n > 0 else BoolVal(True)

    for x in range(W):
        for y in range(H - 1):
            src = (x, y)
            for d in (1, -1):
                nx = x + d
                if 0 <= nx < W:
                    preds[(nx, y)].append((src, BoolVal(True)))                  # walk
                    if y - 1 >= 0:
                        preds[(nx, y - 1)].append((src, Not(sol(x, y - 1))))       # 1-step up
                    for fy in range(y + 1, H - 1):                                  # fall
                        cond = And([Not(sol(nx, k)) for k in range(y, fy + 1)])
                        preds[(nx, fy)].append((src, cond))
                # jumps: gap-limited by runway ladder, rising penalty 2/tile
                gmax = ladder_gap(MAXRUN, tier)
                for dx in range(2, gmax + 2):
                    tx = x + d * dx
                    if not (0 <= tx < W):
                        continue
                    for rise in range(-(H - 1), step_up + 1):
                        ty = y - rise
                        if not (0 <= ty < H - 1):
                            continue
                        gap = dx - 1
                        opts = []
                        for k in RUNG:
                            allowed = ladder_gap(k, tier)
                            allowed = allowed if rise <= 0 else max(0, allowed - 2 * rise)
                            if gap <= allowed:
                                opts.append(runway_ge(x, y, d, k))
                                break          # smallest runway rung that suffices
                        if not opts:
                            continue
                        cond = [Or(opts)]
                        if rise > 0:
                            cond.append(headroom(x, y, rise + 1))
                        if mode == "arcsafe":
                            apex = int(CAPS[tier]["maxStepUp"])  # ~6.3 tiles
                            top = min(y, ty) - apex
                            for ix in range(1, dx):
                                cx = x + d * ix
                                for cy in range(max(0, top), max(y, ty) + 1):
                                    cond.append(Not(sol(cx, cy)))
                        preds[(tx, ty)].append((src, And(cond)))
            for rise in range(2, step_up + 1):                                     # vertical
                for tx in (x, x - 1, x + 1):
                    if 0 <= tx < W and y - rise >= 0:
                        preds[(tx, y - rise)].append((src, headroom(x, y, rise + 1)))

    N = W * H
    for c, v in reach.items():
        S.add(Implies(v, ST[c]))
        S.add(dist[c] >= 0, dist[c] <= N)
        if c == (0, ey):
            S.add(v, dist[c] == 0)
            continue
        support = [And(reach[p], ST[p], cond, dist[p] < dist[c]) for p, cond in preds[c]]
        S.add(Implies(v, Or(support) if support else BoolVal(False)))

    # Exit: some reachable standable cell in the last column.
    S.add(Or([reach[(W - 1, y)] for y in range(H - 1)]))

    # Ground: rows >= ground_line are "terrain" columns; a column is either a pit
    # (all empty) or solid from its surface down (no caves) — only enforced with style.
    col_pit = [Bool(f"pit_{x}") for x in range(W)]
    for x in range(W):
        S.add(col_pit[x] == And([Not(solid[x][y]) for y in range(gl, H)]))
    S.add(Not(col_pit[0]), Not(col_pit[1]), Not(col_pit[W - 1]))
    # pits: count maximal pit runs and their widths
    starts = [And(col_pit[x], Not(col_pit[x - 1])) if x > 0 else col_pit[0] for x in range(W)]
    S.add(PbEq([(s, 1) for s in starts], pits) if pits else And([Not(p) for p in col_pit]))
    for x in range(W):
        # width bounds for runs that start at x
        for w in range(1, pit_min):
            if x + w <= W:
                ends_early = And([col_pit[x + i] for i in range(w)] + ([Not(col_pit[x + w])] if x + w < W else []))
                S.add(Implies(starts[x], Not(ends_early)))
        if x + pit_max < W:
            S.add(Implies(starts[x], Not(And([col_pit[x + i] for i in range(pit_max + 1)]))))

    if style:
        for x in range(W):
            for y in range(H):
                s = solid[x][y]
                nb = [sol(x - 1, y), sol(x + 1, y)]
                S.add(Implies(s, Or(nb)))                                        # platforms >= 2 wide
                if y >= gl and y + 1 < H:
                    S.add(Implies(s, Or(sol(x, y + 1), BoolVal(y + 1 >= H))))    # terrain has no caves
            # nothing solid in the top 2 rows (headroom for the camera)
            S.add(Not(solid[x][0]), Not(solid[x][1]))
        # density cap: at most 40% of non-terrain cells solid
        air = [(solid[x][y], 1) for x in range(W) for y in range(gl)]
        S.add(PbLe(air, int(0.12 * len(air))))

    if pinned:
        for (x, y), v in pinned.items():
            S.add(solid[x][y] if v else Not(solid[x][y]))
    if forbid:
        for g in forbid:  # diversity: differ from each previous grid in >= k cells
            prev, k = g
            diffs = [(solid[x][y] != BoolVal(bool(prev[y][x])), 1) for x in range(W) for y in range(H)]
            S.add(PbGe(diffs, k))
    return S, solid, reach, gl, ey

def solve(W, H, **kw):
    t0 = time.time()
    S, solid, reach, gl, ey = build(W, H, **kw)
    t1 = time.time()
    res = S.check()
    t2 = time.time()
    out = {"W": W, "H": H, "result": str(res), "build_s": round(t1 - t0, 3), "solve_s": round(t2 - t1, 3)}
    if res == sat:
        m = S.model()
        grid = [[1 if m.eval(solid[x][y], model_completion=True) else 0 for x in range(W)] for y in range(H)]
        path = [[1 if m.eval(reach[(x, y)], model_completion=True) else 0 for x in range(W)] for y in range(H)]
        out["grid"] = grid; out["reach"] = path
    return out

def show(o):
    if "grid" not in o:
        return o["result"]
    rows = []
    for y, row in enumerate(o["grid"]):
        rows.append("".join("#" if v else ("o" if o["reach"][y][x] else ".") for x, v in enumerate(row)))
    return "\n".join(rows)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--W", type=int, default=24); ap.add_argument("--H", type=int, default=12)
    ap.add_argument("--mode", default="faithful"); ap.add_argument("--style", action="store_true")
    ap.add_argument("--pits", type=int, default=2); ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    o = solve(a.W, a.H, mode=a.mode, style=a.style, pits=a.pits, seed=a.seed)
    print(json.dumps({k: v for k, v in o.items() if k not in ("grid", "reach")}))
    print(show(o))
