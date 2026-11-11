import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMiniGame } = require('../../微信小程序/src/main.js');

function mockPlatform({ query = {}, storageErrors = false, initialStorage = [] } = {}) {
  const handlers = new Map();
  const storage = new Map(initialStorage);
  const writes = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: text => ({ width: String(text).length * 9 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  }, {
    get(object, key) {
      if (key in object) return object[key];
      return () => {};
    },
  });
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    createImage: () => ({}),
    toTempFilePathSync: () => 'mock://share.png',
  };
  const info = {
    windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844,
    pixelRatio: 2, statusBarHeight: 44,
    safeArea: { left: 0, right: 390, top: 44, bottom: 810, width: 390, height: 766 },
  };
  const platform = {
    createCanvas: () => canvas,
    getSystemInfoSync: () => ({ ...info }),
    getWindowInfo: () => ({ ...info }),
    getLaunchOptionsSync: () => ({ query }),
    getMenuButtonBoundingClientRect: () => ({ left: 288, right: 380, top: 50, bottom: 82, width: 92, height: 32 }),
    getStorageSync(key) {
      if (storageErrors) throw new Error('Storage unavailable');
      return storage.has(key) ? structuredClone(storage.get(key)) : '';
    },
    setStorageSync(key, value) {
      if (storageErrors) throw new Error('Storage full');
      const copied = structuredClone(value);
      storage.set(key, copied);
      writes.push({ key, value: copied });
    },
    removeStorageSync(key) { storage.delete(key); },
    showShareMenu() {},
    shareAppMessage() {},
    showToast() {},
    vibrateShort() {},
    setKeepScreenOn() {},
    showModal(options) {
      if (options.success) options.success({ confirm: true, cancel: false });
    },
    showActionSheet(options) {
      assert.ok(Array.isArray(options.itemList) && options.itemList.length <= 6, 'native action sheets accept at most six entries');
      if (options.success) options.success({ tapIndex: 0 });
    },
  };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage']) {
    platform[`on${name}`] = callback => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(callback);
    };
    platform[`off${name}`] = callback => handlers.get(name)?.delete(callback);
  }
  const emit = (name, payload = {}) => {
    for (const callback of handlers.get(name) || []) callback(payload);
  };
  return { platform, canvas, context, storage, writes, handlers, emit };
}

function create(options = {}) {
  const mock = mockPlatform(options);
  let currentTime = Date.parse('2026-10-17T16:00:00Z');
  const app = createMiniGame(mock.platform, { autoTick: false, now: () => currentTime });
  return { ...mock, app, advance: ms => { currentTime += ms; } };
}

function clickTarget(mock, target) {
  assert.ok(target, 'The expected interactive target is rendered');
  const point = { clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 };
  mock.emit('TouchStart', { touches: [point], changedTouches: [point] });
}

function parsedShare(app) {
  const payload = app.sharePayload();
  assert.equal(typeof payload.title, 'string');
  assert.ok(payload.title.length > 0);
  assert.equal(typeof payload.query, 'string');
  return new URLSearchParams(payload.query);
}

test('opening a shared lobby entry returns an existing game to the lobby without losing progress', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    mock.app.activate('sudoku:autoNotes');
    const before = sudoku.serialize();
    mock.emit('Hide');
    mock.advance(60000);
    mock.emit('Show', { query: { g: 'home' } });
    assert.equal(mock.app.screen, 'home');
    assert.equal(sudoku.elapsed, before.elapsed);
    assert.deepEqual(sudoku.notes, before.notes);
    mock.app.activate('resumeGame', 'sudoku');
    assert.equal(sudoku.seed, before.seed);
    assert.deepEqual(sudoku.board, before.board);
  } finally { mock.app.dispose(); }
});

test('mini-game opens on its home screen and only puzzle shares include a seed', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    assert.equal(mock.app.screen, 'home');
    assert.equal(parsedShare(mock.app).has('p'), false);
    assert.ok(mock.app.layout);
    assert.ok(Array.isArray(mock.app.targets));
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    assert.equal(mock.app.screen, 'sudoku');
    const query = parsedShare(mock.app);
    assert.equal(query.get('g'), 'sudoku');
    assert.equal(query.get('p'), sudoku.seed);
    assert.equal(query.get('d'), sudoku.difficulty);
    assert.equal(query.get('m'), sudoku.mode);
    const before = sudoku.serialize();
    mock.app.activate('home');
    assert.equal(mock.app.screen, 'home');
    assert.equal(parsedShare(mock.app).has('p'), false);
    mock.advance(3600000);
    mock.app.refresh();
    assert.equal(sudoku.elapsed, before.elapsed);
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    assert.equal(mock.app.screen, 'sudoku');
    assert.equal(sudoku.seed, before.seed);
    assert.deepEqual(sudoku.board, before.board);
  } finally { mock.app.dispose(); }
});

