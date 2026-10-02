"""Deterministic, seeded chunk-based section generator (prototype).

A section is composed left-to-right from parameterised chunks whose geometry is
bounded by the physics ladder (never wider than the tier allows given the
run-up the previous chunk leaves). Output is a tile grid plus entity lists and
a machine-readable description, so a chooser (Jev, an LLM, or the UI) can pick
among candidates without ever touching coordinates.

Tiles: 0 empty, 1 solid. Entities: coins, slimes (on standable cells).
"""
import json, random, time
from reachpy import exit_reachable, ladder_gap, CAPS

def gen(W=24, H=12, *, difficulty=2, theme="mixed", seed=0, tier="NORMAL", ground=8):
    """difficulty 1..5 scales gap width, step height, enemy count and chunk density."""
    rnd = random.Random(seed)
    g = [[0] * W for _ in range(H)]
    heights = [None] * W                 # surface row per column (None = pit)
    coins, slimes, desc = [], [], []
    maxgap = ladder_gap(7, tier)         # with full run-up
    # difficulty -> parameter ranges (hand-authored design knowledge)
    gap_rng = {1: (2, 3), 2: (2, 4), 3: (3, 6), 4: (5, 8), 5: (7, maxgap)}[difficulty]
    step_rng = {1: (1, 1), 2: (1, 2), 3: (1, 3), 4: (2, 4), 5: (3, 5)}[difficulty]
    enemy_p = {1: 0.0, 2: 0.15, 3: 0.3, 4: 0.45, 5: 0.6}[difficulty]
    themes = {
        "mixed": ["flat", "pit", "step", "platform_over_pit", "coin_row"],
        "timing": ["pit", "pit", "step", "platform_over_pit"],
        "reward": ["coin_row", "platform_over_pit", "flat", "pit"],
        "breather": ["flat", "coin_row", "step"],
    }[theme]
    x = 0; y = ground
    def put_col(cx, surf):
        heights[cx] = surf
        if surf is not None:
            for yy in range(surf, H):
                g[yy][cx] = 1
    # 3-tile safe start
    for _ in range(3):
        put_col(x, y); x += 1
    while x < W - 3:
        kind = rnd.choice(themes)
        room = W - 3 - x
        if kind == "flat":
            n = min(room, rnd.randint(2, 4))
            for _ in range(n):
                put_col(x, y)
                if rnd.random() < enemy_p and n >= 3:
                    slimes.append((x, y - 1)); enemy_p *= 0.6
                x += 1
            desc.append(f"flat {n}")
        elif kind == "pit" and room >= 4:
            runway = 0
            k = x - 1
            while k >= 0 and heights[k] == y and runway < 7: runway += 1; k -= 1
            lim = min(ladder_gap(runway, tier), room - 2)
            lo, hi = gap_rng
            w = rnd.randint(min(lo, lim), min(hi, lim)) if lim >= 2 else 0
            if w < 2:
                put_col(x, y); x += 1; continue
            for _ in range(w):
                put_col(x, None); x += 1
            for _ in range(2):
                put_col(x, y); x += 1
            desc.append(f"pit {w}")
        elif kind == "step" and room >= 3:
            up = rnd.random() < 0.6
            dh = rnd.randint(*step_rng)
            ny = y - dh if up else y + dh
            ny = max(3, min(H - 2, ny))
            if up and (y - ny) > CAPS[tier]["maxStepUp"]:
                ny = y - int(CAPS[tier]["maxStepUp"])
            y = ny
            for _ in range(min(room, 3)):
                put_col(x, y); x += 1
            desc.append(f"step {'up' if up else 'down'} {dh}")
        elif kind == "platform_over_pit" and room >= 7:
            w = rnd.randint(5, min(9, room - 2))
            px0 = x + (w - 3) // 2
            ph = y - rnd.randint(2, 3)
            for i in range(w):
                put_col(x, None)
                if px0 <= x < px0 + 3:
                    g[ph][x] = 1
                    if rnd.random() < 0.7: coins.append((x, ph - 1))
                x += 1
            for _ in range(2):
                put_col(x, y); x += 1
            desc.append(f"platform over {w}-wide pit")
        elif kind == "coin_row" and room >= 3:
            n = min(room, rnd.randint(3, 5))
            for i in range(n):
                put_col(x, y)
                coins.append((x, y - 2 - (1 if 0 < i < n - 1 else 0)))
                x += 1
            desc.append(f"coin arc {n}")
        else:
            put_col(x, y); x += 1
    while x < W:
        put_col(x, y); x += 1
    return {"grid": g, "coins": coins, "slimes": slimes, "desc": desc, "params": {"difficulty": difficulty, "theme": theme, "seed": seed}}

def metrics(c):
    g = c["grid"]
    pits = []; run = None
    W = len(g[0]); H = len(g)
    for x in range(W):
        empty = all(g[y][x] == 0 for y in range(H))
        if empty and run is None: run = x
        if not empty and run is not None: pits.append(x - run); run = None
    return {"pits": pits, "maxPit": max(pits) if pits else 0, "coins": len(c["coins"]), "slimes": len(c["slimes"])}

if __name__ == "__main__":
    t0 = time.time(); n = 0; ok = 0; okarc = 0
    for diff in range(1, 6):
        for theme in ("mixed", "timing", "reward", "breather"):
            for seed in range(20):
                c = gen(difficulty=diff, theme=theme, seed=seed)
                n += 1
                if exit_reachable(c["grid"], (0, 7)): ok += 1
                if exit_reachable(c["grid"], (0, 7), arc_min=True): okarc += 1
    dt = time.time() - t0
    print(f"{n} candidates in {dt:.2f}s ({1000*dt/n:.1f} ms each incl. reachability x2); valid faithful {ok}/{n}, arc_min {okarc}/{n}")
    c = gen(difficulty=3, theme="mixed", seed=7)
    for y, row in enumerate(c["grid"]):
        print("".join("#" if v else ("c" if (x, y) in c["coins"] else ("s" if (x, y) in c["slimes"] else ".")) for x, v in enumerate(row)))
    print(c["desc"], metrics(c))
