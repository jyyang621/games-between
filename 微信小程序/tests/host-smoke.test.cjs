'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMiniGame } = require('../src/app/host.js');
const { registry } = require('../src/registry.js');

// Contract smoke test, not a substitute for rendering on WeChat Canvas.
function fixture(width, height) {
  const storage = new Map();
  const handlers = {};
  const context = new Proxy({
    measureText: text => ({ width: String(text).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const canvas = { getContext: () => context };
  const platform = {
    createCanvas: () => canvas,
    getWindowInfo: () => ({ windowWidth: width, windowHeight: height, pixelRatio: 2,
      safeArea: { top: 24, bottom: height - 12 } }),
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, JSON.parse(JSON.stringify(value))),
    getLaunchOptionsSync: () => ({}),
  };
  for (const name of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel',
    'onHide', 'onShow', 'onWindowResize', 'onShareAppMessage']) {
    platform[name] = handler => { handlers[name] = handler; };
  }
  let clock = 1000;
  const host = createMiniGame(platform, { autoTick: false, now: () => clock });
  return { host, handlers, advance(ms) { clock += ms; host.tick(); } };
}

for (const [width, height] of [[390, 844], [844, 390]]) {
  test(`all eight games retain host/render/navigation contracts at ${width}x${height}`, t => {
    const { host, handlers, advance } = fixture(width, height);
    t.after(() => host.dispose());
    for (const entry of registry.list()) {
      assert.equal(host.activate('openGame', entry.id), true, entry.id);
      assert.equal(host.gameId, entry.id);
      assert.ok(host.activeGame.model);
      assert.ok(host.targets.length > 0);
      assert.ok(host.targets.every(target => ['x', 'y', 'w', 'h'].every(key => Number.isFinite(target[key]))));
      advance(250);
      handlers.onHide();
      handlers.onShow({});
      assert.equal(host.gameId, entry.id);
      assert.equal(host.activate('home'), true);
      assert.equal(host.gameId, null);
    }
  });

  test(`gold miner plays, pauses and resumes through host at ${width}x${height}`, t => {
    const { host, handlers, advance } = fixture(width, height);
    t.after(() => host.dispose());
    host.activate('openGame', 'gold-miner');
    assert.equal(host.activate('miner:new'), true);
    assert.equal(host.activeGame.model.scene, 'ready');
    host.activate('miner:play');
    advance(1000);
    const before = host.activeGame.model.engine.timeLeft;
    handlers.onHide();
    assert.equal(host.activeGame.model.scene, 'paused');
    advance(5000);
    assert.equal(host.activeGame.model.engine.timeLeft, before);
    handlers.onShow({});
    host.activate('miner:resume');
    advance(1000);
    assert.ok(host.activeGame.model.engine.timeLeft < before);
  });
}
