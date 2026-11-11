import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const engine = require(resolve(root, '../微信小程序/src/games/sudoku/core/engine.js'));
const logic = require(resolve(root, '../微信小程序/src/games/sudoku/logic.js'));
const profiling = require(resolve(root, '../微信小程序/src/games/sudoku/rating-profile.js'));
const { structuralSignature, stepFacets, buildRatingProfile, summarizeProfiles, summarizeCoverage,
  COVERAGE_REQUIREMENTS, PROFILE_VERSION } = profiling;
const output = resolve(root, '../微信小程序/src/games/sudoku/data/puzzle-bank.js');
const BANK_VERSION = 'logic-v1';
const difficulties = ['easy', 'medium', 'hard', 'expert'];
const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const found = args.find(item => item.startsWith(`--${name}=`));
  return found ? Number(found.slice(name.length + 3)) : fallback;
};
const target = argument('count', 64);
const trainingTarget = argument('training-count', 6);
const swordfishTarget = argument('swordfish-count', 3);
const maximum = argument('max-attempts', 20000);
const sourcePrefix = 'games-between:logic-v1:';
const compact = board => board.join('');
const expand = board => typeof board === 'string' ? board.split('').map(Number) : board.slice();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copy = value => JSON.parse(JSON.stringify(value));

function load() {
  if (!existsSync(output)) return null;
  delete require.cache[require.resolve(output)];
  return require(output);
}

