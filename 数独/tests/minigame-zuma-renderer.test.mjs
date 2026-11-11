import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GameModel, HEIGHT } = require('../../微信小程序/src/games/zuma/core/model.js');
const { DIFFICULTIES, CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel } = require('../../微信小程序/src/games/zuma/levels.js');
const { createZumaLayout, screenToWorld, renderZuma } = require('../../微信小程序/src/games/zuma/renderer.js');

const viewports = [
  { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 375, height: 667, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
];

function context() {
  const texts = [], paths = [], gradients = [];
  const gradient = () => { const stops = []; gradients.push(stops); return { addColorStop(offset, fill) { stops.push([offset, fill]); } }; };
  const ctx = new Proxy({
    texts, paths, gradients,
    createLinearGradient: gradient, createRadialGradient: gradient,
    moveTo(x, y) { paths.push([x, y]); }, lineTo(x, y) { paths.push([x, y]); },
    fillText(value, x, y) {
      const size = Number(/([\d.]+)px/.exec(ctx.font)[1]);
      const width = Array.from(String(value)).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? size : size * 0.58), 0);
      texts.push({ value: String(value), x: x - (ctx.textAlign === 'center' ? width / 2 : ctx.textAlign === 'right' ? width : 0), y: y - size / 2, w: width, h: size, fill: ctx.fillStyle, font: ctx.font });
    },
  }, { get(object, key) { return key in object ? object[key] : () => {}; } });
  return ctx;
}
function state(extra = {}) {
  const difficulty = extra.difficulty || 'normal';
  const definition = extra.definition || (extra.mode === 'endless' ? getEndlessLevel(extra.wave || 1, 74219, difficulty) : getCampaignLevel(extra.levelIndex || 0, difficulty));
  return { model: new GameModel(definition), best: 900, bestWave: 12, aim: { x: 560, y: 100 }, particles: [], labels: [], view: 'menu', mode: 'campaign', difficulty, levelIndex: 0, selectedLevel: 0, wave: 1, unlocked: 0, definition, score: 420, hasProgress: false, ...extra };
}
function intersects(a, b) { return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01; }
function checkTargets(targets, viewport) {
  for (const item of targets) {
    assert.ok(typeof item.label === 'string' && item.label.length > 0, JSON.stringify(item));
    assert.ok(item.x >= 0 && item.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom), JSON.stringify({ viewport, item }));
    assert.ok(item.w > 0 && item.h > 0 && item.x + item.w <= viewport.width + 1e-8 && item.y + item.h <= viewport.height - viewport.safeBottom + 1e-8, JSON.stringify({ viewport, item }));
  }
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
    assert.equal(intersects(targets[i], targets[j]), false, JSON.stringify({ viewport, first: targets[i], second: targets[j] }));
  }
}

test('Zuma campaign menu previews all six routes, including locked choices, with usable action payloads', () => {
  for (const viewport of viewports) {
    const layout = createZumaLayout(viewport), ctx = context();
    const targets = renderZuma(ctx, layout, state({ selectedLevel: 3, hasProgress: true }));
    checkTargets(targets, viewport);
    const cards = targets.filter(item => item.action === 'zuma:select-level');
    assert.deepEqual(cards.map(item => item.payload), [0, 1, 2, 3, 4, 5]);
    assert.equal(new Set(cards.map(item => Math.round(item.x))).size, layout.landscape ? 3 : 2);
    assert.deepEqual(targets.filter(item => item.action === 'zuma:mode').map(item => item.payload), ['campaign', 'endless']);
    assert.equal(targets.some(item => item.action === 'zuma:start'), false);
    assert.equal(targets.some(item => item.action === 'zuma:continue'), true);
    assert.ok(ctx.texts.some(item => item.value === '先通过第 3 关即可解锁'));
    const open = renderZuma(context(), layout, state({ selectedLevel: 2, unlocked: 2 }));
    assert.ok(open.some(item => item.action === 'zuma:start'));
  }
  assert.equal(new Set(CAMPAIGN_LEVELS.map(level => JSON.stringify(level.trackPoints))).size, 6);
});

