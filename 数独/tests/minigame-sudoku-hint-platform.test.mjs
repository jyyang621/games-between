import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { createMiniGame } = require('../../微信小程序/src/main.js');

function fixture({ rejectOnce = false } = {}) {
  const handlers = new Map(), storage = new Map(), attempts = [], dialogs = [], texts = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: value => ({ width: String(value).length * 8 }),
    fillText: value => texts.push(String(value)),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  const info = { windowWidth: 390, windowHeight: 844, pixelRatio: 1,
    safeArea: { top: 44, bottom: 810 } };
  const platform = {
    createCanvas: () => ({ getContext: () => context }),
    getWindowInfo: () => ({ ...info, safeArea: { ...info.safeArea } }),
    getMenuButtonBoundingClientRect: () => ({ left: 288, right: 380, top: 50, bottom: 82 }),
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    createInnerAudioContext: () => ({ play() {}, pause() {}, destroy() {} }),
    showModal(config) {
      attempts.push(config);
      const invalid = ['confirmText', 'cancelText'].find(key => config[key] !== undefined &&
        (typeof config[key] !== 'string' || Array.from(config[key]).length > 4));
      if (invalid || rejectOnce) {
        rejectOnce = false;
        const result = { errMsg: 'showModal:fail ' + (invalid ? invalid + ' length should not larger than 4' : 'native unavailable') };
        config.fail?.(result); config.complete?.(result); return;
      }
      dialogs.push(config);
    },
  };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage']) {
    platform['on' + name] = callback => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(callback);
    };
    platform['off' + name] = callback => handlers.get(name)?.delete(callback);
  }
  const app = createMiniGame(platform, { autoTick: false, now: () => Date.parse('2026-11-06T00:00:00Z') });
  const emit = (name, value = {}) => { for (const callback of [...handlers.get(name) || []]) callback(value); };
  app.activate('openGame', 'sudoku');
  function clickHint() {
    const target = app.targets.find(item => item.action === 'sudoku:hint');
    assert.ok(target, 'the production renderer must expose an enabled hint target');
    const point = { clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 };
    emit('TouchStart', { touches: [point], changedTouches: [point] });
  }
  function confirm(config = dialogs.at(-1)) {
    assert.ok(config, 'a platform-valid modal should be open');
    config.success?.({ confirm: true, cancel: false }); config.complete?.({ confirm: true });
  }
  return { app, info, storage, attempts, dialogs, texts, emit, clickHint, confirm };
}

test('a rendered Sudoku hint opens a native-valid four-character confirmation and applies after confirmation', t => {
  const f = fixture(); t.after(() => f.app.dispose());
  const model = f.app.activeGame.model, before = model.board.slice();
  f.clickHint();
  assert.equal(f.attempts.length, 1);
  assert.equal(f.dialogs.length, 1, 'WeChat rejects confirm/cancel labels longer than four characters');
  assert.ok(Array.from(f.dialogs[0].confirmText || '').length <= 4);
  assert.ok(Array.from(f.dialogs[0].cancelText || '').length <= 4);
  assert.deepEqual(model.board, before, 'opening the explanation does not fill a cell');
  assert.equal(model.hints, 0);
  f.confirm();
  assert.equal(model.hints, 1);
  assert.notDeepEqual(model.board, before, 'the confirmed first logical placement reaches the real model');
  assert.equal(f.storage.get('games-between:sudoku:v1').hints, 1);
});

test('a native modal failure gives visible feedback, leaves the board untouched and allows retry', t => {
  const f = fixture({ rejectOnce: true }); t.after(() => f.app.dispose());
  const model = f.app.activeGame.model, before = model.board.slice();
  f.clickHint();
  assert.equal(f.dialogs.length, 0);
  assert.equal(model.hints, 0);
  assert.deepEqual(model.board, before);
  assert.ok(f.texts.some(text => /无法打开|打开失败|暂时无法|请再试|再试一次/.test(text)),
    'a native failure must not silently swallow the hint');
  f.clickHint();
  assert.equal(f.dialogs.length, 1, 'failure must release host modal depth and retain the touch target');
  f.confirm();
  assert.equal(model.hints, 1);
});

for (const boundary of ['background', 'home', 'rotation']) {
  test('a hint confirmation queued before ' + boundary + ' cannot change that round', t => {
    const f = fixture(); t.after(() => f.app.dispose());
    const model = f.app.activeGame.model, before = model.board.slice();
    f.clickHint();
    assert.equal(f.dialogs.length, 1);
    const pending = f.dialogs[0];
    if (boundary === 'background') f.emit('Hide');
    else if (boundary === 'home') f.emit('Show', { query: { g: 'home' } });
    else {
      Object.assign(f.info, { windowWidth: 844, windowHeight: 390, safeArea: { top: 0, bottom: 366 } });
      f.emit('WindowResize');
    }
    f.confirm(pending);
    assert.deepEqual(model.board, before);
    assert.equal(model.hints, 0);
    assert.equal(model.paused, true);
    if (boundary === 'home') assert.equal(f.app.screen, 'home');
    else {
      if (boundary === 'background') f.emit('Show');
      f.app.activate('sudoku:pause');
      f.clickHint(); f.confirm();
      assert.equal(model.hints, 1, 'a fresh confirmation works after the lifecycle boundary');
    }
  });
}

function previewModalAdapter() {
  const source = readFileSync(new URL('../preview/wx-preview.js', import.meta.url), 'utf8');
  const start = source.indexOf('    showModal(config) {'), end = source.indexOf('\n    showActionSheet(config)', start);
  assert.ok(start >= 0 && end > start);
  const dialogs = [];
  const context = vm.createContext({ showDialog: (title, content, buttons) => dialogs.push({ title, content, buttons }) });
  vm.runInContext('let cancelModal = null; globalThis.adapter = ({' + source.slice(start, end) + '});', context, { timeout: 1000 });
  return { adapter: context.adapter, dialogs };
}

test('the real preview rejects overlong confirm and cancel labels through fail and complete', () => {
  for (const key of ['confirmText', 'cancelText']) {
    const f = previewModalAdapter(), calls = [];
    f.adapter.showModal({ [key]: '应用这一步',
      success: () => calls.push('success'),
      fail: result => { assert.match(result.errMsg, /showModal:fail/); calls.push('fail'); },
      complete: result => { assert.match(result.errMsg, /showModal:fail/); calls.push('complete'); },
    });
    assert.equal(f.dialogs.length, 0);
    assert.deepEqual(calls, ['fail', 'complete']);
  }
});

test('the real preview retains normal four-character buttons and confirmation callbacks', () => {
  const f = previewModalAdapter(), calls = [];
  f.adapter.showModal({ title: '提示', content: '可解释推理', confirmText: '应用提示', cancelText: '继续思考',
    success: result => { assert.equal(result.confirm, true); assert.equal(result.cancel, false); calls.push('success'); },
    complete: () => calls.push('complete'),
  });
  assert.equal(f.dialogs.length, 1);
  assert.deepEqual(Array.from(f.dialogs[0].buttons, button => button.text), ['继续思考', '应用提示']);
  f.dialogs[0].buttons[1].onClick();
  assert.deepEqual(calls, ['success', 'complete']);
});
