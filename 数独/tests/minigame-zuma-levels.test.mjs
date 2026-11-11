import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DIFFICULTIES, getDifficulty, CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel } = require('../../微信小程序/src/games/zuma/levels.js');
const { GameModel, DIAMETER, FIXED_STEP, SHOOTER } = require('../../微信小程序/src/games/zuma/core/model.js');
const { Track, TRACK_CONTROL_POINTS } = require('../../微信小程序/src/games/zuma/core/track.js');

function cross(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function intersects(a, b, c, d) { return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0; }
function advance(model, seconds, cadence = FIXED_STEP) {
  for (let tick = 0; tick < Math.round(seconds / cadence); tick += 1) model.step(cadence);
}

test('Zuma campaign contains six distinct usable routes while preserving the original first stage', () => {
  assert.equal(CAMPAIGN_LEVELS.length, 6);
  assert.equal(new Set(CAMPAIGN_LEVELS.map(level => level.id)).size, 6);
  assert.equal(new Set(CAMPAIGN_LEVELS.map(level => JSON.stringify(level.trackPoints))).size, 6);
  assert.deepEqual(CAMPAIGN_LEVELS[0].trackPoints, TRACK_CONTROL_POINTS);
  assert.equal(CAMPAIGN_LEVELS[0].seed, 74219);
  assert.equal(CAMPAIGN_LEVELS[0].totalBalls, 78);
  for (const index of [-1, 0.5, NaN, Infinity, 6, 100]) assert.equal(getCampaignLevel(index), null);
  for (let index = 0; index < 6; index += 1) {
    const level = getCampaignLevel(index);
    const model = new GameModel(level);
    assert.equal(level.trackPoints, CAMPAIGN_LEVELS[index].trackPoints);
    assert.equal(level.seed, CAMPAIGN_LEVELS[index].seed);
    assert.ok(level.speed < level.maxSpeed && level.maxSpeed <= 50 * getDifficulty('normal').speedMultiplier);
    assert.ok(level.totalBalls >= 78 && level.totalBalls <= 120);
    assert.ok(model.track.length > 2400, level.id + ' gives the initial chain a reaction runway');
    const samples = model.track.samples;
    for (const point of samples) {
      assert.ok(Math.hypot(point.x - SHOOTER.x, point.y - SHOOTER.y) >= 95, level.id + ' keeps the launcher clear');
      assert.ok(point.x >= (index === 0 ? -30 : 25) && point.x <= 1095, level.id + ' horizontal bounds');
      assert.ok(point.y >= 25 && point.y <= 675, level.id + ' vertical bounds');
    }
    for (let a = 0; a < samples.length - 1; a += 1) {
      for (let b = a + 3; b < samples.length - 1; b += 1) {
        assert.equal(intersects(samples[a], samples[a + 1], samples[b], samples[b + 1]), false, level.id + ' has no self crossings');
      }
    }
  }
});

test('Zuma core retains its legacy constant-speed defaults and explicit high-speed fixtures', () => {
  const normal = new GameModel(), stationary = new GameModel({ speed: 0 }), fast = new GameModel({ speed: 14400 });
  for (const model of [normal, stationary, fast]) { model.elapsed = 100000; model.start(); }
  assert.equal(normal.currentSpeed, 26);
  assert.equal(stationary.currentSpeed, 0);
  assert.equal(fast.currentSpeed, 14400);
  const tracked = fast.balls[0], before = tracked.s;
  fast.step(FIXED_STEP);
  assert.ok(Math.abs(tracked.s - before - 120) < 1e-8);
});

test('Zuma stage speed grows with active play and respects its cap inside fixed-step movement', () => {
  const model = new GameModel({ speed: 26, maxSpeed: 34, acceleration: 8, totalBalls: 1 });
  model.start();
  let previous = model.currentSpeed;
  for (let frame = 0; frame < 240; frame += 1) {
    model.step(FIXED_STEP);
    assert.ok(model.currentSpeed >= previous && model.currentSpeed <= 34);
    previous = model.currentSpeed;
  }
  assert.equal(model.currentSpeed, 34);
  // First second integrates 120 increasing speed samples; the second stays at 34.
  assert.ok(Math.abs(model.balls[0].s - (30 + 4 / 120 + 34)) < 1e-7);
  model.restart();
  assert.equal(model.currentSpeed, 26);
  assert.equal(model.elapsed, 0);
});

test('Zuma acceleration pauses and remains independent of render cadence or elapsed-state restoration', () => {
  const definition = getCampaignLevel(4);
  const first = new GameModel(definition), second = new GameModel(definition);
  first.start(); second.start();
  advance(first, 4, FIXED_STEP); advance(second, 4, 1 / 30);
  assert.deepEqual(second.balls, first.balls);
  assert.equal(second.currentSpeed, first.currentSpeed);
  assert.equal(second.elapsed, first.elapsed);
  first.pause();
  const frozen = { elapsed: first.elapsed, speed: first.currentSpeed, balls: structuredClone(first.balls) };
  first.step(60);
  assert.deepEqual({ elapsed: first.elapsed, speed: first.currentSpeed, balls: first.balls }, frozen);
  first.resume(); first.step(FIXED_STEP);
  assert.ok(first.currentSpeed > frozen.speed);
  const restored = new GameModel(definition);
  restored.elapsed = first.elapsed;
  restored.balls = structuredClone(first.balls);
  assert.equal(restored.currentSpeed, first.currentSpeed);
});

test('Zuma endless danger zone smoothly creates a reaction window without changing recall speed', () => {
  const model = new GameModel({ totalBalls: 1, speed: 40, maxSpeed: 48, acceleration: 0.1, dangerSlowdown: true });
  model.balls = [{ id: 1, color: 0, s: model.track.length * 0.78 }];
  assert.ok(Math.abs(model.currentSpeed - 40) < 1e-9);
  model.balls[0].s = model.track.length * 0.865;
  assert.ok(Math.abs(model.currentSpeed - 31.6) < 1e-9);
  model.balls[0].s = model.track.length * 0.95;
  assert.ok(Math.abs(model.currentSpeed - 23.2) < 1e-9);
  model.elapsed = 10000;
  assert.ok(Math.abs(model.currentSpeed - 27.84) < 1e-9);
  model.balls = [{ id: 1, color: 0, s: 100 }, { id: 2, color: 0, s: model.track.length * 0.96 }];
  model.spawned = model.totalBalls;
  const front = model.balls[1].s;
  model.start(); model.step(FIXED_STEP);
  assert.ok(Math.abs(model.balls[1].s - (front - 190 * FIXED_STEP)) < 1e-8);
  assert.ok(model.balls[1].s - model.balls[0].s > DIAMETER);
});

test('Zuma endless rotates routes with deterministic session seeds and constant bounded wave parameters', () => {
  const settings = getDifficulty('normal');
  let previousSpeed = 0, previousCount = 0;
  for (const wave of [1, 2, 6, 7, 12, 60, 1000, 1000000, Number.MAX_SAFE_INTEGER, 1e200]) {
    const definition = getEndlessLevel(wave, 47291);
    assert.deepEqual(definition, getEndlessLevel(wave, 47291));
    assert.ok(definition.speed >= previousSpeed && definition.speed <= 40 * settings.speedMultiplier);
    assert.ok(definition.totalBalls >= previousCount && definition.totalBalls <= 126);
    assert.ok(definition.maxSpeed <= settings.endlessSpeedCap);
    assert.ok(definition.acceleration > 0);
    assert.equal(definition.dangerSlowdown, true);
    assert.ok(Number.isInteger(definition.seed) && definition.seed >= 0 && definition.seed <= 0xffffffff);
    assert.equal(definition.trackPoints.length <= 18, true);
    previousSpeed = definition.speed; previousCount = definition.totalBalls;
    const model = new GameModel(definition);
    model.elapsed = 1e10;
    assert.ok(Number.isFinite(model.currentSpeed) && model.currentSpeed <= settings.endlessSpeedCap);
  }
  assert.equal(getEndlessLevel(1).trackPoints, getEndlessLevel(7).trackPoints);
  assert.notEqual(getEndlessLevel(1, 123).seed, getEndlessLevel(1, 124).seed);
  assert.notEqual(getEndlessLevel(1, 123).seed, getEndlessLevel(7, 123).seed);
  assert.deepEqual(getEndlessLevel(NaN), getEndlessLevel(1));
});

test('Zuma difficulty settings are immutable and invalid choices use the accelerated normal parameters', () => {
  assert.ok(Object.isFrozen(DIFFICULTIES));
  assert.deepEqual(DIFFICULTIES.map(difficulty => difficulty.id), ['easy', 'normal', 'hard', 'hell']);
  assert.deepEqual(DIFFICULTIES.map(difficulty => difficulty.title), ['简单', '中等', '困难', '地狱']);
  assert.deepEqual(DIFFICULTIES.map(difficulty => difficulty.speedMultiplier), [1.6, 2.2, 3, 4.2]);
  assert.deepEqual(DIFFICULTIES.map(difficulty => difficulty.ballMultiplier), [0.8, 1, 1.15, 1.3]);
  assert.deepEqual(DIFFICULTIES.map(difficulty => difficulty.endlessSpeedCap), [76.8, 105.6, 140, 192]);
  for (const difficulty of DIFFICULTIES) {
    assert.ok(Object.isFrozen(difficulty));
    assert.equal(getDifficulty(difficulty.id), difficulty);
  }
  for (const invalid of [undefined, null, '', 'impossible', 0, {}, []]) {
    assert.equal(getDifficulty(invalid), DIFFICULTIES[1]);
    assert.deepEqual(getCampaignLevel(0, invalid), getCampaignLevel(0, 'normal'));
    assert.deepEqual(getEndlessLevel(12, 5739, invalid), getEndlessLevel(12, 5739, 'normal'));
  }
  for (const [index, definition] of CAMPAIGN_LEVELS.entries()) {
    assert.equal(getCampaignLevel(index, 'normal').speed, definition.speed * 2.2);
    assert.equal(definition.speed, [26, 29, 32, 35, 38, 41][index]);
    assert.equal(definition.maxSpeed, [34, 37, 40, 43, 47, 50][index]);
    assert.equal(definition.totalBalls, [78, 86, 94, 102, 112, 120][index]);
    assert.equal(definition.wildcards, true);
  }
});

test('Zuma all six campaign stages scale speed and population monotonically across four difficulties', () => {
  for (let stage = 0; stage < CAMPAIGN_LEVELS.length; stage += 1) {
    const base = CAMPAIGN_LEVELS[stage];
    let previous = null;
    for (const settings of DIFFICULTIES) {
      const definition = getCampaignLevel(stage, settings.id);
      assert.equal(definition.difficulty, settings.id);
      assert.equal(definition.speed, base.speed * settings.speedMultiplier);
      assert.equal(definition.maxSpeed, base.maxSpeed * settings.speedMultiplier);
      assert.equal(definition.acceleration, base.acceleration * settings.speedMultiplier);
      assert.equal(definition.totalBalls, Math.round(base.totalBalls * settings.ballMultiplier));
      assert.equal(definition.trackPoints, base.trackPoints);
      assert.equal(definition.seed, base.seed);
      assert.equal(definition.wildcards, true);
      if (previous) {
        assert.ok(definition.speed > previous.speed);
        assert.ok(definition.maxSpeed > previous.maxSpeed);
        assert.ok(definition.acceleration > previous.acceleration);
        assert.ok(definition.totalBalls > previous.totalBalls);
      }
      previous = definition;
    }
  }
});

test('Zuma every endless difficulty retains finite-wave bounds and danger slowing at extreme wave numbers', () => {
  for (const settings of DIFFICULTIES) {
    let previousSpeed = 0, previousCount = 0;
    for (const wave of [1, 2, 12, 60, 1000000, Number.MAX_SAFE_INTEGER, 1e200]) {
      const definition = getEndlessLevel(wave, 9137, settings.id);
      const normal = getEndlessLevel(wave, 9137, 'normal');
      const normalizedWave = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(wave)));
      const progress = 1 - Math.exp(-(normalizedWave - 1) / 12);
      const baseSpeed = 27 + 13 * progress;
      const basePopulation = Math.min(126, 78 + Math.floor(48 * progress));
      assert.equal(definition.difficulty, settings.id);
      assert.equal(definition.speed, baseSpeed * settings.speedMultiplier);
      assert.equal(definition.totalBalls, Math.round(basePopulation * settings.ballMultiplier));
      assert.equal(definition.acceleration, 0.10 * settings.speedMultiplier);
      assert.equal(definition.seed, normal.seed);
      assert.ok(definition.speed >= previousSpeed);
      assert.ok(definition.totalBalls >= previousCount);
      assert.ok(definition.totalBalls <= Math.round(126 * settings.ballMultiplier));
      assert.ok(definition.maxSpeed <= settings.endlessSpeedCap);
      assert.equal(definition.dangerSlowdown, true);
      assert.equal(definition.wildcards, true);
      const model = new GameModel(definition);
      model.elapsed = 1e10;
      assert.ok(Number.isFinite(model.currentSpeed));
      assert.ok(model.currentSpeed <= settings.endlessSpeedCap);
      const safeSpeed = model.currentSpeed;
      model.balls = [{ id: 1, color: 0, s: model.track.length * 0.96 }];
      assert.ok(Math.abs(model.currentSpeed - safeSpeed * 0.58) < 1e-9);
      previousSpeed = definition.speed; previousCount = definition.totalBalls;
    }
  }
  for (const wave of [1, 60, Number.MAX_SAFE_INTEGER]) {
    const definitions = DIFFICULTIES.map(settings => getEndlessLevel(wave, 9137, settings.id));
    for (let index = 1; index < definitions.length; index += 1) {
      assert.ok(definitions[index].speed > definitions[index - 1].speed);
      assert.ok(definitions[index].maxSpeed > definitions[index - 1].maxSpeed);
      assert.ok(definitions[index].totalBalls > definitions[index - 1].totalBalls);
    }
  }
});

