import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGame, SAVE_KEY, ANIMATION_MS } = require('../../微信小程序/src/games/game-2048/index.js');
const { newGame } = require('../../微信小程序/src/games/game-2048/engine.js');
const { validateGameModule } = require('../../微信小程序/src/app/game-contract.js');
const { createMiniGame } = require('../../微信小程序/src/app/host.js');
const { registry } = require('../../微信小程序/src/registry.js');

const ID = 'game-2048';
const MERGE_BOARD = [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const OVER_BOARD = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
const PHONE = { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } };

function savedRound(board = MERGE_BOARD, overrides = {}, best = 0) {
  return { version: 1, best, round: { ...newGame(12345), board: [...board], ...overrides } };
}

function create(saved = null, extra = {}) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []), writes = [], modals = [], toasts = [];
  let time = 123456789;
  const game = createGame({
    read: key => structuredClone(storage.get(key)),
    write: (key, value) => { writes.push(key); storage.set(key, structuredClone(value)); return true; },
    now: () => time,
    services: { modal: (config, confirm) => { modals.push({ config, confirm }); return true; },
      toast: text => toasts.push(text), invalidate() {}, storageAvailable: true },
    ...extra,
  });
  game.resize(PHONE);
  return { game, storage, writes, modals, toasts, advance(ms) { time += ms; } };
}

function ready(saved = savedRound()) {
  const mock = create(saved);
  assert.equal(mock.game.activate(`${ID}:resume`), true);
  return mock;
}

function point(game, dx = 0, dy = 0, identifier = 1) {
  const board = game.layout.board;
  return { identifier, clientX: board.x + board.w / 2 + dx, clientY: board.y + board.h / 2 + dy };
}

function swipe(game, dx, dy) {
  game.pointer('start', [point(game)]);
  game.pointer('move', [point(game, dx / 2, dy / 2)]);
  return game.pointer('end', [point(game, dx, dy)]);
}

function context() {
  const gradient = { addColorStop() {} };
  return new Proxy({ measureText: value => ({ width: String(value).length * 7 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient },
  { get: (object, key) => key in object ? object[key] : () => {} });
}

function host({ saved, query = {} } = {}) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []), handlers = new Map();
  const viewport = { windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { top: 44, bottom: 810 } };
  let time = 123456789;
  const platform = {
    createCanvas: () => ({ getContext: () => context() }), getWindowInfo: () => viewport,
    getMenuButtonBoundingClientRect: () => ({ bottom: 82, top: 50, left: 288, right: 380 }),
    getLaunchOptionsSync: () => ({ query }), getStorageSync: key => structuredClone(storage.get(key)),
    setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    showShareMenu() {}, shareAppMessage() {},
  };
  for (const event of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage']) {
    const callbacks = new Set(); handlers.set(event, callbacks);
    platform[`on${event}`] = callback => callbacks.add(callback);
    platform[`off${event}`] = callback => callbacks.delete(callback);
  }
  const app = createMiniGame(platform, { autoTick: false, now: () => time });
  return { app, storage, viewport,
    advance(ms) { time += ms; app.tick(); },
    emit(event, payload = {}) { for (const callback of handlers.get(event)) callback(payload); },
  };
}

test('2048 uses the common game contract, namespaced save and fourth lobby entry', () => {
  const { game } = create();
  assert.equal(validateGameModule(game, ID), game);
  assert.equal(game.id, ID); assert.equal(SAVE_KEY, 'games-between:game-2048:save:v1');
  assert.equal(registry.get(ID).status, 'ready'); assert.equal(registry.resolve({ g: ID }).id, ID);
  assert.equal(game.model.round.board.filter(Boolean).length, 2);
  assert.equal(game.model.round.score, 0); assert.equal(game.model.round.moves, 0);
  assert.equal(game.model.paused, false); assert.equal(game.model.status, 'playing');
  const mock = host();
  try {
    assert.equal(mock.app.activate('hub:page', 1), true);
    assert.ok(mock.app.targets.some(target => target.action === 'openGame' && target.payload === ID));
    assert.equal(mock.app.activate('openGame', ID), true);
    assert.equal(mock.app.screen, ID); assert.equal(mock.app.activeGame.id, ID);
    assert.equal(mock.app.activate('home'), true);
  } finally { mock.app.dispose(); }
});

