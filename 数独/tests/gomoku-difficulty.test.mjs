import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createRound, placeStone, cloneRound, undo, validateRound, DIFFICULTIES } = require('../../微信小程序/src/games/gomoku/engine.js');
const { createGame, SAVE_KEY, AI_DELAY } = require('../../微信小程序/src/games/gomoku/index.js');
const { createMiniGame } = require('../../微信小程序/src/app/host.js');

function setup(saved, overrides = {}) {
  const sheets = [], modals = [], toasts = [], storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []);
  const game = createGame({
    read: key => structuredClone(storage.get(key)),
    write: (key, value) => { storage.set(key, structuredClone(value)); return true; },
    services: { actionSheet: config => { sheets.push(config); return true; }, modal: (config, confirm) => { modals.push({ config, confirm }); return true; }, toast: message => toasts.push(message), invalidate() {}, ...overrides },
  });
  return { game, sheets, modals, toasts, storage };
}
test('all difficulty settings persist through copy, replay validation and undo', () => {
  assert.deepEqual(DIFFICULTIES.map(d => d.id), ['easy', 'normal', 'hard']);
  for (const { id } of DIFFICULTIES) {
    const round = createRound('ai', 2, id); placeStone(round, 112); placeStone(round, 113);
    assert.equal(cloneRound(round).difficulty, id);
    assert.deepEqual(validateRound(round), round);
    undo(round); assert.equal(round.difficulty, id); assert.equal(round.humanColor, 2);
  }
});
test('legacy version-one saves without difficulty migrate to normal without losing history', () => {
  const old = createRound('ai', 1); placeStone(old, 112); placeStone(old, 113); delete old.difficulty;
  const validated = validateRound(old);
  assert.equal(validated.difficulty, 'normal'); assert.deepEqual(validated.moves, old.moves);
  const { game, storage } = setup({ version: 1, round: old });
  assert.equal(game.model.paused, true); assert.equal(game.model.round.difficulty, 'normal');
  assert.deepEqual(game.model.round.board, old.board); game.save();
  assert.equal(storage.get(SAVE_KEY).version, 1); assert.equal(storage.get(SAVE_KEY).round.difficulty, 'normal');
  for (const difficulty of [null, '', 'expert', 1, {}, []]) assert.equal(validateRound({ ...old, difficulty }), null);
});
test('selecting a difficulty on an empty board changes it immediately and survives cold restore', () => {
  const { game, sheets, modals, storage } = setup();
  assert.equal(game.activate('gomoku:chooseDifficulty'), true);
  assert.equal(game.model.paused, true); assert.equal(sheets[0].itemList.length, 3);
  sheets[0].success({ tapIndex: 2 });
  assert.equal(game.model.round.difficulty, 'hard'); assert.equal(game.model.paused, false); assert.equal(modals.length, 0);
  assert.match(game.statusText, /困难/); assert.match(game.getResumeInfo().text, /困难/);
  const restored = setup(storage.get(SAVE_KEY)).game;
  assert.equal(restored.model.round.difficulty, 'hard'); assert.equal(restored.model.paused, true);
});
test('changing difficulty mid-game confirms a new round; cancellation preserves old setting and stones', () => {
  const { game, sheets, modals, storage } = setup(); game.activate('gomoku:cell', 112);
  const before = cloneRound(game.model.round);
  game.activate('gomoku:chooseDifficulty'); sheets[0].success({ tapIndex: 0 });
  assert.equal(modals.length, 1); assert.match(modals[0].config.title, /难度/);
  assert.match(modals[0].config.content, /简单/); assert.deepEqual(game.model.round, before);
  assert.deepEqual(storage.get(SAVE_KEY).round, before); assert.equal(game.model.paused, true);
  game.activate('gomoku:resume'); modals[0].confirm(); assert.deepEqual(game.model.round, before, 'stale confirmation must not replace resumed board');
  game.activate('gomoku:chooseDifficulty'); sheets[1].success({ tapIndex: 2 }); modals[1].confirm();
  assert.equal(game.model.round.difficulty, 'hard'); assert.equal(game.model.round.moves.length, 0); assert.equal(game.model.paused, false);
});
test('menu cancel, same tier and invalid indices resume current play without changing the board', () => {
  for (const respond of [s => s.fail({ errMsg: 'showActionSheet:fail cancel' }), s => s.success({ tapIndex: 1 }), s => s.success({ tapIndex: -1 }), s => s.success({ tapIndex: '2' })]) {
    const { game, sheets, toasts } = setup(); game.activate('gomoku:cell', 112); const before = cloneRound(game.model.round);
    game.activate('gomoku:chooseDifficulty'); game.tick(5000); assert.deepEqual(game.model.round, before);
    respond(sheets[0]); assert.equal(game.model.paused, false); assert.deepEqual(game.model.round, before); assert.equal(toasts.length, 0);
    game.tick(AI_DELAY); assert.equal(game.model.round.moves.length, 2);
  }
});
test('unavailable or failing action sheets recover without leaving an invisible pause or resetting game', () => {
  for (const actionSheet of [undefined, () => false, () => { throw Error('unavailable'); }, config => { config.fail({ errMsg: 'native failure' }); return true; }]) {
    const { game, toasts } = setup(undefined, { actionSheet }); game.activate('gomoku:cell', 112); const before = cloneRound(game.model.round);
    assert.equal(game.activate('gomoku:chooseDifficulty'), true); assert.equal(game.model.paused, false);
    assert.deepEqual(game.model.round, before); assert.equal(toasts.length, 1);
  }
});
test('late difficulty menu callbacks cannot mutate navigation, paused, reentered or disposed games', () => {
  for (const interrupt of [g => g.pause('background'), g => g.enter(), g => g.dispose()]) {
    const { game, sheets, modals } = setup(); game.activate('gomoku:cell', 112); const before = cloneRound(game.model.round);
    game.activate('gomoku:chooseDifficulty'); interrupt(game); sheets[0].success({ tapIndex: 2 }); sheets[0].fail({ errMsg: 'cancel' });
    assert.deepEqual(game.model.round, before); assert.equal(modals.length, 0); assert.equal(game.model.paused, true);
  }
});
test('difficulty stays through side and mode changes and is not changeable in local or paused state', () => {
  const { game, sheets } = setup(); game.activate('gomoku:difficulty', 'easy');
  assert.equal(game.model.round.difficulty, 'easy');
  game.activate('gomoku:color', 2); assert.equal(game.model.round.difficulty, 'easy');
  game.activate('gomoku:mode', 'local'); assert.equal(game.activate('gomoku:chooseDifficulty'), false);
  assert.equal(game.activate('gomoku:difficulty', 'hard'), false);
  game.activate('gomoku:mode', 'ai'); assert.equal(game.model.round.difficulty, 'easy');
  game.pause('test'); assert.equal(game.activate('gomoku:chooseDifficulty'), false); assert.equal(sheets.length, 0);
});
test('real host action-sheet success/cancel and reset confirmation respect native modal barriers', () => {
  const handlers = new Map(), storage = new Map(); let sheet, modal, time = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ measureText: x => ({ width: String(x).length * 6 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o,k) => k in o ? o[k] : () => {} });
  const platform = {
    createCanvas: () => ({ getContext: () => ctx }), getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }),
    getLaunchOptionsSync: () => ({ query: { g: 'gomoku' } }), getStorageSync: k => structuredClone(storage.get(k)), setStorageSync: (k,v) => storage.set(k, structuredClone(v)),
    showActionSheet: config => { sheet = config; }, showModal: config => { modal = config; },
  };
  for (const event of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize']) platform['on' + event] = fn => handlers.set(event, fn);
  const app = createMiniGame(platform, { autoTick: false, now: () => time });
  try {
    app.activate('gomoku:cell', 112); app.activate('gomoku:chooseDifficulty');
    time += 5000; app.tick(); assert.equal(app.activeGame.model.round.moves.length, 1);
    assert.equal(app.activate('gomoku:resume'), false);
    sheet.fail({ errMsg: 'showActionSheet:fail cancel' }); sheet.complete();
    assert.equal(app.activeGame.model.paused, false);
    app.activate('gomoku:chooseDifficulty'); sheet.success({ tapIndex: 2 }); sheet.complete();
    assert.ok(modal); assert.equal(app.activate('gomoku:resume'), false);
    modal.success({ confirm: false, cancel: true }); modal.complete();
    assert.equal(app.activeGame.model.round.difficulty, 'normal'); assert.equal(app.activeGame.model.round.moves.length, 1);
    assert.equal(app.activeGame.model.paused, true);
    app.activate('gomoku:resume'); app.activate('gomoku:chooseDifficulty'); sheet.success({ tapIndex: 2 }); sheet.complete();
    modal.fail({ errMsg: 'showModal:fail test' }); modal.complete();
    assert.equal(app.activeGame.model.round.difficulty, 'normal'); assert.equal(app.activeGame.model.round.moves.length, 1);
    assert.equal(app.activeGame.model.paused, true);
    app.activate('gomoku:resume'); app.activate('gomoku:chooseDifficulty'); sheet.success({ tapIndex: 2 }); sheet.complete();
    modal.success({ confirm: true }); modal.complete();
    assert.equal(app.activeGame.model.round.difficulty, 'hard'); assert.equal(app.activeGame.model.round.moves.length, 0);
    assert.equal(app.activeGame.model.paused, false);
  } finally { app.dispose(); }
});
