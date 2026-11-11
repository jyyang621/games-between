import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LESSONS } = require('../../微信小程序/src/games/sudoku/lessons.js');
const { getTeachingVisual, getStepRegions, getStepRoles } = require('../../微信小程序/src/games/sudoku/teaching-visuals.js');
const { FOUNDATION_LESSONS, getFoundationPage } = require('../../微信小程序/src/games/sudoku/foundation-lessons.js');
const { createLogicState, applyStep, validateStep } = require('../../微信小程序/src/games/sudoku/logic.js');

test('all twelve three-frame diagrams originate in a valid puzzle and their result is a validated logical step', () => {
  for (const lesson of LESSONS) {
    const condition = getTeachingVisual(lesson.id, 0), reasoning = getTeachingVisual(lesson.id, 1), result = getTeachingVisual(lesson.id, 2);
    assert.ok(condition && reasoning && result, lesson.id);
    assert.equal(condition.sourceId, reasoning.sourceId);
    assert.equal(result.sourceId, reasoning.sourceId);
    const expected = createLogicState(condition.board, condition.candidates);
    assert.equal(expected.valid, true, lesson.id);
    assert.equal(validateStep(expected, condition.step), true, lesson.id);
    assert.equal(applyStep(expected, condition.step), true, lesson.id);
    assert.deepEqual(reasoning.board, condition.board);
    assert.deepEqual(reasoning.candidates, condition.candidates);
    assert.deepEqual(result.board, expected.board);
    assert.deepEqual(result.candidates, expected.candidates);
    assert.deepEqual(condition.eliminations, []);
    assert.deepEqual(condition.placements, []);
    assert.deepEqual(result.eliminations, result.step.eliminations);
    assert.deepEqual(result.placements, result.step.placements);
    const snapshot = getTeachingVisual(lesson.id, 0);
    condition.board.fill(0); condition.cells.length = 0; condition.step.cells.length = 0;
    assert.deepEqual(getTeachingVisual(lesson.id, 0), snapshot, 'callers cannot mutate the cached original data');
  }
  assert.equal(getTeachingVisual('unavailable'), null);
});

test('wing diagrams identify the pivot and two wings, while fish identify both line directions', () => {
  for (const id of ['xy-wing', 'xyz-wing']) {
    const visual = getTeachingVisual(id, 0), roles = visual.roles;
    assert.ok(Number.isInteger(roles.pivot));
    assert.equal(roles.wings.length, 2);
    assert.deepEqual([roles.pivot, ...roles.wings].sort((a, b) => a - b), visual.cells);
    const withoutMetadata = { ...visual.step }; delete withoutMetadata.pivot; delete withoutMetadata.wings;
    const inferred = getStepRoles(withoutMetadata, visual.candidates);
    assert.ok(Number.isInteger(inferred.pivot));
    assert.deepEqual([inferred.pivot, ...inferred.wings].sort((a, b) => a - b), visual.cells);
  }
  for (const [id, size] of [['x-wing', 2], ['swordfish', 3]]) {
    const roles = getTeachingVisual(id, 0).roles;
    assert.equal(roles.baseUnits.length, size);
    assert.equal(roles.crossUnits.length, size);
    assert.notEqual(roles.baseUnits[0].type, roles.crossUnits[0].type);
  }
});

test('first-level hint regions exist for naked singles and both wing techniques even with empty units', () => {
  for (const id of ['naked-single', 'xy-wing', 'xyz-wing']) {
    const step = getTeachingVisual(id, 0).step;
    assert.deepEqual(step.units, []);
    const regions = getStepRegions(step);
    assert.ok(regions.length > 0, id);
    assert.ok(regions.every(unit => ['row', 'column', 'box'].includes(unit.type) && unit.index >= 0 && unit.index < 9));
  }
});

test('foundation examples use legal boards, sound displayed candidates and correct placements', () => {
  assert.equal(FOUNDATION_LESSONS.length, 4);
  const ids = new Set();
  for (let i = 0; i < FOUNDATION_LESSONS.length; i++) {
    const lesson = getFoundationPage(i), diagram = lesson.diagram, natural = createLogicState(diagram.board);
    ids.add(lesson.id);
    assert.equal(natural.valid, true);
    assert.ok(lesson.paragraphs.length >= 3 && lesson.summary.length > 10);
    assert.equal(diagram.candidates.length, 81);
    diagram.candidates.forEach((mask, index) => assert.equal(mask & ~natural.candidates[index], 0));
    for (const placement of diagram.placements || []) {
      assert.ok(natural.candidates[placement.index] & 1 << (placement.value - 1));
      const filled = diagram.board.slice(); filled[placement.index] = placement.value;
      assert.equal(createLogicState(filled).valid, true);
    }
    const original = getFoundationPage(i); lesson.diagram.board.fill(0);
    assert.deepEqual(getFoundationPage(i), original);
  }
  assert.equal(ids.size, 4);
  assert.equal(getFoundationPage(2).diagram.candidates[2], (1 << 0) | (1 << 1) | (1 << 3));
  assert.equal(getFoundationPage(-5).id, FOUNDATION_LESSONS[0].id);
  assert.equal(getFoundationPage(999).id, FOUNDATION_LESSONS.at(-1).id);
});
