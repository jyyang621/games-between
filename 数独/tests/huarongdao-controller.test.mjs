import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { createGame, SAVE_KEY, DIRECTIONS } = require('../../微信小程序/src/games/huarongdao/index.js');
const { LEVELS, newRound, canMove, move, cloneRound } = require('../../微信小程序/src/games/huarongdao/engine.js');
const { registry } = require('../../微信小程序/src/registry.js');
const { validateGameModule } = require('../../微信小程序/src/app/game-contract.js');
const { createMiniGame } = require('../../微信小程序/src/app/host.js');
const solutions = JSON.parse(readFileSync(new URL('./fixtures/huarongdao-solutions.json', import.meta.url)));
const action = name => `huarongdao:${name}`;
const direction = ({ dx, dy }) => Object.keys(DIRECTIONS).find(key => DIRECTIONS[key][0] === dx && DIRECTIONS[key][1] === dy);
function setup(saved, overrides = {}) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []), modals = [], sheets = [], writes = [], toasts = [];
  const game = createGame({ read: key => structuredClone(storage.get(key)),
    write: (key, value) => { writes.push(key); storage.set(key, structuredClone(value)); return true; },
    services: { modal: (config, confirm) => { modals.push({ config, confirm }); return true; },
      actionSheet: config => { sheets.push(config); return true; }, toast: value => toasts.push(value), invalidate() {} }, ...overrides });
  return { game, storage, modals, sheets, writes, toasts };
}
function step(game, item) { game.activate(action('select'), item.id); return game.activate(action('move'), direction(item)); }
function first(game) { const item = solutions[game.model.round.levelId][0]; assert.equal(step(game, item), true); return item; }
function context() { return new Proxy({ measureText: t => ({ width: String(t).length * 7 }) }, { get: (o, k) => k in o ? o[k] : () => {} }); }

