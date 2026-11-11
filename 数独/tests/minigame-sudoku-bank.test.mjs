import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bank = require('../../微信小程序/src/games/sudoku/bank.js');
const data = require('../../微信小程序/src/games/sudoku/data/puzzle-bank.js');
const logic = require('../../微信小程序/src/games/sudoku/logic.js');
const engine = require('../../微信小程序/src/games/sudoku/core/engine.js');
const expand = string => string.split('').map(Number);

test('offline bank has four populated technique tiers and no lower-tier fallback', () => {
  const summary = bank.getBankSummary();
  assert.equal(summary.bankVersion, 'logic-v1');
  assert.equal(summary.ratingVersion, logic.RATING_VERSION);
  for (const [tier, difficulty] of ['easy', 'medium', 'hard', 'expert'].entries()) {
    assert.ok(summary.counts[difficulty] >= 64);
    for (const record of data.puzzles.filter(puzzle => puzzle.difficulty === difficulty)) {
      const puzzle = bank.getPuzzle(record.id);
      assert.equal(engine.countSolutions(puzzle.puzzle), 1, puzzle.id);
      assert.deepEqual(engine.solve(puzzle.puzzle), puzzle.solution);
      const result = logic.analyze(puzzle.puzzle, { maxTier: tier });
      assert.equal(result.solved, true, puzzle.id);
      assert.equal(result.maxTier, tier, puzzle.id);
      if (tier) assert.equal(logic.analyze(puzzle.puzzle, { maxTier: tier - 1 }).solved, false, puzzle.id);
    }
  }
});

test('selection and stable ids reproduce exact puzzles without leaking mutable arrays', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const first = bank.selectPuzzle('shared-day-2026-10-18', difficulty);
    assert.deepEqual(first, bank.selectPuzzle('shared-day-2026-10-18', difficulty));
    assert.deepEqual(first, bank.getPuzzle(first.id));
    assert.equal(first.difficulty, difficulty);
    assert.equal(first.ratingVersion, 'logic-v1');
    assert.ok(Array.isArray(first.puzzle) && first.puzzle.length === 81);
    const saved = first.puzzle.slice();
    first.puzzle.fill(0);
    first.solution.fill(0);
    first.profile.hardestTechniques.push('modified');
    assert.deepEqual(bank.getPuzzle(first.id).puzzle, saved);
    assert.ok(!bank.getPuzzle(first.id).profile.hardestTechniques.includes('modified'));
  }
  assert.equal(bank.getPuzzle('missing'), null);
  assert.throws(() => bank.selectPuzzle('seed', 'unsupported'), RangeError);
});

test('every training card is an independently generated, useful and replayable logical step', () => {
  for (const technique of logic.TECHNIQUES) {
    const examples = bank.getTrainingExamples(technique.id);
    assert.ok(examples.length >= 6, technique.id);
    const distinct = new Set();
    for (const example of examples) {
      assert.ok(!distinct.has(example.sourcePuzzleId), example.id);
      distinct.add(example.sourcePuzzleId);
      const source = bank.getTrainingSource(example.sourcePuzzleId);
      assert.ok(source, example.id);
      const replay = logic.createLogicState(source.puzzle);
      const analysis = logic.analyze(source.puzzle, { trace: true });
      for (const step of analysis.trace.slice(0, example.traceIndex)) assert.equal(logic.applyStep(replay, step), true);
      assert.deepEqual(replay.board, example.board, example.id);
      assert.deepEqual(replay.candidates, example.candidates, example.id);
      if (example.stepOrigin !== 'available-alternative') assert.deepEqual(analysis.trace[example.traceIndex], example.step, example.id);
      assert.equal(logic.validateStep(replay, example.step), true);
      for (const prior of logic.TECHNIQUES.slice(0, logic.TECHNIQUES.indexOf(technique))) {
        assert.equal(logic.findStep(replay, { techniqueId: prior.id }), null,
          `${example.id}: prerequisite ${prior.id} still available`);
      }
      const before = JSON.stringify(replay);
      assert.equal(logic.applyStep(replay, example.step), true);
      assert.notEqual(JSON.stringify(replay), before);
      for (let index = 0; index < 81; index += 1) {
        if (replay.board[index]) assert.equal(replay.board[index], source.solution[index]);
        else assert.ok(replay.candidates[index] & (1 << (source.solution[index] - 1)));
      }
    }
  }
  const first = bank.getTrainingExample('naked-single');
  first.board.fill(0);
  assert.notDeepEqual(bank.getTrainingExample('naked-single').board, first.board);
  assert.equal(bank.getTrainingExample('missing'), null);
  assert.equal(bank.getTrainingExample('naked-single', -1), null);
  assert.equal(bank.getTrainingExample('naked-single', 999), null);
});
