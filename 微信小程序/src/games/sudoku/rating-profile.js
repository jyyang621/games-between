'use strict';

const { TECHNIQUES, RATING_VERSION, createLogicState, analyze, findSteps, applyStep } = require('./logic.js');
const PROFILE_VERSION = 'experience-v1';
const COVERAGE_VERSION = 'coverage-v1';
const SYMMETRY_SCOPE = 'digit-renaming+d4';
const COVERAGE_REQUIREMENTS = {
  'hidden-single': { unitTypes: ['row', 'column', 'box'] },
  pointing: { orientations: ['rows', 'columns'], supportCounts: [2, 3] },
  claiming: { orientations: ['rows', 'columns'], supportCounts: [2, 3] },
  'naked-pair': { unitTypes: ['row', 'column', 'box'] },
  'hidden-pair': { unitTypes: ['row', 'column', 'box'] },
  'naked-triple': { unitTypes: ['row', 'column', 'box'] },
  'hidden-triple': { unitTypes: ['row', 'column', 'box'] },
  'x-wing': { orientations: ['rows', 'columns'] },
  swordfish: { orientations: ['rows', 'columns'] },
};
const popcount = mask => { let count = 0; for (; mask; mask &= mask - 1) count += 1; return count; };
const unpack = board => typeof board === 'string' ? board.split('').map(Number) : board.slice();
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const rounded = value => Math.round(value * 1000) / 1000;
const range = values => ({ min: values.length ? Math.min(...values) : 0,
  max: values.length ? Math.max(...values) : 0, mean: rounded(mean(values)) });

/** Exactly digit renaming and the eight square rotations/reflections; not the
 * full Sudoku group (band/stack/internal row/column permutations are absent). */
function structuralSignature(board) {
  const values = unpack(board);
  if (values.length !== 81 || Array.from(values).some(n => !Number.isInteger(n) || n < 0 || n > 9)) throw new RangeError('Invalid Sudoku grid');
  const signatures = [];
  for (let reflect = 0; reflect < 2; reflect += 1) for (let rotate = 0; rotate < 4; rotate += 1) {
    const transformed = Array(81);
    for (let index = 0; index < 81; index += 1) {
      let row = Math.floor(index / 9), col = index % 9;
      if (reflect) col = 8 - col;
      for (let turn = 0; turn < rotate; turn += 1) [row, col] = [col, 8 - row];
      transformed[row * 9 + col] = values[index];
    }
    const rename = new Map();
    signatures.push(transformed.map(value => {
      if (!value) return 0;
      if (!rename.has(value)) rename.set(value, rename.size + 1);
      return rename.get(value);
    }).join(''));
  }
  return signatures.sort()[0];
}

function stepFacets(step) {
  const units = step.units || [];
  const primary = units[0];
  const unitType = primary ? primary.type : step.cells.length === 1 ? 'cell' : 'mixed';
  const line = units.find(unit => unit.type === 'row' || unit.type === 'column');
  const orientation = step.orientation || (line ? line.type === 'row' ? 'rows' : 'columns' : null);
  return {
    unitType, orientation, supportCount: step.cells.length,
    eliminationCount: (step.eliminations || []).length, placementCount: (step.placements || []).length,
    supportRows: new Set(step.cells.map(index => Math.floor(index / 9))).size,
    supportColumns: new Set(step.cells.map(index => index % 9)).size,
    supportBoxes: new Set(step.cells.map(index => Math.floor(index / 27) * 3 + Math.floor(index % 9 / 3))).size,
  };
}

/** Additional observations of the unchanged logic-v1 trace. No searching,
 * rerating or estimated human seconds is hidden in these statistics. */
