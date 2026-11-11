import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MineEngine, PHYSICS, rayContact, BARREL_BLAST_RADIUS: engineBlastRadius } = require('../../微信小程序/src/games/gold-miner/core/engine.js');
const { LEVELS, generateEndlessLevel, BARREL_BLAST_RADIUS, oreValue } = require('../../微信小程序/src/games/gold-miner/core/levels.js');

const treasure = ore => ore.kind === 'goldLarge' || ore.kind === 'diamond';
const inBlast = (barrel, ore) => Math.hypot(ore.x - barrel.x, ore.y - barrel.y) <= BARREL_BLAST_RADIUS + ore.radius;
const seeds = [0, 1, 17, 731, 20261018, 0xffffffff];
const endlessCases = seeds.flatMap(seed => [...Array.from({ length: 20 }, (_, index) => index), 99, 999, 999999]
  .map(index => ({ label: `endless ${index + 1}, seed ${seed}`, level: generateEndlessLevel(index, seed) })));
const layouts = [...LEVELS.slice(20).map(level => ({ label: `campaign ${level.id}`, level })), ...endlessCases];
const viewports = [
  { width: 1280, height: 720, portrait: false },
  { width: 720, height: 1000, portrait: true },
];

/** Sample actual hook rays and keep their first collision within the mine's edges. */
function firstHits(engine, playerIndex = 0) {
  const hits = new Set();
  const geometry = engine.playerGeometry(playerIndex);
  for (let sample = 0; sample <= 960; sample++) {
    const angle = -geometry.maxAngle + 2 * geometry.maxAngle * sample / 960;
    const sx = Math.sin(angle), cy = Math.cos(angle);
    const edge = Math.min(geometry.maxRope, (geometry.bounds.bottom - geometry.pivotY) / cy,
      Math.abs(sx) < 0.00001 ? Infinity : (sx > 0 ? geometry.bounds.right - geometry.pivotX : geometry.pivotX - geometry.bounds.left) / Math.abs(sx));
    let first = null, distance = edge;
    for (const ore of engine.ores) {
      if (ore.removed || ore.held) continue;
      const contact = rayContact(angle, ore, geometry);
      if (contact !== null && contact >= geometry.minRope && contact < distance) { first = ore; distance = contact; }
    }
    if (first) hits.add(first);
  }
  return hits;
}

test('TNT layouts preserve 40 campaign ids, introductory maps and reproducible seeded mines', () => {
  assert.equal(LEVELS.length, 40);
  assert.deepEqual(LEVELS.map(level => level.id), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(BARREL_BLAST_RADIUS, 140);
  assert.equal(engineBlastRadius, BARREL_BLAST_RADIUS);
  assert.ok(LEVELS.slice(0, 20).every(level => level.ores.every(ore => ore.kind !== 'barrel')));
  assert.ok(LEVELS.slice(20).some(level => level.ores.filter(ore => ore.kind === 'barrel').length === 1));
  assert.ok(LEVELS.slice(20).some(level => level.ores.filter(ore => ore.kind === 'barrel').length === 2));
  for (const seed of seeds) {
    assert.deepEqual(generateEndlessLevel(999999, seed), generateEndlessLevel(999999, seed));
  }
});

test('every TNT is among mixed treasure without overlaps, a chain wall or an unwinnable blast penalty', () => {
  for (const { label, level } of layouts) {
    const barrels = level.ores.filter(ore => ore.kind === 'barrel');
    const prizes = level.ores.filter(ore => treasure(ore) && ore.y < 450);
    assert.ok(barrels.length >= 1 && barrels.length <= 2, label);
    assert.equal(prizes.length, 16, label);
    for (let first = 0; first < level.ores.length; first++) for (let second = first + 1; second < level.ores.length; second++) {
      const a = level.ores[first], b = level.ores[second];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius, `${label}: overlapping ${a.kind}/${b.kind}`);
    }
    for (const barrel of barrels) {
      const neighbours = prizes.filter(ore => inBlast(barrel, ore));
      assert.ok(neighbours.some(ore => ore.kind === 'goldLarge'), `${label}: TNT has no nearby gold`);
      assert.ok(neighbours.some(ore => ore.kind === 'diamond'), `${label}: TNT has no nearby diamond`);
      assert.ok(neighbours.every(ore => ore.y < barrel.y), `${label}: TNT should sit below its mixed cluster`);
      assert.ok(barrels.every(other => other === barrel || !inBlast(barrel, other)), `${label}: chain wall`);
    }
    const safe = prizes.filter(ore => barrels.every(barrel => !inBlast(barrel, ore)));
    assert.ok(safe.reduce((sum, ore) => sum + oreValue(ore), 0) >= level.target, `${label}: blasts could destroy the required income`);
    const upperShelf = prizes.slice(0, 8);
    assert.ok(upperShelf.every(ore => safe.includes(ore)), `${label}: upper shelf hit by TNT`);
    for (const elf of level.ores.filter(ore => ore.kind === 'elf')) {
      assert.ok(safe.every(ore => Math.abs(ore.y - elf.y) > ore.radius + elf.radius), `${label}: elf could dig the guaranteed reserve`);
    }
  }
});

test('solo and both duo hooks retain direct treasure routes in wide and portrait mines', () => {
  for (const { label, level } of layouts) for (const viewport of viewports) for (const playerCount of [1, 2]) {
    const engine = new MineEngine(level, { playerCount });
    engine.setViewport(viewport);
    for (let player = 0; player < playerCount; player++) {
      const hits = [...firstHits(engine, player)];
      const accessible = hits.filter(treasure);
      const pivot = engine.playerGeometry(player).pivotX;
      const description = `${label}, ${viewport.width}×${viewport.height}, ${playerCount} players, hook ${player}`;
      assert.ok(accessible.length >= 3, `${description}: TNT blocks the first catches`);
      assert.ok(accessible.some(ore => ore.x < pivot), `${description}: no left-hand treasure route`);
      assert.ok(accessible.some(ore => ore.x > pivot), `${description}: no right-hand treasure route`);
      assert.ok(hits.some(ore => treasure(ore) && engine.ores.filter(item => item.kind === 'barrel').every(barrel => {
        const blast = engine.barrelBlastBounds(barrel);
        // Divide by the actual transformed radius so the same damage footprint
        // is checked after viewport adaptation.
        const scaleX = blast.radiusX / BARREL_BLAST_RADIUS, scaleY = blast.radiusY / BARREL_BLAST_RADIUS;
        return Math.hypot((ore.x - barrel.x) / scaleX, (ore.y - barrel.y) / scaleY) > BARREL_BLAST_RADIUS + ore.radius;
      })), `${description}: no safe first catch`);
    }
  }
});

test('TNT itself stays reachable after taking obstructing prizes instead of being decorative in a corner', () => {
  for (const { label, level } of layouts) for (const viewport of viewports) for (const playerCount of [1, 2]) {
    const engine = new MineEngine(level, { playerCount });
    engine.setViewport(viewport);
    const unseen = new Set(engine.ores.filter(ore => ore.kind === 'barrel'));
    for (let depth = 0; unseen.size && depth < level.ores.length; depth++) {
      const hits = new Set(engine.players.flatMap(player => [...firstHits(engine, player.id)]));
      for (const ore of hits) {
        unseen.delete(ore);
        // Remove the frontmost catch only, then rescan. This preserves real
        // foreground occlusion instead of checking aim-at-centre alone.
        ore.removed = true;
      }
      if (!hits.size) break;
    }
    assert.equal(unseen.size, 0, `${label}, ${viewport.width}×${viewport.height}, ${playerCount} players: unreachable TNT`);
  }
});
