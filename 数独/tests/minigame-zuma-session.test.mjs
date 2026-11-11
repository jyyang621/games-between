import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRound } = require('../../微信小程序/src/games/zuma/state.js');
const { createZumaSession, SAVE_KEY, MAX_WAVE } = require('../../微信小程序/src/games/zuma/session.js');
const { CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel } = require('../../微信小程序/src/games/zuma/levels.js');

function create(saved, timestamp = 123456789) {
  const storage = new Map(saved ? [[SAVE_KEY, structuredClone(saved)]] : []);
  const session = createZumaSession({ read: key => storage.get(key), write: (key, value) => { storage.set(key, structuredClone(value)); return true; }, now: () => timestamp });
  return { session, storage };
}
function win(session, score = 100) {
  session.model.score = score;
  session.model.balls = [];
  session.model.projectiles = [];
  session.model.spawned = session.model.totalBalls;
  session.model.status = 'won';
  session.step(0);
}
function exercise(session, count = 90) {
  for (let index = 0; index < count; index += 1) {
    if (index % 14 === 0) session.model.fire(100 + index * 5, 540);
    session.step(1 / 60);
  }
}

test('Zuma migrates a real version 1 round to campaign without changing future ammunition', () => {
  const old = createRound(); old.model.start();
  for (let index = 0; index < 50; index += 1) {
    if (index % 15 === 0) old.model.fire(900, 500);
    old.model.step(1 / 60);
  }
  old.model.score = 240;
  const snapshot = old.snapshot(); delete snapshot.configuration;
  const { session, storage } = create({ version: 1, best: 600, round: snapshot });
  assert.equal(session.mode, 'campaign'); assert.equal(session.levelIndex, 0);
  assert.equal(session.model.status, 'paused'); assert.equal(session.score, 240); assert.equal(session.best, 600);
  assert.deepEqual(session.model.balls, snapshot.balls); assert.deepEqual(session.model.projectiles, snapshot.projectiles);
  for (let index = 0; index < 40; index += 1) assert.equal(session.model.random(), old.model.random());
  session.save();
  assert.equal(storage.get(SAVE_KEY).version, 3); assert.equal(storage.get(SAVE_KEY).profiles.normal.campaign.best, 600);
});

test('Zuma unlocks all six campaign tracks in order and retains completed progress after reload', () => {
  const { session, storage } = create();
  assert.equal(CAMPAIGN_LEVELS.length, 6); assert.equal(session.unlocked, 0);
  assert.equal(session.startCampaign(1), false); assert.equal(session.startCampaign(-1), false);
  for (let index = 0; index < CAMPAIGN_LEVELS.length; index += 1) {
    assert.equal(session.levelIndex, index); assert.equal(session.definition.id, getCampaignLevel(index).id);
    assert.equal(session.model.status, 'ready');
    win(session, 100 + index * 20);
    assert.equal(session.unlocked, Math.min(index + 1, 5));
    assert.equal(session.next(), index < 5);
  }
  assert.equal(session.model.status, 'won'); assert.equal(session.best, 200);
  const restored = create(storage.get(SAVE_KEY)).session;
  assert.equal(restored.levelIndex, 5); assert.equal(restored.unlocked, 5); assert.equal(restored.model.status, 'won');
  assert.equal(restored.startCampaign(2), true); assert.equal(restored.model.status, 'ready'); assert.equal(restored.best, 200);
});

test('Zuma campaign and endless preserve independent rounds, points and records when modes change', () => {
  const { session, storage } = create();
  session.model.start(); exercise(session, 20); session.model.score = 350;
  const campaignBalls = structuredClone(session.model.balls), elapsed = session.model.elapsed;
  assert.equal(session.selectMode('unknown'), false); assert.equal(session.selectMode('campaign'), false);
  assert.equal(session.selectMode('endless'), true); assert.equal(session.best, 0); assert.equal(session.model.status, 'ready');
  session.model.start(); exercise(session, 30); session.model.score = 90;
  const endlessBalls = structuredClone(session.model.balls);
  assert.equal(session.selectMode('campaign'), true);
  assert.equal(session.best, 350); assert.equal(session.model.elapsed, elapsed); assert.equal(session.model.status, 'paused');
  assert.deepEqual(session.model.balls, campaignBalls);
  session.selectMode('endless'); assert.equal(session.best, 90); assert.deepEqual(session.model.balls, endlessBalls);
  const loaded = create(storage.get(SAVE_KEY)).session;
  assert.equal(loaded.mode, 'endless'); assert.equal(loaded.model.status, 'paused'); assert.equal(loaded.score, 90);
  loaded.selectMode('campaign'); assert.equal(loaded.best, 350); assert.deepEqual(loaded.model.balls, campaignBalls);
});

