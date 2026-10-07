"""Python replica of the fork's reachability engine (reachability.ts, NORMAL tier)
with an optional arc-clearance check, for evaluating generated grids.
grid[y][x] = 1 solid. Row index grows downward. Cells below the grid are empty."""
import json
CAPS = json.load(open(__file__.rsplit("/", 1)[0] + "/caps.json"))

def ladder_gap(r, tier="NORMAL"):
    best = 0
    for rung in CAPS[tier]["ladder"]:
        if r >= rung["runwayTiles"]:
            best = rung["gapTiles"]
    return best

def reach(grid, start, tier="NORMAL", arc=False, frontier=False, arc_min=False):
    H, W = len(grid), len(grid[0])
    step_up = CAPS[tier]["maxStepUp"]
    MAXRUN = CAPS[tier]["ladder"][-1]["runwayTiles"]
    def solid(x, y): return 0 <= x < W and 0 <= y < H and grid[y][x] == 1
    def stand(x, y): return 0 <= x < W and 0 <= y and y + 1 < H and not solid(x, y) and solid(x, y + 1)
    def runway(x, y, d):
        r = 0
        while r < MAXRUN and stand(x - d * (r + 1), y): r += 1
        return r
    def head(x, y, n): return all(not solid(x, y - i) for i in range(1, n + 1) if y - i >= 0)
    def arc_clear(x, y, d, dx, ty):
        top = min(y, ty) - int(step_up)
        return all(not solid(x + d * ix, cy) for ix in range(1, dx) for cy in range(max(0, top), max(y, ty) + 1))
    def arc_passable(x, y, d, dx, ty):
        # Necessary condition: every intermediate column must have at least one
        # empty cell in the band the arc can occupy; a fully solid band is a wall.
        top = min(y, ty) - int(step_up)
        for ix in range(1, dx):
            cx = x + d * ix
            band = range(max(0, top), max(y, ty) + 1)
            if all(solid(cx, cy) for cy in band):
                return False
        return True
    fr = {}
    if frontier:  # solver-accurate allowed gap per (runway, rise), exported from jumpSolver
        for rw, lst in CAPS[tier]["frontier"].items():
            fr[int(rw)] = {e["rise"]: e["gap"] for e in lst}
    def allowed(r, rise):
        if frontier:
            rung = max(k for k in fr if r >= k)
            if rise in fr[rung]: return fr[rung][rise]
            return fr[rung][min(fr[rung], key=lambda q: abs(q - rise))] if rise < 0 else 0
        g = ladder_gap(r, tier)
        return g if rise <= 0 else max(0, g - 2 * rise)
    def nbrs(x, y):
        out = []
        for d in (1, -1):
            nx = x + d
            if stand(nx, y): out.append((nx, y))
            if stand(nx, y - 1) and not solid(x, y - 1): out.append((nx, y - 1))
            if 0 <= nx < W and not solid(nx, y) and not stand(nx, y):
                for fy in range(y + 1, H):
                    if solid(nx, fy): break
                    if stand(nx, fy): out.append((nx, fy)); break
            r = runway(x, y, d)
            gmax = ladder_gap(r, tier) if not frontier else max(allowed(r, q) for q in range(-8, 1))
            for dx in range(2, gmax + 2):
                tx = x + d * dx
                for rise in range(-H, int(step_up) + 1):
                    ty = y - rise
                    if not stand(tx, ty): continue
                    if dx - 1 > allowed(r, rise): continue
                    if rise > 0 and not head(x, y, rise + 1): continue
                    if arc and not arc_clear(x, y, d, dx, ty): continue
                    if arc_min and not arc_passable(x, y, d, dx, ty): continue
                    out.append((tx, ty))
        for rise in range(2, int(step_up) + 1):
            for tx in (x, x - 1, x + 1):
                if stand(tx, y - rise) and head(x, y, rise + 1): out.append((tx, y - rise))
        return out
    sx, sy = start
    while sy < H and not stand(sx, sy):
        if solid(sx, sy): sy -= 1; break
        sy += 1
    if not stand(sx, sy): return set()
    seen = {(sx, sy)}; st = [(sx, sy)]
    while st:
        c = st.pop()
        for n in nbrs(*c):
            if n not in seen: seen.add(n); st.append(n)
    return seen

def exit_reachable(grid, start, **kw):
    W = len(grid[0])
    return any(x == W - 1 for (x, _) in reach(grid, start, **kw))
