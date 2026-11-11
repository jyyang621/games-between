import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createZumaGame, SAVE_KEY } = require('../../微信小程序/src/games/zuma/index.js');

function create(services = {}) {
  const storage = new Map();
  const game = createZumaGame({ now: () => 731, read: key => storage.get(key), write: (key, value) => { storage.set(key, structuredClone(value)); return true; }, services });
  return { game, storage };
}

test('Zuma menu previews locked tracks without starting or replacing a round', () => {
  const { game } = create();
  assert.equal(game.view, 'menu');
  const original = game.model;
  assert.equal(game.activate('zuma:select-level', 4), true);
  assert.equal(game.activate('zuma:start'), false);
  assert.equal(game.model, original); assert.equal(original.status, 'ready');
  assert.equal(game.activate('zuma:select-level', 0), true);
  assert.equal(game.activate('zuma:start'), true);
  game.tick(40); assert.ok(game.model.elapsed > 0);
  assert.equal(game.activate('zuma:mode', 'campaign'), true);
  assert.equal(game.view, 'menu'); assert.equal(game.model.status, 'paused');
  const elapsed = game.model.elapsed;
  game.tick(500); assert.equal(game.model.elapsed, elapsed);
  assert.equal(game.activate('zuma:continue'), true); assert.equal(game.model.status, 'playing');
});

test('Zuma mode menus preserve independent playable rounds and stop their clocks', () => {
  const { game, storage } = create();
  game.activate('zuma:start'); game.tick(40);
  const campaign = game.model, elapsed = campaign.elapsed;
  game.activate('zuma:mode', 'endless');
  assert.equal(campaign.status, 'paused'); assert.equal(game.view, 'menu');
  game.activate('zuma:start'); game.tick(40);
  const endless = game.model; endless.score = 90;
  game.activate('zuma:menu'); game.activate('zuma:mode', 'campaign');
  assert.equal(game.model, campaign); assert.equal(game.model.elapsed, elapsed);
  game.activate('zuma:continue'); game.activate('zuma:menu'); game.activate('zuma:mode', 'endless');
  assert.equal(game.model, endless); assert.equal(game.session.score, 90);
  assert.equal(endless.status, 'paused');
  assert.equal(storage.get(SAVE_KEY).version, 3);
});

test('Zuma ignores stale reset confirmation after leaving or switching modes', () => {
  const callbacks = [];
  const { game } = create({ modal: (_config, onConfirm) => callbacks.push(onConfirm) });
  game.activate('zuma:start'); game.tick(40);
  const campaign = game.model;
  game.activate('zuma:restart'); assert.equal(callbacks.length, 1);
  game.pause('background'); callbacks.shift()();
  assert.equal(game.model, campaign); assert.equal(campaign.status, 'paused');
  game.activate('zuma:resume'); game.activate('zuma:restart');
  game.activate('zuma:mode', 'endless'); const endless = game.model;
  callbacks.shift()();
  assert.equal(game.mode, 'endless'); assert.equal(game.view, 'menu'); assert.equal(game.model, endless);
});

test('Zuma rejected reset dialog preserves the current round and reports failure', () => {
  const { game } = create({ modal: () => false });
  game.activate('zuma:start'); game.tick(40); game.model.score = 80;
  const original = game.model;
  assert.equal(game.activate('zuma:restart'), false);
  assert.equal(game.model, original); assert.equal(game.model.score, 80); assert.equal(game.model.status, 'paused');
});

test('Zuma waits on a cleared wave and starts the next only by explicit action', () => {
  const { game } = create();
  game.activate('zuma:mode', 'endless'); game.activate('zuma:start');
  game.model.balls = []; game.model.projectiles = []; game.model.spawned = game.model.totalBalls;
  game.model.score = 120; game.model.status = 'won'; game.save();
  const cleared = game.model;
  game.tick(1000); assert.equal(game.model, cleared); assert.equal(game.session.wave, 1);
  assert.equal(game.activate('zuma:next'), true);
  assert.equal(game.model.status, 'playing'); assert.equal(game.session.wave, 2);
  assert.equal(game.session.score, 120); assert.notEqual(game.model, cleared);
  assert.equal(game.activate('zuma:next'), false); assert.equal(game.session.wave, 2);
});

test('Zuma shared mode and stage open a preview without bypassing unlocks', () => {
  const { game } = create();
  game.enter({ m: 'campaign', l: '6' });
  assert.equal(game.view, 'menu'); assert.equal(game.session.levelIndex, 0);
  assert.equal(game.activate('zuma:start'), false);
  game.enter({ m: 'endless' });
  assert.equal(game.mode, 'endless'); assert.equal(game.view, 'menu');
  assert.match(game.sharePayload().query, /g=zuma&m=endless&difficulty=normal/);
  game.activate('zuma:start'); game.tick(40); game.enter({ m: 'endless' });
  assert.equal(game.model.status, 'paused'); assert.equal(game.view, 'menu');
  game.enter({ m: 'unknown', l: '99' }); assert.equal(game.mode, 'endless');
});