test('Zuma endless credits each completed wave once across next, save and reload', () => {
  const { session, storage } = create(); session.startEndless();
  win(session, 120); assert.equal(session.score, 120); assert.equal(session.bestWave, 1);
  const seed = storage.get(SAVE_KEY).profiles.normal.endless.seed;
  for (let index = 0; index < 5; index += 1) { session.step(1 / 60); session.save(); }
  assert.equal(session.score, 120);
  const loaded = create(storage.get(SAVE_KEY)).session;
  assert.equal(loaded.score, 120); assert.equal(loaded.model.status, 'won');
  loaded.save(); assert.equal(loaded.score, 120);
  assert.equal(loaded.next(), true); assert.equal(loaded.wave, 2); assert.equal(loaded.model.status, 'ready'); assert.equal(loaded.score, 120);
  assert.equal(loaded.definition.seed, getEndlessLevel(2, seed).seed);
  assert.equal(loaded.next(), false); win(loaded, 80);
  assert.equal(loaded.score, 200); assert.equal(loaded.best, 200); assert.equal(loaded.bestWave, 2);
  loaded.next(); assert.equal(loaded.score, 200); assert.equal(loaded.wave, 3);
});

test('Zuma endless defeat retains the record and restart begins a fresh first wave without reusable points', () => {
  const { session } = create(); session.startEndless();
  win(session, 100); session.next();
  session.model.score = 40; session.model.status = 'lost'; session.save();
  const seed = session.model.seed;
  assert.equal(session.score, 140); assert.equal(session.best, 140); assert.equal(session.bestWave, 1);
  assert.equal(session.next(), false); assert.equal(session.restart(), true);
  assert.equal(session.wave, 1); assert.equal(session.score, 0); assert.equal(session.best, 140); assert.equal(session.bestWave, 1);
  assert.equal(session.model.status, 'playing'); assert.notEqual(session.model.seed, seed);
  win(session, 30); assert.equal(session.score, 30); assert.equal(session.best, 140);
});

test('Zuma restart and next settle an externally completed round exactly once', () => {
  const { session } = create(); session.model.score = 70; session.model.status = 'won';
  assert.equal(session.next(), true); assert.equal(session.unlocked, 1); assert.equal(session.best, 70);
  session.startEndless(); session.model.score = 110; session.model.status = 'won';
  session.next(); assert.equal(session.score, 110); assert.equal(session.bestWave, 1);
  session.model.score = 50; session.model.status = 'won'; session.restart();
  assert.equal(session.best, 160); assert.equal(session.bestWave, 2); assert.equal(session.score, 0); assert.equal(session.wave, 1);
});

test('Zuma configured rounds restore flight, random state, progressive speed and a pending gap combo', () => {
  const { session, storage } = create(); session.startEndless(); session.model.start(); exercise(session);
  const balls = session.model.balls;
  if (balls.length > 1) session.model.gapCombos.set(balls[0].id + ':' + balls[1].id, 2);
  session.model.fire(900, 600); session.save();
  const loaded = create(storage.get(SAVE_KEY)).session;
  assert.equal(loaded.model.status, 'paused'); assert.equal(loaded.model.elapsed, session.model.elapsed);
  assert.equal(loaded.model.currentSpeed, session.model.currentSpeed);
  assert.deepEqual(loaded.model.projectiles, session.model.projectiles); assert.deepEqual(loaded.model.gapCombos, session.model.gapCombos);
  loaded.model.resume(); exercise(session, 120); exercise(loaded, 120);
  session.save(); loaded.save();
  assert.deepEqual(loaded.model.balls, session.model.balls); assert.equal(loaded.model.currentColor, session.model.currentColor); assert.equal(loaded.model.nextColor, session.model.nextColor);
  assert.deepEqual(loaded.model.projectiles, session.model.projectiles); assert.equal(loaded.model.score, session.model.score);
});

