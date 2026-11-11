'use strict';

const { TRACK_CONTROL_POINTS } = require('./core/track');

// Original routes use world coordinates. Keep a clear firing area around (560,360).
const ROUTES = [
  TRACK_CONTROL_POINTS,
  [
    [45, 115], [300, 95], [680, 110], [995, 130], [1030, 310],
    [990, 555], [790, 615], [485, 610], [220, 575], [95, 455],
    [115, 305], [265, 220], [490, 215], [715, 225], [820, 310],
    [800, 435], [690, 480],
  ],
  [
    [45, 185], [185, 95], [420, 115], [670, 70], [925, 125],
    [1025, 270], [985, 480], [800, 595], [530, 610], [275, 580],
    [115, 460], [145, 320], [290, 255], [420, 250],
  ],
  [
    [55, 95], [340, 95], [720, 90], [1015, 115], [1035, 235],
    [805, 245], [670, 195], [435, 205], [185, 240], [100, 375],
    [190, 520], [465, 545], [795, 530], [1010, 560], [1010, 630],
    [700, 640], [405, 635], [120, 625],
  ],
  [
    [55, 520], [105, 275], [280, 105], [600, 80], [915, 170],
    [1030, 365], [940, 565], [660, 620], [380, 585], [235, 460],
    [270, 305], [420, 215], [650, 210], [795, 300], [790, 435],
    [685, 495], [480, 490],
  ],
  [
    [55, 90], [255, 140], [440, 85], [670, 130], [860, 90],
    [1030, 205], [1000, 405], [1030, 580], [820, 630], [570, 590],
    [350, 635], [120, 550], [80, 390], [150, 240], [315, 205],
    [420, 225],
  ],
].map(route => Object.freeze(route.map(point => Object.freeze(
  Array.isArray(point) ? { x: point[0], y: point[1] } : { ...point },
))));

const THEMES = [
  { sky: '#102d32', ground: '#244a43', stone: '#7e9283', accent: '#e9c46a' },
  { sky: '#112b44', ground: '#1d4d5d', stone: '#83a5ac', accent: '#88ded3' },
  { sky: '#402835', ground: '#63444b', stone: '#b78b7a', accent: '#ffcf88' },
  { sky: '#172b38', ground: '#35576b', stone: '#91acb6', accent: '#b1deef' },
  { sky: '#153a2b', ground: '#356447', stone: '#9eaf89', accent: '#d9eb8e' },
  { sky: '#2d254b', ground: '#49456a', stone: '#a497bf', accent: '#e1b7f3' },
];

const TITLES = ['古庙回廊', '云水回湾', '落日沙丘', '霜河折返', '翠玉旋境', '极光之径'];
const SUBTITLES = [
  '熟悉回廊，热身启程', '内外双湾，留意回转', '沙丘起伏，稳住节奏',
  '长河折返，寻找射线', '旋入翠境，把握连消', '曲折极光，迎接挑战',
];

const DIFFICULTIES = Object.freeze([
  { id: 'easy', title: '简单', speedMultiplier: 1.6, ballMultiplier: 0.8, endlessSpeedCap: 76.8 },
  { id: 'normal', title: '中等', speedMultiplier: 2.2, ballMultiplier: 1, endlessSpeedCap: 105.6 },
  { id: 'hard', title: '困难', speedMultiplier: 3, ballMultiplier: 1.15, endlessSpeedCap: 140 },
  { id: 'hell', title: '地狱', speedMultiplier: 4.2, ballMultiplier: 1.3, endlessSpeedCap: 192 },
].map(difficulty => Object.freeze(difficulty)));

// Exact rules from the previous four-difficulty release, for safe save migration.
const PREVIOUS_MOTION = Object.freeze({
  easy: Object.freeze({ multiplier: 0.8, endlessSpeedCap: 38.4 }),
  normal: Object.freeze({ multiplier: 1, endlessSpeedCap: 48 }),
  hard: Object.freeze({ multiplier: 1.2, endlessSpeedCap: 56 }),
  hell: Object.freeze({ multiplier: 1.4, endlessSpeedCap: 64 }),
});

