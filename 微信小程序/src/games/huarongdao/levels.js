'use strict';

// Fixed 4x5 sliding-block geometry. Positions are top-left, zero based.
// The classic arrangement matches the traditional 横刀立马 / Red Donkey board.
const PIECES = Object.freeze([
  ['cao', '曹操', 2, 2], ['guan', '关羽', 2, 1],
  ['zhang', '张飞', 1, 2], ['zhao', '赵云', 1, 2],
  ['ma', '马超', 1, 2], ['huang', '黄忠', 1, 2],
  ['soldier-1', '兵一', 1, 1], ['soldier-2', '兵二', 1, 1],
  ['soldier-3', '兵三', 1, 1], ['soldier-4', '兵四', 1, 1],
].map(row => Object.freeze(row)));

function level(id, title, description, positions) {
  return Object.freeze({ id, title, description, pieces: Object.freeze(PIECES.map(([pieceId, label, w, h], i) =>
    Object.freeze({ id: pieceId, label, w, h, x: positions[i][0], y: positions[i][1] }))) });
}

const LEVELS = Object.freeze([
  // Training positions from prefixes 104 and 76 of the independently solved
  // 116-unit-move classic path. These are original practice labels, not names
  // claimed for traditional arrangements. See artifacts/huarongdao/solutions.json.
  level('beginner', '入门', '从经典解法末段截取的练习局，熟悉滑块与出口。',
    [[0, 2], [2, 3], [3, 0], [2, 0], [1, 0], [0, 0], [2, 2], [0, 4], [2, 4], [3, 2]]),
  level('intermediate', '进阶', '从经典解法中段截取的练习局，学习为大块让路。',
    [[2, 1], [2, 3], [1, 1], [1, 3], [0, 0], [0, 2], [2, 0], [2, 4], [3, 4], [3, 0]]),
  level('classic', '经典·横刀立马', '从经典布局开始，调动十块棋子，帮曹操抵达下方出口。',
    [[1, 0], [1, 2], [0, 0], [3, 0], [0, 2], [3, 2], [1, 3], [2, 3], [0, 4], [3, 4]]),
]);

module.exports = { LEVELS };
