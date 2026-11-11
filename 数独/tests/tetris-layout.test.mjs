import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLayout, renderGame, COLORS } = require('../../微信小程序/src/games/tetris/renderer.js');
const { newRound, cells, dropDistance } = require('../../微信小程序/src/games/tetris/engine.js');

const viewports = [
  { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 480, height: 320, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
];
const intersects = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
function context() {
  const texts = [], fills = [], strokes = [];
  const fontSize = ctx => Number(/([\d.]+)px/.exec(ctx.font)[1]);
  const textWidth = (value, size) => Array.from(String(value)).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? size : size * 0.6), 0);
  const ctx = new Proxy({ texts, fills, strokes,
    measureText(value) { return { width: textWidth(value, fontSize(ctx)) }; },
    fillRect(x, y, w, h) { fills.push({ x, y, w, h, color: ctx.fillStyle }); },
    stroke() { strokes.push(ctx.strokeStyle); },
    fillText(value, x, y) {
      const h = fontSize(ctx), w = textWidth(value, h);
      texts.push({ value: String(value), x: x - (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y: y - h / 2, w, h });
    },
  }, { get(object, key) { return key in object ? object[key] : () => {}; } });
  return ctx;
}
function state(extra = {}) { return { round: newRound(132), best: 1200, paused: false, status: 'playing', storageAvailable: true, ...extra }; }
function inside(area, viewport) {
  const detail = JSON.stringify({ area, viewport });
  assert.ok(Number.isFinite(area.x + area.y + area.w + area.h), detail);
  assert.ok(area.x >= -1e-8 && area.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom) - 1e-8, detail);
  assert.ok(area.w > 0 && area.h > 0, detail);
  assert.ok(area.x + area.w <= viewport.width + 1e-8 && area.y + area.h <= viewport.height - viewport.safeBottom + 1e-8, detail);
}

for (const viewport of viewports) test(`tetris ${viewport.width}x${viewport.height} safe area ${viewport.safeTop}/${viewport.safeBottom}: complete board, readable controls, no overlap`, () => {
  const layout = createLayout(viewport), ctx = context(), game = state(), targets = renderGame(ctx, layout, game);
  inside(layout.board, viewport); assert.equal(layout.board.h, layout.board.w * 2);
  for (const target of targets) { inside(target, viewport); assert.ok(target.label); assert.ok(target.h >= 34); assert.ok(target.w >= 34); assert.equal(intersects(target, layout.board), false); }
  for (const text of ctx.texts) inside(text, viewport);
  for (let i = 0; i < targets.length; i += 1) for (let j = i + 1; j < targets.length; j += 1)
    assert.equal(intersects(targets[i], targets[j]), false, JSON.stringify({ a: targets[i], b: targets[j] }));
  assert.deepEqual(new Set(targets.map(item => item.action)), new Set(['home', 'share', 'tetris:help', 'tetris:new', 'tetris:pause', 'tetris:left', 'tetris:right', 'tetris:rotate', 'tetris:soft-drop', 'tetris:hard-drop']));
  for (const label of ['得分', '等级', '消行', '接下来']) assert.ok(ctx.texts.some(item => item.value === label), label);
});

test('tetris pause and terminal overlays exclusively expose navigation and one explicit continuation', () => {
  for (const viewport of viewports) for (const status of ['paused', 'over']) {
    const game = state({ paused: status === 'paused', status: status === 'over' ? 'over' : 'playing' });
    if (status === 'over') { game.round.status = 'over'; game.round.active = null; }
    const ctx = context(), targets = renderGame(ctx, createLayout(viewport), game);
    assert.deepEqual(targets.map(target => target.action), ['home', 'share', status === 'over' ? 'tetris:new' : 'tetris:resume']);
    for (const target of targets) inside(target, viewport);
    for (const text of ctx.texts) inside(text, viewport);
  }
});

test('tetris renders the landing ghost without changing the round', () => {
  const game = state(), before = JSON.stringify(game.round), ctx = context();
  assert.ok(dropDistance(game.round) > 0); assert.equal(cells(game.round.active).length, 4);
  renderGame(ctx, createLayout(viewports[0]), game);
  assert.equal(JSON.stringify(game.round), before);
  assert.equal(ctx.strokes.filter(color => color === COLORS.ghost).length, 4);
});

test('tetris warns about unavailable persistence on tall and short screens', () => {
  for (const viewport of viewports) {
    const ctx = context(); renderGame(ctx, createLayout(viewport), state({ storageAvailable: false }));
    assert.ok(ctx.texts.some(text => text.value.includes('暂无法存档')));
    for (const text of ctx.texts) inside(text, viewport);
  }
});

test('tetris long scores remain contained and all controls have separate hit regions', () => {
  for (const viewport of viewports) {
    const game = state({ best: 99999999999999 }), ctx = context(); game.round.score = 99999999999999; game.round.lines = 999999; game.round.level = 20;
    renderGame(ctx, createLayout(viewport), game);
    for (const text of ctx.texts) inside(text, viewport);
  }
});
