const { chromium } = require("/opt/node22/lib/node_modules/playwright");
(async () => {
  const port = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const logs = [];
  p.on("console", (m) => { const t = m.text(); if (/error|Error|LLM|Tool|fail/i.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 700)}`); });
  p.on("response", async (r) => { if (r.url().includes("generativelanguage")) { let body = ""; try { body = await r.text(); } catch {} logs.push(`[HTTP ${r.status()}] ${body.slice(0, 900)}`); } });
  await p.goto(`http://localhost:${port}/Pewter-The-Platformer/`);
  await p.waitForTimeout(3000);
  await p.evaluate(async () => { const m = await import("/Pewter-The-Platformer/src/phaser/editorScene.ts"); window.__ed = m.editorScene; const ed = window.__ed; const cam = ed.cameras.main; const o = cam.getWorldPoint(0,0); const sp = (tx,ty)=>({x:(tx*16+8-o.x)*cam.zoom,y:(ty*16+8-o.y)*cam.zoom}); ed.startSelection(sp(8,4)); ed.updateSelection(sp(22,19)); await ed.endSelection(); });
  await p.click("#chat-input"); await p.fill("#chat-input", "Add one slime standing on the ground near the middle of this area."); await p.press("#chat-input", "Enter");
  await p.waitForTimeout(20000);
  console.log(logs.join("\n"));
  await b.close();
})();
