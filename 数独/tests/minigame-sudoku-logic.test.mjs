import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { generatePuzzle, isComplete } from '../js/sudoku.js';

const require = createRequire(import.meta.url);
const { RATING_VERSION, TECHNIQUES, FULL_MASK, createLogicState, findStep, findSteps, validateStep, applyStep, analyze } = require('../../微信小程序/src/games/sudoku/logic.js');
const mask = (...digits) => digits.reduce((value, digit) => value | (1 << (digit - 1)), 0);
const empty = () => createLogicState(Array(81).fill(0));
const remove = (state, indices, ...digits) => { for (const index of indices) state.candidates[index] &= ~mask(...digits); };
const row = index => Array.from({ length: 9 }, (_, col) => index * 9 + col);
const box0 = [0, 1, 2, 9, 10, 11, 18, 19, 20];
const sameCells = (step, cells) => step.cells.join(',') === cells.slice().sort((a, b) => a - b).join(',');
const stepFor = (state, technique, cells) => findSteps(state, { techniqueId: technique }).find(step => sameCells(step, cells));

test('logic metadata is versioned, comprehensive, and independent from clue density', () => {
  assert.equal(RATING_VERSION, 'logic-v1');
  assert.equal(TECHNIQUES.length, 12);
  assert.deepEqual(TECHNIQUES.map(item => item.tier), [0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  assert.ok(TECHNIQUES.every(item => item.label && item.lesson && item.pitfall));
  assert.equal(FULL_MASK, 511);
});

test('candidate initialization validates boards, intersects persisted candidates, and does not mutate inputs', () => {
  const { puzzle } = generatePuzzle('logic-init', 'easy');
  const before = puzzle.slice();
  const state = createLogicState(puzzle);
  assert.equal(state.valid, true);
  assert.deepEqual(puzzle, before);
  const index = state.board.indexOf(0);
  const candidate = state.candidates[index] & -state.candidates[index];
  const saved = state.candidates.slice();
  saved[index] = candidate;
  const restored = createLogicState(puzzle, saved);
  assert.equal(restored.candidates[index], candidate);
  restored.candidates[index] = 0;
  assert.equal(saved[index], candidate);
  assert.equal(createLogicState([1, 1, ...Array(79).fill(0)]).valid, false);
  assert.equal(createLogicState(Array(80).fill(0)).valid, false);
  assert.equal(createLogicState(Array(81).fill(0), Array(81).fill(0)).valid, false);
  assert.equal(createLogicState(Array(81).fill(0), Array(81).fill(512)).valid, false);
  const noPosition = Array(81).fill(FULL_MASK);
  for (let index = 0; index < 9; index += 1) noPosition[index] &= ~mask(9);
  assert.equal(createLogicState(Array(81).fill(0), noPosition).valid, false);
});

test('naked single proves its sole candidate and refuses an arbitrary correct-looking placement', () => {
  const state = empty(); state.candidates[0] = mask(4);
  const step = stepFor(state, 'naked-single', [0]);
  assert.deepEqual(step.placements, [{ index: 0, value: 4 }]);
  assert.equal(validateStep(state, step), true);
  assert.equal(validateStep(state, { ...step, placements: [{ index: 0, value: 7 }] }), false);
  const before = state.board.slice();
  assert.equal(applyStep(state, { ...step, placements: [{ index: 0, value: 7 }] }), false);
  assert.deepEqual(state.board, before);
  assert.equal(applyStep(state, step), true);
  assert.equal(state.board[0], 4);
  assert.equal(state.candidates[1] & mask(4), 0);
  const invalid = empty(); invalid.candidates[0] = mask(4, 7);
  assert.equal(stepFor(invalid, 'naked-single', [0]), undefined);
});

test('hidden single counts the entire unit and does not require a single candidate cell', () => {
  const state = empty(); remove(state, row(0).slice(1), 5);
  const step = stepFor(state, 'hidden-single', [0]);
  assert.ok(step.placements.some(action => action.value === 5));
  assert.equal(validateStep(state, step), true);
  state.candidates[8] |= mask(5);
  assert.equal(stepFor(state, 'hidden-single', [0]), undefined);
});

test('pointing uses all positions inside the box and needs a real outside elimination', () => {
  const state = empty(); remove(state, box0.filter(index => ![0, 1].includes(index)), 6);
  const step = stepFor(state, 'pointing', [0, 1]);
  assert.ok(step.eliminations.some(action => action.index === 3 && action.digit === 6));
  assert.equal(validateStep(state, step), true);
  state.candidates[9] |= mask(6);
  assert.equal(stepFor(state, 'pointing', [0, 1]), undefined);
  const noAction = empty();
  remove(noAction, box0.filter(index => ![0, 1].includes(index)), 6);
  remove(noAction, row(0).slice(3), 6);
  assert.equal(stepFor(noAction, 'pointing', [0, 1]), undefined);
});

test('claiming counts the whole row before excluding other box positions', () => {
  const state = empty(); remove(state, row(0).filter(index => ![0, 1].includes(index)), 6);
  const step = stepFor(state, 'claiming', [0, 1]);
  assert.ok(step.eliminations.some(action => action.index === 9 && action.digit === 6));
  assert.equal(validateStep(state, step), true);
  state.candidates[8] |= mask(6);
  assert.equal(stepFor(state, 'claiming', [0, 1]), undefined);
});

test('naked pair requires the exact two-candidate union and accepts any valid alternative structure', () => {
  const state = empty(); state.candidates[0] = state.candidates[1] = mask(2, 7);
  state.candidates[27] = state.candidates[28] = mask(3, 8);
  const step = stepFor(state, 'naked-pair', [0, 1]);
  const alternative = stepFor(state, 'naked-pair', [27, 28]);
  assert.ok(step && alternative);
  assert.equal(validateStep(state, alternative), true);
  assert.equal(validateStep(state, { technique: alternative.technique, cells: alternative.cells, eliminations: [alternative.eliminations[0]] }), true);
  assert.equal(validateStep(state, { ...step, eliminations: [...step.eliminations, { index: 2, digit: 9 }] }), false);
  assert.equal(validateStep(state, { ...step, cells: [0] }), false);
  state.candidates[1] |= mask(9);
  assert.equal(stepFor(state, 'naked-pair', [0, 1]), undefined);
});

test('hidden pair restricts both digits to two cells and removes only other candidates', () => {
  const state = empty(); remove(state, row(0).slice(2), 2, 7);
  const step = stepFor(state, 'hidden-pair', [0, 1]);
  assert.deepEqual(step.digits, [2, 7]);
  assert.ok(step.eliminations.every(action => [0, 1].includes(action.index) && ![2, 7].includes(action.digit)));
  assert.equal(validateStep(state, step), true);
  state.candidates[8] |= mask(2);
  assert.equal(stepFor(state, 'hidden-pair', [0, 1]), undefined);
});

test('naked triple permits incomplete candidate combinations but rejects four-digit unions', () => {
  const state = empty(); state.candidates[0] = mask(1, 2); state.candidates[1] = mask(2, 3); state.candidates[2] = mask(1, 3);
  const step = stepFor(state, 'naked-triple', [0, 1, 2]);
  assert.deepEqual(step.digits, [1, 2, 3]);
  assert.equal(validateStep(state, step), true);
  state.candidates[2] |= mask(4);
  assert.equal(stepFor(state, 'naked-triple', [0, 1, 2]), undefined);
});

test('hidden triple includes all locations of the selected three digits', () => {
  const state = empty(); remove(state, row(0).slice(3), 1, 2, 3);
  const step = stepFor(state, 'hidden-triple', [0, 1, 2]);
  assert.deepEqual(step.digits, [1, 2, 3]);
  assert.equal(validateStep(state, step), true);
  state.candidates[8] |= mask(3);
  assert.equal(stepFor(state, 'hidden-triple', [0, 1, 2]), undefined);
});

function fish(size) {
  const state = empty();
  const patterns = size === 2 ? [[0, [1, 4]], [3, [1, 4]]] : [[0, [1, 4]], [3, [4, 7]], [6, [1, 7]]];
  const cells = [];
  for (const [base, cols] of patterns) {
    const chosen = cols.map(col => base * 9 + col); cells.push(...chosen);
    remove(state, row(base).filter(index => !chosen.includes(index)), 6);
  }
  return { state, cells };
}

test('X-Wing uses two exact base lines and supports its transposed orientation', () => {
  const { state, cells } = fish(2);
  const step = stepFor(state, 'x-wing', cells);
  assert.ok(step.eliminations.some(action => action.index === 10 && action.digit === 6));
  assert.equal(validateStep(state, step), true);
  const transposed = empty();
  transposed.candidates = state.candidates.map((_, index) => state.candidates[(index % 9) * 9 + Math.floor(index / 9)]);
  const reverse = stepFor(transposed, 'x-wing', cells.map(index => (index % 9) * 9 + Math.floor(index / 9)));
  assert.equal(reverse.orientation, 'columns');
  state.candidates[7] |= mask(6);
  assert.equal(stepFor(state, 'x-wing', cells), undefined);
});

test('Swordfish restricts three base lines to three cover lines and rejects a fourth cover', () => {
  const { state, cells } = fish(3);
  const step = stepFor(state, 'swordfish', cells);
  assert.ok(step.eliminations.some(action => action.index === 10 && action.digit === 6));
  assert.equal(validateStep(state, step), true);
  state.candidates[8] |= mask(6);
  assert.equal(stepFor(state, 'swordfish', cells), undefined);
});

test('XY-Wing needs two distinct pivot candidates and a common outside digit', () => {
  const state = empty(); state.candidates[0] = mask(1, 2); state.candidates[3] = mask(1, 3); state.candidates[27] = mask(2, 3);
  const step = stepFor(state, 'xy-wing', [0, 3, 27]);
  assert.equal(step.pivot, 0);
  assert.ok(step.eliminations.some(action => action.index === 30 && action.digit === 3));
  assert.equal(validateStep(state, step), true);
  assert.equal(validateStep(state, { ...step, eliminations: [{ index: 4, digit: 3 }] }), false);
  state.candidates[3] = mask(1, 3, 4);
  assert.equal(stepFor(state, 'xy-wing', [0, 3, 27]), undefined);
});

test('XYZ-Wing targets must also see the pivot, in addition to both wings', () => {
  const state = empty(); state.candidates[0] = mask(1, 2, 3); state.candidates[1] = mask(1, 3); state.candidates[9] = mask(2, 3);
  const step = stepFor(state, 'xyz-wing', [0, 1, 9]);
  assert.ok(step.eliminations.some(action => action.index === 10 && action.digit === 3));
  assert.equal(validateStep(state, step), true);
  const distant = empty(); distant.candidates[0] = mask(1, 2, 3); distant.candidates[3] = mask(1, 3); distant.candidates[27] = mask(2, 3);
  assert.equal(stepFor(distant, 'xyz-wing', [0, 3, 27]), undefined);
});

test('partial eliminations persist and do not create an empty candidate cell', () => {
  const state = empty(); state.candidates[0] = state.candidates[1] = mask(2, 7);
  const step = stepFor(state, 'naked-pair', [0, 1]);
  const partial = { technique: step.technique, cells: step.cells, eliminations: [{ index: 2, digit: 2 }] };
  assert.equal(applyStep(state, partial), true);
  assert.equal(state.candidates[2] & mask(2), 0);
  assert.equal(state.candidates[2] & mask(7), mask(7));
  assert.equal(applyStep(state, partial), false);
  assert.equal(createLogicState(state.board, state.candidates).candidates[2] & mask(2), 0);
  const bad = empty(); bad.candidates[0] = bad.candidates[1] = bad.candidates[2] = mask(2, 7);
  assert.equal(stepFor(bad, 'naked-pair', [0, 1]), undefined);
});

test('unknown, malformed, and actionless submissions never pass proof validation', () => {
  const state = empty(); state.candidates[0] = mask(4);
  const step = findStep(state);
  for (const invalid of [null, {}, { ...step, technique: 'magic' }, { ...step, cells: [0, 0] }, { ...step, placements: [] }, { ...step, placements: Array(1) }, { ...step, eliminations: Array(1) }, { ...step, digits: [7] }, { ...step, placements: [{ index: -1, value: 4 }] }]) {
    assert.equal(validateStep(state, invalid), false);
  }
  assert.equal(findStep(state, { maxTier: -1 }), null);
  assert.equal(findStep(state, { techniqueId: 'magic' }), null);
});

test('stalled and invalid puzzles stay unrated; completion and grade come from actual logical steps', () => {
  const unknown = analyze(Array(81).fill(0), { trace: true });
  assert.equal(unknown.solved, false); assert.equal(unknown.rating, null); assert.equal(unknown.stalled, true);
  assert.deepEqual(unknown.trace, []);
  assert.equal(analyze([1, 1, ...Array(79).fill(0)]).valid, false);
  const { puzzle } = generatePuzzle('logic-easy', 'easy');
  const result = analyze(puzzle, { trace: true, maxTier: 0 });
  assert.equal(result.solved, true); assert.equal(result.rating, 'easy'); assert.equal(isComplete(result.board), true);
  assert.ok(result.trace.length && result.trace.every(step => step.tier === 0));
  assert.equal(result.steps, result.trace.length);
});

test('generated unique puzzles replay deterministically, never eliminate the solution, and justify every action', () => {
  let sawAdvanced = false;
  for (let seed = 0; seed < 36; seed += 1) {
    const { puzzle, solution } = generatePuzzle(`logic-safety-${seed}`, ['easy', 'medium', 'hard', 'expert'][seed % 4]);
    const original = puzzle.slice();
    const result = analyze(puzzle, { trace: true });
    const state = createLogicState(puzzle);
    for (const step of result.trace) {
      assert.ok(step.explanation && step.cells.length);
      for (const { index, value } of step.placements) assert.equal(value, solution[index], `${step.technique} wrong placement at ${index}`);
      for (const { index, digit } of step.eliminations) assert.notEqual(digit, solution[index], `${step.technique} wrong elimination at ${index}`);
      assert.equal(validateStep(state, step), true, step.technique);
      assert.equal(applyStep(state, step), true);
      sawAdvanced ||= step.tier > 0;
    }
    assert.deepEqual(state.board, result.board);
    assert.deepEqual(state.candidates, result.candidates);
    assert.deepEqual(puzzle, original);
    assert.deepEqual(analyze(puzzle, { trace: true }), result);
    assert.equal(result.rating === null, !result.solved);
  }
  assert.equal(sawAdvanced, true);
});

test('all twelve rules preserve a known completion across 400 independent candidate configurations', () => {
  // Each mask is an independently reduced over-approximation containing the
  // known solution. This checks every reported structure, not only the first
  // structure selected by the deterministic grading path.
  const { solution } = generatePuzzle('logic-fuzz', 'easy');
  let seed = 97123;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const counts = Object.fromEntries(TECHNIQUES.map(item => [item.id, 0]));
  for (let sample = 0; sample < 400; sample += 1) {
    const board = solution.map(value => random() < 0.10 ? value : 0);
    const state = createLogicState(board);
    state.candidates = state.candidates.map((natural, index) => board[index] ? 0 : Array.from({ length: 9 }, (_, i) => i + 1)
      .reduce((acc, digit) => natural & mask(digit) && (digit === solution[index] || random() < 0.28) ? acc | mask(digit) : acc, 0));
    for (const step of findSteps(state)) {
      counts[step.technique] += 1;
      for (const { index, value } of step.placements) assert.equal(value, solution[index], step.technique);
      for (const { index, digit } of step.eliminations) assert.notEqual(digit, solution[index], step.technique);
    }
  }
  assert.ok(Object.values(counts).every(count => count > 0), JSON.stringify(counts));
});
