import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLayout, renderGame } = require('../../微信小程序/src/games/minesweeper/renderer.js');
const difficulties = [
  { difficulty: 'beginner', rows: 9, cols: 9, mineCount: 10 },
  { difficulty: 'intermediate', rows: 12, cols: 9, mineCount: 20 },
  { difficulty: 'expert', rows: 16, cols: 12, mineCount: 40 },
];
const viewports = [
  { width: 375, height: 750, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 480, height: 320, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 320, height: 240, safeTop: 44, safeBottom: 0, capsuleRect: { bottom: 82 } },
  { width: 240, height: 240, safeTop: 44, safeBottom: 0, capsuleRect: { bottom: 82 } },
];

function context() {
  const texts = [], arcs = [];
  const fontSize = ctx => Number(/([\d.]+)px/.exec(ctx.font)[1]);
  const textWidth = (value, size) => Array.from(String(value)).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? size : size * 0.6), 0);
  const ctx = new Proxy({
    texts, arcs,
    measureText(value) { return { width: textWidth(value, fontSize(ctx)) }; },
    arc(...args) { arcs.push(args); },
    fillText(value, x, y) {
      const h = fontSize(ctx), w = textWidth(value, h);
      texts.push({ value: String(value), x: x - (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y: y - h / 2, w, h });
    },
  }, { get(object, key) { return key in object ? object[key] : () => {}; } });
  return ctx;
}

function state(difficulty = difficulties[0], extra = {}) {
  const count = difficulty.rows * difficulty.cols;
  return { round: { ...difficulty, mines: Array(count).fill(false), revealed: Array(count).fill(false), flags: Array(count).fill(false),
    started: false, status: 'ready', elapsedMs: 0, exploded: -1 }, mode: 'reveal', paused: false,
  bests: { beginner: null, intermediate: 125000, expert: null }, storageAvailable: true, ...extra };
}

function intersects(a, b) {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
}
function inside(area, viewport) {
  const detail = JSON.stringify({ viewport, area });
  assert.ok(area.x >= -1e-8 && area.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom) - 1e-8, detail);
  assert.ok(area.w > 0 && area.h > 0, detail);
  assert.ok(area.x + area.w <= viewport.width + 1e-8 && area.y + area.h <= viewport.height - viewport.safeBottom + 1e-8, detail);
}

test('minesweeper layouts keep the entire grid and separate controls inside the capsule safe area', () => {
  for (const viewport of viewports) for (const difficulty of difficulties) {
    const game = state(difficulty), layout = createLayout(viewport, game.round), ctx = context();
    const targets = renderGame(ctx, layout, game);
    inside(layout.board, viewport);
    assert.equal(layout.cells.length, difficulty.rows * difficulty.cols);
    for (const cell of layout.cells) {
      inside(cell, viewport);
      assert.equal(cell.w, cell.h);
      assert.ok(cell.x > layout.board.x && cell.y > layout.board.y);
      assert.ok(cell.x + cell.w < layout.board.x + layout.board.w);
      assert.ok(cell.y + cell.h < layout.board.y + layout.board.h);
    }
    for (const target of targets) { inside(target, viewport); assert.ok(target.label.length); }
    for (let i = 0; i < targets.length; i += 1) for (let j = i + 1; j < targets.length; j += 1) {
      assert.equal(intersects(targets[i], targets[j]), false, JSON.stringify({ viewport, difficulty, a: targets[i], b: targets[j] }));
    }
    for (const text of ctx.texts) inside(text, viewport);
    assert.deepEqual(targets.filter(item => item.action === 'minesweeper:difficulty').map(item => item.payload), ['beginner', 'intermediate', 'expert']);
    assert.deepEqual(targets.filter(item => item.action === 'minesweeper:mode').map(item => item.payload), ['reveal', 'flag']);
    assert.equal(targets.filter(item => item.action === 'minesweeper:cell').length, difficulty.rows * difficulty.cols);
    for (const action of ['home', 'share', 'minesweeper:pause', 'minesweeper:new', 'minesweeper:help']) assert.ok(targets.some(item => item.action === action));
  }
});

