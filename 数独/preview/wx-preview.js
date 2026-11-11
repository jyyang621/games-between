// Browser-only wx adapter for testing the same Canvas modules on a local page.
(() => {
  const canvas = document.querySelector('#game');
  const phone = document.querySelector('.phone');
  const modal = document.querySelector('#modal');
  const handlers = new Map();
  const emit = (name, value = {}) => { for (const fn of handlers.get(name) || []) fn(value); };
  let cancelModal = null;
  // Accessible controls share the native renderer's exact hit regions. They
  // dispatch native touch events, so local browser QA follows the real path.
  let targetSignature = '';
  window.onNativeRender = ({ screen, targets, statusText, theme }) => {
    phone.dataset.theme = theme || 'light';
    const layer = document.querySelector('.targets');
    const signature = JSON.stringify([screen, targets]);
    if (signature !== targetSignature) {
      targetSignature = signature;
      layer.replaceChildren();
      for (const target of targets) {
        const button = document.createElement('button'); button.type = 'button';
        button.setAttribute('aria-label', target.label || target.action);
        Object.assign(button.style, { left: `${target.x}px`, top: `${target.y}px`, width: `${target.w}px`, height: `${target.h}px` });
        button.onclick = event => { if (event.detail !== 0) return; const point = { clientX: target.x + target.w / 2, clientY: target.y + target.h / 2 }; emit('TouchStart', { touches: [point], changedTouches: [point] }); emit('TouchEnd', { touches: [], changedTouches: [point] }); };
        layer.append(button);
      }
    }
    const output = document.querySelector('#game-status');
    if (output.textContent !== statusText) output.textContent = statusText;
  };
  function showDialog(title, content, buttons) {
    if (modal.open) modal.close();
    modal.querySelector('h2').textContent = title;
    const body = modal.querySelector('section'); body.replaceChildren();
    if (typeof content === 'string') { const p = document.createElement('p'); p.textContent = content; body.append(p); }
    else if (content) body.append(content);
    const actions = modal.querySelector('.buttons'); actions.replaceChildren();
    for (const { text, primary, onClick } of buttons) {
      const button = document.createElement('button'); button.textContent = text;
      if (primary) button.className = 'primary';
      button.onclick = () => { modal.close(); cancelModal = null; onClick(); };
      actions.append(button);
    }
    modal.showModal();
  }
  modal.addEventListener('cancel', event => { event.preventDefault(); modal.close(); if (cancelModal) cancelModal(); cancelModal = null; });
  const query = () => Object.fromEntries(new URLSearchParams(location.search));
  const wx = {
    createInnerAudioContext() {
      const element = document.createElement('audio');
      element.hidden = true; element.preload = 'auto'; element.dataset.previewMusic = 'true';
      document.body.append(element);
      const events = { error: new Set(), play: new Set(), pause: new Set(), ended: new Set() };
      const emitAudio = (name, value) => { for (const callback of [...events[name]]) callback(value); };
      element.addEventListener('playing', () => emitAudio('play'));
      element.addEventListener('pause', () => emitAudio('pause'));
      element.addEventListener('ended', () => emitAudio('ended'));
      element.addEventListener('error', () => emitAudio('error', { errCode: 10003, errMsg: '本地音乐加载失败' }));
      let disposed = false, attempt = 0;
      return {
        get src() { return element.getAttribute('src') || ''; },
        set src(value) {
          const asset = String(value).replace(/^\/+/, '');
          element.src = asset.startsWith('assets/') ? `/wechat-assets/${asset.slice('assets/'.length)}` : '';
        },
        get loop() { return element.loop; }, set loop(value) { element.loop = Boolean(value); },
        get volume() { return element.volume; }, set volume(value) { element.volume = value; },
        get paused() { return element.paused; }, get currentTime() { return element.currentTime; },
        play() {
          if (disposed) return;
          const id = ++attempt;
          const pending = element.play();
          if (pending && pending.catch) pending.catch(error => {
            if (!disposed && id === attempt && error.name !== 'AbortError') emitAudio('error', { errCode: 10001, errMsg: String(error.message || error) });
          });
        },
        pause() { attempt += 1; element.pause(); },
        stop() { attempt += 1; element.pause(); element.currentTime = 0; },
        onError(callback) { events.error.add(callback); }, offError(callback) { events.error.delete(callback); },
        onPlay(callback) { events.play.add(callback); }, offPlay(callback) { events.play.delete(callback); },
        onPause(callback) { events.pause.add(callback); }, offPause(callback) { events.pause.delete(callback); },
        onEnded(callback) { events.ended.add(callback); }, offEnded(callback) { events.ended.delete(callback); },
        destroy() { disposed = true; attempt += 1; element.pause(); element.removeAttribute('src'); element.load(); element.remove(); for (const listeners of Object.values(events)) listeners.clear(); },
      };
    },
    createCanvas: () => canvas,
    getWindowInfo() {
      const width = phone.clientWidth, height = phone.clientHeight;
      return { windowWidth: width, windowHeight: height, pixelRatio: window.devicePixelRatio,
        statusBarHeight: 44, safeArea: { top: 44, bottom: height - 24, left: 0, right: width } };
    },
    getMenuButtonBoundingClientRect() { const width = phone.clientWidth; return { left: width - 100, right: width - 10, top: 50, bottom: 82, width: 90, height: 32 }; },
    getLaunchOptionsSync: () => ({ query: query() }),
    getStorageSync(key) { const value = localStorage.getItem(`wx-preview:${key}`); return value ? JSON.parse(value) : ''; },
    setStorageSync(key, value) { localStorage.setItem(`wx-preview:${key}`, JSON.stringify(value)); },
    showShareMenu() {},
    shareAppMessage(payload) {
      const input = document.createElement('textarea'); input.readOnly = true;
      input.value = `${location.origin}${location.pathname}?${payload.query}`;
      const content = document.createElement('div');
      const label = document.createElement('p'); label.textContent = '本地预览链接，仅供当前设备调试。正式小游戏的分享需要在微信中验证。';
      content.append(label, input);
      showDialog(payload.title, content, [{ text: '关闭', primary: true, onClick() {} }]);
      input.select();
    },
    showModal(config) {
      const invalid = ['confirmText', 'cancelText'].find(key => config[key] !== undefined &&
        (typeof config[key] !== 'string' || Array.from(config[key]).length > 4));
      if (invalid) {
        const result = { errMsg: 'showModal:fail ' + invalid + ' must contain at most 4 characters' };
        config.fail?.(result); config.complete?.(result); return;
      }
      const finish = confirm => { config.success?.({ confirm, cancel: !confirm }); config.complete?.(); };
      const buttons = [];
      if (config.showCancel !== false) buttons.push({ text: config.cancelText || '取消', onClick: () => finish(false) });
      buttons.push({ text: config.confirmText || '确定', primary: true, onClick: () => finish(true) });
      showDialog(config.title, config.content, buttons); cancelModal = () => finish(false);
    },
    showActionSheet(config) {
      if (!Array.isArray(config.itemList) || config.itemList.length > 6 || config.itemList.some(item => typeof item !== 'string')) {
        const result = { errMsg: 'showActionSheet:fail itemList must contain at most 6 strings' };
        config.fail?.(result); config.complete?.(result); return;
      }
      const list = document.createElement('div'); list.className = 'sheet';
      const done = index => { modal.close(); cancelModal = null; config.success?.({ tapIndex: index }); config.complete?.(); };
      config.itemList.forEach((text, index) => { const button = document.createElement('button'); button.textContent = text; button.onclick = () => done(index); list.append(button); });
      const cancel = () => { config.fail?.({ errMsg: 'showActionSheet:fail cancel' }); config.complete?.(); };
      showDialog('更多', list, [{ text: '取消', onClick: cancel }]); cancelModal = cancel;
    },
  };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'ShareAppMessage']) {
    wx[`on${name}`] = callback => { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback); };
    wx[`off${name}`] = callback => handlers.get(name)?.delete(callback);
  }
  const pointers = new Map();
  function pointerEvent(name, event) {
    const box = canvas.getBoundingClientRect();
    const point = { clientX: event.clientX - box.left, clientY: event.clientY - box.top, identifier: event.pointerId };
    if (name === 'TouchStart') { pointers.set(event.pointerId, point); phone.setPointerCapture(event.pointerId); }
    else if (!pointers.has(event.pointerId)) return;
    else if (name === 'TouchEnd' || name === 'TouchCancel') pointers.delete(event.pointerId);
    else pointers.set(event.pointerId, point);
    emit(name, { touches: [...pointers.values()], changedTouches: [point] });
    event.preventDefault();
  }
  for (const [type, name] of [['pointerdown', 'TouchStart'], ['pointermove', 'TouchMove'], ['pointerup', 'TouchEnd'], ['pointercancel', 'TouchCancel']]) {
    phone.addEventListener(type, event => pointerEvent(name, event));
  }
  window.addEventListener('resize', () => emit('WindowResize'));
  document.addEventListener('visibilitychange', () => emit(document.hidden ? 'Hide' : 'Show'));
  window.addEventListener('pagehide', () => emit('Hide'));
  window.wx = wx;
})();
