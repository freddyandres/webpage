const { chromium } = require('playwright');
// node render-cover.js <salida-con-texto.png> <salida-fondo.png>
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:600,height:870}, deviceScaleFactor:2 });
  for (const [hash,out] of [['',process.argv[2]],['#bg',process.argv[3]]]) {
    await p.goto('file://' + __dirname + '/cover.html' + hash); await p.reload();
    await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
    await p.screenshot({ path: out });
  }
  await b.close();
})();
