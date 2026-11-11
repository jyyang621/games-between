// Generated from vendor/gold-miner/original/viewport.ts by vendor/gold-miner/generate.mjs.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIDE_VIEWPORT = void 0;
exports.mineScale = mineScale;
exports.mineGeometry = mineGeometry;
exports.WIDE_VIEWPORT = { width: 1280, height: 720, portrait: false };
function mineScale(view) {
    return {
        // Leave the large nuggets intact and keep neighbouring shelves apart.
        x: view.portrait ? (view.width - 96) / (1280 - 110) : view.width / 1280,
        y: (view.height - 178) / (720 - 178),
    };
}
function mineGeometry(view) {
    const scale = mineScale(view);
    return {
        pivotX: view.width / 2,
        pivotY: 148,
        minRope: 38,
        maxRope: view.portrait ? Math.max(760, Math.hypot(view.width / 2 - 28, view.height - 178)) : 760,
        maxAngle: Math.PI * (view.portrait ? 65 : 75) / 180,
        speedScale: Math.max(1, scale.y),
        bounds: { left: 28, right: view.width - 28, bottom: view.height - 30 },
    };
}
