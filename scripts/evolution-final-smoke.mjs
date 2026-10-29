import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const base='http://localhost:3002',root='docs/evolution/final';fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try {
 for(const theme of ['original','aqua','spectrum','sage']) {
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});await context.addCookies([{name:'nexus-theme',value:theme,url:base}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base);await page.locator('.cinematic-hero canvas').waitFor();await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance','static');
  await page.getByRole('button',{name:'Open theme configurator'}).click();await page.keyboard.press('Tab');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Open theme configurator'})).toBeFocused();
  await page.locator('.intelligence-trigger').click();await expect(page.locator('.hero-signal-list>button')).toHaveCount(8);await page.locator('.hero-signal-list>button').first().click();await expect(page.locator('.cinematic-detail')).toBeVisible();await page.keyboard.press('Escape');
  await page.goto(`${base}/command/sky`);await page.locator('.drone-scene canvas').waitFor();await page.getByRole('button',{name:'Exploded view',exact:true}).click();await page.locator('.part-list>button').last().click();await page.locator('.engineering-explorer').screenshot({path:`${root}/sky-${theme}-reduced.png`});
  await page.goto(`${base}/command`);await page.locator('.map-record-marker').first().waitFor();await page.locator('.map-record-marker').first().focus();await page.keyboard.press('Enter');await expect(page.locator('.cinematic-detail')).toBeVisible();await page.keyboard.press('Escape');
  await page.goto(`${base}/command/response`);await expect(page.getByRole('combobox',{name:'Incident map overlay'})).toBeVisible();await page.getByLabel('Caller statement / live transcript').fill('Medical help needed near clinic');await page.getByRole('button',{name:'Submit demo report'}).click();await expect(page.locator('.response-detail')).toContainText('MEDICAL');
  await page.getByRole('button',{name:'Delete selected demo report'}).click();await page.getByRole('button',{name:'Confirm delete'}).click();await expect(page.locator('.response-detail')).toHaveCount(0);
  expect(errors).toEqual([]);results.push({theme,reducedCityMapDroneAndResponse:true,errors});await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'});const page=await context.newPage();await page.goto(base);await page.locator('.cinematic-hero canvas').waitFor();await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance','complete');
 const performanceSample=await page.evaluate(async()=>{
  const deltas=[];let last=performance.now(),start=last;
  return new Promise(resolve=>{const tick=now=>{deltas.push(now-last);last=now;if(now-start<2000)requestAnimationFrame(tick);else{const sorted=[...deltas].sort((a,b)=>a-b);resolve({frames:deltas.length,elapsedMs:now-start,meanFrameMs:(now-start)/deltas.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)],longTasksSupported:PerformanceObserver.supportedEntryTypes.includes('longtask')})}};requestAnimationFrame(tick)});
 });
 results.push({normalHeroFrameSample:performanceSample,qualification:'Local headless browser sample, not a device performance guarantee.'});await context.close();
}finally{fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2));await browser.close()}
console.log('Fresh production smoke: reduced city/map/drone/RESPONSE, keyboard/focus, deletion and normal hero frame sample passed.');