test('valid friend query opens the identical game directly', () => {
  const mock = create({ query: { g: 'sudoku', p: '朋友 & 数独 🧩', d: 'hard', m: 'daily' } });
  let sudoku = mock.app.activeGame?.model;
  try {
    assert.equal(mock.app.screen, 'sudoku');
    assert.equal(sudoku.seed, '朋友 & 数独 🧩');
    assert.equal(sudoku.difficulty, 'hard');
    assert.equal(sudoku.mode, 'daily');
    assert.equal(parsedShare(mock.app).get('p'), sudoku.seed);
  } finally { mock.app.dispose(); }
});

test('malformed external puzzle parameters are ignored without breaking startup', () => {
  for (const seed of ['', 'x'.repeat(81), 'bad\nseed', '\ud800', {}, 42]) {
    const mock = create({ query: { g: 'sudoku', p: seed, d: 'unknown', m: 'unknown' } });
    let sudoku = mock.app.activeGame?.model;
    try {
      assert.equal(typeof sudoku.seed, 'string');
      assert.ok(sudoku.seed.length > 0 && sudoku.seed.length <= 80);
      assert.notEqual(sudoku.seed, seed);
      assert.ok(['easy', 'medium', 'hard', 'expert'].includes(sudoku.difficulty));
      assert.ok(['classic', 'daily'].includes(sudoku.mode));
      assert.doesNotThrow(() => mock.app.sharePayload());
      assert.doesNotThrow(() => mock.app.refresh());
    } finally { mock.app.dispose(); }
  }
});

test('touch targets open sudoku, select a cell, enter a digit and return home', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    clickTarget(mock, mock.app.targets.find(target => target.action === 'openGame' && target.payload === 'sudoku'));
    sudoku = mock.app.activeGame.model;
    assert.equal(mock.app.screen, 'sudoku');
    const index = sudoku.puzzle.indexOf(0);
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:select' && target.payload === index));
    assert.equal(sudoku.selected, index);
    const digit = sudoku.solution[index];
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:digit' && target.payload === digit));
    assert.equal(sudoku.board[index], digit);
    clickTarget(mock, mock.app.targets.find(target => target.action === 'home'));
    assert.equal(mock.app.screen, 'home');
    const state = sudoku.serialize();
    assert.doesNotThrow(() => mock.emit('TouchStart', { touches: [] }));
    assert.doesNotThrow(() => mock.emit('TouchStart', { touches: [{ clientX: -20, clientY: -20 }] }));
    assert.deepEqual(sudoku.serialize(), state);
  } finally { mock.app.dispose(); }
});

test('background saves progress; returning foreground preserves a manual pause', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    const index = sudoku.puzzle.indexOf(0);
    mock.app.activate('sudoku:select', index);
    mock.app.activate('sudoku:digit', sudoku.solution[index]);
    mock.app.activate('sudoku:pause');
    assert.equal(sudoku.paused, true);
    const before = sudoku.serialize();
    const writeCount = mock.writes.length;
    mock.emit('Hide');
    assert.ok(mock.writes.length > writeCount, 'Backgrounding persists the current progress');
    mock.advance(7200000);
    mock.emit('Show', { query: {} });
    assert.equal(sudoku.paused, true);
    assert.equal(sudoku.elapsed, before.elapsed);
    assert.deepEqual(sudoku.board, before.board);
    assert.equal(sudoku.roundId, before.roundId);
    assert.doesNotThrow(() => mock.emit('WindowResize', { windowWidth: 844, windowHeight: 390 }));
  } finally { mock.app.dispose(); }
});

