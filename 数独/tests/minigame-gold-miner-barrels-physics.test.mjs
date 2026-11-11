import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MineEngine, PHYSICS, BARREL_BLAST_RADIUS } = require('../../微信小程序/src/games/gold-miner/core/engine.js');
const { ORE_TYPES, BARREL_BLAST_RADIUS: LEVEL_BLAST_RADIUS } = require('../../微信小程序/src/games/gold-miner/core/levels.js');
const { mineScale } = require('../../微信小程序/src/games/gold-miner/core/viewport.js');
const STEP = 1 / 120;

function ore(id, x, y, kind = 'goldLarge', motion) {
  return { id, x, y, kind, radius: ORE_TYPES[kind].radius, ...(motion ? { motion } : {}) };
}
function engine(ores, options) {
  return new MineEngine({ id: 1, name: '爆炸边界矿场', subtitle: '', target: 9999, duration: 60, ores, palette: 'ochre' }, options);
}
function attack(mine, target, playerIndex = 0, contactTime = 0) {
  const player = mine.players[playerIndex];
  const geometry = mine.playerGeometry(playerIndex);
  const x = target.x - geometry.pivotX, y = target.y - geometry.pivotY;
  player.angle = Math.atan2(x, y);
  player.rope = Math.hypot(x, y) - target.radius - PHYSICS.headRadius - PHYSICS.launchSpeed * geometry.speedScale * contactTime;
  assert.ok(player.rope >= geometry.minRope);
  assert.equal(mine.launch(playerIndex), true);
}
const removed = mine => mine.ores.filter(item => item.removed).map(item => item.id).sort();

test('TNT touches destroy the edge of gold, diamond, rock and moving ore, while a small gap survives', () => {
  const barrel = ore('barrel', 640, 400, 'barrel');
  const items = [barrel];
  const kinds = ['goldLarge', 'diamond', 'rockSmall', 'diamondPig'];
  kinds.forEach((kind, index) => {
    // Put targets around the sides and below the barrel, away from the hook ray.
    const angle = index * Math.PI / 3;
    for (const [label, gap] of [['touch', -1e-5], ['clear', 0.01]]) {
      const distance = BARREL_BLAST_RADIUS + ORE_TYPES[kind].radius + gap;
      const x = barrel.x + Math.cos(angle) * distance, y = barrel.y + Math.sin(angle) * distance;
      items.push(ore(`${kind}-${label}`, x, y, kind, kind === 'diamondPig' ? { left: x, right: x + 1, speed: 1 } : undefined));
    }
  });
  const mine = engine(items);
  attack(mine, mine.ores[0]); mine.update(STEP);
  assert.deepEqual(removed(mine), ['barrel', ...kinds.map(kind => `${kind}-touch`)].sort());
  assert.equal(mine.income, 0);
  assert.equal(mine.players[0].income, 0);
});

test('TNT cycles explode each barrel once and destroy neighbors beyond the first blast', () => {
  const mine = engine([
    ore('a', 640, 400, 'barrel'), ore('b', 760, 400, 'barrel'), ore('c', 700, 500, 'barrel'),
    ore('far-from-a', 880, 400, 'diamond'), ore('safe', 1100, 600, 'goldLarge'),
  ]);
  attack(mine, mine.ores[0]); mine.update(STEP);
  assert.deepEqual(removed(mine), ['a', 'b', 'c', 'far-from-a']);
  const blasts = mine.drainEvents().filter(event => event.type === 'blast');
  assert.equal(blasts.length, 3);
  assert.equal(new Set(blasts.map(event => `${event.x},${event.y}`)).size, 3);
  mine.update(0.5);
  assert.equal(mine.drainEvents().filter(event => event.type === 'blast').length, 0);
  assert.equal(mine.income, 0);
});

test('a barrel hit returns an empty hook that can launch again without awarding blast income', () => {
  const mine = engine([ore('barrel', 640, 400, 'barrel'), ore('safe', 1000, 500, 'diamond')]);
  attack(mine, mine.ores[0]); mine.update(STEP);
  assert.equal(mine.phase, 'empty');
  assert.equal(mine.held, null);
  assert.equal(mine.income, 0);
  assert.equal(mine.canBomb, false);
  mine.update(1);
  assert.equal(mine.phase, 'swing');
  assert.equal(mine.launch(), true);
  assert.equal(mine.phase, 'out');
  assert.equal(mine.drainEvents().some(event => event.type === 'coin'), false);
});