test('huarongdao registers as eighth game and starts beginner with isolated storage and entry sharing', () => {
  const { game, writes } = setup();
  assert.equal(validateGameModule(game, 'huarongdao'), game);
  assert.equal(registry.resolve({ g: 'huarongdao' }).id, 'huarongdao');
  assert.equal(registry.list().findIndex(e => e.id === 'huarongdao'), 7);
  assert.equal(SAVE_KEY, 'games-between:huarongdao:save:v1');
  assert.equal(game.sharePayload().query, 'g=huarongdao');
  assert.equal(game.model.round.levelId, 'beginner'); assert.equal(game.musicActive, false);
  game.save(); assert.deepEqual(writes, [SAVE_KEY]);
});
test('selection does not move or start the clock, successful directions count and save one grid step', () => {
  const { game, storage } = setup(); const item = solutions.beginner[0];
  assert.equal(game.activate(action('select'), item.id), true); game.tick(1000);
  assert.equal(game.model.elapsedMs, 0); assert.equal(game.model.round.moves.length, 0);
  assert.equal(game.activate(action('move'), direction(item)), true);
  assert.equal(game.model.round.moves.length, 1); assert.equal(game.musicActive, true);
  assert.deepEqual(storage.get(SAVE_KEY).round, cloneRound(game.model.round));
  assert.equal(game.activate(action('move'), 'diagonal'), false);
  assert.equal(game.activate(action('select'), '__proto__'), false);
});
test('timer clamps long frames, rejects invalid deltas, and saves elapsed time periodically', () => {
  const { game, storage } = setup(); first(game);
  for (const dt of [0, -1, NaN, Infinity]) game.tick(dt);
  assert.equal(game.model.elapsedMs, 0); game.tick(60000); assert.equal(game.model.elapsedMs, 1000);
  for (let i = 0; i < 4; i++) game.tick(1000);
  assert.equal(storage.get(SAVE_KEY).elapsedMs, 5000);
});
test('home/background/share/resize pause clock and input until manual resume', () => {
  for (const reason of ['home', 'background', 'share', 'resize']) {
    const { game } = setup(); first(game); game.tick(100); game.pause(reason);
    const before = structuredClone(game.model); game.enter(); game.tick(10000);
    assert.equal(game.activate(action('move'), 'left'), false); assert.equal(game.activate(action('undo')), false);
    assert.deepEqual(game.model, before); assert.equal(game.musicActive, false);
    assert.equal(game.activate(action('resume')), true); game.tick(100); assert.equal(game.model.elapsedMs, 200);
  }
});
test('all three verified solution paths win and record separate best scores; undo reopens without erasing best', () => {
  for (const level of LEVELS) {
    const { game, storage } = setup(); game.activate(action('level'), level.id);
    const path = solutions[level.id];
    for (const item of path) assert.equal(step(game, item), true);
    assert.equal(game.model.status, 'won'); assert.equal(game.model.best[level.id], path.length);
    assert.equal(game.musicActive, false); assert.equal(game.getResumeInfo().available, false);
    const before = game.model.elapsedMs; game.tick(1000); assert.equal(game.model.elapsedMs, before);
    assert.equal(game.activate(action('move'), 'down'), false);
    assert.equal(game.activate(action('undo')), true); assert.equal(game.model.status, 'playing');
    assert.equal(game.model.round.moves.length, path.length - 1); assert.equal(game.model.best[level.id], path.length);
    assert.equal(step(game, path.at(-1)), true); assert.equal(storage.get(SAVE_KEY).best[level.id], path.length);
  }
});
test('best score never worsens on replay and restart preserves other level records', () => {
  const { game } = setup({ version: 1, round: newRound('beginner'), elapsedMs: 0, best: { beginner: 1, classic: 200, intermediate: 50 } });
  game.activate(action('resume'));
  for (const item of solutions.beginner) step(game, item);
  assert.equal(game.model.best.beginner, 1);
  game.activate(action('new')); assert.equal(game.model.round.moves.length, 0);
  assert.deepEqual(game.model.best, { beginner: 1, intermediate: 50, classic: 200 });
});
test('save restoration keeps moves, positions, elapsed time and records but starts paused', () => {
  const { game, storage } = setup(); first(game); game.tick(123); game.save();
  const next = setup(storage.get(SAVE_KEY)).game;
  assert.equal(next.model.paused, true); assert.deepEqual(next.model.round, game.model.round);
  assert.equal(next.model.elapsedMs, 123); next.tick(10000); assert.equal(next.model.elapsedMs, 123);
  next.activate(action('resume')); next.activate(action('undo')); assert.deepEqual(next.model.round, newRound('beginner'));
});
test('undo to the opening does not reset or stop a started timer and survives reload', () => {
  const { game, storage } = setup(); first(game); game.tick(100); game.activate(action('undo')); game.tick(200); game.save();
  assert.equal(game.model.round.moves.length, 0); assert.equal(game.model.elapsedMs, 300);
  assert.equal(game.musicActive, true); assert.equal(game.getResumeInfo().available, true);
  const next = setup(storage.get(SAVE_KEY)).game; next.activate(action('resume')); next.tick(100);
  assert.equal(next.model.elapsedMs, 400); next.activate(action('new'));
  assert.equal(next.model.elapsedMs, 0); assert.equal(next.model.started, false);
});
test('broken board or time falls back safely; unknown save version cannot resume', () => {
  const round = newRound('classic'); round.pieces[0].x = 30;
  const { game } = setup({ version: 1, round, elapsedMs: -1, best: { beginner: 13, classic: -1, intermediate: Infinity } });
  assert.equal(game.model.round.levelId, 'beginner'); assert.equal(game.model.elapsedMs, 0);
  assert.deepEqual(game.model.best, { beginner: 13, intermediate: null, classic: null });
  assert.equal(setup({ version: 2, round: newRound('classic') }).game.model.round.levelId, 'beginner');
  assert.equal(setup({ version: 1, round: newRound('classic'), elapsedMs: NaN }).game.model.elapsedMs, 0);
});
test('restart and level replacement require confirmation after progress; stale callbacks cannot replace another state', () => {
  const { game, modals } = setup(); first(game); const before = cloneRound(game.model.round);
  game.activate(action('new')); assert.equal(game.model.paused, true); assert.deepEqual(game.model.round, before);
  game.activate(action('resume')); modals[0].confirm(); assert.deepEqual(game.model.round, before);
  game.activate(action('level'), 'classic'); assert.equal(game.model.round.levelId, 'beginner');
  modals[1].confirm(); assert.equal(game.model.round.levelId, 'classic'); assert.equal(game.model.paused, false);
  assert.equal(game.activate(action('level'), 'missing'), false);
});
test('level picker cancellation or same-level restores prior pause and only different choice asks confirmation', () => {
  const { game, sheets, modals } = setup(); first(game);
  game.activate(action('level')); assert.equal(game.model.paused, true);
  sheets[0].fail({ errMsg: 'showActionSheet:fail cancel' }); assert.equal(game.model.paused, false);
  game.activate(action('level')); sheets[1].success({ tapIndex: 0 }); assert.equal(game.model.paused, false); assert.equal(modals.length, 0);
  game.activate(action('level')); sheets[2].success({ tapIndex: 2 }); assert.equal(modals.length, 1); assert.equal(game.model.round.levelId, 'beginner');
  assert.equal(game.model.paused, true); modals[0].confirm(); assert.equal(game.model.round.levelId, 'classic');
  sheets[2].success({ tapIndex: 1 }); assert.equal(game.model.round.levelId, 'classic');
});
test('late action sheet result after navigation or disposal is ignored', () => {
  for (const stop of [g => g.pause('home'), g => g.dispose()]) {
    const { game, sheets } = setup(); game.activate(action('level')); stop(game);
    sheets[0].success({ tapIndex: 2 }); assert.equal(game.model.round.levelId, 'beginner');
  }
});
test('storage and native menu failures do not destroy a playable round', () => {
  const { game } = setup(null, { read() { throw Error('read'); }, write() { throw Error('quota'); }, services: {} });
  assert.equal(game.save(), false); first(game); assert.equal(game.activate(action('level')), true);
  assert.equal(game.model.paused, false); assert.doesNotThrow(() => game.render(context()));
  game.activate(action('new')); assert.equal(game.model.paused, true); assert.equal(game.model.round.moves.length, 1);
});
test('piece taps select without moving; drag uses the actual piece and counts grid moves', () => {
  const { game } = setup(); game.resize({ width: 390, height: 844 });
  const item = solutions.beginner[0], piece = game.model.round.pieces.find(p => p.id === item.id), b = game.layout.board, cell = b.w / 4;
  const p = { x: b.x + (piece.x + 0.5) * cell, y: b.y + (piece.y + 0.5) * cell, identifier: 1 };
  game.pointer('start', [p]); game.pointer('end', [p]); assert.equal(game.model.selected, item.id); assert.equal(game.model.round.moves.length, 0);
  game.pointer('start', [p]); game.pointer('move', [{ ...p, x: p.x + item.dx * cell, y: p.y + item.dy * cell }]);
  game.pointer('end', [{ ...p, x: p.x + item.dx * cell, y: p.y + item.dy * cell }]);
  assert.equal(game.model.round.moves.length, 1); assert.deepEqual(game.model.round.moves[0], item);
});
test('diagonal, multitouch, cancelled, invalid and off-board gestures never move a piece', () => {
  const { game } = setup(); game.resize({ width: 390, height: 844 });
  const item = solutions.beginner[0], piece = game.model.round.pieces.find(p => p.id === item.id), b = game.layout.board, c = b.w / 4;
  const p = { x: b.x + (piece.x + 0.5) * c, y: b.y + (piece.y + 0.5) * c, identifier: 1 }, q = { ...p, identifier: 2 };
  game.pointer('start', [p]); game.pointer('end', [{ ...p, x: p.x + c, y: p.y + c }]);
  game.pointer('start', [p]); game.pointer('start', [q]); game.pointer('end', [{ ...p, x: p.x + c }]); game.pointer('end', [q]);
  game.pointer('start', [p]); game.pointer('cancel', []); game.pointer('end', [{ ...p, x: p.x + c }]);
  assert.equal(game.pointer('start', [{ x: -100, y: -100, identifier: 3 }]), false);
  game.pointer('cancel', []); game.pointer('start', [p]); game.pointer('move', [{ ...p, x: NaN }]);
  assert.equal(game.model.round.moves.length, 0);
});
test('long straight drag cannot jump through an occupied neighboring cell', () => {
  const { game } = setup(); game.activate(action('level'), 'classic'); game.resize({ width: 390, height: 844 });
  const b = game.layout.board, c = b.w / 4, cao = game.model.round.pieces.find(p => p.id === 'cao');
  const p = { x: b.x + (cao.x + 0.5) * c, y: b.y + (cao.y + 0.5) * c, identifier: 1 };
  assert.equal(canMove(game.model.round, 'cao', 0, 1), false);
  game.pointer('start', [p]); game.pointer('end', [{ ...p, y: p.y + 4 * c }]);
  assert.equal(game.model.round.moves.length, 0); assert.equal(cao.y, 0);
});
test('host exposes third-page entry and routes real touch selection plus direction while isolating other saves', () => {
  const handlers = new Map(), storage = new Map([['unrelated', { keep: true }]]); let time = 0;
  const platform = { createCanvas: () => ({ getContext: () => context() }),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }),
    getLaunchOptionsSync: () => ({}), getStorageSync: k => structuredClone(storage.get(k)),
    setStorageSync: (k, v) => storage.set(k, structuredClone(v)), showShareMenu() {} };
  for (const n of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize','ShareAppMessage']) {
    platform[`on${n}`] = f => handlers.set(n, f); platform[`off${n}`] = () => {};
  }
  const app = createMiniGame(platform, { autoTick: false, now: () => time });
  const emit = (kind, x, y) => handlers.get(kind)({ changedTouches: [{ clientX: x, clientY: y, identifier: 1 }] });
  try {
    app.activate('hub:page', 2); assert.ok(app.targets.some(t => t.action === 'openGame' && t.payload === 'huarongdao'));
    app.activate('openGame', 'huarongdao');
    const item = solutions.beginner[0], piece = app.activeGame.model.round.pieces.find(p => p.id === item.id), b = app.activeGame.layout.board, c = b.w / 4;
    const x = b.x + (piece.x + 0.5) * c, y = b.y + (piece.y + 0.5) * c;
    emit('TouchStart', x, y); emit('TouchEnd', x, y); assert.equal(app.activeGame.model.selected, item.id);
    const target = app.targets.find(t => t.action === action('move') && t.payload === direction(item)); assert.ok(target);
    emit('TouchStart', target.x + target.w / 2, target.y + target.h / 2); emit('TouchEnd', target.x + target.w / 2, target.y + target.h / 2);
    assert.equal(app.activeGame.model.round.moves.length, 1);
    handlers.get('Hide')(); time += 10000; handlers.get('Show')({}); app.tick(); assert.equal(app.activeGame.model.paused, true);
    app.activate('home'); app.activate('openGame', 'huarongdao'); assert.equal(app.activeGame.model.paused, true);
    assert.deepEqual(storage.get('unrelated'), { keep: true }); assert.ok(storage.has(SAVE_KEY));
  } finally { app.dispose(); }
});