test('a fresh platform instance restores the saved round from local storage', () => {
  const first = create();
  let second;
  try {
    first.app.activate('openGame', 'sudoku');
    first.app.activeGame.model.fillAllNotes();
    first.app.activeGame.model.hint();
    first.app.activeGame.model.tick(1234);
    first.emit('Hide');
    const saved = first.app.activeGame.model.serialize();
    second = create({ initialStorage: [...first.storage] });
    second.app.activate('openGame', 'sudoku');
    assert.equal(second.app.activeGame.model.seed, saved.seed);
    assert.equal(second.app.activeGame.model.roundId, saved.roundId);
    assert.equal(second.app.activeGame.model.hints, saved.hints);
    assert.equal(second.app.activeGame.model.elapsed, saved.elapsed);
    assert.deepEqual(second.app.activeGame.model.board, saved.board);
    assert.deepEqual(second.app.activeGame.model.notes, saved.notes);
  } finally {
    first.app.dispose();
    second?.app.dispose();
  }
});

test('storage read/write failures do not prevent play, sharing or lifecycle handling', () => {
  const mock = create({ storageErrors: true });
  let sudoku = mock.app.activeGame?.model;
  try {
    assert.doesNotThrow(() => mock.app.activate('openGame', 'sudoku'));
    sudoku = mock.app.activeGame.model;
    const index = sudoku.puzzle.indexOf(0);
    assert.doesNotThrow(() => mock.app.activate('sudoku:select', index));
    assert.doesNotThrow(() => mock.app.activate('sudoku:digit', sudoku.solution[index]));
    assert.equal(sudoku.board[index], sudoku.solution[index]);
    assert.doesNotThrow(() => mock.emit('Hide'));
    assert.doesNotThrow(() => mock.emit('Show', { query: {} }));
    assert.doesNotThrow(() => mock.app.sharePayload());
    assert.doesNotThrow(() => mock.app.activate('home'));
  } finally { assert.doesNotThrow(() => mock.app.dispose()); }
});

test('only foreground play contributes time across home navigation and background transitions', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    mock.advance(10000);
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    assert.equal(sudoku.elapsed, 0);
    mock.advance(1500);
    mock.app.activate('sudoku:select', sudoku.selected);
    assert.equal(sudoku.elapsed, 1500);
    mock.advance(500);
    mock.app.activate('home');
    assert.equal(sudoku.elapsed, 2000);
    mock.advance(60000);
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    assert.equal(sudoku.elapsed, 2000);
    assert.equal(sudoku.paused, true);
    mock.app.activate('sudoku:pause');
    mock.advance(1000);
    mock.emit('Hide');
    assert.equal(sudoku.elapsed, 3000);
    mock.advance(3600000);
    mock.emit('Show', { query: {} });
    assert.equal(sudoku.elapsed, 3000);
    assert.equal(sudoku.paused, true);
    mock.app.activate('sudoku:pause');
    mock.advance(1000);
    mock.app.activate('sudoku:select', sudoku.selected);
    assert.equal(sudoku.elapsed, 4000);
  } finally { mock.app.dispose(); }
});

test('native confirmation pauses the clock and cancellation keeps the current puzzle', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  const modals = [];
  mock.platform.showModal = config => { modals.push(config); };
  try {
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    sudoku.hint();
    const original = sudoku.serialize();
    mock.advance(1000);
    mock.app.activate('sudoku:difficulty', 'medium');
    assert.equal(modals.length, 1);
    assert.equal(sudoku.elapsed, 1000);
    mock.advance(30000);
    assert.equal(mock.app.activate('sudoku:digit', 1), false);
    modals[0].success({ confirm: false, cancel: true });
    modals[0].complete();
    assert.equal(sudoku.difficulty, original.difficulty);
    assert.equal(sudoku.seed, original.seed);
    assert.deepEqual(sudoku.board, original.board);
    mock.advance(500);
    mock.app.activate('sudoku:select', sudoku.selected);
    assert.equal(sudoku.elapsed, 1500);
    mock.app.activate('sudoku:difficulty', 'medium');
    assert.equal(modals.length, 2);
    mock.advance(5000);
    modals[1].success({ confirm: true, cancel: false });
    modals[1].complete();
    assert.equal(sudoku.difficulty, 'medium');
    assert.equal(sudoku.elapsed, 0);
    assert.equal(sudoku.hints, 0);
    assert.notEqual(sudoku.roundId, original.roundId);
  } finally { mock.app.dispose(); }
});

