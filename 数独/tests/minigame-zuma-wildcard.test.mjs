import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  GameModel, DIAMETER, FIXED_STEP, WILD_COLOR, WILD_CHANCE, WILD_MIN_NORMAL_AMMO,
} = require('../../微信小程序/src/games/zuma/core/model.js');
const { createRound } = require('../../微信小程序/src/games/zuma/state.js');
const { getCampaignLevel } = require('../../微信小程序/src/games/zuma/levels.js');

const SHOOTING_GALLERY = {
  seed: 731, totalBalls: 24, speed: 0, wildcards: true,
  trackPoints: [{ x: 0, y: 100 }, { x: 1120, y: 100 }],
};

// The stationary chain stays above the launcher; downward shots miss it and
// leave the board naturally. A single long round exercises the public ammo
// pipeline without resetting its spacing counter or calling private pickColor.
function shootDown(model) {
  assert.equal(model.fire(560, 700), true);
  model.step(0.2);
}

function fixture(colors, positions) {
  const model = new GameModel(SHOOTING_GALLERY);
  model.start();
  model.spawned = model.totalBalls;
  model.balls = colors.map((color, index) => ({ id: 100 + index, color, s: positions?.[index] ?? 420 + index * DIAMETER }));
  model.nextId = 1000;
  return model;
}

function hit(model, index, color = WILD_COLOR) {
  const point = model.track.pointAt(model.balls[index].s);
  const tangent = model.track.tangentAt(model.balls[index].s);
  model.projectiles.push({
    id: model.nextId++, color,
    x: point.x - tangent.y * 150, y: point.y + tangent.x * 150,
    vx: tangent.y * 36000, vy: -tangent.x * 36000,
  });
  return model.step(FIXED_STEP);
}

test('Zuma rainbow ammo is rare, spaced by eight normal rounds and uses one random draw per refill', () => {
  assert.equal(WILD_COLOR, 4);
  assert.equal(WILD_CHANCE, 0.04);
  assert.equal(WILD_MIN_NORMAL_AMMO, 8);
  const model = new GameModel(SHOOTING_GALLERY);
  const initialChain = structuredClone(model.balls);
  const ammunition = [model.currentColor, model.nextColor];
  let draws = 0;
  const random = model.random;
  model.random = () => { draws += 1; return random(); };
  model.start();
  for (let shot = 0; shot < 6000; shot += 1) {
    shootDown(model);
    ammunition.push(model.nextColor);
  }
  assert.equal(draws, 6000, 'One refill consumes one random roll, including rainbow eligibility rolls');
  assert.equal(model.status, 'playing');
  assert.equal(model.score, 0);
  assert.deepEqual(model.balls, initialChain, 'Missed shots do not change the stationary chain');
  let ordinary = 0, eligibleRolls = 0, rainbows = 0;
  for (const color of ammunition) {
    if (ordinary >= WILD_MIN_NORMAL_AMMO) eligibleRolls += 1;
    if (color === WILD_COLOR) {
      assert.ok(ordinary >= WILD_MIN_NORMAL_AMMO, 'Each rainbow follows at least eight generated normal ammo');
      ordinary = 0;
      rainbows += 1;
    } else {
      assert.ok(Number.isInteger(color) && color >= 0 && color <= 3);
      ordinary += 1;
    }
  }
  assert.ok(rainbows / ammunition.length > 0.02 && rainbows / ammunition.length < 0.04, 'Spacing makes overall rainbow frequency lower than the eligible-roll probability');
  assert.ok(rainbows / eligibleRolls > 0.03 && rainbows / eligibleRolls < 0.05, 'Eligible draws follow the rare four-percent roll');
  assert.equal(model.ammoSinceWildcard, Math.min(WILD_MIN_NORMAL_AMMO, ordinary));
});

test('Zuma default core keeps four-color ammo while actual campaign definitions enable rainbows', () => {
  const definition = { ...SHOOTING_GALLERY };
  delete definition.wildcards;
  const model = new GameModel(definition);
  assert.equal(model.wildcards, false);
  model.start();
  for (let shot = 0; shot < 1000; shot += 1) {
    assert.ok(model.currentColor >= 0 && model.currentColor <= 3);
    assert.ok(model.nextColor >= 0 && model.nextColor <= 3);
    shootDown(model);
  }
  assert.equal(getCampaignLevel(0).wildcards, true);
});

test('Zuma rainbow shots complete connected pairs in each normal color and leave no fifth-color chain', () => {
  for (let color = 0; color < 4; color += 1) {
    const model = fixture([color, color]);
    const events = hit(model, 0);
    assert.equal(model.status, 'won');
    assert.equal(model.score, 30);
    assert.equal(model.balls.length, 0);
    assert.deepEqual(events.filter(event => event.type === 'pop').map(event => [event.color, event.count]), [[color, 3]]);
  }
});

