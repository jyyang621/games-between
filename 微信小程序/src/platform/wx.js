'use strict';

/** Canvas, safe areas, subscriptions and the sole frame timer belong to the host. */
function createWxRuntime(platform, options = {}) {
  const canvas = options.canvas || platform.createCanvas();
  const context = canvas.getContext('2d');
  const subscriptions = [];
  let timer = null;

  function resize() {
    let info = {};
    try { info = platform.getWindowInfo ? platform.getWindowInfo() : platform.getSystemInfoSync(); } catch {}
    const width = Number(info.windowWidth) || 375;
    const height = Number(info.windowHeight) || 667;
    const dpr = Math.max(1, Math.min(3, Number(info.pixelRatio) || 1));
    const safeTop = info.safeArea ? Number(info.safeArea.top) || 0 : Number(info.statusBarHeight) || 0;
    const safeBottom = info.safeArea ? Math.max(0, height - Number(info.safeArea.bottom || height)) : 0;
    let capsuleRect = null;
    try { capsuleRect = platform.getMenuButtonBoundingClientRect ? platform.getMenuButtonBoundingClientRect() : null; } catch {}
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (context.setTransform) context.setTransform(dpr, 0, 0, dpr, 0, 0);
    else context.scale(dpr, dpr);
    return { width, height, safeTop, safeBottom, capsuleRect, dpr };
  }

  function bind(name, callback) {
    if (typeof platform[name] !== 'function') return;
    platform[name](callback);
    subscriptions.push([name.replace(/^on/, 'off'), callback]);
  }
  function stopLoop() { if (timer !== null) clearInterval(timer); timer = null; }
  function startLoop(callback, interval = 16) {
    stopLoop();
    if (options.autoTick !== false) timer = setInterval(callback, Math.max(16, Math.min(1000, interval)));
  }
  function dispose() {
    stopLoop();
    for (const [name, callback] of subscriptions.splice(0)) {
      if (typeof platform[name] === 'function') platform[name](callback);
    }
  }
  return { canvas, context, resize, bind, startLoop, stopLoop, dispose };
}

module.exports = { createWxRuntime };
