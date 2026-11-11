'use strict';

// Pure Canvas 2D rendering. The game module owns rules, input and persistence.
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const COLORS = Object.freeze({
  background: '#f8f9f5', paper: '#ffffff', ink: '#263c35', muted: '#7d887f',
  green: '#36594e', pale: '#eaf0e8', line: '#dfe5db', board: '#bbad98', empty: '#d2c7b7',
});
const TILES = {
  2: ['#eee7d9', '#665b4b'], 4: ['#e9dfc6', '#665b4b'], 8: ['#eab97d', '#fffaf0'],
  16: ['#e6a16b', '#fffaf0'], 32: ['#dd855f', '#fffaf0'], 64: ['#d96b50', '#fffaf0'],
  128: ['#dcc26b', '#fffdf3'], 256: ['#d4b552', '#fffdf3'], 512: ['#cba53a', '#fffdf3'],
  1024: ['#ba922c', '#fffdf3'], 2048: ['#ac8124', '#fffdf3'],
};

function rect(x, y, w, h) { return { x, y, w, h }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function createLayout(viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 375);
  const height = Math.max(240, Number(viewport.height) || 667);
  const safeTop = clamp(Number(viewport.safeTop) || 0, 0, height * 0.4);
  const safeBottom = clamp(Number(viewport.safeBottom) || 0, 0, height * 0.25);
  const capsule = viewport.capsuleRect;
  const capsuleBottom = capsule ? Number(capsule.bottom) || ((Number(capsule.y) || 0) + (Number(capsule.height) || 0)) : 0;
  const top = Math.max(safeTop, capsuleBottom) + 8;
  const bottom = height - safeBottom - 8;
  const margin = width < 350 ? 12 : 16;
  const mainWidth = Math.min(width - margin * 2, 1000);
  const x = (width - mainWidth) / 2;
  const micro = (width < 480 && bottom - top < 410) || bottom - top < 260;
  const landscape = !micro && width > height * 1.12;
  const header = rect(x, top, mainWidth, micro ? 34 : 44);
  const layout = { width, height, safeTop, safeBottom, top, bottom, micro, landscape, header, capsuleRect: capsule || null };

  if (micro) {
    const directionHeight = 34;
    layout.directions = rect(x, bottom - directionHeight, mainWidth, directionHeight);
    const body = rect(x, header.y + header.h + 4, mainWidth, Math.max(36, layout.directions.y - header.y - header.h - 8));
    const railWidth = Math.min(94, mainWidth * 0.42);
    const size = Math.max(24, Math.min(body.h, mainWidth - railWidth - 8));
    layout.board = rect(x + railWidth + 8 + (mainWidth - railWidth - 8 - size) / 2, body.y + (body.h - size) / 2, size, size);
    const scoreHeight = Math.max(14, Math.min(40, body.h - 38));
    layout.scores = rect(x, body.y, railWidth, scoreHeight);
    layout.tools = rect(x, Math.max(body.y + scoreHeight + 4, body.y + body.h - 34), railWidth, 34);
    layout.body = body;
    layout.hint = null;
  } else if (landscape) {
    const bodyY = header.y + header.h + 10;
    const bodyHeight = Math.max(100, bottom - bodyY);
    const railWidth = clamp(mainWidth * 0.32, 184, 280);
    const size = Math.min(bodyHeight, mainWidth - railWidth - 24);
    const contentX = x + Math.max(0, (mainWidth - size - railWidth - 24) / 2);
    layout.board = rect(contentX, bodyY + (bodyHeight - size) / 2, size, size);
    const railX = contentX + size + 24;
    layout.scores = rect(railX, bodyY, railWidth, 54);
    layout.tools = rect(railX, bodyY + 64, railWidth, 40);
    layout.directions = rect(railX, bottom - 44, railWidth, 44);
    layout.hint = rect(railX, layout.tools.y + 48, railWidth, Math.max(18, layout.directions.y - layout.tools.y - 56));
    layout.body = rect(contentX, bodyY, size + 24 + railWidth, bodyHeight);
  } else {
    layout.scores = rect(x, header.y + header.h + 8, mainWidth, 48);
    layout.tools = rect(x, layout.scores.y + layout.scores.h + 8, mainWidth, 40);
    layout.directions = rect(x, bottom - 44, mainWidth, 44);
    layout.hint = rect(x, layout.directions.y - 26, mainWidth, 20);
    const boardTop = layout.tools.y + layout.tools.h + 10;
    const size = Math.min(mainWidth, Math.max(44, layout.hint.y - 8 - boardTop));
    const spare = Math.max(0, layout.hint.y - 8 - boardTop - size);
    layout.board = rect(x + (mainWidth - size) / 2, boardTop + spare / 2, size, size);
    layout.body = rect(x, layout.scores.y, mainWidth, bottom - layout.scores.y);
  }

  const board = layout.board;
  layout.gap = clamp(board.w * 0.026, 3, 11);
  const cellSize = (board.w - layout.gap * 5) / 4;
  layout.cells = Array.from({ length: 16 }, (_, i) => rect(
    board.x + layout.gap + (i % 4) * (cellSize + layout.gap),
    board.y + layout.gap + Math.floor(i / 4) * (cellSize + layout.gap), cellSize, cellSize,
  ));
  return layout;
}

