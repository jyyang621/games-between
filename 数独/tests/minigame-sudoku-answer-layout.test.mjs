import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLayout, render, COLORS } = require('../../微信小程序/src/games/sudoku/renderer.js');
const { SudokuGame } = require('../../微信小程序/src/games/sudoku/state.js');

function context() {
  const text = [], fills = [], stack = [];
  const ctx = new Proxy({
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
    save() { stack.push({ fillStyle: this.fillStyle, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline }); },
    restore() { Object.assign(this, stack.pop() || {}); },
    measureText(value) {
      const size = Number(this.font.match(/([\d.]+)px/)?.[1] || 12);
      return { width: Array.from(String(value)).reduce((n, letter) => n + (letter.charCodeAt(0) < 128 ? 0.58 : 1) * size, 0) };
    },
    fillText(value, x, y) { text.push({ value: String(value), x, y, color: this.fillStyle, font: this.font }); },
    fillRect(x, y, w, h) { fills.push({ x, y, w, h, color: this.fillStyle }); },
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  return { ctx, text, fills };
}
function game() {
  const result = new SudokuGame({ now: () => 1000, seed: 'answer-renderer', difficulty: 'medium' });
  const index = result.board.indexOf(0);
  result.select(index);
  result.input(result.solution[index]);
  return result;
}
function layout(width, height, safeTop = 44, safeBottom = 24) {
  return createLayout(width, height, safeTop, safeBottom,
    { left: width - 154, right: width - 8, top: safeTop + 6, bottom: safeTop + 38 });
}
function inside(target, l) {
  assert.ok(target.x >= -1e-7 && target.x + target.w <= l.width + 1e-7);
  assert.ok(target.y >= l.safeTop - 1e-7 && target.y + target.h <= l.height - l.safeBottom + 1e-7);
}

test('answer mode paints the full trusted solution in both given and revealed colors without changing the current round', () => {
  const g = game(), empty = g.board.indexOf(0);
  g.state.board[empty] = g.solution[empty] % 9 + 1;
  g.state.notes[g.board.findIndex((value, index) => !value && index !== empty)] = [1, 2];
  const before = structuredClone(g.state), l = layout(390, 844), c = context();
  const targets = render(c.ctx, l, g, { answerVisible: true, hintCells: [empty] });
  const digits = c.text.filter(item => /^[1-9]$/.test(item.value));
  assert.equal(digits.length, 81, 'all 81 solution digits must be visible');
  assert.deepEqual(digits.map(item => item.value), g.solution.map(String));
  assert.equal(new Set(digits.map(item => item.x + ':' + item.y)).size, 81);
  digits.forEach((item, index) => assert.equal(item.color, g.puzzle[index] ? '#344436' : COLORS.blue));
  assert.deepEqual(g.state, before, 'viewing answers must leave values, notes, history, clock and completion intact');
  assert.deepEqual(targets.map(target => target.action), ['closeAnswer']);
  assert.equal(targets[0].label, '返回题目');
  assert.ok(c.text.some(item => item.value === '正确答案'));
  assert.ok(c.text.some(item => item.value.includes('本局不计成绩')));
  assert.equal(c.fills.some(item => item.color === '#fbf0d3'), false, 'hint coloring must not carry into the answer grid');
});

for (const [width, height] of [[320, 568], [390, 844], [844, 390], [480, 320]]) {
  test('answer view remains readable and closeable within safe areas at ' + width + 'x' + height, () => {
    const l = layout(width, height), c = context(), g = game();
    const targets = render(c.ctx, l, g, { answerVisible: true });
    assert.equal(targets.length, 1);
    const close = targets[0];
    assert.equal(close.action, 'closeAnswer');
    assert.ok(close.w >= 44 && close.h >= 44);
    inside(close, l);
    const digits = c.text.filter(item => /^[1-9]$/.test(item.value));
    assert.equal(digits.length, 81);
    assert.ok(digits.every(item => item.y >= l.capsuleRect.bottom + 8 && item.y < l.height - l.safeBottom));
    assert.ok(digits.every(item => item.x > 0 && item.x < l.width));
    assert.ok(c.text.filter(item => item.value.includes('正确答案') || item.value.includes('仅供对照'))
      .every(item => item.y > l.capsuleRect.bottom));
  });
}

test('the explicit answer control and original actions retain non-overlapping 44px hit slots including short landscape', () => {
  const g = game();
  for (const [width, height, top, bottom] of [[320, 568, 44, 24], [390, 844, 44, 34], [844, 390, 0, 0], [480, 320, 0, 0], [480, 320, 44, 24]]) {
    const l = layout(width, height, top, bottom), c = context();
    const targets = render(c.ctx, l, g);
    const tools = ['undo', 'erase', 'notes', 'autoNotes', 'hint', 'showAnswer'].map(action => targets.find(item => item.action === action));
    tools.forEach((target, index) => {
      assert.ok(target, 'missing original/new action ' + index);
      assert.ok(target.w >= 44 - 1e-7 && target.h >= 44, 'undersized tool ' + target.action + ' at ' + width + 'x' + height);
      inside(target, l);
      if (index) assert.ok(tools[index - 1].x + tools[index - 1].w <= target.x + 1e-7);
    });
    const answer = tools.at(-1);
    assert.equal(answer.label, '显示答案');
    assert.ok(c.text.some(item => item.value === '显示答案'));
    for (const action of ['newGame', 'share', 'more']) assert.ok(targets.some(item => item.action === action));
    const more = targets.find(item => item.action === 'more');
    assert.ok(more.w >= 72 && more.h >= 44);
    inside(more, l);
  }
});

test('answers stay available while paused or completed and do not expose ordinary edit controls', () => {
  const g = game(), l = layout(320, 568);
  g.setPaused(true);
  let targets = render(context().ctx, l, g);
  assert.ok(targets.some(target => target.action === 'showAnswer'));
  assert.equal(targets.some(target => ['select', 'digit', 'hint', 'erase', 'notes', 'autoNotes', 'undo'].includes(target.action)), false);
  g.state.board = g.solution.slice();
  g._checkComplete();
  targets = render(context().ctx, l, g);
  assert.ok(targets.some(target => target.action === 'showAnswer'));
  assert.equal(render(context().ctx, l, g, { generating: true }).some(target => target.action === 'showAnswer'), false);
  const c = context();
  render(c.ctx, l, g, { answerVisible: true });
  assert.ok(c.text.some(item => item.value.includes('原有成绩保留')));
});

test('a completed round that viewed answers explicitly says it does not count towards scores, including a tiny board', () => {
  const g = game();
  g.state.board = g.solution.slice();
  g.state.answerViewed = true;
  g._checkComplete();
  for (const [width, height] of [[320, 568], [480, 320]]) {
    const c = context();
    render(c.ctx, layout(width, height), g);
    assert.ok(c.text.some(item => item.value.includes('本局不计成绩')));
  }
});

test('an applied hint highlights affected candidate cells without altering any state', () => {
  const g = game(), index = g.board.indexOf(0), l = layout(390, 844), c = context();
  g.state.notes[index] = [1, 2];
  const before = structuredClone(g.state);
  render(c.ctx, l, g, { hintCells: [index] });
  const x = l.board.x + index % 9 * l.cellSize, y = l.board.y + Math.floor(index / 9) * l.cellSize;
  assert.ok(c.fills.some(item => Math.abs(item.x - x) < 1e-7 && Math.abs(item.y - y) < 1e-7 && item.color === '#fbf0d3'));
  assert.deepEqual(g.state, before);
});
