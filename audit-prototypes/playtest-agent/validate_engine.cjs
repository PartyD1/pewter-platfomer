// Replays agent input sequences in the REAL game (fork build) by stepping Arcade manually,
// and compares the trajectory with the TS re-implementation.
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
const PORT = process.argv[2] || "5175";
const cases = JSON.parse(fs.readFileSync(__dirname + "/validation_cases.json", "utf8"));
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/Pewter-The-Platformer/`);
    await page.waitForFunction(() => !!document.getElementById("chat-input"), null, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(async (map) => {
      window.__ed = (await import("/Pewter-The-Platformer/src/phaser/editorScene.ts")).editorScene;
      window.__sb = await import("/Pewter-The-Platformer/src/phaser/selectionBox.ts");
      window.__pp = await import("/Pewter-The-Platformer/src/phaser/playerPhysics.ts");
      const sb = window.__sb;
      sb.baseStartingLayer.length = 0;
      sb.superDuperRealUserLayer.length = 0;
      for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++)
        if (map[y][x]) sb.baseStartingLayer.push({ tileIndex: 5, x, y, layerName: "Ground_Layer" });
      sb.replaceAllBoxes();
    }, c.map);
    await page.click("#tbtn-play");
    await new Promise((r) => setTimeout(r, 1000));
    const res = await page.evaluate(({ start, inputs }) => {
      const ed = window.__ed, pp = window.__pp, w = ed.physics.world;
      ed.game.loop.sleep();
      const p = ed.player, b = p.body;
      const bx = start.x * 16 + 3, by = (start.y + 1) * 16 - 14;
      b.reset(bx + 5, by + 7); p.setVelocity(0, 0);
      const info = { colliders: w.colliders.getActive().length, paused: w.isPaused, fixedStep: w.fixedStep, fps: w.fps, gravity: w.gravity.y,
        tileBias: w.TILE_BIAS, bodyStart: [b.x, b.y] };
      const ms = pp.createMovementState(); let prev = false; let down = true; const traj = [];
      for (const inp of inputs) {
        const jjp = inp.jump && !prev; prev = inp.jump;
        const r = pp.stepMovement(ms, { moveInput: inp.move, jumpHeld: inp.jump, jumpJustPressed: jjp }, b.velocity.x, b.velocity.y, down, 1 / 60);
        p.setVelocity(r.velocityX, r.velocityY);
        w._elapsed = w._frameTimeMS * w.timeScale;
        w.update(0, 0); w.postUpdate();
        down = b.blocked.down;
        traj.push([b.x, b.y, b.velocity.x, b.velocity.y, down ? 1 : 0]);
      }
      return { info, traj };
    }, { start: c.start, inputs: c.inputs });
    let maxDx = 0, maxDy = 0, firstDiv = -1;
    for (let i = 0; i < c.traj.length; i++) {
      const a = c.traj[i], e = res.traj[i];
      const dx = Math.abs(a[0] - e[0]), dy = Math.abs(a[1] - e[1]);
      maxDx = Math.max(maxDx, dx); maxDy = Math.max(maxDy, dy);
      if (firstDiv < 0 && (dx > 1e-6 || dy > 1e-6 || a[4] !== e[4])) firstDiv = i;
    }
    const lastSim = c.traj[c.traj.length - 1], lastEng = res.traj[res.traj.length - 1];
    out.push({ name: c.name, frames: c.traj.length, info: res.info, maxDx, maxDy, firstDivergenceFrame: firstDiv,
      simEnd: lastSim.map((v) => +(+v).toFixed(3)), engineEnd: lastEng.map((v) => +(+v).toFixed(3)), errors: errors.slice(0, 3) });
    if (firstDiv >= 0) out[out.length - 1].around = { sim: c.traj.slice(Math.max(0, firstDiv - 2), firstDiv + 3), eng: res.traj.slice(Math.max(0, firstDiv - 2), firstDiv + 3) };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
