import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMiniGame } = require('../../微信小程序/src/app/host.js');
const { createRegistry } = require('../../微信小程序/src/registry.js');
const { MUSIC_SETTINGS_KEY, MUSIC_SOURCE, MUSIC_VOLUME } = require('../../微信小程序/src/platform/music.js');
const ID = 'future-music-game';
const GAME_SAVE = `test:${ID}:save`;

function fixture(t, { initial = [], audioPlay, width = 390, height = 844, withMusic = true } = {}) {
  const storage = new Map(initial), writes = [], events = new Map(), players = [], dialogs = [], sheets = [], shares = [], log = [], texts = [];
  const context = new Proxy({ measureText: value => ({ width: Array.from(String(value)).length * 7 }),
    fillText: value => texts.push(String(value)),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
  { get: (object, key) => key in object ? object[key] : () => {} });
  let time = 1000, game;
  const definition = { id: ID, title: '未来游戏', subtitle: '测试统一音乐接口', status: 'ready', icon: 'play',
    create({ write, services }) {
      const model = { scene: 'menu', ticks: 0, callbacks: 0, pauses: [], disposed: false };
      const result = {
        id: ID, frameInterval: 16, model, statusText: '未来玩法独立管理自己的状态',
        enter() {}, resize(viewport) { this.layout = viewport; },
        render() { return ['start', 'resume', 'pause', 'menu', 'modal', 'sheet', 'poke'].map((action, index) => ({
          x: 20 + index % 3 * 90, y: 140 + Math.floor(index / 3) * 50, w: 80, h: 44,
          action: `${ID}:${action}`, label: action,
        })); },
        tick(delta) { if (model.scene === 'playing' && delta > 0) model.ticks += 1; },
        pointer() { return false; },
        activate(action, payload) {
          const name = action.replace(`${ID}:`, '');
          if (['start', 'resume'].includes(name)) { model.scene = 'playing'; return true; }
          if (name === 'pause') { model.scene = 'paused'; return true; }
          if (name === 'menu') { model.scene = 'menu'; return true; }
          if (name === 'modal') return services.modal({ title: '测试弹窗', content: '等待回复',
            success() { model.callbacks += 1; if (payload && payload !== 'complete-won') model.scene = payload; },
            complete() { if (payload === 'complete-won') model.scene = 'won'; } });
          if (name === 'sheet') return services.actionSheet({ itemList: ['继续', '结束'],
            success() { model.callbacks += 1; if (payload && payload !== 'complete-won') model.scene = payload; },
            complete() { if (payload === 'complete-won') model.scene = 'won'; } });
          return false;
        },
        pause(reason) { model.pauses.push(reason); if (model.scene === 'playing') model.scene = 'paused'; },
        save() { return write(GAME_SAVE, { scene: model.scene, ticks: model.ticks }); },
        getResumeInfo() { return { text: model.scene, available: model.scene !== 'menu' }; },
        sharePayload() { return { title: '未来游戏', query: `g=${ID}` }; },
        dispose() { model.disposed = true; },
      };
      if (withMusic) Object.defineProperty(result, 'musicActive', { get: () => model.scene === 'playing' });
      game = result;
      return result;
    },
  };
  const platform = {
    createCanvas: () => ({ getContext: () => context }),
    getWindowInfo: () => ({ windowWidth: width, windowHeight: height, pixelRatio: 2,
      safeArea: { top: height > width ? 44 : 0, bottom: height - 21 } }),
    getMenuButtonBoundingClientRect: () => ({ top: height > width ? 50 : 6, bottom: height > width ? 82 : 38,
      left: width - 102, right: width - 8 }),
    getStorageSync: key => structuredClone(storage.get(key)),
    setStorageSync(key, value) { writes.push(key); storage.set(key, structuredClone(value)); },
    getLaunchOptionsSync: () => ({}), showShareMenu() {},
    showModal(config) { dialogs.push(config); }, showActionSheet(config) { sheets.push(config); },
    shareAppMessage(value) { shares.push(value); },
    createInnerAudioContext() {
      const listeners = new Set();
      const player = { plays: 0, pauses: 0, destroys: 0, removed: 0,
        play() { this.plays += 1; log.push('play'); return audioPlay && audioPlay(this, players.length); },
        pause() { this.pauses += 1; log.push('pause'); },
        destroy() { this.destroys += 1; log.push('destroy'); },
        onError(callback) { listeners.add(callback); this.lastErrorListener = callback; },
        offError(callback) { this.removed += 1; listeners.delete(callback); },
        emitError(error) { for (const callback of listeners) callback(error); },
      };
      players.push(player); return player;
    },
  };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage', 'AudioInterruptionBegin', 'AudioInterruptionEnd']) {
    const callbacks = new Set(); events.set(name, callbacks);
    platform[`on${name}`] = callback => callbacks.add(callback);
    platform[`off${name}`] = callback => callbacks.delete(callback);
  }
  const app = createMiniGame(platform, { autoTick: false, now: () => time, registry: createRegistry([definition]) });
  t.after(() => app.dispose());
  const emit = (name, value = {}) => [...events.get(name)].map(callback => callback(value));
  return { app, platform, storage, writes, players, dialogs, sheets, shares, log, events, texts, emit,
    get game() { return game; },
    open() { assert.equal(app.activate('openGame', ID), true); return game; },
    click(action) {
      const target = app.targets.find(item => item.action === action);
      assert.ok(target, `missing target ${action}`);
      emit('TouchStart', { changedTouches: [{ identifier: 1, clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 }] });
    },
    advance(ms) { time += ms; app.tick(); },
  };
}

