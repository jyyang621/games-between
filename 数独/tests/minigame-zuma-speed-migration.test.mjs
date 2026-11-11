import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRound } = require('../../微信小程序/src/games/zuma/state.js');
const { DIFFICULTIES, getCampaignLevel, getEndlessLevel } = require('../../微信小程序/src/games/zuma/levels.js');
const { createZumaSession, SAVE_KEY } = require('../../微信小程序/src/games/zuma/session.js');

function load(saved) {
  const storage = new Map([[SAVE_KEY, structuredClone(saved)]]);
  const session = createZumaSession({
    read: key => storage.get(key),
    write: (key, value) => { storage.set(key, structuredClone(value)); return true; },
    now: () => 998877,
  });
  return { session, storage };
}

function earlierRound(definition, score, legacyAmmo = false) {
  const previousDefinition = { ...definition, ...definition.previousMotion, wildcards: !legacyAmmo };
  const round = createRound(null, previousDefinition);
  round.model.start();
  // Preserve real seeded ammunition draws and an active projectile. Downward
  // shots begin below the launcher; the final one is saved before it moves.
  for (let index = 0; index < 5; index += 1) {
    assert.equal(round.model.fire(560, 700), true);
    round.model.step(0.2);
  }
  assert.equal(round.model.fire(560, 700), true);
  round.model.score = score;
  const snapshot = round.snapshot();
  assert.ok(snapshot.projectiles.length > 0);
  if (legacyAmmo) {
    const identity = JSON.parse(snapshot.configuration);
    delete identity.wildcards;
    snapshot.configuration = JSON.stringify(identity);
    delete snapshot.ammoSinceWildcard;
  }
  return { round, snapshot, definition };
}

function compareMigrated(model, earlier, legacyAmmo = false) {
  const { snapshot, definition } = earlier;
  for (const field of ['balls', 'projectiles', 'score', 'bestCombo', 'spawned', 'currentColor', 'nextColor', 'elapsed', 'accumulator', 'cooldown', 'nextId']) {
    assert.deepEqual(model[field], snapshot[field], field);
  }
  assert.deepEqual([...model.gapCombos], snapshot.gapCombos);
  assert.equal(model.status, 'paused');
  assert.equal(model.seed, definition.seed);
  assert.equal(model.ammoSinceWildcard, legacyAmmo ? 0 : snapshot.ammoSinceWildcard);
  for (const field of ['speed', 'maxSpeed', 'acceleration']) {
    assert.equal(model[field], definition[field], field);
    assert.ok(model[field] > definition.previousMotion[field], field + ' increased');
  }
  assert.ok(model.currentSpeed > earlier.round.model.currentSpeed * 1.99, 'The resumed board immediately uses the faster movement rules');
}

function compareWrittenSnapshot(actual, earlier, legacyAmmo = false) {
  const expected = { ...earlier.snapshot };
  delete expected.configuration;
  const actualState = { ...actual };
  const identity = JSON.parse(actualState.configuration);
  delete actualState.configuration;
  if (legacyAmmo) expected.ammoSinceWildcard = 0;
  assert.deepEqual(actualState, expected, 'Only the configuration and legacy ammo counter change during migration');
  for (const field of ['speed', 'maxSpeed', 'acceleration']) assert.equal(identity[field], earlier.definition[field]);
  assert.equal(identity.wildcards, true);
}

