import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createGame, SAVE_KEY, LOCK_DELAY, MAX_LOCK_RESETS, gravityInterval } = require('../../微信小程序/src/games/tetris/index.js');
const { newRound, move, dropDistance, cloneRound } = require('../../微信小程序/src/games/tetris/engine.js');
const { registry } = require('../../微信小程序/src/registry.js');
const { validateGameModule } = require('../../微信小程序/src/app/game-contract.js');
const { createMiniGame } = require('../../微信小程序/src/app/host.js');
const action = name => `tetris:${name}`;
function setup(saved, overrides = {}) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []), modals = [], writes = [];
  const game = createGame({ now: () => 1770000000000,
    read: key => structuredClone(storage.get(key)),
    write: (key, value) => { writes.push(key); storage.set(key, structuredClone(value)); return true; },
    services: { modal: (config, confirm) => { modals.push({ config, confirm }); return true; }, invalidate() {} }, ...overrides });
  return { game, storage, modals, writes };
}
function advance(game, ms) { while (ms > 0) { const step = Math.min(ms, 100); game.tick(step); ms -= step; } }
function ground(game) { while (move(game.model.round, 0, 1)) {} }
function context() { return new Proxy({ measureText: t => ({ width: String(t).length * 7 }) }, { get: (o, k) => k in o ? o[k] : () => {} }); }