test('2048 valid moves save the completed board and best; cold restoration waits for resume', () => {
  const { game, storage, writes } = ready();
  assert.equal(game.activate(`${ID}:move`, 'left'), true);
  const snapshot = structuredClone(game.model.round);
  assert.equal(snapshot.score, 4); assert.equal(snapshot.moves, 1); assert.equal(game.model.best, 4);
  assert.equal(writes.length, 1); assert.ok(writes.every(key => key === SAVE_KEY));
  assert.deepEqual(storage.get(SAVE_KEY), { version: 1, round: snapshot, best: 4 });
  const loaded = create(storage.get(SAVE_KEY)).game;
  assert.equal(loaded.model.paused, true); assert.equal(loaded.model.animation, null);
  assert.deepEqual(loaded.model.round, snapshot);
  assert.equal(loaded.activate(`${ID}:move`, 'down'), false);
  assert.equal(loaded.activate(`${ID}:resume`), true);
  game.tick(ANIMATION_MS);
  for (const direction of ['down', 'right', 'up', 'left']) {
    assert.equal(loaded.activate(`${ID}:move`, direction), game.activate(`${ID}:move`, direction));
    assert.deepEqual(loaded.model.round, game.model.round, 'Restoration preserves the next random spawn');
    loaded.tick(ANIMATION_MS); game.tick(ANIMATION_MS);
  }
});

test('2048 invalid directions and blocked moves neither save nor advance random state', () => {
  const board = [2, 4, 0, 0, ...Array(12).fill(0)], { game, writes } = ready(savedRound(board));
  const before = structuredClone(game.model.round);
  for (const direction of ['left', 'north', '', null, {}, undefined]) assert.equal(game.activate(`${ID}:move`, direction), false);
  assert.equal(game.activate('another-game:move', 'down'), false);
  assert.deepEqual(game.model.round, before); assert.equal(writes.length, 0); assert.equal(game.model.animation, null);
});

test('2048 animation blocks rapid repeat input and releases only after its duration', () => {
  const { game } = ready();
  assert.equal(game.activate(`${ID}:move`, 'left'), true);
  const completed = structuredClone(game.model.round);
  assert.equal(game.activate(`${ID}:move`, 'down'), false);
  assert.equal(game.pointer('start', [point(game)]), false);
  for (const invalid of [-1, NaN, Infinity]) game.tick(invalid);
  assert.equal(game.model.animation.elapsed, 0);
  game.tick(ANIMATION_MS - 1); assert.ok(game.model.animation);
  assert.equal(game.activate(`${ID}:move`, 'down'), false); assert.deepEqual(game.model.round, completed);
  game.tick(1); assert.equal(game.model.animation, null);
  assert.equal(game.activate(`${ID}:move`, 'down'), true);
});

test('2048 pause, resize and re-entry clear unfinished swipe gestures', () => {
  for (const interrupt of [
    game => { game.pause('background'); game.activate(`${ID}:resume`); },
    game => game.resize({ width: 844, height: 390, safeTop: 0, safeBottom: 21 }),
    game => game.enter({ g: ID }, { source: 'show' }),
    game => game.pointer('cancel', []),
  ]) {
    const { game } = ready(); game.pointer('start', [point(game)]);
    const before = structuredClone(game.model.round); interrupt(game);
    assert.equal(game.pointer('end', [point(game, -50, 0)]), false);
    assert.deepEqual(game.model.round, before);
  }
  const { game } = ready(); game.activate(`${ID}:move`, 'left'); game.pause('home');
  const before = structuredClone(game.model.round); game.tick(10000);
  assert.equal(game.model.paused, true); assert.equal(game.model.animation, null);
  assert.deepEqual(game.model.round, before); assert.equal(game.activate(`${ID}:move`, 'down'), false);
});

