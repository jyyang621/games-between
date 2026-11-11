'use strict';

// Human logic only. Search/backtracking is deliberately absent from grading.
const RATING_VERSION = 'logic-v1';
const TIERS = ['easy', 'medium', 'hard', 'expert'];
const FULL_MASK = 511;
const bit = digit => 1 << (digit - 1);
const popcount = mask => { let count = 0; for (; mask; mask &= mask - 1) count += 1; return count; };
const digitsFromMask = mask => Array.from({ length: 9 }, (_, i) => i + 1).filter(digit => mask & bit(digit));
const validIndex = index => Number.isInteger(index) && index >= 0 && index < 81;
const validDigit = digit => Number.isInteger(digit) && digit >= 1 && digit <= 9;
const sorted = values => [...new Set(values)].sort((a, b) => a - b);
const equal = (left, right) => left.length === right.length && left.every((value, i) => value === right[i]);
const coordinate = index => `第${Math.floor(index / 9) + 1}行第${index % 9 + 1}列`;

const TECHNIQUES = [
  { id: 'naked-single', label: '唯一候选数', tier: 0, lesson: '一个空格只有一个候选数时，这个数就是该格的答案。', pitfall: '先确认候选数完整；手动漏记不构成唯一候选。' },
  { id: 'hidden-single', label: '唯一位置', tier: 0, lesson: '一个数在某一行、列或宫中只剩一个可填位置。', pitfall: '目标格可以有多个候选；检查的是这个数在整个区域的位置。' },
  { id: 'pointing', label: '宫内区块排除', tier: 1, lesson: '一个宫内某数的所有位置集中在同一行或列，该行或列的宫外位置不能再填这个数。', pitfall: '必须检查宫内该数的所有候选位置。' },
  { id: 'claiming', label: '行列区块排除', tier: 1, lesson: '一行或一列中某数的所有位置都在同一宫，宫内其余位置可以排除这个数。', pitfall: '检查整行或整列，不能只看到宫内几个相邻候选。' },
  { id: 'naked-pair', label: '显性数对', tier: 1, lesson: '同一区域两格的候选并集恰好为两个数，这两数可从区域内其他格排除。', pitfall: '任一支撑格多一个候选，数对就可能不成立；不能确定两格的先后顺序。' },
  { id: 'hidden-pair', label: '隐性数对', tier: 1, lesson: '同一区域两个数只出现在相同两格，这两格可以删除其他候选。', pitfall: '确认两个数在整个区域内都没有第三个位置。' },
  { id: 'naked-triple', label: '显性三数组', tier: 2, lesson: '同一区域三格的候选并集恰好为三个数，区域内其他格可排除这三个数。', pitfall: '三格不必各有三个候选，但并集不能超过三个数。' },
  { id: 'hidden-triple', label: '隐性三数组', tier: 2, lesson: '同一区域三个数的所有候选位置限制在三格，这三格可以删除其他数。', pitfall: '必须同时检查三个数的全部位置，而不只是三格的外观。' },
  { id: 'x-wing', label: 'X-Wing', tier: 2, lesson: '某数在两行的候选都恰好落在同两列，可从这两列的其他行排除；行列可互换。', pitfall: '两条基准线不能有第三个候选位置。' },
  { id: 'xy-wing', label: 'XY-Wing', tier: 3, lesson: '双候选枢纽分别连接两个双候选分支；两分支共有的第三个数可从同时看见两分支的位置排除。', pitfall: '两个分支必须分别连接枢纽的不同候选，且共有同一个外部候选。' },
  { id: 'xyz-wing', label: 'XYZ-Wing', tier: 3, lesson: '三候选枢纽连接两个双候选分支；共有数可从同时看见枢纽和两分支的位置排除。', pitfall: '排除格必须同时看见三个支撑格，漏掉枢纽会错误删数。' },
  { id: 'swordfish', label: '剑鱼', tier: 3, lesson: '某数在三条基准线中各占两到三个位置，合计限制在三条交叉线，可从交叉线的其他位置排除。', pitfall: '所有基准候选必须落在选定的三条交叉线内。' },
];
const metadata = Object.fromEntries(TECHNIQUES.map(item => [item.id, item]));
const UNITS = [];
for (let row = 0; row < 9; row += 1) UNITS.push({ type: 'row', index: row, cells: Array.from({ length: 9 }, (_, col) => row * 9 + col) });
for (let col = 0; col < 9; col += 1) UNITS.push({ type: 'column', index: col, cells: Array.from({ length: 9 }, (_, row) => row * 9 + col) });
for (let box = 0; box < 9; box += 1) UNITS.push({ type: 'box', index: box, cells: Array.from({ length: 9 }, (_, i) => (Math.floor(box / 3) * 3 + Math.floor(i / 3)) * 9 + box % 3 * 3 + i % 3) });
const CELL_UNITS = Array.from({ length: 81 }, (_, index) => UNITS.filter(unit => unit.cells.includes(index)));
const PEERS = CELL_UNITS.map((units, index) => sorted(units.flatMap(unit => unit.cells)).filter(other => other !== index));
const sees = (left, right) => left !== right && PEERS[left].includes(right);
const unitName = unit => `第${unit.index + 1}${unit.type === 'row' ? '行' : unit.type === 'column' ? '列' : '宫'}`;

