'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getLevel, LEVELS, oreValue, BARREL_BLAST_RADIUS, MAX_ENDLESS_LEVEL } = require('../src/games/gold-miner/core/levels.js');
const { MineEngine, rayContact } = require('../src/games/gold-miner/core/engine.js');
const { createGoldMinerGame } = require('../src/games/gold-miner/index.js');
const { storageKey } = require('../src/games/gold-miner/core/storage.js');
const histogram = ores => ores.reduce((result, ore) => { result[ore.kind] = (result[ore.kind] || 0) + 1; return result; }, {});
const value = ores => ores.reduce((sum, ore) => sum + oreValue(ore), 0);
const views = [{ width: 1280, height: 720, portrait: false }, { width: 720, height: 740, portrait: true }];

function checkMine(level) {
  assert.equal(new Set(level.ores.map(ore => ore.id)).size, level.ores.length);
  for (const view of views) {
    const engine = new MineEngine(level);
    engine.setViewport(view);
    const g = engine.geometry;
    engine.ores.forEach((ore, index) => {
      assert.ok(ore.x - ore.radius >= g.bounds.left && ore.x + ore.radius <= g.bounds.right);
      assert.ok(ore.y + ore.radius <= g.bounds.bottom);
      const angle = Math.atan2(ore.x - g.pivotX, ore.y - g.pivotY);
      assert.ok(Math.abs(angle) < g.maxAngle, `unreachable angle: ${ore.id}`);
      const distance = rayContact(angle, ore, g);
      assert.ok(distance > g.minRope && distance <= g.maxRope, `unreachable rope: ${ore.id}`);
      for (const other of engine.ores.slice(index + 1)) {
        assert.ok(Math.hypot(ore.x - other.x, ore.y - other.y) >= ore.radius + other.radius + 7.999, `overlap ${ore.id}/${other.id}`);
      }
      if (ore.motion) assert.ok(ore.x >= view.width / 2 + (ore.motion.left - 640) * (view.portrait ? 624 / 1170 : 1) - 1e-6);
    });
    const duo = new MineEngine(level, { playerCount: 2 });
    duo.setViewport(view);
    for (const ore of duo.ores) {
      assert.ok([0, 1].some(player => {
        const geometry = duo.playerGeometry(player);
        const angle = Math.atan2(ore.x - geometry.pivotX, ore.y - geometry.pivotY);
        return Math.abs(angle) <= geometry.maxAngle && rayContact(angle, ore, geometry) <= geometry.maxRope;
      }), `neither player can reach ${ore.id}`);
    }
  }
  const barrels = level.ores.filter(ore => ore.kind === 'barrel');
  const elves = level.ores.filter(ore => ore.kind === 'elf');
  const prizes = level.ores.filter(ore => !ore.motion && ore.kind !== 'barrel');
  const inBlast = (ore, barrel) => Math.hypot(ore.x - barrel.x, ore.y - barrel.y) <= BARREL_BLAST_RADIUS + ore.radius;
  if (barrels.length) {
    for (const barrel of barrels) assert.ok(prizes.some(ore => oreValue(ore) >= 200 && inBlast(ore, barrel)));
    const safe = prizes.filter(ore => !barrels.some(barrel => inBlast(ore, barrel)) && !elves.some(elf => Math.abs(elf.y - ore.y) <= elf.radius + ore.radius));
    assert.ok(value(safe) >= level.target * 1.15, `insufficient safe value in ${level.id}`);
  }
}

test('all 40 campaign levels retain budgets and satisfy geometry/TNT invariants across 128 seeds', () => {
  const templates = JSON.stringify(LEVELS);
  for (let seed = 0; seed < 128; seed++) for (let index = 0; index < 40; index++) {
    const level = getLevel(index, false, Math.imul(seed, 0x9e3779b1) >>> 0);
    assert.equal(level.target, LEVELS[index].target);
    assert.equal(level.duration, LEVELS[index].duration);
    assert.deepEqual(histogram(level.ores), histogram(LEVELS[index].ores));
    assert.equal(value(level.ores), value(LEVELS[index].ores));
    checkMine(level);
  }
  assert.equal(JSON.stringify(LEVELS), templates);
});

test('endless stays bounded and safe at early, late, and maximum levels across 128 seeds', () => {
  for (let seed = 0; seed < 128; seed++) for (const index of [0, 1, 8, 40, 100, MAX_ENDLESS_LEVEL - 1]) {
    const level = getLevel(index, true, seed);
    assert.ok(level.ores.length <= 25);
    assert.ok(level.target <= 4800);
    checkMine(level);
  }
});

