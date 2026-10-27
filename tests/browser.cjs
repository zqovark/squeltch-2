const { chromium } = require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(__dirname,'../build/browser-qa');
fs.mkdirSync(output,{recursive:true});
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});

 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const Original=window.AudioContext;
  window.AudioContext=class extends Original {
   constructor(...args){super(...args);window.__audio=this;}
   createAnalyser(){const a=super.createAnalyser();window.__analyser=a;return a;}
  };
 });
 await page.goto(process.env.SQUELCH_URL || 'http://127.0.0.1:8765/',{waitUntil:'networkidle'});
 await page.locator('.step').first().waitFor();
 assert.equal(await page.locator('.step').count(),16);
 assert.equal(await page.locator('#soundKnobs input').count(),8);
 assert.equal(await page.locator('#genKnobs select').count(),4);
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='true');
 await page.waitForFunction(()=>document.querySelector('.step.playing'));
 await page.waitForFunction(()=>{const a=new Uint8Array(window.__analyser.fftSize);window.__analyser.getByteTimeDomainData(a);return a.some(v=>Math.abs(v-128)>3);});
 console.log('Audio signal and animated playhead OK');
 for (const n of [8,24,32,16]) {
  await page.selectOption('#control-steps',String(n));
  await page.waitForFunction(n=>document.querySelectorAll('.step').length===n,n);
  assert.equal(await page.getAttribute('#play','aria-pressed'),'true');
 }
 for (const scale of ['minor','phrygian','minorPenta','dorian','harmonicMinor','major']) {
  const response=page.waitForResponse(r=>r.url().includes('/api/generate')&&r.ok());
  await page.selectOption('#control-scale',scale); await response;
 }
 for(let root=33;root<=44;root++){
  const response=page.waitForResponse(r=>r.url().includes('/api/generate')&&r.ok());
  await page.selectOption('#control-root',String(root));await response;
 }
 for(const oct of ['1','2','3']){
  const response=page.waitForResponse(r=>r.url().includes('/api/generate')&&r.ok());
  await page.selectOption('#control-octaves',oct);await response;
 }
 for(const key of ['cutoff','reso','env','decay','accent','drive','delay','volume','density','accents','slides']){
  await page.locator('#control-'+key).evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 await page.getByRole('button',{name:'SQR',exact:true}).click();
 await page.getByRole('button',{name:'SAW',exact:true}).click();
 await page.locator('#bpm').evaluate(el=>{el.value='150';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.textContent('#bpmVal'),'150 BPM');
 await page.waitForFunction(()=>document.querySelector('#generate').getAttribute('aria-busy')==='false');
 for(const [id,target] of [['exportAbleton','ableton'],['exportFL','fl-studio']]){
  const downloadEvent=page.waitForEvent('download');
  await page.click('#'+id);
  const download=await downloadEvent;
  assert.ok(download.suggestedFilename().endsWith('_150bpm_'+target+'.mid'));
  await download.saveAs(path.join(output,target+'.mid'));
  const bytes=fs.readFileSync(path.join(output,target+'.mid'));
  assert.equal(bytes.subarray(0,4).toString(),'MThd');
 }
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='false');
 await page.waitForFunction(()=>!document.querySelector('.step.playing'));
 // Stop must cancel future gain automation; allow the feedback echo to decay.
 await page.waitForFunction(()=>{const a=new Uint8Array(window.__analyser.fftSize);window.__analyser.getByteTimeDomainData(a);return a.every(v=>Math.abs(v-128)<2);},{},{timeout:10000});
 const response=page.waitForResponse(r=>r.url().includes('/api/generate')&&r.ok());
 await page.keyboard.press('g');await response;
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='true');
 await page.click('#play');
 console.log('Controls, live regeneration, Space/G, stop and both MIDI downloads OK');
 // Reordered responses must not overwrite a newer selection.
 await page.route('**/api/generate?**',async route=>{
  const response=await route.fetch();
  if(new URL(route.request().url()).searchParams.get('steps')==='8')await new Promise(r=>setTimeout(r,300));
  await route.fulfill({response}).catch(()=>{});
 });
 await page.selectOption('#control-steps','8');
 await page.selectOption('#control-steps','32');
 await page.waitForFunction(()=>document.querySelectorAll('.step').length===32);
 await page.waitForTimeout(400);
 assert.equal(await page.locator('.step').count(),32);
 await page.unroute('**/api/generate?**');
 // Network errors retain the visible playable pattern.
 await page.route('**/api/generate?**',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.click('#generate');
 await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Falha ao gerar'));
 assert.equal(await page.locator('.step').count(),32);
 await page.unroute('**/api/generate?**');
 await page.reload({waitUntil:'networkidle'});
 await page.locator('.step').first().waitFor();
 await page.selectOption('#control-steps','32');
 await page.waitForFunction(()=>document.querySelectorAll('.step').length===32);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.ok(await page.locator('#steps').evaluate(el=>el.scrollWidth>el.clientWidth));
 assert.deepEqual(errors,[]);
 console.log('Response ordering, recovery, mobile layout and zero runtime errors OK');
 // Restore default visual state for final preview.
 await page.setViewportSize({width:1280,height:900});
 await page.reload({waitUntil:'networkidle'});
 await page.locator('.step').first().waitFor();
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 console.log('Browser suite PASS');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
