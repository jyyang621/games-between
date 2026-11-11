'use strict';

const { getTrainingExamples } = require('./bank.js');
const { createLogicState, applyStep } = require('./logic.js');
const cache = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const popcount = mask => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };
const unitsAt = index => [{ type: 'row', index: Math.floor(index / 9) }, { type: 'column', index: index % 9 }, { type: 'box', index: Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor(index % 9 / 3) }];
function sees(a, b) { return a !== b && unitsAt(a).some(left => unitsAt(b).some(right => left.type === right.type && left.index === right.index)); }

function getStepRegions(step) {
  if (!step) return [];
  if (step.units && step.units.length) return clone(step.units);
  const cells = step.cells || [];
  const units = cells.length === 1 ? unitsAt(cells[0]) : cells.flatMap(index => unitsAt(index)).filter(unit => cells.filter(index => unitsAt(index).some(other => other.type === unit.type && other.index === unit.index)).length >= 2);
  const unique = new Map(units.map(unit => [`${unit.type}:${unit.index}`, unit]));
  // A region must remain visible even for a future technique whose evidence
  // cells are all in separate houses. This does not disclose the exact cells.
  if (!unique.size) cells.forEach(index => unique.set(`box:${Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor(index % 9 / 3)}`, unitsAt(index)[2]));
  return [...unique.values()];
}

function getStepRoles(step, candidates = []) {
  const roles = { pivot: null, wings: [], baseUnits: [], crossUnits: [] };
  if (!step) return roles;
  if (step.technique === 'x-wing' || step.technique === 'swordfish') {
    const count = step.technique === 'x-wing' ? 2 : 3;
    roles.baseUnits = clone((step.units || []).slice(0, count));
    roles.crossUnits = clone((step.units || []).slice(count));
  }
  if (step.technique === 'xy-wing' || step.technique === 'xyz-wing') {
    if (Number.isInteger(step.pivot)) { roles.pivot = step.pivot; roles.wings = (step.wings || []).slice(); }
    else {
      const xyz = step.technique === 'xyz-wing';
      for (const pivot of step.cells || []) {
        const wings = step.cells.filter(index => index !== pivot), mask = candidates[pivot] || 0;
        if (wings.length !== 2 || popcount(mask) !== (xyz ? 3 : 2) || !wings.every(index => sees(pivot, index) && popcount(candidates[index] || 0) === 2)) continue;
        const left = candidates[wings[0]], right = candidates[wings[1]], common = left & right;
        if (popcount(common) !== 1 || popcount(left | right | mask) !== 3 || (xyz ? (left | right) !== mask : (common & mask) !== 0 || (left & mask) === (right & mask))) continue;
        roles.pivot = pivot; roles.wings = wings; break;
      }
    }
  }
  return roles;
}

/** Three original visual frames built from our validated, complete puzzle data. */
function getTeachingVisual(lessonId, page = 0) {
  if (!cache.has(lessonId)) cache.set(lessonId, getTrainingExamples(lessonId)[0] || null);
  const example = cache.get(lessonId);
  if (!example) return null;
  const stage = Math.max(0, Math.min(2, Math.floor(Number(page) || 0))), step = clone(example.step);
  const state = createLogicState(example.board, example.candidates);
  if (stage === 2 && !applyStep(state, step)) return null;
  const names = ['条件', '推理', '结果'];
  const caption = stage === 0 ? '先确认绿色格中的候选与所在区域，看看条件是否完整。' : stage === 1 ? step.explanation : step.placements.length ? '蓝色大数字是本步确定的答案。继续观察，它会影响哪些格？' : '红色划线处是本步排除的候选；其余候选仍然保留。';
  return { sourceId: example.id, page: stage, title: names[stage], board: state.board, candidates: state.candidates,
    originalCandidates: example.candidates.slice(), cells: step.cells.slice(), units: getStepRegions(step),
    eliminations: stage >= 1 ? clone(step.eliminations) : [], placements: stage === 2 ? clone(step.placements) : [],
    digits: step.digits.slice(), caption, step, roles: getStepRoles(step, example.candidates) };
}

module.exports = { getTeachingVisual, getStepRegions, getStepRoles };
