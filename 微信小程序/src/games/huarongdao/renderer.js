'use strict';

const { WIDTH, HEIGHT, LEVELS, canMove } = require('./engine.js');
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const COLORS = Object.freeze({ background: '#f8f6ee', paper: '#fffdf7', ink: '#58432c', muted: '#92806b',
  accent: '#77583a', line: '#e5dccb', pale: '#eee8d9', frame: '#6e5135', board: '#cbb28a', grid: '#c1a67b',
  general: '#ead3a7', soldier: '#f4e3bd', target: '#a95743', selected: '#dfac44', disabled: '#b0a491' });
const rect = (x, y, w, h) => ({ x, y, w, h });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DIRS = [['← 左移', 'left', -1, 0], ['↑ 上移', 'up', 0, -1], ['↓ 下移', 'down', 0, 1], ['右移 →', 'right', 1, 0]];

function createLayout(viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 375), height = Math.max(240, Number(viewport.height) || 667);
  const safeTop = clamp(Number(viewport.safeTop) || 0, 0, height * 0.4), safeBottom = clamp(Number(viewport.safeBottom) || 0, 0, height * 0.25);
  const capsule = viewport.capsuleRect;
  const capsuleBottom = capsule ? Number(capsule.bottom) || ((Number(capsule.y) || 0) + (Number(capsule.height) || 0)) : 0;
  const top = Math.max(safeTop, capsuleBottom) + 8, bottom = height - safeBottom - 8;
  const margin = width < 350 ? 12 : 16, mainW = Math.min(960, width - margin * 2), x = (width - mainW) / 2;
  const landscape = width > height * 1.12, compact = bottom - top < 570;
  const header = rect(x, top, mainW, compact ? 34 : 40), bodyY = top + header.h + 10;
  const layout = { width, height, safeTop, safeBottom, top, bottom, header, landscape, compact, capsuleRect: capsule || null };
  if (landscape) {
    const bodyH = Math.max(80, bottom - bodyY), boardH = Math.max(40, bodyH - 19), boardW = Math.min(boardH * WIDTH / HEIGHT, mainW * 0.45);
    const railW = Math.min(520, mainW - boardW - 24), contentX = x + (mainW - boardW - railW - 24) / 2;
    layout.board = rect(contentX, bodyY, boardW, boardW * HEIGHT / WIDTH);
    const railX = contentX + boardW + 24, controlH = bodyH < 190 ? 34 : 42;
    layout.directions = rect(railX, bottom - controlH, railW, controlH);
    layout.tools = rect(railX, layout.directions.y - 6 - controlH, railW, controlH);
    const infoH = Math.max(22, layout.tools.y - bodyY - 6), scoreH = Math.min(54, infoH * 0.59);
    layout.scores = rect(railX, bodyY, railW, scoreH);
    layout.level = rect(railX, bodyY + scoreH + 4, railW, Math.max(12, infoH - scoreH - 4));
    layout.hint = null;
  } else if (compact) {
    layout.directions = rect(x, bottom - 40, mainW, 40);
    layout.tools = rect(x, layout.directions.y - 6 - 36, mainW, 36);
    layout.hint = rect(x, layout.tools.y - 24, mainW, 18);
    const bodyBottom = layout.hint.y - 22, bodyH = Math.max(40, bodyBottom - bodyY), railW = Math.max(68, Math.min(84, mainW * 0.255));
    const boardW = Math.min(mainW - railW - 12, bodyH * WIDTH / HEIGHT), boardH = boardW * HEIGHT / WIDTH;
    const contentX = x + (mainW - boardW - railW - 12) / 2, boardY = bodyY + (bodyH - boardH) / 2;
    layout.board = rect(contentX, boardY, boardW, boardH);
    const railX = contentX + boardW + 12, scoreH = Math.min(186, boardH * 0.69);
    layout.scores = rect(railX, boardY, railW, scoreH);
    layout.level = rect(railX, boardY + scoreH + 8, railW, Math.max(16, boardH - scoreH - 8));
  } else {
    layout.directions = rect(x, bottom - 44, mainW, 44);
    layout.tools = rect(x, layout.directions.y - 8 - 40, mainW, 40);
    layout.hint = rect(x, layout.tools.y - 24, mainW, 18);
    layout.scores = rect(x, bodyY, mainW, 50);
    layout.level = rect(x, bodyY + 56, mainW, 26);
    const boardY = layout.level.y + layout.level.h + 8, bodyBottom = layout.hint.y - 24;
    const boardW = Math.min(mainW - 8, Math.max(40, bodyBottom - boardY) * WIDTH / HEIGHT), boardH = boardW * HEIGHT / WIDTH;
    layout.board = rect(x + (mainW - boardW) / 2, boardY + Math.max(0, (bodyBottom - boardY - boardH) / 2), boardW, boardH);
  }
  layout.cell = layout.board.w / WIDTH;
  layout.exit = rect(layout.board.x + layout.cell, layout.board.y + layout.board.h + 4, layout.cell * 2, 14);
  return layout;
}

