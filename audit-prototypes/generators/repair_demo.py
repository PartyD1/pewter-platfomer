import json, time
from aspgen import repair
from reachpy import exit_reachable
W, H, gl = 24, 12, 8
def show(g, base=None):
    return "\n".join("".join(("#" if (base and base[y][x]) else "+") if g[y][x] else "." for x in range(W)) for y in range(H))
demos = {}
# Demo A: user dug a 14-wide pit (unjumpable: max 12) and wants it kept.
g = [[1 if y >= gl and not (6 <= x <= 19) else 0 for x in range(W)] for y in range(H)]
pin0 = [(x, y) for x in range(6, 20) for y in range(gl, H)]
# Demo B: user drew a 3-wide wall 7 tiles tall on the ground (too tall to climb: step-up 6).
gB = [[1 if y >= gl else 0 for x in range(W)] for y in range(H)]
for x in range(11, 14):
    for y in range(1, gl): gB[y][x] = 1
pin0B = []
for name, (grid, p0) in {"A_wide_pit": (g, pin0), "B_tall_wall": (gB, pin0B)}.items():
    print("==", name, "before: engine exit reachable =", exit_reachable(grid, (0, 7)))
    for tier, mode in (("NORMAL", "faithful"), ("GUARANTEED", "faithful"), ("NORMAL", "arcmin")):
        o = repair(grid, pin_empty=p0, tier=tier, timeout=120, mode=mode)
        sol = o["solutions"][-1] if o["solutions"] else None
        print(tier, mode, {k: v for k, v in o.items() if k != "solutions"}, "models", len(o["solutions"]), "cost", sol and sol["cost"], "optimal", sol and sol["optimal"])
        if sol:
            print(show(sol["grid"], grid)); demos[f"{name}_{tier}_{mode}"] = {"base": grid, "grid": sol["grid"], "cost": sol["cost"], "optimal": sol["optimal"], **{k: v for k, v in o.items() if k != "solutions"}}
json.dump(demos, open("repair_demos.json", "w"))