test('Zuma endless menu communicates its bounded challenge and retains a continue entry', () => {
  for (const viewport of viewports) {
    const ctx = context(), targets = renderZuma(ctx, createZumaLayout(viewport), state({ mode: 'endless', hasProgress: true, wave: 47 }));
    checkTargets(targets, viewport);
    assert.ok(targets.some(item => item.action === 'zuma:new-endless'));
    assert.ok(targets.some(item => item.action === 'zuma:continue'));
    assert.equal(targets.some(item => item.action === 'zuma:select-level'), false);
    for (const content of ['逐波提速 · 最高' + DIFFICULTIES.find(item => item.id === 'normal').endlessSpeedCap, '险境缓速 · 清波休息', '最高抵达第 12 波']) assert.ok(ctx.texts.some(item => item.value === content));
    for (const text of ctx.texts) assert.ok(text.x >= -0.01 && text.x + text.w <= viewport.width + 0.01, JSON.stringify({ viewport, text }));
  }
});

test('Zuma play controls and terminal overlays fit safe areas without colliding on compact phones', () => {
  for (const viewport of viewports) for (const mode of ['campaign', 'endless']) for (const status of ['ready', 'playing', 'paused', 'won', 'lost']) {
    const definition = mode === 'campaign' ? getCampaignLevel(1) : getEndlessLevel(25);
    const current = state({ view: 'play', mode, levelIndex: 1, wave: 25, definition }); current.model.status = status;
    const ctx = context(), targets = renderZuma(ctx, createZumaLayout(viewport), current);
    checkTargets(targets, viewport);
    for (const action of ['home', 'share', 'zuma:menu', 'zuma:restart', 'zuma:help']) assert.ok(targets.some(item => item.action === action));
    if (status === 'won') assert.ok(targets.some(item => item.action === 'zuma:next'));
    if (status === 'ready') assert.ok(targets.some(item => item.action === 'zuma:start'));
    for (const text of ctx.texts) assert.ok(text.x >= -0.01 && text.x + text.w <= viewport.width + 0.01 && text.y + text.h <= viewport.height - viewport.safeBottom + 0.01, JSON.stringify({ viewport, status, text }));
    if (status !== 'playing') {
      const overlayAction = status === 'ready' ? 'zuma:start' : status === 'won' ? 'zuma:next' : status === 'lost' ? 'zuma:restart' : 'zuma:resume';
      const action = targets.filter(item => item.action === overlayAction).at(-1);
      const copyStart = ctx.texts.findLastIndex(item => item.value === (status === 'ready' ? (mode === 'endless' ? '无尽第 25 波' : '第 2/6 关 · ' + definition.title) : status === 'paused' ? 'TAKE YOUR TIME' : status === 'won' ? mode === 'endless' ? 'WAVE CLEARED' : 'PASSAGE CLEARED' : 'THE TRAIL CONTINUES') + ' · 中等');
      assert.ok(copyStart >= 0);
      for (const text of ctx.texts.slice(copyStart)) if (text.value !== action.label) assert.equal(intersects(text, action), false, JSON.stringify({ viewport, status, text, action }));
    }
  }
});

test('Zuma final-stage win opens endless selection and endless danger displays actual reduced speed', () => {
  const layout = createZumaLayout(viewports[3]);
  const final = state({ view: 'play', levelIndex: CAMPAIGN_LEVELS.length - 1 }); final.model.status = 'won';
  assert.ok(renderZuma(context(), layout, final).some(item => item.action === 'zuma:enter-endless'));
  const endless = state({ view: 'play', mode: 'endless', definition: getEndlessLevel(50), wave: 50 }); endless.model.status = 'playing';
  endless.model.balls = [{ id: 1, color: 0, s: endless.model.track.length * 0.96 }];
  const ctx = context(); renderZuma(ctx, layout, endless);
  assert.ok(ctx.texts.some(item => item.value.includes('险境缓速')));
  assert.ok(endless.model.currentSpeed < endless.definition.speed);
  endless.model.balls = []; const speed = context(); renderZuma(speed, layout, endless);
  assert.ok(speed.texts.some(item => /^速度 \d+ \/ \d+(\.\d+)?$/.test(item.value)));
  const campaign = state({ view: 'play' }); campaign.model.status = 'playing';
  campaign.model.balls = [{ id: 1, color: 0, s: campaign.model.track.length * 0.96 }];
  const normal = context(); renderZuma(normal, layout, campaign);
  assert.equal(normal.texts.some(item => item.value.includes('险境缓速')), false);
});

