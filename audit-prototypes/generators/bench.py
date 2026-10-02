"""Z3 vs clingo vs chunk generator: time-to-first-valid-section by size (faithful rules + style)."""
import json, time, sys, multiprocessing as mp
def frags(g):
    H, W = len(g), len(g[0]); seen = set(); n = 0; singles = 0
    for y in range(H):
        for x in range(W):
            if g[y][x] and (x, y) not in seen:
                n += 1; st = [(x, y)]; seen.add((x, y)); size = 0
                while st:
                    cx, cy = st.pop(); size += 1
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        q = (cx + dx, cy + dy)
                        if 0 <= q[0] < W and 0 <= q[1] < H and g[q[1]][q[0]] and q not in seen: seen.add(q); st.append(q)
                if size == 1: singles += 1
    return n, singles
def z3_job(W, H, seed, q):
    from z3gen import solve
    o = solve(W, H, mode="faithful", style=True, pits=2, seed=seed)
    q.put({"build_s": o["build_s"], "solve_s": o["solve_s"], "result": o["result"], "grid": o.get("grid")})
def asp_job(W, H, seed, q):
    import aspgen
    o = aspgen.solve(W, H, mode="faithful", style=True, pits=2, seed=seed, timeout=170)
    q.put({"build_s": o["ground_s"], "solve_s": o["solve_s"], "result": o["result"], "grid": (o["grids"] or [None])[0]})
def run(job, W, H, seed, limit=180):
    q = mp.Queue(); p = mp.Process(target=job, args=(W, H, seed, q)); t0 = time.time(); p.start(); p.join(limit)
    if p.is_alive(): p.terminate(); p.join(); return {"result": "timeout", "wall_s": round(time.time() - t0, 1)}
    r = q.get() if not q.empty() else {"result": "crash"}; r["wall_s"] = round(time.time() - t0, 1); return r
if __name__ == "__main__":
    out = []
    for (W, H) in [(16, 12), (24, 12), (32, 12), (48, 12), (64, 12)]:
        for seed in (1, 2):
            for name, job in (("clingo", asp_job), ("z3", z3_job)):
                r = run(job, W, H, seed)
                rec = {"solver": name, "W": W, "H": H, "seed": seed, **{k: v for k, v in r.items() if k != "grid"}}
                if r.get("grid"):
                    g = r["grid"]; rec["fragments"], rec["singles"] = frags(g); rec["grid"] = g
                out.append(rec); print({k: v for k, v in rec.items() if k != "grid"}, flush=True)
                json.dump(out, open("bench.json", "w"))
    # chunk generator timing at the same sizes
    from chunkgen import gen
    from reachpy import exit_reachable
    for (W, H) in [(16, 12), (24, 12), (32, 12), (48, 12), (64, 12)]:
        t0 = time.time(); n = 0
        for seed in range(50):
            c = gen(W=W, H=H, difficulty=3, seed=seed); exit_reachable(c["grid"], (0, 7)); n += 1
        print({"solver": "chunkgen+check", "W": W, "ms_each": round(1000 * (time.time() - t0) / n, 2)}, flush=True)