test('host creates no audio in a cold lobby or game menu and uses one shared looping player', t => {
  const f = fixture(t);
  assert.equal(f.app.screen, 'home'); assert.equal(f.players.length, 0);
  for (let index = 0; index < 8; index++) f.app.refresh();
  f.open(); assert.equal(f.players.length, 0);
  f.click(`${ID}:start`);
  assert.equal(f.players.length, 1);
  const player = f.players[0];
  assert.equal(player.plays, 1); assert.equal(player.autoplay, false); assert.equal(player.loop, true);
  assert.equal(player.src, MUSIC_SOURCE); assert.equal(player.volume, MUSIC_VOLUME);
  assert.equal(Object.hasOwn(player, 'obeyMuteSwitch'), false);
  for (let index = 0; index < 20; index++) { f.advance(16); f.app.refresh(); }
  assert.equal(player.plays, 1);
  f.app.activate(`${ID}:pause`); assert.equal(player.pauses, 1);
  f.app.activate(`${ID}:resume`); assert.equal(player.plays, 2);
  f.app.activate(`${ID}:menu`); assert.equal(player.pauses, 2);
  assert.equal(f.players.length, 1);
});

test('background, home and both share entrypoints stop music without bypassing game pause', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0];
  f.emit('Hide'); assert.equal(player.pauses, 1); assert.equal(f.game.model.scene, 'paused');
  f.emit('Show'); f.advance(100); assert.equal(player.plays, 1);
  f.app.activate(`${ID}:resume`); assert.equal(player.plays, 2);
  f.app.activate('share'); assert.equal(player.pauses, 2); assert.equal(f.shares.length, 1);
  assert.equal(f.game.model.scene, 'paused');
  f.app.activate(`${ID}:resume`);
  assert.equal(f.emit('ShareAppMessage')[0].query, `g=${ID}`); assert.equal(player.pauses, 3);
  f.app.activate(`${ID}:resume`); f.app.activate('home'); assert.equal(player.pauses, 4);
  f.app.activate('openGame', ID); assert.equal(player.plays, 4);
  assert.deepEqual(f.game.model.pauses, ['background', 'share', 'share', 'home']);
});