test('Zuma new speed settings are at least twice their previous difficulty while exposing exact migration rules', () => {
  const previousFactors = [0.8, 1, 1.2, 1.4];
  const previousCaps = [38.4, 48, 56, 64];
  for (const [index, settings] of DIFFICULTIES.entries()) {
    for (const [stage, base] of CAMPAIGN_LEVELS.entries()) {
      const definition = getCampaignLevel(stage, settings.id);
      const previousMotion = {
        speed: base.speed * previousFactors[index],
        maxSpeed: base.maxSpeed * previousFactors[index],
        acceleration: base.acceleration * previousFactors[index],
      };
      assert.deepEqual(definition.previousMotion, previousMotion);
      assert.ok(definition.speed >= previousMotion.speed * 2);
      assert.ok(definition.maxSpeed >= previousMotion.maxSpeed * 2);
      assert.ok(definition.acceleration >= previousMotion.acceleration * 2);
    }
    for (const wave of [1, 12, 60, 1000000, Number.MAX_SAFE_INTEGER]) {
      const progress = 1 - Math.exp(-(wave - 1) / 12);
      const oldSpeed = 27 + 13 * progress;
      const definition = getEndlessLevel(wave, 998731, settings.id);
      assert.deepEqual(definition.previousMotion, {
        speed: oldSpeed * previousFactors[index],
        maxSpeed: Math.min(previousCaps[index], Math.min(48, oldSpeed + 8) * previousFactors[index]),
        acceleration: 0.10 * previousFactors[index],
      });
      assert.ok(definition.speed >= definition.previousMotion.speed * 2);
      assert.ok(definition.maxSpeed >= definition.previousMotion.maxSpeed * 2);
    }
  }
});