test('native share callback follows the active screen and dispose removes event handlers', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  const shares = [];
  mock.platform.shareAppMessage = payload => { shares.push(payload); };
  const callback = [...mock.handlers.get('ShareAppMessage')][0];
  assert.equal(typeof callback, 'function');
  assert.equal(new URLSearchParams(callback().query).has('p'), false);
  mock.app.activate('openGame', 'sudoku');
  sudoku = mock.app.activeGame.model;
  assert.equal(new URLSearchParams(callback().query).get('p'), sudoku.seed);
  mock.app.activate('share');
  assert.deepEqual(shares.at(-1), callback());
  mock.app.activate('home');
  assert.equal(new URLSearchParams(callback().query).has('p'), false);
  mock.app.dispose();
  for (const callbacks of mock.handlers.values()) assert.equal(callbacks.size, 0);
  assert.equal(mock.app.activate('openGame', 'sudoku'), false);
  assert.doesNotThrow(() => mock.app.dispose());
});

test('gold-miner and zuma lobby entries open playable games and leave the saved sudoku round untouched', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    mock.app.activate('sudoku:hint');
    mock.app.activate('sudoku:autoNotes');
    mock.app.activate('home');
    const before = sudoku.serialize();
    for (const id of ['gold-miner', 'zuma']) {
      clickTarget(mock, mock.app.targets.find(target => target.action === 'openGame' && target.payload === id));
      assert.equal(mock.app.screen, id);
      assert.ok(mock.app.activeGame);
      assert.equal(typeof mock.app.activeGame.tick, 'function');
      assert.deepEqual(sudoku.serialize(), before);
      clickTarget(mock, mock.app.targets.find(target => target.action === 'home'));
      assert.equal(mock.app.screen, 'home');
      assert.equal(mock.app.activeGame, null);
      assert.deepEqual(sudoku.serialize(), before);
    }
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    assert.equal(mock.app.screen, 'sudoku');
    assert.deepEqual(sudoku.serialize(), before);
  } finally { mock.app.dispose(); }
});

test('arcade friend shares launch the matching game and do not inherit puzzle share parameters', () => {
  for (const id of ['zuma', 'gold-miner']) {
    const mock = create({ query: { g: id, p: 'ignored-puzzle-seed', d: 'expert', m: 'daily' } });
    try {
      assert.equal(mock.app.screen, id);
      assert.ok(mock.app.activeGame);
      const query = parsedShare(mock.app);
      assert.equal(query.get('g'), id);
      for (const key of ['p', 'd']) assert.equal(query.has(key), false);
      if (id === 'zuma') { assert.equal(query.get('m'), 'campaign'); assert.equal(query.get('l'), '1'); assert.equal(query.get('difficulty'), 'normal'); }
      else assert.equal(query.has('m'), false);
      assert.equal(Object.hasOwn(mock.app, 'game'), false);
      mock.emit('Show', { query: { g: id === 'zuma' ? 'gold-miner' : 'zuma' } });
      assert.equal(mock.app.screen, id === 'zuma' ? 'gold-miner' : 'zuma');
      assert.equal(parsedShare(mock.app).get('g'), mock.app.screen);
    } finally { mock.app.dispose(); }
  }
});

test('Zuma difficulty menu touch and shared difficulty preserve the matching saved profile', () => {
  const mock = create({ query: { g: 'zuma', m: 'endless', difficulty: 'hell' } });
  let copiedStorage;
  try {
    const game = mock.app.activeGame;
    assert.equal(game.mode, 'endless'); assert.equal(game.difficulty, 'hell');
    assert.equal(parsedShare(mock.app).get('difficulty'), 'hell');
    clickTarget(mock, mock.app.targets.find(target => target.action === 'zuma:difficulty' && target.payload === 'easy'));
    assert.equal(game.difficulty, 'easy');
    clickTarget(mock, mock.app.targets.find(target => target.action === 'zuma:new-endless'));
    assert.equal(game.model.status, 'playing');
    assert.equal(game.model.totalBalls, 62); assert.equal(game.model.speed, 27 * 1.6);
    mock.advance(40); mock.app.tick(); game.model.score = 30;
    mock.emit('Hide'); assert.equal(game.model.status, 'paused');
    copiedStorage = [...mock.storage].map(([key, value]) => [key, structuredClone(value)]);
  } finally { mock.app.dispose(); }
  const restored = create({ initialStorage: copiedStorage });
  try {
    restored.app.activate('openGame', 'zuma');
    assert.equal(restored.app.activeGame.difficulty, 'easy'); assert.equal(restored.app.activeGame.mode, 'endless');
    assert.equal(restored.app.activeGame.model.status, 'paused'); assert.equal(restored.app.activeGame.model.score, 30);
    assert.equal(parsedShare(restored.app).get('difficulty'), 'easy');
  } finally { restored.app.dispose(); }
});

