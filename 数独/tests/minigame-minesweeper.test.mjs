import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGame, SAVE_KEY, MAX_TIME } = require('../../微信小程序/src/games/minesweeper/index.js');
const { createRound, reveal, cloneRound, validateRound } = require('../../微信小程序/src/games/minesweeper/engine.js');
const { validateGameModule } = require('../../微信小程序/src/app/game-contract.js');
const { registry } = require('../../微信小程序/src/registry.js');
const { createMiniGame } = require('../../微信小程序/src/app/host.js');
const PHONE = { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } };
const action = name => 'minesweeper:' + name;

function create(saved = null, overrides = {}) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []), modals = [], writes = [], toasts = [];
  const game = createGame({
    read: key => structuredClone(storage.get(key)),
    write: (key, value) => { writes.push(key); storage.set(key, structuredClone(value)); return true; },
    now: () => 987654321,
    services: { modal: (config, confirm) => { modals.push({ config, confirm }); return true; }, invalidate() {}, toast: text => toasts.push(text) },
    ...overrides,
  });
  game.resize(PHONE);
  return { game, storage, modals, writes, toasts };
}
function context() {
  return new Proxy({ measureText: value => ({ width: String(value).length * 7 }) }, { get: (o, k) => k in o ? o[k] : () => {} });
}
function progressed() { const mock = create(); mock.game.activate(action('cell'), 40); mock.game.tick(2345); return mock; }