function boardIsValid(board) {
  if (!Array.isArray(board) || board.length !== 81 || !Array.from(board).every(value => Number.isInteger(value) && value >= 0 && value <= 9)) return false;
  return UNITS.every(unit => {
    const placed = unit.cells.map(index => board[index]).filter(Boolean);
    return new Set(placed).size === placed.length;
  });
}

function naturalCandidates(board) {
  return board.map((value, index) => value ? 0 : PEERS[index].reduce((mask, peer) => board[peer] ? mask & ~bit(board[peer]) : mask, FULL_MASK));
}

function housesHaveEveryDigit(board, candidates) {
  return UNITS.every(unit => {
    const present = unit.cells.reduce((acc, index) => acc | (board[index] ? bit(board[index]) : candidates[index]), 0);
    return present === FULL_MASK;
  });
}

function createLogicState(board, candidates) {
  const safeBoard = Array.isArray(board) ? board.slice() : [];
  if (!boardIsValid(safeBoard)) return { board: safeBoard, candidates: [], valid: false };
  const natural = naturalCandidates(safeBoard);
  if (candidates !== undefined && (!Array.isArray(candidates) || candidates.length !== 81 || !Array.from(candidates).every(mask => Number.isInteger(mask) && mask >= 0 && mask <= FULL_MASK))) {
    return { board: safeBoard, candidates: natural, valid: false };
  }
  const masks = natural.map((mask, index) => candidates === undefined ? mask : mask & candidates[index]);
  return { board: safeBoard, candidates: masks, valid: masks.every((mask, index) => safeBoard[index] || mask !== 0) && housesHaveEveryDigit(safeBoard, masks) };
}

function stateIsValid(state) {
  if (!state || state.valid === false || !boardIsValid(state.board) || !Array.isArray(state.candidates) || state.candidates.length !== 81) return false;
  const natural = naturalCandidates(state.board);
  return Array.from(state.candidates).every((mask, index) => Number.isInteger(mask) && mask >= 0 && mask <= FULL_MASK &&
    (state.board[index] ? mask === 0 : mask !== 0 && (mask & natural[index]) === mask)) && housesHaveEveryDigit(state.board, state.candidates);
}

function combinations(items, count, callback, prefix = [], start = 0) {
  if (prefix.length === count) { callback(prefix); return; }
  for (let i = start; i <= items.length - count + prefix.length; i += 1) combinations(items, count, callback, [...prefix, items[i]], i + 1);
}

function makeStep(state, technique, cells, digits, placements, eliminations, explanation, units = [], extra = {}) {
  const actions = new Map();
  for (const action of eliminations) if (!state.board[action.index] && state.candidates[action.index] & bit(action.digit)) actions.set(`${action.index}:${action.digit}`, action);
  const cleaned = [...actions.values()].sort((a, b) => a.index - b.index || a.digit - b.digit);
  if (!placements.length && !cleaned.length) return null;
  const eliminatedMasks = new Map();
  for (const action of cleaned) eliminatedMasks.set(action.index, (eliminatedMasks.get(action.index) || 0) | bit(action.digit));
  if ([...eliminatedMasks].some(([index, mask]) => (state.candidates[index] & ~mask) === 0)) return null;
  return { technique, tier: metadata[technique].tier, cells: sorted(cells), digits: sorted(digits), placements, eliminations: cleaned, explanation,
    units: units.map(unit => ({ type: unit.type, index: unit.index })), ...extra };
}

