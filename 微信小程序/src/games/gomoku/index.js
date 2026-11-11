'use strict';

const { saveKey } = require('../../platform/storage.js');
const { createRound, placeStone, undo, cloneRound, validateRound, DIFFICULTIES } = require('./engine.js');
const { chooseMove } = require('./ai.js');
const { createLayout, renderGame } = require('./renderer.js');

const ID = 'gomoku';
const SAVE_KEY = saveKey(ID);
const AI_DELAY = 320;

function createGame({ read = () => null, write = () => false, services = {} } = {}) {
  let saved = null;
  try { saved = read(SAVE_KEY); } catch {}
  const restored = saved && saved.version === 1 ? validateRound(saved.round) : null;
  let round = restored || createRound();
  let paused = Boolean(restored && round.status === 'playing');
  let disposed = false, generation = 0, aiElapsed = 0, storageOK = true;
  let layout = createLayout({ width: 375, height: 750, safeTop: 24, safeBottom: 0 });
  const live = () => round.status === 'playing';
  const aiTurn = () => live() && round.mode === 'ai' && round.turn !== round.humanColor;
  const invalidate = () => { if (services.invalidate) services.invalidate(); };
  const toast = message => { if (services.toast) services.toast(message); };
  const difficultyLabel = () => DIFFICULTIES.find(item => item.id === round.difficulty).label;

  function save() {
    if (disposed) return false;
    try { storageOK = write(SAVE_KEY, { version: 1, round: cloneRound(round) }) !== false; }
    catch { storageOK = false; }
    return storageOK;
  }
  function pause() {
    generation += 1; aiElapsed = 0;
    if (live()) paused = true;
  }
  function startNew(mode, humanColor, difficulty) {
    generation += 1; aiElapsed = 0; paused = false;
    round = createRound(mode, humanColor, difficulty);
    save(); invalidate(); return true;
  }
  function requestNew(mode, humanColor, difficulty = round.difficulty) {
    if (!['ai', 'local'].includes(mode) || ![1, 2].includes(humanColor) || !DIFFICULTIES.some(item => item.id === difficulty)) return false;
    if (!live() || round.moves.length === 0) return startNew(mode, humanColor, difficulty);
    pause(); save();
    const expected = generation;
    const config = {
      title: difficulty !== round.difficulty ? '更换电脑难度？' : '开始新的五子棋？',
      content: (difficulty !== round.difficulty ? '将以“' + DIFFICULTIES.find(item => item.id === difficulty).label + '”难度开始新局。' : '') + '当前棋局将被替换。取消可保留棋局，点击“继续”接着下。',
      confirmText: '开始新局', cancelText: '保留棋局',
      fail: () => { if (!disposed && generation === expected) toast('暂时无法确认，请稍后再试'); },
    };
    if (!services.modal || services.modal(config, () => {
      if (!disposed && generation === expected) startNew(mode, humanColor, difficulty);
    }) === false) toast('暂时无法确认，请稍后再试');
    return true;
  }
  function chooseDifficulty() {
    if (round.mode !== 'ai' || paused) return false;
    const wasPaused = paused;
    pause();
    const expected = generation;
    let settled = false;
    const valid = () => !settled && !disposed && generation === expected;
    const restore = () => { settled = true; generation += 1; paused = wasPaused; aiElapsed = 0; invalidate(); };
    const fail = result => {
      if (!valid()) return;
      restore();
      if (!result || !/cancel/i.test(String(result.errMsg || ''))) toast('难度菜单暂时无法打开，请稍后再试');
    };
    try {
      if (!services.actionSheet || services.actionSheet({
        itemList: ['简单 · 轻松练习', '普通 · 攻防兼顾', '困难 · 多步推演'],
        success: result => {
          if (!valid()) return;
          const choice = result && Number.isInteger(result.tapIndex) && DIFFICULTIES[result.tapIndex];
          if (!choice || choice.id === round.difficulty) { restore(); return; }
          settled = true;
          requestNew(round.mode, round.humanColor, choice.id);
        }, fail,
      }) === false) fail();
    } catch { fail(); }
    return true;
  }
  function takeBack() {
    if (paused || !round.moves.length) return false;
    let count = 1;
    if (round.mode === 'ai') {
      let lastHuman = round.moves.length - 1;
      while (lastHuman >= 0 && (lastHuman % 2) + 1 !== round.humanColor) lastHuman -= 1;
      if (lastHuman < 0) return false;
      // Return to the human's previous decision, including the computer's reply.
      count = round.moves.length - lastHuman;
    }
    if (!undo(round, count)) return false;
    generation += 1; aiElapsed = 0; save(); return true;
  }
  function activate(action, payload) {
    if (disposed) return false;
    if (action === ID + ':cell') {
      if (paused || aiTurn() || !placeStone(round, payload)) return false;
      generation += 1; aiElapsed = 0; save(); return true;
    }
    if (action === ID + ':undo') return takeBack();
    if (action === ID + ':chooseDifficulty') return chooseDifficulty();
    if (action === ID + ':difficulty' && round.mode === 'ai' && !paused && payload !== round.difficulty) return requestNew(round.mode, round.humanColor, payload);
    if (action === ID + ':pause' && !paused && live()) { pause(); save(); return true; }
    if (action === ID + ':resume' && paused && live()) {
      generation += 1; aiElapsed = 0; paused = false; return true;
    }
    if (action === ID + ':new') return requestNew(round.mode, round.humanColor);
    if (action === ID + ':mode' && payload !== round.mode) return requestNew(payload, round.humanColor);
    if (action === ID + ':color' && round.mode === 'ai' && payload !== round.humanColor) return requestNew(round.mode, payload);
    if (action === ID + ':help') {
      pause(); save();
      const config = {
        title: '五子棋 · 玩法',
        content: '15×15 棋盘，黑棋先行。轻点交叉点落子，横、竖或斜线连续五子及以上即获胜。本游戏采用自由规则，无禁手；棋盘填满且无人获胜则和棋。\n\n人机对战：默认你执黑先行，可点击“换先后”改为执白。点击模式旁的难度按钮，可选简单、普通或困难；有进度时确认后才会换难度开新局。\n\n简单：基础攻防，适合练习。普通：原版休闲强度，综合判断棋形。困难：进一步试算双方应对，但仍可能失误。三档都会争取成五和防守直接威胁，电脑思考时不能代它落子。\n\n同机双人：两人在同一台设备上轮流下棋。\n\n悔棋：双人撤回一步，人机撤回你上一手及电脑的应手；电脑尚未应手时只撤回你的落子。\n\n进度自动保存在本机。暂停、返回大厅、分享或切到后台后，点击“继续”恢复；切换模式、先后手、难度或重开会替换当前棋局。',
        showCancel: false, confirmText: '知道了',
        fail: () => { if (!disposed) toast('玩法暂时无法打开，请稍后再试'); },
      };
      if (!services.modal || services.modal(config) === false) toast('玩法暂时无法打开，请稍后再试');
      return true;
    }
    return false;
  }
  return {
    id: ID, frameInterval: 100,
    enter() { generation += 1; aiElapsed = 0; },
    resize(viewport) { layout = createLayout(viewport); },
    render(ctx) { return renderGame(ctx, layout, { round, paused, thinking: !paused && aiTurn(), storageAvailable: storageOK && services.storageAvailable !== false }); },
    tick(deltaMs) {
      if (disposed || paused || !aiTurn() || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      aiElapsed += Math.min(deltaMs, 1000);
      if (aiElapsed < AI_DELAY) return;
      aiElapsed = 0;
      const index = chooseMove(round);
      if (index !== null && placeStone(round, index)) { generation += 1; save(); }
    },
    activate, pointer() { return false; }, pause, save,
    sharePayload() { return { title: '一起来下五子棋 · 花自飘零的游戏空间', query: 'g=' + ID }; },
    getResumeInfo() { return { available: live() && round.moves.length > 0, text: (round.mode === 'ai' ? difficultyLabel() + '人机' : '同机双人') + ' · 已下 ' + round.moves.length + ' 手' }; },
    get model() { return { round, paused, thinking: !paused && aiTurn(), status: round.status }; },
    get layout() { return layout; },
    get musicActive() { return !disposed && !paused && live() && round.moves.length > 0; },
    get statusText() {
      const state = round.status === 'won' ? (round.winner === 1 ? '黑棋' : '白棋') + '获胜' : round.status === 'draw' ? '和棋' : paused ? '已暂停' : aiTurn() ? '电脑思考中' : '轮到' + (round.turn === 1 ? '黑棋' : '白棋');
      return '五子棋 · ' + (round.mode === 'ai' ? difficultyLabel() + '人机对战' : '同机双人') + ' · ' + state + ' · ' + round.moves.length + ' 手';
    },
    dispose() { pause(); disposed = true; },
  };
}

module.exports = { createGame, SAVE_KEY, AI_DELAY };
