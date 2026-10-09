import {test,expect} from '@playwright/test';
test('both maps, night and offline sessions work without opening a socket',async({page})=>{
  const errors:string[]=[],sockets:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('websocket',s=>sockets.push(s.url()));
  await page.goto('/?quality=low');await expect(page.locator('#join')).toBeEnabled();
  await page.locator('#map-select').selectOption('harbor');await expect(page.locator('#status')).toContainText('Harbor prête');
  await page.locator('#settings summary').click();await page.locator('#theme-select').selectOption('night');await page.locator('#fauna-toggle').uncheck();await page.locator('#adaptive-toggle').check();
  await page.locator('#training-tools summary').click();await page.locator('#offline-visit').click();await expect(page.locator('body')).toHaveClass(/playing/);await expect(page.locator('#training-status')).toContainText('Visite libre');
  await page.keyboard.down('KeyW');await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(2);await page.keyboard.up('KeyW');
  await page.evaluate(()=>document.exitPointerLock());await page.locator('#photo-toggle').click();await expect(page.locator('body')).toHaveClass(/photo-mode/);
  const photoPromise=page.waitForEvent('download');await page.keyboard.press('KeyP');const photo=await photoPromise;expect(photo.suggestedFilename()).toBe('vortex-photo.png');await photo.saveAs('test-results/expedition-photo.png');
  await page.evaluate(()=>document.exitPointerLock());await page.locator('#leave').click();await page.locator('#map-select').selectOption('canyon');await expect(page.locator('#status')).toContainText('Canyon prête');
  await page.screenshot({path:'test-results/expedition-night.png'});expect(errors).toEqual([]);expect(sockets).toEqual([]);
});
test('range records hits and replays can be exported and opened; bots and course can restart',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?quality=low');await expect(page.locator('#join')).toBeEnabled();
  await page.locator('#training-tools summary').click();await page.locator('#offline-range').click();await expect(page.locator('body')).toHaveClass(/playing/);
  await page.mouse.down();await expect(page.locator('#training-status')).toContainText('1 touches',{timeout:15000});await page.mouse.up();
  await page.evaluate(()=>document.exitPointerLock());const replayPromise=page.waitForEvent('download');await page.locator('#replay-export').click();const download=await replayPromise;await download.saveAs('test-results/expedition-replay.json');
  await page.locator('#leave').click();await page.locator('#replay-import').setInputFiles('test-results/expedition-replay.json');await expect(page.locator('#training-status')).toContainText('RELECTURE');
  await page.keyboard.press('Escape');await page.locator('#offline-bots').click();await expect(page.locator('#training-status')).toContainText('difficulté 2');await page.evaluate(()=>document.exitPointerLock());await page.locator('#leave').click();
  await page.locator('#offline-course').click();await expect(page.locator('#training-status')).toContainText('Porte 2/5');await page.screenshot({path:'test-results/expedition-course.png'});expect(errors).toEqual([]);
});
test('Harbor multiplayer exposes Domination and CTF independently',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?quality=low');await expect(page.locator('#join')).toBeEnabled();await page.locator('#map-select').selectOption('harbor');await expect(page.locator('#join')).toBeEnabled();
  for(const [id,label]of [['domination','DOMINATION'],['ctf','CAPTURE DU DRAPEAU']]){await page.locator('[data-mode="'+id+'"]').click();await page.locator('#join').click();await expect(page.locator('body')).toHaveClass(/connected/);await expect(page.locator('#mode-label')).toHaveText(label);await page.evaluate(()=>document.exitPointerLock());await page.locator('#leave').click();}
  expect(errors).toEqual([]);
});
