import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SudokuTraining } = require('../../微信小程序/src/games/sudoku/training.js');
const { LearningRecords } = require('../../微信小程序/src/games/sudoku/learning-records.js');
const { getRecognitionExample } = require('../../微信小程序/src/games/sudoku/training-recognition.js');
const { LESSONS } = require('../../微信小程序/src/games/sudoku/lessons.js');
const { getTrainingExamples, getTrainingSource, getPuzzlesByTechnique } = require('../../微信小程序/src/games/sudoku/bank.js');
const { createLogicState, findSteps, validateStep } = require('../../微信小程序/src/games/sudoku/logic.js');
const clone = value => structuredClone(value);
const BASE_TIME = 1792252800000;
const DAY = 86400000;
const create = (saved = null, now = () => BASE_TIME) => new SudokuTraining(saved, { now });

function enterStep(course, step = course.training.step, { partial = false } = {}) {
  course.activate('trainingMode', 'support');
  for (const index of course.training.selectedCells.slice()) course.activate('trainingCell', index);
  for (const index of step.cells) course.activate('trainingCell', index);
  if (step.placements.length) {
    course.activate('trainingMode', 'place');
    course.activate('trainingCell', step.placements[0].index);
    course.activate('trainingDigit', step.placements[0].value);
  } else {
    course.activate('trainingMode', 'eliminate');
    for (const action of partial ? step.eliminations.slice(0, 1) : step.eliminations) course.activate('trainingCandidate', action);
  }
}
function answer(course, step) { enterStep(course, step); course.activate('trainingCheck'); assert.equal(course.training.completed, true); }

test('foundation pages, diagram pages, and candidate filters have bounded persistent navigation', () => {
  const course = create();
  assert.equal(course.activate('foundationBasics'), true);
  for (let i = 0; i < 8; i += 1) course.activate('foundationPage', 1);
  assert.equal(course.view.foundationPage, 3);
  const saved = course.serialize();
  assert.equal(saved.schemaVersion, 2);
  assert.equal(create(saved).screen, 'foundation');
  assert.equal(create(saved).foundationPage, 3);
  course.activate('foundationComplete'); assert.equal(course.screen, 'catalog');
  course.openLesson('x-wing');
  for (let i = 0; i < 5; i += 1) course.activate('lessonDiagram', 1);
  assert.equal(course.diagramPage, 2);
  course.start('x-wing'); course.activate('trainingFilter', 4);
  assert.equal(create(course.serialize()).training.filterDigit, 4);
  assert.equal(course.activate('trainingFilter', 10), false);
});

test('mixed practice hides its source technique and accepts another learned rule with proved evidence', () => {
  const course = create();
  for (const lesson of LESSONS) course.openLesson(lesson.id);
  assert.equal(course.activate('trainingMixed'), true);
  const t = course.training;
  assert.equal(t.sessionMode, 'mixed'); assert.equal(t.hideTechnique, true);
  assert.equal(course.view.lesson.label, '混合练习');
  const alternative = findSteps(createLogicState(t.board, t.candidates)).find(step => step.technique !== t.technique && t.allowedTechniques.includes(step.technique));
  assert.ok(alternative, 'fixture has another legal learned structure');
  answer(course, alternative);
  assert.equal(t.answerStep.technique, alternative.technique);
  assert.equal(t.showTechniqueName, true);
  assert.equal(course.lesson.id, alternative.technique);
  const restored = create(course.serialize());
  assert.equal(restored.training.completed, true);
  assert.equal(restored.training.answerStep.technique, alternative.technique);
  course.openLesson('swordfish');
  assert.equal(course.lesson.id, 'swordfish', 'completed exercise must not replace a newly opened lesson');
});

test('mixed practice does not accept an unlearned advanced rule simply because it matches the final answer', () => {
  const course = create(); course.openLesson('naked-pair'); course.activate('trainingMixed');
  assert.deepEqual(course.training.allowedTechniques, ['naked-pair']);
  const state = createLogicState(course.training.board, course.training.candidates);
  const other = findSteps(state).find(step => step.technique !== 'naked-pair');
  if (other) {
    enterStep(course, other); course.activate('trainingCheck');
    assert.equal(course.training.completed, false);
  }
});

test('recognition questions keep trusted real candidates and independently validate every positive and negative claim', () => {
  for (const lesson of LESSONS) for (const offset of [0, 1]) {
    const question = getRecognitionExample(lesson.id, offset);
    assert.ok(question, `${lesson.id} ${offset}`);
    const source = getTrainingExamples(lesson.id)[0];
    assert.deepEqual(question.board, source.board); assert.deepEqual(question.candidates, source.candidates);
    assert.equal(validateStep(createLogicState(question.board, question.candidates), question.claimStep), offset === 0);
    assert.deepEqual(question.claimStep.units, []);
    assert.equal(question.claimStep.pivot, undefined);
    assert.ok(question.explanation);
    const course = create();
    assert.equal(course.startRecognition(lesson.id, false, question.id), true);
    assert.equal(course.activate('trainingJudge', offset === 0), true);
    assert.equal(course.training.completed, true);
    assert.match(course.training.feedback, offset === 0 ? /成立/ : /不成立/);
    assert.equal(course.learningProgress[lesson.id].uniqueIndependent, 0, 'recognition is separate from independent application');
    assert.equal(course.learningProgress[lesson.id].recognitionCorrect, 1);
  }
});

