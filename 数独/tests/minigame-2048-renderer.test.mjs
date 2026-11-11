import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLayout, renderGame } = require('../../微信小程序/src/games/game-2048/renderer.js');
const { newGame, applyMove } = require('../../微信小程序/src/games/game-2048/engine.js');

const viewports = [
  { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 240, height: 240, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 240, height: 240, safeTop: 44, safeBottom: 0, capsuleRect: { bottom: 82 } },
  { width: 480, height: 320, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
];

function context() {
  const texts = [], paths = [];
  const size = ctx => Number(/([\d.]+)px/.exec(ctx.font)[1]);
  const width = (value, fontSize) => Array.from(String(value)).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.6), 0);
  const ctx = new Proxy({
    texts, paths,
    measureText(value) { return { width: width(value, size(ctx)) }; },
    moveTo(x, y) { paths.push([x, y]); }, lineTo(x, y) { paths.push([x, y]); },
    fillText(value, x, y) {
      const h = size(ctx), w = width(value, h);
      texts.push({ value: String(value), x: x - (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y: y - h / 2, w, h });
    },
  }, { get(object, key) { return key in object ? object[key] : () => {}; } });
  return ctx;
}

function state(extra = {}) {
  return { round: newGame(2048), best: 5000, paused: false, status: 'playing', animation: null, storageAvailable: true, ...extra };
}
function intersects(a, b) {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
}
function inside(area, viewport) {
  assert.ok(area.x >= -1e-8 && area.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom) - 1e-8, JSON.stringify({ viewport, area }));
  assert.ok(area.x + area.w <= viewport.width + 1e-8 && area.y + area.h <= viewport.height - viewport.safeBottom + 1e-8, JSON.stringify({ viewport, area }));
}

test('2048 layout keeps a square grid and usable controls clear of capsule and device edges', () => {
  for (const viewport of viewports) {
    const layout = createLayout(viewport), ctx = context();
    const targets = renderGame(ctx, layout, state());
    assert.equal(layout.board.w, layout.board.h);
    assert.equal(layout.cells.length, 16);
    inside(layout.board, viewport);
    for (const cell of layout.cells) {
      inside(cell, viewport);
      assert.ok(cell.x > layout.board.x && cell.y > layout.board.y);
      assert.ok(cell.x + cell.w < layout.board.x + layout.board.w);
      assert.ok(cell.y + cell.h < layout.board.y + layout.board.h);
    }
    for (const target of targets) {
      inside(target, viewport);
      assert.ok(target.w >= 34 && target.h >= 34, JSON.stringify({ viewport, target }));
      assert.ok(target.label.length);
      assert.equal(intersects(target, layout.board), false);
    }
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      assert.equal(intersects(targets[i], targets[j]), false, JSON.stringify({ viewport, a: targets[i], b: targets[j] }));
    }
    assert.deepEqual(targets.filter(item => item.action === 'game-2048:move').map(item => item.payload), ['left', 'up', 'down', 'right']);
    for (const action of ['home', 'share', 'game-2048:new', 'game-2048:help', 'game-2048:pause']) {
      assert.ok(targets.some(item => item.action === action));
    }
    for (const text of ctx.texts) inside(text, viewport);
  }
});

test('2048 modal controls own the input area and terminal state takes priority over lifecycle pause', () => {
  for (const viewport of viewports) for (const [status, paused, actions, title] of [
    ['playing', true, ['game-2048:resume'], '歇一会儿，再继续'],
    ['won', false, ['game-2048:continue', 'game-2048:new'], '2048，达成！'],
    ['won', true, ['game-2048:continue', 'game-2048:new'], '2048，达成！'],
    ['over', false, ['game-2048:new'], '这一局，收获满满'],
    ['over', true, ['game-2048:new'], '这一局，收获满满'],
  ]) {
    const ctx = context(), targets = renderGame(ctx, createLayout(viewport), state({ status, paused }));
    assert.deepEqual(targets.map(item => item.action), ['home', 'share', ...actions]);
    const start = ctx.texts.findLastIndex(item => item.value === title);
    assert.ok(start >= 0);
    const copy = ctx.texts.slice(start, start + 2);
    for (const item of targets) inside(item, viewport);
    for (const text of ctx.texts) inside(text, viewport);
    for (const text of copy) for (const target of targets.slice(2)) assert.equal(intersects(text, target), false, JSON.stringify({ viewport, text, target }));
  }
});

test('2048 tile, score and best text remain inside bounds for maximum safe saved values', () => {
  for (const viewport of viewports) {
    const round = newGame(2048);
    round.board = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 32768, 1048576, 2 ** 50, 2 ** 52];
    round.score = Number.MAX_SAFE_INTEGER;
    const ctx = context();
    renderGame(ctx, createLayout(viewport), state({ round, best: Number.MAX_SAFE_INTEGER }));
    for (const text of ctx.texts) inside(text, viewport);
    const board = createLayout(viewport).board;
    const tileTexts = ctx.texts.filter(text => round.board.map(String).includes(text.value) && text.y >= board.y && text.y + text.h <= board.y + board.h);
    assert.equal(tileTexts.length, 16);
    const cells = createLayout(viewport).cells;
    tileTexts.forEach((text, i) => assert.ok(text.x >= cells[i].x && text.x + text.w <= cells[i].x + cells[i].w + 1e-8));
  }
});

test('2048 animation interpolates the original tiles then displays merged and spawned values', () => {
  const initial = newGame(2048);
  initial.board = [0, 2, 2, 0, ...Array(12).fill(0)];
  const result = applyMove(initial, 'left');
  const layout = createLayout(viewports[2]);
  const animation = { transitions: result.transitions, spawned: result.spawned, mergedIndices: result.mergedIndices, elapsed: 0, duration: 130 };
  const start = context(); renderGame(start, layout, state({ round: result.round, animation }));
  const before = start.texts.filter(item => item.value === '2');
  assert.equal(before.length, 2);
  assert.ok(Math.abs(before[0].x + before[0].w / 2 - (layout.cells[1].x + layout.cells[1].w / 2)) < 1e-8);
  const end = context(); renderGame(end, layout, state({ round: result.round, animation: { ...animation, elapsed: 130 } }));
  assert.ok(end.texts.some(item => item.value === '4'));
  assert.equal(end.texts.filter(item => item.value === String(result.spawned.value)).length, result.spawned.value === 4 ? 2 : 1);
});

test('2048 warns about unavailable saves in the ordinary play hint', () => {
  const ctx = context();
  renderGame(ctx, createLayout(viewports[2]), state({ storageAvailable: false }));
  assert.ok(ctx.texts.some(item => item.value === '暂无法存档，请保持本页打开'));
});
