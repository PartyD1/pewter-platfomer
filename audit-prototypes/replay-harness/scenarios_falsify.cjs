const G = (x, y, i) => ["G", x, y, i];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const box = (api) => api.makeBox(8, 4, 22, 19);
module.exports = [
  // Vague / creative requests (the kind the scripted suite never tested)
  { id: "V01_interesting", run: async (api) => { await box(api); await api.send("Make this section more interesting."); } },
  { id: "V02_challenge", run: async (api) => { await box(api); await api.send("Add some challenge here."); } },
  { id: "V03_cool", run: async (api) => { await box(api); await api.send("Build something cool in this area."); } },
  { id: "V04_beginner", run: async (api) => { await box(api); await api.send("Make a fun little section for a beginner."); } },
  { id: "V05_surprise", run: async (api) => { await box(api); await api.send("Surprise me."); } },
  { id: "V06_reward", run: async (api) => { await box(api); await api.send("Design a section with a reward the player has to work for."); } },
  // Partial-overlap stale bounds: does the stale rectangle ever misplace silently?
  { id: "O01_overlap_move", run: async (api) => { await api.makeBox(8, 4, 14, 19); await api.send("Add a coin floating above the ground somewhere in this area."); await api.dragBoxBy(3); await api.send("Add another coin floating above the ground somewhere in this area."); await api.send("Put a fruit on the ground in the exact horizontal middle of this area."); } },
  { id: "O02_overlap_tab", run: async (api) => { await api.makeBox(8, 4, 14, 19); await api.deselect(); await api.makeBox(11, 4, 17, 19); await api.clickTabOf(0); await api.send("Put a fruit on the ground in the exact horizontal middle of this area."); } },
  // AI-11 scope: blocks painted AFTER the box exists (stored in the box, not the designer layer)
  { id: "A01_remove_after_box", run: async (api) => { await box(api); await api.paint([G(17, 11, 5), G(18, 11, 5), G(19, 11, 5)]); await api.snapshotGrid(); await api.send("Remove the three dirt blocks floating in the air."); } },
  // Scale: tasks that are tedious by hand
  { id: "M01_zigzag", run: async (api) => { await box(api); await api.send("Fill this area with a zigzag of 5 floating platforms, each 3 blocks wide, climbing from the bottom-left to the top-right, with a coin above the middle of each platform."); } },
  { id: "M02_wave", run: async (api) => { await box(api); await api.send("Put a coin above every ground tile in this area, alternating between 2 and 3 tiles above the ground so they form a wave."); } },
];
