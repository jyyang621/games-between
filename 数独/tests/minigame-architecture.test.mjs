import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMiniGame } = require('../../微信小程序/src/main.js');
const { createRegistry, registry: defaultRegistry } = require('../../微信小程序/src/registry.js');
const { PAGE_SIZE } = require('../../微信小程序/src/hub/renderer.js');

function mockPlatform({ query = {}, initialStorage = [] } = {}) {
  const storage = new Map(initialStorage), handlers = new Map(), reads = [], writes = [], texts = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    fillText(value) { texts.push(String(value)); },
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const platform = {
    createCanvas: () => ({ getContext: () => context }),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { top: 44, bottom: 810 } }),
    getMenuButtonBoundingClientRect: () => ({ left: 288, top: 50, bottom: 82, right: 380 }),
    getLaunchOptionsSync: () => ({ query }),
    getStorageSync(key) { reads.push(key); return structuredClone(storage.get(key)); },
    setStorageSync(key, value) { writes.push(key); storage.set(key, structuredClone(value)); },
    showShareMenu() {}, shareAppMessage() {},
    showModal(config) { config.success?.({ confirm: true, cancel: false }); config.complete?.(); },
    showActionSheet(config) { config.success?.({ tapIndex: 0 }); config.complete?.(); },
  };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage']) {
    handlers.set(name, new Set());
    platform[`on${name}`] = callback => handlers.get(name).add(callback);
    platform[`off${name}`] = callback => handlers.get(name).delete(callback);
  }
  return { platform, storage, reads, writes, handlers, texts,
    emit(name, payload = {}) { for (const callback of handlers.get(name)) callback(payload); },
  };
}

function create({ registry = defaultRegistry, autoTick = false, ...options } = {}) {
  const mock = mockPlatform(options);
  let time = Date.parse('2026-10-17T16:00:00Z');
  const app = createMiniGame(mock.platform, { registry, autoTick, now: () => time });
  return { ...mock, app, advance(ms) { time += ms; } };
}

function fakeDefinition(id, instances) {
  return { id, title: `测试 ${id}`, subtitle: '通过注册表接入', icon: 'play', status: 'ready',
    create({ read, write, services }) {
      const calls = { ticks: [], saves: 0, pauses: 0, disposes: 0, entries: [], pointers: [] };
      const model = { value: read(`test:${id}:v1`)?.value || 0, elapsed: 0, paused: false };
      const game = {
        id, model, calls, frameInterval: 50,
        resize(viewport) { this.layout = viewport; },
        render() { return [
          { x: 5, y: 5, w: 50, h: 30, action: 'home' },
          { x: 60, y: 5, w: 50, h: 30, action: 'share' },
          { x: 10, y: 100, w: 100, h: 50, action: `${id}:increment` },
        ]; },
        tick(ms) { calls.ticks.push(ms); if (!model.paused) model.elapsed += ms; },
        activate(action) {
          if (action === `${id}:increment`) { model.value += 1; return true; }
          if (action === `${id}:resume`) { model.paused = false; return true; }
          if (action === `${id}:modal`) { services.modal({ title: '测试确认' }, () => { model.value += 10; }); return true; }
          return false;
        },
        pointer(type, points) { calls.pointers.push({ type, points }); return true; },
        pause() { calls.pauses += 1; model.paused = true; },
        save() { calls.saves += 1; return write(`test:${id}:v1`, { value: model.value }); },
        enter(query, context) { calls.entries.push({ query, context }); return true; },
        sharePayload() { return { title: `分享 ${id}`, query: `g=${id}&level=${model.value}` }; },
        getResumeInfo() { return { available: true, text: `进度 ${model.value}` }; },
        get statusText() { return `${id} · ${model.value}`; },
        dispose() { calls.disposes += 1; },
      };
      instances.set(id, game);
      return game;
    },
  };
}

function click(mock, target) {
  assert.ok(target, 'Expected a visible interactive target');
  const point = { identifier: 1, clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 };
  mock.emit('TouchStart', { changedTouches: [point], touches: [point] });
}