test('same seed replays exactly; returned layouts are independent and inputs are validated', () => {
  for (const endless of [false, true]) for (const seed of [0, 1, 4294967295]) {
    const first = getLevel(30, endless, seed), second = getLevel(30, endless, seed);
    assert.deepEqual(first, second);
    first.ores[0].x = -1;
    assert.notEqual(second.ores[0].x, -1);
    first.ores.find(ore => ore.motion).motion.left = -1;
    assert.notEqual(getLevel(30, endless, seed).ores.find(ore => ore.motion).motion.left, -1);
    assert.throws(() => getLevel(0, endless, NaN), RangeError);
    assert.throws(() => getLevel(-1, endless, seed), RangeError);
  }
});

test('gold, diamonds and TNT occupy varied regions rather than fixed rows or checkerboards', () => {
  for (const endless of [false, true]) for (const kind of ['goldLarge', 'diamond', 'barrel']) {
    const cells = new Set(), xs = [], ys = [], layouts = new Set();
    for (let seed = 0; seed < 256; seed++) {
      const level = getLevel(30, endless, seed);
      layouts.add(JSON.stringify(level.ores));
      for (const ore of level.ores.filter(ore => ore.kind === kind)) {
        xs.push(ore.x); ys.push(ore.y);
        cells.add(`${Math.floor((ore.x - 110) / 265)},${Math.floor((ore.y - 280) / 90)}`);
      }
    }
    assert.equal(layouts.size, 256);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 700, `${kind} x coverage`);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 150, `${kind} y coverage`);
    assert.ok(cells.size >= 8, `${kind} spatial variety`);
    const left = xs.filter(x => x < 640).length / xs.length;
    assert.ok(left > 0.3 && left < 0.7, `${kind} left/right bias: ${left}`);
  }
});

test('new campaign runs change seeds; retry, progression and persisted restore retain them in all modes', () => {
  for (const mode of ['solo', 'coop', 'versus']) for (const endless of [false, true]) {
    const saved = new Map();
    let rng = 0;
    const options = { read: key => saved.get(key), write: (key, val) => { saved.set(key, JSON.parse(JSON.stringify(val))); return true; }, now: () => 1000, random: () => (++rng) / 100 };
    const game = createGoldMinerGame(options);
    game.activate('miner:mode', mode);
    game.activate('miner:challenge', endless);
    game.activate('miner:new');
    const seed = game.model.checkpoint.seed;
    const ores = JSON.stringify(game.model.engine.level.ores);
    assert.ok(Number.isInteger(seed));
    assert.equal(saved.get(storageKey(mode, endless)).checkpoint.seed, seed);
    const resumed = createGoldMinerGame(options);
    resumed.activate('miner:continue');
    assert.equal(JSON.stringify(resumed.model.engine.level.ores), ores);
    resumed.activate('miner:play');
    resumed.activate('miner:pause');
    if (mode !== 'versus') {
      assert.equal(resumed.activate('miner:retry'), true);
      assert.equal(JSON.stringify(resumed.model.engine.level.ores), ores);
      resumed.activate('miner:play');
      resumed.model.engine.income = resumed.model.engine.level.target;
      assert.equal(resumed.activate('miner:finish'), true);
      resumed.activate('miner:shop');
      resumed.activate('miner:next');
      assert.equal(resumed.model.checkpoint.seed, seed);
      assert.equal(resumed.model.checkpoint.levelIndex, 1);
    }
    resumed.activate('miner:menu');
    resumed.activate('miner:force-new');
    assert.notEqual(resumed.model.checkpoint.seed, seed);
    assert.notEqual(JSON.stringify(resumed.model.engine.level.ores), ores);
  }
});

test('legacy seedless campaign saves retain authored layouts on resume/retry', () => {
  const checkpoint = { levelIndex: 24, wallet: 0, bombs: 0, strength: false, diamondBonus: false, totalEarned: 0 };
  const game = createGoldMinerGame({ read: key => key === storageKey('solo', false) ? { version: 1, highestCleared: 24, bestEarned: 0, checkpoint, shop: null } : null });
  game.activate('miner:continue');
  assert.deepEqual(game.model.engine.level, LEVELS[24]);
  game.activate('miner:play'); game.activate('miner:pause'); game.activate('miner:retry');
  assert.deepEqual(game.model.engine.level, LEVELS[24]);
});