test('2048 swipes require a board origin, 18 pixels and a clear primary axis', () => {
  for (const [dx, dy] of [[-17, 0], [-30, 29], [-24, 21]]) {
    const { game } = ready(); assert.equal(swipe(game, dx, dy), false); assert.equal(game.model.round.moves, 0);
  }
  const { game } = ready();
  assert.equal(game.pointer('start', [{ identifier: 1, clientX: -1, clientY: -1 }]), false);
  assert.equal(game.pointer('end', [point(game, -80, 0)]), false);
  assert.equal(swipe(game, -18, 0), true); assert.equal(game.model.round.moves, 1);
  assert.equal(game.pointer('end', [point(game, -90, 0)]), false);
  game.tick(ANIMATION_MS);
  assert.equal(game.pointer('end', [point(game, -90, 0)]), false); assert.equal(game.model.round.moves, 1);
});

test('2048 accepts all four directions and both normalized and raw coordinate formats', () => {
  for (const [direction, dx, dy] of [['left', -40, 0], ['right', 40, 0], ['up', 0, -40], ['down', 0, 40]]) {
    const board = Array(16).fill(0); board[5] = 2; board[10] = 4;
    const first = ready(savedRound(board)).game, second = ready(savedRound(board)).game;
    assert.equal(first.activate(`${ID}:move`, direction), true);
    const start = point(second), end = point(second, dx, dy);
    assert.equal(second.pointer('start', [{ id: 7, x: start.clientX, y: start.clientY }]), true);
    assert.equal(second.pointer('end', [{ id: 7, x: end.clientX, y: end.clientY }]), true);
    assert.deepEqual(second.model.round, first.model.round);
  }
});

test('2048 cancels simultaneous and sequential multi-touch and mismatched fingers', () => {
  const { game } = ready();
  assert.equal(game.pointer('start', [point(game), point(game, 10, 0, 2)]), false);
  assert.equal(game.pointer('end', [point(game, -50, 0)]), false);
  game.pointer('end', [point(game, -50, 0, 2)]);
  assert.equal(game.pointer('start', [point(game)]), true);
  assert.equal(game.pointer('start', [point(game, 0, 0, 2)]), false, 'The host sends each start separately');
  assert.equal(game.pointer('end', [point(game, -50, 0)]), false);
  game.pointer('end', [point(game, -50, 0, 2)]);
  game.pointer('start', [point(game)]);
  game.pointer('move', [point(game), point(game, 0, 0, 2)]);
  assert.equal(game.pointer('end', [point(game, -50, 0)]), false);
  game.pointer('cancel', []);
  game.pointer('start', [point(game)]);
  assert.equal(game.pointer('end', [point(game, -50, 0, 2)]), false);
  assert.equal(game.model.round.moves, 0);
});

test('2048 new-game confirmation preserves progress until accepted and keeps the best', () => {
  const { game, modals, storage } = ready(savedRound(MERGE_BOARD, { moves: 7, score: 40 }, 100));
  const before = structuredClone(game.model.round);
  assert.equal(game.activate(`${ID}:new`), true); assert.equal(modals.length, 1);
  assert.equal(game.model.paused, true); assert.deepEqual(game.model.round, before);
  assert.match(modals[0].config.content, /最佳成绩/);
  assert.equal(game.activate(`${ID}:resume`), true);
  modals[0].confirm(); assert.deepEqual(game.model.round, before, 'An obsolete confirmation cannot reset a resumed round');
  game.activate(`${ID}:new`); modals[1].confirm();
  assert.equal(game.model.round.moves, 0); assert.equal(game.model.round.score, 0);
  assert.equal(game.model.round.board.filter(Boolean).length, 2); assert.equal(game.model.best, 100);
  assert.equal(game.model.paused, false); assert.equal(storage.get(SAVE_KEY).best, 100);
});

