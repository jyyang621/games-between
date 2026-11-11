/* Generated from vendor/zuma/model.ts; MIT, Marble Trail contributors. */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModel = exports.WILD_MIN_NORMAL_AMMO = exports.WILD_CHANCE = exports.WILD_COLOR = exports.FIXED_STEP = exports.SHOOTER = exports.DIAMETER = exports.BALL_RADIUS = exports.HEIGHT = exports.WIDTH = void 0;
exports.createSeededRandom = createSeededRandom;
exports.sweptCircleHit = sweptCircleHit;
exports.findConnectedRun = findConnectedRun;
const track_1 = require("./track");
exports.WIDTH = 1120;
exports.HEIGHT = 700;
exports.BALL_RADIUS = 17;
exports.DIAMETER = exports.BALL_RADIUS * 2;
exports.SHOOTER = { x: 560, y: 360 };
exports.FIXED_STEP = 1 / 120;
exports.WILD_COLOR = 4;
exports.WILD_CHANCE = 0.04;
exports.WILD_MIN_NORMAL_AMMO = 8;
const CONTACT_EPSILON = 0.2;
const SHOT_COOLDOWN = 0.2;
const PROJECTILE_SPEED = 1080;
const PULL_SPEED = 190;
/** Mulberry32: the same seed and inputs reproduce the same level and ammunition. */
function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
/** First segment/circle intersection, including a segment starting inside. */
function sweptCircleHit(from, to, center, radius) {
    const x = from.x - center.x;
    const y = from.y - center.y;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const c = x * x + y * y - radius * radius;
    if (c <= 0)
        return 0;
    const a = dx * dx + dy * dy;
    if (a < 1e-12)
        return null;
    const b = 2 * (x * dx + y * dy);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0)
        return null;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
}
/** Inclusive indices; equal colors across a physical gap are separate runs. */
function findConnectedRun(balls, index, tolerance = CONTACT_EPSILON) {
    if (index < 0 || index >= balls.length)
        return { start: -1, end: -1 };
    const color = balls[index].color;
    let start = index;
    let end = index;
    while (start > 0 && balls[start - 1].color === color && balls[start].s - balls[start - 1].s <= exports.DIAMETER + tolerance)
        start -= 1;
    while (end < balls.length - 1 && balls[end + 1].color === color && balls[end + 1].s - balls[end].s <= exports.DIAMETER + tolerance)
        end += 1;
    return { start, end };
}
/** Framework-independent fixed-step simulation. Distances grow toward the exit. */
class GameModel {
    constructor(options = {}) {
        var _a, _b, _c;
        this.balls = [];
        this.projectiles = [];
        this.currentColor = 0;
        this.nextColor = 1;
        this.score = 0;
        this.bestCombo = 0;
        this.spawned = 0;
        this.status = 'ready';
        this.elapsed = 0;
        this.ammoSinceWildcard = 0;
        this.sequence = [];
        this.nextId = 1;
        this.accumulator = 0;
        this.cooldown = 0;
        this.pendingEvents = [];
        // Keys identify the two surviving balls on either side of a removed group.
        this.gapCombos = new Map();
        this.track = new track_1.Track((_a = options.trackPoints) !== null && _a !== void 0 ? _a : track_1.TRACK_CONTROL_POINTS);
        this.seed = (_b = options.seed) !== null && _b !== void 0 ? _b : 74219;
        this.totalBalls = Math.max(1, Math.floor((_c = options.totalBalls) !== null && _c !== void 0 ? _c : 78));
        this.speed = Math.max(0, Number.isFinite(options.speed) ? options.speed : 26);
        this.maxSpeed = Math.max(this.speed, Number.isFinite(options.maxSpeed) ? options.maxSpeed : this.speed);
        this.acceleration = Math.max(0, Number.isFinite(options.acceleration) ? options.acceleration : 0);
        this.dangerSlowdown = options.dangerSlowdown === true;
        this.wildcards = options.wildcards === true;
        this.random = createSeededRandom(this.seed);
        this.reset();
    }
    /** Actual forward speed; active elapsed time alone determines the speed ramp. */
    get currentSpeed() {
        const speed = Math.min(this.maxSpeed, this.speed + this.acceleration * this.elapsed);
        if (!this.dangerSlowdown || this.balls.length === 0)
            return speed;
        const head = this.balls[this.balls.length - 1];
        const approach = Math.max(0, Math.min(1, (head.s / this.track.length - 0.78) / 0.17));
        const ease = approach * approach * (3 - 2 * approach);
        return speed * (1 - 0.42 * ease);
    }
    start() {
        if (this.status === 'ready')
            this.status = 'playing';
    }
    restart() {
        this.reset();
        this.start();
    }
    pause() { if (this.status === 'playing')
        this.status = 'paused'; }
    resume() { if (this.status === 'paused')
        this.status = 'playing'; }
    swap() {
        if (!['ready', 'playing', 'paused'].includes(this.status) || this.currentColor === this.nextColor)
            return false;
        [this.currentColor, this.nextColor] = [this.nextColor, this.currentColor];
        return true;
    }
    fire(targetX, targetY) {
        if (this.status !== 'playing' || this.cooldown > 1e-8 || !Number.isFinite(targetX) || !Number.isFinite(targetY))
            return false;
        const dx = targetX - exports.SHOOTER.x;
        const dy = targetY - exports.SHOOTER.y;
        const length = Math.hypot(dx, dy);
        if (length < 1)
            return false;
        const x = exports.SHOOTER.x + dx / length * 44;
        const y = exports.SHOOTER.y + dy / length * 44;
        this.projectiles.push({ id: this.nextId++, color: this.currentColor, x, y, vx: dx / length * PROJECTILE_SPEED, vy: dy / length * PROJECTILE_SPEED });
        this.pendingEvents.push({ type: 'shot', x, y, color: this.currentColor });
        this.currentColor = this.nextColor;
        this.nextColor = this.pickColor();
        this.cooldown = SHOT_COOLDOWN;
        return true;
    }
    step(dt) {
        const events = this.pendingEvents.splice(0);
        if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0)
            return events;
        this.accumulator += dt;
        while (this.accumulator + 1e-10 >= exports.FIXED_STEP && this.status === 'playing') {
            this.accumulator -= exports.FIXED_STEP;
            this.tick(exports.FIXED_STEP, events);
        }
        return events;
    }
    reset() {
        this.random = createSeededRandom(this.seed);
        this.sequence = [];
        let previous;
        while (this.sequence.length < this.totalBalls) {
            let color = Math.floor(this.random() * 4);
            if (color === previous)
                color = ((color + 1 + Math.floor(this.random() * 3)) % 4);
            const count = this.random() < 0.72 ? 2 : 3;
            for (let index = 0; index < count && this.sequence.length < this.totalBalls; index += 1)
                this.sequence.push(color);
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
            this.balls.unshift({ id: this.nextId++, color: this.sequence[this.spawned++], s: (initialCount - index - 1) * exports.DIAMETER });
        }
        this.currentColor = this.pickColor();
        this.nextColor = this.pickColor();
    }
    tick(dt, events) {
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
        }
        else if (this.balls.some(ball => ball.s >= this.track.length)) {
            this.status = 'lost';
            this.projectiles = [];
            events.push({ type: 'lose', ...this.track.pointAt(this.track.length) });
        }
    }
    moveChain(dt, events) {
        var _a;
        if (this.balls.length === 0)
            return;
        const forwardSpeed = this.currentSpeed;
        const segments = [];
        let start = 0;
        for (let index = 1; index <= this.balls.length; index += 1) {
            if (index === this.balls.length || this.balls[index].s - this.balls[index - 1].s > exports.DIAMETER + CONTACT_EPSILON) {
                let velocity = forwardSpeed;
                if (start > 0)
                    velocity = this.balls[start - 1].color === this.balls[start].color ? -PULL_SPEED : 0;
                segments.push({ start, end: index - 1, velocity });
                start = index;
            }
        }
        for (const segment of segments) {
            for (let index = segment.start; index <= segment.end; index += 1)
                this.balls[index].s += segment.velocity * dt;
        }
        const contacts = [];
        for (let index = 1; index < segments.length; index += 1) {
            const segment = segments[index];
            const rear = this.balls[segment.start - 1];
            const front = this.balls[segment.start];
            if (front.s - rear.s <= exports.DIAMETER + CONTACT_EPSILON) {
                const correction = rear.s + exports.DIAMETER - front.s;
                for (let ballIndex = segment.start; ballIndex <= segment.end; ballIndex += 1)
                    this.balls[ballIndex].s += correction;
                const key = this.gapKey(rear.id, front.id);
                contacts.push({ rearId: rear.id, frontId: front.id, combo: (_a = this.gapCombos.get(key)) !== null && _a !== void 0 ? _a : 1 });
                this.gapCombos.delete(key);
            }
        }
        // Resolve contacts in entry-to-exit order. A removed ball invalidates later contacts.
        for (const contact of contacts) {
            const index = this.balls.findIndex(ball => ball.id === contact.frontId);
            if (index > 0 && this.balls[index - 1].id === contact.rearId && this.balls[index].color === this.balls[index - 1].color) {
                this.popAt(index, contact.combo, events);
            }
        }
    }
    moveProjectiles(dt, previousPositions, events) {
        var _a;
        const survivors = [];
        for (const projectile of this.projectiles) {
            const from = { x: projectile.x, y: projectile.y };
            const to = { x: from.x + projectile.vx * dt, y: from.y + projectile.vy * dt };
            let earliest = Infinity;
            let hitIndex = -1;
            let impactCenter;
            let impactDistance = 0;
            for (let index = 0; index < this.balls.length; index += 1) {
                const ball = this.balls[index];
                const current = this.track.pointAt(ball.s);
                const previous = (_a = previousPositions.get(ball.id)) !== null && _a !== void 0 ? _a : { ...current, s: ball.s };
                const hit = sweptCircleHit({ x: from.x - previous.x, y: from.y - previous.y }, { x: to.x - current.x, y: to.y - current.y }, { x: 0, y: 0 }, exports.DIAMETER);
                if (hit !== null && hit < earliest) {
                    earliest = hit;
                    hitIndex = index;
                    impactCenter = { x: previous.x + (current.x - previous.x) * hit, y: previous.y + (current.y - previous.y) * hit };
                    impactDistance = previous.s + (ball.s - previous.s) * hit;
                }
            }
            if (hitIndex >= 0 && impactCenter) {
                this.insertProjectile(projectile, hitIndex, { x: from.x + (to.x - from.x) * earliest, y: from.y + (to.y - from.y) * earliest }, impactCenter, impactDistance, events);
            }
            else if (to.x > -60 && to.x < exports.WIDTH + 60 && to.y > -60 && to.y < exports.HEIGHT + 60) {
                projectile.x = to.x;
                projectile.y = to.y;
                survivors.push(projectile);
            }
        }
        this.projectiles = survivors;
    }
    insertProjectile(projectile, hitIndex, hitPoint, impactCenter, impactDistance, events) {
        const hitColor = this.balls[hitIndex].color;
        const tangent = this.track.tangentAt(impactDistance);
        const along = (hitPoint.x - impactCenter.x) * tangent.x + (hitPoint.y - impactCenter.y) * tangent.y;
        // A perpendicular/central shot has a stable front-side fallback.
        const insertIndex = hitIndex + (along >= -0.01 ? 1 : 0);
        const rear = this.balls[insertIndex - 1];
        const front = this.balls[insertIndex];
        let s;
        if (!rear)
            s = front.s - exports.DIAMETER;
        else if (!front)
            s = rear.s + exports.DIAMETER;
        else if (front.s - rear.s >= exports.DIAMETER * 2)
            s = along >= -0.01 ? rear.s + exports.DIAMETER : front.s - exports.DIAMETER;
        else
            s = rear.s + exports.DIAMETER;
        const newBall = { id: projectile.id, color: projectile.color === exports.WILD_COLOR ? hitColor : projectile.color, s };
        if (rear && front)
            this.gapCombos.delete(this.gapKey(rear.id, front.id));
        this.balls.splice(insertIndex, 0, newBall);
        for (let index = insertIndex + 1; index < this.balls.length; index += 1) {
            const before = this.balls[index - 1];
            const after = this.balls[index];
            if (after.s >= before.s + exports.DIAMETER)
                break;
            after.s = before.s + exports.DIAMETER;
        }
        if (projectile.color === exports.WILD_COLOR) {
            // Use the best connected neighboring color. Physical gaps still divide
            // runs, and a rainbow never remains as a fifth color in the chain.
            let bestColor = hitColor;
            let bestCount = 0;
            for (const color of new Set([hitColor, rear === null || rear === void 0 ? void 0 : rear.color, front === null || front === void 0 ? void 0 : front.color])) {
                if (color === undefined)
                    continue;
                newBall.color = color;
                const run = findConnectedRun(this.balls, insertIndex);
                const count = run.end - run.start + 1;
                if (count > bestCount) {
                    bestCount = count;
                    bestColor = color;
                }
            }
            newBall.color = bestColor;
        }
        this.popAt(insertIndex, 1, events);
        this.pruneGapCombos();
    }
    popAt(index, combo, events) {
        const run = findConnectedRun(this.balls, index);
        const count = run.end - run.start + 1;
        if (run.start < 0 || count < 3)
            return false;
        const removed = this.balls.slice(run.start, run.end + 1);
        const middle = removed[Math.floor(removed.length / 2)];
        const position = this.track.pointAt(middle.s);
        const rear = this.balls[run.start - 1];
        const front = this.balls[run.end + 1];
        const points = count * 10 * combo;
        this.balls.splice(run.start, count);
        this.score += points;
        this.bestCombo = Math.max(this.bestCombo, combo);
        this.pruneGapCombos();
        if (rear && front)
            this.gapCombos.set(this.gapKey(rear.id, front.id), combo + 1);
        events.push({ type: 'pop', ...position, color: middle.color, count, combo, points });
        if (combo > 1)
            events.push({ type: 'combo', ...position, count, combo, points });
        return true;
    }
    spawnBall() {
        var _a;
        if (this.spawned >= this.totalBalls)
            return;
        const tail = this.balls[0];
        if (!tail || tail.s >= exports.DIAMETER) {
            this.balls.unshift({ id: this.nextId++, color: (_a = this.sequence[this.spawned]) !== null && _a !== void 0 ? _a : Math.floor(this.random() * 4), s: tail ? tail.s - exports.DIAMETER : 0 });
            this.spawned += 1;
        }
    }
    availableColors() {
        const colors = new Set(this.balls.map(ball => ball.color));
        if (colors.size === 0)
            for (let index = this.spawned; index < this.sequence.length; index += 1)
                colors.add(this.sequence[index]);
        return [...colors].sort();
    }
    pickColor() {
        var _a;
        const colors = this.availableColors();
        let roll = this.random();
        if (this.wildcards && this.ammoSinceWildcard >= exports.WILD_MIN_NORMAL_AMMO) {
            if (roll < exports.WILD_CHANCE) {
                this.ammoSinceWildcard = 0;
                return exports.WILD_COLOR;
            }
            roll = (roll - exports.WILD_CHANCE) / (1 - exports.WILD_CHANCE);
        }
        this.ammoSinceWildcard = Math.min(exports.WILD_MIN_NORMAL_AMMO, this.ammoSinceWildcard + 1);
        return (_a = colors[Math.floor(roll * colors.length)]) !== null && _a !== void 0 ? _a : 0;
    }
    refreshAmmo() {
        const colors = this.availableColors();
        if (colors.length === 0)
            return;
        if (this.currentColor !== exports.WILD_COLOR && !colors.includes(this.currentColor))
            this.currentColor = this.pickColor();
        if (this.nextColor !== exports.WILD_COLOR && !colors.includes(this.nextColor))
            this.nextColor = this.pickColor();
    }
    gapKey(rearId, frontId) { return `${rearId}:${frontId}`; }
    pruneGapCombos() {
        const adjacentKeys = new Set();
        for (let index = 1; index < this.balls.length; index += 1)
            adjacentKeys.add(this.gapKey(this.balls[index - 1].id, this.balls[index].id));
        for (const key of this.gapCombos.keys())
            if (!adjacentKeys.has(key))
                this.gapCombos.delete(key);
    }
}
exports.GameModel = GameModel;