test('minesweeper phone layouts preserve readable beginner cells and full size expert cells on tall phones', () => {
  for (const viewport of viewports.slice(0, 3)) assert.ok(createLayout(viewport, 'beginner').cells[0].w >= 22);
  assert.ok(createLayout(viewports[0], 'expert').cells[0].w >= 22);
  assert.equal(createLayout({}, 'intermediate').cells.length, 108);
  assert.equal(createLayout({}, 'expert').cells.length, 192);
});

test('minesweeper labels and drawing do not leak hidden mines', () => {
  const viewport = viewports[0], game = state();
  const layout = createLayout(viewport, game.round), emptyContext = context();
  const before = renderGame(emptyContext, layout, game);
  game.round.mines[0] = true; game.round.mines[10] = true;
  const hiddenContext = context(), hidden = renderGame(hiddenContext, layout, game);
  assert.deepEqual(hidden, before);
  assert.deepEqual(hiddenContext.texts, emptyContext.texts);
  assert.equal(hiddenContext.arcs.length, 0);
  assert.equal(hidden[hidden.findIndex(item => item.payload === 0 && item.action === 'minesweeper:cell')].label, '第1行第1列，未翻开');
  game.round.revealed[1] = true;
  game.round.flags[10] = true;
  const visibleContext = context(), visible = renderGame(visibleContext, layout, game);
  assert.ok(visible.some(item => item.action === 'minesweeper:cell' && item.payload === 1 && item.label === '第1行第2列，周围有2颗雷'));
  assert.ok(visible.some(item => item.action === 'minesweeper:cell' && item.payload === 10 && item.label === '第2行第2列，已插旗'));
});

test('minesweeper pause hides all board contents and its modal owns game input', () => {
  for (const viewport of viewports) {
    const game = state(difficulties[2], { paused: true });
    game.round.mines[0] = true; game.round.revealed[1] = true; game.round.flags[2] = true;
    const ctx = context(), targets = renderGame(ctx, createLayout(viewport, game.round), game);
    assert.deepEqual(targets.map(item => item.action), ['home', 'share', 'minesweeper:resume']);
    assert.equal(ctx.arcs.length, 0);
    assert.equal(ctx.texts.some(item => item.value === '1'), false);
    for (const target of targets) inside(target, viewport);
    for (const text of ctx.texts) inside(text, viewport);
    const title = ctx.texts.findLastIndex(item => item.value === '歇一会儿，再继续');
    assert.ok(title >= 0);
    for (const text of ctx.texts.slice(title, title + 2)) assert.equal(intersects(text, targets[2]), false);
  }
});

test('minesweeper finished games reveal mines and offer a fresh round even after lifecycle pause', () => {
  for (const viewport of viewports) for (const status of ['won', 'lost']) for (const paused of [false, true]) {
    const game = state(difficulties[1], { paused });
    game.round.status = status; game.round.started = true; game.round.mines[0] = true; game.round.exploded = 0;
    const ctx = context(), targets = renderGame(ctx, createLayout(viewport, game.round), game);
    assert.deepEqual(targets.map(item => item.action), ['home', 'share', 'minesweeper:new']);
    assert.ok(ctx.texts.some(item => item.value === (status === 'won' ? '雷区，顺利排除！' : '碰到地雷啦')));
    for (const text of ctx.texts) inside(text, viewport);
    for (const target of targets) inside(target, viewport);
  }
});

test('minesweeper save warnings and large persisted times remain within the layout', () => {
  for (const viewport of viewports) {
    const game = state(difficulties[2], { storageAvailable: false, bests: { expert: Number.MAX_SAFE_INTEGER } });
    game.round.elapsedMs = Number.MAX_SAFE_INTEGER;
    const ctx = context(), layout = createLayout(viewport, game.round);
    renderGame(ctx, layout, game);
    for (const text of ctx.texts) inside(text, viewport);
    if (layout.hint) assert.ok(ctx.texts.some(item => item.value === '暂无法存档，请保持本页打开'));
  }
});