test('Zuma ready checkpoints after a cleared wave restore the same upcoming track and ammunition', () => {
  const { session, storage } = create(); session.startEndless(); win(session, 60); session.next();
  const loaded = create(storage.get(SAVE_KEY)).session;
  assert.equal(loaded.wave, 2); assert.equal(loaded.model.status, 'ready'); assert.equal(loaded.score, 60);
  assert.equal(loaded.hasProgress, true); assert.equal(loaded.definition.id, session.definition.id);
  assert.deepEqual(loaded.model.balls, session.model.balls); assert.equal(loaded.model.currentColor, session.model.currentColor);
  assert.equal(loaded.model.nextColor, session.model.nextColor);
});

test('Zuma snapshots bind a round to its configured seed and track and support short rounds', () => {
  const short = createRound(null, { seed: 987, totalBalls: 5, speed: 10 });
  const restored = createRound(short.snapshot(), { seed: 987, totalBalls: 5, speed: 10 });
  assert.equal(restored.restored, true); assert.equal(restored.model.spawned, 5);
  const wrong = createRound(short.snapshot(), { seed: 988, totalBalls: 5, speed: 10 });
  assert.equal(wrong.restored, false); assert.equal(wrong.model.status, 'ready');
  const first = createRound(null, getCampaignLevel(0)); first.model.start(); first.model.step(0.05);
  assert.equal(createRound(first.snapshot(), getCampaignLevel(1)).restored, false);
  const invalid = first.snapshot(); invalid.elapsed = Infinity;
  assert.equal(createRound(invalid, getCampaignLevel(0)).restored, false);
});

test('Zuma rejects excessive progress and damaged endless snapshots while preserving valid records', () => {
  const { session, storage } = create(); session.startEndless(); session.model.start(); exercise(session, 10); session.save();
  const base = storage.get(SAVE_KEY);
  for (const mutate of [
    value => { value.wave = MAX_WAVE + 1; },
    value => { value.seed = Infinity; },
    value => { value.totalScore = 1e20; },
    value => { value.round.randomDraws = 1e8; },
    value => { value.round.configuration = 'foreign'; },
    value => { value.round.balls = Array(10000).fill({ id: 1 }); },
    value => { value.credited = true; },
  ]) {
    const damaged = structuredClone(base); damaged.profiles.normal.endless.best = 300; mutate(damaged.profiles.normal.endless);
    const loaded = create(damaged).session;
    assert.equal(loaded.wave, 1); assert.equal(loaded.score, 0); assert.equal(loaded.model.status, 'ready'); assert.equal(loaded.best, 300);
  }
  const unsupported = create({ version: 999, mode: 'endless', best: 700 }).session;
  assert.equal(unsupported.mode, 'campaign'); assert.equal(unsupported.best, 0);
});

test('Zuma storage failures never stop progression and save observes externally changed scores', () => {
  const session = createZumaSession({ read() { throw new Error('denied'); }, write() { throw new Error('full'); }, now() { throw new Error('clock'); } });
  session.model.start(); session.model.score = 240;
  assert.equal(session.save(), false); assert.equal(session.best, 240);
  assert.doesNotThrow(() => session.pause()); assert.equal(session.model.status, 'paused');
  win(session, 300); assert.equal(session.unlocked, 1); assert.equal(session.next(), true);
  assert.equal(session.model.status, 'ready'); assert.equal(session.best, 300);
  assert.equal(session.selectMode('endless'), true); assert.equal(session.startEndless(), true);
  assert.equal(createZumaSession({ write: () => false }).save(), false);
});

test('Zuma reads serialized saves and restores high waves with bounded simulation work', () => {
  const seed = 918273, wave = 1000001;
  const round = createRound(null, getEndlessLevel(wave, seed));
  const saved = {
    version: 2, mode: 'endless', unlocked: 0,
    campaign: { levelIndex: 0, best: 0, round: createRound(null, getCampaignLevel(0)).snapshot() },
    endless: { wave, seed, totalScore: 1000, best: 1000, bestWave: wave - 1, credited: false, round: round.snapshot() },
  };
  const session = createZumaSession({ read: () => JSON.stringify(saved) });
  assert.equal(session.wave, wave); assert.equal(session.score, 1000);
  assert.ok(session.model.totalBalls <= 126); assert.ok(session.model.maxSpeed <= 105.6);
  assert.equal(session.model.balls.length, 22); assert.equal(session.model.status, 'ready');
  win(session, 50); assert.equal(session.next(), true); assert.equal(session.wave, wave + 1);
});