test('Zuma faster rules migrate real version 2 normal rounds and old no-rainbow identities without losing either mode', () => {
  const seed = 123456, wave = 8;
  const campaign = earlierRound(getCampaignLevel(2), 350, true);
  const endless = earlierRound(getEndlessLevel(wave, seed), 160, true);
  const { session, storage } = load({
    version: 2, mode: 'endless', unlocked: 4,
    campaign: { levelIndex: 2, best: 500, round: campaign.snapshot },
    endless: { wave, seed, totalScore: 700, credited: false, best: 900, bestWave: 7, round: endless.snapshot },
  });
  assert.equal(session.difficulty, 'normal'); assert.equal(session.mode, 'endless');
  assert.equal(session.wave, wave); assert.equal(session.score, 860); assert.equal(session.best, 900); assert.equal(session.bestWave, 7);
  compareMigrated(session.model, endless, true);
  session.selectMode('campaign');
  assert.equal(session.levelIndex, 2); assert.equal(session.unlocked, 4); assert.equal(session.best, 500); assert.equal(session.score, 350);
  compareMigrated(session.model, campaign, true);
  const migrated = storage.get(SAVE_KEY);
  assert.equal(migrated.version, 3);
  compareWrittenSnapshot(migrated.profiles.normal.campaign.round, campaign, true);
  compareWrittenSnapshot(migrated.profiles.normal.endless.round, endless, true);
  assert.equal(migrated.profiles.normal.endless.seed, seed);
  assert.equal(migrated.profiles.normal.endless.credited, false);
  session.selectDifficulty('easy'); assert.equal(session.unlocked, 0); assert.equal(session.best, 0);
});

function earlierProfiles() {
  const profiles = {}, rounds = {};
  for (let index = 0; index < DIFFICULTIES.length; index += 1) {
    const { id } = DIFFICULTIES[index], seed = 123000 + index, wave = 5 + index;
    const campaign = earlierRound(getCampaignLevel(index, id), 300 + index);
    const endless = earlierRound(getEndlessLevel(wave, seed, id), 80 + index);
    rounds[id] = { campaign, endless };
    profiles[id] = {
      unlocked: index + 1,
      campaign: { levelIndex: index, best: 800 + index, round: campaign.snapshot },
      endless: { wave, seed, totalScore: 500 + 100 * index, credited: false, best: 1000 + index, bestWave: wave - 1, round: endless.snapshot },
    };
  }
  return { saved: { version: 3, mode: 'endless', difficulty: 'hell', profiles }, rounds };
}

test('Zuma all eight earlier difficulty slots retain flight, RNG, ammo, unlocks and wave totals while adopting faster rules', () => {
  const { saved, rounds } = earlierProfiles();
  const { session, storage } = load(saved);
  assert.equal(session.difficulty, 'hell'); assert.equal(session.mode, 'endless');
  session.save();
  for (const { id } of DIFFICULTIES) {
    const profile = saved.profiles[id];
    session.selectDifficulty(id);
    for (const mode of ['campaign', 'endless']) {
      session.selectMode(mode);
      compareMigrated(session.model, rounds[id][mode]);
      assert.equal(session.best, profile[mode].best);
      if (mode === 'campaign') {
        assert.equal(session.unlocked, profile.unlocked); assert.equal(session.levelIndex, profile.campaign.levelIndex);
      } else {
        assert.equal(session.wave, profile.endless.wave); assert.equal(session.bestWave, profile.endless.bestWave);
        assert.equal(session.score, profile.endless.totalScore + profile.endless.round.score);
      }
      const written = storage.get(SAVE_KEY).profiles[id][mode];
      compareWrittenSnapshot(written.round, rounds[id][mode]);
      if (mode === 'endless') {
        assert.equal(written.seed, profile.endless.seed); assert.equal(written.credited, false); assert.equal(written.totalScore, profile.endless.totalScore);
      }
      // Counted draws remain at exactly the same point after reconstructing
      // the seeded sequence, even though movement now follows the new speed.
      for (let draw = 0; draw < 40; draw += 1) assert.equal(session.model.random(), rounds[id][mode].round.model.random());
    }
  }
});