test('recognition errors, hints, and demonstrations never turn into first-try independent recognition', () => {
  const course = create(); course.startRecognition('x-wing');
  course.activate('trainingJudge', false);
  assert.equal(course.training.completed, false);
  assert.equal(course.records.reviewItems()[0].reason, 'wrong');
  course.activate('trainingJudge', true);
  assert.equal(course.training.completed, true);
  assert.equal(course.learningProgress['x-wing'].recognitionCorrect, 0);
  assert.equal(course.learningProgress['x-wing'].wrong, 1);
  const demo = create(); demo.startRecognition('xy-wing'); demo.activate('trainingDemo');
  assert.equal(demo.training.completed, true);
  assert.equal(demo.learningProgress['xy-wing'].recognitionSolved, 0);
  const restored = create(course.serialize());
  assert.equal(restored.training.completed, true);
  assert.equal(restored.learningProgress['x-wing'].recognitionCorrect, 0);
});

test('recognition and application share position exposure without penalizing a resumed unanswered judgment', () => {
  const course = create(); course.startRecognition('naked-pair');
  const saved = course.serialize();
  const resumed = create(saved);
  resumed.activate('trainingJudge', true);
  assert.equal(resumed.learningProgress['naked-pair'].recognitionCorrect, 1);
  resumed.indices['naked-pair'] = 0; resumed.start('naked-pair'); answer(resumed);
  assert.equal(resumed.learningProgress['naked-pair'].uniqueIndependent, 0);
  const shown = create(); shown.openLesson('naked-pair'); shown.startRecognition('naked-pair'); shown.activate('trainingJudge', true);
  assert.equal(shown.learningProgress['naked-pair'].recognitionCorrect, 0, 'the diagram already showed this same proof');
});

test('distinct-position mastery stays fixed when replaying the same exercise, while old activity counts remain compatible', () => {
  const course = create();
  for (let i = 0; i < 4; i += 1) { course.start('naked-pair'); answer(course); }
  assert.deepEqual(course.progress['naked-pair'], { solved: 4, independent: 4 });
  let learning = course.learningProgress['naked-pair'];
  assert.equal(learning.uniqueSolved, 1); assert.equal(learning.uniqueIndependent, 1); assert.equal(learning.firstTry, 1);
  const first = clone(course.records.serialize().items[0].firstAnswer);
  course.start('naked-pair', 'independent', true); answer(course);
  learning = course.learningProgress['naked-pair'];
  assert.equal(learning.uniqueIndependent, 2);
  assert.deepEqual(course.records.serialize().items[0].firstAnswer, first);
  assert.equal(create(course.serialize()).learningProgress['naked-pair'].uniqueIndependent, 2);
});

test('a wrong first answer or a hint before restarting permanently blocks first-unassisted credit for that position', () => {
  const wrong = create(); wrong.start('naked-pair'); wrong.activate('trainingCheck'); answer(wrong);
  assert.equal(wrong.learningProgress['naked-pair'].uniqueIndependent, 0);
  assert.equal(wrong.learningProgress['naked-pair'].reviewedIndependent, 1);
  wrong.start('naked-pair'); answer(wrong);
  assert.equal(wrong.learningProgress['naked-pair'].uniqueIndependent, 0);
  const hinted = create(); hinted.start('naked-pair'); hinted.activate('trainingHint');
  hinted.start('naked-pair'); answer(hinted);
  assert.equal(hinted.learningProgress['naked-pair'].uniqueIndependent, 0);
  const restored = create(hinted.serialize());
  restored.start('naked-pair'); answer(restored);
  assert.equal(restored.learningProgress['naked-pair'].uniqueIndependent, 0);
});

test('viewing a lesson diagram exposes its source card and the UI independent button prefers an unseen example', () => {
  const course = create(); course.openLesson('naked-pair');
  const first = course.examples('naked-pair')[0];
  assert.equal(course.records.isExposed(first.id), true);
  course.activate('lessonDiagram', 1); course.activate('lessonDiagram', 1);
  assert.equal(course.records.serialize().items.find(item => item.exerciseId === first.id).maxHintLevel, 3);
  course.activate('practice', { id: 'naked-pair', mode: 'independent' });
  assert.notEqual(course.training.id, first.id);
  answer(course);
  assert.equal(course.learningProgress['naked-pair'].uniqueIndependent, 1);
  course.indices['naked-pair'] = 0; course.start('naked-pair');
  assert.equal(course.training.id, first.id, 'direct start preserves an explicit shared index');
  answer(course);
  assert.equal(course.learningProgress['naked-pair'].uniqueIndependent, 1, 'shown solution must not earn new independent mastery');
});