test('Zuma endless wave arithmetic remains safe at the largest representable integer', () => {
  const seed = 918273, wave = MAX_WAVE;
  const saved = {
    version: 2, mode: 'endless', unlocked: 0,
    endless: { wave, seed, totalScore: 1000, best: 1000, bestWave: wave - 1, credited: false, round: createRound(null, getEndlessLevel(wave, seed)).snapshot() },
  };
  const session = create(saved).session;
  assert.equal(session.wave, Number.MAX_SAFE_INTEGER); win(session, 50);
  assert.equal(session.next(), false); assert.equal(session.wave, Number.MAX_SAFE_INTEGER); assert.equal(session.score, 1050);
});

test('Zuma migrates both version 2 slots into normal difficulty without copying unlocks to another difficulty', () => {
  const campaign = createRound(null, getCampaignLevel(2));
  campaign.model.start(); campaign.model.step(1 / 30); campaign.model.score = 550;
  const seed = 98765, wave = 7, endless = createRound(null, getEndlessLevel(wave, seed));
  const old = {
    version: 2, mode: 'endless', difficulty: 'hell', unlocked: 4,
    campaign: { levelIndex: 2, best: 900, round: campaign.snapshot() },
    endless: { wave, seed, totalScore: 700, credited: false, best: 800, bestWave: 6, round: endless.snapshot() },
  };
  const { session, storage } = create(old);
  assert.equal(session.difficulty, 'normal'); assert.equal(session.mode, 'endless');
  assert.equal(session.wave, wave); assert.equal(session.score, 700); assert.equal(session.best, 800);
  assert.deepEqual(session.model.balls, endless.model.balls);
  session.selectMode('campaign');
  assert.equal(session.levelIndex, 2); assert.equal(session.unlocked, 4); assert.equal(session.best, 900);
  assert.equal(session.score, 550); assert.equal(session.model.status, 'paused');
  assert.deepEqual(session.model.balls, campaign.model.balls);
  session.selectDifficulty('easy');
  assert.equal(session.unlocked, 0); assert.equal(session.best, 0); assert.equal(session.model.status, 'ready');
  assert.equal(session.startCampaign(1), false);
  session.selectMode('endless'); assert.equal(session.wave, 1); assert.equal(session.score, 0);
  const saved = storage.get(SAVE_KEY);
  assert.equal(saved.version, 3); assert.equal(saved.difficulty, 'easy');
  assert.equal('campaign' in saved, false); assert.equal('endless' in saved, false); assert.equal('unlocked' in saved, false);
  assert.equal(saved.profiles.normal.unlocked, 4); assert.equal(saved.profiles.normal.endless.seed, seed);
});

function roundState(session) {
  const model = session.model;
  return structuredClone({
    seed: model.seed, balls: model.balls, projectiles: model.projectiles,
    gaps: [...model.gapCombos], score: model.score, elapsed: model.elapsed,
    currentColor: model.currentColor, nextColor: model.nextColor, totalBalls: model.totalBalls,
    ammoSinceWildcard: model.ammoSinceWildcard,
  });
}