function rounded(ctx, area, radius, fill, stroke) {
  const { x, y, w, h } = area;
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function text(ctx, value, x, y, size, color = COLORS.ink, align = 'left', weight = '400', maxWidth = Infinity) {
  const label = String(value);
  let fitted = size;
  ctx.font = `${weight} ${fitted}px ${FONT}`;
  if (typeof ctx.measureText === 'function') {
    const measured = ctx.measureText(label);
    if (measured && measured.width > maxWidth) {
      fitted = Math.max(1, fitted * maxWidth / measured.width);
      ctx.font = `${weight} ${fitted}px ${FONT}`;
    }
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function button(ctx, targets, area, label, action, payload, primary = false) {
  rounded(ctx, area, 10, primary ? COLORS.green : COLORS.paper, primary ? null : COLORS.line);
  text(ctx, label, area.x + area.w / 2, area.y + area.h / 2, area.h <= 34 ? 12 : 13,
    primary ? '#ffffff' : COLORS.green, 'center', '500', area.w - 12);
  targets.push({ ...area, action, ...(payload === undefined ? {} : { payload }), label });
}

function header(ctx, layout, state, targets) {
  const h = layout.header, buttonSize = h.h;
  button(ctx, targets, rect(h.x, h.y, buttonSize, buttonSize), '大厅', 'home');
  button(ctx, targets, rect(h.x + h.w - buttonSize, h.y, buttonSize, buttonSize), '分享', 'share');
  if (layout.micro) {
    button(ctx, targets, rect(h.x + h.w - buttonSize * 2 - 4, h.y, buttonSize, buttonSize), state.paused ? '继续' : '暂停', state.paused ? 'game-2048:resume' : 'game-2048:pause');
    button(ctx, targets, rect(h.x + h.w - buttonSize * 3 - 8, h.y, buttonSize, buttonSize), '玩法', 'game-2048:help');
    const titleLeft = h.x + buttonSize + 4, titleRight = h.x + h.w - buttonSize * 3 - 12;
    text(ctx, '2048', (titleLeft + titleRight) / 2, h.y + h.h / 2, 20, COLORS.green, 'center', '700', titleRight - titleLeft);
  } else text(ctx, '2048', h.x + h.w / 2, h.y + h.h / 2, 30, COLORS.green, 'center', '700');
}

function scores(ctx, layout, state) {
  const r = layout.scores, score = Number(state.round.score) || 0, best = Math.max(score, Number(state.best) || 0);
  if (layout.micro) {
    rounded(ctx, r, 8, COLORS.pale);
    if (r.h < 30) {
      text(ctx, `${score} / ${best}`, r.x + r.w / 2, r.y + r.h / 2, 12, COLORS.green, 'center', '600', r.w - 8);
    } else {
      text(ctx, '分数 / 最佳', r.x + r.w / 2, r.y + 11, 10, COLORS.muted, 'center');
      text(ctx, `${score} / ${best}`, r.x + r.w / 2, r.y + r.h - 12, 14, COLORS.green, 'center', '600', r.w - 8);
    }
    return;
  }
  const gap = 8, w = (r.w - gap) / 2;
  [['当前分数', score], ['本机最佳', best]].forEach(([label, value], i) => {
    const x = r.x + i * (w + gap);
    rounded(ctx, rect(x, r.y, w, r.h), 10, i ? '#efe9dc' : COLORS.pale);
    text(ctx, label, x + w / 2, r.y + 13, 11, COLORS.muted, 'center');
    text(ctx, value, x + w / 2, r.y + r.h - 13, 21, COLORS.green, 'center', '700', w - 12);
  });
}

function tile(ctx, cell, value, scale = 1) {
  if (!value || !cell) return;
  const fill = TILES[value] || ['#465d4c', '#fffdf3'];
  const area = rect(cell.x + cell.w * (1 - scale) / 2, cell.y + cell.h * (1 - scale) / 2, cell.w * scale, cell.h * scale);
  rounded(ctx, area, Math.max(3, cell.w * 0.08), fill[0]);
  const length = String(value).length;
  const size = cell.w * (length <= 2 ? 0.46 : length === 3 ? 0.36 : length === 4 ? 0.29 : 0.24) * scale;
  text(ctx, value, area.x + area.w / 2, area.y + area.h / 2 + cell.h * 0.015, size, fill[1], 'center', '700', area.w * 0.88);
}

function drawBoard(ctx, layout, state) {
  rounded(ctx, layout.board, clamp(layout.board.w * 0.035, 6, 16), COLORS.board);
  layout.cells.forEach(cell => rounded(ctx, cell, Math.max(3, cell.w * 0.08), COLORS.empty));
  const board = state.round.board || [];
  const animation = state.animation;
  const progress = animation ? clamp((Number(animation.elapsed) || 0) / Math.max(1, Number(animation.duration) || 120), 0, 1) : 1;
  const transitions = animation && Array.isArray(animation.transitions) ? animation.transitions : [];
  if (transitions.length && progress < 0.8) {
    const slide = 1 - Math.pow(1 - progress / 0.8, 3);
    const destinations = new Set(transitions.map(item => item.to));
    for (let i = 0; i < 16; i += 1) {
      if (!destinations.has(i) && (!animation.spawned || animation.spawned.index !== i)) tile(ctx, layout.cells[i], board[i]);
    }
    transitions.forEach(item => {
      const start = layout.cells[item.from], end = layout.cells[item.to];
      if (!start || !end) return;
      tile(ctx, rect(start.x + (end.x - start.x) * slide, start.y + (end.y - start.y) * slide, start.w, start.h), item.value);
    });
  } else {
    const merged = new Set(animation && animation.mergedIndices || []);
    for (let i = 0; i < 16; i += 1) {
      let scale = 1;
      if (animation && progress < 1 && merged.has(i)) scale = 1 + Math.sin((progress - 0.8) / 0.2 * Math.PI) * 0.1;
      if (animation && animation.spawned && animation.spawned.index === i && progress < 1) scale = clamp((progress - 0.8) / 0.2, 0.05, 1);
      tile(ctx, layout.cells[i], board[i], scale);
    }
  }
}

function tools(ctx, layout, state, targets) {
  const r = layout.tools;
  if (layout.micro) {
    button(ctx, targets, r, '重新开始', 'game-2048:new');
    return;
  }
  const choices = [['重开', 'game-2048:new'], ['玩法', 'game-2048:help'], [state.paused ? '继续' : '暂停', state.paused ? 'game-2048:resume' : 'game-2048:pause']];
  const w = (r.w - 12) / 3;
  choices.forEach(([label, action], i) => button(ctx, targets, rect(r.x + i * (w + 6), r.y, w, r.h), label, action));
}

function directions(ctx, layout, targets) {
  const r = layout.directions, gap = 6, w = (r.w - gap * 3) / 4;
  [['←', 'left', '向左移动'], ['↑', 'up', '向上移动'], ['↓', 'down', '向下移动'], ['→', 'right', '向右移动']].forEach(([glyph, direction, label], i) => {
    const area = rect(r.x + i * (w + gap), r.y, w, r.h);
    rounded(ctx, area, 10, COLORS.paper, COLORS.line);
    text(ctx, glyph, area.x + area.w / 2, area.y + area.h / 2, 22, COLORS.green, 'center', '500');
    targets.push({ ...area, action: 'game-2048:move', payload: direction, label });
  });
}

function overlay(ctx, layout, state, targets) {
  const status = state.status || 'playing';
  const terminal = status === 'won' || status === 'over';
  const title = status === 'won' ? '2048，达成！' : status === 'over' ? '这一局，收获满满' : '歇一会儿，再继续';
  const subtitle = status === 'won' ? '继续合成，挑战更大的数字' : status === 'over' ? `本局得分 ${Number(state.round.score) || 0}` : '棋盘与分数已为你保留';
  const overlayTop = layout.header.y + layout.header.h + 4;
  const overlayHeight = Math.max(74, layout.bottom - overlayTop);
  ctx.fillStyle = 'rgba(248,249,245,.76)'; ctx.fillRect(0, overlayTop, layout.width, overlayHeight);
  const panelWidth = Math.min(340, layout.width - 32);
  const panelHeight = Math.min(180, overlayHeight);
  const panel = rect((layout.width - panelWidth) / 2, overlayTop + (overlayHeight - panelHeight) / 2, panelWidth, panelHeight);
  rounded(ctx, panel, 16, COLORS.paper, COLORS.line);
  const actionHeight = panelHeight < 130 ? 34 : 44;
  const actionY = panel.y + panel.h - actionHeight - 12;
  text(ctx, title, layout.width / 2, panel.y + Math.min(30, panel.h * 0.23), panelHeight < 130 ? 17 : 23, COLORS.green, 'center', '600', panel.w - 20);
  text(ctx, subtitle, layout.width / 2, panel.y + Math.min(62, panel.h * 0.46), panelHeight < 130 ? 11 : 13, COLORS.muted, 'center', '400', panel.w - 20);
  const choices = !terminal && state.paused ? [['继续游戏', 'game-2048:resume']] : status === 'won'
    ? [['继续挑战', 'game-2048:continue'], ['重新开始', 'game-2048:new']]
    : [['再来一局', 'game-2048:new']];
  // A modal owns all input below the global navigation controls.
  const result = targets.filter(item => item.action === 'home' || item.action === 'share');
  const gap = 8, buttonWidth = (panel.w - 24 - gap * (choices.length - 1)) / choices.length;
  choices.forEach(([label, action], i) => button(ctx, result, rect(panel.x + 12 + i * (buttonWidth + gap), actionY, buttonWidth, actionHeight), label, action, undefined, i === 0));
  return result;
}

function renderGame(ctx, layout, state) {
  const targets = [];
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  header(ctx, layout, state, targets);
  scores(ctx, layout, state);
  tools(ctx, layout, state, targets);
  drawBoard(ctx, layout, state);
  if (layout.hint) {
    const r = layout.hint;
    text(ctx, state.storageAvailable === false ? '暂无法存档，请保持本页打开' : `第 ${state.round.moves || 0} 步 · 滑动合并相同数字`, r.x + r.w / 2, r.y + Math.min(r.h / 2, 16), 12, COLORS.muted, 'center', '400', r.w - 4);
  }
  directions(ctx, layout, targets);
  return state.paused || state.status === 'won' || state.status === 'over' ? overlay(ctx, layout, state, targets) : targets;
}

module.exports = { createLayout, renderGame, COLORS };