test('2048 delayed new-game confirmations cannot reset a game after navigation or disposal', () => {
  for (const interrupt of [game => game.pause('home'), game => game.enter({}, { source: 'hub' }), game => game.dispose()]) {
    const { game, modals } = ready(savedRound(MERGE_BOARD, { moves: 1 }));
    game.activate(`${ID}:new`); const before = structuredClone(game.model.round);
    interrupt(game); modals[0].confirm(); assert.deepEqual(game.model.round, before);
  }
});

test('2048 win appears once, allows continuation, and survives restore without repeated awards', () => {
  const board = [1024, 1024, ...Array(14).fill(0)], { game, storage } = ready(savedRound(board));
  assert.equal(game.activate(`${ID}:move`, 'left'), true);
  assert.equal(game.model.status, 'won'); assert.equal(game.model.round.won, true);
  assert.equal(game.model.round.score, 2048); assert.equal(game.model.best, 2048);
  assert.equal(game.activate(`${ID}:move`, 'down'), false);
  const restored = create(storage.get(SAVE_KEY)).game;
  assert.equal(restored.model.status, 'won'); assert.equal(restored.model.round.score, 2048);
  assert.equal(restored.activate(`${ID}:continue`), true); assert.equal(restored.model.status, 'playing');
  assert.equal(restored.model.round.keepPlaying, true); assert.equal(restored.model.paused, false);
  assert.equal(restored.activate(`${ID}:continue`), false);
  assert.equal(restored.activate(`${ID}:move`, 'down'), true); assert.equal(restored.model.round.score, 2048);
});

test('2048 an immovable full board ends, rejects moves and restarts without a destructive prompt', () => {
  const { game, modals } = create(savedRound(OVER_BOARD, { score: 400, moves: 100 }, 700));
  assert.equal(game.model.status, 'over');
  for (const direction of ['up', 'down', 'left', 'right']) assert.equal(game.activate(`${ID}:move`, direction), false);
  assert.equal(game.activate(`${ID}:resume`), false);
  assert.equal(game.activate(`${ID}:new`), true); assert.equal(modals.length, 0);
  assert.equal(game.model.status, 'playing'); assert.equal(game.model.paused, false);
  assert.equal(game.model.best, 700); assert.equal(game.model.round.score, 0);
});

test('2048 ignores malformed rounds while preserving an independently valid local best', () => {
  for (const mutate of [
    round => { round.board = Array(15).fill(0); }, round => { round.board = Array(16).fill(0); },
    round => { round.board = [2, ...Array(15).fill(0)]; }, round => { round.board[0] = 3; },
    round => { round.board[0] = -2; }, round => { round.board[0] = Infinity; },
    round => { round.score = NaN; }, round => { round.moves = -1; },
    round => { round.rngState = 'injected'; }, round => { round.won = 'yes'; },
  ]) {
    const saved = savedRound(MERGE_BOARD, {}, 512); mutate(saved.round);
    const { game } = create(saved);
    assert.equal(game.model.round.score, 0); assert.equal(game.model.round.moves, 0);
    assert.equal(game.model.round.board.filter(Boolean).length, 2); assert.equal(game.model.paused, false);
    assert.equal(game.model.best, 512);
  }
  for (const best of [-1, NaN, Infinity, '100', Number.MAX_SAFE_INTEGER + 1]) assert.equal(create({ version: 1, best, round: null }).game.model.best, 0);
});

test('2048 storage failures do not break play, pause, help or rendering', () => {
  const game = createGame({ read() { throw new Error('denied'); }, write() { throw new Error('full'); }, now: () => 12 });
  assert.equal(game.save(), false); assert.doesNotThrow(() => game.pause('background'));
  assert.equal(game.activate(`${ID}:resume`), true);
  assert.ok(['left', 'right', 'up', 'down'].some(direction => game.activate(`${ID}:move`, direction)));
  assert.doesNotThrow(() => game.render(context()));
  assert.equal(game.activate(`${ID}:help`), true); assert.equal(game.model.paused, true);
  const before = structuredClone(game.model.round); game.tick(100000); assert.deepEqual(game.model.round, before);
});