function singleSteps(state, hidden) {
  const result = [];
  if (!hidden) {
    state.candidates.forEach((mask, index) => {
      if (mask && popcount(mask) === 1) {
        const value = digitsFromMask(mask)[0];
        result.push(makeStep(state, 'naked-single', [index], [value], [{ index, value }], [], `${coordinate(index)}只剩候选数 ${value}，因此填入 ${value}。`));
      }
    });
  } else {
    for (const unit of UNITS) for (let digit = 1; digit <= 9; digit += 1) {
      const cells = unit.cells.filter(index => state.candidates[index] & bit(digit));
      if (cells.length !== 1) continue;
      const index = cells[0];
      result.push(makeStep(state, 'hidden-single', cells, [digit], [{ index, value: digit }], [], `${unitName(unit)}中只有${coordinate(index)}能填 ${digit}，因此填入 ${digit}。`, [unit]));
    }
  }
  return result.filter(Boolean);
}

function lockedSteps(state, pointing) {
  const result = [];
  const bases = pointing ? UNITS.slice(18) : UNITS.slice(0, 18);
  for (const base of bases) for (let digit = 1; digit <= 9; digit += 1) {
    const cells = base.cells.filter(index => state.candidates[index] & bit(digit));
    if (cells.length < 2 || cells.length > 3) continue;
    const covers = pointing
      ? UNITS.slice(0, 18).filter(unit => cells.every(index => unit.cells.includes(index)))
      : UNITS.slice(18).filter(unit => cells.every(index => unit.cells.includes(index)));
    for (const cover of covers) {
      const eliminations = cover.cells.filter(index => !base.cells.includes(index)).map(index => ({ index, digit }));
      const technique = pointing ? 'pointing' : 'claiming';
      const step = makeStep(state, technique, cells, [digit], [], eliminations, `${unitName(base)}中 ${digit} 的所有候选都在${unitName(cover)}，所以${unitName(cover)}中${unitName(base)}以外的位置可以删除 ${digit}。`, [base, cover]);
      if (step) result.push(step);
    }
  }
  return result;
}

function subsetSteps(state, size, hidden) {
  const result = [];
  const technique = `${hidden ? 'hidden' : 'naked'}-${size === 2 ? 'pair' : 'triple'}`;
  for (const unit of UNITS) {
    if (!hidden) {
      const possible = unit.cells.filter(index => popcount(state.candidates[index]) >= 2 && popcount(state.candidates[index]) <= size);
      combinations(possible, size, cells => {
        const mask = cells.reduce((acc, index) => acc | state.candidates[index], 0);
        if (popcount(mask) !== size) return;
        const digits = digitsFromMask(mask);
        const eliminations = unit.cells.filter(index => !cells.includes(index)).flatMap(index => digits.map(digit => ({ index, digit })));
        const step = makeStep(state, technique, cells, digits, [], eliminations, `${unitName(unit)}的这${size}格只能使用 ${digits.join('、')}，它们占据这${size}个数，其余格可以删除这些候选。`, [unit]);
        if (step) result.push(step);
      });
    } else {
      const locations = Array.from({ length: 9 }, (_, i) => unit.cells.filter(index => state.candidates[index] & bit(i + 1)));
      const possible = Array.from({ length: 9 }, (_, i) => i + 1).filter(digit => locations[digit - 1].length >= 2 && locations[digit - 1].length <= size);
      combinations(possible, size, digits => {
        const cells = sorted(digits.flatMap(digit => locations[digit - 1]));
        if (cells.length !== size) return;
        const mask = digits.reduce((acc, digit) => acc | bit(digit), 0);
        const eliminations = cells.flatMap(index => digitsFromMask(state.candidates[index] & ~mask).map(digit => ({ index, digit })));
        const step = makeStep(state, technique, cells, digits, [], eliminations, `${unitName(unit)}中 ${digits.join('、')} 的所有位置限制在这${size}格，因此这几格中的其他候选可以删除。`, [unit]);
        if (step) result.push(step);
      });
    }
  }
  return result;
}

