"""Same section model as z3gen.py, written in ASP for clingo.
Reachability is a recursive rule (least fixpoint), so no ranking variables are
needed. Modes: faithful | arcmin (every intermediate column must have at least
one free cell in the arc band)."""
import json, time, sys, argparse
import clingo

CAPS = json.load(open(__file__.rsplit("/", 1)[0] + "/caps.json"))

PROGRAM = r"""
col(0..w-1). row(0..h-1). dir(1;-1).
{ solid(X,Y) } :- col(X), row(Y).
stand(X,Y) :- col(X), row(Y), Y+1 < h, not solid(X,Y), solid(X,Y+1).
:- not stand(0,ey). :- not stand(1,ey).

run(X,Y,D,0) :- stand(X,Y), dir(D).
run(X,Y,D,K+1) :- run(X,Y,D,K), K < maxrun, stand(X-D*(K+1),Y).

reach(0,ey).
% walk / 1-step up
reach(X+D,Y) :- reach(X,Y), dir(D), stand(X+D,Y).
reach(X+D,Y-1) :- reach(X,Y), dir(D), stand(X+D,Y-1), not solid(X,Y-1).
% fall straight down the neighbouring column
reach(X+D,FY) :- reach(X,Y), dir(D), col(X+D), row(FY), FY > Y, stand(X+D,FY), not blockedfall(X+D,Y,FY).
blockedfall(C,Y,FY) :- col(C), row(Y), row(FY), FY > Y, solid(C,K), row(K), K >= Y, K <= FY.
% jumps: gap allowed by runway ladder, rising penalty 2/tile, takeoff headroom
headok(X,Y,R) :- stand(X,Y), R = 1..stepup, not headblocked(X,Y,R).
headblocked(X,Y,R) :- stand(X,Y), R = 1..stepup, solid(X,Y-I), I = 1..R+1, Y-I >= 0.
jumpok(X,Y,D,DX,R) :- run(X,Y,D,K), gapok(K,R,G), DX = 2..G+1.
reach(X+D*DX,Y-R) :- reach(X,Y), jumpok(X,Y,D,DX,R), stand(X+D*DX,Y-R), R <= 0, arcok(X,Y,D,DX,R).
reach(X+D*DX,Y-R) :- reach(X,Y), jumpok(X,Y,D,DX,R), stand(X+D*DX,Y-R), R > 0, headok(X,Y,R), arcok(X,Y,D,DX,R).
% pure vertical rises
reach(X+O,Y-R) :- reach(X,Y), R = 2..stepup, O = -1..1, stand(X+O,Y-R), headok(X,Y,R).

exitreach :- reach(w-1,Y).
:- not exitreach.

% ground columns / pits
pit(X) :- col(X), not solid(X,Y) : row(Y), Y >= gl.
:- pit(0). :- pit(1). :- pit(w-1).
pitstart(X) :- pit(X), not pit(X-1), X > 0.
:- #count{ X : pitstart(X) } != npits.
:- pitstart(X), W = 1..pitmin-1, pit(X+I) : I = 0..W-1; not pit(X+W).
:- pitstart(X), pit(X+I) : I = 0..pitmax.
"""

STYLE = r"""
:- solid(X,Y), not solid(X-1,Y), not solid(X+1,Y).
:- solid(X,Y), Y >= gl, Y+1 < h, not solid(X,Y+1).
:- solid(X,0). :- solid(X,1).
:- #count{ X,Y : solid(X,Y), Y < gl } > dens.
"""

ARC_FAITHFUL = "arcok(X,Y,D,DX,R) :- jumpok(X,Y,D,DX,R).\n"
ARC_MIN = r"""
band(X,Y,D,DX,R,C,T,B) :- jumpok(X,Y,D,DX,R), I = 1..DX-1, C = X+D*I, col(C),
                          T = #max{ 0 ; (Y - R) - stepup ; Y - stepup }, B = #max{ Y ; Y - R }.
colfree(C,T,B) :- band(_,_,_,_,_,C,T,B), row(K), K >= T, K <= B, not solid(C,K).
arcok(X,Y,D,DX,R) :- jumpok(X,Y,D,DX,R), colfree(C,T,B) : band(X,Y,D,DX,R,C,T,B).
"""

def gap_facts(tier="NORMAL"):
    ladder = CAPS[tier]["ladder"]
    rungs = [r["runwayTiles"] for r in ladder]
    out = []
    step = int(CAPS[tier]["maxStepUp"])
    for k in range(0, rungs[-1] + 1):
        g = 0
        for r in ladder:
            if k >= r["runwayTiles"]:
                g = r["gapTiles"]
        for R in range(-11, step + 1):
            allowed = g if R <= 0 else max(0, g - 2 * R)
            if allowed >= 1:
                out.append(f"gapok({k},{R},{allowed}).")
    return "\n".join(out)