test('a cold lobby launch creates no game and never reads or writes puzzle data', () => {
  const mock = create();
  try {
    assert.equal(mock.app.screen, 'home');
    assert.equal(mock.app.activeGame, null);
    assert.equal(Object.hasOwn(mock.app, 'game'), false);
    assert.equal(mock.reads.includes('games-between:hub:v1'), true);
    assert.equal(mock.reads.some(key => key.includes('sudoku') || key.includes('stats') || key === 'games-between:settings:v1'), false);
    assert.equal(mock.writes.some(key => key !== 'games-between:hub:v1'), false);
  } finally { mock.app.dispose(); }
  assert.equal(mock.writes.some(key => key !== 'games-between:hub:v1'), false);
});

test('the registry validates duplicate IDs and ready factories while retaining upcoming games', () => {
  const instances = new Map(), entry = fakeDefinition('new-game', instances);
  assert.throws(() => createRegistry([entry, { ...entry }]));
  assert.throws(() => createRegistry([{ id: 'missing', title: '缺少工厂', status: 'ready' }]));
  assert.throws(() => createRegistry([{ ...entry, id: 'home' }]));
  const registry = createRegistry([entry, { id: 'coming-game', title: '稍后上线', status: 'soon' }]);
  assert.equal(registry.list().length, 2);
  assert.equal(registry.get('new-game').title, entry.title);
  assert.equal(registry.get('coming-game').status, 'soon');
  assert.equal(instances.size, 0);
  for (const id of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', {}, null]) assert.equal(registry.get(id), null);
  assert.equal(registry.resolve({ g: 'new-game' }), registry.get('new-game'));
  assert.equal(registry.resolve({ g: 'unknown' }), null);
  assert.ok(Object.isFrozen(registry.list()));
  assert.ok(Object.isFrozen(registry.get('new-game')));
});

test('legacy share matching is explicit and never overrides an unknown or home game ID', () => {
  const instances = new Map();
  const registry = createRegistry([{ ...fakeDefinition('legacy-game', instances), matchLegacyQuery: query => query.old === 'yes' }]);
  assert.equal(registry.resolve({ old: 'yes' }).id, 'legacy-game');
  assert.equal(registry.resolve({ g: 'home', old: 'yes' }), null);
  assert.equal(registry.resolve({ g: 'unknown', old: 'yes' }), null);
  assert.equal(registry.resolve({ old: 'no' }), null);
  const mock = create({ registry, query: { old: 'yes' } });
  try { assert.equal(mock.app.screen, 'legacy-game'); }
  finally { mock.app.dispose(); }
});

test('an additional registered game appears on a paginated lobby and uses the generic host contract', () => {
  const instances = new Map();
  const registry = createRegistry([...defaultRegistry.list(), fakeDefinition('future-game', instances)]);
  const mock = create({ registry });
  try {
    assert.equal(instances.size, 0);
    const addedGamePage = Math.floor(defaultRegistry.list().length / PAGE_SIZE);
    assert.equal(mock.app.activate('hub:page', addedGamePage), true);
    click(mock, mock.app.targets.find(target => target.action === 'openGame' && target.payload === 'future-game'));
    const game = instances.get('future-game');
    assert.equal(mock.app.screen, 'future-game');
    assert.equal(mock.app.gameId, 'future-game');
    assert.equal(mock.app.activeGame, game);
    assert.equal(game.calls.entries.length, 1);
    assert.ok(game.layout.width > 0);
    click(mock, mock.app.targets.find(target => target.action === 'future-game:increment'));
    assert.equal(game.model.value, 1);
    assert.deepEqual(mock.storage.get('test:future-game:v1'), { value: 1 });
    assert.equal(new URLSearchParams(mock.app.sharePayload().query).get('level'), '1');
    mock.advance(100);
    mock.app.tick();
    assert.equal(game.model.elapsed, 100);
    click(mock, mock.app.targets.find(target => target.action === 'home'));
    assert.equal(mock.app.activeGame, null);
    assert.equal(game.model.paused, true);
    click(mock, mock.app.targets.find(target => target.action === 'resumeGame' && target.payload === 'future-game'));
    assert.equal(mock.app.activeGame, game);
    assert.equal(instances.size, 1);
    assert.equal(game.calls.entries.length, 2);
  } finally { mock.app.dispose(); }
});

test('only the current module receives clock and save calls, and every loaded module disposes once', () => {
  const instances = new Map();
  const registry = createRegistry(['first-game', 'second-game'].map(id => fakeDefinition(id, instances)));
  const mock = create({ registry });
  try {
    assert.equal(instances.size, 0);
    mock.app.activate('openGame', 'first-game');
    mock.advance(120);
    mock.app.tick();
    const first = instances.get('first-game');
    assert.equal(first.model.elapsed, 120);
    mock.app.activate('openGame', 'second-game');
    const second = instances.get('second-game');
    const firstTicks = first.calls.ticks.length, firstSaves = first.calls.saves;
    mock.advance(80);
    mock.app.tick();
    mock.app.activate('second-game:increment');
    assert.equal(first.calls.ticks.length, firstTicks);
    assert.equal(first.calls.saves, firstSaves);
    assert.equal(second.model.elapsed, 80);
    mock.app.activate('home');
    const secondTicks = second.calls.ticks.length, secondSaves = second.calls.saves;
    mock.advance(10000);
    mock.app.tick();
    assert.equal(first.calls.ticks.length, firstTicks);
    assert.equal(second.calls.ticks.length, secondTicks);
    assert.equal(second.calls.saves, secondSaves);
    mock.app.dispose();
    mock.app.dispose();
    assert.equal(first.calls.disposes, 1);
    assert.equal(second.calls.disposes, 1);
    assert.equal(mock.app.activate('openGame', 'first-game'), false);
    for (const callbacks of mock.handlers.values()) assert.equal(callbacks.size, 0);
  } finally { mock.app.dispose(); }
});

test('the host owns one frame loop, respects module cadence and stops scheduling in the lobby or background', t => {
  const loops = new Map();
  let nextTimer = 0;
  t.mock.method(globalThis, 'setInterval', (callback, interval) => {
    const id = ++nextTimer;
    loops.set(id, { callback, interval });
    return id;
  });
  t.mock.method(globalThis, 'clearInterval', id => { loops.delete(id); });
  const instances = new Map();
  const fast = fakeDefinition('fast-game', instances);
  const slow = fakeDefinition('slow-game', instances);
  const createSlow = slow.create;
  slow.create = context => ({ ...createSlow(context), frameInterval: 1000 });
  const mock = create({ registry: createRegistry([fast, slow]), autoTick: true });
  try {
    assert.equal(loops.size, 0);
    mock.app.activate('openGame', 'fast-game');
    assert.equal(loops.size, 1);
    assert.equal([...loops.values()][0].interval, 50);
    mock.advance(50);
    [...loops.values()][0].callback();
    assert.equal(instances.get('fast-game').model.elapsed, 50);
    mock.app.activate('openGame', 'slow-game');
    assert.equal(loops.size, 1);
    assert.equal([...loops.values()][0].interval, 1000);
    const saves = instances.get('slow-game').calls.saves;
    mock.advance(5000);
    [...loops.values()][0].callback();
    assert.ok(instances.get('slow-game').calls.saves > saves, 'The host periodically saves the active module');
    assert.equal(instances.get('fast-game').model.elapsed, 50);
    mock.emit('Hide');
    assert.equal(loops.size, 0);
    mock.emit('Show', { query: {} });
    assert.equal(loops.size, 1);
    mock.app.activate('home');
    assert.equal(loops.size, 0);
    mock.app.activate('resumeGame', 'slow-game');
    assert.equal(loops.size, 1);
    mock.app.dispose();
    assert.equal(loops.size, 0);
  } finally { mock.app.dispose(); }
});

test('a broken game factory or incomplete module cannot replace the currently playable game', () => {
  const instances = new Map();
  const registry = createRegistry([
    fakeDefinition('working-game', instances),
    { id: 'broken-game', title: '加载失败', status: 'ready', create() { throw new Error('Failed asset initialization'); } },
    { id: 'incomplete-game', title: '接口不完整', status: 'ready', create() { return { id: 'incomplete-game', render() { return []; } }; } },
  ]);
  const mock = create({ registry, query: { g: 'working-game' } });
  try {
    const game = mock.app.activeGame;
    for (const id of ['broken-game', 'incomplete-game']) {
      assert.equal(mock.app.activate('openGame', id), false);
      assert.equal(mock.app.activeGame, game);
      assert.equal(mock.app.screen, 'working-game');
      assert.equal(mock.app.activate('working-game:increment'), true);
    }
    assert.equal(game.model.value, 2);
    mock.advance(100);
    mock.app.tick();
    assert.equal(game.model.elapsed, 100);
  } finally { mock.app.dispose(); }
});

test('generic launch, foreground routing and persisted lobby resume work for an unknown future game', () => {
  const instances = new Map(), registry = createRegistry([fakeDefinition('future-game', instances)]);
  const first = create({ registry, query: { g: 'future-game', level: '3' } });
  let second;
  try {
    const game = first.app.activeGame;
    assert.equal(game.calls.entries[0].query.level, '3');
    first.app.activate('future-game:increment');
    first.app.activate('home');
    first.emit('Show', { query: { g: 'future-game', level: '9' } });
    assert.equal(first.app.activeGame, game);
    assert.equal(game.calls.entries.at(-1).query.level, '9');
    first.emit('Show', { query: { g: 'home' } });
    assert.equal(first.app.screen, 'home');
    second = create({ registry, initialStorage: [...first.storage] });
    assert.equal(second.app.activeGame, null);
    click(second, second.app.targets.find(target => target.action === 'resumeGame' && target.payload === 'future-game'));
    assert.equal(second.app.screen, 'future-game');
    assert.equal(second.app.activeGame.model.value, 1);
  } finally { first.app.dispose(); second?.app.dispose(); }
});

test('the lobby preserves a visited game without playable progress as a new start after cold launch', () => {
  const instances = new Map();
  const definition = fakeDefinition('future-game', instances), factory = definition.create;
  definition.create = context => {
    const game = factory(context);
    game.getResumeInfo = () => ({ available: false, text: '请先选择关卡' });
    return game;
  };
  const registry = createRegistry([definition]);
  const first = create({ registry });
  let second;
  try {
    first.app.activate('openGame', 'future-game');
    first.texts.length = 0;
    first.app.activate('home');
    assert.ok(first.texts.includes('从测试 future-game开始'));
    second = create({ registry, initialStorage: [...first.storage] });
    assert.equal(second.app.activeGame, null);
    assert.ok(second.texts.includes('从测试 future-game开始'), 'A cold lobby must not advertise non-existent progress');
  } finally { first.app.dispose(); second?.app.dispose(); }
});

test('generic sharing and background transitions pause and save a future module', () => {
  const instances = new Map(), registry = createRegistry([fakeDefinition('future-game', instances)]);
  const mock = create({ registry, query: { g: 'future-game' } });
  let shared;
  mock.platform.shareAppMessage = payload => { shared = payload; };
  try {
    const game = mock.app.activeGame;
    mock.advance(250);
    mock.app.activate('share');
    assert.equal(game.model.elapsed, 250);
    assert.equal(game.model.paused, true);
    assert.equal(new URLSearchParams(shared.query).get('g'), 'future-game');
    assert.ok(game.calls.saves > 0);
    mock.advance(1000);
    mock.app.tick();
    assert.equal(game.model.elapsed, 250);
    mock.app.activate('future-game:resume');
    mock.advance(75);
    mock.emit('Hide');
    assert.equal(game.model.elapsed, 325);
    assert.equal(game.model.paused, true);
    const ticks = game.calls.ticks.length;
    mock.advance(60000);
    mock.app.tick();
    assert.equal(game.calls.ticks.length, ticks);
    assert.equal(mock.app.activate('future-game:resume'), false);
    mock.emit('Show', { query: {} });
    assert.equal(game.model.elapsed, 325);
  } finally { mock.app.dispose(); }
});

test('native modal barriers block both clock and pointer dispatch for arbitrary modules', () => {
  const instances = new Map(), registry = createRegistry([fakeDefinition('future-game', instances)]);
  const mock = create({ registry, query: { g: 'future-game' } });
  let modal;
  mock.platform.showModal = config => { modal = config; };
  try {
    const game = mock.app.activeGame;
    mock.advance(100);
    mock.app.activate('future-game:modal');
    assert.ok(modal);
    assert.equal(game.model.elapsed, 100);
    mock.advance(30000);
    mock.app.tick();
    assert.equal(mock.app.activate('future-game:increment'), false);
    mock.emit('TouchStart', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 300 }] });
    mock.emit('TouchMove', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 310 }] });
    assert.equal(game.calls.pointers.length, 0);
    assert.equal(game.model.elapsed, 100);
    modal.success({ confirm: true, cancel: false });
    modal.complete();
    assert.equal(game.model.value, 10);
    mock.advance(50);
    mock.app.tick();
    assert.equal(game.model.elapsed, 150);
  } finally { mock.app.dispose(); }
});

