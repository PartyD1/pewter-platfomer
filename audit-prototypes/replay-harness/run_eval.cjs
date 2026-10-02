// Real-model evaluation harness for Pewter builds.
// Drives the actual app UI in Chromium; model calls go to the real Gemini API
// (key comes from the dev server's environment, never read here).
// Usage: node run_eval.cjs <cond> <port> <reps> [scenarioIdsCommaSep]
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const SCEN = require(process.env.SCEN || "./scenarios.cjs");

const [, , COND, PORT, REPS = "1", ONLY] = process.argv;
const URL = `http://localhost:${PORT}/Pewter-The-Platformer/`;
const OUT = path.join(__dirname, "results");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  let modelCalls = 0;
  const modelLog = [];
  // Forward the app's Gemini calls from Node (Chromium does not trust the
  // sandbox proxy's CA). Headers are passed through, never logged.
  await ctx.route(/generativelanguage\.googleapis\.com/, async (route) => {
    const req = route.request();
    const hd = req.headers();
    modelCalls++;
    const t0 = Date.now();
    try {
      const r = await fetch(req.url(), {
        method: req.method(),
        headers: { "content-type": "application/json", "x-goog-api-key": hd["x-goog-api-key"], "x-goog-api-client": hd["x-goog-api-client"] || "" },
        body: req.postData(),
      });
      const body = await r.text();
      modelLog.push({ status: r.status, ms: Date.now() - t0, usage: (() => { try { return JSON.parse(body).usageMetadata; } catch { return null; } })() });
      await route.fulfill({ status: r.status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body });
    } catch (e) {
      modelLog.push({ status: -1, ms: Date.now() - t0, error: String(e).slice(0, 200) });
      await route.abort();
    }
  });
  await page.goto(URL);
  await page.waitForFunction(() => !!document.getElementById("chat-input"), null, { timeout: 30000 });
  await wait(1500);
  const ok = await page.evaluate(async () => {
    const m = await import("/Pewter-The-Platformer/src/phaser/editorScene.ts");
    const sb = await import("/Pewter-The-Platformer/src/phaser/selectionBox.ts");
    window.__ed = m.editorScene;
    window.__sb = sb;
    window.__tools = [];
    window.addEventListener("toolCalled", (e) => {
      const d = e.detail || {};
      window.__tools.push({ name: d.name, args: d.args, result: String(d.result).slice(0, 1500) });
    });
    return !!(window.__ed && window.__ed.map && window.__ed.map.width === 200);
  });
  if (!ok) throw new Error("could not obtain editor scene");
  const canvas = await page.locator("canvas").boundingBox();
  return { ctx, page, errors, canvas, calls: () => modelCalls, modelLog };
}

// Screen (page) coordinates of a tile centre, using the live camera.
async function tileToPage(h, tx, ty) {
  const p = await h.page.evaluate(([tx, ty]) => {
    const cam = window.__ed.cameras.main;
    const o = cam.getWorldPoint(0, 0);
    return { x: (tx * 16 + 8 - o.x) * cam.zoom, y: (ty * 16 + 8 - o.y) * cam.zoom };
  }, [tx, ty]);
  return { x: h.canvas.x + p.x * (h.canvas.width / 1280), y: h.canvas.y + p.y * (h.canvas.height / 720) };
}

// Create a selection box through the editor's own selection code path.
async function makeBox(h, x0, y0, x1, y1) {
  await h.page.evaluate(async ([x0, y0, x1, y1]) => {
    const ed = window.__ed;
    const cam = ed.cameras.main;
    const o = cam.getWorldPoint(0, 0);
    const sp = (tx, ty) => ({ x: (tx * 16 + 8 - o.x) * cam.zoom, y: (ty * 16 + 8 - o.y) * cam.zoom });
    ed.startSelection(sp(x0, y0));
    ed.updateSelection(sp(x1, y1));
    await ed.endSelection();
  }, [x0, y0, x1, y1]);
  await wait(200);
}

async function paint(h, cells) {
  await h.page.evaluate((cells) => {
    const ed = window.__ed;
    for (const [layer, x, y, idx] of cells) {
      ed.placeTile(layer === "C" ? ed.collectablesLayer : ed.groundLayer, x, y, idx);
    }
    ed.saveSnapshot();
  }, cells);
}

async function grid(h) {
  return h.page.evaluate(() => {
    const ed = window.__ed;
    const G = [], C = [];
    for (let y = 0; y < 20; y++) {
      const g = [], c = [];
      for (let x = 0; x < 40; x++) {
        const t = ed.groundLayer.getTileAt(x, y);
        const u = ed.collectablesLayer.getTileAt(x, y);
        g.push(t ? t.index : -1);
        c.push(u ? u.index : -1);
      }
      G.push(g); C.push(c);
    }
    const active = window.getActiveSelectionBox?.();
    const bounds = active ? (() => { const b = active.getBounds(); return [b.x, b.y, b.x + b.width - 1, b.y + b.height - 1]; })() : null;
    return { G, C, active: bounds };
  });
}