test('Zuma migrated completed endless waves retain credited totals through switching, reload and advancing', () => {
  const { saved } = earlierProfiles(), profile = saved.profiles.hard;
  const cleared = profile.endless.round;
  cleared.status = 'won'; cleared.score = 170; cleared.balls = []; cleared.projectiles = [];
  cleared.spawned = getEndlessLevel(profile.endless.wave, profile.endless.seed, 'hard').totalBalls;
  cleared.gapCombos = [];
  profile.endless.totalScore = 990; profile.endless.credited = true; profile.endless.best = 1000; profile.endless.bestWave = profile.endless.wave;
  saved.difficulty = 'hard';
  const { session, storage } = load(saved);
  for (let index = 0; index < 4; index += 1) {
    session.save(); assert.equal(session.score, 990); assert.equal(session.model.status, 'won');
    session.selectDifficulty('normal'); session.selectDifficulty('hard');
  }
  const reloaded = load(storage.get(SAVE_KEY)).session;
  assert.equal(reloaded.score, 990); assert.equal(reloaded.bestWave, profile.endless.wave);
  assert.equal(reloaded.next(), true); assert.equal(reloaded.wave, profile.endless.wave + 1); assert.equal(reloaded.score, 990);
  const next = getEndlessLevel(reloaded.wave, profile.endless.seed, 'hard');
  assert.equal(reloaded.model.speed, next.speed); assert.equal(reloaded.model.maxSpeed, next.maxSpeed);
  assert.equal(reloaded.model.seed, next.seed); assert.equal(reloaded.model.status, 'ready');
});

test('Zuma old-speed migration rejects unknown or partial movement changes and foreign physical rules', () => {
  const current = getCampaignLevel(3, 'hard'), earlier = earlierRound(current, 220);
  const identity = JSON.parse(earlier.snapshot.configuration);
  const mutations = [
    value => { value.speed += 0.001; },
    value => { value.maxSpeed += 0.001; },
    value => { value.acceleration += 0.001; },
    value => { value.speed = current.speed; },
    value => { value.trackPoints[0].x += 1; },
    value => { value.seed += 1; },
    value => { value.totalBalls += 1; },
    value => { value.wildcards = false; },
    value => { value.dangerSlowdown = true; },
  ];
  for (const mutate of mutations) {
    const foreign = structuredClone(earlier.snapshot), configuration = structuredClone(identity);
    mutate(configuration); foreign.configuration = JSON.stringify(configuration);
    const restored = createRound(foreign, current);
    assert.equal(restored.restored, false, foreign.configuration);
    assert.equal(restored.model.status, 'ready'); assert.equal(restored.model.score, 0);
    assert.equal(restored.model.speed, current.speed);
  }
});

test('Zuma damaged old-speed slots reset only their own round while preserving valid modes and records', () => {
  for (const corrupt of [
    identity => { identity.trackPoints[0].x += 10; },
    identity => { identity.maxSpeed += 0.01; },
  ]) {
    const { saved, rounds } = earlierProfiles();
    const target = saved.profiles.hard.campaign;
    const identity = JSON.parse(target.round.configuration); corrupt(identity); target.round.configuration = JSON.stringify(identity);
    saved.difficulty = 'hard'; saved.mode = 'campaign';
    const { session } = load(saved);
    assert.equal(session.model.status, 'ready'); assert.equal(session.score, 0);
    assert.equal(session.levelIndex, target.levelIndex); assert.equal(session.best, target.best); assert.equal(session.unlocked, saved.profiles.hard.unlocked);
    session.selectMode('endless'); compareMigrated(session.model, rounds.hard.endless);
    session.selectDifficulty('hell'); compareMigrated(session.model, rounds.hell.endless);
    session.selectMode('campaign'); compareMigrated(session.model, rounds.hell.campaign);
  }
});

test('Zuma a resumed old-speed round advances using the new ramp rather than reverting after save and reload', () => {
  const { saved } = earlierProfiles(); saved.difficulty = 'normal'; saved.mode = 'campaign';
  const { session, storage } = load(saved), definition = session.definition;
  const elapsed = session.model.elapsed;
  session.model.resume(); session.step(0.05); session.save();
  assert.ok(session.model.elapsed > elapsed);
  assert.equal(session.model.currentSpeed, Math.min(definition.maxSpeed, definition.speed + definition.acceleration * session.model.elapsed));
  const reloaded = load(storage.get(SAVE_KEY)).session;
  assert.equal(reloaded.model.elapsed, session.model.elapsed); assert.equal(reloaded.model.currentSpeed, session.model.currentSpeed);
  assert.deepEqual(reloaded.model.balls, session.model.balls); assert.deepEqual(reloaded.model.projectiles, session.model.projectiles);
  assert.equal(reloaded.model.speed, definition.speed); assert.equal(reloaded.model.acceleration, definition.acceleration);
});