test('both arcade share buttons and native share callbacks pause and save the active round', () => {
  for (const id of ['zuma', 'gold-miner']) {
    for (const method of ['button', 'native-menu']) {
      const mock = create({ query: { g: id } });
      let sent;
      mock.platform.shareAppMessage = payload => { sent = payload; };
      try {
        const arcade = mock.app.activeGame;
        if (id === 'zuma') mock.app.activate('zuma:start');
        else { mock.app.activate('miner:new'); mock.app.activate('miner:play'); }
        mock.advance(100);
        mock.app.tick();
        const writesBefore = mock.writes.length;
        if (method === 'button') clickTarget(mock, mock.app.targets.find(target => target.action === 'share'));
        else sent = [...mock.handlers.get('ShareAppMessage')][0]();
        assert.equal(new URLSearchParams(sent.query).get('g'), id);
        assert.ok(mock.writes.length > writesBefore, 'Sharing persists the round before handing control to WeChat');
        assert.equal(id === 'zuma' ? arcade.model.status : arcade.model.scene, 'paused');
        const before = id === 'zuma' ? arcade.model.elapsed : arcade.model.engine.timeLeft;
        mock.advance(60000);
        mock.app.tick();
        assert.equal(id === 'zuma' ? arcade.model.elapsed : arcade.model.engine.timeLeft, before);
      } finally { mock.app.dispose(); }
    }
  }
});

test('Zuma swap touch swaps exactly once and stays available while paused', () => {
  const mock = create({ query: { g: 'zuma' } });
  try {
    mock.app.activate('zuma:start'); const game = mock.app.activeGame;
    game.model.currentColor = 0; game.model.nextColor = 1; mock.app.refresh();
    const target = mock.app.targets.find(item => item.action === 'zuma:swap');
    assert.ok(target); assert.ok(target.h >= 44);
    const point = { identifier: 7, clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 };
    mock.emit('TouchStart', { touches: [point], changedTouches: [point] });
    mock.emit('TouchEnd', { touches: [], changedTouches: [point] });
    assert.equal(game.model.currentColor, 1); assert.equal(game.model.nextColor, 0); assert.equal(game.model.projectiles.length, 0);
    mock.app.activate('zuma:pause');
    const pausedTarget = mock.app.targets.find(item => item.action === 'zuma:swap');
    assert.ok(pausedTarget, 'Paused round retains a usable swap target outside the pause panel');
    clickTarget(mock, pausedTarget);
    assert.equal(game.model.currentColor, 0); assert.equal(game.model.nextColor, 1); assert.equal(game.model.status, 'paused');
  } finally { mock.app.dispose(); }
});

test('unrecognized game IDs including object prototype names are ignored at startup and foreground entry', () => {
  for (const id of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'unknown', '']) {
    const mock = create({ query: { g: id } });
    try {
      assert.equal(mock.app.screen, 'home');
      assert.equal(mock.app.activeGame, null);
      assert.equal(parsedShare(mock.app).get('g'), 'home');
      assert.equal(mock.app.activate('openGame', id), false);
      assert.equal(mock.app.activate('resumeGame', id), false);
      mock.emit('Show', { query: { g: id } });
      assert.equal(mock.app.screen, 'home');
      mock.app.activate('openGame', 'zuma');
      const active = mock.app.activeGame;
      mock.emit('Show', { query: { g: id } });
      assert.equal(mock.app.screen, 'zuma');
      assert.equal(mock.app.activeGame, active);
    } finally { mock.app.dispose(); }
  }
});

