import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const campaignPath = path.join(rootDir, 'src', 'data', 'prince-campaign.json');
const stages = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));

function resolveMapFilePath(mapLevel) {
  const relDir = mapLevel < 90
    ? path.join('public', 'static', 'prince', 'assets', 'maps')
    : path.join('public', 'static', 'prince', 'assets', 'maps', 'custom');
  return path.join(rootDir, relDir, `level${mapLevel}.json`);
}

test.describe('Prince of Persia Campaign Maps Validation', () => {
  test('1. Every campaign stage has a valid map JSON with prince spawn and non-empty rooms', () => {
    expect(Array.isArray(stages)).toBe(true);
    expect(stages.length).toBeGreaterThan(0);

    for (const stage of stages) {
      const mapPath = resolveMapFilePath(stage.mapLevel);
      expect(
        fs.existsSync(mapPath),
        `Missing map file for stage ${stage.stage} (mapLevel ${stage.mapLevel}): ${mapPath}`
      ).toBe(true);

      const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

      // Validate prince spawn object
      expect(mapData.prince, `Stage ${stage.stage} missing prince object`).toBeTruthy();
      expect(typeof mapData.prince.room).toBe('number');
      expect(Number.isFinite(mapData.prince.room)).toBe(true);
      expect(mapData.prince.room).toBeGreaterThan(0);

      expect(typeof mapData.prince.location).toBe('number');
      expect(Number.isFinite(mapData.prince.location)).toBe(true);
      expect(mapData.prince.location).toBeGreaterThanOrEqual(0);

      expect(typeof mapData.prince.direction).toBe('number');
      expect([1, -1]).toContain(mapData.prince.direction);

      // Validate rooms array and non-empty tile data
      expect(Array.isArray(mapData.room), `Stage ${stage.stage} room must be an array`).toBe(true);
      expect(mapData.room.length).toBeGreaterThan(0);

      const populatedRooms = mapData.room.filter(
        (r) => r && typeof r === 'object' && Array.isArray(r.tile) && r.tile.length > 0
      );
      expect(populatedRooms.length, `Stage ${stage.stage} has no rooms with tiles`).toBeGreaterThan(0);

      const startRoom = mapData.room.find((r) => r && r.id === mapData.prince.room);
      expect(
        startRoom,
        `Stage ${stage.stage} start room ${mapData.prince.room} not found in map.room`
      ).toBeTruthy();
      expect(Array.isArray(startRoom.tile) && startRoom.tile.length > 0).toBe(true);
    }
  });

  test('2. Every campaign stage boots in Phaser without console/page errors and loads its map', async ({ page }) => {
    test.setTimeout(120000);

    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    for (const stage of stages) {
      const consoleBefore = consoleErrors.length;
      const pageErrBefore = pageErrors.length;
      const mapLevel = stage.mapLevel;

      const url = `/static/prince/index.html?level=${mapLevel}&minLevel=${mapLevel}&maxLevel=${mapLevel}&skipTitle=true&skipCutscenes=true`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait for Phaser canvas to mount and initialize with non-zero dimensions
      const canvas = page.locator('#gameContainer canvas');
      await expect(canvas, `Stage ${stage.stage} canvas did not appear`).toBeVisible({ timeout: 10000 });
      await page.waitForFunction(() => {
        const el = document.querySelector('#gameContainer canvas');
        return Boolean(el && el.width > 0 && el.height > 0);
      }, { timeout: 10000 });

      // Verify PrinceJS applied query bounds and flags
      await page.waitForFunction(
        (expectedLvl) =>
          typeof PrinceJS !== 'undefined' &&
          PrinceJS.currentLevel === expectedLvl &&
          PrinceJS.minLevel === expectedLvl &&
          PrinceJS.maxLevel === expectedLvl &&
          PrinceJS.SKIP_TITLE === true &&
          PrinceJS.SKIP_CUTSCENES === true,
        mapLevel,
        { timeout: 10000 }
      );

      // Start the game from Preloader and confirm the level JSON actually fetches and builds in Phaser
      const mapResponsePromise = page.waitForResponse(
        (res) => res.url().includes(`level${mapLevel}.json`) && res.status() === 200,
        { timeout: 15000 }
      );

      let mapLoaded = false;
      mapResponsePromise.then(() => { mapLoaded = true; }).catch(() => {});

      for (let attempt = 0; attempt < 20 && !mapLoaded; attempt++) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }

      const mapRes = await mapResponsePromise;
      expect(mapRes.ok(), `Failed to fetch level${mapLevel}.json for stage ${stage.stage}`).toBe(true);

      // Brief settle window to catch any runtime exceptions during Game.create / LevelBuilder
      await page.waitForTimeout(150);

      expect(
        consoleErrors.slice(consoleBefore),
        `Console errors on stage ${stage.stage} (mapLevel ${mapLevel})`
      ).toEqual([]);
      expect(
        pageErrors.slice(pageErrBefore),
        `Page errors on stage ${stage.stage} (mapLevel ${mapLevel})`
      ).toEqual([]);
    }
  });
});
