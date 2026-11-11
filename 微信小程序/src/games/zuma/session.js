'use strict';
const { createRound } = require('./state.js');
const { DIFFICULTIES, CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel } = require('./levels.js');

// Keep the original key so existing installations find their first journey.
const SAVE_KEY = 'games-between:zuma:v1';
const MAX_SCORE = 1e9;
const MAX_WAVE = Number.MAX_SAFE_INTEGER;
const DIFFICULTY_IDS = DIFFICULTIES.map(settings => settings.id);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const validScore = value => integer(value, 0, MAX_SCORE);
const scoreValue = value => validScore(value) ? value : 0;
const addScore = (left, right) => Math.min(MAX_SCORE, left + scoreValue(right));

/** Progression and storage are independent of Canvas, touches and wall time. */
function createZumaSession({ read = () => null, write = () => true, now = Date.now } = {}) {
  let saved;
  try {
    saved = read(SAVE_KEY);
    if (typeof saved === 'string') saved = saved.length <= 1000000 ? JSON.parse(saved) : null;
  } catch { saved = null; }
  if (!saved || typeof saved !== 'object' || ![1, 2, 3].includes(saved.version)) saved = null;

  let seedCounter = 0, previousSeed = 0;
  function newSeed() {
    let timestamp;
    try { timestamp = now(); } catch { timestamp = 0; }
    if (!Number.isFinite(timestamp)) timestamp = 0;
    let seed = ((Math.floor(timestamp) >>> 0) ^ Math.imul(++seedCounter, 0x9e3779b9)) >>> 0;
    if (seed === previousSeed) seed = (seed + 1) >>> 0;
    previousSeed = seed;
    return seed;
  }

  let mode = saved && saved.version >= 2 && saved.mode === 'endless' ? 'endless' : 'campaign';
  let difficulty = saved && saved.version === 3 && DIFFICULTY_IDS.includes(saved.difficulty) ? saved.difficulty : 'normal';

  function restoreProfile(id) {
    // The original two formats describe normal difficulty only. Never copy
    // their unlocks, score or in-flight ammunition into another difficulty.
    let data = saved && saved.version === 3 && saved.profiles && typeof saved.profiles === 'object' ? saved.profiles[id] : null;
    if (saved && saved.version === 2 && id === 'normal') data = saved;
    if (!data || typeof data !== 'object') data = {};
    const unlocked = integer(data.unlocked, 0, CAMPAIGN_LEVELS.length - 1) ? data.unlocked : 0;
    const campaignData = data.campaign && typeof data.campaign === 'object' ? data.campaign : {};
    const campaign = {
      levelIndex: integer(campaignData.levelIndex, 0, unlocked) ? campaignData.levelIndex : 0,
      best: scoreValue(campaignData.best), round: null,
    };
    let campaignSnapshot = campaignData.round;
    if (saved && saved.version === 1 && id === 'normal') {
      campaign.best = scoreValue(saved.best);
      // Version 1 always used the original first track and lacked identity.
      campaignSnapshot = saved.round && typeof saved.round === 'object' ? { ...saved.round } : null;
      if (campaignSnapshot) delete campaignSnapshot.configuration;
    }
    campaign.round = createRound(campaignSnapshot, getCampaignLevel(campaign.levelIndex, id));

    const endlessData = data.endless && typeof data.endless === 'object' ? data.endless : {};
    let endless = { wave: 1, seed: newSeed(), totalScore: 0, credited: false, best: scoreValue(endlessData.best), bestWave: integer(endlessData.bestWave, 0, MAX_WAVE) ? endlessData.bestWave : 0, round: null };
    if (integer(endlessData.wave, 1, MAX_WAVE) && integer(endlessData.seed, 0, 0xffffffff) && validScore(endlessData.totalScore) && typeof endlessData.credited === 'boolean') {
      const candidate = createRound(endlessData.round, getEndlessLevel(endlessData.wave, endlessData.seed, id));
      // Credited waves must retain their won screen, preventing double credit
      // or transferring points from a damaged snapshot into the next wave.
      if (candidate.restored && (!endlessData.credited || (candidate.model.status === 'won' && endlessData.totalScore >= candidate.model.score && endless.bestWave >= endlessData.wave))) {
        endless = { ...endless, wave: endlessData.wave, seed: endlessData.seed, totalScore: endlessData.totalScore, credited: endlessData.credited, round: candidate };
      }
    }
    if (!endless.round) endless.round = createRound(null, getEndlessLevel(1, endless.seed, id));
    previousSeed = endless.seed;
    return { unlocked, campaign, endless };
  }

  const profiles = {};
  for (const id of DIFFICULTY_IDS) profiles[id] = restoreProfile(id);
  const profile = () => profiles[difficulty];
  const active = () => mode === 'campaign' ? profile().campaign : profile().endless;
  const model = () => active().round.model;
  const displayedScore = () => mode === 'campaign' ? scoreValue(model().score) : addScore(profile().endless.totalScore, profile().endless.credited ? 0 : model().score);

  function settle(progress = profile()) {
    const { campaign, endless } = progress;
    const before = [campaign.best, progress.unlocked, endless.best, endless.bestWave, endless.totalScore, endless.credited].join(':');
    campaign.best = Math.max(campaign.best, scoreValue(campaign.round.model.score));
    if (campaign.round.model.status === 'won') progress.unlocked = Math.max(progress.unlocked, Math.min(CAMPAIGN_LEVELS.length - 1, campaign.levelIndex + 1));
    if (endless.round.model.status === 'won' && !endless.credited) {
      endless.totalScore = addScore(endless.totalScore, endless.round.model.score);
      endless.credited = true;
      endless.bestWave = Math.max(endless.bestWave, endless.wave);
    }
    endless.best = Math.max(endless.best, addScore(endless.totalScore, endless.credited ? 0 : endless.round.model.score));
    return before !== [campaign.best, progress.unlocked, endless.best, endless.bestWave, endless.totalScore, endless.credited].join(':');
  }

  function save() {
    settle();
    try {
      const snapshots = {};
      for (const id of DIFFICULTY_IDS) {
        const { unlocked, campaign, endless } = profiles[id];
        snapshots[id] = {
          unlocked,
          campaign: { levelIndex: campaign.levelIndex, best: campaign.best, round: campaign.round.snapshot() },
          endless: { wave: endless.wave, seed: endless.seed, totalScore: endless.totalScore, credited: endless.credited, best: endless.best, bestWave: endless.bestWave, round: endless.round.snapshot() },
        };
      }
      return write(SAVE_KEY, { version: 3, mode, difficulty, profiles: snapshots }) !== false;
    } catch { return false; }
  }

  function pause() { model().pause(); return save(); }
  function selectMode(nextMode) {
    if (!['campaign', 'endless'].includes(nextMode) || nextMode === mode) return false;
    model().pause(); settle(); mode = nextMode; model().pause(); save(); return true;
  }
  function selectDifficulty(nextDifficulty) {
    if (!DIFFICULTY_IDS.includes(nextDifficulty) || nextDifficulty === difficulty) return false;
    model().pause(); settle(); difficulty = nextDifficulty; model().pause(); save(); return true;
  }
  function startCampaign(index) {
    settle();
    const { campaign, unlocked } = profile();
    if (!integer(index, 0, unlocked)) return false;
    model().pause(); mode = 'campaign'; campaign.levelIndex = index;
    campaign.round = createRound(null, getCampaignLevel(index, difficulty)); save(); return true;
  }
  function startEndless() {
    settle(); model().pause(); mode = 'endless';
    const { endless } = profile();
    endless.wave = 1; endless.seed = newSeed(); endless.totalScore = 0; endless.credited = false;
    endless.round = createRound(null, getEndlessLevel(1, endless.seed, difficulty)); save(); return true;
  }
  function next() {
    if (model().status !== 'won') return false;
    settle();
    const { campaign, endless } = profile();
    if (mode === 'campaign') {
      if (campaign.levelIndex + 1 >= CAMPAIGN_LEVELS.length) { save(); return false; }
      campaign.levelIndex += 1;
      campaign.round = createRound(null, getCampaignLevel(campaign.levelIndex, difficulty));
    } else {
      if (endless.wave >= MAX_WAVE) { save(); return false; }
      endless.wave += 1; endless.credited = false;
      endless.round = createRound(null, getEndlessLevel(endless.wave, endless.seed, difficulty));
    }
    save(); return true;
  }
  function restart() {
    settle();
    if (mode === 'endless') startEndless();
    else profile().campaign.round.restart();
    model().start(); save(); return true;
  }
  function step(seconds) {
    const events = model().step(seconds);
    if (settle() || events.some(event => event.type === 'win' || event.type === 'lose')) save();
    return events;
  }
  for (const id of DIFFICULTY_IDS) settle(profiles[id]);
  if (saved && saved.version < 3) save();

  return {
    selectMode, selectDifficulty, startCampaign, startEndless, next, restart, step, pause, save,
    get model() { return model(); },
    get definition() { return mode === 'campaign' ? getCampaignLevel(profile().campaign.levelIndex, difficulty) : getEndlessLevel(profile().endless.wave, profile().endless.seed, difficulty); },
    get mode() { return mode; },
    get difficulty() { return difficulty; },
    get levelIndex() { return profile().campaign.levelIndex; },
    get wave() { return profile().endless.wave; },
    get unlocked() { return profile().unlocked; },
    get best() { return active().best; },
    get score() { return displayedScore(); },
    get bestWave() { return profile().endless.bestWave; },
    get hasProgress() { return model().status !== 'ready' || (mode === 'campaign' ? profile().campaign.levelIndex > 0 : profile().endless.wave > 1); },
  };
}

module.exports = { createZumaSession, SAVE_KEY, MAX_WAVE };
