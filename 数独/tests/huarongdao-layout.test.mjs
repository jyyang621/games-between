import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLayout, renderGame, pieceArea, timeLabel, COLORS } = require('../../微信小程序/src/games/huarongdao/renderer.js');
const { LEVELS, canMove } = require('../../微信小程序/src/games/huarongdao/engine.js');
const viewports = [
  { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 480, height: 320, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
];
function state(extra = {}) { const level = LEVELS[0]; return { round: { levelId: level.id, pieces: level.pieces.map(piece => ({ ...piece })), moves: [], status: 'playing' }, selected: null,
  best: {}, elapsedMs: 83000, paused: false, storageAvailable: true, ...extra }; }
const intersects = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
function context() {
  const texts = [], fills = [], strokes = [];
  const fontSize = ctx => Number(/([\d.]+)px/.exec(ctx.font)[1]);
  const textWidth = (value, size) => Array.from(String(value)).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? size : size * 0.6), 0);
  const ctx = new Proxy({ texts, fills, strokes,
    measureText(value) { return { width: textWidth(value, fontSize(ctx)) }; },
    fill() { fills.push(ctx.fillStyle); }, stroke() { strokes.push(ctx.strokeStyle); },
    fillText(value, x, y) { const h = fontSize(ctx), w = textWidth(value, h); texts.push({ value: String(value), color: ctx.fillStyle,
      x: x - (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y: y - h / 2, w, h }); },
  }, { get(object, key) { return key in object ? object[key] : () => {}; } }); return ctx;
}
function inside(area, viewport) {
  const detail = JSON.stringify({ area, viewport });
  assert.ok(Number.isFinite(area.x + area.y + area.w + area.h), detail);
  assert.ok(area.x >= -1e-8 && area.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom) - 1e-8, detail);
  assert.ok(area.w > 0 && area.h > 0, detail);
  assert.ok(area.x + area.w <= viewport.width + 1e-8 && area.y + area.h <= viewport.height - viewport.safeBottom + 1e-8, detail);
}
for (const viewport of viewports) test(`huarongdao ${viewport.width}x${viewport.height} safe area ${viewport.safeTop}/${viewport.safeBottom}: board, labels, controls fit without overlapping`, () => {
  for (const level of LEVELS) {
    const game = state(), layout = createLayout(viewport), ctx = context(); game.round.levelId = level.id; game.round.pieces = level.pieces.map(piece => ({ ...piece }));
    const targets = renderGame(ctx, layout, game);
    inside(layout.board, viewport); inside(layout.exit, viewport); assert.equal(layout.board.h, layout.board.w * 5 / 4);
    for (const piece of game.round.pieces) inside(pieceArea(layout, piece), viewport);
    for (const text of ctx.texts) inside(text, viewport);
    for (const target of targets) { inside(target, viewport); assert.ok(target.h >= 34 && target.w >= 34); assert.ok(target.label); assert.equal(intersects(target, layout.board), false); }
    for (let i = 0; i < targets.length; i += 1) for (let j = i + 1; j < targets.length; j += 1) assert.equal(intersects(targets[i], targets[j]), false);
    for (const action of ['home', 'share', 'huarongdao:help', 'huarongdao:new', 'huarongdao:pause', 'huarongdao:level']) assert.ok(targets.some(target => target.action === action));
    assert.equal(targets.some(target => target.action === 'huarongdao:select'), false, 'board input must remain pointer-owned');
    assert.equal(targets.some(target => target.action === 'huarongdao:move'), false, 'no selection means no enabled directions');
    assert.ok(ctx.texts.some(text => text.value.includes(level.title)));
  }
});
test('huarongdao only exposes legal directions for each selected piece', () => {
  const game = state(), layout = createLayout(viewports[0]);
  for (const piece of game.round.pieces) {
    game.selected = piece.id; const ctx = context(), targets = renderGame(ctx, layout, game);
    const expected = [['left', -1, 0], ['up', 0, -1], ['down', 0, 1], ['right', 1, 0]].filter(([, dx, dy]) => canMove(game.round, piece.id, dx, dy)).map(([name]) => name);
    assert.deepEqual(targets.filter(target => target.action === 'huarongdao:move').map(target => target.payload), expected);
    assert.ok(ctx.fills.includes(COLORS.selected));
    assert.equal(targets.some(target => intersects(target, pieceArea(layout, piece))), false);
  }
});
test('huarongdao paused and won overlays own input while keeping navigation', () => {
  for (const viewport of viewports) for (const mode of ['paused', 'won']) {
    const game = state({ paused: mode === 'paused' }), ctx = context(); if (mode === 'won') game.round.status = 'won';
    const targets = renderGame(ctx, createLayout(viewport), game);
    assert.deepEqual(targets.map(target => target.action), mode === 'paused' ? ['home', 'share', 'huarongdao:resume'] : ['home', 'share', 'huarongdao:new', 'huarongdao:level']);
    for (const target of targets) inside(target, viewport); for (const text of ctx.texts) inside(text, viewport);
  }
});
test('huarongdao render never modifies positions, history, selection or statistics', () => {
  const game = state(), before = JSON.stringify(game); renderGame(context(), createLayout(viewports[0]), game); assert.equal(JSON.stringify(game), before);
});
test('huarongdao won dialog keeps undo reachable with history and its three actions remain separate', () => {
  for (const viewport of viewports) {
    const game = state(), ctx = context(); game.round.status = 'won';
    game.round.moves = [{ id: 'cao', dx: 0, dy: 1 }];
    const targets = renderGame(ctx, createLayout(viewport), game);
    assert.deepEqual(targets.map(target => target.action), ['home', 'share', 'huarongdao:new', 'huarongdao:level', 'huarongdao:undo']);
    assert.equal(targets.find(target => target.action === 'huarongdao:undo').label, '悔一步');
    for (const target of targets) { inside(target, viewport); assert.ok(target.h >= 34 && target.w >= 34); }
    for (const text of ctx.texts) inside(text, viewport);
    for (let i = 0; i < targets.length; i += 1) for (let j = i + 1; j < targets.length; j += 1) assert.equal(intersects(targets[i], targets[j]), false);
  }
});
test('huarongdao undo is only enabled after a move and score zero remains a valid displayed best', () => {
  const game = state(), layout = createLayout(viewports[0]); game.best[game.round.levelId] = 0;
  assert.equal(renderGame(context(), layout, game).some(target => target.action === 'huarongdao:undo'), false);
  game.round.moves.push({ id: game.round.pieces[0].id, dx: 1, dy: 0 });
  const ctx = context(); assert.ok(renderGame(ctx, layout, game).some(target => target.action === 'huarongdao:undo'));
  assert.ok(ctx.texts.some(text => text.value === '0')); assert.equal(timeLabel(83000), '1:23');
});
test('huarongdao storage warnings and long counters remain visible inside every viewport', () => {
  for (const viewport of viewports) {
    const game = state({ storageAvailable: false, elapsedMs: 999999999000 }), ctx = context(); game.best[game.round.levelId] = 999999999;
    renderGame(ctx, createLayout(viewport), game); assert.ok(ctx.texts.some(text => text.value.includes('暂无法存档')));
    for (const text of ctx.texts) inside(text, viewport);
  }
});
