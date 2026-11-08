const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const outDir = process.argv[2];
  const jobs = [['historia',1080,1920],['publicacion',1080,1080],['resena',1080,1080],['og',1200,630],
    ['fundamentos',1080,1080],['crecimiento',1080,1080],['madurez',1080,1080],['perseverancia',1080,1080]];
  const b = await chromium.launch();
  for (const [k,w,h] of jobs) {
    const p = await b.newPage({ viewport:{width:w,height:h} });
    await p.goto(`file://${__dirname}/tarjetas.html#${k}`);
    await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(outDir, k + '.jpg'), type:'jpeg', quality:88 });
    await p.close();
  }
  await b.close(); console.log('ok');
})();
