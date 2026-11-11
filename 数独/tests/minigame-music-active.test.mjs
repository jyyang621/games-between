import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSudokuGame } = require('../../微信小程序/src/games/sudoku/index.js');
const { createZumaGame } = require('../../微信小程序/src/games/zuma/index.js');
const { createGoldMinerGame } = require('../../微信小程序/src/games/gold-miner/index.js');
const { createGame: create2048, SAVE_KEY: SAVE_2048 } = require('../../微信小程序/src/games/game-2048/index.js');
const { createGame: createMinesweeper } = require('../../微信小程序/src/games/minesweeper/index.js');
const { newGame: new2048 } = require('../../微信小程序/src/games/game-2048/engine.js');

function create(factory, initial = []) {
  const storage = new Map(initial);
  const game = factory({ now: () => 1792300000000,
    read: key => structuredClone(storage.get(key)),
    write: (key, value) => { storage.set(key, structuredClone(value)); return true; },
    services: { modal() {}, actionSheet() {}, invalidate() {}, toast() {}, storageAvailable: true },
  });
  game.resize({ width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } });
  game.enter({}, { source: 'hub' });
  return game;
}

function finishSudoku(game) {
  for (let index = 0; index < 81; index++) if (!game.model.board[index]) {
    game.activate('sudoku:select', index);
    assert.equal(game.activate('sudoku:digit', game.model.solution[index]), true);
  }
  assert.equal(game.model.completed, true);
}

test('Sudoku music follows ordinary and whole-puzzle play, pause and completion', () => {
  const game = create(createSudokuGame);
  assert.equal(game.musicActive, true);
  game.pause('background'); assert.equal(game.musicActive, false);
  game.activate('sudoku:pause'); assert.equal(game.musicActive, true);
  finishSudoku(game); assert.equal(game.musicActive, false);
  game.activate('sudoku:mode', 'training'); game.activate('sudoku:lesson', 'hidden-single');
  assert.equal(game.musicActive, false);
  assert.equal(game.activate('sudoku:trainingFullPuzzle'), true);
  assert.equal(game.musicActive, true);
  game.activate('sudoku:pause'); assert.equal(game.musicActive, false);
  game.activate('sudoku:pause'); assert.equal(game.musicActive, true);
  finishSudoku(game); assert.equal(game.musicActive, false);
  game.activate('sudoku:mode', 'training'); assert.equal(game.musicActive, false);
});

test('Sudoku classroom reading stays quiet and interactive exercises stop music on completion', () => {
  const game = create(createSudokuGame);
  game.activate('sudoku:mode', 'training'); assert.equal(game.musicActive, false);
  game.activate('sudoku:foundationBasics'); assert.equal(game.musicActive, false);
  game.activate('sudoku:foundationComplete'); assert.equal(game.musicActive, false);
  game.activate('sudoku:lesson', 'hidden-single'); assert.equal(game.musicActive, false);
  assert.equal(game.activate('sudoku:practice', { id: 'hidden-single', mode: 'independent' }), true);
  assert.equal(game.musicActive, true);
  game.activate('sudoku:trainingDemo'); assert.equal(game.training.training.completed, true);
  assert.equal(game.musicActive, false);
  game.activate('sudoku:trainingNext'); assert.equal(game.musicActive, true);
  game.activate('sudoku:trainingBack'); assert.equal(game.musicActive, false);
});

test('Zuma music follows playing state and excludes guide, menus, pauses and wave results', () => {
  const game = create(createZumaGame);
  assert.equal(game.musicActive, false);
  game.activate('zuma:start'); assert.equal(game.musicActive, true);
  game.activate('zuma:help'); assert.equal(game.musicActive, false);
  game.activate('zuma:help-close'); assert.equal(game.musicActive, true);
  game.pause('home'); assert.equal(game.musicActive, false);
  game.activate('zuma:resume'); assert.equal(game.musicActive, true);
  game.activate('zuma:menu'); assert.equal(game.musicActive, false);
  game.activate('zuma:mode', 'endless'); assert.equal(game.musicActive, false);
  game.activate('zuma:start'); assert.equal(game.musicActive, true);
  game.model.balls = []; game.model.projectiles = []; game.model.spawned = game.model.totalBalls;
  game.tick(16); assert.equal(game.model.status, 'won'); assert.equal(game.musicActive, false);
  game.activate('zuma:next'); assert.equal(game.musicActive, true);
  game.model.status = 'lost'; assert.equal(game.musicActive, false);
});

test('Gold miner music excludes preparation, help, pause, ended frames, results and shop', () => {
  const game = create(createGoldMinerGame);
  assert.equal(game.musicActive, false);
  game.activate('miner:new'); assert.equal(game.musicActive, false);
  game.activate('miner:play'); assert.equal(game.musicActive, true);
  game.activate('miner:help'); assert.equal(game.musicActive, false);
  game.activate('miner:help-back'); assert.equal(game.musicActive, false);
  game.activate('miner:resume'); assert.equal(game.musicActive, true);
  game.pause('background'); assert.equal(game.musicActive, false);
  game.activate('miner:resume'); assert.equal(game.musicActive, true);
  game.model.engine.income = game.model.engine.level.target;
  game.model.engine.players[0].income = game.model.engine.income;
  game.model.engine.update(game.model.engine.timeLeft);
  assert.equal(game.model.scene, 'playing'); assert.equal(game.musicActive, false);
  game.tick(16); assert.equal(game.model.scene, 'result'); assert.equal(game.musicActive, false);
  game.activate('miner:shop'); assert.equal(game.model.scene, 'shop'); assert.equal(game.musicActive, false);
  game.activate('miner:next'); assert.equal(game.musicActive, false);
  game.activate('miner:play'); assert.equal(game.musicActive, true);
  game.activate('miner:menu'); assert.equal(game.musicActive, false);
});

test('2048 music follows playing state, including continuing after 2048 and cold restores', () => {
  const game = create(create2048);
  assert.equal(game.musicActive, true);
  game.activate('game-2048:help'); assert.equal(game.musicActive, false);
  game.activate('game-2048:resume'); assert.equal(game.musicActive, true);
  game.pause('home'); assert.equal(game.musicActive, false);
  game.activate('game-2048:resume'); assert.equal(game.musicActive, true);
  game.dispose(); assert.equal(game.musicActive, false);
  const won = create(create2048, [[SAVE_2048, { version: 1, best: 2048,
    round: { ...new2048(123), board: [2048, 2, ...Array(14).fill(0)], won: true, keepPlaying: false } }]]);
  assert.equal(won.musicActive, false);
  won.activate('game-2048:continue'); assert.equal(won.musicActive, true);
  const over = create(create2048, [[SAVE_2048, { version: 1, best: 0, round: { ...new2048(123),
    board: [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2] } }]]);
  assert.equal(over.model.status, 'over'); assert.equal(over.musicActive, false);
  over.activate('game-2048:new'); assert.equal(over.musicActive, true);
});

test('all registered modules expose boolean music activity as a read-only getter', () => {
  for (const factory of [createSudokuGame, createZumaGame, createGoldMinerGame, create2048, createMinesweeper]) {
    const game = create(factory), property = Object.getOwnPropertyDescriptor(game, 'musicActive');
    assert.equal(typeof property.get, 'function'); assert.equal(property.set, undefined);
    assert.equal(typeof game.musicActive, 'boolean');
    assert.throws(() => { game.musicActive = true; }, TypeError);
  }
});
