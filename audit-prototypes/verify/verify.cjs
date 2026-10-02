// Verifies earlier unconfirmed findings in a running build.
// node verify.cjs <port> <label> [unlimitedFps]
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs"); const path = require("path");
const [, , PORT, LABEL, UNLIM] = process.argv;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = `http://localhost:${PORT}/Pewter-The-Platformer/`;

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|Failed to load resource/.test(m.text())) errors.push("console: " + m.text().slice(0, 300)); });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.getElementById("chat-input"), null, { timeout: 30000 });
  await wait(1200);
  await page.evaluate(async () => {
    window.__ed = (await import("/Pewter-The-Platformer/src/phaser/editorScene.ts")).editorScene;
    window.__Slime = (await import("/Pewter-The-Platformer/src/phaser/ExternalClasses/Slime.ts")).Slime;
    window.__sb = await import("/Pewter-The-Platformer/src/phaser/selectionBox.ts");
  });
  return { ctx, page, errors };
}

(async () => {
  const args = UNLIM ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : [];
  const browser = await chromium.launch({ args });
  const out = { label: LABEL, unlimitedFps: !!UNLIM };

  // (c) frame-rate dependence: time-to-speed and slime fire rate
  {
    const h = await open(browser);
    await h.page.evaluate(() => { const ed = window.__ed; ed.placeTile(ed.groundLayer, 20, 14, 9); ed.saveSnapshot(); });
    await h.page.evaluate(() => {
      window.__shots = 0;
      const orig = window.__Slime.prototype.shootPellet;
      window.__Slime.prototype.shootPellet = function (...a) { window.__shots++; return orig.apply(this, a); };
    });
    await h.page.click("#tbtn-play");
    await wait(1500);
    const fps = await h.page.evaluate(() => window.__ed.game.loop.actualFps);
    // keep the player safe: park it far left on the ground and hold right briefly
    await h.page.evaluate(() => { const p = window.__ed.player; p.setPosition(40, 200); p.setVelocity(0, 0); });
    await wait(600);
    await h.page.evaluate(() => { window.__shots = 0; });
    const t0 = Date.now();
    await h.page.keyboard.down("ArrowRight");
    const samples = [];
    for (let i = 0; i < 8; i++) { await wait(100); samples.push(await h.page.evaluate(() => Math.round(window.__ed.player.body.velocity.x))); }
    await h.page.keyboard.up("ArrowRight");
    await wait(2200);
    const shots = await h.page.evaluate(() => window.__shots);
    out.frameRate = { actualFps: Math.round(fps), vxEvery100ms: samples, slimeShotsIn3s: shots, elapsed: Date.now() - t0 };
    await h.ctx.close();
  }

  // (a) stomp: drop the player onto a slime from several heights
  if (!UNLIM) {
    const h = await open(browser);
    await h.page.evaluate(() => { const ed = window.__ed; ed.placeTile(ed.groundLayer, 15, 14, 9); ed.saveSnapshot(); });
    await h.page.click("#tbtn-play");
    await wait(1200);
    const drops = [];
    for (const dy of [24, 40, 64, 96, 140]) {
      const r = await h.page.evaluate(async (dy) => {
        const ed = window.__ed;
        const s = ed.enemies.find((e) => e.active && e.constructor.name === "Slime") || ed.enemies[0];
        if (!s) return { error: "no slime" };
        if (s.respawn && !s.active) s.respawn(s.getData("spawnX"), s.getData("spawnY"));
        const hpBefore = s.health;
        ed.player.setPosition(s.x, s.y - dy);
        ed.player.setVelocity(0, 0);
        ed.playerHealth = 5;
        await new Promise((r) => setTimeout(r, 900));
        return { dropPx: dy, hpBefore, hpAfter: s.health, alive: s.active, playerVy: Math.round(ed.player.body.velocity.y) };
      }, dy);
      drops.push(r);
      await wait(300);
    }
    out.stomp = drops;
    await h.ctx.close();
  }

  // (b) loading a save with an unknown enemy kind
  if (!UNLIM) {
    const h = await open(browser);
    await h.page.evaluate(async () => {
      const ed = window.__ed; const cam = ed.cameras.main; const o = cam.getWorldPoint(0, 0);
      const sp = (tx, ty) => ({ x: (tx * 16 + 8 - o.x) * cam.zoom, y: (ty * 16 + 8 - o.y) * cam.zoom });
      ed.startSelection(sp(8, 4)); ed.updateSelection(sp(14, 10)); await ed.endSelection();
    });
    const before = await h.page.evaluate(() => ({ ground: window.__ed.groundLayer.layer.data.flat().filter((t) => t.index > 1).length, boxes: window.__sb.allSelectionBoxes.length }));
    const save = { version: 1, groundTiles: [{ x: 3, y: 3, index: 6 }], collectablesTiles: [], enemies: [{ kind: "Dynamic", spawnX: 100, spawnY: 100, definition: {} }], selectionBoxes: [], userTiles: [], baseTiles: [] };
    const file = path.join(__dirname, "malformed-save.json");
    fs.writeFileSync(file, JSON.stringify(save));
    const [fc] = await Promise.all([h.page.waitForEvent("filechooser"), h.page.click("#tbtn-load")]);
    await fc.setFiles(file);
    await wait(1200);
    const after = await h.page.evaluate(() => ({ ground: window.__ed.groundLayer.layer.data.flat().filter((t) => t.index > 1).length, boxes: window.__sb.allSelectionBoxes.length }));
    out.malformedLoad = { before, after, errors: h.errors.slice(0, 4) };
    await h.ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
