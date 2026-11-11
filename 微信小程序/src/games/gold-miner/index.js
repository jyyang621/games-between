'use strict';

const { MineEngine } = require('./core/engine.js');
const { MineRenderer } = require('./core/renderer.js');
const { getLevel, CAMPAIGN_LEVEL_COUNT, MAX_ENDLESS_LEVEL } = require('./core/levels.js');
const { MODE_LABELS, emptyMatch, scoreRound, roundWinner } = require('./core/modes.js');
const { loadSave, saveGame, clearRun } = require('./core/storage.js');

const PRODUCTS = Object.freeze([
  { key: 'bomb', name: '随身炸药', price: 100, limit: 2, detail: '炸掉钩中物品，节省回收时间' },
  { key: 'strength', name: '力量药水', price: 250, limit: 1, detail: '下一关携物回收速度提高 35%' },
  { key: 'diamond', name: '钻石增值券', price: 300, limit: 1, detail: '下一关钻石和含钻猪的钻石增值 50%' },
]);
const SETTINGS_KEY = 'gold-miner-settings-v1';
const clone = value => JSON.parse(JSON.stringify(value));
const money = value => '¥' + String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const freshRun = () => ({ levelIndex: 0, wallet: 0, bombs: 0, strength: false, diamondBonus: false, totalEarned: 0 });

