import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLayout, renderGame, COLORS } = require('../../微信小程序/src/games/gomoku/renderer.js');

const viewports = [
  { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 480, height: 320, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 240, height: 240, safeTop: 44, safeBottom: 0, capsuleRect: { bottom: 82 } },
];
function state(extra = {}) {
  return { round: { board: Array(225).fill(0), moves: [], turn: 1, status: 'playing', winner: 0, winningLine: [], mode: 'ai', humanColor: 1, difficulty: 'normal' },
    paused: false, thinking: false, storageAvailable: true, ...extra };
}
function context() {
  const texts = [], arcs = [], lines = [], fills = [];
  const fontSize = ctx => Number(/([\d.]+)px/.exec(ctx.font)[1]);
  const textWidth = (value, size) => Array.from(String(value)).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? size : size * 0.6), 0);
  const ctx = new Proxy({ texts, arcs, lines, fills,
    measureText(value) { return { width: textWidth(value, fontSize(ctx)) }; },
    arc(...args) { arcs.push(args); },
    fill() { fills.push({ color: ctx.fillStyle, arc: arcs.at(-1) }); },
    lineTo(...args) { lines.push(args); },
    fillText(value, x, y) {
      const h = fontSize(ctx), w = textWidth(value, h);
      texts.push({ value: String(value), color: ctx.fillStyle, x: x - (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y: y - h / 2, w, h });
    },
  }, { get(object, key) { return key in object ? object[key] : () => {}; } });
  return ctx;
}
function inside(area, viewport) {
  const detail = JSON.stringify({ area, viewport });
  assert.ok(area.x >= -1e-8 && area.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom) - 1e-8, detail);
  assert.ok(area.w > 0 && area.h > 0, detail);
  assert.ok(area.x + area.w <= viewport.width + 1e-8 && area.y + area.h <= viewport.height - viewport.safeBottom + 1e-8, detail);
}
const intersects = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;

test('gomoku board intersections and controls stay separate inside safe areas in portrait and landscape', () => {
  for (const viewport of viewports) for (const mode of ['ai', 'local']) {
    const layout = createLayout(viewport), game = state(), ctx = context(); game.round.mode = mode;
    const targets = renderGame(ctx, layout, game);
    inside(layout.board, viewport); assert.equal(layout.cells.length, 225);
    for (const cell of layout.cells) { inside(cell, viewport); assert.equal(cell.w, cell.h); }
    for (const target of targets) { inside(target, viewport); assert.ok(target.label); }
    for (const text of ctx.texts) inside(text, viewport);
    for (let i = 0; i < targets.length; i += 1) for (let j = i + 1; j < targets.length; j += 1)
      assert.equal(intersects(targets[i], targets[j]), false, JSON.stringify({ viewport, a: targets[i], b: targets[j] }));
    assert.equal(targets.filter(item => item.action === 'gomoku:cell').length, 225);
    for (const action of ['home', 'share', 'gomoku:help', 'gomoku:new', 'gomoku:pause']) assert.ok(targets.some(item => item.action === action));
    assert.equal(targets.filter(item => item.action === 'gomoku:color').length, mode === 'ai' ? 1 : 0);
  }
});

test('gomoku board uses most available portrait width with readable stone spacing', () => {
  assert.ok(createLayout(viewports[0]).step >= 22);
  assert.ok(createLayout(viewports[1]).step >= 18);
  assert.ok(createLayout(viewports[2]).step >= 16);
  assert.ok(createLayout(viewports[4]).step >= 9);
});

test('gomoku blocks board targets during AI turns, pauses, and results', () => {
  const layout = createLayout(viewports[0]);
  for (const condition of ['thinking', 'ai-turn', 'paused', 'won', 'draw']) {
    const game = state();
    if (condition === 'ai-turn') game.round.turn = 2;
    else if (['won', 'draw'].includes(condition)) game.round.status = condition;
    else game[condition] = true;
    const targets = renderGame(context(), layout, game);
    assert.equal(targets.some(item => item.action === 'gomoku:cell'), false, condition);
    assert.ok(targets.some(item => item.action === 'home'));
    if (condition === 'paused') assert.deepEqual(targets.map(item => item.action), ['home', 'gomoku:help', 'share', 'gomoku:resume', 'gomoku:resume']);
    else assert.ok(targets.some(item => item.action === 'gomoku:new'));
  }
});

test('gomoku draws occupied stones and winning line without making occupied targets', () => {
  const game = state(), layout = createLayout(viewports[0]), ctx = context();
  game.round.board[112] = 1; game.round.moves = [112]; game.round.mode = 'local'; game.round.turn = 2;
  const targets = renderGame(ctx, layout, game);
  assert.equal(targets.filter(item => item.action === 'gomoku:cell').length, 224);
  assert.equal(targets.some(item => item.action === 'gomoku:cell' && item.payload === 112), false);
  assert.ok(targets.some(item => item.action === 'gomoku:undo'));
  assert.ok(ctx.arcs.length > 5);
  game.round.status = 'won'; game.round.winner = 1; game.round.winningLine = [112, 113, 114, 115, 116];
  const wonContext = context(); renderGame(wonContext, layout, game);
  assert.ok(wonContext.texts.some(item => item.value === '黑棋获胜'));
  assert.deepEqual(wonContext.lines.at(-1), [layout.cells[116].cx, layout.cells[116].cy]);
});

