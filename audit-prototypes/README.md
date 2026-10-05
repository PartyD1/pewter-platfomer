# Audit prototypes

Research tooling built during the September–October 2026 Pewter audit. Nothing here is
wired into the app; it is a starting point for the Pewter Ghost work (playtest
agent, chunk generator, browser test harness) and the record behind the audit's numbers.

Paths inside these scripts still point at the machine they were written on
(`/home/user/partyd1/pewter-the-platformer` for the Player Physics Fork,
`/opt/node22/.../playwright`, `/tmp/claude-0/...`). Replace them with local paths before
running. Every script that calls Gemini reads the key from `VITE_LLM_API_KEY` in the
environment; no key is stored here.

| Folder | What it is |
|---|---|
| `playtest-agent/` | `physsim.ts`: a search agent that plays a level with the game's own physics (the Player Physics Fork's `stepMovement` plus a line-by-line port of Phaser 3.90 Arcade tile collision). Finds a replayable input sequence to the exit or proves none exists. `validate_engine.cjs` replays its paths in the real game and compares trajectories (matched to 6e-14 px). `agent_corpus.ts`, `ceiling_test.ts`, `fn_analysis.ts`: the experiments that compared it with a rule-based reachability checker. |
| `generators/` | `chunkgen.py`: seeded pattern-based section generator (~2 ms per candidate). `reachpy.py`: Python replica of the rule-based checker. `z3gen.py` and `aspgen.py`: Z3 and clingo models of the same rules, including `repair()` (fewest-tiles fix). `bench.py`: timings. `caps.json` / `export_caps.ts`: jump tables exported from the fork's solver. |
| `replay-harness/` | `run_eval.cjs` drives the real editor UI in headless Chromium with live Gemini calls; `scenarios*.cjs` are the 16 scripted tasks plus the falsification set; `checks.ts` scores results automatically; `results/` holds the runs behind the audit's tables (replies and grids only). |
| `typed-decision-proxy/` | The Jev-shaped experiment: Gemini answering independent Choice / yes-no questions over engine-listed features (`cases.mjs`, `run.mjs`, `all.jsonl`). |
| `grid-context-prototype/` | `gridContext.ts` and three patches: the ASCII-grid context plus hidden action log that was tested as "fork + grid context" in the replay. Patches are against the Player Physics Fork at b36ff59. |
| `verify/` | Checks of earlier unconfirmed findings (stomp, malformed save load, frame-rate dependence). |
| `render/` | Renders level grids with the game tileset for the audit's figures. |

Related documents:

- Audit: https://claude.ai/artifact/6n12nNv2S6rNdoBFvMYjwu
- Roadmap: https://claude.ai/artifact/SxqUKcwzJX5xN71XqE1A5D
- Pewter Ghost plan: https://claude.ai/artifact/WPaaXeNv1g72QBexLBHeVh
- Building Pewter Ghost: https://claude.ai/artifact/SsD7GPscrCvo1UQ941kDkL