test('review selects errors immediately and correctly schedules successful positions with an injected clock', () => {
  let now = BASE_TIME;
  const course = create(null, () => now);
  assert.equal(course.activate('trainingReview'), true, 'empty review still handles the action so its notice is redrawn');
  assert.equal(course.screen, 'catalog');
  assert.match(course.view.notice, /暂时没有/);
  course.start('naked-pair'); course.activate('trainingCheck');
  const wrongId = course.training.id;
  course.start('naked-triple'); answer(course);
  assert.equal(course.activate('trainingReview'), true);
  assert.equal(course.training.id, wrongId); assert.equal(course.training.sessionMode, 'review');
  assert.equal(course.lesson.label, '错题复习');
  answer(course);
  assert.equal(course.records.reviewItems().length, 0);
  now += DAY + 1;
  assert.ok(course.records.reviewItems().length >= 2);
  assert.equal(course.activate('trainingReview'), true);
  assert.ok(course.view.reviewCount >= 1);
});

test('completed exercises continue by applying actual proved operations and restore through bounded replay', () => {
  for (const recognition of [false, true]) {
    const course = create();
    if (recognition) course.startRecognition('x-wing', false, getRecognitionExample('x-wing', 1).id);
    else course.start('naked-pair');
    if (recognition) course.activate('trainingJudge', false); else answer(course);
    const original = { board: course.training.board.slice(), candidates: course.training.candidates.slice() };
    assert.equal(course.activate('trainingContinue'), true);
    if (recognition) assert.match(course.training.feedback, /原提议未执行。换一组正确依据/);
    assert.ok(course.training.continuation.index > 0);
    assert.notDeepEqual([course.training.board, course.training.candidates], [original.board, original.candidates]);
    for (let i = 0; i < 2; i += 1) course.activate('trainingContinue');
    const source = getTrainingSource(course.training.sourcePuzzleId);
    for (let index = 0; index < 81; index += 1) {
      if (course.training.board[index]) assert.equal(course.training.board[index], source.solution[index]);
      else assert.ok(course.training.candidates[index] & (1 << (source.solution[index] - 1)));
    }
    const saved = course.serialize();
    assert.equal('board' in saved.exercise, false); assert.equal('candidates' in saved.exercise, false);
    const restored = create(saved);
    assert.deepEqual(restored.training.board, course.training.board);
    assert.deepEqual(restored.training.candidates, course.training.candidates);
    assert.equal(restored.training.continuation.index, course.training.continuation.index);
    assert.deepEqual(restored.learningProgress, course.learningProgress);
  }
});

test('old activity totals never become new mastery and forged learning answers are recomputed from trusted positions', () => {
  const legacy = { schemaVersion: 1, lessonId: 'naked-pair', screen: 'catalog', progress: { 'naked-pair': { solved: 9000, independent: 9000 } } };
  const restoredLegacy = create(legacy);
  assert.equal(restoredLegacy.progress['naked-pair'].independent, 9000);
  assert.equal(restoredLegacy.learningProgress['naked-pair'].uniqueIndependent, 0);
  const course = create(); course.start('naked-pair'); answer(course);
  const saved = course.serialize();
  const item = saved.learning.items[0];
  item.events[0].response.eliminations.push({ index: item.events[0].response.cells[0], digit: course.training.step.digits[0] });
  item.events[0].correct = true; item.firstAnswer.correct = true;
  saved.learning.summary = { 'naked-pair': { uniqueIndependent: 99999 } };
  const restored = create(saved);
  assert.equal(restored.learningProgress['naked-pair'].uniqueIndependent, 0);
  assert.equal(restored.learningProgress['naked-pair'].uniqueSolved, 0);
  const damaged = clone(saved); damaged.learning.items[0].events[0].response.eliminations.push({ index: 999, digit: 1 });
  assert.equal(create(damaged).learningProgress['naked-pair'].uniqueIndependent, 0);
});

test('full-puzzle completion counts unique trusted ids separately and preserves the first assisted result', () => {
  const records = new LearningRecords(null, { now: () => BASE_TIME });
  const puzzle = getPuzzlesByTechnique('naked-single', { limit: 1 })[0];
  assert.ok(puzzle);
  assert.equal(records.recordFullPuzzle({ id: puzzle.id, lessonId: 'naked-single', hints: 2, elapsed: 12345 }), true);
  assert.equal(records.recordFullPuzzle({ id: puzzle.id, lessonId: 'naked-single', hints: 0, elapsed: 1 }), false);
  assert.equal(records.summary()['naked-single'].fullPuzzle, 1);
  assert.equal(records.summary()['naked-single'].fullPuzzleUnhinted, 0);
  assert.equal(records.summary()['naked-single'].uniqueIndependent, 0);
  assert.equal(new LearningRecords(records.serialize()).summary()['naked-single'].fullPuzzle, 1);
  for (const wrong of [{ id: 'bad', lessonId: 'naked-single', hints: 0, elapsed: 0 }, { id: puzzle.id, lessonId: 'bad', hints: 0, elapsed: 0 }, { id: puzzle.id, lessonId: 'naked-single', hints: -1, elapsed: 0 }]) assert.equal(records.recordFullPuzzle(wrong), false);
});
