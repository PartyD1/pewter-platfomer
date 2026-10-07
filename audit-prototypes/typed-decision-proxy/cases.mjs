// Jev-shaped decision cases: engine-enumerated features + the user's request + expected typed answers.
// Fields not listed in `expect` are not scored. `expect.operation: ["none_of_the_above"]` marks requests
// the typed vocabulary cannot express (the system must ask or fall back).
const SEL = "Selection covers columns x=8..22 and rows y=4..19 (y grows DOWNWARD). The ground surface is the top of row 15; standing positions on the ground are at y=14. The player enters from the left.";
const PLAT_S01 = { F1: "Floating platform of 5 blocks at y=11, x=12..16 (drawn by the user)" };
const DIRT_S05 = { F1: "3 dirt blocks floating in the air at y=11, x=17..19 (drawn by the user)" };
const PLAT_S06 = { F1: "Floating platform of 5 blocks at y=10, x=11..15 (drawn by the user)" };
const PILLARS = { F1: "Pillar 3 blocks tall at x=10, y=12..14, standing on the ground (drawn by the user)", F2: "Pillar 3 blocks tall at x=18, y=12..14, standing on the ground (drawn by the user)" };
const SLIME = { F1: "Slime enemy standing on the ground at (15,14) (drawn by the user)" };
const PLAT_COINS = { F1: "Platform of 4 blocks at y=11, x=10..13 (drawn by the user)", F2: "4 coins at y=10, x=10..13 resting on that platform (drawn by the user)" };
const PIT = { F1: "Pit 3 tiles wide at x=14..16 going all the way down (drawn by the user)" };
const STAIRS = { F1: "Staircase of 4 steps going up to the right from x=9 to x=16 (built by the assistant last turn)" };
export const CASES = [
  // --- the 16 eval scenarios (20 turns) ---
  { id: "S01", features: PLAT_S01, request: "Put a coin on top of each block of the floating platform.",
    expect: { operation: ["add_collectables"], entity: ["coin"], target: ["F1"], placement: ["on_top_of_target"], count: ["one_per_block"] } },
  { id: "S02", features: {}, request: "Add one slime standing on the ground near the middle of this area.",
    expect: { operation: ["add_enemy"], entity: ["slime"], count: ["1"], placement: ["center_of_selection", "on_top_of_target"] } },
  { id: "S03", features: {}, request: "Add a floating platform 4 blocks wide that the player can jump up onto from the ground.",
    expect: { operation: ["add_platform"], size: ["4"], placement: ["floating_above_target", "center_of_selection", "anywhere_in_selection"] } },
  { id: "S04", features: {}, request: "Dig a pit exactly 3 tiles wide into the ground here, going all the way down, so the player has to jump over it.",
    expect: { operation: ["dig_pit"], size: ["3"] } },
  { id: "S05", features: DIRT_S05, request: "Remove the three dirt blocks floating in the air.",
    expect: { operation: ["remove_feature"], target: ["F1"] } },
  { id: "S06", features: PLAT_S06, request: "Put a fruit on the ground directly under the middle of the floating platform.",
    expect: { operation: ["add_collectables"], entity: ["fruit"], target: ["F1"], placement: ["on_ground_under_target"], count: ["1"] } },
  { id: "S07", features: PILLARS, request: "Place 3 coins in a row on the ground between the two pillars.",
    expect: { operation: ["add_collectables"], entity: ["coin"], count: ["3"], target: ["F1", "F2"], second_target: ["F1", "F2"], placement: ["between_targets"] } },
  { id: "S08", features: {}, request: "Build a staircase with 4 steps going up to the right, starting near the left side of this area.",
    expect: { operation: ["build_staircase"], size: ["4"], direction: ["right"] } },
  { id: "S09a", features: {}, request: "Add a row of 4 coins floating 3 tiles above the ground.",
    expect: { operation: ["add_collectables"], entity: ["coin"], count: ["4"], placement: ["floating_above_target"], offset: ["3"] } },
  { id: "S09b", features: { F1: "Row of 4 coins at y=11, x=13..16 (added by the assistant last turn)" }, request: "Now move those coins 3 tiles to the right.",
    expect: { operation: ["move_feature"], target: ["F1"], direction: ["right"], offset: ["3"] } },
  { id: "S10a", features: {}, request: "Add two slimes on the ground in this area.",
    expect: { operation: ["add_enemy"], entity: ["slime"], count: ["2"] } },
  { id: "S10b", features: { F1: "2 slimes on the ground at (12,14) and (18,14) (added by the assistant last turn)" }, request: "Remove the slimes you just added.",
    expect: { operation: ["remove_feature"], target: ["F1"] } },
  { id: "S11a", features: {}, request: "Add a coin floating above the ground in this area.",
    expect: { operation: ["add_collectables"], entity: ["coin"], count: ["1"], placement: ["floating_above_target", "center_of_selection", "anywhere_in_selection"] } },
  { id: "S11b", features: { F1: "1 coin floating at (19,12) (added by the assistant earlier)" }, request: "Add a fruit on the ground in this area.",
    expect: { operation: ["add_collectables"], entity: ["fruit"], count: ["1"] } },
  { id: "S11c", features: { F1: "1 coin floating at (19,12) (added by the assistant earlier)", F2: "1 fruit on the ground at (18,14) (added by the assistant last turn)" }, request: "Also add a slime on the ground in this area.",
    expect: { operation: ["add_enemy"], entity: ["slime"], count: ["1"] } },
  { id: "S12", features: {}, request: "Put a coin on the ground in this area.",
    expect: { operation: ["add_collectables"], entity: ["coin"], count: ["1"] } },
  { id: "S13", features: SLIME, request: "Put a coin floating two tiles above the slime.",
    expect: { operation: ["add_collectables"], entity: ["coin"], count: ["1"], target: ["F1"], placement: ["floating_above_target"], offset: ["2"] } },
  { id: "S14", features: {}, request: "Make this section more challenging, but keep it beatable.",
    expect: { operation: ["increase_difficulty"] } },
  { id: "S15", features: PLAT_COINS, request: "Add a second platform to the right of mine at the same height, without changing my platform or coins.",
    expect: { operation: ["add_platform"], target: ["F1"], placement: ["right_of_target"] } },
  { id: "S16", features: {}, request: "Make a gap exactly 4 tiles wide in the ground and put one coin floating above the middle of the gap.",
    expect: { operation: ["dig_pit"], secondary_operation: ["add_collectables"], size: ["4"], entity: ["coin"] } },
  // --- expressible variants ---
  { id: "V01", features: SLIME, request: "Add a coin 5 tiles to the left of the slime.",
    expect: { operation: ["add_collectables"], entity: ["coin"], target: ["F1"], placement: ["left_of_target"], offset: ["5"] } },
  { id: "V02", features: PILLARS, request: "Add a fruit on top of the left pillar.",
    expect: { operation: ["add_collectables"], entity: ["fruit"], target: ["F1"], placement: ["on_top_of_target"] } },
  { id: "V03", features: PLAT_S01, request: "Put a slime on the platform.",
    expect: { operation: ["add_enemy"], entity: ["slime"], target: ["F1"], placement: ["on_top_of_target"] } },
  { id: "V04", features: PLAT_S01, request: "Lower the platform by 2.",
    expect: { operation: ["move_feature"], target: ["F1"], direction: ["down"], offset: ["2"] } },
  { id: "V05", features: {}, request: "Make this area easier for my little brother.",
    expect: { operation: ["decrease_difficulty"] } },
  { id: "V06", features: PLAT_S01, request: "get rid of that platform lol",
    expect: { operation: ["remove_feature"], target: ["F1"] } },
  { id: "V07", features: {}, request: "can u add like 3 coins up in the air",
    expect: { operation: ["add_collectables"], entity: ["coin"], count: ["3"], placement: ["floating_above_target", "anywhere_in_selection", "center_of_selection"] } },
  { id: "V08", features: SLIME, request: "Swap the slime for an ultra slime.",
    expect: { operation: ["none_of_the_above", "remove_feature"], needs_clarification: [true, false] } },
  // --- requests the typed vocabulary cannot express (should abstain / ask) ---
  { id: "N01", features: {}, request: "Build a castle with towers on both sides.", expect: { operation: ["none_of_the_above"], needs_clarification: [true] } },
  { id: "N02", features: {}, request: "Put coins in the shape of a heart.", expect: { operation: ["none_of_the_above"], needs_clarification: [true] } },
  { id: "N03", features: PIT, request: "Make the jump across the pit shorter.", expect: { operation: ["none_of_the_above"], needs_clarification: [true] } },
  { id: "N04", features: STAIRS, request: "Undo that.", expect: { operation: ["none_of_the_above"] } },
  { id: "N05", features: PIT, request: "Why can't I get past this part?", expect: { operation: ["none_of_the_above"] } },
  { id: "N06", features: PILLARS, request: "Put a coin on every platform and a slime between the pillars.", expect: { operation: ["none_of_the_above", "add_collectables"], needs_clarification: [true] } },
  { id: "N07", features: STAIRS, request: "Make the staircase taller.", expect: { operation: ["none_of_the_above"], needs_clarification: [true] } },
  { id: "N08", features: PLAT_COINS, request: "Remove everything I drew.", expect: { operation: ["none_of_the_above", "remove_feature"], needs_clarification: [true] } },
  { id: "N09", features: {}, request: "This part is boring, add something fun.", expect: { needs_clarification: [true] } },
  { id: "N10", features: {}, request: "Add a secret room under the ground with a fruit in it.", expect: { operation: ["none_of_the_above"], needs_clarification: [true] } },
];
export { SEL };