test('2048 renders touch controls inside the safe area in portrait and landscape states', () => {
  for (const viewport of [PHONE,
    { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
    { width: 667, height: 375, safeTop: 0, safeBottom: 0, capsuleRect: { bottom: 32 } },
    { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  ]) {
    for (const saved of [null, savedRound(), savedRound([2048, 2, ...Array(14).fill(0)], { won: true }), savedRound(OVER_BOARD)]) {
      const { game } = create(saved); game.resize(viewport);
      const targets = game.render(context()), safeTop = Math.max(viewport.safeTop, viewport.capsuleRect.bottom);
      assert.ok(targets.some(target => target.action === 'home'));
      assert.ok(targets.some(target => target.action === 'share'));
      const board = game.layout.board;
      assert.ok(board.w > 0 && board.h > 0); assert.equal(board.w, board.h);
      for (const target of targets) {
        assert.equal(typeof target.label, 'string');
        assert.ok(target.w > 0 && target.h > 0);
        assert.ok(target.x >= 0 && target.y >= safeTop, JSON.stringify({ viewport, target }));
        assert.ok(target.x + target.w <= viewport.width + 1e-6 && target.y + target.h <= viewport.height - viewport.safeBottom + 1e-6,
          JSON.stringify({ viewport, target }));
      }
    }
  }
});

test('2048 real host normalizes swipes, cancels a second start, and preserves a share return', () => {
  const mock = host({ query: { g: ID }, saved: savedRound() });
  try {
    assert.equal(mock.app.screen, ID); const game = mock.app.activeGame;
    assert.equal(mock.app.activate(`${ID}:resume`), true);
    const first = point(game), second = point(game, 12, 0, 2), end = point(game, -50, 0);
    mock.emit('TouchStart', { changedTouches: [first, second], touches: [first, second] });
    mock.emit('TouchEnd', { changedTouches: [end, second], touches: [] });
    assert.equal(game.model.round.moves, 0);
    mock.emit('TouchStart', { changedTouches: [first], touches: [first] });
    mock.emit('TouchEnd', { changedTouches: [end], touches: [] });
    assert.equal(game.model.round.moves, 1);
    const before = structuredClone(game.model.round), share = mock.app.sharePayload();
    assert.equal(new URLSearchParams(share.query).get('g'), ID);
    assert.equal(share.query.includes('score='), false);
    mock.emit('Hide'); assert.equal(game.model.paused, true);
    mock.emit('Show', { query: { g: ID, score: '99999', best: '99999' } });
    assert.equal(mock.app.activeGame, game); assert.equal(game.model.paused, true);
    assert.deepEqual(game.model.round, before); assert.equal(game.model.best, before.score);
    assert.equal(mock.app.activate('home'), true); assert.equal(mock.app.activate('resumeGame', ID), true);
    assert.equal(game.model.paused, true); assert.deepEqual(game.model.round, before);
  } finally { mock.app.dispose(); }
});

test('2048 real host lifecycle changes cannot turn an old touch into a move', () => {
  for (const lifecycle of ['background', 'resize', 'home']) {
    const mock = host({ query: { g: ID }, saved: savedRound() });
    try {
      const game = mock.app.activeGame; mock.app.activate(`${ID}:resume`);
      const start = point(game), end = point(game, -60, 0);
      mock.emit('TouchStart', { changedTouches: [start] });
      if (lifecycle === 'background') { mock.emit('Hide'); mock.emit('Show'); }
      if (lifecycle === 'resize') { mock.viewport.windowWidth = 844; mock.viewport.windowHeight = 390; mock.viewport.safeArea = { top: 0, bottom: 369 }; mock.emit('WindowResize'); }
      if (lifecycle === 'home') { mock.app.activate('home'); mock.app.activate('resumeGame', ID); }
      assert.equal(game.model.paused, true); mock.app.activate(`${ID}:resume`);
      mock.emit('TouchEnd', { changedTouches: [end] }); assert.equal(game.model.round.moves, 0);
    } finally { mock.app.dispose(); }
  }
});