test('Zuma restores all eight difficulty and mode slots with their own tracks, flight, score and unlocks', () => {
  const { session, storage } = create();
  const ids = ['easy', 'normal', 'hard', 'hell'], states = {};
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index]; session.selectDifficulty(id); session.selectMode('campaign');
    assert.equal(session.difficulty, id); assert.equal(session.unlocked, 0);
    for (let level = 0; level <= index; level += 1) { win(session, 100 + level); session.next(); }
    session.model.start(); exercise(session, 20 + index); session.model.score = 500 + index;
    states[id] = { campaign: roundState(session), unlocked: index + 1, levelIndex: index + 1 };
    session.startEndless(); win(session, 200 + index); session.next();
    session.model.start(); exercise(session, 30 + index); session.model.score = 40 + index;
    states[id].endless = roundState(session); session.save();
    assert.equal(session.definition.difficulty, id);
  }
  const loaded = create(storage.get(SAVE_KEY)).session;
  assert.equal(loaded.difficulty, 'hell'); assert.equal(loaded.mode, 'endless');
  assert.equal(loaded.model.status, 'paused');
  for (const id of ids) {
    loaded.selectDifficulty(id); assert.equal(loaded.mode, 'endless');
    assert.equal(loaded.wave, 2); assert.equal(loaded.bestWave, 1);
    assert.deepEqual(roundState(loaded), states[id].endless);
    assert.equal(loaded.score, 200 + ids.indexOf(id) + states[id].endless.score);
    assert.equal(loaded.definition.difficulty, id);
    loaded.selectMode('campaign');
    assert.equal(loaded.unlocked, states[id].unlocked); assert.equal(loaded.levelIndex, states[id].levelIndex);
    assert.equal(loaded.best, states[id].campaign.score); assert.equal(loaded.model.status, 'paused');
    assert.deepEqual(roundState(loaded), states[id].campaign);
    loaded.selectMode('endless');
  }
});

test('Zuma difficulty changes pause play, reject unknown IDs and never credit a cleared endless wave twice', () => {
  const { session, storage } = create(); session.startEndless(); session.model.start();
  const playing = session.model; exercise(session, 15);
  assert.equal(session.selectDifficulty('unknown'), false); assert.equal(session.selectDifficulty('normal'), false);
  assert.equal(playing.status, 'playing');
  assert.equal(session.selectDifficulty('hard'), true); assert.equal(playing.status, 'paused');
  assert.equal(session.mode, 'endless'); assert.equal(session.model.status, 'ready');
  win(session, 275); assert.equal(session.score, 275); assert.equal(session.bestWave, 1);
  for (let index = 0; index < 4; index += 1) {
    session.selectDifficulty('easy'); assert.equal(session.score, 0); assert.equal(session.bestWave, 0);
    session.selectDifficulty('hard'); session.save(); assert.equal(session.score, 275); assert.equal(session.bestWave, 1);
  }
  const loaded = create(storage.get(SAVE_KEY)).session;
  loaded.selectDifficulty('normal'); loaded.selectDifficulty('hard'); loaded.save();
  assert.equal(loaded.score, 275); assert.equal(loaded.model.status, 'won');
  loaded.next(); assert.equal(loaded.wave, 2); assert.equal(loaded.score, 275);
  assert.equal(loaded.definition.difficulty, 'hard');
  loaded.model.score = 50; loaded.model.status = 'lost'; loaded.restart();
  assert.equal(loaded.difficulty, 'hard'); assert.equal(loaded.wave, 1); assert.equal(loaded.score, 0);
  assert.equal(loaded.best, 325); assert.equal(loaded.model.status, 'playing');
  assert.equal(loaded.model.totalBalls, getEndlessLevel(1, 1, 'hard').totalBalls);
});

test('Zuma v3 rejects malformed selections and confines damaged snapshots to their difficulty', () => {
  const { session, storage } = create(); session.selectDifficulty('hell'); session.startEndless();
  win(session, 170); session.next(); session.save();
  const damaged = structuredClone(storage.get(SAVE_KEY));
  damaged.difficulty = '__proto__'; damaged.profiles.easy = null;
  damaged.profiles.hell.endless.round.configuration = 'foreign';
  const loaded = create(damaged).session;
  assert.equal(loaded.difficulty, 'normal'); assert.equal(loaded.mode, 'endless'); assert.equal(loaded.score, 0);
  loaded.selectDifficulty('hell'); assert.equal(loaded.wave, 1); assert.equal(loaded.score, 0);
  assert.equal(loaded.best, 170); assert.equal(loaded.bestWave, 1);
  loaded.selectDifficulty('easy'); assert.equal(loaded.model.status, 'ready'); assert.equal(loaded.unlocked, 0);
  const failing = createZumaSession({ write() { throw new Error('full'); } });
  failing.model.start(); const old = failing.model;
  assert.doesNotThrow(() => failing.selectDifficulty('hell')); assert.equal(old.status, 'paused');
  assert.equal(failing.difficulty, 'hell'); assert.equal(failing.mode, 'campaign');
  win(failing, 100); failing.next(); assert.equal(failing.definition.difficulty, 'hell');
  assert.equal(failing.unlocked, 1); assert.equal(failing.save(), false);
});
