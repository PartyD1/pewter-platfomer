// Renders level grids with the game's own tileset (+ agent trajectory / engine claim overlays).
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs"); const path = require("path");
const figs = JSON.parse(fs.readFileSync(__dirname + "/figs.json", "utf8"));
const outDir = process.argv[2] || __dirname + "/out"; fs.mkdirSync(outDir, { recursive: true });
const tiles = "data:image/png;base64," + fs.readFileSync("/home/user/pewter-platfomer/public/phaserAssets/pewterPlatformerTilesetExtended.png").toString("base64");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 800, height: 420 }, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;background:#000"><canvas id=c></canvas></body>`);
  await p.evaluate((src) => new Promise((res) => { const i = new Image(); i.onload = () => { window.__img = i; res(); }; i.src = src; }), tiles);
  for (const f of figs) {
    await p.evaluate((f) => {
      const S = 2, T = 16, g = f.grid, H = g.length, W = g[0].length;
      const c = document.getElementById("c"); c.width = W * T * S; c.height = H * T * S;
      const x = c.getContext("2d"); x.imageSmoothingEnabled = false; const img = window.__img;
      const tile = (fr, tx, ty) => x.drawImage(img, fr * 16, 0, 16, 16, tx * T * S, ty * T * S, T * S, T * S);
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) tile(ty < H * 0.55 ? 11 : 13, tx, ty);
      const solid = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && g[ty][tx];
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (g[ty][tx]) tile(solid(tx, ty - 1) ? 4 : 5, tx, ty);
      if (f.base) for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (g[ty][tx] && !f.base[ty][tx]) {
        x.fillStyle = "rgba(60,230,120,0.45)"; x.fillRect(tx * T * S, ty * T * S, T * S, T * S);
        x.strokeStyle = "#39e67a"; x.lineWidth = 3; x.strokeRect(tx * T * S + 1.5, ty * T * S + 1.5, T * S - 3, T * S - 3); }
      for (const [cx, cy] of f.coins || []) tile(1, cx, cy);
      for (const [sx, sy] of f.slimes || []) tile(8, sx, sy);
      tile(14, 0, 7);
      if (f.path) { x.lineJoin = "round"; x.lineCap = "round";
        for (const [w, col] of [[6, "rgba(0,0,0,0.55)"], [2.5, "#fff"]]) { x.strokeStyle = col; x.lineWidth = w; x.setLineDash(w > 3 ? [] : [7, 5]); x.beginPath();
          f.path.forEach(([px, py], i) => (i ? x.lineTo(px * S, py * S) : x.moveTo(px * S, py * S))); x.stroke(); }
        x.setLineDash([]); const [ex, ey] = f.path[f.path.length - 1]; x.fillStyle = "#ffd23f"; x.beginPath(); x.arc(ex * S, ey * S, 6, 0, 7); x.fill(); }
      if (f.claim) { const [[ax, ay], [bx, by]] = f.claim; const X0 = (ax + 0.5) * T * S, Y0 = (ay + 0.5) * T * S, X1 = (bx + 0.5) * T * S, Y1 = (by + 0.5) * T * S;
        x.strokeStyle = "#ff3b3b"; x.lineWidth = 4; x.setLineDash([10, 6]); x.beginPath(); x.moveTo(X0, Y0);
        x.quadraticCurveTo((X0 + X1) / 2, Math.min(Y0, Y1) - 3 * T * S, X1, Y1); x.stroke(); x.setLineDash([]);
        x.fillStyle = "#ff3b3b"; x.beginPath(); x.moveTo(X1, Y1); x.lineTo(X1 - 12, Y1 - 14); x.lineTo(X1 + 4, Y1 - 16); x.fill(); }
    }, f);
    const el = await p.$("#c"); await el.screenshot({ path: path.join(outDir, f.name + ".png") });
    console.log("wrote", f.name);
  }
  await b.close();
})();
