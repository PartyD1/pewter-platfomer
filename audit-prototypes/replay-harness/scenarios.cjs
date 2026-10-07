// Scenario suite. Default map: ground rows y=15..19 (grass at 15). Default box
// covers x=8..22, y=4..19 (full height so pits can go all the way down).
// Paint entries: [layer "G"|"C", x, y, tileIndex]. Painted before any box
// exists, i.e. as a designer's own edits.
const G = (x, y, i) => ["G", x, y, i];
const C = (x, y, i) => ["C", x, y, i];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const box = (api) => api.makeBox(8, 4, 22, 19);

module.exports = [
  { id: "S01_coins_on_platform", paint: range(12, 16).map((x) => G(x, 11, 6)),
    run: async (api) => { await box(api); await api.send("Put a coin on top of each block of the floating platform."); } },
  { id: "S02_slime_on_ground",
    run: async (api) => { await box(api); await api.send("Add one slime standing on the ground near the middle of this area."); } },
  { id: "S03_reachable_platform",
    run: async (api) => { await box(api); await api.send("Add a floating platform 4 blocks wide that the player can jump up onto from the ground."); } },
  { id: "S04_pit_3wide",
    run: async (api) => { await box(api); await api.send("Dig a pit exactly 3 tiles wide into the ground here, going all the way down, so the player has to jump over it."); } },
  { id: "S05_remove_user_blocks", paint: [G(17, 11, 5), G(18, 11, 5), G(19, 11, 5)],
    run: async (api) => { await box(api); await api.send("Remove the three dirt blocks floating in the air."); } },
  { id: "S06_fruit_under_platform", paint: range(11, 15).map((x) => G(x, 10, 6)),
    run: async (api) => { await box(api); await api.send("Put a fruit on the ground directly under the middle of the floating platform."); } },
  { id: "S07_coins_between_pillars", paint: [...range(12, 14).map((y) => G(10, y, 5)), ...range(12, 14).map((y) => G(18, y, 5))],
    run: async (api) => { await box(api); await api.send("Place 3 coins in a row on the ground between the two pillars."); } },
  { id: "S08_staircase",
    run: async (api) => { await box(api); await api.send("Build a staircase with 4 steps going up to the right, starting near the left side of this area."); } },
  { id: "S09_memory_move",
    run: async (api) => { await box(api); await api.send("Add a row of 4 coins floating 3 tiles above the ground."); await api.send("Now move those coins 3 tiles to the right."); } },
  { id: "S10_memory_remove",
    run: async (api) => { await box(api); await api.send("Add two slimes on the ground in this area."); await api.send("Remove the slimes you just added."); } },
  { id: "S11_moved_box",
    run: async (api) => {
      await api.makeBox(8, 4, 14, 19);
      await api.send("Add a coin floating above the ground in this area.");
      await api.dragBoxBy(8);
      await api.send("Add a fruit on the ground in this area.");
      await api.send("Also add a slime on the ground in this area.");
    } },
  { id: "S12_switched_box",
    run: async (api) => {
      await api.makeBox(8, 4, 13, 19);
      await api.deselect();
      await api.makeBox(16, 4, 22, 19);
      await api.clickTabOf(0);
      await api.send("Put a coin on the ground in this area.");
    } },
  { id: "S13_coin_above_slime", paint: [G(15, 14, 9)],
    run: async (api) => { await box(api); await api.send("Put a coin floating two tiles above the slime."); } },
  { id: "S14_harder_but_beatable",
    run: async (api) => { await box(api); await api.send("Make this section more challenging, but keep it beatable."); } },
  { id: "S15_keep_user_content", paint: [...range(10, 13).map((x) => G(x, 11, 6)), ...range(10, 13).map((x) => C(x, 10, 2))],
    run: async (api) => { await box(api); await api.send("Add a second platform to the right of mine at the same height, without changing my platform or coins."); } },
  { id: "S16_gap_with_coin",
    run: async (api) => { await box(api); await api.send("Make a gap exactly 4 tiles wide in the ground and put one coin floating above the middle of the gap."); } },
];
