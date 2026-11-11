import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GameModel, SHOOTER, DIAMETER, findConnectedRun, sweptCircleHit } = require('../../微信小程序/src/games/zuma/core/model.js');
const { DIFFICULTIES, CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel } = require('../../微信小程序/src/games/zuma/levels.js');

// A deterministic playability smoke test, not a guarantee that every playing
// style or every ammunition seed can win. The bot only observes the board and
// uses the real start/swap/fire/step methods. It never edits simulation state,
// injects ammunition, teleports shots, or awards itself clears.
function targetFor(model, color) {
  const wildcard = color === 4;
  let best = null;
  for (let index = 0; index < model.balls.length; index += 1) {
    const ball = model.balls[index];
    if (!wildcard && ball.color !== color) continue;
    const point = model.track.pointAt(ball.s);
    let aim = point, flight = 0;
    // Recompute arrival time along the actual curve. Tangent extrapolation can
    // point off-track at the new high speeds, especially on compact bends.
    for (let iteration = 0; iteration < 4; iteration += 1) {
      flight = Math.max(0, Math.hypot(aim.x - SHOOTER.x, aim.y - SHOOTER.y) - 44) / 1080;
      aim = model.track.pointAt(ball.s + model.currentSpeed * Math.min(0.8, flight));
    }
    const distanceToAim = Math.hypot(aim.x - SHOOTER.x, aim.y - SHOOTER.y);
    const direction = { x: (aim.x - SHOOTER.x) / distanceToAim, y: (aim.y - SHOOTER.y) / distanceToAim };
    let first = null, distance = Infinity;
    for (let other = 0; other < model.balls.length; other += 1) {
      const obstruction = model.balls[other];
      let obstructionPoint = model.track.pointAt(obstruction.s);
      // Earlier obstructions reach the shot line before the chosen target.
      // Estimate each one's arrival separately rather than testing its present
      // position against a future aim point.
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const along = (obstructionPoint.x - SHOOTER.x) * direction.x + (obstructionPoint.y - SHOOTER.y) * direction.y;
        const arrival = Math.max(0, Math.min(0.8, (along - 44) / 1080));
        obstructionPoint = model.track.pointAt(obstruction.s + model.currentSpeed * arrival);
      }
      const hit = sweptCircleHit(SHOOTER, aim, obstructionPoint, DIAMETER);
      if (hit !== null && hit < distance) { distance = hit; first = other; }
    }
    if (first === null || (!wildcard && model.balls[first].color !== color)) continue;
    const run = findConnectedRun(model.balls, first);
    const count = run.end - run.start + 1;
    const priority = (count >= 2 ? 100 : 0) + count * 12 + model.balls[first].s / model.track.length * 10;
    if (!best || priority > best.priority) best = { ...aim, priority };
  }
  return best;
}

function simulate(definition) {
  const model = new GameModel(definition);
  model.start();
  const shotTimes = [];
  let wait = 0, highestSpeed = model.currentSpeed;
  for (let frame = 0; frame < 60 * 420 && model.status === 'playing'; frame += 1) {
    if (wait <= 0) {
      const current = targetFor(model, model.currentColor), next = targetFor(model, model.nextColor);
      let target = current;
      if (next && (!current || next.priority > current.priority)) { model.swap(); target = next; }
      if (target && model.fire(target.x, target.y)) { shotTimes.push(model.elapsed); wait = 0.35; }
      else wait = 0.08;
    }
    model.step(1 / 60);
    highestSpeed = Math.max(highestSpeed, model.currentSpeed);
    wait -= 1 / 60;
  }
  return { model, shotTimes, highestSpeed };
}

const definitions = DIFFICULTIES.flatMap(difficulty => [
  ...CAMPAIGN_LEVELS.map((_, index) => getCampaignLevel(index, difficulty.id)),
  ...[1, 12, 60, 1000000].map(wave => getEndlessLevel(wave, 998731, difficulty.id)),
]);

for (const definition of definitions) {
  test('Zuma deterministic playability smoke clears ' + definition.difficulty + ' ' + definition.id + ' with normal shots', () => {
    const { model, shotTimes, highestSpeed } = simulate(definition);
    const details = JSON.stringify({ difficulty: definition.difficulty, id: definition.id, status: model.status, seconds: model.elapsed, shots: shotTimes.length, remaining: model.balls.length });
    assert.equal(model.status, 'won', details);
    assert.ok(model.elapsed <= 420 + 1e-8, details);
    assert.ok(shotTimes.length > 0, details);
    for (let index = 1; index < shotTimes.length; index += 1) {
      assert.ok(shotTimes[index] - shotTimes[index - 1] >= 0.35 - 1e-8, 'Bot must leave at least 0.35 active seconds between shots');
    }
    assert.ok(shotTimes.length <= Math.floor((model.elapsed + 1e-8) / 0.35) + 1, details);
    assert.ok(highestSpeed <= definition.maxSpeed, details);
    assert.equal(model.spawned, definition.totalBalls, details);
    assert.equal(model.balls.length, 0, details);
  });
}
