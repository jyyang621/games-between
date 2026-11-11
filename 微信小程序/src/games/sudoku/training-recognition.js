'use strict';

const { TECHNIQUES, createLogicState, validateStep } = require('./logic.js');
const { getTrainingExamples } = require('./bank.js');
const clone = value => JSON.parse(JSON.stringify(value));
const coordinate = index => `第 ${Math.floor(index / 9) + 1} 行第 ${index % 9 + 1} 列`;
const candidateCount = mask => { let count = 0; for (; mask; mask &= mask - 1) count += 1; return count; };
const examplesCache = new Map();
const recognitionCache = new Map();
function examplesFor(id) {
  if (!examplesCache.has(id)) examplesCache.set(id, getTrainingExamples(id));
  return examplesCache.get(id);
}

function invalidExplanation(technique, step, state) {
  const label = (TECHNIQUES.find(item => item.id === technique) || {}).label || '这项技巧';
  if (technique === 'naked-single') {
    const index = step.cells[0];
    return `${coordinate(index)}仍有 ${candidateCount(state.candidates[index])} 个候选，不能把它当成唯一候选数。`;
  }
  if (technique === 'hidden-single') return '标出的依据与填数位置不符合唯一位置条件；必须检查某数字在完整的一行、一列或一个宫内是否只剩这一处。';
  if (technique === 'pointing') return '提议的标记没有覆盖宫内该数字的完整候选结构。必须先确认宫内所有位置都在同一行或列，才能向宫外排除。';
  if (technique === 'claiming') return '提议的标记没有完整覆盖基准行或列中的该数字。必须确认整条线的所有候选都在同一宫，才能向宫内排除。';
  if (technique === 'naked-pair' || technique === 'naked-triple') {
    const union = step.cells.reduce((value, index) => value | state.candidates[index], 0);
    const size = technique === 'naked-pair' ? 2 : 3;
    return `提议标出的 ${size} 格，其候选并集有 ${candidateCount(union)} 个数；还必须同属一个行、列或宫。这里不符合${label}的完整结构，不能用这组依据推出操作。`;
  }
  if (technique === 'hidden-pair' || technique === 'hidden-triple') return `标记的格子没有覆盖这些数字在同一区域内的全部位置；“几格都含有这些数”不足以构成${label}。`;
  if (technique === 'x-wing' || technique === 'swordfish') return `标出的依据未构成完整的${label}。必须把同一数字在全部基准线上的候选都限制在指定交叉线内，不能漏掉一个基准候选。`;
  return `替换后的三格不符合${label}所需的候选组合及可见关系。这次判断只问“这组依据能否推出该操作”，并不声称该候选一定是答案。`;
}

/** Change the proposed proof, never the trusted board or candidate masks. */
function negativeProposal(example) {
  const state = createLogicState(example.board, example.candidates);
  const original = example.step;
  const replacements = state.board.map((value, index) => !value && !original.cells.includes(index) ? index : -1).filter(index => index >= 0);
  // Prefer a wrong supporting cell whose candidate cardinality exposes the
  // violated rule. Verification below is authoritative, including for wings.
  replacements.sort((a, b) => candidateCount(state.candidates[b]) - candidateCount(state.candidates[a]) || a - b);
  for (let at = original.cells.length - 1; at >= 0; at -= 1) for (const replacement of replacements) {
    const proposed = clone(original);
    proposed.cells[at] = replacement;
    proposed.cells.sort((a, b) => a - b);
    if (original.placements.length) {
      const index = proposed.cells[0];
      const value = Array.from({ length: 9 }, (_, i) => i + 1).find(digit => state.candidates[index] & (1 << (digit - 1)));
      if (!value) continue;
      proposed.placements = [{ index, value }];
    }
    if (!validateStep(state, proposed)) return proposed;
  }
  return null;
}

function makeRecognition(example, positive = true) {
  if (!example) return null;
  const state = createLogicState(example.board, example.candidates);
  if (!state.valid || !validateStep(state, example.step)) return null;
  const proposal = positive ? clone(example.step) : negativeProposal(example);
  if (!proposal) return null;
  const valid = validateStep(state, proposal);
  if (valid !== positive) return null;
  // Both positive and negative questions use neutral markings: retaining a
  // valid pattern's original pivot/lines after changing its cells is misleading.
  delete proposal.pivot; delete proposal.wings; delete proposal.orientation;
  proposal.units = [];
  const label = (TECHNIQUES.find(item => item.id === example.technique) || {}).label || example.technique;
  return {
    id: `recognize:${example.id}:${positive ? 'valid' : 'invalid'}`,
    exerciseId: example.id, sourcePuzzleId: example.sourcePuzzleId, technique: example.technique,
    board: example.board.slice(), candidates: example.candidates.slice(),
    step: clone(example.step), claimStep: proposal, valid,
    claim: `下面标出的依据，能按「${label}」推出标记的填数或删候选操作吗？`,
    explanation: positive ? `成立。${proposal.explanation}` : `不成立。${invalidExplanation(example.technique, proposal, state)}`,
  };
}

function getRecognitionExample(techniqueId, index = 0) {
  if (!Number.isSafeInteger(index) || index < 0) return null;
  const examples = examplesFor(techniqueId);
  if (!examples.length) return null;
  const example = examples[Math.floor(index / 2) % examples.length];
  const key = `recognize:${example.id}:${index % 2 === 0 ? 'valid' : 'invalid'}`;
  if (!recognitionCache.has(key)) recognitionCache.set(key, makeRecognition(example, index % 2 === 0));
  return recognitionCache.get(key) ? clone(recognitionCache.get(key)) : null;
}

function getRecognitionById(id) {
  if (typeof id !== 'string' || id.length > 200 || !id.startsWith('recognize:')) return null;
  const match = /^recognize:(.+):(valid|invalid)$/.exec(id);
  if (!match) return null;
  if (recognitionCache.has(id)) return recognitionCache.get(id) ? clone(recognitionCache.get(id)) : null;
  for (const technique of TECHNIQUES) {
    const example = examplesFor(technique.id).find(item => item.id === match[1]);
    if (example) {
      const result = makeRecognition(example, match[2] === 'valid');
      recognitionCache.set(id, result);
      return result ? clone(result) : null;
    }
  }
  return null;
}

module.exports = { makeRecognition, getRecognitionExample, getRecognitionById };
