/* Validated, deterministic snapshots for a configured Marble Trail round. */
'use strict';
const { GameModel, FIXED_STEP, WILD_COLOR, WILD_MIN_NORMAL_AMMO } = require('./core/model.js');
const { TRACK_CONTROL_POINTS } = require('./core/track.js');

const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const color = value => integer(value, 0, 3);

function configuration(model, definition) {
  // Include the physical rules, rather than display labels, in the identity.
  return JSON.stringify({
    seed: model.seed, totalBalls: model.totalBalls,
    trackPoints: definition.trackPoints || TRACK_CONTROL_POINTS,
    speed: model.speed, maxSpeed: model.maxSpeed === undefined ? model.speed : model.maxSpeed,
    acceleration: model.acceleration || 0, dangerSlowdown: model.dangerSlowdown || 0,
    wildcards: model.wildcards || false,
  });
}

function legacyCompatible(model, definition) {
  return model.seed === 74219 && model.totalBalls === 78 &&
    JSON.stringify(definition.trackPoints || TRACK_CONTROL_POINTS) === JSON.stringify(TRACK_CONTROL_POINTS);
}

function validSnapshot(value, model, definition) {
  if (!value || typeof value !== 'object' || !['ready', 'playing', 'paused', 'won', 'lost'].includes(value.status)) return false;
  let savedConfiguration = value.configuration;
  if (typeof savedConfiguration === 'string') {
    try {
      const previous = JSON.parse(savedConfiguration);
      if (previous && typeof previous === 'object' && !Array.isArray(previous)) {
        let migrated = false;
        // Only the explicitly known earlier speed settings can be upgraded;
        // seed, track, ball count and every other physical rule must still match.
        const earlier = definition.previousMotion;
        if (earlier && ['speed', 'maxSpeed', 'acceleration'].every(key => previous[key] === earlier[key])) {
          for (const key of ['speed', 'maxSpeed', 'acceleration']) previous[key] = model[key];
          migrated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(previous, 'wildcards')) { previous.wildcards = model.wildcards || false; migrated = true; }
        if (migrated) savedConfiguration = JSON.stringify(previous);
      }
    } catch { return false; }
  }
  if (savedConfiguration === undefined ? !legacyCompatible(model, definition) : savedConfiguration !== configuration(model, definition)) return false;
  const ammoColor = number => color(number) || (model.wildcards && number === WILD_COLOR);
  if (!integer(value.score, 0, 1e9) || !integer(value.bestCombo, 0, 10000) ||
      !integer(value.spawned, Math.min(22, model.totalBalls), model.totalBalls) || !ammoColor(value.currentColor) || !ammoColor(value.nextColor) ||
      !finite(value.elapsed, 0, 86400) || !finite(value.accumulator, -1e-8, FIXED_STEP + 1e-8) ||
      !finite(value.cooldown, 0, 0.2 + 1e-8) || !integer(value.nextId, 1, 1e7) || !integer(value.randomDraws, 0, 100000)) return false;
  if (value.ammoSinceWildcard !== undefined && !integer(value.ammoSinceWildcard, 0, WILD_MIN_NORMAL_AMMO)) return false;
  if (!Array.isArray(value.balls) || value.balls.length > 256 ||
      !Array.isArray(value.projectiles) || value.projectiles.length > 128 ||
      !Array.isArray(value.gapCombos) || value.gapCombos.length > 256) return false;
  const ids = new Set();
  for (const ball of value.balls) {
    if (!ball || !integer(ball.id, 1, value.nextId - 1) || !color(ball.color) ||
        !finite(ball.s, -1000, model.track.length + 1000) || ids.has(ball.id)) return false;
    ids.add(ball.id);
  }
  for (let index = 1; index < value.balls.length; index += 1) {
    if (value.balls[index].s < value.balls[index - 1].s) return false;
  }
  for (const shot of value.projectiles) {
    if (!shot || !integer(shot.id, 1, value.nextId - 1) || !ammoColor(shot.color) || ids.has(shot.id) ||
        !finite(shot.x, -100, 1220) || !finite(shot.y, -100, 800) ||
        !finite(shot.vx, -1100, 1100) || !finite(shot.vy, -1100, 1100)) return false;
    ids.add(shot.id);
  }
  const adjacent = new Set(value.balls.slice(1).map((ball, index) => value.balls[index].id + ':' + ball.id));
  const gapKeys = new Set();
  for (const entry of value.gapCombos) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
        !adjacent.has(entry[0]) || gapKeys.has(entry[0]) || !integer(entry[1], 1, 10000)) return false;
    gapKeys.add(entry[0]);
  }
  if (value.status === 'won' && (value.balls.length || value.spawned !== model.totalBalls)) return false;
  return true;
}

function createRound(saved, definition = {}) {
  const model = new GameModel(definition);
  let draws = 0;
  function trackRandom() {
    const seededRandom = model.random;
    draws = 0;
    model.random = () => { draws += 1; return seededRandom(); };
  }
  trackRandom();
  const restored = validSnapshot(saved, model, definition);
  if (restored) {
    for (let index = 0; index < saved.randomDraws; index += 1) model.random();
    for (const key of ['score', 'bestCombo', 'spawned', 'currentColor', 'nextColor', 'elapsed', 'accumulator', 'cooldown', 'nextId']) model[key] = saved[key];
    model.ammoSinceWildcard = saved.ammoSinceWildcard === undefined ? 0 : saved.ammoSinceWildcard;
    model.balls = saved.balls.map(ball => ({ id: ball.id, color: ball.color, s: ball.s }));
    model.projectiles = saved.projectiles.map(shot => ({ id: shot.id, color: shot.color, x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy }));
    model.gapCombos = new Map(saved.gapCombos);
    model.status = saved.status === 'playing' ? 'paused' : saved.status;
  }
  return {
    model, restored,
    restart() { model.restart(); trackRandom(); },
    snapshot() {
      return {
        configuration: configuration(model, definition),
        status: model.status === 'playing' ? 'paused' : model.status,
        score: model.score, bestCombo: model.bestCombo, spawned: model.spawned,
        currentColor: model.currentColor, nextColor: model.nextColor,
        elapsed: model.elapsed, accumulator: model.accumulator, cooldown: model.cooldown,
        nextId: model.nextId, randomDraws: draws,
        ammoSinceWildcard: model.ammoSinceWildcard,
        balls: model.balls.map(ball => ({ ...ball })), projectiles: model.projectiles.map(shot => ({ ...shot })),
        gapCombos: Array.from(model.gapCombos, entry => entry.slice()),
      };
    },
  };
}

module.exports = { createRound };