test('an arcade game freezes when visiting the lobby or leaving the foreground', () => {
  const mock = create({ query: { g: 'zuma' } });
  try {
    const arcade = mock.app.activeGame;
    assert.equal(mock.app.activate('zuma:start'), true);
    mock.advance(100);
    mock.app.tick();
    assert.ok(arcade.model.elapsed > 0);
    mock.app.activate('home');
    const elapsed = arcade.model.elapsed;
    assert.equal(arcade.model.status, 'paused');
    mock.advance(3600000);
    mock.app.tick();
    assert.equal(arcade.model.elapsed, elapsed);
    mock.app.activate('openGame', 'zuma');
    assert.equal(mock.app.activeGame, arcade, 'Navigating back resumes the same in-memory round');
    assert.equal(arcade.model.elapsed, elapsed);
    assert.equal(arcade.model.status, 'paused');
    mock.app.activate('zuma:resume');
    mock.advance(100);
    mock.app.tick();
    assert.ok(arcade.model.elapsed > elapsed);
    mock.emit('Hide');
    const beforeBackground = arcade.model.elapsed;
    assert.equal(arcade.model.status, 'paused');
    mock.advance(7200000);
    mock.app.tick();
    assert.equal(arcade.model.elapsed, beforeBackground);
    assert.equal(mock.app.activate('zuma:resume'), false);
    mock.emit('Show', { query: {} });
    mock.app.tick();
    assert.equal(arcade.model.elapsed, beforeBackground);
    assert.equal(arcade.model.status, 'paused');
  } finally { mock.app.dispose(); }
});

test('gold-miner keeps the current round frozen across lobby and background navigation', () => {
  const mock = create({ query: { g: 'gold-miner' } });
  try {
    const arcade = mock.app.activeGame;
    assert.equal(mock.app.activate('miner:new'), true);
    assert.equal(mock.app.activate('miner:play'), true);
    mock.advance(100);
    mock.app.tick();
    assert.ok(arcade.model.engine.timeLeft < 60);
    mock.app.activate('home');
    const remaining = arcade.model.engine.timeLeft;
    mock.advance(3600000);
    mock.app.tick();
    assert.equal(arcade.model.engine.timeLeft, remaining);
    mock.app.activate('openGame', 'gold-miner');
    assert.equal(mock.app.activeGame, arcade);
    assert.equal(arcade.model.scene, 'paused');
    assert.equal(arcade.model.engine.timeLeft, remaining);
    mock.app.activate('miner:resume');
    mock.advance(100);
    mock.app.tick();
    assert.ok(arcade.model.engine.timeLeft < remaining);
    mock.emit('Hide');
    const hiddenRemaining = arcade.model.engine.timeLeft;
    mock.advance(7200000);
    mock.app.tick();
    mock.emit('Show', { query: {} });
    mock.app.tick();
    assert.equal(arcade.model.engine.timeLeft, hiddenRemaining);
    assert.equal(arcade.model.scene, 'paused');
  } finally { mock.app.dispose(); }
});

test('two simultaneous changed touches dispatch both visible gold-miner player buttons', () => {
  const mock = create({ query: { g: 'gold-miner' } });
  try {
    mock.app.activate('miner:mode', 'coop');
    mock.app.activate('miner:new');
    mock.app.activate('miner:play');
    const arcade = mock.app.activeGame;
    assert.equal(arcade.model.engine.players.length, 2);
    assert.deepEqual(arcade.model.engine.players.map(player => player.phase), ['swing', 'swing']);
    const buttons = [0, 1].map(player => mock.app.targets.find(target => target.action === 'miner:launch' && target.payload === player));
    assert.ok(buttons.every(Boolean), 'Both on-screen player launch buttons are available');
    const changedTouches = buttons.map((target, index) => ({
      identifier: index + 10, clientX: target.x + target.w / 2, clientY: target.y + target.h / 2,
    }));
    mock.emit('TouchStart', { changedTouches, touches: changedTouches });
    assert.deepEqual(arcade.model.engine.players.map(player => player.phase), ['out', 'out']);
    assert.equal(arcade.model.engine.timeLeft, 60, 'Both launch actions share the same clock instant');
    mock.emit('TouchEnd', { changedTouches, touches: [] });
    mock.emit('TouchCancel', { changedTouches, touches: [] });
    assert.deepEqual(arcade.model.engine.players.map(player => player.phase), ['out', 'out']);
  } finally { mock.app.dispose(); }
});

