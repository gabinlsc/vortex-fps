import {test,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import {MAP_VERSION} from '../../shared/map.ts';
test('textured lobby, multiplayer roster, inventory reload and team lobby',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let peer:WebSocket|undefined;
  async function otherPlayer(mode:string){
    const socket=new WebSocket('ws://127.0.0.1:8080/play',{origin:'http://127.0.0.1:4173'});socket.on('error',()=>{});
    await new Promise<void>((resolve,reject)=>{socket.once('open',()=>resolve());socket.once('error',reject);});
    socket.send(JSON.stringify({version:2,map:MAP_VERSION,name:'Test Bravo',mode,character:1,ticket:''}));
    return socket;
  }
  try{
    await page.goto('/?quality=low');await expect(page.locator('#join')).toBeEnabled();
    await expect(page.locator('#status')).toContainText('Prêt.');
    const lobby=await page.screenshot({path:'test-results/lobby.jpg',type:'jpeg',quality:55});console.log('VORTEX_LOBBY_IMAGE:'+lobby.toString('base64'));
    await page.locator('#nickname').fill('Test Alpha');peer=await otherPlayer('ffa');await page.locator('#join').click();
    await expect(page.locator('body')).toHaveClass(/connected/);await expect(page.locator('body')).toHaveClass(/playing/);
    await expect(page.locator('#players-count')).toHaveText('2 JOUEURS');
    console.log('CONTROL_FOCUS',await page.evaluate(()=>({active:document.activeElement?.tagName,locked:document.pointerLockElement?.id})));await page.keyboard.down('Tab');await expect(page.locator('#scoreboard')).toBeVisible();
    await expect(page.locator('#score-rows')).toContainText('Test Alpha');await expect(page.locator('#score-rows')).toContainText('Test Bravo');
    await page.screenshot({path:'test-results/scoreboard.png'});await page.keyboard.up('Tab');
    await expect(page.locator('#protection')).toBeHidden();
    await page.keyboard.press('Digit2');await expect(page.locator('#weapon-name')).toHaveText('PULSE');
    await page.mouse.down();await expect.poll(async()=>Number(await page.locator('#ammo').textContent())).toBeLessThan(24);await page.mouse.up();
    await page.keyboard.press('KeyR');await expect(page.locator('#reload-status')).toContainText('RECHARGEMENT');
    await expect(page.locator('#ammo')).toHaveText('24');await expect(page.locator('#health')).toHaveText('100');
    const arena=await page.screenshot({path:'test-results/arena.jpg',type:'jpeg',quality:55});console.log('VORTEX_ARENA_IMAGE:'+arena.toString('base64'));
    await page.evaluate(()=>document.exitPointerLock());await page.locator('#leave').click();peer.terminate();
    peer=await otherPlayer('tdm');await page.locator('[data-mode="tdm"]').click();await page.locator('#join').click();
    await expect(page.locator('body')).toHaveClass(/connected/);await expect(page.locator('#players-count')).toHaveText('2 JOUEURS');
    await page.keyboard.down('Tab');
    await expect(page.locator('#score-rows')).toContainText('AZURE');await expect(page.locator('#score-rows')).toContainText('EMBER');
    await page.keyboard.up('Tab');expect(errors).toEqual([]);
  }finally{peer?.terminate();}
});