test('Zuma help owns input and its last instruction stays clear of the close button', () => {
  for (const viewport of viewports) for (const view of ['menu', 'play']) {
    const ctx = context(), targets = renderZuma(ctx, createZumaLayout(viewport), state({ view, help: true }));
    checkTargets(targets, viewport);
    assert.deepEqual(targets.map(item => item.action), ['zuma:help-close']);
    const first = ctx.texts.findLastIndex(item => item.value === '每一次连锁，都从一击开始');
    const instructions = ctx.texts.slice(first);
    assert.ok(instructions.some(item => item.value === '速度有上限，无尽险境会自动减速。'));
    assert.equal(instructions.some(item => item.value.includes('78')), false);
    for (const text of instructions) if (text.value !== targets[0].label) {
      assert.equal(intersects(text, targets[0]), false, JSON.stringify({ viewport, text }));
      assert.ok(text.x >= 0 && text.x + text.w <= viewport.width, JSON.stringify({ viewport, text }));
    }
  }
});

test('Zuma renderer preserves aiming projection for every new campaign track', () => {
  for (const viewport of viewports) for (const definition of CAMPAIGN_LEVELS) {
    const layout = createZumaLayout(viewport), point = definition.trackPoints[3], b = layout.board, s = layout.scale;
    const x = b.x + (layout.rotated ? HEIGHT - point.y : point.x) * s;
    const y = b.y + (layout.rotated ? point.x : point.y) * s;
    const result = screenToWorld(layout, x, y);
    assert.ok(Math.abs(result.x - point.x) < 1e-8 && Math.abs(result.y - point.y) < 1e-8);
  }
});

test('Zuma difficulty choices show selection, per-difficulty records and concrete ball/speed settings in both modes', () => {
  const number = value => Number(value.toFixed(1)).toString();
  for (const viewport of viewports) for (const mode of ['campaign', 'endless']) for (const difficulty of DIFFICULTIES) {
    const current = state({ mode, difficulty: difficulty.id, hasProgress: true, wave: 21, selectedLevel: 2, unlocked: 2, best: 1234 });
    const ctx = context(), targets = renderZuma(ctx, createZumaLayout(viewport), current);
    checkTargets(targets, viewport);
    assert.deepEqual(targets.filter(item => item.action === 'zuma:difficulty').map(item => item.payload), DIFFICULTIES.map(item => item.id));
    for (const choice of DIFFICULTIES) {
      const label = ctx.texts.find(item => item.value === choice.title);
      assert.equal(label.fill, choice.id === difficulty.id ? '#263d2d' : '#ece5c9');
    }
    const definition = mode === 'campaign' ? getCampaignLevel(2, difficulty.id) : getEndlessLevel(21, 74219, difficulty.id);
    assert.ok(ctx.texts.some(item => item.value === difficulty.title + ' · 本档最佳 1234'));
    assert.ok(ctx.texts.some(item => item.value === definition.totalBalls + ' 颗 · 初速 ' + number(definition.speed) + ' · 上限 ' + number(definition.maxSpeed)));
    if (mode === 'endless') assert.ok(ctx.texts.some(item => item.value === '逐波提速 · 最高' + number(difficulty.endlessSpeedCap)));
    for (const text of ctx.texts) assert.ok(text.x >= -0.01 && text.x + text.w <= viewport.width + 0.01 && text.y + text.h <= viewport.height - viewport.safeBottom + 0.01, JSON.stringify({ viewport, text }));
  }
});

test('Zuma play and result headings retain selected difficulty without adding in-game difficulty actions', () => {
  for (const difficulty of DIFFICULTIES) for (const status of ['playing', 'won', 'lost']) for (const viewport of viewports) {
    const current = state({ view: 'play', difficulty: difficulty.id }); current.model.status = status;
    const ctx = context(), targets = renderZuma(ctx, createZumaLayout(viewport), current);
    checkTargets(targets, viewport);
    assert.equal(targets.some(item => item.action === 'zuma:difficulty'), false);
    assert.ok(ctx.texts.some(item => item.value.includes('第 1/6 关') && item.value.endsWith(' · ' + difficulty.title)));
    if (status !== 'playing') assert.ok(ctx.texts.some(item => item.value === (status === 'won' ? 'PASSAGE CLEARED' : 'THE TRAIL CONTINUES') + ' · ' + difficulty.title));
  }
});

