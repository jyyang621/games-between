'use strict';

const { registry: defaultRegistry } = require('../registry.js');
const { createStorage } = require('../platform/storage.js');
const { createWxRuntime } = require('../platform/wx.js');
const { createHubLayout, renderHub, PAGE_SIZE } = require('../hub/renderer.js');
const { normalizedTouches, hitTarget } = require('./input.js');
const { validateGameModule } = require('./game-contract.js');
const { createMusic } = require('../platform/music.js');
const { musicControl, renderMusicControl } = require('./music-control.js');

const HUB_SAVE_KEY = 'games-between:hub:v1';

/** Owns navigation and platform lifecycle; gameplay belongs entirely to modules. */
function createMiniGame(platform, options = {}) {
  const now = options.now || Date.now;
  const registry = options.registry || defaultRegistry;
  const storage = createStorage(platform);
  const runtime = createWxRuntime(platform, options);
  const instances = new Map();
  const savedHub = storage.read(HUB_SAVE_KEY);
  const savedEntry = savedHub && registry.get(savedHub.lastGameId);
  let lastGameId = savedEntry && savedEntry.status === 'ready' ? savedEntry.id : null;
  let resumeText = savedHub && typeof savedHub.resumeText === 'string' ? savedHub.resumeText.slice(0, 160) : '';
  let resumeAvailable = savedHub && typeof savedHub.resumeAvailable === 'boolean' ? savedHub.resumeAvailable : Boolean(lastGameId);
  let activeId = null;
  let viewport;
  let hubLayout;
  let musicArea;
  let targets = [];
  let hubPage = 0;
  let generation = 0;
  let disposed = false;
  let background = false;
  let audioInterrupted = false;
  let modalDepth = 0;
  let lastTick = now();
  let lastSaveAt = now();
  let toastText = '';
  let toastTimer = null;
  let userGesture = false;
  const music = createMusic({ platform, read: storage.read, write: storage.write,
    onError: () => toast('音乐暂时无法播放，可点击音乐按钮重试'),
  });

  const active = () => activeId ? instances.get(activeId) || null : null;
  const currentScreen = () => activeId || 'home';
  const canInteract = () => !disposed && !background && modalDepth === 0;

  function syncClock() {
    const timestamp = now();
    const delta = Math.max(0, timestamp - lastTick);
    lastTick = timestamp;
    if (canInteract() && active()) active().tick(delta);
  }

  function resumeInfo() {
    const lastEntry = registry.get(lastGameId);
    const entry = lastEntry && lastEntry.status === 'ready' ? lastEntry : registry.list().find(item => item.status === 'ready');
    if (!entry) return null;
    const instance = instances.get(entry.id);
    const info = instance && typeof instance.getResumeInfo === 'function' ? instance.getResumeInfo() : null;
    return { id: entry.id, title: entry.title, icon: entry.icon,
      text: info && typeof info.text === 'string' ? info.text : entry.id === lastGameId ? resumeText : '',
      available: info ? Boolean(info.available) : Boolean(entry.id === lastGameId && resumeAvailable),
    };
  }

  function saveCurrent() {
    const current = active();
    if (!current) return;
    current.save();
    lastGameId = activeId;
    const info = typeof current.getResumeInfo === 'function' ? current.getResumeInfo() : null;
    resumeText = info && typeof info.text === 'string' ? info.text.slice(0, 160) : String(current.statusText || '').slice(0, 160);
    resumeAvailable = info ? Boolean(info.available) : true;
    storage.write(HUB_SAVE_KEY, { version: 1, lastGameId, resumeText, resumeAvailable });
    lastSaveAt = now();
  }

  function suspend(reason) {
    if (!active()) return;
    active().pointer('cancel', []);
    active().pause(reason);
    saveCurrent();
  }

  function drawToast() {
    if (!toastText || !viewport) return;
    const ctx = runtime.context;
    const width = Math.min(viewport.width - 32, 380);
    const x = (viewport.width - width) / 2;
    const y = Math.max(viewport.safeTop, viewport.height - viewport.safeBottom - 105);
    ctx.save(); ctx.fillStyle = 'rgba(38,60,53,.96)'; ctx.fillRect(x, y, width, 42);
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(toastText, viewport.width / 2, y + 21, width - 24); ctx.restore();
  }

  function refresh() {
    if (disposed || !viewport) return;
    const current = active();
    const wantsMusic = canInteract() && !audioInterrupted && Boolean(current && current.musicActive === true);
    const gesture = userGesture;
    userGesture = false;
    music.setPlaying(wantsMusic, { userGesture: gesture });
    targets = current ? current.render(runtime.context) : renderHub(runtime.context, hubLayout, registry.list(), {
      page: hubPage, resume: resumeInfo(), storageAvailable: storage.available,
    });
    targets.push(renderMusicControl(runtime.context, musicArea, music.enabled, music.status === 'playing', music.status !== 'unsupported'));
    drawToast();
    if (typeof options.onRender === 'function') options.onRender({
      screen: currentScreen(), gameId: activeId, activeGame: current, targets,
      statusText: current ? String(current.statusText || registry.get(activeId).title) : '游戏大厅',
      theme: current ? current.theme || registry.get(activeId).theme || 'light' : 'light',
    });
  }

  function toast(message) {
    if (disposed) return;
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastText = String(message || ''); refresh();
    toastTimer = setTimeout(() => { toastTimer = null; toastText = ''; refresh(); }, 2300);
  }

  function overlay(owner, name, config, onConfirm) {
    if (disposed || activeId !== owner) return false;
    if (typeof platform[name] !== 'function') { toast('此功能暂不可用'); return false; }
    syncClock(); modalDepth += 1; music.setPlaying(false);
    const ownerGeneration = generation;
    let finished = false;
    const finish = (redraw = true) => {
      if (finished) return;
      finished = true; modalDepth = Math.max(0, modalDepth - 1); lastTick = now();
      if (redraw) refresh();
    };
    const respond = callback => result => {
      finish(false);
      if (!disposed && activeId === owner && generation === ownerGeneration && typeof callback === 'function') {
        callback(result);
        if (background && active()) active().pause('background');
      }
      refresh();
    };
    try {
      platform[name]({ ...config,
        success: respond(result => {
          if (typeof config.success === 'function') config.success(result);
          if (result.confirm && typeof onConfirm === 'function') onConfirm();
        }),
        fail: respond(result => { if (typeof config.fail === 'function') config.fail(result); }),
        complete: result => { finish(false); if (!disposed && activeId === owner && generation === ownerGeneration && typeof config.complete === 'function') config.complete(result); refresh(); },
      });
      return true;
    } catch { finish(); toast('暂时无法打开，请稍后再试'); return false; }
  }

  function servicesFor(id) {
    return {
      toast: message => { if (activeId === id) toast(message); },
      modal: (config, onConfirm) => overlay(id, 'showModal', config, onConfirm),
      actionSheet: config => overlay(id, 'showActionSheet', config),
      home: () => activeId === id && activate('home'),
      invalidate: () => { if (activeId === id) refresh(); },
      get storageAvailable() { return storage.available; },
    };
  }

  function load(entry) {
    if (!instances.has(entry.id)) {
      const instance = validateGameModule(entry.create({ read: storage.read, write: storage.write, now, services: servicesFor(entry.id) }), entry.id);
      instance.resize(viewport);
      instances.set(entry.id, instance);
    }
    return instances.get(entry.id);
  }

  function restartLoop() {
    runtime.stopLoop();
    if (!active() || disposed || background) return;
    const interval = Number(active().frameInterval);
    runtime.startLoop(() => {
      if (disposed || background) return;
      syncClock();
      if (now() - lastSaveAt >= 5000) saveCurrent();
      refresh();
    }, Number.isFinite(interval) && interval > 0 ? interval : 16);
  }

  function openGame(id, query = {}, source = 'hub') {
    const entry = registry.get(id);
    if (!entry) return false;
    if (entry.status !== 'ready') { toast(`${entry.title} · 敬请期待`); return false; }
    let instance;
    try { instance = load(entry); }
    catch { toast(`暂时无法进入${entry.title}`); return false; }
    if (activeId !== id) suspend('navigation');
    generation += 1;
    activeId = id; toastText = '';
    instance.resize(viewport);
    if (typeof instance.enter === 'function') instance.enter(query, { source });
    lastTick = now(); saveCurrent(); refresh(); restartLoop(); return true;
  }

  function home() {
    suspend('home'); activeId = null; generation += 1; toastText = '';
    lastTick = now(); runtime.stopLoop(); refresh(); return true;
  }

  function sharePayload() {
    const current = active();
    if (!current) return { title: '游戏之间 · 给快乐一点时间', query: 'g=home' };
    if (typeof current.sharePayload === 'function') return current.sharePayload();
    return { title: `一起来玩${registry.get(activeId).title} · 游戏之间`, query: `g=${activeId}` };
  }

  function prepareShare() {
    syncClock(); suspend('share'); refresh(); return sharePayload();
  }

  function activate(action, payload) {
    if (!canInteract()) return false;
    userGesture = true;
    syncClock();
    if (action === 'music:toggle') {
      userGesture = false; // toggle() consumes this gesture for its own play attempt.
      music.toggle();
      if (!music.enabled) toast('背景音乐已关闭');
      else if (!['blocked', 'unsupported'].includes(music.status)) toast('背景音乐已开启');
      refresh(); return true;
    }
    if (action === 'home') return home();
    if (action === 'openGame' || action === 'resumeGame') return openGame(payload);
    if (action === 'comingSoon') { const entry = registry.get(payload); if (entry) toast(`${entry.title} · 敬请期待`); return false; }
    if (action === 'hub:page' && !active()) {
      const pages = Math.max(1, Math.ceil(registry.list().length / PAGE_SIZE));
      if (!Number.isInteger(payload) || payload < 0 || payload >= pages || payload === hubPage) return false;
      hubPage = payload; refresh(); return true;
    }
    if (action === 'share') {
      const value = prepareShare();
      try { if (platform.shareAppMessage) platform.shareAppMessage(value); else toast('请使用右上角菜单分享'); }
      catch { toast('请使用右上角菜单分享'); }
      return true;
    }
    if (!active()) { userGesture = false; return false; }
    const changed = active().activate(action, payload);
    if (changed) saveCurrent();
    refresh();
    return Boolean(changed);
  }

  function resize() {
    const nextViewport = runtime.resize();
    if (viewport && active() && (viewport.width !== nextViewport.width || viewport.height !== nextViewport.height)) {
      suspend('resize'); generation += 1;
    }
    const control = musicControl(nextViewport);
    musicArea = control.area;
    viewport = { ...nextViewport, capsuleRect: control.exclusion };
    hubLayout = createHubLayout(viewport.width, viewport.height, viewport.safeTop, viewport.safeBottom, viewport.capsuleRect);
    if (active()) active().resize(viewport);
    refresh();
  }

  function resolveQuery(query) {
    if (!query || typeof query !== 'object') return null;
    return typeof registry.resolve === 'function' ? registry.resolve(query) : registry.get(query.g);
  }

  resize();
  runtime.bind('onTouchStart', event => {
    if (!canInteract()) return;
    userGesture = true;
    syncClock();
    const originalGeneration = generation;
    for (const touch of normalizedTouches(event)) {
      const hit = hitTarget(targets, touch);
      if (hit) activate(hit.action, hit.payload);
      else if (active()) { active().pointer('start', [touch]); refresh(); }
      if (generation !== originalGeneration || !canInteract()) break;
    }
  });
  for (const [name, type] of [['onTouchMove', 'move'], ['onTouchEnd', 'end'], ['onTouchCancel', 'cancel']]) {
    runtime.bind(name, event => {
      if (!canInteract() || !active()) return;
      syncClock(); active().pointer(type, normalizedTouches(event)); refresh();
    });
  }
  runtime.bind('onHide', () => { syncClock(); suspend('background'); generation += 1; background = true; music.setPlaying(false); runtime.stopLoop(); });
  runtime.bind('onAudioInterruptionBegin', () => { audioInterrupted = true; music.setPlaying(false); refresh(); });
  runtime.bind('onAudioInterruptionEnd', () => { audioInterrupted = false; refresh(); });
  runtime.bind('onShow', event => {
    if (disposed) return;
    background = false; lastTick = now();
    const query = event && event.query;
    if (query && query.g === 'home') home();
    else { const entry = resolveQuery(query); if (entry) openGame(entry.id, query, 'show'); }
    resize(); restartLoop();
  });
  runtime.bind('onWindowResize', () => { syncClock(); resize(); });
  runtime.bind('onShareAppMessage', prepareShare);
  try { if (platform.showShareMenu) platform.showShareMenu({ menus: ['shareAppMessage'] }); } catch {}
  let launch = {};
  try { launch = platform.getLaunchOptionsSync ? platform.getLaunchOptionsSync() || {} : {}; } catch {}
  const launchEntry = resolveQuery(launch.query);
  if (launchEntry) openGame(launchEntry.id, launch.query, 'launch');

  return {
    canvas: runtime.canvas, activate, refresh, sharePayload,
    tick() { syncClock(); refresh(); },
    get activeGame() { return active(); },
    get gameId() { return activeId; },
    get screen() { return currentScreen(); },
    get layout() { return active() && active().layout || (active() ? viewport : hubLayout); },
    get targets() { return targets; },
    dispose() {
      if (disposed) return;
      syncClock(); suspend('dispose'); disposed = true;
      music.dispose();
      if (toastTimer !== null) clearTimeout(toastTimer);
      runtime.dispose();
      for (const instance of instances.values()) if (typeof instance.dispose === 'function') instance.dispose();
      instances.clear(); activeId = null;
    },
  };
}

module.exports = { createMiniGame, HUB_SAVE_KEY };
