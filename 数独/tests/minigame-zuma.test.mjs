import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GameModel, DIAMETER, FIXED_STEP, SHOOTER, sweptCircleHit, findConnectedRun } = require('../../微信小程序/src/games/zuma/core/model.js');
const { createRound } = require('../../微信小程序/src/games/zuma/state.js');
const { createZumaGame, SAVE_KEY } = require('../../微信小程序/src/games/zuma/index.js');
const { createZumaLayout, screenToWorld } = require('../../微信小程序/src/games/zuma/renderer.js');
const { checkCore } = require('../../微信小程序/vendor/zuma/check-core.cjs');

function fixture(colors, start = 420, speed = 0) {
  const game = new GameModel({ seed: 731, totalBalls: 24, speed });
  game.start(); game.spawned = game.totalBalls; game.projectiles = [];
  game.balls = colors.map((color, index) => ({ id: 100 + index, color, s: start + index * DIAMETER }));
  return game;
}
let projectileId = 9000;
function hit(game, index, color) {
  const p = game.track.pointAt(game.balls[index].s), t = game.track.tangentAt(game.balls[index].s), nx = -t.y, ny = t.x;
  game.projectiles.push({ id: projectileId++, color, x: p.x + nx * 150, y: p.y + ny * 150, vx: -nx * 36000, vy: -ny * 36000 });
  return game.step(FIXED_STEP);
}
function advance(game, seconds) { const events = []; for (let i = 0; i < Math.ceil(seconds / FIXED_STEP); i += 1) events.push(...game.step(FIXED_STEP)); return events; }
function create(saved) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []);
  const game = createZumaGame({ read: key => storage.get(key), write: (key, value) => { storage.set(key, structuredClone(value)); return true; } });
  return { game, storage };
}
function context() {
  const gradient = { addColorStop() {} };
  return new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get(object, key) { return key in object ? object[key] : () => {}; } });
}
function screenPoint(layout, point, identifier = 1) {
  const b = layout.board, s = layout.scale;
  return { identifier, clientX: b.x + (layout.rotated ? 700 - point.y : point.x) * s, clientY: b.y + (layout.rotated ? point.x : point.y) * s };
}

test('Zuma source and generated core match the committed provenance hashes', () => assert.equal(checkCore(), true));

