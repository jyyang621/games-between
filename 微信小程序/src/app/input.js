'use strict';

function normalizedTouches(event = {}) {
  return Array.from(event.changedTouches || event.touches || []).map(touch => ({
    ...touch,
    clientX: Number(touch.clientX === undefined ? touch.x : touch.clientX),
    clientY: Number(touch.clientY === undefined ? touch.y : touch.clientY),
  })).filter(touch => Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY));
}

function hitTarget(targets, touch) {
  return targets.slice().reverse().find(target => touch.clientX >= target.x && touch.clientX <= target.x + target.w &&
    touch.clientY >= target.y && touch.clientY <= target.y + target.h) || null;
}

module.exports = { normalizedTouches, hitTarget };
