import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createGame, SAVE_KEY, AI_DELAY } = require('../../微信小程序/src/games/gomoku/index.js');
const { createRound, placeStone, cloneRound } = require('../../微信小程序/src/games/gomoku/engine.js');
const { validateGameModule } = require('../../微信小程序/src/app/game-contract.js');
const { registry } = require('../../微信小程序/src/registry.js');
const { createMiniGame } = require('../../微信小程序/src/app/host.js');
const action = name => 'gomoku:' + name;
function create(saved = null, overrides = {}) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []), modals = [], writes = [], toasts = [];
  const game = createGame({
    read: k => structuredClone(storage.get(k)),
    write: (k, v) => { writes.push(k); storage.set(k, structuredClone(v)); return true; },
    services: { modal: (config, confirm) => { modals.push({ config, confirm }); return true; }, toast: text => toasts.push(text), invalidate() {} },
    ...overrides,
  });
  return { game, storage, modals, writes, toasts };
}
function context() {
  const gradient = { addColorStop() {} };
  return new Proxy({ measureText: value => ({ width: String(value).length * 7 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => k in o ? o[k] : () => {} });
}
test('gomoku registers an isolated sixth game with contract and entry sharing', () => {
  const { game, writes } = create();
  assert.equal(validateGameModule(game, 'gomoku'), game);
  assert.equal(SAVE_KEY, 'games-between:gomoku:save:v1');
  assert.equal(registry.resolve({ g: 'gomoku' }).id, 'gomoku');
  assert.equal(game.sharePayload().query, 'g=gomoku');
  assert.equal(game.model.round.mode, 'ai'); assert.equal(game.musicActive, false);
  assert.equal(game.getResumeInfo().available, false);
  game.activate(action('cell'), 112);
  assert.equal(game.musicActive, true); assert.equal(game.getResumeInfo().available, true);
  assert.ok(writes.length && writes.every(key => key === SAVE_KEY));
});
test('computer turn rejects human taps and replies once after a bounded tick delay', () => {
  const { game } = create();
  assert.equal(game.activate(action('cell'), 112), true);
  assert.equal(game.model.thinking, true);
  assert.equal(game.activate(action('cell'), 113), false);
  for (const invalid of [0, -1, NaN, Infinity]) game.tick(invalid);
  game.tick(AI_DELAY - 1); assert.equal(game.model.round.moves.length, 1);
  game.tick(1); assert.equal(game.model.round.moves.length, 2);
  assert.equal(game.model.round.turn, 1); assert.equal(game.model.thinking, false);
  game.tick(100000); assert.equal(game.model.round.moves.length, 2);
  assert.equal(game.activate(action('cell'), 112), false);
});
test('pause and reentry cannot apply a pending computer move until manual resume', () => {
  for (const reason of ['home', 'background', 'share', 'resize']) {
    const { game } = create(); game.activate(action('cell'), 112); game.tick(200);
    game.pause(reason); game.enter(); game.tick(10000);
    assert.equal(game.model.round.moves.length, 1); assert.equal(game.model.paused, true);
    assert.equal(game.musicActive, false); assert.equal(game.activate(action('cell'), 113), false);
    game.activate(action('resume')); game.tick(AI_DELAY);
    assert.equal(game.model.round.moves.length, 2);
  }
});
test('human-black undo removes pending move or completed pair without a stale computer reply', () => {
  const { game } = create(); game.activate(action('cell'), 112);
  assert.equal(game.activate(action('undo')), true); game.tick(10000);
  assert.equal(game.model.round.moves.length, 0);
  game.activate(action('cell'), 112); game.tick(AI_DELAY);
  assert.equal(game.activate(action('undo')), true); assert.equal(game.model.round.moves.length, 0);
  assert.equal(game.activate(action('undo')), false);
});
test('human-white opening and undo preserve computer opening and return the human turn', () => {
  const { game } = create(); game.activate(action('color'), 2);
  assert.equal(game.activate(action('cell'), 112), false); game.tick(AI_DELAY);
  assert.equal(game.model.round.moves.length, 1); assert.equal(game.model.round.turn, 2);
  assert.equal(game.activate(action('undo')), false);
  game.activate(action('cell'), 113); game.tick(AI_DELAY);
  assert.equal(game.model.round.moves.length, 3);
  assert.equal(game.activate(action('undo')), true);
  assert.equal(game.model.round.moves.length, 1); assert.equal(game.model.round.turn, 2);
});
test('local play alternates without computer, freezes on victory and supports one-ply terminal undo', () => {
  const { game } = create(); game.activate(action('mode'), 'local');
  for (const i of [0, 15, 1, 16, 2, 17, 3, 18, 4]) assert.equal(game.activate(action('cell'), i), true);
  assert.equal(game.model.round.status, 'won'); assert.equal(game.model.round.winner, 1);
  assert.equal(game.musicActive, false); assert.equal(game.getResumeInfo().available, false);
  game.tick(10000); assert.equal(game.model.round.moves.length, 9);
  assert.equal(game.activate(action('cell'), 19), false);
  assert.equal(game.activate(action('undo')), true); assert.equal(game.model.round.status, 'playing');
  assert.equal(game.model.round.moves.length, 8); assert.equal(game.model.round.turn, 1);
});
test('save round-trips a pending computer turn, restores paused and uses defensive copies', () => {
  const { game, storage } = create(); game.activate(action('cell'), 112);
  const before = cloneRound(game.model.round), saved = storage.get(SAVE_KEY);
  const restored = create(saved).game; assert.deepEqual(restored.model.round, before);
  assert.equal(restored.model.paused, true); restored.tick(10000);
  assert.equal(restored.model.round.moves.length, 1);
  restored.activate(action('resume')); restored.tick(AI_DELAY);
  assert.equal(restored.model.round.moves.length, 2);
  assert.deepEqual(saved.round, before);
});
test('new/mode/color changes confirm live progress and reject stale callbacks', () => {
  for (const [name, payload] of [['new', undefined], ['mode', 'local'], ['color', 2]]) {
    const { game, modals } = create(); game.activate(action('cell'), 112);
    const before = cloneRound(game.model.round);
    assert.equal(game.activate(action(name), payload), true); assert.equal(modals.length, 1);
    assert.equal(game.model.paused, true); assert.deepEqual(game.model.round, before);
    game.activate(action('resume')); modals[0].confirm(); assert.deepEqual(game.model.round, before);
    game.activate(action(name), payload); modals[1].confirm(); assert.equal(game.model.round.moves.length, 0);
    assert.equal(game.model.paused, false);
  }
  for (const interrupt of [g => g.pause('home'), g => g.enter(), g => g.dispose()]) {
    const { game, modals } = create(); game.activate(action('cell'), 112);
    game.activate(action('new')); interrupt(game); modals[0].confirm();
    assert.equal(game.model.round.moves.length, 1);
  }
});
test('corruption, unavailable storage, dialog failure and invalid actions fail safely', () => {
  for (const saved of [{ version: 9, round: createRound() }, { version: 1, round: {} }, { version: 1, round: { ...createRound(), moves: [112, 112] } }]) {
    const { game } = create(saved); assert.equal(game.model.round.moves.length, 0); assert.equal(game.model.paused, false);
  }
  const { game, toasts } = create(null, { read() { throw Error('read'); }, write() { throw Error('write'); }, services: { modal: () => false, toast: x => toasts.push(x) } });
  assert.equal(game.activate(action('cell'), 112), true); assert.equal(game.save(), false);
  game.activate(action('new')); assert.equal(game.model.round.moves.length, 1); assert.ok(toasts.length);
  for (const [name, value] of [['mode', 'bad'], ['color', 9], ['cell', '1'], ['cell', -1], ['cell', 225]]) assert.equal(game.activate(action(name), value), false);
  assert.equal(game.activate('minesweeper:cell', 0), false);
  assert.doesNotThrow(() => game.render(context()));
});
test('help uses supported short modal labels and disposal stops computer work and input', () => {
  const { game, modals } = create(); game.activate(action('cell'), 112); game.activate(action('help'));
  assert.equal(game.model.paused, true); assert.match(modals[0].config.content, /无禁手/);
  assert.match(modals[0].config.content, /休闲强度/); assert.ok(modals[0].config.confirmText.length <= 4);
  game.dispose(); game.tick(10000); assert.equal(game.model.round.moves.length, 1);
  assert.equal(game.activate(action('resume')), false); assert.equal(game.save(), false); assert.equal(game.musicActive, false);
});
test('real host exposes lobby page two and native touch, background, resume and isolated saves', () => {
  const storage = new Map([['unrelated-save', { keep: true }]]), handlers = new Map(); let time = 100000;
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
    app.activate('hub:page', 1); assert.ok(app.targets.some(t => t.action === 'openGame' && t.payload === 'gomoku'));
    app.activate('openGame', 'gomoku'); assert.equal(app.screen, 'gomoku');
    const target = app.targets.find(t => t.action === action('cell') && t.payload === 112);
    assert.ok(target); handlers.get('TouchStart')({ changedTouches: [{ clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 }] });
    assert.equal(app.activeGame.model.round.moves.length, 1);
    handlers.get('Hide')(); time += 10000; handlers.get('Show')({}); app.tick();
    assert.equal(app.activeGame.model.round.moves.length, 1); assert.equal(app.activeGame.model.paused, true);
    app.activate(action('resume')); time += AI_DELAY; app.tick(); assert.equal(app.activeGame.model.round.moves.length, 2);
    app.activate('home'); app.activate('openGame', 'gomoku'); assert.equal(app.activeGame.model.paused, true);
    assert.ok(storage.has(SAVE_KEY)); assert.deepEqual(storage.get('unrelated-save'), { keep: true });
  } finally { app.dispose(); }
});
