import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SudokuTraining } = require('../../微信小程序/src/games/sudoku/training.js');
const { LESSONS } = require('../../微信小程序/src/games/sudoku/lessons.js');
const { getTrainingSource } = require('../../微信小程序/src/games/sudoku/bank.js');

function support(course, cells = course.training.step.cells) {
  assert.equal(course.activate('trainingMode', 'support'), true);
  for (const index of cells) assert.equal(course.activate('trainingCell', index), true);
}
function operate(course, { all = true } = {}) {
  const step = course.training.step;
  if (step.placements.length) {
    assert.equal(course.activate('trainingMode', 'place'), true);
    const action = step.placements[0];
    assert.equal(course.activate('trainingCell', action.index), true);
    assert.equal(course.activate('trainingDigit', action.value), true);
  } else {
    assert.equal(course.activate('trainingMode', 'eliminate'), true);
    for (const action of all ? step.eliminations : step.eliminations.slice(0, 1)) assert.equal(course.activate('trainingCandidate', action), true);
  }
}
function answer(course) { support(course); operate(course); assert.equal(course.activate('trainingCheck'), true); }

test('all twelve lessons have validated examples and start in guided or independent mode', () => {
  const course = new SudokuTraining();
  assert.equal(course.view.screen, 'catalog');
  assert.equal(course.view.lessons.length, 12);
  for (const lesson of course.view.lessons) {
    assert.ok(lesson.available && lesson.count > 0);
    for (const mode of ['guided', 'independent']) {
      assert.equal(course.activate('lesson', lesson.id), true);
      assert.equal(course.view.screen, 'lesson');
      assert.equal(course.activate('practice', { id: lesson.id, mode }), true);
      assert.equal(course.view.screen, 'exercise');
      assert.equal(course.training.mode, mode);
      assert.equal(course.training.hintLevel, mode === 'guided' ? 2 : 0);
      assert.equal(course.training.board.length, 81);
      assert.equal(course.training.candidates.length, 81);
      assert.equal(course.training.step.technique, lesson.id);
      assert.ok(course.training.step.cells.length > 0);
    }
  }
  assert.equal(course.start('imaginary'), false);
  assert.equal(course.start('naked-pair', 'guess'), false);
});

test('every technique accepts evidence plus its legal action and counts independent success exactly once', () => {
  for (const lesson of LESSONS) {
    const course = new SudokuTraining(); course.start(lesson.id, 'independent');
    const board = course.training.board.slice(), candidates = course.training.candidates.slice();
    answer(course);
    assert.equal(course.training.completed, true, lesson.id);
    assert.deepEqual(course.progress[lesson.id], { solved: 1, independent: 1 }, lesson.id);
    assert.deepEqual(course.training.board, board, 'submissions do not mutate the source exercise');
    assert.deepEqual(course.training.candidates, candidates, 'candidate deletions remain visible player operations');
    assert.equal(course.activate('trainingCheck'), false);
    assert.deepEqual(course.progress[lesson.id], { solved: 1, independent: 1 });
    const previousId = course.training.id;
    assert.equal(course.activate('trainingNext'), true);
    if (course.examples().length > 1) assert.notEqual(course.training.id, previousId);
    assert.equal(course.training.completed, false);
    assert.deepEqual(course.training.selectedCells, []);
    assert.deepEqual(course.training.selectedEliminations, []);
  }
});

test('a missing or wrong supporting structure rejects even an elimination known not to be the answer', () => {
  const course = new SudokuTraining(); course.start('naked-pair', 'independent');
  const action = course.training.step.eliminations[0];
  const source = getTrainingSource(course.training.sourcePuzzleId);
  assert.ok(source);
  assert.notEqual(source.solution[action.index], action.digit, 'the candidate is demonstrably not the solution value');
  operate(course, { all: false });
  assert.equal(course.activate('trainingCheck'), true);
  assert.equal(course.training.completed, false);
  assert.match(course.training.feedback, /支持|依据/);
  support(course, course.training.step.cells.slice(0, 1));
  assert.equal(course.activate('trainingCheck'), true);
  assert.equal(course.training.completed, false);
  assert.equal(course.progress['naked-pair'], undefined);
  // Complete the missing pair without changing that elimination; the same
  // operation now has the complete logical support required by the technique.
  support(course, course.training.step.cells.slice(1));
  assert.equal(course.activate('trainingCheck'), true);
  assert.equal(course.training.completed, true);
  assert.deepEqual(course.progress['naked-pair'], { solved: 1, independent: 1 });
});

test('incorrect placement and extra elimination cannot pass alongside otherwise correct evidence', () => {
  const single = new SudokuTraining(); single.start('hidden-single', 'independent'); support(single);
  const target = single.training.step.placements[0];
  single.activate('trainingMode', 'place'); single.activate('trainingCell', target.index);
  const otherCandidate = Array.from({ length: 9 }, (_, i) => i + 1).find(value => value !== target.value && (single.training.candidates[target.index] & (1 << (value - 1))));
  if (otherCandidate) {
    single.activate('trainingDigit', otherCandidate); single.activate('trainingCheck');
    assert.equal(single.training.completed, false);
  }
  const pair = new SudokuTraining(); pair.start('naked-pair', 'independent'); support(pair); operate(pair);
  const candidate = pair.training.step.cells[0];
  const digit = pair.training.step.digits[0];
  pair.activate('trainingCandidate', { index: candidate, digit });
  pair.activate('trainingCheck');
  assert.equal(pair.training.completed, false, 'a correct elimination plus an unsupported extra deletion must fail');
});