function fishSteps(state, size) {
  const result = [];
  const technique = size === 2 ? 'x-wing' : 'swordfish';
  for (let orientation = 0; orientation < 2; orientation += 1) for (let digit = 1; digit <= 9; digit += 1) {
    const baseUnits = orientation === 0 ? UNITS.slice(0, 9) : UNITS.slice(9, 18);
    const crossIndex = index => orientation === 0 ? index % 9 : Math.floor(index / 9);
    const eligible = baseUnits.filter(unit => {
      const count = unit.cells.filter(index => state.candidates[index] & bit(digit)).length;
      return count >= 2 && count <= size;
    });
    combinations(eligible, size, bases => {
      const cells = sorted(bases.flatMap(unit => unit.cells.filter(index => state.candidates[index] & bit(digit))));
      const crosses = sorted(cells.map(crossIndex));
      if (crosses.length !== size || crosses.some(cross => cells.filter(index => crossIndex(index) === cross).length < 2)) return;
      const covers = crosses.map(index => UNITS[(orientation === 0 ? 9 : 0) + index]);
      const eliminations = covers.flatMap(unit => unit.cells.filter(index => !cells.includes(index) && !bases.some(base => base.cells.includes(index))).map(index => ({ index, digit })));
      const step = makeStep(state, technique, cells, [digit], [], eliminations, `${bases.map(unitName).join('、')}中 ${digit} 的所有候选限制在${covers.map(unitName).join('、')}，因此这${size}条交叉线的其他位置可以删除 ${digit}。`, [...bases, ...covers], { orientation: orientation === 0 ? 'rows' : 'columns' });
      if (step) result.push(step);
    });
  }
  return result;
}

function wingSteps(state, xyz) {
  const result = [];
  const bivalue = state.candidates.map((mask, index) => popcount(mask) === 2 ? index : -1).filter(index => index !== -1);
  const pivots = xyz ? state.candidates.map((mask, index) => popcount(mask) === 3 ? index : -1).filter(index => index !== -1) : bivalue;
  for (const pivot of pivots) {
    const pivotMask = state.candidates[pivot];
    const wings = bivalue.filter(index => sees(pivot, index) && (xyz ? (state.candidates[index] & pivotMask) === state.candidates[index] : popcount(state.candidates[index] & pivotMask) === 1));
    combinations(wings, 2, pair => {
      const left = state.candidates[pair[0]], right = state.candidates[pair[1]];
      const common = left & right;
      if (popcount(common) !== 1 || popcount(left | right | pivotMask) !== 3) return;
      if (xyz ? (left | right) !== pivotMask : (common & pivotMask) !== 0 || (left & pivotMask) === (right & pivotMask)) return;
      const digit = digitsFromMask(common)[0];
      const cells = [pivot, ...pair];
      const targets = PEERS[pair[0]].filter(index => !cells.includes(index) && sees(index, pair[1]) && (!xyz || sees(index, pivot)));
      const technique = xyz ? 'xyz-wing' : 'xy-wing';
      const explanation = xyz
        ? `枢纽${coordinate(pivot)}与两个分支共同限制了 ${digit}：无论枢纽取哪一个数，三格中至少一格必须为 ${digit}。同时看见三格的位置可以删除 ${digit}。`
        : `枢纽${coordinate(pivot)}的两种取值分别迫使一个分支填 ${digit}，所以同时看见两个分支的位置可以删除 ${digit}。`;
      const step = makeStep(state, technique, cells, digitsFromMask(pivotMask | left | right), [], targets.map(index => ({ index, digit })), explanation, [], { pivot, wings: pair.slice() });
      if (step) result.push(step);
    });
  }
  return result;
}

const detectors = {
  'naked-single': state => singleSteps(state, false),
  'hidden-single': state => singleSteps(state, true),
  pointing: state => lockedSteps(state, true),
  claiming: state => lockedSteps(state, false),
  'naked-pair': state => subsetSteps(state, 2, false),
  'hidden-pair': state => subsetSteps(state, 2, true),
  'naked-triple': state => subsetSteps(state, 3, false),
  'hidden-triple': state => subsetSteps(state, 3, true),
  'x-wing': state => fishSteps(state, 2),
  'xy-wing': state => wingSteps(state, false),
  'xyz-wing': state => wingSteps(state, true),
  swordfish: state => fishSteps(state, 3),
};

function allowedTechniques({ maxTier = 3, techniqueId } = {}) {
  if (!Number.isInteger(maxTier) || maxTier < 0 || maxTier > 3) return [];
  return TECHNIQUES.filter(item => item.tier <= maxTier && (techniqueId === undefined || item.id === techniqueId));
}