function rounded(ctx, area, radius, fill, stroke) {
  const { x, y, w, h } = area, r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function text(ctx, value, x, y, size, color = COLORS.ink, align = 'left', weight = '400', maxWidth = Infinity) {
  const label = String(value);
  ctx.font = `${weight} ${size}px ${FONT}`;
  if (typeof ctx.measureText === 'function') {
    const measured = ctx.measureText(label);
    if (measured && measured.width > maxWidth) size = Math.max(1, size * maxWidth / measured.width);
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}
function button(ctx, targets, area, label, action, payload, primary = false, disabled = false) {
  rounded(ctx, area, Math.min(10, area.h * 0.22), disabled ? COLORS.pale : primary ? COLORS.accent : COLORS.paper, primary ? null : COLORS.line);
  text(ctx, label, area.x + area.w / 2, area.y + area.h / 2, Math.min(14, area.h * 0.35),
    disabled ? COLORS.disabled : primary ? '#ffffff' : COLORS.accent, 'center', '600', area.w - 8);
  if (!disabled) targets.push({ ...area, action, ...(payload === undefined ? {} : { payload }), label });
}
function header(ctx, layout, targets, blocked) {
  const r = layout.header, w = r.h, gap = 5;
  button(ctx, targets, rect(r.x, r.y, w, r.h), '大厅', 'home');
  button(ctx, targets, rect(r.x + r.w - w * 2 - gap, r.y, w, r.h), '玩法', 'huarongdao:help', undefined, false, blocked);
  button(ctx, targets, rect(r.x + r.w - w, r.y, w, r.h), '分享', 'share');
  text(ctx, '华容道', r.x + w + 12, r.y + r.h / 2, layout.compact ? 23 : 28, COLORS.accent, 'left', '700', r.w - w * 3 - gap - 24);
}
function timeLabel(elapsedMs) {
  const seconds = Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000), minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
function metric(ctx, area, label, value) {
  rounded(ctx, area, 9, COLORS.pale);
  text(ctx, label, area.x + area.w / 2, area.y + area.h * 0.26, Math.min(11, area.h * 0.24), COLORS.muted, 'center', '400', area.w - 8);
  text(ctx, value, area.x + area.w / 2, area.y + area.h * 0.69, Math.min(23, area.h * 0.43), COLORS.accent, 'center', '700', area.w - 8);
}
function information(ctx, layout, state) {
  const r = layout.scores, best = state.best && state.best[state.round.levelId];
  const items = [['步数', state.round.moves.length], ['本关最佳', Number.isSafeInteger(best) && best >= 0 ? best : '—'], ['用时', timeLabel(state.elapsedMs)]];
  const stacked = layout.compact && !layout.landscape, gap = 6;
  const w = stacked ? r.w : (r.w - gap * 2) / 3, h = stacked ? (r.h - gap * 2) / 3 : r.h;
  items.forEach(([label, value], i) => metric(ctx, rect(r.x + (stacked ? 0 : i * (w + gap)), r.y + (stacked ? i * (h + gap) : 0), w, h), label, value));
  const level = LEVELS.find(item => item.id === state.round.levelId), l = layout.level;
  const title = level ? level.title : '华容道';
  if (stacked) {
    rounded(ctx, l, 8, '#f0e3ca');
    text(ctx, '当前关卡', l.x + l.w / 2, l.y + l.h * 0.24, Math.min(10, l.h * 0.25), COLORS.muted, 'center', '400', l.w - 8);
    text(ctx, title, l.x + l.w / 2, l.y + l.h * 0.58, Math.min(15, l.h * 0.26), COLORS.accent, 'center', '600', l.w - 8);
    if (l.h > 60) text(ctx, '曹操移至出口', l.x + l.w / 2, l.y + l.h * 0.83, 9, COLORS.muted, 'center', '400', l.w - 8);
  } else text(ctx, state.storageAvailable === false && !layout.hint ? '暂无法存档，请保持本页打开' : `${title} · 护送曹操到出口`,
    l.x + l.w / 2, l.y + l.h / 2, Math.min(13, l.h * 0.52), COLORS.muted, 'center', '500', l.w - 8);
}
function pieceArea(layout, piece) {
  const gap = Math.max(2.5, layout.cell * 0.055);
  return rect(layout.board.x + piece.x * layout.cell + gap, layout.board.y + piece.y * layout.cell + gap,
    piece.w * layout.cell - gap * 2, piece.h * layout.cell - gap * 2);
}
function drawBoard(ctx, layout, state) {
  const b = layout.board, size = layout.cell;
  rounded(ctx, rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8), 10, COLORS.frame);
  rounded(ctx, b, 7, COLORS.board);
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    rounded(ctx, rect(b.x + x * size + 1, b.y + y * size + 1, size - 2, size - 2), 2, (x + y) % 2 ? COLORS.board : COLORS.grid);
  }
  for (const piece of state.round.pieces) {
    const area = pieceArea(layout, piece), target = piece.w === 2 && piece.h === 2, selected = state.selected === piece.id;
    if (selected) rounded(ctx, rect(area.x - 2, area.y - 2, area.w + 4, area.h + 4), Math.max(4, size * 0.11), COLORS.selected);
    rounded(ctx, rect(area.x, area.y + Math.max(1, size * 0.035), area.w, area.h), Math.max(3, size * 0.1), 'rgba(74,48,24,.25)');
    rounded(ctx, area, Math.max(3, size * 0.1), target ? COLORS.target : piece.w * piece.h === 1 ? COLORS.soldier : COLORS.general, selected ? COLORS.selected : '#ae8d5f');
    const inset = Math.max(3, size * 0.09);
    rounded(ctx, rect(area.x + inset, area.y + inset, area.w - inset * 2, area.h - inset * 2), Math.max(2, size * 0.06), null, target ? '#bb715c' : '#d9bd8c');
    const label = piece.label || piece.id, color = target ? '#fff3d5' : COLORS.ink;
    const font = Math.min(target ? 31 : 24, size * (target ? 0.43 : 0.38));
    const chars = Array.from(label);
    if (piece.h > piece.w && chars.length >= 2 && chars.length <= 3) {
      const step = Math.min(font * 1.55, area.h / (chars.length + 1)), start = area.y + area.h / 2 - step * (chars.length - 1) / 2;
      chars.forEach((char, index) => text(ctx, char, area.x + area.w / 2, start + index * step, font, color, 'center', '700', area.w - 10));
    } else text(ctx, label, area.x + area.w / 2, area.y + area.h / 2, font, color, 'center', '700', area.w - 10);
  }
  // The two central columns mark the exit. Pieces remain in board coordinates.
  const exit = layout.exit;
  ctx.fillStyle = COLORS.background; ctx.fillRect(b.x + size + 1, b.y + b.h, size * 2 - 2, 5);
  ctx.strokeStyle = COLORS.selected; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(exit.x + 4, exit.y + 2); ctx.lineTo(exit.x + exit.w - 4, exit.y + 2); ctx.stroke();
  text(ctx, '出 口', exit.x + exit.w / 2, exit.y + exit.h * 0.67, 10, COLORS.accent, 'center', '600', exit.w - 8);
}
function controls(ctx, layout, state, targets, blocked) {
  const t = layout.tools, gap = 6, w = (t.w - gap * 3) / 4;
  [['关卡', 'level'], ['悔棋', 'undo'], ['重开', 'new'], ['暂停', 'pause']].forEach(([label, action], i) =>
    button(ctx, targets, rect(t.x + i * (w + gap), t.y, w, t.h), label, `huarongdao:${action}`, undefined, false, blocked || (action === 'undo' && !state.round.moves.length)));
  const r = layout.directions, dw = (r.w - gap * 3) / 4;
  DIRS.forEach(([label, direction, dx, dy], i) => {
    const allowed = !blocked && Boolean(state.selected) && canMove(state.round, state.selected, dx, dy);
    button(ctx, targets, rect(r.x + i * (dw + gap), r.y, dw, r.h), label, 'huarongdao:move', direction, allowed, !allowed);
  });
  if (layout.hint) {
    const r = layout.hint, piece = state.round.pieces.find(item => item.id === state.selected);
    const message = state.storageAvailable === false ? '暂无法存档，请保持本页打开' : piece ? `已选 ${piece.label || piece.id} · 亮起的方向可移动` : '点选棋块 · 拖动或按方向键移动';
    text(ctx, message, r.x + r.w / 2, r.y + r.h / 2, 11, COLORS.muted, 'center', '400', r.w - 4);
  }
}
function overlay(ctx, layout, state, targets) {
  const won = state.round.status === 'won', y = layout.header.y + layout.header.h + 4, h = layout.bottom - y;
  ctx.fillStyle = 'rgba(248,246,238,.88)'; ctx.fillRect(0, y, layout.width, h);
  const panelW = Math.min(328, layout.width - 32), panelH = Math.min(184, h - 8), panel = rect((layout.width - panelW) / 2, y + (h - panelH) / 2, panelW, panelH);
  rounded(ctx, panel, 16, COLORS.paper, COLORS.line);
  const actionH = panelH < 140 ? 34 : 42;
  text(ctx, won ? '成功脱困' : '休息一下', panel.x + panelW / 2, panel.y + panelH * 0.23, Math.min(25, panelH * 0.2), COLORS.accent, 'center', '700', panelW - 20);
  text(ctx, won ? `${state.round.moves.length} 步 · 用时 ${timeLabel(state.elapsedMs)}` : '棋局已暂停，准备好再继续', panel.x + panelW / 2,
    panel.y + panelH * 0.45, Math.min(13, panelH * 0.12), COLORS.muted, 'center', '400', panelW - 20);
  const result = targets.filter(target => target.action === 'home' || target.action === 'share');
  const choices = won ? [['再来一局', 'new'], ['换一关', 'level'], ...(state.round.moves.length ? [['悔一步', 'undo']] : [])] : [['继续游戏', 'resume']];
  const gap = 8, bw = (panelW - 28 - gap * (choices.length - 1)) / choices.length;
  choices.forEach(([label, action], i) => button(ctx, result, rect(panel.x + 14 + i * (bw + gap), panel.y + panelH - actionH - 14, bw, actionH), label, `huarongdao:${action}`, undefined, i === 0));
  return result;
}
function renderGame(ctx, layout, state) {
  const targets = [], blocked = state.paused || state.round.status === 'won';
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  header(ctx, layout, targets, blocked); information(ctx, layout, state); drawBoard(ctx, layout, state); controls(ctx, layout, state, targets, blocked);
  return blocked ? overlay(ctx, layout, state, targets) : targets;
}

module.exports = { createLayout, renderGame, pieceArea, timeLabel, COLORS };