test('a delayed native confirmation cannot mutate a module after leaving and reopening that game', () => {
  const instances = new Map();
  const registry = createRegistry(['first-game', 'second-game'].map(id => fakeDefinition(id, instances)));
  const mock = create({ registry, query: { g: 'first-game' } });
  let modal;
  mock.platform.showModal = config => { modal = config; };
  try {
    const first = mock.app.activeGame;
    mock.app.activate('first-game:modal');
    assert.ok(modal);
    mock.emit('Show', { query: { g: 'second-game' } });
    mock.emit('Show', { query: { g: 'first-game' } });
    assert.equal(mock.app.activeGame, first);
    modal.success({ confirm: true, cancel: false });
    modal.complete();
    assert.equal(first.model.value, 0);
    assert.equal(mock.app.activate('first-game:increment'), true, 'A stale overlay must release its input barrier');
    assert.equal(first.model.value, 1);
  } finally { mock.app.dispose(); }
});

test('a background transition invalidates native confirmations even when the same game returns', () => {
  const instances = new Map(), registry = createRegistry([fakeDefinition('future-game', instances)]);
  const mock = create({ registry, query: { g: 'future-game' } });
  let modal;
  mock.platform.showModal = config => { modal = config; };
  try {
    const game = mock.app.activeGame;
    mock.app.activate('future-game:modal');
    assert.ok(modal);
    mock.emit('Hide');
    mock.advance(60000);
    mock.emit('Show', { query: {} });
    modal.success({ confirm: true, cancel: false });
    modal.complete();
    assert.equal(mock.app.activeGame, game);
    assert.equal(game.model.value, 0);
    assert.equal(game.model.paused, true);
    assert.equal(mock.app.activate('future-game:increment'), true);
    assert.equal(game.model.value, 1);
  } finally { mock.app.dispose(); }
});