function findSteps(state, options = {}) {
  if (!stateIsValid(state)) return [];
  const steps = allowedTechniques(options).flatMap(item => detectors[item.id](state));
  const seen = new Set();
  return steps.filter(step => {
    const key = `${step.technique}|${step.cells}|${step.digits}|${step.placements.map(action => `${action.index}:${action.value}`)}|${step.eliminations.map(action => `${action.index}:${action.digit}`)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function findStep(state, options = {}) {
  if (!stateIsValid(state)) return null;
  for (const item of allowedTechniques(options)) {
    const steps = detectors[item.id](state);
    if (steps.length) return steps[0];
  }
  return null;
}

function validateStep(state, submitted) {
  if (!stateIsValid(state) || !submitted || !metadata[submitted.technique] || !Array.isArray(submitted.cells) || !submitted.cells.length ||
      !Array.from(submitted.cells).every(validIndex) || new Set(submitted.cells).size !== submitted.cells.length) return false;
  const placements = submitted.placements === undefined ? [] : submitted.placements;
  const eliminations = submitted.eliminations === undefined ? [] : submitted.eliminations;
  if (!Array.isArray(placements) || !Array.isArray(eliminations) || !placements.length && !eliminations.length ||
      !Array.from(placements).every(action => action && validIndex(action.index) && validDigit(action.value)) ||
      !Array.from(eliminations).every(action => action && validIndex(action.index) && validDigit(action.digit))) return false;
  if (new Set(placements.map(action => `${action.index}:${action.value}`)).size !== placements.length ||
      new Set(eliminations.map(action => `${action.index}:${action.digit}`)).size !== eliminations.length) return false;
  const cells = sorted(submitted.cells);
  if (submitted.digits !== undefined && (!Array.isArray(submitted.digits) || !Array.from(submitted.digits).every(validDigit) || new Set(submitted.digits).size !== submitted.digits.length)) return false;
  return findSteps(state, { techniqueId: submitted.technique }).some(step => equal(cells, step.cells) &&
    (submitted.digits === undefined || equal(sorted(submitted.digits), step.digits)) &&
    placements.every(action => step.placements.some(expected => expected.index === action.index && expected.value === action.value)) &&
    eliminations.every(action => step.eliminations.some(expected => expected.index === action.index && expected.digit === action.digit)));
}

function applyTrusted(state, step) {
  for (const action of step.placements || []) {
    state.board[action.index] = action.value;
    state.candidates[action.index] = 0;
    for (const peer of PEERS[action.index]) if (!state.board[peer]) state.candidates[peer] &= ~bit(action.value);
  }
  for (const action of step.eliminations || []) state.candidates[action.index] &= ~bit(action.digit);
  state.valid = stateIsValid({ board: state.board, candidates: state.candidates });
}

function applyStep(state, step) {
  if (!validateStep(state, step)) return false;
  const next = { board: state.board.slice(), candidates: state.candidates.slice(), valid: true };
  applyTrusted(next, step);
  if (!next.valid) return false;
  state.board = next.board; state.candidates = next.candidates; state.valid = true;
  return true;
}

function analyze(board, { maxTier = 3, trace = false, maxSteps = 1000, candidates } = {}) {
  const state = createLogicState(board, candidates);
  const path = [];
  let usedTier = 0, score = 0;
  const limit = Number.isInteger(maxSteps) && maxSteps >= 0 ? Math.min(maxSteps, 10000) : 1000;
  if (state.valid && allowedTechniques({ maxTier }).length) for (let i = 0; i < limit && state.board.includes(0); i += 1) {
    const step = findStep(state, { maxTier });
    if (!step) break;
    applyTrusted(state, step);
    path.push(step);
    usedTier = Math.max(usedTier, step.tier);
    score += [1, 8, 24, 60][step.tier];
    if (!state.valid) break;
  }
  const solved = state.valid && !state.board.includes(0);
  return { version: RATING_VERSION, solved, valid: state.valid, rating: solved ? TIERS[usedTier] : null, maxTier: usedTier,
    steps: path.length, score, ...(trace ? { trace: path } : {}), board: state.board, candidates: state.candidates,
    stalled: state.valid && !solved, limited: path.length >= limit && !solved };
}

module.exports = { RATING_VERSION, TIERS, TECHNIQUES, FULL_MASK, digitsFromMask, createLogicState, findSteps, findStep, validateStep, applyStep, analyze };