async function sendAndWait(h, prompt, timeoutMs = 240000) {
  const before = await h.page.evaluate(() => window.getCurrentChatHistory().length);
  const toolsBefore = await h.page.evaluate(() => window.__tools.length);
  const callsBefore = h.calls();
  await h.page.click("#chat-input");
  await h.page.fill("#chat-input", prompt);
  const t0 = Date.now();
  await h.page.press("#chat-input", "Enter");
  let done = false;
  while (Date.now() - t0 < timeoutMs) {
    await wait(500);
    const st = await h.page.evaluate((before) => {
      const hist = window.getCurrentChatHistory();
      const last = hist[hist.length - 1];
      return { n: hist.length, lastType: last && last._getType && last._getType(), typing: !!document.getElementById("pt-typing-indicator") };
    }, before);
    if (st.n >= before + 2 && st.lastType === "ai" && !st.typing) { done = true; break; }
  }
  const ms = Date.now() - t0;
  await wait(400);
  const reply = await h.page.evaluate(() => {
    const hist = window.getCurrentChatHistory();
    const last = hist[hist.length - 1];
    return String(last?.content ?? "");
  });
  const tools = await h.page.evaluate((k) => window.__tools.slice(k), toolsBefore);
  return { prompt, reply: reply.split("\n[ACTIONS THIS TURN")[0], replyRaw: reply, ms, done, tools, modelCalls: h.calls() - callsBefore };
}

async function dragBoxBy(h, dxTiles) {
  const tab = await h.page.evaluate(() => {
    const b = window.getActiveSelectionBox();
    return { x: b.tabContainer.x + 20, y: b.tabContainer.y };
  });
  const cam = await h.page.evaluate(() => {
    const c = window.__ed.cameras.main; const o = c.getWorldPoint(0, 0); return { ox: o.x, oy: o.y, z: c.zoom };
  });
  const sx = h.canvas.x + (tab.x - cam.ox) * cam.z, sy = h.canvas.y + (tab.y - cam.oy) * cam.z;
  await h.page.mouse.move(sx, sy);
  await h.page.mouse.down();
  await h.page.mouse.move(sx + dxTiles * 16 * cam.z, sy, { steps: 16 });
  await wait(150);
  await h.page.mouse.up();
  await wait(400);
}

async function clickTabOf(h, boxIndex) {
  const tab = await h.page.evaluate((i) => {
    const b = window.__sb.allSelectionBoxes[i];
    return { x: b.tabContainer.x + 20, y: b.tabContainer.y };
  }, boxIndex);
  const cam = await h.page.evaluate(() => {
    const c = window.__ed.cameras.main; const o = c.getWorldPoint(0, 0); return { ox: o.x, oy: o.y, z: c.zoom };
  });
  await h.page.mouse.click(h.canvas.x + (tab.x - cam.ox) * cam.z, h.canvas.y + (tab.y - cam.oy) * cam.z);
  await wait(300);
}

async function runScenario(browser, sc, rep) {
  const h = await boot(browser);
  const rec = { cond: COND, id: sc.id, rep, turns: [], grids: [], errors: h.errors, setupNote: "" };
  try {
    if (sc.paint) await paint(h, sc.paint);
    const api = {
      makeBox: (...a) => makeBox(h, ...a),
      dragBoxBy: (d) => dragBoxBy(h, d),
      clickTabOf: (i) => clickTabOf(h, i),
      deselect: () => h.page.click("#tbtn-deselect"),
      send: async (p) => { const t = await sendAndWait(h, p); rec.turns.push(t); rec.grids.push(await grid(h)); return t; },
      grid: () => grid(h),
      snapshotGrid: async () => rec.grids.push(await grid(h)),
      paint: (cells) => paint(h, cells),
    };
    rec.initial = await grid(h);
    await sc.run(api);
  } catch (e) {
    rec.harnessError = String(e && e.stack || e);
  }
  rec.modelLog = h.modelLog;
  await h.ctx.close();
  return rec;
}

(async () => {
  const browser = await chromium.launch();
  const list = SCEN.filter((s) => !ONLY || ONLY.split(",").includes(s.id));
  const file = path.join(OUT, `${COND}.jsonl`);
  for (let rep = 1; rep <= Number(REPS); rep++) {
    for (const sc of list) {
      const t0 = Date.now();
      const rec = await runScenario(browser, sc, rep);
      fs.appendFileSync(file, JSON.stringify(rec) + "\n");
      console.log(`[${COND}] rep${rep} ${sc.id} ${Math.round((Date.now() - t0) / 1000)}s turns=${rec.turns.length} ${rec.harnessError ? "HARNESS-ERR " + rec.harnessError.slice(0, 120) : ""}`);
    }
  }
  await browser.close();
})();
