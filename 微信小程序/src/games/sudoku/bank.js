'use strict';

const data = require('./data/puzzle-bank');
const BANK_VERSION = data.bankVersion;
const RATING_VERSION = data.ratingVersion;
const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: 'easy', label: '简单', tier: 0, description: '唯一候选数与唯一位置' }),
  Object.freeze({ id: 'medium', label: '中等', tier: 1, description: '区块排除与显隐性数对' }),
  Object.freeze({ id: 'hard', label: '困难', tier: 2, description: '三数组与 X-Wing' }),
  Object.freeze({ id: 'expert', label: '专家', tier: 3, description: '翼技巧与剑鱼' }),
]);
const puzzlesById = new Map(data.puzzles.map(puzzle => [puzzle.id, puzzle]));
const sourcesById = new Map([...data.puzzles, ...data.trainingSources].map(puzzle => [puzzle.id, puzzle]));
const pools = Object.fromEntries(DIFFICULTIES.map(difficulty =>
  [difficulty.id, data.puzzles.filter(puzzle => puzzle.difficulty === difficulty.id)]));
const clone = value => JSON.parse(JSON.stringify(value));
const expand = value => typeof value === 'string' ? value.split('').map(Number) : value.slice();

function materialize(record) {
  if (!record) return null;
  const result = clone(record);
  result.puzzle = expand(record.puzzle);
  result.solution = expand(record.solution);
  result.bankVersion = BANK_VERSION;
  result.ratingVersion = RATING_VERSION;
  return result;
}

function seedHash(seed) {
  let hash = 2166136261;
  const text = String(seed);
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** Deterministic selection from a verified tier; never silently downgrades. */
function selectPuzzle(seed, difficulty = 'easy') {
  if (!Object.prototype.hasOwnProperty.call(pools, difficulty)) throw new RangeError(`Unknown difficulty: ${difficulty}`);
  const pool = pools[difficulty];
  if (!pool.length) throw new Error(`No qualified Sudoku puzzles available for ${difficulty}`);
  return materialize(pool[seedHash(`${BANK_VERSION}:${difficulty}:${String(seed)}`) % pool.length]);
}

function getPuzzle(id) { return materialize(puzzlesById.get(id)); }
function getTrainingSource(id) { return materialize(sourcesById.get(id)); }

function getTrainingExamples(techniqueId) {
  return data.training.filter(example => example.technique === techniqueId).map(example => {
    const result = clone(example);
    result.board = expand(example.board);
    result.ratingVersion = RATING_VERSION;
    result.bankVersion = BANK_VERSION;
    return result;
  });
}

function getTrainingExample(techniqueId, index = 0) {
  if (!Number.isInteger(index) || index < 0) return null;
  return getTrainingExamples(techniqueId)[index] || null;
}

function getBankSummary() {
  return clone({ ...data.summary, bankVersion: BANK_VERSION, ratingVersion: RATING_VERSION });
}

function getProfileSummary() { return clone(data.profileSummary); }
function getCoverageSummary() { return clone(data.coverageSummary); }

/** Full puzzles whose unchanged, verified solving trace uses this technique. */
function getPuzzlesByTechnique(techniqueId, { difficulty, limit, allowedTechniques } = {}) {
  if (typeof techniqueId !== 'string' || difficulty !== undefined && !Object.prototype.hasOwnProperty.call(pools, difficulty)) return [];
  if (allowedTechniques !== undefined && (!Array.isArray(allowedTechniques) || !allowedTechniques.every(id =>
    typeof id === 'string' && Object.prototype.hasOwnProperty.call(data.summary.trainingCounts, id)))) return [];
  let matching = data.puzzles.filter(p => (!difficulty || p.difficulty === difficulty)
    && Object.prototype.hasOwnProperty.call(p.profile.techniqueCounts, techniqueId)
    && (!allowedTechniques || Object.keys(p.profile.techniqueCounts).every(id => allowedTechniques.includes(id))));
  if (limit !== undefined) matching = Number.isInteger(limit) && limit >= 0 ? matching.slice(0, limit) : [];
  return matching.map(materialize);
}

function selectPuzzleByTechnique(seed, techniqueId, options = {}) {
  let matching = getPuzzlesByTechnique(techniqueId, options);
  if (matching.length > 1 && options.excludeId) matching = matching.filter(puzzle => puzzle.id !== options.excludeId);
  return matching.length ? matching[seedHash(`practice:${BANK_VERSION}:${techniqueId}:${String(seed)}`) % matching.length] : null;
}

module.exports = { BANK_VERSION, RATING_VERSION, DIFFICULTIES, selectPuzzle, getPuzzle,
  getTrainingExamples, getTrainingExample, getTrainingSource, getBankSummary,
  getPuzzlesByTechnique, selectPuzzleByTechnique, getProfileSummary, getCoverageSummary };