test('native modal and action sheet barriers pause audio and resume once when play remains active', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0];
  for (const [action, queue, result] of [['modal', f.dialogs, { confirm: false }], ['sheet', f.sheets, { tapIndex: 0 }]]) {
    const beforePlay = player.plays, beforePause = player.pauses, beforeTicks = f.game.model.ticks;
    f.app.activate(`${ID}:${action}`);
    assert.equal(player.pauses, beforePause + 1);
    assert.equal(f.app.activate(`${ID}:pause`), false);
    f.advance(1000); assert.equal(f.game.model.ticks, beforeTicks);
    assert.equal(player.plays, beforePlay);
    queue.at(-1).success(result); assert.equal(player.plays, beforePlay + 1);
    queue.at(-1).complete(result); assert.equal(player.plays, beforePlay + 1);
  }
});

test('overlay callbacks apply their final game state before deciding whether music resumes', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0];
  for (const action of ['modal', 'sheet']) {
    f.app.activate(`${ID}:resume`);
    const beforePlay = player.plays;
    f.app.activate(`${ID}:${action}`, 'won');
    const dialog = (action === 'modal' ? f.dialogs : f.sheets).at(-1);
    dialog.success({ confirm: true, tapIndex: 1 }); dialog.complete({});
    assert.equal(f.game.model.scene, 'won');
    assert.equal(player.plays, beforePlay, 'Music must not briefly restart before the callback ends the round');
  }
});

test('overlay complete-only callbacks also apply game state before music can resume', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0];
  for (const action of ['modal', 'sheet']) {
    f.app.activate(`${ID}:resume`);
    const beforePlay = player.plays;
    f.app.activate(`${ID}:${action}`, 'complete-won');
    (action === 'modal' ? f.dialogs : f.sheets).at(-1).complete({});
    assert.equal(f.game.model.scene, 'won'); assert.equal(player.plays, beforePlay);
  }
});

test('audio interruptions stop music and restore it only while foreground gameplay remains active', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0];
  assert.equal(f.events.get('AudioInterruptionBegin').size, 1);
  assert.equal(f.events.get('AudioInterruptionEnd').size, 1);
  f.emit('AudioInterruptionBegin'); assert.equal(player.pauses, 1);
  for (let index = 0; index < 10; index++) f.advance(16);
  assert.equal(player.plays, 1);
  f.emit('AudioInterruptionEnd'); assert.equal(player.plays, 2);
  f.emit('AudioInterruptionBegin');
  f.app.activate(`${ID}:pause`); f.emit('AudioInterruptionEnd');
  assert.equal(player.plays, 2, 'The player remains paused if the game was paused during the interruption');
  f.app.activate(`${ID}:resume`); assert.equal(player.plays, 3);
  f.emit('AudioInterruptionBegin'); f.emit('Hide'); f.emit('AudioInterruptionEnd');
  assert.equal(player.plays, 3, 'Ending an interruption in the background cannot restart audio');
  f.emit('Show'); assert.equal(player.plays, 3, 'Foregrounding cannot bypass the game pause from onHide');
  f.app.activate(`${ID}:resume`); assert.equal(player.plays, 4);
});

test('music toggle persists independently, preserves game saves and remains off after recreation', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const before = structuredClone(f.storage.get(GAME_SAVE)), startWrites = f.writes.length;
  f.click('music:toggle');
  assert.deepEqual(f.storage.get(MUSIC_SETTINGS_KEY), { enabled: false });
  assert.deepEqual(f.storage.get(GAME_SAVE), before);
  assert.deepEqual(f.writes.slice(startWrites), [MUSIC_SETTINGS_KEY]);
  const player = f.players[0];
  f.app.activate(`${ID}:pause`); f.app.activate(`${ID}:resume`); f.advance(100);
  assert.equal(player.plays, 1);
  const second = fixture(t, { initial: [...f.storage] });
  second.open(); second.app.activate(`${ID}:start`); assert.equal(second.players.length, 0);
  second.click('music:toggle'); assert.equal(second.players.length, 1); assert.equal(second.players[0].plays, 1);
  assert.deepEqual(second.storage.get(MUSIC_SETTINGS_KEY), { enabled: true });
});