function verify(data, { minimum = 1, trainingMinimum = 0, requireCoverage = false, log = true } = {}) {
  assert.equal(data.bankVersion, BANK_VERSION);
  assert.equal(data.ratingVersion, logic.RATING_VERSION);
  const counts = Object.fromEntries(difficulties.map(id => [id, 0]));
  const sources = new Map([...data.puzzles, ...data.trainingSources].map(p => [p.id, p]));
  const seen = new Set();
  for (const puzzle of data.puzzles) {
    assert.ok(!seen.has(puzzle.id), `Duplicate puzzle id ${puzzle.id}`);
    seen.add(puzzle.id);
    const board = expand(puzzle.puzzle);
    assert.equal(engine.countSolutions(board), 1, `${puzzle.id}: uniqueness`);
    assert.deepEqual(engine.solve(board), expand(puzzle.solution), `${puzzle.id}: solution`);
    const tier = difficulties.indexOf(puzzle.difficulty);
    const result = logic.analyze(board, { maxTier: tier });
    assert.ok(result.solved, `${puzzle.id}: cannot solve at assigned tier`);
    assert.equal(result.maxTier, tier, `${puzzle.id}: incorrect highest technique tier`);
    assert.equal(puzzle.profile.maxTier, result.maxTier, `${puzzle.id}: stale profile tier`);
    assert.equal(puzzle.profile.score, result.score, `${puzzle.id}: stale profile score`);
    assert.equal(puzzle.profile.steps, result.steps, `${puzzle.id}: stale profile steps`);
    assert.deepEqual(puzzle.experienceProfile, buildRatingProfile(board), `${puzzle.id}: stale additional profile`);
    if (tier > 0) assert.equal(logic.analyze(board, { maxTier: tier - 1 }).solved, false,
      `${puzzle.id}: lower tier already solves it`);
    counts[puzzle.difficulty] += 1;
  }
  for (const id of difficulties) assert.ok(counts[id] >= minimum, `${id}: fewer than ${minimum} puzzles`);
  const trainingCounts = Object.fromEntries(logic.TECHNIQUES.map(t => [t.id, 0]));
  const distinctSources = new Map();
  for (const example of data.training) {
    const source = sources.get(example.sourcePuzzleId);
    assert.ok(source, `${example.id}: missing source`);
    const sourceBoard = expand(source.puzzle);
    assert.equal(engine.countSolutions(sourceBoard), 1, `${example.id}: source uniqueness`);
    const replay = logic.createLogicState(sourceBoard);
    const analysis = logic.analyze(sourceBoard, { trace: true });
    assert.ok(example.traceIndex < analysis.trace.length, `${example.id}: missing trace step`);
    for (let index = 0; index < example.traceIndex; index += 1) {
      assert.ok(logic.applyStep(replay, analysis.trace[index]), `${example.id}: trace replay ${index}`);
    }
    assert.deepEqual(replay.board, expand(example.board), `${example.id}: board replay`);
    assert.deepEqual(replay.candidates, example.candidates, `${example.id}: candidate replay`);
    if (example.stepOrigin !== 'available-alternative') assert.ok(equal(analysis.trace[example.traceIndex], example.step), `${example.id}: changed target step`);
    assert.ok(logic.validateStep(replay, example.step), `${example.id}: invalid target step`);
    assert.deepEqual(example.facets, stepFacets(example.step), `${example.id}: stale coverage facets`);
    const technique = logic.TECHNIQUES.find(t => t.id === example.technique);
    assert.ok(technique, `${example.id}: unknown technique`);
    for (const prerequisite of logic.TECHNIQUES.slice(0, logic.TECHNIQUES.indexOf(technique))) {
      assert.equal(logic.findStep(replay, { techniqueId: prerequisite.id }), null,
        `${example.id}: easier technique ${prerequisite.id} is available`);
    }
    const before = copy(replay);
    assert.ok(logic.applyStep(replay, example.step));
    assert.ok(!equal(before, replay), `${example.id}: no useful change`);
    const solution = expand(source.solution);
    replay.board.forEach((value, index) => {
      if (value) assert.equal(value, solution[index], `${example.id}: wrong placement`);
      else assert.ok(replay.candidates[index] & (1 << (solution[index] - 1)), `${example.id}: removed solution`);
    });
    if (!distinctSources.has(example.technique)) distinctSources.set(example.technique, new Set());
    const signature = structuralSignature(source.puzzle);
    assert.ok(!distinctSources.get(example.technique).has(signature), `${example.id}: equivalent source under ${profiling.SYMMETRY_SCOPE}`);
    distinctSources.get(example.technique).add(signature);
    trainingCounts[example.technique] += 1;
  }
  for (const technique of logic.TECHNIQUES) {
    assert.ok(trainingCounts[technique.id] >= trainingMinimum,
      `${technique.id}: fewer than ${trainingMinimum} training examples`);
  }
  assert.deepEqual(data.summary.counts, counts, 'Stale puzzle count summary');
  assert.deepEqual(data.summary.trainingCounts, trainingCounts, 'Stale training count summary');
  assert.deepEqual(data.profileSummary, summarizeProfiles(data.puzzles), 'Stale profile summary');
  assert.deepEqual(data.coverageSummary, summarizeCoverage(data), 'Stale coverage summary');
  assert.equal(data.coverageSummary.fullIsomorphism, false);
  if (requireCoverage) {
    for (const [id, dimensions] of Object.entries(COVERAGE_REQUIREMENTS)) for (const [dimension, values] of Object.entries(dimensions)) {
      for (const value of values) assert.ok(data.coverageSummary.training[id][dimension][value] > 0,
        `${id}: missing ${dimension}:${value}`);
    }
    assert.ok(data.puzzles.filter(p => p.difficulty === 'expert' && p.profile.techniqueCounts.swordfish).length
      >= (data.generator.swordfishTarget || 3), 'Not enough completely solvable expert Swordfish puzzles');
  }
  if (log) console.log(JSON.stringify({ bankVersion: data.bankVersion, counts, trainingCounts, searched: data.generator.nextAttempt }));
  return { counts, trainingCounts };
}

/** Read-only full-bank audit, shared by the native build check and CLI. */
export function checkBank({ log = false } = {}) {
  const existing = load();
  assert.ok(existing, 'Generate the bank before checking it.');
  return verify(existing, { minimum: Math.max(24, existing.generator.target || 0),
    trainingMinimum: existing.generator.trainingTarget || 6, requireCoverage: true, log });
}

