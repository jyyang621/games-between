import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { checkGoldMinerSources } from '../../微信小程序/vendor/gold-miner/generate.mjs';

const require = createRequire(import.meta.url);
const { createGoldMinerGame } = require('../../微信小程序/src/games/gold-miner/index.js');
const { MineEngine, PHYSICS } = require('../../微信小程序/src/games/gold-miner/core/engine.js');
const { LEVELS, getLevel, ORE_TYPES, oreValue } = require('../../微信小程序/src/games/gold-miner/core/levels.js');
const { storageKey, sanitize } = require('../../微信小程序/src/games/gold-miner/core/storage.js');
const { emptyMatch } = require('../../微信小程序/src/games/gold-miner/core/modes.js');

function fixture({ initial = [], storageErrors = false } = {}) {
  const storage = new Map(initial);
  const writes = [];
  const game = createGoldMinerGame({
    read(key) { if (storageErrors) throw new Error('no storage'); return structuredClone(storage.get(key)); },
    write(key, value) { if (storageErrors) throw new Error('no storage'); storage.set(key, structuredClone(value)); writes.push(key); return true; },
    now: () => 1792288800000,
  });
  return { game, storage, writes };
}
function context() {
  const gradient = { addColorStop() {} };
  return new Proxy({ measureText: value => ({ width: Array.from(String(value)).reduce((sum, c) => sum + (/[^\x00-\x7F]/.test(c) ? 13 : 7), 0) }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, {
    get(object, key) { return key in object ? object[key] : () => {}; },
  });
}
function begin(game, mode = 'solo', endless = false) {
  if (mode !== game.model.mode) assert.equal(game.activate('miner:mode', mode), true);
  if (endless !== game.model.endless) assert.equal(game.activate('miner:challenge', endless), true);
  assert.equal(game.activate('miner:new'), true);
  if (game.model.scene === 'confirm') assert.equal(game.activate('miner:confirm-new'), true);
  assert.equal(game.model.scene, 'ready');
  assert.equal(game.activate('miner:play'), true);
}
function win(game, income = 1500) {
  game.model.engine.income = Math.max(income, game.model.engine.level.target);
  game.model.engine.players[0].income = game.model.engine.income;
  assert.equal(game.activate('miner:finish'), true);
  assert.equal(game.model.scene, 'result');
}
function expire(game) { game.model.engine.update(game.model.engine.timeLeft); game.tick(16); }
function ore(id, x, y, kind = 'goldLarge', motion) { return { id, x, y, kind, radius: ORE_TYPES[kind].radius, ...(motion ? { motion } : {}) }; }
function mine(ores, target = 500) { return { id: 1, name: '测试矿场', subtitle: '', target, duration: 60, ores, palette: 'ochre' }; }

test('gold-miner preserves 40 authored levels, the new mine shortcut and seeded endless maps', () => {
  assert.equal(LEVELS.length, 40);
  assert.ok(LEVELS.slice(20).some(level => level.ores.some(ore => ore.motion)));
  assert.deepEqual(getLevel(52, true, 1234), getLevel(52, true, 1234));
  assert.notDeepEqual(getLevel(52, true, 1234).ores, getLevel(52, true, 5678).ores);
  const { game } = fixture();
  assert.equal(game.activate('miner:new-area'), true);
  assert.equal(game.model.engine.level.id, 21);
  assert.equal(game.model.scene, 'ready');
});

test('six mode/challenge combinations persist independently and reopen the last selected one', () => {
  const { game, storage } = fixture();
  for (const endless of [false, true]) for (const mode of ['solo', 'coop', 'versus']) {
    begin(game, mode, endless);
    assert.equal(game.model.engine.playerCount, mode === 'solo' ? 1 : 2);
    assert.equal(game.model.endless, endless);
    assert.equal(game.activate('miner:menu'), true);
    const saved = storage.get(storageKey(mode, endless));
    assert.equal(saved.checkpoint.levelIndex, 0);
    assert.equal(saved.checkpoint.seed !== undefined, endless);
    assert.deepEqual(saved.checkpoint.match, mode === 'versus' ? emptyMatch() : undefined);
  }
  const resumed = fixture({ initial: [...storage] }).game;
  assert.equal(resumed.model.mode, 'versus');
  assert.equal(resumed.model.endless, true);
  assert.equal(resumed.activate('miner:continue'), true);
  assert.equal(resumed.model.scene, 'ready');
});

test('pause, inactive scenes and help freeze physics, hooks, entities and remaining time', () => {
  const { game } = fixture();
  begin(game);
  game.activate('miner:launch', 0);
  game.tick(60);
  game.pause();
  const snapshot = JSON.stringify(game.model.engine);
  game.tick(2000);
  assert.equal(JSON.stringify(game.model.engine), snapshot);
  game.activate('miner:help');
  game.tick(100);
  assert.equal(JSON.stringify(game.model.engine), snapshot);
  game.activate('miner:help-back');
  assert.equal(game.model.scene, 'paused');
  game.activate('miner:resume');
  game.tick(16);
  assert.ok(game.model.engine.timeLeft < JSON.parse(snapshot).timeLeft);
  game.activate('miner:menu');
  const time = game.model.engine.timeLeft;
  game.tick(100);
  assert.equal(game.model.engine.timeLeft, time);
});

test('leaving to the menu and recreating the game resumes the level checkpoint without partial income', () => {
  const { game, storage } = fixture();
  begin(game);
  game.model.engine.income = 123;
  game.tick(100);
  game.pause();
  assert.equal(game.model.engine.income, 123, 'in-memory pause retains the live round');
  const resumed = fixture({ initial: [...storage] }).game;
  resumed.activate('miner:continue');
  assert.equal(resumed.model.engine.income, 0);
  assert.equal(resumed.model.engine.timeLeft, 60);
  game.activate('miner:menu');
  game.activate('miner:continue');
  assert.equal(game.model.engine.income, 0);
});

test('a successful round settles once, opens the shop, enforces purchases and carries buffs into the next level', () => {
  const { game, storage } = fixture();
  begin(game);
  win(game, 1600);
  const shopAfterSettlement = structuredClone(game.model.save.shop);
  game.tick(100);
  assert.deepEqual(game.model.save.shop, shopAfterSettlement, 'settlement cannot be credited twice');
  assert.equal(game.activate('miner:shop'), true);
  assert.equal(game.model.save.shop.wallet, 1600);
  assert.equal(game.activate('miner:buy', 'bomb'), true);
  assert.equal(game.activate('miner:buy', 'bomb'), true);
  assert.equal(game.activate('miner:buy', 'bomb'), false);
  assert.equal(game.activate('miner:buy', 'strength'), true);
  assert.equal(game.activate('miner:buy', 'strength'), false);
  assert.equal(game.activate('miner:buy', 'diamond'), false, 'second authored level has no diamonds');
  assert.equal(game.model.save.shop.wallet, 1150);
  assert.equal(game.model.save.shop.totalEarned, 1600);
  const reopened = fixture({ initial: [...storage] }).game;
  reopened.activate('miner:continue');
  assert.equal(reopened.model.scene, 'shop');
  assert.equal(reopened.model.save.shop.purchaseCounts.bomb, 2);
  assert.equal(reopened.activate('miner:next'), true);
  assert.equal(reopened.model.engine.level.id, 2);
  assert.equal(reopened.model.engine.bombs, 2);
  assert.equal(reopened.model.engine.strength, true);
  assert.equal(reopened.model.save.shop, null);
  reopened.activate('miner:play');
  win(reopened, 1200);
  assert.equal(reopened.model.save.shop.strength, false, 'one-level buff expires');
  reopened.activate('miner:shop');
  assert.equal(reopened.activate('miner:buy', 'diamond'), true, 'third level has diamonds');
  reopened.activate('miner:next');
  assert.equal(reopened.model.engine.diamondBonus, true);
});

test('campaign failure retries the exact checkpoint while endless failure ends that run', () => {
  const campaign = fixture().game;
  begin(campaign);
  const positions = campaign.model.engine.ores.map(ore => [ore.x, ore.y]);
  expire(campaign);
  assert.equal(campaign.model.scene, 'result');
  assert.equal(campaign.model.engine.won, false);
  assert.equal(campaign.activate('miner:retry'), true);
  assert.deepEqual(campaign.model.engine.ores.map(ore => [ore.x, ore.y]), positions);
  assert.equal(campaign.model.engine.timeLeft, 60);
  const endless = fixture().game;
  begin(endless, 'solo', true);
  endless.model.engine.income = 123;
  expire(endless);
  assert.equal(endless.model.save.checkpoint, null);
  assert.equal(endless.model.save.shop, null);
  assert.equal(endless.model.save.bestEarned, 123);
  assert.equal(endless.activate('miner:retry'), false);
  assert.equal(endless.activate('miner:force-new'), true);
  assert.equal(endless.model.scene, 'ready');
});

test('the fortieth campaign mine completes the adventure and retains records while clearing the run', () => {
  const checkpoint = { levelIndex: 39, wallet: 500, bombs: 2, strength: false, diamondBonus: false, totalEarned: 500 };
  const { game, storage } = fixture({ initial: [[storageKey(), { version: 1, sound: false, bestEarned: 500, highestCleared: 39, checkpoint, shop: null }]] });
  game.activate('miner:continue'); game.activate('miner:play');
  const earned = game.model.engine.level.target;
  game.model.engine.income = earned;
  assert.equal(game.activate('miner:finish'), true);
  assert.equal(game.model.scene, 'complete');
  assert.equal(game.model.save.checkpoint, null);
  assert.equal(game.model.save.shop, null);
  assert.equal(game.model.save.highestCleared, 40);
  assert.equal(game.model.save.bestEarned, 500 + earned);
  assert.equal(storage.get(storageKey()).highestCleared, 40);
});

test('versus rounds each get one bomb, score separately and save the following round without a shop', () => {
  const { game, storage } = fixture();
  begin(game, 'versus');
  assert.deepEqual(game.model.engine.bombStocks, [1, 1]);
  game.model.engine.players[0].income = 200;
  game.model.engine.players[1].income = 600;
  game.model.engine.income = 800;
  expire(game);
  assert.deepEqual(game.model.completedMatch, { totals: [200, 600], wins: [0, 1], draws: 0 });
  assert.equal(game.model.save.checkpoint.levelIndex, 1);
  assert.equal(game.model.save.shop, null);
  assert.equal(game.activate('miner:retry'), false, 'a settled versus round cannot be replayed for duplicate credit');
  assert.equal(game.activate('miner:shop'), false);
  const resumed = fixture({ initial: [...storage] }).game;
  resumed.activate('miner:continue');
  assert.equal(resumed.model.engine.level.id, 2);
  assert.deepEqual(resumed.model.engine.bombStocks, [1, 1]);
  assert.deepEqual(resumed.model.checkpoint.match, { totals: [200, 600], wins: [0, 1], draws: 0 });
});

test('dual-pointer mine taps launch both hooks, repeated launch is ignored and each versus player owns bombs', () => {
  const { game } = fixture();
  begin(game, 'versus');
  const y = game.model.layout.mine.y + 20;
  assert.equal(game.pointer('start', [{ clientX: 40, clientY: y }, { clientX: 350, clientY: y }]), true);
  assert.deepEqual(game.model.engine.players.map(player => player.phase), ['out', 'out']);
  assert.equal(game.pointer('start', [{ clientX: 40, clientY: y }]), false);
  const [a, b] = game.model.engine.players;
  a.held = game.model.engine.ores[0]; a.held.held = true; a.phase = 'loaded';
  b.held = game.model.engine.ores[1]; b.held.held = true; b.phase = 'loaded';
  assert.equal(game.activate('miner:bomb', 0), true);
  assert.deepEqual(game.model.engine.bombStocks, [0, 1]);
  assert.equal(game.activate('miner:bomb', 1), true);
  assert.deepEqual(game.model.engine.bombStocks, [0, 0]);
  assert.equal(game.activate('miner:bomb', 0), false);
});

test('rotating preserves the active shot, ore state, income and timer and pauses for the new direction', () => {
  const { game } = fixture();
  begin(game, 'coop');
  game.activate('miner:launch', 1); game.tick(50);
  game.model.engine.income = 200;
  const remaining = game.model.engine.timeLeft;
  game.resize({ width: 844, height: 390, safeTop: 0, safeBottom: 0, capsuleRect: { top: 4, bottom: 36 } });
  assert.equal(game.model.scene, 'paused');
  assert.equal(game.model.engine.players[1].phase, 'out');
  assert.equal(game.model.engine.income, 200);
  assert.equal(game.model.engine.timeLeft, remaining);
  assert.equal(game.model.engine.viewport.portrait, false);
  assert.ok(game.model.engine.ores.every(ore => Number.isFinite(ore.x) && Number.isFinite(ore.y)));
});

test('invalid or unavailable storage is contained and cannot prevent gameplay', () => {
  const { game } = fixture({ storageErrors: true });
  begin(game);
  assert.equal(game.save(), false);
  assert.ok(game.model.warning);
  assert.ok(game.render(context()).length > 0);
  assert.equal(game.activate('miner:launch'), true);
  const bad = sanitize({ version: 1, checkpoint: { levelIndex: -1 }, shop: [] });
  assert.equal(bad.checkpoint, null);
  assert.equal(bad.shop, null);
  const corrupt = fixture({ initial: [[storageKey(), '{broken json']] }).game;
  begin(corrupt);
});

test('menu, shop, gameplay and help targets have readable labels and fit the safe area on narrow and wide screens', () => {
  const { game } = fixture();
  const ctx = context();
  for (const size of [{ width: 320, height: 568, safeTop: 20, safeBottom: 16 }, { width: 390, height: 844, safeTop: 44, safeBottom: 34 }, { width: 844, height: 390, safeTop: 0, safeBottom: 0 }]) {
    game.resize({ ...size, capsuleRect: { top: 24, bottom: 56 } });
    for (const target of game.render(ctx)) {
      assert.ok(target.label && !target.label.startsWith('miner:'), target.action);
      assert.ok(target.x >= 0 && target.x + target.w <= size.width, target.label);
      assert.ok(target.y >= 56 && target.y + target.h <= size.height - size.safeBottom, target.label);
    }
    if (game.model.panelMaxScroll > 0) {
      game.pointer('start', [{ clientX: size.width - 18, clientY: game.model.layout.headerBottom + 30 }]);
      game.pointer('move', [{ clientX: size.width - 18, clientY: -1000 }]);
      game.pointer('end', []);
      assert.ok(game.model.panelScroll > 0);
      game.render(ctx);
    }
  }
  game.resize({ width: 390, height: 844, safeTop: 44, safeBottom: 34 });
  begin(game, 'coop');
  const targets = game.render(ctx);
  assert.deepEqual(targets.filter(target => target.action === 'miner:launch').map(target => target.payload), [0, 1]);
  game.activate('miner:pause'); game.activate('miner:help'); game.render(ctx);
  game.activate('miner:help-page', 1); game.render(ctx);
});

test('invalid and inactive actions do not advance or overwrite a round', () => {
  const { game } = fixture();
  for (const action of ['miner:play', 'miner:finish', 'miner:shop', 'miner:next', 'miner:versus-next', 'miner:retry', 'other:new', null]) assert.equal(game.activate(action), false);
  begin(game);
  const snapshot = JSON.stringify(game.model.engine);
  assert.equal(game.activate('miner:mode', 'versus'), false);
  assert.equal(game.activate('miner:challenge', true), false);
  assert.equal(game.activate('miner:confirm-new'), false);
  assert.equal(game.pointer('start', [{ clientX: 0, clientY: 0 }]), false);
  game.tick(Infinity); game.tick(-1); game.tick(NaN);
  assert.equal(JSON.stringify(game.model.engine), snapshot);
});

test('ported engine catches a fast moving pig between frames and credits a delivered diamond pig once', () => {
  const fast = new MineEngine(mine([ore('fast', 300, 450, 'pig', { left: 200, right: 1000, speed: 48000 })]));
  fast.angle = 0; fast.rope = 302; fast.launch(); fast.update(1 / 120);
  assert.equal(fast.held.id, 'fast');
  assert.equal(fast.phase, 'loaded');
  const pig = new MineEngine(mine([ore('pig', 640, 450, 'diamondPig', { left: 640, right: 641, speed: 2 })]), { diamondBonus: true });
  pig.angle = 0; pig.launch();
  for (let frame = 0; frame < 2000 && !pig.ended; frame++) pig.update(1 / 120);
  assert.equal(pig.income, 930);
  assert.equal(oreValue(ore('pig', 640, 450, 'diamondPig')), 630);
  assert.equal(pig.drainEvents().filter(event => event.type === 'coin').length, 1);
});

test('ported TNT chain destroys surrounding loose ore without crediting income', () => {
  const engine = new MineEngine(mine([
    ore('first', PHYSICS.pivotX, 350, 'barrel'),
    ore('second', PHYSICS.pivotX + 100, 350, 'barrel'),
    ore('gold', PHYSICS.pivotX + 200, 350, 'goldLarge'),
    ore('distant', 100, 550, 'diamond'),
  ]));
  engine.angle = 0; engine.launch();
  for (let frame = 0; frame < 100; frame++) engine.update(1 / 120);
  assert.equal(engine.ores[0].removed, true);
  assert.equal(engine.ores[1].removed, true);
  assert.equal(engine.ores[2].removed, true);
  assert.equal(engine.ores[3].removed, false);
  assert.equal(engine.income, 0);
  assert.equal(engine.drainEvents().filter(event => event.type === 'blast').length, 2);
});

test('gold-miner generated sources match their SHA256 manifest and runtime has no DOM or wx dependency', async () => {
  assert.equal(await checkGoldMinerSources(), true);
  const base = new URL('../../微信小程序/src/games/gold-miner/', import.meta.url);
  const files = [new URL('index.js', base), ...(await readdir(new URL('core/', base))).filter(name => name.endsWith('.js')).map(name => new URL(`core/${name}`, base))];
  for (const file of files) assert.doesNotMatch(await readFile(file, 'utf8'), /\b(?:window|document|wx)\s*\./, file.pathname);
});