test('minesweeper registers a fifth independent game with contract, share and save namespace', () => {
  const { game, writes } = create();
  assert.equal(validateGameModule(game, 'minesweeper'), game);
  assert.equal(SAVE_KEY, 'games-between:minesweeper:save:v1');
  assert.equal(registry.resolve({ g: 'minesweeper' }).id, 'minesweeper');
  assert.equal(registry.get('minesweeper').status, 'ready');
  assert.deepEqual(game.sharePayload().query, 'g=minesweeper');
  assert.equal(game.model.round.status, 'ready');
  assert.equal(game.musicActive, false); assert.equal(game.getResumeInfo().available, false);
  assert.equal(game.activate(action('cell'), 40), true);
  assert.equal(game.musicActive, true); assert.equal(game.getResumeInfo().available, true);
  assert.ok(writes.length && writes.every(key => key === SAVE_KEY));
});
test('clock starts on reveal, stops on pause, resumes manually and freezes on terminal states', () => {
  const { game } = create();
  game.tick(1000); assert.equal(game.model.round.elapsedMs, 0);
  game.activate(action('mode'), 'flag'); game.activate(action('cell'), 0);
  game.tick(1000); assert.equal(game.model.round.elapsedMs, 0);
  game.activate(action('mode'), 'reveal'); game.activate(action('cell'), 40);
  game.tick(1250); assert.equal(game.model.round.elapsedMs, 1250);
  game.activate(action('pause')); game.tick(8000); assert.equal(game.model.round.elapsedMs, 1250);
  assert.equal(game.musicActive, false); assert.equal(game.activate(action('cell'), 1), false);
  game.enter(); assert.equal(game.model.paused, true);
  game.activate(action('resume')); game.tick(750); assert.equal(game.model.round.elapsedMs, 2000);
  for (const invalid of [0, -1, NaN, Infinity]) game.tick(invalid);
  assert.equal(game.model.round.elapsedMs, 2000);
  game.tick(MAX_TIME * 2); assert.equal(game.model.round.elapsedMs, MAX_TIME);
  const mine = game.model.round.mines.findIndex(Boolean);
  game.activate(action('cell'), mine); assert.equal(game.model.round.status, 'lost');
  game.tick(1000); assert.equal(game.model.round.elapsedMs, MAX_TIME);
  assert.equal(game.musicActive, false); assert.equal(game.getResumeInfo().available, false);
});
test('flag and reveal modes are explicit and flagged cells cannot accidentally open', () => {
  const { game } = create();
  for (const value of [null, 'x', undefined, 4, {}]) assert.equal(game.activate(action('mode'), value), false);
  assert.equal(game.activate(action('mode'), 'flag'), true);
  assert.equal(game.activate(action('cell'), 40), true);
  assert.equal(game.model.round.flags[40], true);
  game.activate(action('mode'), 'reveal');
  assert.equal(game.activate(action('cell'), 40), false); assert.equal(game.model.round.started, false);
  for (const i of [-1, 81, NaN, null, '0', undefined, {}]) assert.equal(game.activate(action('cell'), i), false);
  game.activate(action('mode'), 'flag'); game.activate(action('cell'), 40);
  game.activate(action('mode'), 'reveal'); assert.equal(game.activate(action('cell'), 40), true);
  assert.equal(game.model.round.revealed[40], true);
  assert.equal(game.activate('game-2048:cell', 0), false);
});
test('automatic save restores the exact board, clock, flags and mode with a pause', () => {
  const { game, storage } = progressed();
  game.activate(action('mode'), 'flag');
  const index = game.model.round.revealed.findIndex(value => !value);
  game.activate(action('cell'), index);
  game.save();
  const before = cloneRound(game.model.round), restored = create(storage.get(SAVE_KEY)).game;
  assert.deepEqual(restored.model.round, before); assert.equal(restored.model.mode, 'flag');
  assert.equal(restored.model.paused, true);
  restored.tick(9999); assert.equal(restored.model.round.elapsedMs, 2345);
  assert.equal(restored.activate(action('cell'), index), false);
  restored.activate(action('resume')); restored.tick(500); assert.equal(restored.model.round.elapsedMs, 2845);
});
test('new rounds and difficulty changes require confirmation and preserve progress when cancelled', () => {
  const { game, modals } = progressed();
  const before = cloneRound(game.model.round);
  assert.equal(game.activate(action('difficulty'), 'expert'), true);
  assert.equal(modals.length, 1); assert.deepEqual(game.model.round, before); assert.equal(game.model.paused, true);
  game.activate(action('resume')); modals[0].confirm();
  assert.deepEqual(game.model.round, before, 'obsolete confirmation after resume must not replace the board');
  game.activate(action('difficulty'), 'expert'); modals[1].confirm();
  assert.equal(game.model.round.difficulty, 'expert'); assert.equal(game.model.round.mineCount, 40);
  assert.equal(game.layout.cells.length, 192); assert.equal(game.model.round.status, 'ready'); assert.equal(game.model.paused, false);
  assert.equal(game.activate(action('difficulty'), 'expert'), false);
  assert.equal(game.activate(action('difficulty'), 'unknown'), false);
});
test('late confirmations cannot reset games after reentry, navigation, new actions or disposal', () => {
  for (const interrupt of [game => game.pause('home'), game => game.enter(), game => game.dispose()]) {
    const { game, modals } = progressed(), before = cloneRound(game.model.round);
    game.activate(action('new')); interrupt(game); modals[0].confirm();
    assert.deepEqual(game.model.round, before);
  }
});
test('winning records independent best times, keeps them on restart, and freezes input', () => {
  const { game, storage } = progressed(); const r = game.model.round;
  for (let i = 0; i < r.mines.length; i++) if (!r.mines[i] && !r.revealed[i]) game.activate(action('cell'), i);
  assert.equal(r.status, 'won'); assert.equal(game.model.bests.beginner, 2345);
  assert.equal(game.model.bests.intermediate, null); assert.equal(game.musicActive, false);
  assert.equal(game.activate(action('cell'), r.mines.findIndex(Boolean)), false);
  game.tick(9000); assert.equal(r.elapsedMs, 2345);
  const restored = create(storage.get(SAVE_KEY)).game;
  assert.equal(restored.model.round.status, 'won'); assert.equal(restored.model.paused, false);
  game.activate(action('new')); assert.equal(game.model.bests.beginner, 2345);
  assert.equal(game.model.round.status, 'ready');
});
test('unavailable or corrupted storage cannot prevent a fresh playable game', () => {
  for (const saved of [{ version: 99, round: createRound() }, { version: 1, round: {} }, { version: 1, round: null, bests: { beginner: -1 } }]) {
    const { game } = create(saved); assert.equal(game.model.round.status, 'ready');
    assert.ok(validateRound(game.model.round)); assert.equal(game.model.bests.beginner, null);
  }
  const { game } = create(null, { read() { throw Error('read'); }, write() { throw Error('write'); } });
  assert.equal(game.activate(action('cell'), 40), true); assert.equal(game.save(), false);
  assert.ok(game.render(context()).some(target => target.action === action('cell')));
  const noModal = create(null, { services: {} }).game;
  noModal.activate(action('cell'), 40);
  const before = cloneRound(noModal.model.round); noModal.activate(action('new'));
  assert.deepEqual(noModal.model.round, before); assert.equal(noModal.model.paused, true);
});
test('help pauses play, describes safe opening and guessing, and disposal disables actions', () => {
  const { game, modals } = progressed();
  game.activate(action('help')); assert.equal(game.model.paused, true);
  assert.match(modals[0].config.content, /周围一圈/); assert.match(modals[0].config.content, /可能需要猜测/);
  assert.match(modals[0].config.content, /插错旗/);
  game.dispose();
  assert.equal(game.activate(action('new')), false); assert.equal(game.activate(action('resume')), false);
  assert.equal(game.pointer('start', []), false); assert.equal(game.save(), false); assert.equal(game.musicActive, false);
});
test('shared host routes lobby, native touches, background and cold saves without game branches', () => {
  const storage = new Map(), handlers = new Map();
  let time = 100000;
  const platform = {
    createCanvas: () => ({ getContext: () => context() }),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { top: 44, bottom: 810 } }),
    getMenuButtonBoundingClientRect: () => ({ top: 50, bottom: 82, left: 290, right: 380 }),
    getLaunchOptionsSync: () => ({ query: {} }), getStorageSync: k => structuredClone(storage.get(k)),
    setStorageSync: (k, v) => storage.set(k, structuredClone(v)), showShareMenu() {},
  };
  for (const event of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize','ShareAppMessage']) platform['on' + event] = fn => handlers.set(event, fn);
  const app = createMiniGame(platform, { autoTick: false, now: () => time });
  try {
    app.activate('hub:page', 1);
    assert.ok(app.targets.some(t => t.action === 'openGame' && t.payload === 'minesweeper'));
    app.activate('openGame', 'minesweeper'); assert.equal(app.screen, 'minesweeper');
    const target = app.targets.find(t => t.action === action('cell') && t.payload === 40);
    handlers.get('TouchStart')({ changedTouches: [{ clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 }] });
    assert.equal(app.activeGame.model.round.started, true);
    time += 2500; app.tick(); assert.equal(app.activeGame.model.round.elapsedMs, 2500);
    handlers.get('Hide')(); time += 10000; handlers.get('Show')({});
    assert.equal(app.activeGame.model.paused, true); assert.equal(app.activeGame.model.round.elapsedMs, 2500);
    app.activate(action('resume')); time += 500; app.tick(); assert.equal(app.activeGame.model.round.elapsedMs, 3000);
    app.activate('home'); app.activate('openGame', 'minesweeper');
    assert.equal(app.activeGame.model.paused, true);
    assert.ok(storage.has(SAVE_KEY));
  } finally { app.dispose(); }
});

test('controller rejects an out-of-range saved clock instead of rewinding it on resume', () => {
  const round = createRound('beginner', 123);
  reveal(round, 40); round.elapsedMs = MAX_TIME + 1;
  const { game } = create({ version: 1, round, bests: { beginner: MAX_TIME + 1 } });
  assert.equal(game.model.round.status, 'ready');
  assert.equal(game.model.round.elapsedMs, 0);
  assert.equal(game.model.bests.beginner, null);
});