test('Zuma swept collision detects fast and moving intersections without tunnelling', () => {
  assert.equal(sweptCircleHit({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, 20), 0.4);
  assert.equal(sweptCircleHit({ x: -10, y: 6 }, { x: 10, y: 6 }, { x: 0, y: 0 }, 5), null);
  const game = fixture([0]); hit(game, 0, 1);
  assert.equal(game.projectiles.length, 0); assert.deepEqual(game.balls.map(b => b.color).sort(), [0, 1]);
  assert.ok(Math.abs(game.balls[1].s - game.balls[0].s - DIAMETER) < 1e-5);
  const moving = fixture([0], 420, 14400), middle = moving.track.pointAt(480);
  moving.projectiles.push({ id: 9800, color: 1, ...middle, vx: 0, vy: 0 }); moving.step(FIXED_STEP);
  assert.equal(moving.projectiles.length, 0); assert.equal(moving.balls.length, 2);
});

test('Zuma keeps a pair until a third matching ball hits, and clears the whole connected run', () => {
  const game = fixture([0]); hit(game, 0, 0);
  assert.equal(game.balls.length, 2); assert.equal(game.score, 0);
  hit(game, 0, 0); assert.equal(game.balls.length, 0); assert.equal(game.score, 30); assert.equal(game.status, 'won');
  const large = fixture([1, 1, 1]); hit(large, 1, 1);
  assert.equal(large.balls.length, 0); assert.equal(large.score, 40);
});

test('Zuma physical gaps separate same-color runs and recalled contacts score successive combos', () => {
  assert.deepEqual(findConnectedRun([{ id: 1, color: 0, s: 100 }, { id: 2, color: 0, s: 134 }, { id: 3, color: 0, s: 202 }], 1), { start: 0, end: 1 });
  const game = fixture([0, 0, 1, 1, 2, 2, 1, 0]); const events = hit(game, 4, 2);
  assert.equal(game.score, 30); assert.equal(game.status, 'playing');
  events.push(...advance(game, 6));
  assert.equal(game.score, 180); assert.equal(game.bestCombo, 3); assert.equal(game.status, 'won');
  assert.equal(events.filter(e => e.type === 'pop').length, 3);
  advance(game, 2); assert.equal(game.score, 180);
});

test('Zuma waits for unspawned balls, loses at the endpoint, and resolves a saving shot first', () => {
  const waiting = fixture([]); waiting.spawned -= 1; waiting.step(FIXED_STEP); assert.equal(waiting.status, 'playing');
  const lost = fixture([0]); lost.balls[0].s = lost.track.length; lost.step(FIXED_STEP); assert.equal(lost.status, 'lost');
  const saving = fixture([0, 0]); saving.balls[0].s = saving.track.length - DIAMETER; saving.balls[1].s = saving.track.length;
  hit(saving, 1, 0); assert.equal(saving.status, 'won'); assert.equal(saving.score, 30);
  const late = fixture([2, 2]); late.currentColor = 0; late.nextColor = 1; late.step(FIXED_STEP);
  assert.equal(late.currentColor, 2); assert.equal(late.nextColor, 2);
});

test('Zuma fixed-step simulation is invariant to render cadence', () => {
  const first = new GameModel({ seed: 321 }), second = new GameModel({ seed: 321 }); first.start(); second.start();
  for (let i = 0; i < 240; i += 1) first.step(1 / 120);
  for (let i = 0; i < 120; i += 1) second.step(1 / 60);
  assert.deepEqual(second.balls, first.balls); assert.equal(second.elapsed, first.elapsed); assert.equal(second.spawned, first.spawned);
});

test('Zuma freezes in ready, paused and terminal states and limits foreground catch-up', () => {
  const { game } = create(); game.tick(1000); assert.equal(game.model.elapsed, 0); assert.equal(game.id, 'zuma');
  assert.equal(game.activate('zuma:start'), true); game.tick(1000);
  assert.ok(game.model.elapsed > 0 && game.model.elapsed <= 0.05 + 1e-8);
  game.model.fire(300, 100); game.tick(16); game.pause();
  const before = structuredClone({ balls: game.model.balls, shots: game.model.projectiles, elapsed: game.model.elapsed });
  game.tick(10000); assert.deepEqual({ balls: game.model.balls, shots: game.model.projectiles, elapsed: game.model.elapsed }, before);
  assert.match(game.statusText, /第 1 关.*旅程已暂停/); assert.equal(game.activate('zuma:swap'), true); assert.equal(game.model.status, 'paused');
  assert.equal(game.activate('zuma:resume'), true); game.tick(16); assert.ok(game.model.elapsed > before.elapsed);
  game.model.status = 'lost'; const end = game.model.elapsed; game.tick(100); assert.equal(game.model.elapsed, end);
});

test('Zuma snapshots preserve in-flight projectiles, future random ammunition and deterministic restart', () => {
  const original = createRound(); original.model.start();
  for (let i = 0; i < 90; i += 1) { if (i % 13 === 0) original.model.fire(40 + i * 7, 100); original.model.step(1 / 60); }
  original.model.fire(900, 600);
  const snapshot = original.snapshot(); assert.ok(snapshot.randomDraws > 0);
  const loaded = createRound(structuredClone(snapshot)); assert.equal(loaded.model.status, 'paused'); loaded.model.resume();
  assert.deepEqual(loaded.snapshot(), original.snapshot());
  for (let i = 0; i < 120; i += 1) {
    if (i % 14 === 0) { original.model.fire(100 + i * 6, 570); loaded.model.fire(100 + i * 6, 570); }
    original.model.step(1 / 60); loaded.model.step(1 / 60);
  }
  assert.deepEqual(loaded.snapshot(), original.snapshot());
  loaded.restart(); const fresh = createRound(); fresh.model.start(); assert.deepEqual(loaded.snapshot(), fresh.snapshot());
});

test('Zuma snapshot preserves pending gap combos and does not replay an award on load', () => {
  const round = createRound(); round.model.start();
  round.model.spawned = round.model.totalBalls;
  round.model.balls = [0, 0, 1, 1, 0].map((color, index) => ({ id: 100 + index, color, s: 420 + index * DIAMETER }));
  round.model.nextId = 200;
  const p = round.model.track.pointAt(round.model.balls[2].s), t = round.model.track.tangentAt(round.model.balls[2].s);
  round.model.projectiles.push({ id: 150, color: 1, x: p.x - t.y * 150, y: p.y + t.x * 150, vx: t.y * 36000, vy: -t.x * 36000 });
  round.model.step(FIXED_STEP); assert.equal(round.model.score, 30);
  const snapshot = round.snapshot(); assert.ok(snapshot.gapCombos.length > 0);
  const loaded = createRound(snapshot); assert.equal(loaded.model.status, 'paused'); assert.equal(loaded.model.score, 30);
  loaded.model.resume(); advance(loaded.model, 4); assert.equal(loaded.model.score, 90); assert.equal(loaded.model.bestCombo, 2);
});

test('Zuma local storage restores paused progress, keeps best across restart, and tolerates storage failure', () => {
  const first = create(); first.game.activate('zuma:start'); first.game.tick(50); first.game.model.score = 240; first.game.save();
  const saved = first.storage.get(SAVE_KEY); const loaded = create(saved).game;
  assert.equal(loaded.model.status, 'paused'); assert.equal(loaded.model.score, 240); assert.equal(loaded.best, 240);
  assert.equal(loaded.activate('zuma:restart'), true); assert.equal(loaded.model.score, 0); assert.equal(loaded.best, 240); assert.equal(loaded.model.status, 'playing');
  const broken = createZumaGame({ read() { throw new Error('denied'); }, write() { throw new Error('full'); } });
  assert.equal(broken.activate('zuma:start'), true); assert.equal(broken.save(), false); assert.doesNotThrow(() => broken.pause());
});

test('Zuma ignores corrupt, duplicate-id, excessive, or non-finite snapshots', () => {
  const base = createRound().snapshot();
  for (const mutate of [
    value => { value.score = Infinity; }, value => { value.randomDraws = 1e8; },
    value => { value.balls[1].id = value.balls[0].id; }, value => { value.balls[0].s = NaN; },
    value => { value.gapCombos = [['bad:key', 2]]; }, value => { value.status = 'won'; },
  ]) {
    const bad = structuredClone(base); mutate(bad); const round = createRound(bad);
    assert.equal(round.model.status, 'ready'); assert.equal(round.model.score, 0); assert.equal(round.model.balls.length, 22);
  }
  assert.equal(create({ version: 999, best: 500, round: base }).game.best, 0);
});

test('Zuma portrait rotation and landscape coordinates aim and fire at the same world target', () => {
  for (const viewport of [{ width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } }, { width: 844, height: 390, safeTop: 0, safeBottom: 21, capsuleRect: { bottom: 32 } }]) {
    const { game } = create(); game.resize(viewport); game.activate('zuma:start');
    const target = { x: 860, y: 230 }, point = screenPoint(game.layout, target);
    const world = screenToWorld(game.layout, point.clientX, point.clientY);
    assert.ok(Math.abs(world.x - target.x) < 1e-8 && Math.abs(world.y - target.y) < 1e-8);
    assert.equal(game.pointer('start', [screenPoint(game.layout, { x: 800, y: 300 })]), true);
    assert.equal(game.model.projectiles.length, 0);
    game.pointer('move', [point]); assert.equal(game.pointer('end', [point]), true);
    const shot = game.model.projectiles[0], angle = Math.atan2(target.y - SHOOTER.y, target.x - SHOOTER.x);
    assert.ok(Math.abs(shot.vx - Math.cos(angle) * 1080) < 1e-8);
    assert.ok(Math.abs(shot.vy - Math.sin(angle) * 1080) < 1e-8);
    const colors = [game.model.currentColor, game.model.nextColor]; game.activate('zuma:swap');
    assert.deepEqual([game.model.currentColor, game.model.nextColor], colors.reverse());
  }
});