test('callbacks from a native dialog cannot mutate a disposed game or restore event handlers', () => {
  const instances = new Map(), registry = createRegistry([fakeDefinition('future-game', instances)]);
  const mock = create({ registry, query: { g: 'future-game' } });
  let modal;
  mock.platform.showModal = config => { modal = config; };
  const game = mock.app.activeGame;
  mock.app.activate('future-game:modal');
  assert.ok(modal);
  mock.app.dispose();
  modal.success({ confirm: true, cancel: false });
  modal.complete();
  assert.equal(game.model.value, 0);
  assert.equal(game.calls.disposes, 1);
  for (const callbacks of mock.handlers.values()) assert.equal(callbacks.size, 0);
});

test('game saves retain their original keys and playing another game cannot overwrite inactive progress', () => {
  const mock = create();
  try {
    mock.app.activate('openGame', 'sudoku');
    mock.app.activate('sudoku:autoNotes');
    mock.app.activate('home');
    const sudoku = structuredClone(mock.storage.get('games-between:sudoku:v1'));
    assert.ok(sudoku);
    mock.app.activate('openGame', 'zuma');
    mock.app.activate('zuma:start');
    mock.advance(100);
    mock.app.tick();
    mock.app.activate('home');
    const zuma = structuredClone(mock.storage.get('games-between:zuma:v1'));
    assert.ok(zuma);
    mock.app.activate('openGame', 'gold-miner');
    mock.app.activate('miner:new');
    mock.app.activate('miner:play');
    mock.advance(100);
    mock.app.tick();
    mock.app.activate('home');
    assert.ok(mock.storage.get('gold-miner-save-v1'));
    assert.deepEqual(mock.storage.get('games-between:sudoku:v1'), sudoku);
    assert.deepEqual(mock.storage.get('games-between:zuma:v1'), zuma);
  } finally { mock.app.dispose(); }
});