test('Zuma rare wildcard is visibly rainbow in the launcher, reserve and projectile, with a universal hint', () => {
  for (const viewport of viewports) {
    const current = state({ view: 'play', difficulty: 'hell', particles: [{ color: 4, x: 200, y: 300, size: 3, life: 0.3, max: 0.5 }] });
    current.model.status = 'playing'; current.model.currentColor = 4; current.model.nextColor = 4;
    current.model.projectiles = [{ x: 400, y: 400, vx: 1, vy: 0, color: 4 }];
    const ctx = context(); assert.doesNotThrow(() => renderZuma(ctx, createZumaLayout(viewport), current));
    assert.ok(ctx.texts.some(item => item.value.includes('彩球·万能')));
    assert.equal(ctx.gradients.filter(stops => stops.length === 6 && stops[0][1] === '#ff8b91' && stops[5][1] === '#f0a4df').length, 5);
    const help = context(); renderZuma(help, createZumaLayout(viewport), { ...current, help: true });
    assert.ok(help.texts.some(item => item.value === '稀有彩球：命中后变成相邻珠的颜色。'));
    assert.ok(help.texts.some(item => item.value === '四档难度越高，球速更快、弹珠更多。'));
  }
});

test('Zuma speed labels fit three-digit speeds and preserve decimal limits in compact layouts', () => {
  for (const viewport of viewports) for (const settings of [{ speed: 172.2, maxSpeed: 210 }, { speed: 87.9, maxSpeed: 105.6 }]) {
    const definition = { ...getCampaignLevel(5, 'hell'), ...settings };
    const current = state({ view: 'play', difficulty: 'hell', levelIndex: 5, definition });
    current.model.status = 'playing'; current.model.currentColor = 4;
    const ctx = context(), layout = createZumaLayout(viewport);
    checkTargets(renderZuma(ctx, layout, current), viewport);
    const label = ctx.texts.find(item => item.value === (layout.landscape ? '速度 ' + Math.round(settings.speed) : '彩球·万能 · 速度 ' + Math.round(settings.speed) + ' / ' + settings.maxSpeed));
    assert.ok(label);
    if (!layout.landscape) assert.ok(label.x >= layout.board.x + 8 && label.x + label.w <= layout.board.x + layout.board.w - 8, JSON.stringify({ viewport, label, board: layout.board }));
    for (const text of ctx.texts) assert.ok(text.x >= -0.01 && text.x + text.w <= viewport.width + 0.01 && text.y + text.h <= viewport.height - viewport.safeBottom + 0.01, JSON.stringify({ viewport, text }));
  }
});

test('Zuma swap remains available before start and while paused, with larger non-overlapping control hit areas', () => {
  for (const viewport of viewports) for (const status of ['ready', 'playing', 'paused', 'won', 'lost']) {
    const current = state({ view: 'play' }); current.model.status = status;
    current.model.currentColor = 0; current.model.nextColor = 1;
    const layout = createZumaLayout(viewport), ctx = context(), targets = renderZuma(ctx, layout, current);
    checkTargets(targets, viewport);
    const swap = targets.find(item => item.action === 'zuma:swap');
    assert.equal(Boolean(swap), ['ready', 'playing', 'paused'].includes(status));
    if (swap) {
      assert.equal(swap.label, '换球');
      assert.equal(swap.h, layout.landscape ? 34 : 44);
    }
    for (const target of targets.filter(item => ['zuma:pause', 'zuma:resume', 'zuma:restart', 'zuma:menu', 'zuma:help'].includes(item.action))) {
      if (layout.landscape && target.x < layout.board.x || !layout.landscape && target.y > layout.board.y + layout.board.h) assert.equal(target.h, layout.landscape ? 34 : 44);
    }
    if (!layout.landscape) assert.ok(ctx.texts.some(item => item.value === '当前 › 下颗'));
  }
});

test('Zuma same-color swap stays clickable with a stable accessible label and visible paused feedback', () => {
  for (const viewport of viewports) for (const status of ['ready', 'playing', 'paused']) for (const message of ['已换球', '前后同色']) {
    const current = state({ view: 'play', swapFeedback: { text: message, life: 0.7 } }); current.model.status = status;
    current.model.currentColor = current.model.nextColor = 2;
    const ctx = context(), layout = createZumaLayout(viewport), targets = renderZuma(ctx, layout, current);
    checkTargets(targets, viewport);
    const swap = targets.find(item => item.action === 'zuma:swap');
    assert.equal(swap.label, '换球');
    assert.ok(ctx.texts.some(item => item.value === '同色'));
    const feedback = ctx.texts.findLastIndex(item => item.value === message);
    assert.ok(feedback >= 0);
    if (status === 'paused' && !layout.landscape) assert.ok(feedback > ctx.texts.findLastIndex(item => item.value === '旅程已暂停'));
    const expired = context(); renderZuma(expired, layout, { ...current, swapFeedback: { text: message, life: 0 } });
    assert.equal(expired.texts.some(item => item.value === message), false);
  }
});