test('Zuma difficulty can change only in the menu and retains each difficulty round', () => {
  const { game } = create();
  assert.equal(game.difficulty, 'normal');
  assert.equal(game.activate('zuma:difficulty', 'easy'), true);
  assert.equal(game.activate('zuma:difficulty', 'easy'), false);
  assert.equal(game.activate('zuma:difficulty', 'impossible'), false);
  game.activate('zuma:start'); game.tick(40); game.model.score = 30;
  const easy = game.model, easyElapsed = easy.elapsed;
  assert.equal(game.activate('zuma:difficulty', 'hell'), false);
  assert.equal(game.difficulty, 'easy');
  game.activate('zuma:menu'); game.activate('zuma:difficulty', 'hell');
  assert.equal(game.difficulty, 'hell'); assert.equal(game.model.status, 'ready');
  assert.ok(game.model.speed > easy.speed); assert.ok(game.model.totalBalls > easy.totalBalls);
  game.activate('zuma:start'); game.tick(40); const hell = game.model;
  game.activate('zuma:menu'); game.activate('zuma:difficulty', 'easy');
  assert.equal(game.model, easy); assert.equal(game.model.status, 'paused');
  assert.equal(game.model.elapsed, easyElapsed); assert.equal(game.model.score, 30);
  game.activate('zuma:continue'); assert.equal(game.model.status, 'playing');
  assert.equal(hell.status, 'paused');
});

test('Zuma shared difficulty opens its own profile without resetting another profile', () => {
  const { game } = create();
  game.activate('zuma:start'); game.tick(40); const normal = game.model;
  game.enter({ m: 'endless', difficulty: 'hard' });
  assert.equal(game.mode, 'endless'); assert.equal(game.difficulty, 'hard'); assert.equal(game.view, 'menu');
  assert.equal(normal.status, 'paused'); assert.equal(game.model.status, 'ready');
  assert.equal(new URLSearchParams(game.sharePayload().query).get('difficulty'), 'hard');
  assert.match(game.sharePayload().title, /困难/);
  game.enter({ m: 'campaign', difficulty: 'normal' });
  assert.equal(game.model, normal); assert.equal(game.model.status, 'paused');
  game.enter({ m: 'campaign', difficulty: 'hell', l: '6' });
  assert.equal(game.session.unlocked, 0); assert.equal(game.activate('zuma:start'), false);
  game.enter({ m: 'endless', difficulty: 'invalid' });
  assert.equal(game.difficulty, 'hell');
});

test('Zuma stale reset confirmation cannot replace a round after difficulty changes', () => {
  let confirm;
  const { game } = create({ modal: (_config, callback) => { confirm = callback; } });
  game.activate('zuma:start'); game.tick(40); const normal = game.model;
  game.activate('zuma:restart'); game.activate('zuma:menu'); game.activate('zuma:difficulty', 'hard');
  const hard = game.model;
  confirm();
  assert.equal(game.difficulty, 'hard'); assert.equal(game.model, hard); assert.equal(hard.status, 'ready');
  game.activate('zuma:difficulty', 'normal'); assert.equal(game.model, normal); assert.equal(normal.status, 'paused');
});

test('Zuma swap works while playing and paused, saves ammo and cancels an interrupted aim', () => {
  const { game, storage } = create(); game.resize({ width: 390, height: 844 }); game.activate('zuma:start');
  game.model.currentColor = 0; game.model.nextColor = 1;
  const b = game.layout.board;
  assert.equal(game.pointer('start', [{ identifier: 1, clientX: b.x + b.w / 2, clientY: b.y + b.h / 2 }]), true);
  assert.equal(game.activate('zuma:swap'), true);
  assert.equal(game.model.currentColor, 1); assert.equal(game.model.nextColor, 0);
  assert.equal(game.pointer('end', [{ identifier: 1, clientX: b.x + b.w / 2, clientY: b.y + b.h / 2 }]), false);
  assert.equal(game.model.projectiles.length, 0);
  game.pause(); const elapsed = game.model.elapsed;
  assert.equal(game.activate('zuma:swap'), true);
  assert.equal(game.model.currentColor, 0); assert.equal(game.model.nextColor, 1);
  game.tick(100); assert.equal(game.model.elapsed, elapsed); assert.equal(game.model.status, 'paused');
  const round = storage.get(SAVE_KEY).profiles.normal.campaign.round;
  assert.equal(round.currentColor, 0); assert.equal(round.nextColor, 1); assert.equal(round.status, 'paused');
  game.activate('zuma:help'); assert.equal(game.activate('zuma:swap'), false); game.activate('zuma:help-close');
  game.model.status = 'won'; assert.equal(game.activate('zuma:swap'), false);
});

test('Zuma same-color swap explains the unchanged ammo without rerolling it', () => {
  const messages = [];
  const { game, storage } = create({ toast: message => messages.push(message) });
  game.activate('zuma:start'); game.model.currentColor = 2; game.model.nextColor = 2; game.save();
  const before = storage.get(SAVE_KEY).profiles.normal.campaign.round;
  assert.equal(game.activate('zuma:swap'), true);
  assert.match(messages[0], /同色/);
  assert.equal(game.model.currentColor, 2); assert.equal(game.model.nextColor, 2);
  const after = storage.get(SAVE_KEY).profiles.normal.campaign.round;
  assert.equal(after.randomDraws, before.randomDraws); assert.equal(after.ammoSinceWildcard, before.ammoSinceWildcard);
  game.activate('zuma:menu'); assert.equal(game.activate('zuma:swap'), false);
});
