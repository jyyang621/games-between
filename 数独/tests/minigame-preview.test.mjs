import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

test('the generated browser bundle can load and render all registered games without Node or external libraries', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const build = spawnSync(process.execPath, ['scripts/build-minigame-preview.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const source = readFileSync(new URL('../preview/wechat-game.js', import.meta.url), 'utf8');
  for (const id of ['home', 'sudoku', 'zuma', 'gold-miner', 'game-2048', 'minesweeper', 'gomoku']) {
    const gradient = { addColorStop() {} };
    const context = new Proxy({
      measureText: text => ({ width: String(text).length * 8 }),
      createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    }, { get: (target, key) => key in target ? target[key] : () => {} });
    const storage = new Map();
    let renders = 0;
    const window = {
      onNativeRender() { renders += 1; },
      wx: {
        createCanvas: () => ({ getContext: () => context }),
        getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { top: 44, bottom: 810 } }),
        getMenuButtonBoundingClientRect: () => ({ left: 288, top: 50, bottom: 82, right: 380 }),
        getLaunchOptionsSync: () => ({ query: id === 'sudoku' ? { g: id, p: 'preview-bundle', d: 'easy' } : { g: id } }),
        getStorageSync: key => storage.get(key),
        setStorageSync: (key, value) => storage.set(key, value),
      },
    };
    vm.runInNewContext(source, { window, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} }, { timeout: 5000 });
    const app = window.MiniGame.instance;
    try {
      assert.equal(app.screen, id);
      assert.ok(renders > 0);
      for (const gameId of ['zuma', 'gold-miner', 'sudoku', 'game-2048', 'minesweeper', 'gomoku']) {
        assert.equal(app.activate('openGame', gameId), true);
        assert.ok(app.targets.length > 0);
        assert.equal(new URLSearchParams(app.sharePayload().query).get('g'), gameId);
        assert.equal(app.activate('home'), true);
      }
    } finally { app.dispose(); }
  }
});

test('the real preview audio adapter dispatches each DOM completion once while music replaces its ended listener', async () => {
  const preview = readFileSync(new URL('../preview/wx-preview.js', import.meta.url), 'utf8');
  const start = preview.indexOf('    createInnerAudioContext() {');
  const end = preview.indexOf('\n    createCanvas:', start);
  assert.ok(start >= 0 && end > start, 'the production preview audio adapter must be available');
  const adapterSource = preview.slice(start, end);
  const musicSource = readFileSync(new URL('../../微信小程序/src/platform/music.js', import.meta.url), 'utf8');
  const elements = [];
  const document = {
    body: { append(element) { elements.push(element); } },
    createElement(tag) {
      assert.equal(tag, 'audio');
      const listeners = new Map(), attributes = new Map();
      return {
        dataset: {}, plays: 0, pauses: 0, currentTime: 0, sourceChanges: [],
        get src() { return attributes.get('src') || ''; },
        set src(value) {
          this.sourceChanges.push(value);
          // Bound the test even if a live listener Set causes recursive switching.
          assert.ok(this.sourceChanges.length < 10, 'one DOM ended event repeatedly switched tracks');
          attributes.set('src', value); this.currentTime = 0;
        },
        getAttribute(name) { return attributes.get(name) ?? null; },
        removeAttribute(name) { attributes.delete(name); },
        addEventListener(name, callback) {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name).add(callback);
        },
        dispatch(name) { for (const callback of [...listeners.get(name) || []]) callback(); },
        play() { this.plays += 1; }, pause() { this.pauses += 1; }, load() {}, remove() {},
      };
    },
  };
  const context = vm.createContext({ document });
  vm.runInContext(`
    const platform = { ${adapterSource} };
    const module = { exports: {} };
    ${musicSource}
    const music = module.exports.createMusic({ platform });
    music.setPlaying(true);
  `, context, { timeout: 1000 });
  assert.equal(elements.length, 1);
  const element = elements[0];
  assert.equal(element.src, '/wechat-assets/audio/pingsha-luoyan.mp3');
  assert.equal(element.loop, false);
  assert.equal(element.plays, 1);
  context.audioElement = element;
  try {
    vm.runInContext("audioElement.dispatch('ended');", context, { timeout: 1000 });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(element.src, '/wechat-assets/audio/yangguan-sandie.mp3');
    assert.equal(element.plays, 2, 'one DOM completion starts exactly one next track');
    assert.equal(element.sourceChanges.length, 2);
    vm.runInContext("audioElement.dispatch('ended');", context, { timeout: 1000 });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(element.src, '/wechat-assets/audio/pingsha-luoyan.mp3');
    assert.equal(element.plays, 3);
    assert.equal(elements.length, 1, 'the real adapter retains a single audio element');
    vm.runInContext("music.setPlaying(false); audioElement.dispatch('ended');", context, { timeout: 1000 });
    assert.equal(element.plays, 3);
    assert.equal(element.src, '/wechat-assets/audio/pingsha-luoyan.mp3');
    vm.runInContext('music.setPlaying(true);', context, { timeout: 1000 });
    assert.equal(element.plays, 4);
    assert.equal(element.src, '/wechat-assets/audio/yangguan-sandie.mp3');
  } finally {
    vm.runInContext('music.dispose();', context, { timeout: 1000 });
  }
});