function main() {
if (args.includes('--check')) { checkBank({ log: true }); return; }
for (const number of [target, trainingTarget, swordfishTarget, maximum]) assert.ok(Number.isInteger(number) && number > 0);
const existing = load();
if (args.includes('--fresh') && existing) throw new Error('Published logic-v1 ids must be retained. Append to the existing bank; use a new version for an incompatible rebuild.');
const data = existing && existing.bankVersion === BANK_VERSION && existing.ratingVersion === logic.RATING_VERSION
  ? copy(existing)
  : { schemaVersion: 1, bankVersion: BANK_VERSION, ratingVersion: logic.RATING_VERSION,
    generator: { sourcePrefix, nextAttempt: 0, target }, puzzles: [], trainingSources: [], training: [] };
const counts = Object.fromEntries(difficulties.map(id => [id, data.puzzles.filter(p => p.difficulty === id).length]));
const trainCounts = Object.fromEntries(logic.TECHNIQUES.map(t => [t.id, data.training.filter(p => p.technique === t.id).length]));
const knownPuzzles = new Set([...data.puzzles, ...data.trainingSources].map(p => p.puzzle));
const knownStructures = new Set([...data.puzzles, ...data.trainingSources].map(p => structuralSignature(p.puzzle)));
const sourcesById = new Map([...data.puzzles, ...data.trainingSources].map(p => [p.id, p]));
const trainingStructures = Object.fromEntries(logic.TECHNIQUES.map(t => [t.id,
  new Set(data.training.filter(p => p.technique === t.id).map(p => structuralSignature(sourcesById.get(p.sourcePuzzleId).puzzle)))]));
for (const puzzle of data.puzzles) if (!puzzle.experienceProfile || puzzle.experienceProfile.version !== PROFILE_VERSION) {
  puzzle.experienceProfile = buildRatingProfile(expand(puzzle.puzzle));
}
for (const example of data.training) example.facets = stepFacets(example.step);
let coverage = summarizeCoverage(data);
const swordfishCount = () => data.puzzles.filter(p => p.difficulty === 'expert' && p.profile.techniqueCounts.swordfish).length;
function missingFacets(id) {
  const result = [];
  for (const [dimension, values] of Object.entries(COVERAGE_REQUIREMENTS[id] || {})) for (const value of values) {
    if (!coverage.training[id][dimension][value]) result.push([dimension, value]);
  }
  return result;
}
function exampleGain(id, step) {
  const facets = stepFacets(step);
  const facetKey = { unitTypes: 'unitType', orientations: 'orientation', supportCounts: 'supportCount' };
  return (trainCounts[id] < trainingTarget ? 1 : 0)
    + missingFacets(id).filter(([dimension, value]) => facets[facetKey[dimension]] === value).length * 10;
}
const completed = () => difficulties.every(id => counts[id] >= target)
  && logic.TECHNIQUES.every(t => trainCounts[t.id] >= trainingTarget && missingFacets(t.id).length === 0)
  && swordfishCount() >= swordfishTarget;

function write() {
  data.generator.target = target;
  data.generator.trainingTarget = trainingTarget;
  data.generator.swordfishTarget = swordfishTarget;
  data.summary = { counts, trainingCounts: trainCounts, total: data.puzzles.length, trainingTotal: data.training.length };
  data.profileSummary = summarizeProfiles(data.puzzles);
  coverage = summarizeCoverage(data);
  data.coverageSummary = coverage;
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.tmp`;
  writeFileSync(temporary, `// Generated by scripts/build-sudoku-bank.mjs. Append without replacing published ids; verify with --check.\n'use strict';\nmodule.exports = ${JSON.stringify(data, null, 2)};\n`);
  // Windows editors may hold the destination briefly. Readers always observe a
  // complete old or new snapshot, and a bounded retry cannot stall the builder.
  for (let retry = 0; ; retry += 1) {
    try { renameSync(temporary, output); break; }
    catch (error) {
      if (retry >= 20) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}

// Remove additional clues only after uniqueness has been established. This is
// candidate material, not a difficulty shortcut: the logical rater is mandatory.
function removeMore(board, solution, seed) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const order = Array.from({ length: 81 }, (_, index) => index);
  for (let index = 80; index > 0; index -= 1) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const selected = hash % (index + 1);
    [order[index], order[selected]] = [order[selected], order[index]];
  }
  for (const index of order) {
    if (!board[index]) continue;
    board[index] = 0;
    if (engine.countSolutions(board) !== 1) board[index] = solution[index];
  }
}

const startAttempt = data.generator.nextAttempt;
for (let attempt = startAttempt; attempt < startAttempt + maximum && !completed(); attempt += 1) {
  const sourceSeed = sourcePrefix + attempt;
  // Once the simple banks are full, spend the bounded search budget on sparse
  // unique material. Sparse material still regularly fails the logical criteria.
  const sourceDifficulty = counts.easy < target && attempt % 4 === 0 ? 'easy'
    : counts.medium < target && attempt % 4 === 1 ? 'hard' : 'expert';
  const generated = engine.generatePuzzle(sourceSeed, sourceDifficulty);
  if (attempt % 2 === 1 && counts.easy >= target) removeMore(generated.puzzle, generated.solution, sourceSeed);
  data.generator.nextAttempt = attempt + 1;
  const packed = compact(generated.puzzle);
  const signature = structuralSignature(packed);
  if (knownPuzzles.has(packed) || knownStructures.has(signature)) continue;
  const analysis = logic.analyze(generated.puzzle, { trace: true });
  if (!analysis.valid) throw new Error(`${sourceSeed}: logical contradiction in unique generated puzzle`);
  const tier = analysis.maxTier;
  const difficulty = difficulties[tier];
  const usefulSwordfish = difficulty === 'expert' && swordfishCount() < swordfishTarget
    && analysis.trace.some(step => step.technique === 'swordfish');
  const playable = analysis.solved && difficulty && (counts[difficulty] < target || usefulSwordfish)
    && (tier === 0 || !logic.analyze(generated.puzzle, { maxTier: tier - 1 }).solved);
  const record = { id: `lv1-${attempt.toString(36)}`, puzzle: packed, solution: compact(generated.solution),
    sourceSeed, sourceDifficulty };
  if (playable) {
    const techniqueCounts = {};
    for (const step of analysis.trace) techniqueCounts[step.technique] = (techniqueCounts[step.technique] || 0) + 1;
    Object.assign(record, { difficulty, rating: difficulty, ratingVersion: logic.RATING_VERSION,
      profile: { maxTier: tier, score: analysis.score, steps: analysis.steps, clues: generated.puzzle.filter(Boolean).length,
        techniqueCounts, hardestTechniques: Object.keys(techniqueCounts)
          .filter(id => logic.TECHNIQUES.find(t => t.id === id).tier === tier) },
      experienceProfile: buildRatingProfile(generated.puzzle, analysis) });
    data.puzzles.push(record);
    counts[difficulty] += 1;
  }
  const state = logic.createLogicState(generated.puzzle);
  const usedTechniques = new Set();
  const newExamples = [];
  for (let traceIndex = 0; traceIndex < analysis.trace.length; traceIndex += 1) {
    const step = analysis.trace[traceIndex];
    const id = step.technique;
    if (!usedTechniques.has(id) && !trainingStructures[id].has(signature)
      && (trainCounts[id] < trainingTarget || missingFacets(id).length)) {
      const alternatives = logic.findSteps(state, { techniqueId: id });
      const chosen = alternatives.sort((a, b) => exampleGain(id, b) - exampleGain(id, a))[0] || step;
      if (exampleGain(id, chosen) > 0) {
      // analyze() always scans in pedagogical order, so this state contains no
      // available prerequisite technique. Keep the actual elimination state.
      newExamples.push({ id: `train-${step.technique}-${attempt.toString(36)}`, sourcePuzzleId: record.id,
        technique: id, traceIndex, board: compact(state.board), candidates: state.candidates.slice(), step: copy(chosen),
        ...(equal(step, chosen) ? {} : { stepOrigin: 'available-alternative' }), facets: stepFacets(chosen) });
      trainCounts[id] += 1;
      usedTechniques.add(id);
      trainingStructures[id].add(signature);
      // Include this source's newly selected card when deciding later deficits.
      coverage = summarizeCoverage({ ...data, training: [...data.training, ...newExamples] });
      }
    }
    if (!logic.applyStep(state, step)) throw new Error(`${sourceSeed}: unreplayable trace at ${traceIndex}`);
  }
  if (playable || newExamples.length) {
    knownPuzzles.add(packed);
    knownStructures.add(signature);
    if (!playable) data.trainingSources.push(record);
    data.training.push(...newExamples);
  }
  if ((attempt + 1) % 100 === 0) {
    write();
    console.log(JSON.stringify({ searched: attempt + 1, counts, trainingCounts: trainCounts,
      swordfishPuzzles: swordfishCount(), missingFacets: Object.fromEntries(logic.TECHNIQUES.map(t => [t.id, missingFacets(t.id)]).filter(([, missing]) => missing.length)) }));
  }
}
write();
verify(data, { minimum: Math.min(24, target), trainingMinimum: completed() ? trainingTarget : 0, requireCoverage: completed() });
if (!completed()) {
  console.warn('Bounded search completed before all requested quotas. Re-run to resume from nextAttempt; no unqualified puzzles were added.');
  process.exitCode = 2;
}
}

// Importing checkBank never starts generation or exits the caller's process.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
