import { describe, expect, it } from 'vitest';
import {
  DIAMETER,
  GameModel,
  createSeededRandom,
  findConnectedRun,
  sweptCircleHit,
  type Color,
  type GameEvent,
} from '../src/game/model';

const STEP = 1 / 120;
let projectileId = 9000;

function fixture(speed = 0) {
  const game = new GameModel({ seed: 731, totalBalls: 24, speed });
  game.start();
  game.balls = [];
  game.projectiles = [];
  game.spawned = game.totalBalls;
  return game;
}

function setChain(game: GameModel, colors: Color[], start = 420) {
  game.balls = colors.map((color, index) => ({
    id: 100 + index,
    color,
    s: start + index * DIAMETER,
  }));
}

function hit(game: GameModel, index: number, color: Color) {
  const point = game.track.pointAt(game.balls[index]!.s);
  const tangent = game.track.tangentAt(game.balls[index]!.s);
  const magnitude = Math.hypot(tangent.x, tangent.y);
  const nx = -tangent.y / magnitude;
  const ny = tangent.x / magnitude;
  // The projectile crosses a complete ball during a single simulation step.
  game.projectiles.push({
    id: projectileId++,
    color,
    x: point.x + nx * 150,
    y: point.y + ny * 150,
    vx: -nx * 36000,
    vy: -ny * 36000,
  });
  return game.step(STEP);
}

function advance(game: GameModel, seconds: number) {
  const events: GameEvent[] = [];
  for (let index = 0; index < Math.ceil(seconds / STEP); index += 1) {
    events.push(...game.step(STEP));
  }
  return events;
}

function state(game: GameModel) {
  return {
    balls: game.balls.map((ball) => ({ ...ball })),
    projectiles: game.projectiles.map((projectile) => ({ ...projectile })),
    currentColor: game.currentColor,
    nextColor: game.nextColor,
    spawned: game.spawned,
    score: game.score,
    bestCombo: game.bestCombo,
    elapsed: game.elapsed,
  };
}

