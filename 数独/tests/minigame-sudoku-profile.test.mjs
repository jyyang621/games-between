import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bank = require('../../微信小程序/src/games/sudoku/bank.js');
const data = require('../../微信小程序/src/games/sudoku/data/puzzle-bank.js');
const logic = require('../../微信小程序/src/games/sudoku/logic.js');
const { PROFILE_VERSION, structuralSignature, stepFacets, buildRatingProfile, COVERAGE_REQUIREMENTS } =
  require('../../微信小程序/src/games/sudoku/rating-profile.js');

test('coverage expansion preserves every original puzzle, training id and logic-v1 sequence', () => {
  const original = {
    puzzles: data.puzzles.slice(0, 256).map(({ id, puzzle, solution, difficulty, rating, ratingVersion, profile }) =>
      ({ id, puzzle, solution, difficulty, rating, ratingVersion, profile })),
    training: data.training.slice(0, 36).map(({ id, sourcePuzzleId, technique, traceIndex, board, candidates, step }) =>
      ({ id, sourcePuzzleId, technique, traceIndex, board, candidates, step })),
  };
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    '6a21d405b9fed9347fffe62cd697da91658268c14605d575d6b33e75a86324c2');
  assert.equal(bank.RATING_VERSION, 'logic-v1');
  assert.equal(bank.BANK_VERSION, 'logic-v1');
});

test('structural signature merges digit renaming and D4 without claiming full Sudoku isomorphism', () => {
  const board = data.puzzles[0].puzzle.split('').map(Number);
  const signature = structuralSignature(board);
  const renamed = board.map(value => value ? 10 - value : 0);
  const rotate = board.map((_, index) => board[(8 - index % 9) * 9 + Math.floor(index / 9)]);
  const reflect = board.map((_, index) => board[Math.floor(index / 9) * 9 + 8 - index % 9]);
  assert.equal(structuralSignature(renamed), signature);
  assert.equal(structuralSignature(rotate), signature);
  assert.equal(structuralSignature(reflect), signature);
  const changed = board.slice();
  changed[changed.findIndex(Boolean)] = 0;
  assert.notEqual(structuralSignature(changed), signature);
  const coverage = bank.getCoverageSummary();
  assert.equal(coverage.symmetryScope, 'digit-renaming+d4');
  assert.equal(coverage.fullIsomorphism, false);
  assert.ok(coverage.symmetryExclusions.includes('rows-within-bands'));
  assert.equal(coverage.puzzles.uniqueWithinScope, data.puzzles.length);
});

test('training coverage includes unit, direction and support-count variations from distinct source structures', () => {
  const coverage = bank.getCoverageSummary();
  for (const technique of logic.TECHNIQUES) {
    const examples = bank.getTrainingExamples(technique.id);
    assert.ok(examples.length >= 6, technique.id);
    const signatures = new Set();
    for (const example of examples) {
      assert.deepEqual(example.facets, stepFacets(example.step));
      const source = bank.getTrainingSource(example.sourcePuzzleId);
      const signature = structuralSignature(source.puzzle);
      assert.ok(!signatures.has(signature), `${technique.id}: equivalent source`);
      signatures.add(signature);
    }
    for (const [dimension, values] of Object.entries(COVERAGE_REQUIREMENTS[technique.id] || {})) {
      for (const value of values) assert.ok(coverage.training[technique.id][dimension][value] > 0,
        `${technique.id}: missing ${dimension}:${value}`);
    }
  }
});

test('full practice puzzles actually use the requested technique and Swordfish experts need an expert tier', () => {
  for (const technique of logic.TECHNIQUES) {
    const puzzles = bank.getPuzzlesByTechnique(technique.id);
    assert.ok(puzzles.length, technique.id);
    const selected = bank.selectPuzzleByTechnique('stable-practice', technique.id);
    assert.deepEqual(selected, bank.selectPuzzleByTechnique('stable-practice', technique.id));
    assert.ok(puzzles.some(p => p.id === selected.id));
    if (puzzles.length > 1) assert.notEqual(bank.selectPuzzleByTechnique('stable-practice', technique.id,
      { excludeId: selected.id }).id, selected.id);
    const analysis = logic.analyze(selected.puzzle, { trace: true });
    assert.equal(analysis.solved, true);
    assert.ok(analysis.trace.some(step => step.technique === technique.id));
  }
  const swordfish = bank.getPuzzlesByTechnique('swordfish', { difficulty: 'expert' });
  assert.ok(swordfish.length >= 3);
  for (const puzzle of swordfish) {
    assert.equal(logic.analyze(puzzle.puzzle, { maxTier: 2 }).solved, false);
    assert.equal(logic.analyze(puzzle.puzzle).solved, true);
  }
  assert.deepEqual(bank.getPuzzlesByTechnique('missing'), []);
  assert.equal(bank.selectPuzzleByTechnique('seed', 'missing'), null);
  assert.equal(bank.selectPuzzleByTechnique('seed', 'swordfish', { difficulty: 'easy' }), null);
  assert.deepEqual(bank.getPuzzlesByTechnique('naked-single', { difficulty: 'missing' }), []);
  assert.equal(bank.getPuzzlesByTechnique('naked-single', { limit: 2 }).length, 2);
  assert.deepEqual(bank.getPuzzlesByTechnique('naked-single', { limit: -1 }), []);
});

test('additional profiles are reproducible observations with explicit limits, not a replacement rating', () => {
  const sample = ['easy', 'medium', 'hard', 'expert'].map(id => bank.selectPuzzle('profile-test', id));
  for (const puzzle of sample) {
    const profile = puzzle.experienceProfile;
    assert.deepEqual(profile, buildRatingProfile(puzzle.puzzle));
    assert.equal(profile.version, PROFILE_VERSION);
    assert.equal(profile.ratingVersion, 'logic-v1');
    assert.equal(profile.calibratedAgainstHumanTime, false);
    assert.equal(profile.searchEffortUsed, false);
    assert.equal(profile.pathDependent, true);
    assert.ok(profile.initialCandidateDensity >= 1 && profile.initialCandidateDensity <= 9);
    assert.ok(profile.availableSteps.min >= 1);
    assert.ok(profile.criticalSteps >= 1);
    assert.equal(puzzle.profile.maxTier, profile.maxTier);
  }
  const summary = bank.getProfileSummary();
  assert.equal(summary.version, PROFILE_VERSION);
  assert.equal(summary.calibratedAgainstHumanTime, false);
  assert.equal(summary.byDifficulty.expert.count, bank.getBankSummary().counts.expert);
  summary.byDifficulty.easy.count = -1;
  assert.equal(bank.getProfileSummary().byDifficulty.easy.count, 64);
});