test('gomoku pause panels and save warnings remain within every supported viewport', () => {
  for (const viewport of viewports) {
    const game = state({ paused: true, storageAvailable: false }), ctx = context();
    const targets = renderGame(ctx, createLayout(viewport), game);
    for (const text of ctx.texts) inside(text, viewport);
    for (const target of targets) inside(target, viewport);
    assert.ok(ctx.texts.some(item => item.value === '暂无法存档，请保持本页打开'));
    assert.ok(targets.some(item => item.action === 'gomoku:resume'));
  }
});

test('gomoku only offers AI undo after a human decision', () => {
  const layout = createLayout(viewports[0]);
  for (const humanColor of [1, 2]) for (let count = 0; count <= 3; count += 1) {
    const game = state(); game.round.humanColor = humanColor;
    game.round.moves = Array.from({ length: count }, (_, index) => index);
    game.round.moves.forEach((index, move) => { game.round.board[index] = move % 2 + 1; });
    const targets = renderGame(context(), layout, game);
    assert.equal(targets.some(item => item.action === 'gomoku:undo'), count >= humanColor,
      `human ${humanColor}, ${count} moves`);
  }
});

test('gomoku won status marker uses the winning color rather than the next turn', () => {
  const layout = createLayout(viewports[0]);
  for (const winner of [1, 2]) {
    const game = state(), ctx = context();
    game.round.status = 'won'; game.round.winner = winner; game.round.turn = 3 - winner;
    renderGame(ctx, layout, game);
    const statusFill = ctx.fills.find(fill => fill.arc && fill.arc[0] === layout.status.x + 12 && fill.arc[1] === layout.status.y + layout.status.h * 0.33);
    assert.equal(statusFill.color, winner === 1 ? COLORS.black : COLORS.white);
  }
});

test('gomoku paused controls visually match enabled actions and both continue buttons work', () => {
  for (const viewport of viewports) {
    const game = state({ paused: true }), ctx = context();
    game.round.moves = [112]; game.round.board[112] = 1;
    const targets = renderGame(ctx, createLayout(viewport), game);
    for (const label of ['继续', '继续游戏']) {
      assert.ok(targets.some(target => target.label === label && target.action === 'gomoku:resume'));
      assert.notEqual(ctx.texts.find(text => text.value === label).color, '#9aa39b');
    }
    for (const label of ['人机对战', '同机双人', '普通难度', '换先后', '悔棋', '重开']) {
      assert.equal(targets.some(target => target.label === label), false, label);
      assert.equal(ctx.texts.find(text => text.value === label).color, '#9aa39b', label);
    }
  }
});

test('gomoku exposes the selected AI difficulty in its existing controls row and subtitle', () => {
  for (const viewport of viewports) for (const [difficulty, label] of [['easy', '简单'], ['normal', '普通'], ['hard', '困难']]) {
    for (const mode of ['ai', 'local']) for (const paused of [false, true]) {
      const game = state({ paused }), ctx = context(), layout = createLayout(viewport);
      game.round.difficulty = difficulty; game.round.mode = mode;
      const targets = renderGame(ctx, layout, game);
      const selector = targets.filter(target => target.action === 'gomoku:chooseDifficulty');
      assert.equal(selector.length, mode === 'ai' && !paused ? 1 : 0);
      if (mode === 'ai') {
        const drawnLabel = ctx.texts.find(text => text.value === `${label}难度`);
        assert.ok(drawnLabel);
        assert.equal(drawnLabel.color === '#9aa39b', paused);
        assert.ok(ctx.texts.some(text => text.value === `你执黑 · ${label}电脑 · 0 手`));
        if (!paused) {
          assert.equal(selector[0].label, `${label}难度`);
          assert.equal(selector[0].y, layout.modes.y);
          assert.equal(selector[0].h, layout.modes.h);
          assert.equal('payload' in selector[0], false);
        }
      } else {
        assert.equal(ctx.texts.some(text => text.value === `${label}难度`), false);
        assert.ok(ctx.texts.some(text => text.value === '黑白轮流落子 · 0 手'));
      }
      for (const text of ctx.texts) inside(text, viewport);
      const controls = targets.filter(target => target.action !== 'gomoku:cell');
      for (const target of controls) inside(target, viewport);
      for (let i = 0; i < controls.length; i += 1) for (let j = i + 1; j < controls.length; j += 1)
        assert.equal(intersects(controls[i], controls[j]), false, JSON.stringify({ viewport, difficulty, mode, paused, a: controls[i], b: controls[j] }));
    }
  }
});

test('gomoku renders legacy rounds without difficulty as normal', () => {
  const game = state(), ctx = context(); delete game.round.difficulty;
  const targets = renderGame(ctx, createLayout(viewports[0]), game);
  assert.equal(targets.find(target => target.action === 'gomoku:chooseDifficulty').label, '普通难度');
  assert.ok(ctx.texts.some(text => text.value === '你执黑 · 普通电脑 · 0 手'));
});
