'use strict';

const { createLogicState, findSteps } = require('./logic.js');
const clone = value => JSON.parse(JSON.stringify(value));
const solution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'.split('').map(Number);
const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number);
const blankNotes = () => new Array(81).fill(0);
const digitMask = values => values.reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
const singleBoard = solution.slice(); singleBoard[8] = 0;
const candidateState = createLogicState(puzzle);
const sweep = findSteps(candidateState, { techniqueId: 'hidden-single' }).find(step => step.units[0].type === 'box');

const FOUNDATION_LESSONS = Object.freeze([
  {
    id: 'rules', title: '先认识棋盘', summary: '每一行、每一列、每一宫，都要有 1 到 9。',
    paragraphs: ['棋盘有 9 行、9 列，粗线分出的 3×3 区域叫作“宫”。每个区域都要填入 1 到 9，而且不能重复。', '深色大数字是题目给出的线索，不能修改。你需要根据它们推理出空格里的数字。', '绿色是一行，蓝色是一列，浅棕色是一个宫。它们重合的格子同时受到这三个区域约束。'],
    diagram: { board: solution, candidates: blankNotes(), cells: [0], units: [{ type: 'row', index: 0 }], roles: { baseUnits: [{ type: 'row', index: 0 }], crossUnits: [{ type: 'column', index: 0 }] }, boxes: [0], digits: [], caption: '绿是一行，蓝是一列，浅棕是一宫；交会的格同时受约束。' }
  },
  {
    id: 'last-cell', title: '一个区域只剩一格', summary: '不必猜：先找这个区域缺少哪个数字。',
    paragraphs: ['如果一行只剩一个空格，把已经出现的数字从 1 到 9 中排除，缺少的数字就是答案。', '图中第 1 行已经有 1、3、4、5、6、7、8、9，只缺 2，所以最后一格填 2。', '同样的方法也适用于一列或一个宫。这是开始扫看棋盘时很容易找到的突破口。'],
    diagram: { board: singleBoard, candidates: blankNotes(), cells: [8], units: [{ type: 'row', index: 0 }], digits: [2], placements: [{ index: 8, value: 2 }], caption: '第 1 行只缺 2，绿色空格只能填 2。' }
  },
  {
    id: 'candidates', title: '候选数怎样得到', summary: '小数字记录“还可能”，并不代表已经确定。',
    paragraphs: ['选一个空格，检查它所在的行、列和宫。已经出现在这些区域的数字，都不能再放进这个格子。', '图中的第 1 行第 3 列只剩 1、2、4 没被排除，所以它的完整候选是 {1,2,4}。', '候选数不是答案，也不是随手猜测。后续有了可靠推理，还可以继续删除其中不可能的数字；“填全笔记”会帮助记录。'],
    diagram: { board: puzzle, candidates: blankNotes().map((mask, index) => index === 2 ? digitMask([1, 2, 4]) : 0), cells: [2], units: [{ type: 'row', index: 0 }, { type: 'column', index: 2 }, { type: 'box', index: 0 }], digits: [1, 2, 4], caption: '小数字 1、2、4 都还可能；现在不能随意选一个。' }
  },
  {
    id: 'sweep', title: '从宫看向行和列', summary: '用已有大数字排除位置，寻找某数字的唯一位置。',
    paragraphs: ['不显示候选时，也可以选一个数字，先在一个宫中找它能落在哪里，再检查相关行和列。', '图中看数字 1。第 8 行已有 1，因此右下宫的第 8 行不能再填 1；第 9 列也已有 1，所以右下宫第 7 行的空格同样被排除。', '右下宫只剩第 9 行第 7 列能填 1。这就是“唯一位置”的扫看方法；也要记得检查整行和整列。'],
    diagram: { board: puzzle, candidates: blankNotes(), cells: sweep ? sweep.cells : [78], units: [{ type: 'box', index: 8 }], digits: [1], sourceCells: puzzle.map((digit, index) => digit === 1 ? index : -1).filter(index => index >= 0), forbiddenCells: [62, 69, 70], placements: [{ index: 78, value: 1 }], caption: '已有的 1 排除其他空格，右下宫只剩绿色位置。' }
  }
]);

function getFoundationPage(index = 0) {
  const item = FOUNDATION_LESSONS[Math.max(0, Math.min(FOUNDATION_LESSONS.length - 1, Math.floor(Number(index) || 0)))];
  return clone(item);
}

module.exports = { FOUNDATION_LESSONS, getFoundationPage };