test('a second touch from a lobby event cannot activate a control on the newly opened game screen', () => {
  const mock = create();
  try {
    const entry = mock.app.targets.find(target => target.action === 'openGame' && target.payload === 'zuma');
    assert.ok(entry);
    const first = { identifier: 1, clientX: entry.x + entry.w / 2, clientY: entry.y + entry.h / 2 };
    mock.emit('TouchStart', { changedTouches: [first, first], touches: [first, first] });
    assert.equal(mock.app.screen, 'zuma');
    assert.equal(mock.app.activeGame.model.status, 'ready');
  } finally { mock.app.dispose(); }
});

test('arcade move, end and cancel callbacks are registered once and removed on dispose', () => {
  const mock = create({ query: { g: 'zuma' } });
  const arcade = mock.app.activeGame;
  const calls = [];
  const pointer = arcade.pointer;
  arcade.pointer = (type, touches) => { calls.push({ type, touches }); return pointer.call(arcade, type, touches); };
  const changedTouches = [{ identifier: 7, x: 175, y: 410 }, { identifier: 9, clientX: 200, clientY: 420 }];
  try {
    for (const [name, type] of [['TouchMove', 'move'], ['TouchEnd', 'end'], ['TouchCancel', 'cancel']]) {
      assert.equal(mock.handlers.get(name).size, 1);
      mock.emit(name, { changedTouches, touches: [] });
      assert.equal(calls.at(-1).type, type);
      assert.deepEqual(calls.at(-1).touches.map(({ identifier, clientX, clientY }) => ({ identifier, clientX, clientY })), [
        { identifier: 7, clientX: 175, clientY: 410 }, { identifier: 9, clientX: 200, clientY: 420 },
      ]);
    }
    mock.app.dispose();
    const count = calls.length;
    for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage']) {
      assert.equal(mock.handlers.get(name).size, 0);
      mock.emit(name, { changedTouches, touches: [] });
    }
    assert.equal(calls.length, count);
  } finally { mock.app.dispose(); }
});

test('zuma touch release fires once, cancellation and interrupted gestures do not fire', () => {
  const mock = create({ query: { g: 'zuma' } });
  try {
    const arcade = mock.app.activeGame;
    mock.app.activate('zuma:start');
    const { board, scale, rotated } = arcade.layout;
    const touch = (identifier, x, y) => ({
      identifier,
      clientX: board.x + (rotated ? 700 - y : x) * scale,
      clientY: board.y + (rotated ? x : y) * scale,
    });
    const aim = touch(11, 560, 110);
    const moved = touch(11, 650, 120);
    const otherFinger = touch(12, 600, 180);
    mock.emit('TouchStart', { changedTouches: [aim], touches: [aim] });
    mock.emit('TouchMove', { changedTouches: [moved], touches: [moved] });
    mock.emit('TouchEnd', { changedTouches: [otherFinger], touches: [moved] });
    assert.equal(arcade.model.projectiles.length, 0, 'Another finger ending cannot fire the aiming finger');
    mock.emit('TouchCancel', { changedTouches: [moved], touches: [] });
    mock.emit('TouchEnd', { changedTouches: [moved], touches: [] });
    assert.equal(arcade.model.projectiles.length, 0, 'A canceled gesture cannot fire on a later release');
    mock.emit('TouchStart', { changedTouches: [aim], touches: [aim] });
    mock.emit('Hide');
    mock.emit('Show', { query: {} });
    mock.app.activate('zuma:resume');
    mock.emit('TouchEnd', { changedTouches: [aim], touches: [] });
    assert.equal(arcade.model.projectiles.length, 0, 'Backgrounding clears the old aiming gesture');
    mock.emit('TouchStart', { changedTouches: [aim], touches: [aim] });
    mock.emit('TouchMove', { changedTouches: [moved], touches: [moved] });
    mock.emit('TouchEnd', { changedTouches: [moved], touches: [] });
    assert.equal(arcade.model.projectiles.length, 1);
    mock.emit('TouchEnd', { changedTouches: [moved], touches: [] });
    assert.equal(arcade.model.projectiles.length, 1, 'Duplicate end events do not fire twice');
  } finally { mock.app.dispose(); }
});

test('the fill-all-notes button updates candidates and its undo button restores the original notes', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    mock.app.activate('sudoku:select', sudoku.puzzle.indexOf(0));
    mock.app.activate('sudoku:notes');
    mock.app.activate('sudoku:digit', 9);
    mock.app.activate('sudoku:notes');
    const before = sudoku.serialize();
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:autoNotes'));
    assert.deepEqual(sudoku.board, before.board);
    assert.notDeepEqual(sudoku.notes, before.notes);
    assert.ok(sudoku.notes.filter(list => list.length).length > 1);
    assert.equal(sudoku.history.length, before.history.length + 1);
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:undo'));
    assert.deepEqual(sudoku.serialize(), before);
  } finally { mock.app.dispose(); }
});