describe('swept projectile collision', () => {
  it('finds the first intersection even when both endpoints miss the ball', () => {
    expect(sweptCircleHit({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, 20))
      .toBeCloseTo(0.4, 8);
  });

  it('handles tangent hits, misses, and a stationary projectile', () => {
    expect(sweptCircleHit({ x: -10, y: 5 }, { x: 10, y: 5 }, { x: 0, y: 0 }, 5))
      .toBeCloseTo(0.5, 8);
    expect(sweptCircleHit({ x: -10, y: 6 }, { x: 10, y: 6 }, { x: 0, y: 0 }, 5))
      .toBeNull();
    expect(sweptCircleHit({ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, 5)).toBe(0);
    expect(sweptCircleHit({ x: 6, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 0 }, 5)).toBeNull();
  });

  it('inserts exactly one projectile when a fast shot crosses the chain', () => {
    const game = fixture();
    setChain(game, [0]);
    hit(game, 0, 1);
    expect(game.projectiles).toHaveLength(0);
    expect(game.balls).toHaveLength(2);
    expect(game.balls.map((ball) => ball.color).sort()).toEqual([0, 1]);
    expect(game.balls[1]!.s - game.balls[0]!.s).toBeCloseTo(DIAMETER, 5);
  });

  it('chooses the earliest physical hit instead of the first ball in array order', () => {
    const game = fixture();
    setChain(game, [0, 1]);
    const from = game.track.pointAt(420 + DIAMETER * 3);
    const to = game.track.pointAt(420 - DIAMETER * 2);
    game.projectiles.push({
      id: projectileId++, color: 2, ...from,
      vx: (to.x - from.x) / STEP, vy: (to.y - from.y) / STEP,
    });
    game.step(STEP);
    expect(game.balls.map((ball) => ball.color)).toEqual([0, 1, 2]);
  });

  it('detects a moving ball crossing a projectile between simulation endpoints', () => {
    const game = fixture(14400);
    setChain(game, [0]);
    const middle = game.track.pointAt(480);
    game.projectiles.push({ id: projectileId++, color: 1, ...middle, vx: 0, vy: 0 });
    game.step(STEP);
    expect(game.projectiles).toHaveLength(0);
    expect(game.balls).toHaveLength(2);
  });

  it('chooses the insertion side relative to the ball at impact time', () => {
    const game = fixture(1200);
    setChain(game, [0]);
    const middle = game.track.pointAt(425);
    const tangent = game.track.tangentAt(425);
    const nx = -tangent.y;
    const ny = tangent.x;
    // The ball travels s=420→430. At first contact it is behind this shot;
    // its end-of-step position is already ahead of the same impact point.
    game.projectiles.push({
      id: projectileId++, color: 1,
      x: middle.x + nx * 150, y: middle.y + ny * 150,
      vx: -nx * 36000, vy: -ny * 36000,
    });
    game.step(STEP);
    expect(game.balls.map((ball) => ball.color)).toEqual([0, 1]);
  });
});

describe('track and deterministic simulation', () => {
  it('maps equal arc distances to nearly equal travel distances around bends', () => {
    const game = fixture();
    expect(game.track.length).toBeGreaterThan(1500);
    for (let index = 0; index <= 80; index += 1) {
      const s = ((game.track.length - 8) * index) / 80;
      const a = game.track.pointAt(s);
      const b = game.track.pointAt(s + 8);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(7.6);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(8.02);
      const tangent = game.track.tangentAt(s);
      expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1, 2);
    }
  });

  it('repeats a seeded random sequence', () => {
    const first = createSeededRandom(907);
    const second = createSeededRandom(907);
    const other = createSeededRandom(908);
    const sequence = Array.from({ length: 30 }, first);
    expect(Array.from({ length: 30 }, second)).toEqual(sequence);
    expect(Array.from({ length: 30 }, other)).not.toEqual(sequence);
    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('produces the same state at 60 and 120 render updates per second', () => {
    const first = new GameModel({ seed: 321, totalBalls: 90, speed: 26 });
    const second = new GameModel({ seed: 321, totalBalls: 90, speed: 26 });
    first.start();
    second.start();
    for (let index = 0; index < 240; index += 1) first.step(STEP);
    for (let index = 0; index < 120; index += 1) second.step(1 / 60);
    expect(state(second)).toEqual(state(first));
  });
});

describe('connected groups, insertion, and chain reactions', () => {
  it('does not count same-colored balls across a physical gap', () => {
    const balls = [
      { id: 1, color: 0 as Color, s: 100 },
      { id: 2, color: 0 as Color, s: 100 + DIAMETER },
      { id: 3, color: 0 as Color, s: 100 + DIAMETER * 3 },
    ];
    expect(findConnectedRun(balls, 1)).toEqual({ start: 0, end: 1 });
    expect(findConnectedRun(balls, 2)).toEqual({ start: 2, end: 2 });
  });

  it('keeps a pair, then removes all three when a third matching ball hits', () => {
    const game = fixture();
    setChain(game, [0]);
    hit(game, 0, 0);
    expect(game.balls).toHaveLength(2);
    expect(game.score).toBe(0);
    hit(game, 0, 0);
    expect(game.balls).toHaveLength(0);
    expect(game.score).toBe(30);
    expect(game.status).toBe('won');
  });

  it('removes an entire connected group larger than three', () => {
    const game = fixture();
    setChain(game, [1, 1, 1]);
    hit(game, 1, 1);
    expect(game.balls).toHaveLength(0);
    expect(game.score).toBe(40);
  });

  it('preserves the gap until matching boundaries meet, then awards the next combo', () => {
    const game = fixture();
    setChain(game, [0, 0, 1, 1, 0]);
    const events = hit(game, 2, 1);
    expect(game.balls.map((ball) => ball.color)).toEqual([0, 0, 0]);
    expect(game.balls[2]!.s - game.balls[1]!.s).toBeGreaterThan(DIAMETER);
    expect(game.score).toBe(30);
    events.push(...advance(game, 4));
    expect(game.balls).toHaveLength(0);
    expect(game.status).toBe('won');
    expect(game.score).toBe(90);
    expect(game.bestCombo).toBe(2);
    expect(events.filter((event) => event.type === 'pop')).toHaveLength(2);
  });

  it('keeps only two matching boundary balls after they close', () => {
    const game = fixture();
    setChain(game, [0, 1, 1, 0]);
    hit(game, 1, 1);
    advance(game, 4);
    expect(game.balls.map((ball) => ball.color)).toEqual([0, 0]);
    expect(game.balls[1]!.s - game.balls[0]!.s).toBeCloseTo(DIAMETER, 5);
    expect(game.score).toBe(30);
    expect(game.status).toBe('playing');
  });

  it('closes different-colored boundaries without eliminating them', () => {
    const game = fixture(30);
    setChain(game, [0, 0, 1, 1, 2, 2]);
    hit(game, 2, 1);
    advance(game, 5);
    expect(game.balls.map((ball) => ball.color)).toEqual([0, 0, 2, 2]);
    for (let index = 1; index < game.balls.length; index += 1) {
      expect(game.balls[index]!.s - game.balls[index - 1]!.s).toBeCloseTo(DIAMETER, 5);
    }
    expect(game.score).toBe(30);
    expect(game.bestCombo).toBe(1);
  });

  it('settles three successive clears once each with 1x, 2x, and 3x scoring', () => {
    const game = fixture();
    setChain(game, [0, 0, 1, 1, 2, 2, 1, 0]);
    const events = hit(game, 4, 2);
    events.push(...advance(game, 6));
    expect(game.balls).toHaveLength(0);
    expect(game.score).toBe(180);
    expect(game.bestCombo).toBe(3);
    expect(events.filter((event) => event.type === 'pop')).toHaveLength(3);
    advance(game, 2);
    expect(game.score).toBe(180);
  });

  it('allows a new shot during recall and scores that independent clear at 1x', () => {
    const game = fixture();
    setChain(game, [0, 0, 1, 1, 0]);
    hit(game, 2, 1);
    hit(game, 0, 0);
    advance(game, 2);
    expect(game.balls.map((ball) => ball.color)).toEqual([0]);
    expect(game.score).toBe(60);
    expect(game.bestCombo).toBe(1);
    expect(game.status).toBe('playing');
  });
});

describe('lifecycle and terminal rules', () => {
  it('freezes balls, projectiles, spawning, and elapsed time while paused', () => {
    const game = new GameModel({ seed: 42, totalBalls: 60, speed: 25 });
    game.start();
    game.fire(300, 100);
    game.step(STEP);
    game.pause();
    const paused = state(game);
    expect(game.status).toBe('paused');
    expect(game.step(10)).toEqual([]);
    expect(state(game)).toEqual(paused);
    game.resume();
    game.step(STEP);
    expect(game.status).toBe('playing');
    expect(game.elapsed).toBeGreaterThan(paused.elapsed);
  });

  it('restarts with a fresh deterministic chain and clears score and projectiles', () => {
    const game = new GameModel({ seed: 42, totalBalls: 60, speed: 25 });
    const initialColors = game.balls.map((ball) => ball.color);
    game.start();
    game.fire(300, 100);
    advance(game, 0.2);
    game.score = 120;
    game.bestCombo = 3;
    game.restart();
    expect(game.balls.map((ball) => ball.color)).toEqual(initialColors);
    expect(game.projectiles).toHaveLength(0);
    expect(game.score).toBe(0);
    expect(game.bestCombo).toBe(0);
    expect(game.elapsed).toBe(0);
    expect(game.status).toBe('playing');
  });

  it('waits for unspawned balls instead of winning an empty track early', () => {
    const game = fixture();
    game.spawned = game.totalBalls - 1;
    game.step(STEP);
    expect(game.status).toBe('playing');
  });

  it('wins only after the complete generated chain has been cleared', () => {
    const game = fixture();
    game.projectiles.push({ id: 8000, color: 2, x: 20, y: 20, vx: 1, vy: 1 });
    game.step(STEP);
    expect(game.status).toBe('won');
    expect(game.projectiles).toHaveLength(0);
  });

  it('loses when a surviving ball center reaches the track endpoint', () => {
    const game = fixture();
    setChain(game, [0], game.track.length);
    game.step(STEP);
    expect(game.status).toBe('lost');
  });

  it('resolves a saving elimination before endpoint failure in the same step', () => {
    const game = fixture();
    setChain(game, [0, 0], game.track.length - DIAMETER);
    hit(game, 1, 0);
    expect(game.balls).toHaveLength(0);
    expect(game.status).toBe('won');
    expect(game.score).toBe(30);
  });

  it('restricts late-game ammunition to colors still present', () => {
    const game = fixture();
    setChain(game, [2, 2]);
    game.currentColor = 0;
    game.nextColor = 1;
    game.step(STEP);
    expect(game.currentColor).toBe(2);
    expect(game.nextColor).toBe(2);
  });
});
