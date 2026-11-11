import { Track, TRACK_CONTROL_POINTS, type Point } from './track';

export const WIDTH = 1120;
export const HEIGHT = 700;
export const BALL_RADIUS = 17;
export const DIAMETER = BALL_RADIUS * 2;
export const SHOOTER = { x: 560, y: 360 } as const;
export const FIXED_STEP = 1 / 120;
export const WILD_COLOR = 4;
export const WILD_CHANCE = 0.04;
export const WILD_MIN_NORMAL_AMMO = 8;
const CONTACT_EPSILON = 0.2;
const SHOT_COOLDOWN = 0.2;
const PROJECTILE_SPEED = 1080;
const PULL_SPEED = 190;

export type Color = 0 | 1 | 2 | 3;
export type AmmoColor = Color | typeof WILD_COLOR;
export interface Ball { id: number; color: Color; s: number }
export interface Projectile { id: number; color: AmmoColor; x: number; y: number; vx: number; vy: number }
export interface GameEvent {
  type: 'shot' | 'pop' | 'combo' | 'win' | 'lose';
  x: number;
  y: number;
  color?: AmmoColor;
  count?: number;
  combo?: number;
  points?: number;
}

/** Mulberry32: the same seed and inputs reproduce the same level and ammunition. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** First segment/circle intersection, including a segment starting inside. */
export function sweptCircleHit(from: Point, to: Point, center: Point, radius: number): number | null {
  const x = from.x - center.x;
  const y = from.y - center.y;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (x * dx + y * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Inclusive indices; equal colors across a physical gap are separate runs. */
export function findConnectedRun(balls: readonly Ball[], index: number, tolerance = CONTACT_EPSILON): { start: number; end: number } {
  if (index < 0 || index >= balls.length) return { start: -1, end: -1 };
  const color = balls[index]!.color;
  let start = index;
  let end = index;
  while (start > 0 && balls[start - 1]!.color === color && balls[start]!.s - balls[start - 1]!.s <= DIAMETER + tolerance) start -= 1;
  while (end < balls.length - 1 && balls[end + 1]!.color === color && balls[end + 1]!.s - balls[end]!.s <= DIAMETER + tolerance) end += 1;
  return { start, end };
}

interface Segment { start: number; end: number; velocity: number }

export interface GameOptions {
  seed?: number;
  totalBalls?: number;
  trackPoints?: readonly Point[];
  speed?: number;
  maxSpeed?: number;
  /** World pixels / second gained for each second of active play. */
  acceleration?: number;
  /** Ease the approach to the exit without changing projectile or pull speed. */
  dangerSlowdown?: boolean;
  /** Rare rainbow ammunition; chain marbles always keep their normal colors. */
  wildcards?: boolean;
}

/** Framework-independent fixed-step simulation. Distances grow toward the exit. */
export class GameModel {
  readonly track: Track;
  balls: Ball[] = [];
  projectiles: Projectile[] = [];
  currentColor: AmmoColor = 0;
  nextColor: AmmoColor = 1;
  score = 0;
  bestCombo = 0;
  spawned = 0;
  totalBalls: number;
  status: 'ready' | 'playing' | 'paused' | 'won' | 'lost' = 'ready';
  elapsed = 0;
  private readonly seed: number;
  private readonly speed: number;
  private readonly maxSpeed: number;
  private readonly acceleration: number;
  private readonly dangerSlowdown: boolean;
  private readonly wildcards: boolean;
  private ammoSinceWildcard = 0;
  private random: () => number;
  private sequence: Color[] = [];
  private nextId = 1;
  private accumulator = 0;
  private cooldown = 0;
  private pendingEvents: GameEvent[] = [];
  // Keys identify the two surviving balls on either side of a removed group.
  private readonly gapCombos = new Map<string, number>();

  constructor(options: GameOptions = {}) {
    this.track = new Track(options.trackPoints ?? TRACK_CONTROL_POINTS);
    this.seed = options.seed ?? 74219;
    this.totalBalls = Math.max(1, Math.floor(options.totalBalls ?? 78));
    this.speed = Math.max(0, Number.isFinite(options.speed) ? options.speed! : 26);
    this.maxSpeed = Math.max(this.speed, Number.isFinite(options.maxSpeed) ? options.maxSpeed! : this.speed);
    this.acceleration = Math.max(0, Number.isFinite(options.acceleration) ? options.acceleration! : 0);
    this.dangerSlowdown = options.dangerSlowdown === true;
    this.wildcards = options.wildcards === true;
    this.random = createSeededRandom(this.seed);
    this.reset();
  }

  /** Actual forward speed; active elapsed time alone determines the speed ramp. */
  get currentSpeed(): number {
    const speed = Math.min(this.maxSpeed, this.speed + this.acceleration * this.elapsed);
    if (!this.dangerSlowdown || this.balls.length === 0) return speed;
    const head = this.balls[this.balls.length - 1]!;
    const approach = Math.max(0, Math.min(1, (head.s / this.track.length - 0.78) / 0.17));
    const ease = approach * approach * (3 - 2 * approach);
    return speed * (1 - 0.42 * ease);
  }

  start(): void {
    if (this.status === 'ready') this.status = 'playing';
  }

  restart(): void {
    this.reset();
    this.start();
  }

  pause(): void { if (this.status === 'playing') this.status = 'paused'; }
  resume(): void { if (this.status === 'paused') this.status = 'playing'; }
  swap(): boolean {
    if (!['ready', 'playing', 'paused'].includes(this.status) || this.currentColor === this.nextColor) return false;
    [this.currentColor, this.nextColor] = [this.nextColor, this.currentColor];
    return true;
  }

  fire(targetX: number, targetY: number): boolean {
    if (this.status !== 'playing' || this.cooldown > 1e-8 || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return false;
    const dx = targetX - SHOOTER.x;
    const dy = targetY - SHOOTER.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return false;
    const x = SHOOTER.x + dx / length * 44;
    const y = SHOOTER.y + dy / length * 44;
    this.projectiles.push({ id: this.nextId++, color: this.currentColor, x, y, vx: dx / length * PROJECTILE_SPEED, vy: dy / length * PROJECTILE_SPEED });
    this.pendingEvents.push({ type: 'shot', x, y, color: this.currentColor });
    this.currentColor = this.nextColor;
    this.nextColor = this.pickColor();
    this.cooldown = SHOT_COOLDOWN;
    return true;
  }

  step(dt: number): GameEvent[] {
    const events = this.pendingEvents.splice(0);
    if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return events;
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= FIXED_STEP && this.status === 'playing') {
      this.accumulator -= FIXED_STEP;
      this.tick(FIXED_STEP, events);
    }
    return events;
  }

  private reset(): void {
    this.random = createSeededRandom(this.seed);
    this.sequence = [];
    let previous: Color | undefined;
    while (this.sequence.length < this.totalBalls) {
      let color = Math.floor(this.random() * 4) as Color;
      if (color === previous) color = ((color + 1 + Math.floor(this.random() * 3)) % 4) as Color;
      const count = this.random() < 0.72 ? 2 : 3;
      for (let index = 0; index < count && this.sequence.length < this.totalBalls; index += 1) this.sequence.push(color);
      previous = color;
    }
    this.balls = [];
    this.projectiles = [];
    this.pendingEvents = [];
    this.gapCombos.clear();
    this.nextId = 1;
    this.score = 0;
    this.bestCombo = 0;
    this.spawned = 0;
    this.elapsed = 0;
    this.cooldown = 0;
    this.accumulator = 0;
    this.status = 'ready';
    this.ammoSinceWildcard = 0;
    // Sequence order follows generation: the first generated ball is in front.
    const initialCount = Math.min(22, this.totalBalls);
    for (let index = 0; index < initialCount; index += 1) {
      this.balls.unshift({ id: this.nextId++, color: this.sequence[this.spawned++]!, s: (initialCount - index - 1) * DIAMETER });
    }
    this.currentColor = this.pickColor();
    this.nextColor = this.pickColor();
  }

  private tick(dt: number, events: GameEvent[]): void {
    this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const previousPositions = new Map(this.balls.map(ball => [ball.id, { ...this.track.pointAt(ball.s), s: ball.s }]));
    this.moveChain(dt, events);
    this.moveProjectiles(dt, previousPositions, events);
    this.spawnBall();
    this.refreshAmmo();
    if (this.balls.length === 0 && this.spawned >= this.totalBalls) {
      this.status = 'won';
      this.projectiles = [];
      events.push({ type: 'win', ...this.track.pointAt(this.track.length), points: this.score });
    } else if (this.balls.some(ball => ball.s >= this.track.length)) {
      this.status = 'lost';
      this.projectiles = [];
      events.push({ type: 'lose', ...this.track.pointAt(this.track.length) });
    }
  }

  private moveChain(dt: number, events: GameEvent[]): void {
    if (this.balls.length === 0) return;
    const forwardSpeed = this.currentSpeed;
    const segments: Segment[] = [];
    let start = 0;
    for (let index = 1; index <= this.balls.length; index += 1) {
      if (index === this.balls.length || this.balls[index]!.s - this.balls[index - 1]!.s > DIAMETER + CONTACT_EPSILON) {
        let velocity = forwardSpeed;
        if (start > 0) velocity = this.balls[start - 1]!.color === this.balls[start]!.color ? -PULL_SPEED : 0;
        segments.push({ start, end: index - 1, velocity });
        start = index;
      }
    }
    for (const segment of segments) {
      for (let index = segment.start; index <= segment.end; index += 1) this.balls[index]!.s += segment.velocity * dt;
    }
    const contacts: { rearId: number; frontId: number; combo: number }[] = [];
    for (let index = 1; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const rear = this.balls[segment.start - 1]!;
      const front = this.balls[segment.start]!;
      if (front.s - rear.s <= DIAMETER + CONTACT_EPSILON) {
        const correction = rear.s + DIAMETER - front.s;
        for (let ballIndex = segment.start; ballIndex <= segment.end; ballIndex += 1) this.balls[ballIndex]!.s += correction;
        const key = this.gapKey(rear.id, front.id);
        contacts.push({ rearId: rear.id, frontId: front.id, combo: this.gapCombos.get(key) ?? 1 });
        this.gapCombos.delete(key);
      }
    }
    // Resolve contacts in entry-to-exit order. A removed ball invalidates later contacts.
    for (const contact of contacts) {
      const index = this.balls.findIndex(ball => ball.id === contact.frontId);
      if (index > 0 && this.balls[index - 1]!.id === contact.rearId && this.balls[index]!.color === this.balls[index - 1]!.color) {
        this.popAt(index, contact.combo, events);
      }
    }
  }

  private moveProjectiles(dt: number, previousPositions: ReadonlyMap<number, Point & { s: number }>, events: GameEvent[]): void {
    const survivors: Projectile[] = [];
    for (const projectile of this.projectiles) {
      const from = { x: projectile.x, y: projectile.y };
      const to = { x: from.x + projectile.vx * dt, y: from.y + projectile.vy * dt };
      let earliest = Infinity;
      let hitIndex = -1;
      let impactCenter: Point | undefined;
      let impactDistance = 0;
      for (let index = 0; index < this.balls.length; index += 1) {
        const ball = this.balls[index]!;
        const current = this.track.pointAt(ball.s);
        const previous = previousPositions.get(ball.id) ?? { ...current, s: ball.s };
        const hit = sweptCircleHit(
          { x: from.x - previous.x, y: from.y - previous.y },
          { x: to.x - current.x, y: to.y - current.y },
          { x: 0, y: 0 }, DIAMETER,
        );
        if (hit !== null && hit < earliest) {
          earliest = hit;
          hitIndex = index;
          impactCenter = { x: previous.x + (current.x - previous.x) * hit, y: previous.y + (current.y - previous.y) * hit };
          impactDistance = previous.s + (ball.s - previous.s) * hit;
        }
      }
      if (hitIndex >= 0 && impactCenter) {
        this.insertProjectile(projectile, hitIndex, { x: from.x + (to.x - from.x) * earliest, y: from.y + (to.y - from.y) * earliest }, impactCenter, impactDistance, events);
      } else if (to.x > -60 && to.x < WIDTH + 60 && to.y > -60 && to.y < HEIGHT + 60) {
        projectile.x = to.x;
        projectile.y = to.y;
        survivors.push(projectile);
      }
    }
    this.projectiles = survivors;
  }

  private insertProjectile(projectile: Projectile, hitIndex: number, hitPoint: Point, impactCenter: Point, impactDistance: number, events: GameEvent[]): void {
    const hitColor = this.balls[hitIndex]!.color;
    const tangent = this.track.tangentAt(impactDistance);
    const along = (hitPoint.x - impactCenter.x) * tangent.x + (hitPoint.y - impactCenter.y) * tangent.y;
    // A perpendicular/central shot has a stable front-side fallback.
    const insertIndex = hitIndex + (along >= -0.01 ? 1 : 0);
    const rear = this.balls[insertIndex - 1];
    const front = this.balls[insertIndex];
    let s: number;
    if (!rear) s = front!.s - DIAMETER;
    else if (!front) s = rear.s + DIAMETER;
    else if (front.s - rear.s >= DIAMETER * 2) s = along >= -0.01 ? rear.s + DIAMETER : front.s - DIAMETER;
    else s = rear.s + DIAMETER;
    const newBall: Ball = { id: projectile.id, color: projectile.color === WILD_COLOR ? hitColor : projectile.color, s };
    if (rear && front) this.gapCombos.delete(this.gapKey(rear.id, front.id));
    this.balls.splice(insertIndex, 0, newBall);
    for (let index = insertIndex + 1; index < this.balls.length; index += 1) {
      const before = this.balls[index - 1]!;
      const after = this.balls[index]!;
      if (after.s >= before.s + DIAMETER) break;
      after.s = before.s + DIAMETER;
    }
    if (projectile.color === WILD_COLOR) {
      // Use the best connected neighboring color. Physical gaps still divide
      // runs, and a rainbow never remains as a fifth color in the chain.
      let bestColor = hitColor;
      let bestCount = 0;
      for (const color of new Set([hitColor, rear?.color, front?.color])) {
        if (color === undefined) continue;
        newBall.color = color;
        const run = findConnectedRun(this.balls, insertIndex);
        const count = run.end - run.start + 1;
        if (count > bestCount) { bestCount = count; bestColor = color; }
      }
      newBall.color = bestColor;
    }
    this.popAt(insertIndex, 1, events);
    this.pruneGapCombos();
  }

  private popAt(index: number, combo: number, events: GameEvent[]): boolean {
    const run = findConnectedRun(this.balls, index);
    const count = run.end - run.start + 1;
    if (run.start < 0 || count < 3) return false;
    const removed = this.balls.slice(run.start, run.end + 1);
    const middle = removed[Math.floor(removed.length / 2)]!;
    const position = this.track.pointAt(middle.s);
    const rear = this.balls[run.start - 1];
    const front = this.balls[run.end + 1];
    const points = count * 10 * combo;
    this.balls.splice(run.start, count);
    this.score += points;
    this.bestCombo = Math.max(this.bestCombo, combo);
    this.pruneGapCombos();
    if (rear && front) this.gapCombos.set(this.gapKey(rear.id, front.id), combo + 1);
    events.push({ type: 'pop', ...position, color: middle.color, count, combo, points });
    if (combo > 1) events.push({ type: 'combo', ...position, count, combo, points });
    return true;
  }

  private spawnBall(): void {
    if (this.spawned >= this.totalBalls) return;
    const tail = this.balls[0];
    if (!tail || tail.s >= DIAMETER) {
      this.balls.unshift({ id: this.nextId++, color: this.sequence[this.spawned] ?? (Math.floor(this.random() * 4) as Color), s: tail ? tail.s - DIAMETER : 0 });
      this.spawned += 1;
    }
  }

  private availableColors(): Color[] {
    const colors = new Set<Color>(this.balls.map(ball => ball.color));
    if (colors.size === 0) for (let index = this.spawned; index < this.sequence.length; index += 1) colors.add(this.sequence[index]!);
    return [...colors].sort();
  }

  private pickColor(): AmmoColor {
    const colors = this.availableColors();
    let roll = this.random();
    if (this.wildcards && this.ammoSinceWildcard >= WILD_MIN_NORMAL_AMMO) {
      if (roll < WILD_CHANCE) { this.ammoSinceWildcard = 0; return WILD_COLOR; }
      roll = (roll - WILD_CHANCE) / (1 - WILD_CHANCE);
    }
    this.ammoSinceWildcard = Math.min(WILD_MIN_NORMAL_AMMO, this.ammoSinceWildcard + 1);
    return colors[Math.floor(roll * colors.length)] ?? 0;
  }

  private refreshAmmo(): void {
    const colors = this.availableColors();
    if (colors.length === 0) return;
    if (this.currentColor !== WILD_COLOR && !colors.includes(this.currentColor)) this.currentColor = this.pickColor();
    if (this.nextColor !== WILD_COLOR && !colors.includes(this.nextColor)) this.nextColor = this.pickColor();
  }

  private gapKey(rearId: number, frontId: number): string { return `${rearId}:${frontId}`; }

  private pruneGapCombos(): void {
    const adjacentKeys = new Set<string>();
    for (let index = 1; index < this.balls.length; index += 1) adjacentKeys.add(this.gapKey(this.balls[index - 1]!.id, this.balls[index]!.id));
    for (const key of this.gapCombos.keys()) if (!adjacentKeys.has(key)) this.gapCombos.delete(key);
  }
}