test('tetris is an isolated seventh registered game with contract and share route', () => {
  const { game, writes } = setup();
  assert.equal(validateGameModule(game, 'tetris'), game);
  assert.equal(registry.resolve({ g: 'tetris' }).id, 'tetris');
  assert.equal(registry.list().findIndex(e => e.id === 'tetris'), 6);
  assert.equal(SAVE_KEY, 'games-between:tetris:save:v1');
  assert.equal(game.sharePayload().query, 'g=tetris');
  assert.equal(game.musicActive, true);
  game.save(); assert.deepEqual(writes, [SAVE_KEY]);
});
test('gravity changes speed by level and bounds invalid and background-sized deltas', () => {
  const { game } = setup(); const y = game.model.round.active.y;
  for (const dt of [0, -1, NaN, Infinity]) game.tick(dt);
  assert.equal(game.model.round.active.y, y);
  game.tick(60000); assert.equal(game.model.round.active.y, y);
  advance(game, 699); assert.equal(game.model.round.active.y, y);
  game.tick(1); assert.equal(game.model.round.active.y, y + 1);
  assert.equal(gravityInterval(1), 800); assert.equal(gravityInterval(20), 80);
});
test('soft drop scores only successful cells, hard drop locks once and updates best', () => {
  const { game, storage } = setup();
  assert.equal(game.activate(action('soft-drop')), true); assert.equal(game.model.round.score, 1);
  const distance = dropDistance(game.model.round);
  assert.equal(game.activate(action('hard-drop')), true);
  assert.equal(game.model.round.pieces, 1); assert.equal(game.model.round.score, 1 + 2 * distance);
  assert.equal(storage.get(SAVE_KEY).best, game.model.round.score);
  ground(game); const score = game.model.round.score;
  assert.equal(game.activate(action('soft-drop')), false); assert.equal(game.model.round.score, score);
});
test('grounded piece gets a 500ms lock delay and new piece resets its timing', () => {
  const { game } = setup(); ground(game);
  advance(game, LOCK_DELAY - 1); assert.equal(game.model.round.pieces, 0);
  game.tick(1); assert.equal(game.model.round.pieces, 1);
  assert.equal(game.model.lockMs, 0); assert.equal(game.model.lockResets, 0);
});
test('ground movements reset lock delay at most fifteen times; invalid movements do not reset it', () => {
  const { game } = setup(); ground(game);
  for (let i = 0; i < MAX_LOCK_RESETS; i++) {
    game.tick(100); assert.equal(game.activate(action(i % 2 ? 'right' : 'left')), true);
    assert.equal(game.model.lockMs, 0);
  }
  assert.equal(game.model.lockResets, MAX_LOCK_RESETS);
  game.tick(100); game.activate(action('right')); assert.equal(game.model.lockMs, 100);
  advance(game, 400); assert.equal(game.model.round.pieces, 1);
});
test('all pause reasons stop inputs, gravity and music without implicitly resuming on enter', () => {
  for (const reason of ['home', 'background', 'share', 'resize']) {
    const { game } = setup(); advance(game, 300); game.pause(reason);
    const before = structuredClone(game.model);
    game.enter(); game.tick(10000); assert.equal(game.activate(action('left')), false);
    assert.deepEqual(game.model, before); assert.equal(game.musicActive, false);
    assert.equal(game.activate(action('resume')), true); advance(game, 500);
    assert.equal(game.model.round.active.y, before.round.active.y + 1);
  }
});
test('save and restore preserve exact board, RNG, score and lock delay with manual resume', () => {
  const { game, storage } = setup(); game.activate(action('hard-drop')); ground(game); game.tick(100); game.activate(action('left')); game.tick(100); game.pause();
  const saved = storage.get(SAVE_KEY), next = setup(saved).game;
  assert.equal(next.model.paused, true); assert.deepEqual(next.model.round, game.model.round);
  assert.equal(next.model.lockMs, game.model.lockMs); assert.equal(next.model.lockResets, game.model.lockResets);
  next.tick(10000); assert.deepEqual(next.model.round, game.model.round);
  next.activate(action('resume')); advance(next, 400); assert.equal(next.model.round.pieces, 2);
});
test('corrupt snapshots fail closed, best can survive and storage failure remains playable', () => {
  const round = newRound(1); round.board[0] = 99;
  const { game } = setup({ version: 1, round, best: 987 });
  assert.equal(game.model.round.score, 0); assert.equal(game.model.best, 987); assert.equal(game.model.paused, false);
  const failed = setup(null, { read() { throw Error('read'); }, write() { throw Error('quota'); } }).game;
  assert.equal(failed.save(), false); assert.equal(failed.activate(action('hard-drop')), true);
  assert.doesNotThrow(() => failed.render(context()));
});
test('periodic autosave includes falling progress even without input', () => {
  const { game, storage, writes } = setup(); advance(game, 1000);
  assert.equal(writes.length, 1); assert.deepEqual(storage.get(SAVE_KEY).round, cloneRound(game.model.round));
});
test('soft drop keeps the largest valid score saturated and the save restorable', () => {
  const round = newRound(1); round.score = Number.MAX_SAFE_INTEGER;
  const { game, storage } = setup({ version: 1, round, best: round.score });
  game.activate(action('resume')); assert.equal(game.activate(action('soft-drop')), true); game.save();
  assert.equal(game.model.round.score, Number.MAX_SAFE_INTEGER);
  const next = setup(storage.get(SAVE_KEY)).game;
  assert.equal(next.model.paused, true); assert.deepEqual(next.model.round, game.model.round);
});
test('restart needs confirmation and stale modal callbacks cannot replace a later round', () => {
  const { game, modals } = setup(); game.activate(action('hard-drop'));
  const before = cloneRound(game.model.round); game.activate(action('new'));
  assert.equal(game.model.paused, true); assert.deepEqual(game.model.round, before);
  game.activate(action('resume')); modals[0].confirm(); assert.deepEqual(game.model.round, before);
  game.activate(action('new')); modals[1].confirm(); assert.equal(game.model.round.pieces, 0);
  assert.equal(game.model.paused, false); assert.ok(game.model.best > 0);
});
test('help pauses, dispose invalidates pending modals and rejects later actions', () => {
  const { game, modals } = setup(); game.activate(action('help'));
  assert.equal(game.model.paused, true); assert.equal(modals[0].config.showCancel, false);
  game.activate(action('new')); const before = cloneRound(game.model.round); game.dispose();
  modals[1].confirm(); assert.deepEqual(game.model.round, before);
  assert.equal(game.activate(action('resume')), false); assert.equal(game.musicActive, false);
});
test('board gestures move multiple cells, rotate on tap, and suppress upward/multitouch/cancel taps', () => {
  const { game } = setup(); game.resize({ width: 390, height: 844 });
  const b = game.layout.board, x = b.x + b.w / 2, y = b.y + b.h / 2, cell = b.w / 10;
  const p = (dx = 0, dy = 0, id = 1) => ({ x: x + dx, y: y + dy, identifier: id });
  const beforeX = game.model.round.active.x;
  game.pointer('start', [p()]); game.pointer('end', [p(-2.1 * cell)]);
  assert.equal(game.model.round.active.x, beforeX - 2);
  const score = game.model.round.score;
  game.pointer('start', [p()]); game.pointer('move', [p(0, 2.1 * cell)]); game.pointer('end', [p(0, 2.1 * cell)]);
  assert.equal(game.model.round.score, score + 2);
  const before = cloneRound(game.model.round);
  game.pointer('start', [p()]); game.pointer('start', [p(0, 0, 2)]); game.pointer('end', [p()]); game.pointer('end', [p(0, 0, 2)]);
  assert.deepEqual(game.model.round, before);
  game.pointer('start', [p()]); game.pointer('cancel', []); game.pointer('end', [p()]); assert.deepEqual(game.model.round, before);
  game.pointer('start', [p()]); game.pointer('end', [p(0, -3 * cell)]); assert.deepEqual(game.model.round, before);
});
test('host page three, touch actions, background and home restoration work without cross-game writes', () => {
  const handlers = new Map(), storage = new Map([['unrelated-save', { keep: true }]]); let time = 0;
  const platform = { createCanvas: () => ({ getContext: () => context() }),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }),
    getLaunchOptionsSync: () => ({}), getStorageSync: k => structuredClone(storage.get(k)),
    setStorageSync: (k, v) => storage.set(k, structuredClone(v)), showShareMenu() {} };
  for (const n of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize','ShareAppMessage']) {
    platform[`on${n}`] = f => handlers.set(n, f); platform[`off${n}`] = () => {};
  }
  const app = createMiniGame(platform, { autoTick: false, now: () => time });
  try {
    assert.equal(app.activate('hub:page', 2), true);
    assert.ok(app.targets.some(t => t.action === 'openGame' && t.payload === 'tetris'));
    app.activate('openGame', 'tetris'); const target = app.targets.find(t => t.action === action('hard-drop'));
    handlers.get('TouchStart')({ changedTouches: [{ clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 }] });
    assert.equal(app.activeGame.model.round.pieces, 1);
    handlers.get('Hide')(); time += 60000; handlers.get('Show')({}); app.tick();
    assert.equal(app.activeGame.model.paused, true); assert.equal(app.activeGame.model.round.pieces, 1);
    app.activate(action('resume')); app.activate('home'); app.activate('openGame', 'tetris');
    assert.equal(app.activeGame.model.paused, true); assert.ok(storage.has(SAVE_KEY));
    assert.deepEqual(storage.get('unrelated-save'), { keep: true });
  } finally { app.dispose(); }
});