/** Canvas-only adapter for the original Golden Valley game. delta is milliseconds. */
function createGoldMinerGame({ read = () => null, write = () => false, now = Date.now } = {}) {
  let preferences;
  try { preferences = read(SETTINGS_KEY); if (typeof preferences === 'string') preferences = JSON.parse(preferences); } catch { preferences = null; }
  let mode = preferences && ['solo', 'coop', 'versus'].includes(preferences.mode) ? preferences.mode : 'solo';
  let endless = !!(preferences && preferences.endless === true);
  let data = loadSave(mode, endless, read);
  let checkpoint = clone(data.shop || data.checkpoint || freshRun());
  let engine;
  let renderer = null;
  let scene = 'menu';
  let beforeHelp = 'menu';
  let helpPage = 0;
  let pendingStart = 0;
  let completedMatch = null;
  let elapsed = 0;
  let frameDelta = 0;
  let accumulator = 0;
  let warning = '';
  let toast = '';
  let toastLeft = 0;
  let targets = [];
  let screen = { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: null };
  let layout;
  let panelScroll = 0;
  let panelMaxScroll = 0;
  let panelClip = null;
  let scrollTouch = null;
  let dirtyLevel = true;

  const isDuo = () => mode !== 'solo';
  const stageUnit = () => mode === 'versus' ? '轮' : endless ? '层' : '关';
  const levelFor = run => getLevel(run.levelIndex, endless, run.seed === undefined ? 1 : run.seed);
  const finalLevel = () => checkpoint.levelIndex === (endless ? MAX_ENDLESS_LEVEL : CAMPAIGN_LEVEL_COUNT) - 1;
  const modeLabel = () => `${endless ? '无尽矿场' : '40 关闯关'} · ${MODE_LABELS[mode]}`;
  const stageLabel = () => `第 ${checkpoint.levelIndex + 1}${endless ? '' : ' / ' + CAMPAIGN_LEVEL_COUNT} ${stageUnit()}`;

  function persist() {
    const saved = saveGame(data, mode, endless, write);
    let settingsSaved = true;
    try { settingsSaved = write(SETTINGS_KEY, { mode, endless }) !== false; } catch { settingsSaved = false; }
    warning = saved && settingsSaved ? '' : '本机存档暂不可用，本次仍可继续游玩';
    return saved;
  }
  function notify(message) { toast = message; toastLeft = 3; }
  function setScene(next) { scene = next; panelScroll = 0; panelMaxScroll = 0; scrollTouch = null; }
  function newEngine(run) {
    engine = new MineEngine(levelFor(run), {
      ...run, playerCount: isDuo() ? 2 : 1,
      ...(mode === 'versus' ? { bombStocks: [1, 1] } : {}),
    });
    if (layout) engine.setViewport(layout.world);
    dirtyLevel = true;
  }
  function menu() {
    checkpoint = clone(data.shop || data.checkpoint || freshRun());
    completedMatch = null;
    newEngine(checkpoint);
    setScene('menu');
  }
  function prepare(run) {
    checkpoint = clone(run);
    data.checkpoint = clone(checkpoint);
    data.shop = null;
    completedMatch = null;
    accumulator = 0;
    newEngine(checkpoint);
    setScene('ready');
    persist();
  }
  function startNew(force = false, index = 0) {
    if (!force && (data.checkpoint || data.shop)) {
      pendingStart = index;
      setScene('confirm');
      return;
    }
    data = clearRun(data, mode, endless);
    const run = { ...freshRun(), levelIndex: index };
    if (endless) run.seed = (Math.floor(now()) ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    if (mode === 'versus') run.match = emptyMatch();
    prepare(run);
  }
  function continueRun() {
    if (data.shop) openShop();
    else if (data.checkpoint) prepare(data.checkpoint);
    else startNew();
  }
  function choose(nextMode, nextEndless) {
    if (scene !== 'menu') return false;
    persist();
    mode = nextMode;
    endless = nextEndless;
    data = loadSave(mode, endless, read);
    menu();
    persist();
    return true;
  }
  function play() {
    if (scene !== 'ready' && scene !== 'paused') return false;
    setScene('playing');
    accumulator = 0;
    return true;
  }
  function pause() {
    if (scene === 'playing') { setScene('paused'); accumulator = 0; }
    persist();
  }
  function settle() {
    if (scene !== 'playing' || !engine.ended) return;
    setScene('result');
    if (mode === 'versus') {
      completedMatch = scoreRound(checkpoint.match || emptyMatch(), [engine.players[0].income, engine.players[1].income]);
      const total = completedMatch.totals[0] + completedMatch.totals[1];
      data.bestEarned = Math.max(data.bestEarned, total);
      data.highestCleared = Math.max(data.highestCleared, engine.level.id);
      data.shop = null;
      if (finalLevel()) { data = clearRun(data, mode, endless); setScene('complete'); }
      else data.checkpoint = {
        levelIndex: checkpoint.levelIndex + 1, wallet: total, bombs: 0,
        strength: false, diamondBonus: false, totalEarned: total, match: clone(completedMatch),
        ...(checkpoint.seed === undefined ? {} : { seed: checkpoint.seed }),
      };
    } else if (engine.won) {
      const total = checkpoint.totalEarned + engine.income;
      data.bestEarned = Math.max(data.bestEarned, total);
      data.highestCleared = Math.max(data.highestCleared, engine.level.id);
      if (finalLevel()) { data = clearRun(data, mode, endless); setScene('complete'); }
      else {
        data.checkpoint = null;
        data.shop = {
          levelIndex: checkpoint.levelIndex + 1, wallet: checkpoint.wallet + engine.income,
          bombs: engine.bombs, strength: false, diamondBonus: false, totalEarned: total,
          purchaseCounts: { bomb: 0, strength: 0, diamond: 0 },
          ...(checkpoint.seed === undefined ? {} : { seed: checkpoint.seed }),
        };
      }
    } else if (endless) {
      data.bestEarned = Math.max(data.bestEarned, checkpoint.totalEarned + engine.income);
      data = clearRun(data, mode, endless);
    }
    persist();
  }
  function openShop() {
    if (mode === 'versus' || !data.shop) return false;
    newEngine(data.shop);
    setScene('shop');
    return true;
  }
  function hasDiamonds() { return !!data.shop && levelFor(data.shop).ores.some(ore => ore.kind === 'diamond' || ore.kind === 'diamondPig'); }
  function productState(product) {
    const shop = data.shop;
    if (!shop) return { disabled: true, reason: '暂无商店' };
    if (shop.purchaseCounts[product.key] >= product.limit) return { disabled: true, reason: '本店已购满' };
    if (product.key === 'bomb' && shop.bombs >= 5) return { disabled: true, reason: '库存已满' };
    if (product.key === 'diamond' && !hasDiamonds()) return { disabled: true, reason: '下关没有钻石' };
    if (shop.wallet < product.price) return { disabled: true, reason: `还差 ${money(product.price - shop.wallet)}` };
    return { disabled: false, reason: `购买 · ${money(product.price)}` };
  }
  function buy(key) {
    const product = PRODUCTS.find(item => item.key === key);
    if (scene !== 'shop' || !product || productState(product).disabled) return false;
    data.shop.wallet -= product.price;
    data.shop.purchaseCounts[key]++;
    if (key === 'bomb') data.shop.bombs++;
    else if (key === 'strength') data.shop.strength = true;
    else data.shop.diamondBonus = true;
    persist();
    notify(`已购买${product.name}`);
    return true;
  }

  function resize(view = {}) {
    const previousPortrait = layout && layout.world.portrait;
    screen = {
      width: Number.isFinite(view.width) && view.width >= 240 ? view.width : screen.width,
      height: Number.isFinite(view.height) && view.height >= 240 ? view.height : screen.height,
      safeTop: Math.max(0, Number(view.safeTop) || 0),
      safeBottom: Math.max(0, Number(view.safeBottom) || 0),
      capsuleRect: view.capsuleRect || null,
    };
    const { width, height, safeTop, safeBottom, capsuleRect } = screen;
    const compact = height < 520;
    const capsuleBottom = capsuleRect && Number(capsuleRect.bottom || capsuleRect.top + capsuleRect.height);
    const headerTop = Math.max(safeTop + 4, Number.isFinite(capsuleBottom) ? capsuleBottom + 6 : 0);
    const headerBottom = headerTop + 38;
    const hudY = headerBottom + 6;
    const hudH = compact ? 42 : 64;
    const controlsH = compact ? 58 : 76;
    const controlsY = Math.max(hudY + hudH + 70, height - safeBottom - controlsH - 8);
    const mine = { x: 0, y: hudY + hudH + 6, w: width, h: Math.max(70, controlsY - hudY - hudH - 12) };
    const portrait = width < height;
    const world = { width: portrait ? 720 : 1280, height: portrait ? Math.max(740, Math.round(720 * mine.h / mine.w)) : 720, portrait };
    const mineScale = Math.min(mine.w / world.width, mine.h / world.height);
    const drawX = (mine.w - world.width * mineScale) / 2;
    const drawY = mine.y + (mine.h - world.height * mineScale) / 2;
    layout = { headerTop, headerBottom, hudY, hudH, controlsY, controlsH, mine, world, mineScale, drawX, drawY, compact };
    if (engine) engine.setViewport(world);
    if (renderer) renderer.resize(world, mineScale);
    if (previousPortrait !== undefined && previousPortrait !== portrait && scene === 'playing') {
      pause();
      notify('矿场已适配方向，点击继续挖金');
    }
    panelScroll = 0;
  }

  function tick(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(0.1, delta / 1000);
    if (scene !== 'paused' && scene !== 'help') elapsed += dt;
    if (toastLeft > 0) { toastLeft = Math.max(0, toastLeft - dt); if (!toastLeft) toast = ''; }
    frameDelta = Math.min(.1, frameDelta + dt);
    if (scene !== 'playing') return;
    accumulator += dt;
    while (accumulator >= 1 / 120 && !engine.ended) { engine.update(1 / 120); accumulator -= 1 / 120; }
    const events = engine.drainEvents();
    if (renderer) for (const event of events) renderer.event(event);
    if (engine.ended) settle();
  }

  function activate(action, payload) {
    if (typeof action !== 'string' || !action.startsWith('miner:')) return false;
    const name = action.slice(6);
    if (name === 'launch') return scene === 'playing' && engine.launch(payload === 1 ? 1 : 0);
    if (name === 'bomb') {
      if (scene !== 'playing') return false;
      const result = engine.bomb(payload === 1 ? 1 : 0);
      if (!result) notify('抓到物品且有炸药库存时才能使用');
      return result;
    }
    if (name === 'pause') { if (scene !== 'playing') return false; pause(); return true; }
    if (name === 'resume' || name === 'play') return play();
    if (name === 'mode') return ['solo', 'coop', 'versus'].includes(payload) && choose(payload, endless);
    if (name === 'challenge') return typeof payload === 'boolean' && choose(mode, payload);
    if (name === 'new' && scene === 'menu') { startNew(); return true; }
    if (name === 'new-area' && scene === 'menu' && !endless && mode !== 'versus') { startNew(false, 20); return true; }
    if (name === 'confirm-new' && scene === 'confirm') { startNew(true, pendingStart); return true; }
    if (name === 'force-new' && ['result', 'complete', 'menu'].includes(scene)) { startNew(true); return true; }
    if (name === 'continue' && scene === 'menu') { continueRun(); return true; }
    if (name === 'menu') { persist(); menu(); return true; }
    if (name === 'retry' && ['paused', 'result'].includes(scene) && !(endless && scene === 'result' && !engine.won) && mode !== 'versus') { prepare(checkpoint); return true; }
    if (name === 'finish' && scene === 'playing' && mode !== 'versus' && engine.finish()) { settle(); return true; }
    if (name === 'shop' && scene === 'result' && engine.won) return openShop();
    if (name === 'buy') return buy(payload);
    if (name === 'next' && scene === 'shop' && data.shop) {
      const { purchaseCounts, ...run } = data.shop;
      prepare(run);
      return true;
    }
    if (name === 'versus-next' && scene === 'result' && mode === 'versus' && data.checkpoint) { prepare(data.checkpoint); return true; }
    if (name === 'try-endless' && scene === 'complete') { menu(); choose(mode, true); return true; }
    if (name === 'help') {
      if (scene === 'playing') pause();
      beforeHelp = scene; helpPage = 0; setScene('help'); return true;
    }
    if (name === 'help-page' && scene === 'help') { helpPage = payload === 1 ? 1 : 0; panelScroll = 0; return true; }
    if (name === 'help-back' && scene === 'help') { setScene(beforeHelp); return true; }
    return false;
  }

  function pointer(type, points) {
    if (!Array.isArray(points)) return false;
    if (type === 'start' && scene === 'playing') {
      let acted = false;
      const handled = new Set();
      for (const point of points) {
        const x = Number(point.clientX), y = Number(point.clientY);
        const mine = layout.mine;
        if (x < mine.x || x > mine.x + mine.w || y < mine.y || y > mine.y + mine.h) continue;
        const player = isDuo() && x >= screen.width / 2 ? 1 : 0;
        if (!handled.has(player)) { handled.add(player); acted = engine.launch(player) || acted; }
      }
      return acted;
    }
    const point = points[0];
    if (type === 'start' && point && panelMaxScroll > 0 && panelClip && point.clientY >= panelClip.y && point.clientY <= panelClip.y + panelClip.h) {
      scrollTouch = { y: point.clientY, scroll: panelScroll }; return true;
    }
    if (type === 'move' && scrollTouch && point) {
      panelScroll = Math.max(0, Math.min(panelMaxScroll, scrollTouch.scroll + scrollTouch.y - point.clientY)); return true;
    }
    if (type === 'end' || type === 'cancel') scrollTouch = null;
    return false;
  }

  function round(ctx, x, y, w, h, r, fill, stroke) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function text(ctx, value, x, y, size = 14, color = '#533d27', align = 'left', weight = 500) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y);
  }
  function addTarget(x, y, w, h, action, payload, clip, label) {
    if (clip) {
      const top = Math.max(y, clip.y), bottom = Math.min(y + h, clip.y + clip.h);
      if (bottom - top < 16) return;
      y = top; h = bottom - top;
    }
    targets.push({ x, y, w, h, action, label, ...(payload === undefined ? {} : { payload }) });
  }
  function button(ctx, x, y, w, h, label, action, payload, options = {}) {
    const { primary = false, selected = false, disabled = false, color, clip } = options;
    const fill = disabled ? '#e9dfcb' : color || (primary || selected ? '#88602f' : '#fff9e9');
    round(ctx, x, y, w, h, 11, fill, selected ? '#d6ad58' : '#cfb98e');
    text(ctx, label, x + w / 2, y + h / 2, options.size || 14, disabled ? '#a89a83' : primary || selected || color ? '#fff9e7' : '#64482d', 'center', 700);
    if (!disabled) addTarget(x, y, w, h, action, payload, clip, label);
  }
  function wrapped(ctx, value, x, y, width, size = 14, color = '#806747', lineHeight = 23) {
    let line = '';
    const measure = candidate => {
      const measured = ctx.measureText && ctx.measureText(candidate);
      return measured && Number.isFinite(measured.width) ? measured.width : candidate.length * size;
    };
    ctx.font = `500 ${size}px sans-serif`;
    for (const part of String(value).split('\n')) {
      for (const character of part) {
        if (line && measure(line + character) > width) {
          // Keep closing Chinese punctuation with a preceding character.
          const carry = /[，。！？、；：）】》]/.test(character) ? line.slice(-1) : '';
          text(ctx, carry ? line.slice(0, -1) : line, x, y, size, color);
          y += lineHeight; line = carry;
        }
        line += character;
      }
      text(ctx, line, x, y, size, color); y += lineHeight; line = '';
    }
    return y;
  }

  function drawHeader(ctx) {
    const { width } = screen, y = layout.headerTop;
    button(ctx, 12, y, 66, 34, '‹ 大厅', 'home', undefined, { size: 13 });
    text(ctx, '黄金矿工', 88, y + 17, width < 350 ? 16 : 18, '#f5dfab', 'left', 800);
    const hasPause = scene === 'playing' || scene === 'paused';
    if (hasPause) button(ctx, width - 116, y, 48, 34, scene === 'paused' ? '继续' : '暂停', scene === 'paused' ? 'miner:resume' : 'miner:pause', undefined, { size: 12 });
    button(ctx, width - 60, y, 48, 34, '分享', 'share', undefined, { size: 12 });
  }
  function drawHud(ctx) {
    const { width } = screen, { hudY: y, hudH: h, compact } = layout;
    round(ctx, 12, y, width - 24, h, 12, '#fff4db', '#c8a773');
    const shop = scene === 'shop' ? data.shop : null;
    if (compact) {
      text(ctx, `第${engine.level.id}${stageUnit()}`, 23, y + 21, 13);
      text(ctx, `${Math.ceil(engine.timeLeft)}s`, width * .34, y + 21, 18, engine.timeLeft <= 10 ? '#aa4934' : '#76512a', 'center', 800);
      text(ctx, mode === 'versus' ? `${money(engine.players[0].income)} : ${money(engine.players[1].income)}` : `${money(engine.income)} / ${money(engine.level.target)}`, width - 24, y + 21, 13, '#634c30', 'right');
    } else {
      text(ctx, `${endless ? '无尽' : '闯关'} · 第 ${engine.level.id} ${stageUnit()}`, 24, y + 17, 12, '#8c7654');
      text(ctx, mode === 'versus' ? 'P1 金队 / P2 青队' : '本关收入 / 目标', width * .49, y + 17, 12, '#8c7654', 'center');
      text(ctx, '剩余时间', width - 24, y + 17, 12, '#8c7654', 'right');
      text(ctx, `钱包 ${money(shop ? shop.wallet : checkpoint.wallet + engine.income)}`, 24, y + 41, 13, '#65472b', 'left', 700);
      text(ctx, mode === 'versus' ? `${money(engine.players[0].income)} : ${money(engine.players[1].income)}` : `${money(engine.income)} / ${money(engine.level.target)}`, width * .49, y + 41, 13, '#65472b', 'center', 800);
      text(ctx, `${Math.ceil(engine.timeLeft)}s`, width - 24, y + 40, 25, engine.timeLeft <= 10 ? '#b64a33' : '#78542a', 'right', 800);
    }
  }
  function drawControls(ctx) {
    const { width } = screen, { controlsY: y, controlsH: h } = layout;
    if (scene !== 'playing') return;
    const buttonH = Math.min(50, h - 22), gap = 8;
    if (isDuo()) {
      const groupWidth = (width - 32) / 2;
      for (let player = 0; player < 2; player++) {
        const x = 12 + player * (groupWidth + 8), launchWidth = groupWidth * .6;
        const hook = engine.players[player];
        const color = player ? '#367d70' : '#9b6b2d';
        button(ctx, x, y, launchWidth, buttonH, `P${player + 1} ${hook.phase === 'swing' ? '下钩 ↓' : hook.phase === 'out' ? '下钩中' : '回收中'}`, 'miner:launch', player, { color, disabled: hook.phase !== 'swing', size: 13 });
        button(ctx, x + launchWidth + gap, y, groupWidth - launchWidth - gap, buttonH, `炸药 ${engine.bombStocks ? engine.bombStocks[player] : engine.bombs}`, 'miner:bomb', player, { disabled: !engine.canBombFor(player), size: 11 });
      }
      text(ctx, mode === 'versus' ? '同屏对战 · 左右分别操作 · 各自计分' : '同屏合作 · 左右分别操作 · 共享目标与道具', width / 2, y + buttonH + 15, 11, '#ecd6ad', 'center');
    } else {
      const launchWidth = (width - 32) * .64;
      button(ctx, 12, y, launchWidth, buttonH, engine.phase === 'swing' ? '瞄准好，下钩 ↓' : engine.phase === 'out' ? '抓钩前进中…' : '满载回收中…', 'miner:launch', 0, { primary: true, disabled: engine.phase !== 'swing' });
      button(ctx, 20 + launchWidth, y, width - launchWidth - 32, buttonH, `炸药 × ${engine.bombs}`, 'miner:bomb', 0, { disabled: !engine.canBombFor(0), size: 13 });
      text(ctx, '点击矿区也可下钩 · 拉回才入账', width / 2, y + buttonH + 15, 11, '#ecd6ad', 'center');
    }
    if (mode !== 'versus' && engine.canFinish) button(ctx, width / 2 - 83, y - 42, 166, 34, '目标达成，提前收工 ✓', 'miner:finish', undefined, { primary: true, size: 12 });
  }

  function drawPanel(ctx) {
    if (scene === 'playing') { panelClip = null; panelMaxScroll = 0; return; }
    const width = Math.min(500, screen.width - 24), x = (screen.width - width) / 2;
    const top = layout.headerBottom + 12, bottom = screen.height - screen.safeBottom - 14;
    const panelHeight = Math.max(100, bottom - top);
    ctx.fillStyle = '#251c12aa'; ctx.fillRect(0, layout.headerBottom + 2, screen.width, screen.height - layout.headerBottom - 2);
    round(ctx, x, top, width, panelHeight, 18, '#fff5df', '#c8a56c');
    panelClip = { x: x + 2, y: top + 6, w: width - 4, h: panelHeight - 12 };
    const padding = 20, innerX = x + padding, innerWidth = width - padding * 2;
    ctx.save(); ctx.beginPath(); ctx.rect(panelClip.x, panelClip.y, panelClip.w, panelClip.h); ctx.clip();
    let y = top + 24 - panelScroll;
    const title = (heading, description) => {
      text(ctx, modeLabel(), innerX, y, 11, '#aa8750'); y += 30;
      text(ctx, heading, innerX, y, 25, '#65472b', 'left', 800); y += 30;
      if (description) y = wrapped(ctx, description, innerX, y, innerWidth, 13, '#8d7150', 21) + 6;
    };
    const line = (value, size = 13, color = '#806747') => { y = wrapped(ctx, value, innerX, y, innerWidth, size, color, 22) + 5; };
    const actionButton = (label, action, payload, primary = false, disabled = false) => {
      button(ctx, innerX, y, innerWidth, 43, label, action, payload, { primary, disabled, clip: panelClip }); y += 53;
    };
    const pair = (items, selected) => {
      const w = (innerWidth - 8 * (items.length - 1)) / items.length;
      items.forEach((item, index) => button(ctx, innerX + index * (w + 8), y, w, 41, item.label, item.action, item.payload, { selected: selected === item.payload, size: 12, clip: panelClip }));
      y += 52;
    };
    if (scene === 'menu') {
      title('金谷矿场，开工啦', '抓住金块、钻石和奔跑的猪猪，重温那份满载而归的快乐。');
      pair([{ label: '闯关 · 40 关', action: 'miner:challenge', payload: false }, { label: '无尽 · 随机矿场', action: 'miner:challenge', payload: true }], endless);
      pair(['solo', 'coop', 'versus'].map(item => ({ label: MODE_LABELS[item], action: 'miner:mode', payload: item })), mode);
      const resume = data.shop || data.checkpoint;
      actionButton(resume ? `继续第 ${resume.levelIndex + 1} ${stageUnit()} →` : mode === 'versus' ? '开始对战 →' : '开始挖金 →', resume ? 'miner:continue' : 'miner:new', undefined, true);
      if (resume) actionButton('开启新的挑战', 'miner:new');
      if (!endless && mode !== 'versus') actionButton('新矿区：从第 21 关出发', 'miner:new-area');
      actionButton('挖矿小手册', 'miner:help');
      line(`最高完成 ${data.highestCleared}${endless ? '' : ' / 40'} ${stageUnit()} · 最佳累计 ${money(data.bestEarned)}`, 12);
      line('三种玩法 × 闯关 / 无尽，各自存档。双人在同一台设备游玩。背景音乐可开关，暂无操作音效。', 11, '#a28c6a');
    } else if (scene === 'confirm') {
      title('重新出发一次', '当前玩法已有存档。新挑战将从指定关卡重新开始，最佳成绩和其他模式存档保留。');
      actionButton(`确认从第 ${pendingStart + 1} ${stageUnit()}开始`, 'miner:confirm-new', undefined, true);
      actionButton('保留进度，返回菜单', 'miner:menu');
    } else if (scene === 'ready') {
      title(engine.level.name, `${stageLabel()} · ${engine.level.subtitle}`);
      if (mode === 'versus') {
        line(`P1 累计 ${money((checkpoint.match || emptyMatch()).totals[0])}\nP2 累计 ${money((checkpoint.match || emptyMatch()).totals[1])}`);
        line('每人每轮 1 枚炸药，倒计时结束比较收入。没有商店加成。');
      } else {
        line(`${mode === 'coop' ? '共同' : '本关'}目标 ${money(engine.level.target)} · ${engine.level.duration} 秒\n炸药 ${checkpoint.bombs} 枚 · 钱包 ${money(checkpoint.wallet)}`, 15, '#70502b');
        if (checkpoint.strength || checkpoint.diamondBonus) line([checkpoint.strength ? '力量 +35%' : '', checkpoint.diamondBonus ? '钻石 +50%' : ''].filter(Boolean).join(' · '));
        line(endless ? '无尽挑战：未达目标，本次旅程结束。' : '过关进入商店，自由选择下一关的补给。');
      }
      line(isDuo() ? 'P1 点击左半矿区或金色按钮，P2 点击右半矿区或青色按钮，支持同时操作。' : '等抓钩瞄准目标，点击矿区或「下钩」。物品拉回地面才计分。');
      actionButton('准备好了，下矿 →', 'miner:play', undefined, true);
      actionButton('返回矿场菜单', 'miner:menu');
    } else if (scene === 'paused') {
      title('矿工休息中', '矿石、抓钩、倒计时和道具都已暂停。');
      line(`还剩 ${Math.ceil(engine.timeLeft)} 秒 · 本关收入 ${money(engine.income)}`);
      actionButton('继续挖矿 →', 'miner:resume', undefined, true);
      if (mode !== 'versus') actionButton('从本关开始时重新挑战', 'miner:retry');
      actionButton('查看玩法', 'miner:help');
      actionButton('返回矿场菜单', 'miner:menu');
      line('返回矿场菜单或重新打开后，从本关开始时恢复。', 11);
    } else if (scene === 'shop') {
      const shop = data.shop;
      title('矿工补给站', `下一站：第 ${shop.levelIndex + 1} ${stageUnit()} · ${engine.level.name}`);
      line(`钱包 ${money(shop.wallet)} · 炸药库存 ${shop.bombs} / 5`, 16, '#76532b');
      for (const product of PRODUCTS) {
        const state = productState(product);
        text(ctx, `${product.name} · ${money(product.price)}`, innerX, y, 16, '#6d4d2b', 'left', 800); y += 22;
        line(product.detail, 12);
        actionButton(`${state.reason}（${shop.purchaseCounts[product.key]} / ${product.limit}）`, 'miner:buy', product.key, false, state.disabled);
      }
      actionButton('装备好了，下一关 →', 'miner:next', undefined, true);
      actionButton('稍后再来，返回菜单', 'miner:menu');
      line('加成只作用于下一关，炸药可留存。消费不影响累计成绩。', 11);
    } else if (scene === 'result' || scene === 'complete') {
      if (mode === 'versus') {
        const match = completedMatch || emptyMatch();
        const winner = roundWinner(scene === 'complete' ? match.totals : [engine.players[0].income, engine.players[1].income]);
        title(winner === null ? '旗鼓相当，平局！' : `P${winner + 1} ${scene === 'complete' ? '成为今日矿王' : '赢下这一轮'}`, `${stageLabel()} · ${scene === 'complete' ? '整场对战完成' : '准备下一场较量'}`);
        line(`本轮 P1 ${money(engine.players[0].income)} · P2 ${money(engine.players[1].income)}`);
        line(`累计 P1 ${money(match.totals[0])}\n累计 P2 ${money(match.totals[1])}`, 17, '#725129');
        line(`胜场 ${match.wins[0]} : ${match.wins[1]} · 平局 ${match.draws} 轮`);
        actionButton(scene === 'complete' ? '再战一场 →' : '下一轮 →', scene === 'complete' ? 'miner:force-new' : 'miner:versus-next', undefined, true);
      } else {
        const won = engine.won;
        title(scene === 'complete' ? '传奇矿工，诞生！' : won ? '这一趟，满载而归' : endless ? '这次旅程，到这里收工' : '就差一点，再试一次', scene === 'complete' ? `${engine.level.id} 座矿场的冒险完成。${endless ? '本次无尽挑战已到达终点。' : '试试无尽矿场吧。'}` : won ? '收入已入账，去补给站看看下一关。' : `距离目标还差 ${money(Math.max(0, engine.level.target - engine.income))}`);
        line(`本关收入 ${money(engine.income)}\n累计收获 ${money(checkpoint.totalEarned + engine.income)}`, 18, '#795429');
        if (scene === 'complete') { actionButton('再来一轮 →', 'miner:force-new', undefined, true); if (!endless) actionButton('挑战无尽矿场', 'miner:try-endless'); }
        else if (won) actionButton('去矿工商店 →', 'miner:shop', undefined, true);
        else actionButton(endless ? '重新挑战第 1 层 →' : '再试一次 →', endless ? 'miner:force-new' : 'miner:retry', undefined, true);
        line(endless && !won ? '本次挑战已结束，最佳累计和完成层数已保存。' : '重试会恢复本关开始时的矿场、道具和钱包。', 11);
      }
      actionButton('返回矿场菜单', 'miner:menu');
    } else if (scene === 'help') {
      title('挖金小手册', `${helpPage + 1} / 2 · ${isDuo() ? '支持双指同时操作' : '单手也能轻松挖金'}`);
      if (helpPage === 0) {
        line('下钩：等待抓钩瞄准后，点击矿区或下方按钮。双人用左半 / 右半矿区控制 P1 / P2。');
        line('随身炸药：抓到重物且有库存时，点击自己的炸药按钮，炸掉钩中物品并快速空钩回收。');
        line('金块：小 / 中 / 大分别 ¥50 / 200 / 500。钻石 ¥600，重量轻。钱袋里藏着随机奖励。');
        line('合作：两人共享目标、收入、钱包与道具。对战：各自计分，每轮各有 1 枚炸药，累计收入决胜。');
      } else {
        line('猪猪来回奔跑，价值 ¥30；含钻猪价值 ¥630。钻石券也能提升它携带的钻石价值。');
        line('小精灵会沿横线挖走遇到的矿物，抓住它就能停工，价值 ¥60。');
        line('TNT 桶藏在部分金钻矿群之间，红色虚线标出爆炸范围。先取周围宝藏，再决定是否引爆。');
        line('抓钩碰到或精灵挖到桶就会爆炸，摧毁范围内物件并触发邻桶连锁，不计收入；已经钩住的矿物会保留。');
        line('达标后可提前收工；钩子必须先收回。无尽未达标即结束本次挑战。');
        line('存档：六种玩法独立保存；重新打开从本关开始时继续。切到后台或大厅立即暂停。背景音乐可开关，暂无操作音效。');
      }
      actionButton(helpPage ? '‹ 上一页' : '下一页 ›', 'miner:help-page', helpPage ? 0 : 1);
      actionButton('明白了，返回 →', 'miner:help-back', undefined, true);
    }
    if (warning) line(warning, 11, '#b55337');
    const contentHeight = y + panelScroll - top + 10;
    panelMaxScroll = Math.max(0, contentHeight - panelHeight);
    if (panelScroll > panelMaxScroll) panelScroll = panelMaxScroll;
    ctx.restore();
    if (panelMaxScroll > 0) {
      const trackHeight = panelHeight - 30, thumbHeight = Math.max(25, trackHeight * panelHeight / contentHeight);
      round(ctx, x + width - 7, top + 15 + (trackHeight - thumbHeight) * panelScroll / panelMaxScroll, 3, thumbHeight, 2, '#c19a60');
      if (panelScroll < panelMaxScroll - 5) text(ctx, '向上滑动查看更多', screen.width / 2, bottom - 9, 10, '#a4875e', 'center');
    }
  }

  function render(ctx) {
    if (!ctx) return [];
    targets = [];
    ctx.save(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#3f3224'; ctx.fillRect(0, 0, screen.width, screen.height);
    if (!renderer) renderer = new MineRenderer(ctx);
    renderer.setContext(ctx);
    renderer.resize(layout.world, layout.mineScale);
    if (dirtyLevel) { renderer.setLevel(engine.level); dirtyLevel = false; }
    ctx.save(); ctx.beginPath(); ctx.rect(layout.mine.x, layout.mine.y, layout.mine.w, layout.mine.h); ctx.clip();
    ctx.translate(layout.drawX, layout.drawY); ctx.scale(layout.mineScale, layout.mineScale);
    renderer.render(engine, elapsed, frameDelta, scene !== 'playing');
    ctx.restore();
    drawHeader(ctx); drawHud(ctx); drawControls(ctx); drawPanel(ctx);
    if (toast && toastLeft > 0) {
      const w = Math.min(screen.width - 32, 350), x = (screen.width - w) / 2;
      round(ctx, x, screen.height - screen.safeBottom - 58, w, 38, 12, '#3f342aed');
      text(ctx, toast, screen.width / 2, screen.height - screen.safeBottom - 39, 12, '#fff3d6', 'center');
    }
    ctx.restore();
    frameDelta = 0;
    return targets;
  }

  resize(screen);
  newEngine(checkpoint);
  return {
    id: 'gold-miner', resize, render, tick, activate, pointer, pause, save: persist,
    frameInterval: 16,
    enter() {},
    sharePayload() { return { title: '一起来玩黄金矿工 · 游戏之间', query: 'g=gold-miner' }; },
    getResumeInfo() {
      const resume = data.shop || data.checkpoint;
      return { text: resume ? `${modeLabel()} · 第 ${resume.levelIndex + 1} ${stageUnit()}` : '选择矿场，开始新的挑战', available: Boolean(resume) };
    },
    get statusText() { return scene === 'playing' ? `${modeLabel()} · ${stageLabel()} · ${money(engine.income)}` : `黄金矿工 · ${modeLabel()}${scene === 'paused' ? ' · 已暂停' : ''}`; },
    get musicActive() { return scene === 'playing' && !engine.ended; },
    get model() { return { scene, mode, endless, engine, checkpoint, save: data, completedMatch, layout, panelScroll, panelMaxScroll, warning }; },
  };
}

module.exports = { createGoldMinerGame, PRODUCTS };