test('native play errors do not retry on frames but a real canvas click permits retry', t => {
  const f = fixture(t); f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0]; player.emitError({ errCode: 10001 });
  assert.equal(player.plays, 1); assert.equal(player.pauses, 1);
  for (let index = 0; index < 30; index++) f.advance(16);
  assert.equal(player.plays, 1);
  f.click(`${ID}:poke`); assert.equal(player.plays, 2); assert.equal(f.players.length, 1);
  f.app.refresh(); assert.equal(player.plays, 2);
});

test('synchronous play failures stay blocked until a real click retries successfully', t => {
  let first = true;
  const f = fixture(t, { audioPlay() { if (first) { first = false; throw new Error('audio unavailable'); } } });
  f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0]; assert.equal(player.plays, 1);
  f.advance(1000); f.app.refresh(); assert.equal(player.plays, 1);
  f.click(`${ID}:poke`); assert.equal(player.plays, 2);
});

test('enabling music after a synchronous playback failure preserves the useful error message', t => {
  const f = fixture(t, { initial: [[MUSIC_SETTINGS_KEY, { enabled: false }]],
    audioPlay() { throw new Error('device refused playback'); } });
  f.open(); f.app.activate(`${ID}:start`); assert.equal(f.players.length, 0);
  f.click('music:toggle');
  assert.equal(f.players.length, 1); assert.equal(f.players[0].plays, 1);
  assert.deepEqual(f.storage.get(MUSIC_SETTINGS_KEY), { enabled: true });
  assert.equal(f.texts.filter(text => text.includes('音乐')).at(-1), '音乐暂时无法播放，可点击音乐按钮重试');
  assert.equal(f.texts.includes('背景音乐已开启'), false);
});

test('dispose destroys audio, unregisters listeners and ignores late overlay and play failures', async t => {
  let rejectPlay;
  const f = fixture(t, { audioPlay: () => new Promise((_resolve, reject) => { rejectPlay = reject; }) });
  f.open(); f.app.activate(`${ID}:start`);
  const player = f.players[0], lateError = player.lastErrorListener;
  f.app.activate(`${ID}:modal`, 'playing');
  const modal = f.dialogs[0];
  f.app.dispose();
  assert.equal(player.destroys, 1); assert.equal(player.removed, 1); assert.equal(f.game.model.disposed, true);
  assert.ok([...f.events.values()].every(callbacks => callbacks.size === 0));
  modal.success({ confirm: true }); modal.complete({}); lateError({ errCode: 10002 });
  rejectPlay(new Error('late browser play rejection')); await Promise.resolve(); await Promise.resolve();
  f.app.refresh(); f.app.tick(); assert.equal(f.app.activate('music:toggle'), false);
  assert.equal(player.plays, 1); assert.equal(player.destroys, 1); assert.equal(f.game.model.callbacks, 0);
});

test('a module without the optional music activity contract remains quiet', t => {
  const f = fixture(t, { withMusic: false });
  f.open(); f.app.activate(`${ID}:start`); f.advance(100);
  assert.equal(f.players.length, 0);
});

test('the shared 44px music control is available in the lobby and every game scene', t => {
  for (const [width, height] of [[320, 568], [390, 844], [480, 320], [844, 390]]) {
    const f = fixture(t, { width, height });
    for (const action of [null, 'open', 'start', 'pause', 'menu']) {
      if (action === 'open') f.open(); else if (action) f.app.activate(`${ID}:${action}`);
      const target = f.app.targets.find(item => item.action === 'music:toggle');
      assert.ok(target); assert.equal(target.w, 44); assert.equal(target.h, 44);
      assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.w <= width && target.y + target.h <= height);
      assert.match(target.label, /背景音乐/);
    }
  }
});
