// node render-video.js W H fps salida.mp4 audio.mp3
const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const [W,H,FPS,out,audio] = [+process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:W,height:H} });
  await p.goto(`file://${__dirname}/trailer.html?w=${W}&h=${H}`);
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  const dur = await p.evaluate(()=>window.TRAILER_DURATION);
  const n = Math.round(dur*FPS);
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-',
    '-i', audio, '-filter_complex', `[1:a]apad,atrim=0:${dur},afade=t=in:d=0.3,afade=t=out:st=${dur-1.2}:d=1.2[a];[0:v]fade=t=in:d=0.8,fade=t=out:st=${dur-0.8}:d=0.8,format=yuv420p[v]`,
    '-map','[v]','-map','[a]','-c:v','libx264','-preset','slow','-crf','22','-profile:v','high','-movflags','+faststart',
    '-c:a','aac','-b:a','128k','-shortest', out], { stdio:['pipe','inherit','inherit'] });
  for (let i=0;i<n;i++){
    await p.evaluate(t=>render(t), i/FPS);
    const buf = await p.screenshot({ type:'jpeg', quality:92 });
    if (!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
  }
  ff.stdin.end();
  await new Promise(r=>ff.on('close',r));
  await b.close();
  console.log('ok', out, n, 'frames');
})();