test('hints and demonstration cannot earn independent credit; demonstration also cannot earn solved credit', () => {
  for (const lesson of LESSONS) {
    const hinted = new SudokuTraining(); hinted.start(lesson.id, 'independent');
    for (let i = 1; i <= 4; i++) { hinted.activate('trainingHint'); assert.equal(hinted.training.hintLevel, Math.min(3, i)); }
    answer(hinted);
    assert.deepEqual(hinted.progress[lesson.id], { solved: 1, independent: 0 });
    const demo = new SudokuTraining(); demo.start(lesson.id, 'guided');
    demo.activate('trainingHint');
    assert.equal(demo.training.hintLevel, 3);
    assert.equal(demo.activate('trainingDemo'), true);
    assert.equal(demo.training.demonstrated, true);
    assert.equal(demo.training.completed, true);
    assert.deepEqual(demo.progress[lesson.id], { solved: 0, independent: 0 });
  }
});

test('draft save restores source data and player selections; valid completion restores without awarding credit twice', () => {
  const course = new SudokuTraining(); course.start('naked-triple', 'independent');
  support(course); operate(course, { all: false }); course.activate('trainingHint');
  const saved = JSON.parse(JSON.stringify(course.serialize()));
  assert.equal('board' in saved.exercise, false);
  assert.equal('candidates' in saved.exercise, false);
  assert.equal('step' in saved.exercise, false);
  const restored = new SudokuTraining(saved);
  assert.equal(restored.screen, 'exercise');
  assert.equal(restored.training.id, course.training.id);
  assert.deepEqual(restored.submission(), course.submission());
  assert.deepEqual(restored.training.board, course.training.board);
  assert.equal(restored.training.hintLevel, 1);
  restored.activate('trainingCheck');
  assert.equal(restored.training.completed, true);
  assert.deepEqual(restored.progress['naked-triple'], { solved: 1, independent: 0 });
  const completed = new SudokuTraining(JSON.parse(JSON.stringify(restored.serialize())));
  assert.equal(completed.training.completed, true);
  assert.deepEqual(completed.progress['naked-triple'], { solved: 1, independent: 0 });
  assert.equal(completed.activate('trainingCheck'), false);
  assert.deepEqual(completed.progress['naked-triple'], { solved: 1, independent: 0 });
});

test('saved placements are restored as pending selections and a forged completion is revalidated', () => {
  const course = new SudokuTraining(); course.start('naked-single', 'independent'); support(course); operate(course);
  const saved = course.serialize();
  const draft = new SudokuTraining(saved);
  assert.equal(draft.training.placementIndex, course.training.placementIndex);
  assert.equal(draft.training.value, course.training.value);
  assert.equal(draft.training.completed, false);
  const tampered = JSON.parse(JSON.stringify(saved));
  tampered.exercise.completed = true;
  tampered.exercise.selectedCells = [];
  const restored = new SudokuTraining(tampered);
  assert.equal(restored.training.completed, false);
  assert.equal(restored.progress['naked-single'], undefined);
});

test('damaged saves cannot replace the exercise with arbitrary board data or crash the model', () => {
  for (const saved of [null, false, 'broken', [], {}, { schemaVersion: 999, lessonId: 'naked-pair' }, { schemaVersion: 1, lessonId: 'unrecognized' }]) {
    const course = new SudokuTraining(saved);
    assert.equal(course.screen, 'catalog');
    assert.equal(course.training, null);
    assert.equal(course.lessons.length, 12);
  }
  const course = new SudokuTraining(); course.start('naked-pair', 'independent');
  const saved = course.serialize();
  saved.page = -999; saved.lessonPage = 1e300;
  saved.indices = { 'naked-pair': -1, 'hidden-pair': Infinity };
  saved.progress = { 'naked-pair': { solved: 1, independent: 90000 }, 'hidden-pair': { solved: -2, independent: 0 } };
  Object.assign(saved.exercise, {
    board: Array(81).fill(9), candidates: Array(81).fill(0), step: { technique: 'invalid' },
    selected: 999, selectedCells: [null, -1, 999, 2, 2], selectedEliminations: [{ index: -1, digit: 2 }, null, { index: 1, digit: 88 }],
    value: 999, placementIndex: -3, inputMode: 'hack', completed: true, hintLevel: 100, attempts: -1
  });
  const restored = new SudokuTraining(saved);
  assert.deepEqual(restored.training.board, course.training.board);
  assert.deepEqual(restored.training.candidates, course.training.candidates);
  assert.equal(restored.training.step.technique, 'naked-pair');
  assert.equal(restored.training.completed, false);
  assert.equal(restored.training.selected, -1);
  assert.deepEqual(restored.training.selectedCells, [2]);
  assert.deepEqual(restored.training.selectedEliminations, []);
  assert.equal(restored.training.value, null);
  assert.equal(restored.training.placementIndex, -1);
  assert.equal(restored.training.inputMode, 'support');
  assert.equal(restored.training.hintLevel, 3);
  assert.deepEqual(restored.progress['naked-pair'], { solved: 1, independent: 1 });
  assert.equal(restored.progress['hidden-pair'], undefined);
  assert.equal(restored.activate('trainingCell', 999), false);
  assert.equal(restored.activate('trainingCandidate', { index: 99, digit: 0 }), false);
  assert.equal(restored.activate('unknown-action'), false);
});