function buildRatingProfile(board, analysis) {
  const result = analysis && analysis.trace ? analysis : analyze(unpack(board), { trace: true });
  const state = createLogicState(unpack(board));
  if (!state.valid || !result.valid) throw new Error('Cannot profile an invalid puzzle');
  const initialEmpty = state.board.filter(n => !n).length;
  const initialCandidates = state.candidates.reduce((sum, mask) => sum + popcount(mask), 0);
  const available = [], densities = [], techniqueCounts = {};
  let eliminatedCandidates = 0, eliminationSteps = 0, placements = 0;
  for (const step of result.trace) {
    // Count useful structures available at the current lowest technique tier.
    // This is a path observation, not a proof of a globally shortest route.
    available.push(findSteps(state, { maxTier: step.tier }).length);
    const empty = state.board.filter(n => !n).length;
    densities.push(empty ? state.candidates.reduce((sum, mask) => sum + popcount(mask), 0) / empty : 0);
    techniqueCounts[step.technique] = (techniqueCounts[step.technique] || 0) + 1;
    eliminatedCandidates += step.eliminations.length;
    if (step.eliminations.length) eliminationSteps += 1;
    placements += step.placements.length;
    if (!applyStep(state, step)) throw new Error('Cannot replay logical profile');
  }
  return { version: PROFILE_VERSION, ratingVersion: RATING_VERSION, pathDependent: true,
    calibratedAgainstHumanTime: false, searchEffortUsed: false, model: 'fixed-logic-v1-trace',
    solved: result.solved, maxTier: result.maxTier, steps: result.steps,
    criticalSteps: result.trace.filter(step => step.tier === result.maxTier).length,
    eliminationSteps, eliminatedCandidates, placements, techniqueCounts,
    initialCandidateCount: initialCandidates,
    initialCandidateDensity: rounded(initialEmpty ? initialCandidates / initialEmpty : 0),
    meanCandidateDensity: rounded(mean(densities)),
    availableSteps: { ...range(available), bottleneckStates: available.filter(count => count <= 1).length },
  };
}

function summarizeProfiles(puzzles) {
  const byDifficulty = {};
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const profiles = puzzles.filter(p => p.difficulty === difficulty).map(p => p.experienceProfile).filter(Boolean);
    byDifficulty[difficulty] = { count: profiles.length,
      candidateDensity: range(profiles.map(p => p.initialCandidateDensity)),
      criticalSteps: range(profiles.map(p => p.criticalSteps)),
      availableSteps: range(profiles.map(p => p.availableSteps.mean)),
      bottleneckStates: range(profiles.map(p => p.availableSteps.bottleneckStates)) };
  }
  return { version: PROFILE_VERSION, ratingVersion: RATING_VERSION, pathDependent: true,
    calibratedAgainstHumanTime: false, searchEffortUsed: false, byDifficulty };
}

function summarizeCoverage(data) {
  const training = Object.fromEntries(TECHNIQUES.map(t => [t.id,
    { count: 0, unitTypes: {}, orientations: {}, supportCounts: {}, supportBoxes: {} }]));
  const increment = (object, key) => { if (key !== null && key !== undefined) object[key] = (object[key] || 0) + 1; };
  for (const example of data.training) {
    const item = training[example.technique], facets = example.facets || stepFacets(example.step);
    item.count += 1;
    increment(item.unitTypes, facets.unitType); increment(item.orientations, facets.orientation);
    increment(item.supportCounts, facets.supportCount); increment(item.supportBoxes, facets.supportBoxes);
  }
  const counts = {}, techniqueCounts = Object.fromEntries(TECHNIQUES.map(t => [t.id, 0]));
  for (const puzzle of data.puzzles) {
    increment(counts, puzzle.difficulty);
    for (const id of Object.keys(puzzle.profile.techniqueCounts)) increment(techniqueCounts, id);
  }
  const signatures = new Set(data.puzzles.map(p => structuralSignature(p.puzzle)));
  return { version: COVERAGE_VERSION, symmetryScope: SYMMETRY_SCOPE, fullIsomorphism: false,
    symmetryExclusions: ['band-permutations', 'stack-permutations', 'rows-within-bands', 'columns-within-stacks'],
    puzzles: { counts, techniqueCounts, differentInitialGrids: data.puzzles.length,
      uniqueWithinScope: signatures.size, retainedLegacyEquivalentGrids: data.puzzles.length - signatures.size },
    requirements: COVERAGE_REQUIREMENTS, training };
}

module.exports = { PROFILE_VERSION, COVERAGE_VERSION, SYMMETRY_SCOPE, COVERAGE_REQUIREMENTS,
  structuralSignature, stepFacets, buildRatingProfile, summarizeProfiles, summarizeCoverage };