function getDifficulty(id) {
  return DIFFICULTIES.find(difficulty => difficulty.id === id) || DIFFICULTIES[1];
}

/** Six finite campaign stages. Definitions can be passed directly to GameModel. */
const CAMPAIGN_LEVELS = Object.freeze(ROUTES.map((trackPoints, index) => Object.freeze({
  id: 'campaign-' + (index + 1),
  title: TITLES[index],
  subtitle: SUBTITLES[index],
  palette: Object.freeze(THEMES[index]),
  trackPoints,
  totalBalls: [78, 86, 94, 102, 112, 120][index],
  seed: [74219, 153107, 289163, 397489, 510217, 631451][index],
  speed: [26, 29, 32, 35, 38, 41][index],
  maxSpeed: [34, 37, 40, 43, 47, 50][index],
  acceleration: [0.10, 0.105, 0.11, 0.115, 0.12, 0.125][index],
  dangerSlowdown: false,
  difficulty: 'normal',
  wildcards: true,
})));

function getCampaignLevel(index, difficulty = 'normal') {
  const definition = Number.isInteger(index) && index >= 0 ? CAMPAIGN_LEVELS[index] || null : null;
  if (!definition) return null;
  const settings = getDifficulty(difficulty);
  const previous = PREVIOUS_MOTION[settings.id];
  return {
    ...definition,
    difficulty: settings.id,
    totalBalls: Math.round(definition.totalBalls * settings.ballMultiplier),
    speed: definition.speed * settings.speedMultiplier,
    maxSpeed: definition.maxSpeed * settings.speedMultiplier,
    acceleration: definition.acceleration * settings.speedMultiplier,
    previousMotion: {
      speed: definition.speed * previous.multiplier,
      maxSpeed: definition.maxSpeed * previous.multiplier,
      acceleration: definition.acceleration * previous.multiplier,
    },
  };
}

/**
 * One finite wave at a time: six rotating routes, bounded population and speed.
 * Fractional, invalid or oversized input is normalized in constant time.
 */
function getEndlessLevel(wave, seed = 74219, difficulty = 'normal') {
  const settings = getDifficulty(difficulty);
  const previous = PREVIOUS_MOTION[settings.id];
  const normalizedWave = Number.isFinite(wave) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(wave))) : 1;
  const routeIndex = (normalizedWave - 1) % ROUTES.length;
  const progress = 1 - Math.exp(-(normalizedWave - 1) / 12);
  const speed = 27 + 13 * progress;
  const sessionSeed = Number.isFinite(seed) ? seed >>> 0 : 74219;
  // Integer mixing avoids floating-point multiplication losing the session seed.
  let mixedSeed = (sessionSeed ^ Math.imul(normalizedWave >>> 0, 0x9e3779b1) ^ Math.floor(normalizedWave / 4294967296)) >>> 0;
  mixedSeed = Math.imul(mixedSeed ^ (mixedSeed >>> 16), 0x85ebca6b) >>> 0;
  return {
    id: 'endless-' + normalizedWave,
    title: '无尽 · 第 ' + normalizedWave + ' 波',
    subtitle: TITLES[routeIndex] + ' · 速度有上限，险境自动缓行',
    palette: CAMPAIGN_LEVELS[routeIndex].palette,
    trackPoints: ROUTES[routeIndex],
    totalBalls: Math.round(Math.min(126, 78 + Math.floor(48 * progress)) * settings.ballMultiplier),
    seed: mixedSeed,
    speed: speed * settings.speedMultiplier,
    maxSpeed: Math.min(settings.endlessSpeedCap, Math.min(48, speed + 8) * settings.speedMultiplier),
    acceleration: 0.10 * settings.speedMultiplier,
    dangerSlowdown: true,
    difficulty: settings.id,
    wildcards: true,
    previousMotion: {
      speed: speed * previous.multiplier,
      maxSpeed: Math.min(previous.endlessSpeedCap, Math.min(48, speed + 8) * previous.multiplier),
      acceleration: 0.10 * previous.multiplier,
    },
  };
}

module.exports = { DIFFICULTIES, getDifficulty, CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel };
