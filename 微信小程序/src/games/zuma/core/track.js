/* Generated from vendor/zuma/track.ts; MIT, Marble Trail contributors. */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACK_CONTROL_POINTS = exports.Track = void 0;
/** A sampled Catmull–Rom curve, addressed by distance rather than curve time. */
class Track {
    constructor(points, subdivisions = 48) {
        this.samples = [];
        this.distances = [];
        if (points.length < 2)
            throw new Error('A track needs at least two points.');
        for (let segment = 0; segment < points.length - 1; segment += 1) {
            const p0 = points[Math.max(segment - 1, 0)];
            const p1 = points[segment];
            const p2 = points[segment + 1];
            const p3 = points[Math.min(segment + 2, points.length - 1)];
            for (let step = 0; step < subdivisions; step += 1) {
                const t = step / subdivisions;
                const t2 = t * t;
                const t3 = t2 * t;
                const interpolate = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
                this.samples.push({ x: interpolate(p0.x, p1.x, p2.x, p3.x), y: interpolate(p0.y, p1.y, p2.y, p3.y) });
            }
        }
        this.samples.push({ ...points[points.length - 1] });
        this.distances.push(0);
        let distance = 0;
        for (let index = 1; index < this.samples.length; index += 1) {
            const previous = this.samples[index - 1];
            const current = this.samples[index];
            distance += Math.hypot(current.x - previous.x, current.y - previous.y);
            this.distances.push(distance);
        }
        this.length = distance;
    }
    pointAt(s) {
        if (s <= 0) {
            const first = this.samples[0];
            const direction = this.segmentDirection(0);
            return { x: first.x + direction.x * s, y: first.y + direction.y * s };
        }
        if (s >= this.length) {
            const last = this.samples[this.samples.length - 1];
            const direction = this.segmentDirection(this.samples.length - 2);
            return { x: last.x + direction.x * (s - this.length), y: last.y + direction.y * (s - this.length) };
        }
        const index = this.findSegment(s);
        const before = this.samples[index];
        const after = this.samples[index + 1];
        const fraction = (s - this.distances[index]) / (this.distances[index + 1] - this.distances[index]);
        return { x: before.x + (after.x - before.x) * fraction, y: before.y + (after.y - before.y) * fraction };
    }
    tangentAt(s) {
        return this.segmentDirection(this.findSegment(Math.max(0, Math.min(this.length, s))));
    }
    findSegment(s) {
        let low = 0;
        let high = this.distances.length - 1;
        while (low + 1 < high) {
            const middle = (low + high) >>> 1;
            if (this.distances[middle] <= s)
                low = middle;
            else
                high = middle;
        }
        return Math.min(low, this.samples.length - 2);
    }
    segmentDirection(index) {
        const from = this.samples[index];
        const to = this.samples[index + 1];
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    }
}
exports.Track = Track;
exports.TRACK_CONTROL_POINTS = [
    { x: -30, y: 190 }, { x: 180, y: 145 }, { x: 430, y: 155 },
    { x: 850, y: 130 }, { x: 995, y: 220 }, { x: 995, y: 465 },
    { x: 885, y: 565 }, { x: 660, y: 560 }, { x: 500, y: 585 },
    { x: 260, y: 565 }, { x: 140, y: 460 }, { x: 155, y: 335 },
    { x: 260, y: 280 }, { x: 350, y: 325 },
];