test('Zuma rainbow picks the largest touching run, with ties favoring the hit color', () => {
  const best = fixture([0, 1, 1]);
  hit(best, 0);
  assert.equal(best.score, 30);
  assert.deepEqual(best.balls.map(ball => ball.color), [0]);
  const tie = fixture([0, 1]);
  hit(tie, 0);
  assert.equal(tie.score, 0);
  assert.deepEqual(tie.balls.map(ball => ball.color), [0, 0, 1]);
});

test('Zuma rainbow adopts a normal color without removing a lone neighbor or crossing a physical gap', () => {
  for (let color = 0; color < 4; color += 1) {
    const lone = fixture([color]);
    hit(lone, 0);
    assert.equal(lone.score, 0);
    assert.deepEqual(lone.balls.map(ball => ball.color), [color, color]);
  }
  const separated = fixture([2, 2], [420, 560]);
  hit(separated, 0);
  assert.equal(separated.score, 0);
  assert.equal(separated.balls.length, 3);
  assert.ok(separated.balls[2].s - separated.balls[1].s > DIAMETER);
  const remotePair = fixture([0, 1, 1], [420, 560, 594]);
  hit(remotePair, 0);
  assert.equal(remotePair.score, 0);
  assert.deepEqual(remotePair.balls.map(ball => ball.color), [0, 0, 1, 1]);
});

test('Zuma ammo refresh and swapping preserve stored rainbows without rerolling for extra ones', () => {
  const model = fixture([3]);
  model.currentColor = WILD_COLOR;
  model.nextColor = WILD_COLOR;
  const spacing = model.ammoSinceWildcard;
  let draws = 0;
  const random = model.random;
  model.random = () => { draws += 1; return random(); };
  for (let index = 0; index < 120; index += 1) {
    model.swap();
    model.step(FIXED_STEP);
  }
  assert.equal(model.currentColor, WILD_COLOR);
  assert.equal(model.nextColor, WILD_COLOR);
  assert.equal(model.ammoSinceWildcard, spacing);
  assert.equal(draws, 0);
  model.nextColor = 3;
  model.swap();
  assert.equal(model.currentColor, 3);
  assert.equal(model.nextColor, WILD_COLOR);
  model.swap();
  assert.equal(model.currentColor, WILD_COLOR);
  assert.equal(model.nextColor, 3);
  assert.equal(draws, 0);
});

for (const position of ['current', 'next', 'inflight']) {
  test('Zuma snapshots restore ' + position + ' rainbow ammo, spacing and future random shots exactly', () => {
    const round = createRound(undefined, SHOOTING_GALLERY);
    round.model.start();
    let found = false;
    for (let shot = 0; shot < 1000; shot += 1) {
      if ((position === 'next' ? round.model.nextColor : round.model.currentColor) === WILD_COLOR) { found = true; break; }
      shootDown(round.model);
    }
    assert.equal(found, true);
    if (position === 'inflight') {
      assert.equal(round.model.fire(560, 700), true);
      assert.ok(round.model.projectiles.some(shot => shot.color === WILD_COLOR));
    }
    const saved = round.snapshot();
    const loaded = createRound(structuredClone(saved), SHOOTING_GALLERY);
    assert.equal(loaded.restored, true);
    assert.equal(loaded.model.status, 'paused');
    assert.deepEqual(loaded.snapshot(), saved);
    loaded.model.resume();
    // Advance any cooldown and existing projectile naturally before the next shot.
    round.model.step(0.2); loaded.model.step(0.2);
    for (let shot = 0; shot < 200; shot += 1) {
      shootDown(round.model); shootDown(loaded.model);
    }
    assert.deepEqual(loaded.snapshot(), round.snapshot());
  });
}

test('Zuma snapshots from before rainbow support retain their normal board and upgrade the configuration', () => {
  const previousDefinition = { ...SHOOTING_GALLERY, wildcards: false };
  const previous = createRound(undefined, previousDefinition);
  previous.model.start();
  for (let shot = 0; shot < 25; shot += 1) shootDown(previous.model);
  const saved = previous.snapshot();
  const identity = JSON.parse(saved.configuration);
  delete identity.wildcards;
  saved.configuration = JSON.stringify(identity);
  delete saved.ammoSinceWildcard;
  const loaded = createRound(saved, SHOOTING_GALLERY);
  assert.equal(loaded.restored, true);
  assert.equal(loaded.model.status, 'paused');
  for (const key of ['balls', 'projectiles', 'currentColor', 'nextColor', 'score', 'spawned', 'elapsed', 'randomDraws']) {
    assert.deepEqual(loaded.snapshot()[key], saved[key], key);
  }
  assert.equal(loaded.model.wildcards, true);
  assert.equal(loaded.model.ammoSinceWildcard, 0);
  assert.equal(JSON.parse(loaded.snapshot().configuration).wildcards, true);
  loaded.model.resume();
  for (let shot = 0; shot < 100; shot += 1) shootDown(loaded.model);
  assert.equal(loaded.model.status, 'playing');
});
