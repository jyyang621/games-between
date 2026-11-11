'use strict';

// Copy from 数独/templates/minigame/ into 微信小程序/src/games/<id>/index.js,
// a sibling workspace directory, then register the factory.
// Change this ID once before publishing; keep it stable for future save upgrades.
const ID = 'new-game';
const { saveKey } = require('../../platform/storage.js');
const SAVE_KEY = saveKey(ID);

function createGame({ read, write, services }) {
  const saved = read(SAVE_KEY);
  const model = { score: saved && Number.isSafeInteger(saved.score) ? saved.score : 0, paused: true };
  let viewport;

  return {
    id: ID,
    frameInterval: 16,
    model,
    enter() {},
    resize(nextViewport) { viewport = nextViewport; },
    render(ctx) {
      ctx.fillStyle = '#f8f9f5'; ctx.fillRect(0, 0, viewport.width, viewport.height);
      const top = Math.max(viewport.safeTop, viewport.capsuleRect && viewport.capsuleRect.bottom || 0) + 12;
      ctx.fillStyle = '#36594e'; ctx.font = '16px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('返回大厅', 20, top + 24);
      // Draw the game and return its labeled interaction regions here.
      return [{ x: 12, y: top, w: 100, h: 44, action: 'home', label: '返回大厅' }];
    },
    tick(deltaMs) {
      if (model.paused) return;
      // Advance gameplay using deltaMs. Keep timers out of the module.
    },
    activate(action) {
      if (action === `${ID}:resume`) { model.paused = false; return true; }
      return false;
    },
    pointer(type, points) { return false; },
    pause() { model.paused = true; },
    save() { return write(SAVE_KEY, { version: 1, score: model.score }); },
    sharePayload() { return { title: '来玩新游戏', query: `g=${ID}` }; },
    getResumeInfo() { return { available: true, text: `得分 ${model.score}` }; },
    get statusText() { return model.paused ? '已暂停' : '进行中'; },
    dispose() {
      // Release only resources owned by this module. The host owns Canvas/events.
    },
  };
}

module.exports = { createGame };