def solve(W=24, H=12, mode="faithful", style=False, pits=2, pit_min=2, pit_max=6, seed=0, models=1, timeout=120, tier="NORMAL"):
    gl = H - 4
    consts = {"w": W, "h": H, "gl": gl, "ey": gl - 1, "maxrun": CAPS[tier]["ladder"][-1]["runwayTiles"],
              "stepup": int(CAPS[tier]["maxStepUp"]), "npits": pits, "pitmin": pit_min, "pitmax": pit_max,
              "dens": int(0.12 * W * gl)}
    prog = "".join(f"#const {k}={v}.\n" for k, v in consts.items()) + PROGRAM + gap_facts(tier) + "\n"
    prog += ARC_MIN if mode == "arcmin" else ARC_FAITHFUL
    if style:
        prog += STYLE
    ctl = clingo.Control([f"--seed={seed}", "--rand-freq=0.3", f"-n{models}", "--project"])
    t0 = time.time()
    ctl.add("base", [], prog)
    ctl.ground([("base", [])])
    t1 = time.time()
    grids = []
    def on_model(m):
        if len(grids) >= models: return False
        s = {(a.arguments[0].number, a.arguments[1].number) for a in m.symbols(atoms=True) if a.name == "solid"}
        grids.append([[1 if (x, y) in s else 0 for x in range(W)] for y in range(H)])
        return len(grids) < models
    with ctl.solve(on_model=on_model, async_=True) as hnd:
        if not hnd.wait(timeout): hnd.cancel()
        res = hnd.get()
    t2 = time.time()
    return {"W": W, "H": H, "mode": mode, "style": style, "ground_s": round(t1 - t0, 3), "solve_s": round(t2 - t1, 3),
            "result": "sat" if grids else ("unsat" if res.unsatisfiable else "unknown"), "grids": grids}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--W", type=int, default=24); ap.add_argument("--H", type=int, default=12)
    ap.add_argument("--mode", default="faithful"); ap.add_argument("--style", action="store_true")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    o = solve(a.W, a.H, a.mode, a.style, seed=a.seed)
    print(json.dumps({k: v for k, v in o.items() if k != "grids"}))
    if o["grids"]:
        for row in o["grids"][0]:
            print("".join("#" if v else "." for v in row))

REPAIR_STYLE = r"""
:- solid(X,Y), not pin1(X,Y), not solid(X-1,Y), not solid(X+1,Y).
:- solid(X,0), not pin1(X,0). :- solid(X,1), not pin1(X,1).
"""

def repair(grid, pin_empty=(), tier="NORMAL", entry=(0, None), timeout=120, minimize=True, seed=0, models=1, mode="faithful"):
    """Add-only repair: keep every existing solid tile, never fill `pin_empty`, add the fewest
    new solid tiles so the exit column becomes reachable under the engine's rules."""
    H, W = len(grid), len(grid[0]); gl = H - 4
    ey = entry[1] if entry[1] is not None else gl - 1
    consts = {"w": W, "h": H, "gl": gl, "ey": ey, "maxrun": CAPS[tier]["ladder"][-1]["runwayTiles"],
              "stepup": int(CAPS[tier]["maxStepUp"]), "npits": 0, "pitmin": 1, "pitmax": W, "dens": W * H}
    base = PROGRAM
    for line in (":- #count{ X : pitstart(X) } != npits.", ":- pitstart(X), W = 1..pitmin-1, pit(X+I) : I = 0..W-1; not pit(X+W).",
                 ":- pitstart(X), pit(X+I) : I = 0..pitmax.", ":- pit(0). :- pit(1). :- pit(w-1)."):
        base = base.replace(line, "")
    facts = [f"pin1({x},{y})." for y in range(H) for x in range(W) if grid[y][x]] + [f"pin0({x},{y})." for (x, y) in pin_empty]
    prog = "".join(f"#const {k}={v}.\n" for k, v in consts.items()) + base + gap_facts(tier) + "\n" + (ARC_MIN if mode == "arcmin" else ARC_FAITHFUL) + REPAIR_STYLE + "pin0(-1,-1).\n"
    prog += "\n".join(facts) + "\n:- pin1(X,Y), not solid(X,Y).\n:- pin0(X,Y), solid(X,Y).\n"
    if minimize:
        prog += "#minimize { 1,X,Y : solid(X,Y), not pin1(X,Y) }.\n"
    prog += "#show solid/2.\n"
    ctl = clingo.Control([f"--seed={seed}", "--rand-freq=0.2", f"-n{models}" if not minimize else "-n0", "--opt-mode=opt" if minimize else ""][:4 if minimize else 3])
    t0 = time.time(); ctl.add("base", [], prog); ctl.ground([("base", [])]); t1 = time.time()
    best = []
    def on_model(m):
        s = {(a.arguments[0].number, a.arguments[1].number) for a in m.symbols(shown=True) if a.name == "solid"}
        g = [[1 if (x, y) in s else 0 for x in range(W)] for y in range(H)]
        best.append({"grid": g, "cost": list(m.cost), "optimal": m.optimality_proven})
    with ctl.solve(on_model=on_model, async_=True) as hnd:
        if not hnd.wait(timeout): hnd.cancel()
        res = hnd.get()
    t2 = time.time()
    return {"ground_s": round(t1 - t0, 3), "solve_s": round(t2 - t1, 3), "result": "sat" if best else ("unsat" if res.unsatisfiable else "unknown"),
            "solutions": best}
