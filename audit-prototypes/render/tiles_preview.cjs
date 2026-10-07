const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 140 } });
  const src = "data:image/png;base64," + fs.readFileSync("/home/user/pewter-platfomer/public/phaserAssets/pewterPlatformerTilesetExtended.png").toString("base64");
  await p.setContent(`<canvas id=c width=1000 height=140 style="background:#888"></canvas><script>
    const img = new Image(); img.onload = () => { const c = document.getElementById('c').getContext('2d'); c.imageSmoothingEnabled = false;
      const n = img.width / 16; c.font = '14px sans-serif';
      for (let i = 0; i < n; i++) { c.drawImage(img, i*16, 0, 16, 16, 10 + i*64, 10, 48, 48); c.fillStyle='#000'; c.fillText(String(i), 28 + i*64, 80); }
      document.title = 'done:' + img.width + 'x' + img.height; }; img.src = '${src}';</script>`);
  await p.waitForFunction(() => document.title.startsWith("done"));
  console.log(await p.title());
  await p.screenshot({ path: __dirname + "/tiles_preview.png" }); await b.close();
})();