test('Zuma cancels touch on pause, resize, cancel, and ignores other fingers ending', () => {
  const { game } = create(); game.activate('zuma:start');
  const point = screenPoint(game.layout, { x: 850, y: 250 });
  assert.equal(game.pointer('start', [point]), true);
  assert.equal(game.pointer('end', [{ ...point, identifier: 2 }]), false); assert.equal(game.model.projectiles.length, 0);
  game.pointer('cancel', []); assert.equal(game.pointer('end', [point]), false);
  game.pointer('start', [point]); game.pause(); game.activate('zuma:resume'); assert.equal(game.pointer('end', [point]), false);
  game.pointer('start', [point]); game.resize({ width: 844, height: 390 }); assert.equal(game.pointer('end', [point]), false);
  assert.equal(game.pointer('start', [{ clientX: -10, clientY: -10 }]), false);
});

test('Zuma help pauses the live round and never resumes after a background lifecycle pause', () => {
  const { game } = create(); game.activate('zuma:start'); game.tick(50); const elapsed = game.model.elapsed;
  assert.equal(game.activate('zuma:help'), true); game.tick(100); assert.equal(game.model.elapsed, elapsed);
  assert.equal(game.activate('zuma:restart'), false); assert.equal(game.activate('zuma:help-close'), true); assert.equal(game.model.status, 'playing');
  game.activate('zuma:help'); game.pause(); game.activate('zuma:help-close'); assert.equal(game.model.status, 'paused');
  assert.equal(game.activate('unknown'), false);
});

test('Zuma renders actionable controls inside phone safe areas across orientations', () => {
  for (const viewport of [
    { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
    { width: 375, height: 667, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
    { width: 844, height: 390, safeTop: 0, safeBottom: 21, capsuleRect: { bottom: 32 } },
    { width: 667, height: 375, safeTop: 0, safeBottom: 0, capsuleRect: { bottom: 32 } },
    { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
    { width: 320, height: 568, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  ]) {
    const { game } = create(); game.resize(viewport); const layout = createZumaLayout(viewport);
    assert.ok(layout.board.w > 0 && layout.board.h > 0);
    for (const state of ['ready', 'playing', 'paused', 'won', 'lost']) {
      game.model.status = state; const targets = game.render(context());
      assert.ok(targets.some(target => target.action === 'home')); assert.ok(targets.some(target => target.action === 'share'));
      for (const target of targets) {
        assert.ok(target.x >= 0 && target.y >= Math.max(viewport.safeTop, viewport.capsuleRect.bottom), JSON.stringify({ viewport, state, target }));
        assert.ok(target.x + target.w <= viewport.width + 1e-8 && target.y + target.h <= viewport.height - viewport.safeBottom + 1e-8, JSON.stringify({ viewport, state, target }));
      }
    }
    game.activate('zuma:help'); const help = game.render(context()); assert.deepEqual(help.map(target => target.action), ['zuma:help-close']);
  }
});
