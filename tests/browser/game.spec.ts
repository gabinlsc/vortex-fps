import {test,expect} from '@playwright/test';
test('textured lobby, two players, inventory reload and team lobby',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.locator('#join')).toBeEnabled();
  await expect(page.locator('#status')).toContainText('Prêt.');
  await page.screenshot({path:'test-results/lobby.png'});
  await page.locator('#nickname').fill('Test Alpha');await page.locator('#join').click();
  await expect(page.locator('body')).toHaveClass(/connected/);
  const second=await context.newPage();second.on('pageerror',error=>errors.push(error.message));
  await second.goto('/');await expect(second.locator('#join')).toBeEnabled();
  await second.locator('#nickname').fill('Test Bravo');await second.locator('#join').click();
  await expect(second.locator('body')).toHaveClass(/connected/);
  await expect(page.locator('#players-count')).toHaveText('2 JOUEURS');
  await page.bringToFront();
  // A foreground click resumes pointer lock after changing browser tabs.
  await page.evaluate(()=>document.exitPointerLock());
  await page.locator('#join').click();await expect(page.locator('body')).toHaveClass(/playing/);
  await page.keyboard.down('Tab');await expect(page.locator('#scoreboard')).toBeVisible();
  await expect(page.locator('#score-rows')).toContainText('Test Alpha');await expect(page.locator('#score-rows')).toContainText('Test Bravo');
  await page.screenshot({path:'test-results/scoreboard.png'});await page.keyboard.up('Tab');
  await expect(page.locator('#protection')).toBeHidden();
  await page.keyboard.press('Digit2');
  await expect(page.locator('#weapon-name')).toHaveText('PULSE');
  await page.mouse.down();await page.waitForTimeout(120);await page.mouse.up();
  await expect(page.locator('#ammo')).toHaveText('23');
  await page.keyboard.press('KeyR');await expect(page.locator('#reload-status')).toContainText('RECHARGEMENT');
  await expect(page.locator('#ammo')).toHaveText('24');
  await expect(page.locator('#health')).toHaveText('100');
  await page.screenshot({path:'test-results/arena.png'});
  for(const p of [page,second]){
    await p.bringToFront();await p.evaluate(()=>document.exitPointerLock());
    await p.locator('#leave').click();await p.locator('[data-mode="tdm"]').click();await p.locator('#join').click();
    await expect(p.locator('body')).toHaveClass(/connected/);
  }
  await page.bringToFront();await page.keyboard.down('Tab');
  await expect(page.locator('#score-rows')).toContainText('AZURE');await expect(page.locator('#score-rows')).toContainText('EMBER');
  await page.keyboard.up('Tab');expect(errors).toEqual([]);
});