test('deterministic reserve branch fits every campaign and maximum-budget endless variant', () => {
  // Force the reserve branch without adding a test-only switch to production.
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../src/games/gold-miner/core/levels.js'), 'utf8');
  assert.ok(source.includes('let attempt = 0; attempt < 32;'));
  const exports = {};
  vm.runInNewContext(source.replace('let attempt = 0; attempt < 32;', 'let attempt = 16; attempt < 32;'), { exports });
  for (let index = 0; index < 40; index++) checkMine(exports.getLevel(index, false, 77));
  for (let seed = 0; seed < 256; seed++) checkMine(exports.getLevel(MAX_ENDLESS_LEVEL - 1, true, seed));
});

test('legacy endless generator matches frozen pre-upgrade bytes across seeds and levels', () => {
  // SHA-256 captured from b70d432 core/levels.js, not from the new generator.
  const crypto = require('node:crypto'), levels = [];
  for (const index of [0, 1, 20, 100, 999999]) for (const seed of [0, 1, 123, 4294967295]) levels.push(getLevel(index, true, seed, 1));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(levels)).digest('hex'), '4912511c078ed19a0834cff4d415f424bf565172e4f576d3bde1f1e83662eb27');
  assert.deepEqual(getLevel(0, true, 123, 1).ores[0], { id: 'level-1-ore-1', kind: 'diamond', x: 116, y: 332, radius: 15 });
});

test('old seeded endless checkpoint/shop restores original boards in all applicable modes', () => {
  const { emptyMatch } = require('../src/games/gold-miner/core/modes.js');
  for (const mode of ['solo', 'coop', 'versus']) for (const shop of [false, true]) {
    if (shop && mode === 'versus') continue;
    const run = { levelIndex: 0, wallet: 0, bombs: 0, strength: false, diamondBonus: false, totalEarned: 0, seed: 123,
      ...(mode === 'versus' ? { match: emptyMatch() } : {}), ...(shop ? { purchaseCounts: { bomb: 0, strength: 0, diamond: 0 } } : {}) };
    const saved = new Map([
      ['gold-miner-settings-v1', { mode, endless: true }],
      [storageKey(mode, true), { version: 1, bestEarned: 0, highestCleared: 0, checkpoint: shop ? null : run, shop: shop ? run : null }],
    ]);
    const options = { read: key => saved.get(key), write: (key, val) => { saved.set(key, structuredClone(val)); return true; } };
    const game = createGoldMinerGame(options);
    game.activate('miner:continue');
    assert.deepEqual(game.model.engine.level, getLevel(0, true, 123, 1));
    assert.equal(game.model.checkpoint.layoutVersion, undefined);
    if (shop) game.activate('miner:next');
    game.activate('miner:play'); game.activate('miner:pause');
    if (mode !== 'versus') game.activate('miner:retry');
    game.save();
    const reopened = createGoldMinerGame(options); reopened.activate('miner:continue');
    assert.deepEqual(reopened.model.engine.level, getLevel(0, true, 123, 1));
  }
});

test('layout version persists through new-run shop and versus progression, including app restart', () => {
  for (const mode of ['solo', 'coop', 'versus']) for (const endless of [false, true]) {
    const saved = new Map();
    const options = { read: key => saved.get(key), write: (key, val) => { saved.set(key, structuredClone(val)); return true; }, now: () => 100, random: () => 0.123 };
    const game = createGoldMinerGame(options);
    game.activate('miner:mode', mode); game.activate('miner:challenge', endless); game.activate('miner:new');
    const seed = game.model.checkpoint.seed;
    assert.equal(game.model.checkpoint.layoutVersion, 2);
    game.activate('miner:play');
    if (mode === 'versus') { game.model.engine.ended = true; game.tick(16); }
    else { game.model.engine.income = game.model.engine.level.target; game.activate('miner:finish'); }
    const disk = saved.get(storageKey(mode, endless));
    assert.equal((disk.shop || disk.checkpoint).layoutVersion, 2);
    const reopened = createGoldMinerGame(options); reopened.activate('miner:continue');
    if (mode !== 'versus') reopened.activate('miner:next');
    assert.equal(reopened.model.checkpoint.layoutVersion, 2);
    assert.equal(reopened.model.checkpoint.seed, seed);
    assert.deepEqual(reopened.model.engine.level, getLevel(1, endless, seed, 2));
  }
});