test('fill-all notes toggles from touch without undoing digits, and both toggle steps remain undoable', () => {
  const mock = create();
  try {
    mock.app.activate('openGame', 'sudoku');
    const sudoku = mock.app.activeGame.model;
    const before = sudoku.serialize();
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:autoNotes'));
    const filled = structuredClone(sudoku.notes);
    assert.equal(mock.app.targets.find(target => target.action === 'sudoku:autoNotes').label, '取消填全');
    assert.equal(sudoku.fillNotesActive, true);
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:autoNotes'));
    assert.deepEqual(sudoku.board, before.board);
    assert.deepEqual(sudoku.notes, before.notes);
    assert.equal(sudoku.fillNotesActive, false);
    assert.equal(mock.app.targets.find(target => target.action === 'sudoku:autoNotes').label, '填全笔记');
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:undo'));
    assert.deepEqual(sudoku.notes, filled);
    assert.equal(sudoku.fillNotesActive, true);
    clickTarget(mock, mock.app.targets.find(target => target.action === 'sudoku:undo'));
    assert.deepEqual(sudoku.serialize(), before);
  } finally { mock.app.dispose(); }
});

test('more reopens after native cancellation or failure without retaining an input barrier', () => {
  const mock = create();
  const sheets = [];
  mock.platform.showActionSheet = options => {
    assert.equal(options.itemList.length, 6);
    sheets.push(options);
  };
  try {
    mock.app.activate('openGame', 'sudoku');
    for (let index = 0; index < 3; index += 1) {
      const target = mock.app.targets.find(target => target.action === 'sudoku:more');
      const point = { clientX: target.x + target.w - 2, clientY: target.y + target.h - 2 };
      mock.emit('TouchStart', { changedTouches: [point], touches: [point] });
      assert.equal(sheets.length, index + 1);
      mock.advance(1000); mock.app.tick();
      assert.equal(mock.app.activeGame.model.elapsed, index * 500, 'time freezes while the native sheet is open');
      const result = { errMsg: index === 1 ? 'showActionSheet:fail native error' : 'showActionSheet:fail cancel' };
      sheets.at(-1).fail(result); sheets.at(-1).complete(result);
      mock.advance(500); mock.app.tick();
    }
    assert.equal(mock.app.activeGame.model.elapsed, 1500);
  } finally { mock.app.dispose(); }
});

test('undoing and completing the same round again records only one completed round', () => {
  const mock = create();
  let sudoku = mock.app.activeGame?.model;
  try {
    mock.app.activate('openGame', 'sudoku');
    sudoku = mock.app.activeGame.model;
    const empty = sudoku.puzzle.flatMap((digit, index) => digit ? [] : [index]);
    const roundId = sudoku.roundId;
    for (const index of empty) {
      mock.app.activate('sudoku:select', index);
      mock.app.activate('sudoku:digit', sudoku.solution[index]);
    }
    assert.equal(sudoku.completed, true);
    const statsEntry = [...mock.storage].find(([key]) => key.includes('stats'));
    assert.ok(statsEntry, 'Completing a round writes local statistics');
    const statsKey = statsEntry[0];
    const firstStats = structuredClone(statsEntry[1]);
    assert.equal(firstStats.rated.completed[sudoku.difficulty].count, 1);
    assert.deepEqual(firstStats.rated.rounds, [roundId]);
    const statsWrites = mock.writes.filter(write => write.key === statsKey).length;
    assert.equal(mock.app.activate('sudoku:undo'), true);
    assert.equal(sudoku.completed, false);
    assert.equal(sudoku.roundId, roundId);
    const last = empty.at(-1);
    mock.app.activate('sudoku:select', last);
    mock.app.activate('sudoku:digit', sudoku.solution[last]);
    assert.equal(sudoku.completed, true);
    assert.deepEqual(mock.storage.get(statsKey), firstStats);
    assert.equal(mock.writes.filter(write => write.key === statsKey).length, statsWrites);
  } finally { mock.app.dispose(); }
});