test('moving ore is damaged at the blast instant instead of its frame-start or frame-end position', () => {
  const mine = engine([
    ore('barrel', 640, 400, 'barrel'),
    ore('leaving', 775, 400, 'pig', { left: 600, right: 1000, speed: 10000, direction: 1 }),
    ore('entering', 840, 400, 'pig', { left: 600, right: 1000, speed: 10000, direction: -1 }),
  ]);
  attack(mine, mine.ores[0], 0, 0.002); mine.update(STEP);
  assert.deepEqual(removed(mine), ['barrel', 'leaving']);
  assert.ok(Math.abs(mine.ores[1].x - 795) < 1e-6, 'destroyed actor stops at the instant of impact');
  assert.ok(mine.ores[2].x < 800, 'survivor is inside the spent blast by the end of the step');
});

test('a walking elf touching TNT triggers the same blast and cannot continue digging afterward', () => {
  const mine = engine([
    ore('barrel', 640, 400, 'barrel'),
    ore('elf', 590, 400, 'elf', { left: 500, right: 1000, speed: 1000, direction: 1 }),
    ore('diamond', 730, 400, 'diamond'), ore('safe', 1100, 600),
  ]);
  mine.update(STEP);
  assert.deepEqual(removed(mine), ['barrel', 'diamond', 'elf']);
  assert.ok(Math.abs(mine.ores[1].x - 591) < 1e-6);
  const events = mine.drainEvents();
  assert.equal(events.filter(event => event.type === 'blast').length, 1);
  assert.equal(events.some(event => event.type === 'dig' || event.type === 'coin'), false);
  assert.equal(mine.income, 0);
});

test('two hooks secure ore by arrival time, protect an earlier catch, and credit its delivery once', () => {
  const mine = engine([ore('barrel', 640, 400, 'barrel'), ore('gold', 730, 400), ore('safe', 1100, 600, 'diamond')], { playerCount: 2 });
  attack(mine, mine.ores[0], 0, 0.002);
  attack(mine, mine.ores[1], 1, 0.001);
  mine.update(STEP);
  assert.equal(mine.players[0].phase, 'empty');
  assert.equal(mine.players[1].held?.id, 'gold');
  assert.equal(mine.ores[1].removed, false);
  assert.equal(mine.ores[1].held, true);
  assert.equal(mine.income, 0, 'a secured catch still needs to reach the winch');
  mine.update(2);
  assert.equal(mine.income, ORE_TYPES.goldLarge.value);
  assert.equal(mine.players[0].income, 0);
  assert.equal(mine.players[1].income, ORE_TYPES.goldLarge.value);
  assert.equal(mine.drainEvents().filter(event => event.type === 'coin').length, 1);
  mine.update(1);
  assert.equal(mine.income, ORE_TYPES.goldLarge.value);
});

test('a blast arriving before the other hook prevents a later catch and any duplicate income', () => {
  const mine = engine([ore('barrel', 640, 400, 'barrel'), ore('gold', 730, 400), ore('safe', 1100, 600, 'diamond')], { playerCount: 2 });
  attack(mine, mine.ores[0], 0, 0.001);
  attack(mine, mine.ores[1], 1, 0.002);
  mine.update(STEP);
  assert.equal(mine.ores[1].removed, true);
  assert.equal(mine.players[1].held, null);
  mine.update(2);
  assert.equal(mine.income, 0);
  assert.equal(mine.drainEvents().some(event => event.type === 'coin'), false);
});

test('portrait and landscape warnings, damage, and explosion effects share the original-mine radius', () => {
  assert.equal(BARREL_BLAST_RADIUS, LEVEL_BLAST_RADIUS);
  const items = [ore('barrel', 640, 420, 'barrel'), ore('gold-edge', 817.999, 420), ore('diamond-clear', 795.001, 420, 'diamond'), ore('below', 640, 579, 'rockSmall')];
  const results = [];
  for (const viewport of [{ width: 1280, height: 720, portrait: false }, { width: 390, height: 844, portrait: true }]) {
    const mine = engine(items);
    mine.setViewport(viewport);
    const barrel = mine.ores[0];
    const bounds = mine.barrelBlastBounds(barrel);
    const scale = mineScale(viewport);
    assert.equal(bounds.x, barrel.x); assert.equal(bounds.y, barrel.y);
    assert.equal(bounds.radiusX, BARREL_BLAST_RADIUS * scale.x);
    assert.equal(bounds.radiusY, BARREL_BLAST_RADIUS * scale.y);
    attack(mine, barrel); mine.update(STEP);
    const blast = mine.drainEvents().find(event => event.type === 'blast');
    assert.deepEqual(blast, { type: 'blast', ...bounds });
    results.push(removed(mine));
  }
  assert.deepEqual(results[0], ['barrel', 'below', 'gold-edge']);
  assert.deepEqual(results[1], results[0]);
});
