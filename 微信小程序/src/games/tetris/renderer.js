'use strict';

const { WIDTH, HEIGHT, TYPES, cells, dropDistance } = require('./engine.js');
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const COLORS = Object.freeze({ background: '#f7f8f2', paper: '#ffffff', ink: '#29443b', green: '#315e4f',
  muted: '#7b8b80', line: '#dce5da', pale: '#eaf0e5', board: '#183d34', grid: '#244b40', ghost: '#91b4a3' });
const BLOCKS = Object.freeze(['', '#68c7c2', '#e7c66b', '#b29acb', '#96be87', '#d98278', '#7eabd3', '#dfa56f']);
const rect = (x, y, w, h) => ({ x, y, w, h });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createLayout(viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 375), height = Math.max(240, Number(viewport.height) || 667);
  const safeTop = clamp(Number(viewport.safeTop) || 0, 0, height * 0.4);
  const safeBottom = clamp(Number(viewport.safeBottom) || 0, 0, height * 0.25);
  const capsule = viewport.capsuleRect;
  const capsuleBottom = capsule ? Number(capsule.bottom) || ((Number(capsule.y) || 0) + (Number(capsule.height) || 0)) : 0;
  const top = Math.max(safeTop, capsuleBottom) + 8, bottom = height - safeBottom - 8;
  const margin = width < 350 ? 12 : 16, mainW = Math.min(900, width - margin * 2), x = (width - mainW) / 2;
  const landscape = width > height * 1.12;
  const compact = bottom - top < 320;
  const header = rect(x, top, mainW, compact ? 34 : 40);
  const bodyY = header.y + header.h + 10;
  const layout = { width, height, safeTop, safeBottom, top, bottom, header, landscape, compact, capsuleRect: capsule || null };
  if (landscape) {
    const bodyH = Math.max(48, bottom - bodyY), boardW = Math.min(bodyH / 2, mainW * 0.32);
    const railW = Math.min(560, mainW - boardW - 20), contentX = x + (mainW - boardW - railW - 20) / 2;
    layout.board = rect(contentX, bodyY + (bodyH - boardW * 2) / 2, boardW, boardW * 2);
    const railX = contentX + boardW + 20, h = bodyH < 190 ? 34 : 44, gap = 6;
    layout.controls = rect(railX, bottom - h, railW, h);
    layout.tools = rect(railX, layout.controls.y - gap - (bodyH < 190 ? 34 : 40), railW, bodyH < 190 ? 34 : 40);
    const infoH = Math.max(20, layout.tools.y - gap - bodyY);
    const scoresH = Math.min(52, infoH * 0.48);
    layout.scores = rect(railX, bodyY, railW, scoresH);
    layout.metrics = null;
    layout.next = rect(railX, bodyY + scoresH + 4, railW, Math.max(12, infoH - scoresH - 4));
    layout.hint = null;
  } else {
    const controlH = compact ? 34 : 44, controlGap = 6;
    layout.controls = rect(x, bottom - controlH * 2 - controlGap, mainW, controlH * 2 + controlGap);
    layout.hint = compact ? null : rect(x, layout.controls.y - 22, mainW, 16);
    const bodyBottom = layout.hint ? layout.hint.y - 6 : layout.controls.y - 8;
    const bodyH = Math.max(40, bodyBottom - bodyY), sideW = Math.min(118, mainW * 0.35), gap = 12;
    const boardW = Math.min((mainW - sideW - gap), bodyH / 2), boardH = boardW * 2;
    const contentX = x + (mainW - boardW - sideW - gap) / 2, boardY = bodyY + (bodyH - boardH) / 2;
    layout.board = rect(contentX, boardY, boardW, boardH);
    const sideX = contentX + boardW + gap, toolH = boardH < 290 ? 34 : 40;
    layout.tools = rect(sideX, boardY + boardH - toolH * 2 - 6, sideW, toolH * 2 + 6);
    const available = Math.max(20, layout.tools.y - boardY - 12);
    const scoresH = Math.min(96, available * 0.39), metricsH = Math.min(52, available * 0.23);
    layout.scores = rect(sideX, boardY, sideW, scoresH);
    layout.metrics = rect(sideX, boardY + scoresH + 6, sideW, metricsH);
    layout.next = rect(sideX, layout.metrics.y + metricsH + 6, sideW,
      Math.max(12, layout.tools.y - layout.metrics.y - metricsH - 12));
  }
  layout.cell = layout.board.w / WIDTH;
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
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
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

function button(ctx, targets, area, label, action, primary = false, disabled = false) {
  rounded(ctx, area, Math.min(10, area.h * 0.22), disabled ? COLORS.pale : primary ? COLORS.green : COLORS.paper, primary ? null : COLORS.line);
  text(ctx, label, area.x + area.w / 2, area.y + area.h / 2, Math.min(14, area.h * 0.34),
    disabled ? '#a0ada3' : primary ? '#ffffff' : COLORS.green, 'center', '600', area.w - 10);
  if (!disabled) targets.push({ ...area, action, label });
}

function header(ctx, layout, targets, blocked) {
  const r = layout.header, w = r.h, gap = 5;
  button(ctx, targets, rect(r.x, r.y, w, r.h), '大厅', 'home');
  button(ctx, targets, rect(r.x + r.w - w * 2 - gap, r.y, w, r.h), '玩法', 'tetris:help', false, blocked);
  button(ctx, targets, rect(r.x + r.w - w, r.y, w, r.h), '分享', 'share');
  text(ctx, '俄罗斯方块', r.x + w + 12, r.y + r.h / 2, layout.compact ? 20 : 24, COLORS.green, 'left', '700', r.w - w * 3 - gap - 24);
}

function metric(ctx, area, label, value, large = false) {
  rounded(ctx, area, 9, COLORS.pale);
  const size = Math.min(large ? 25 : 20, area.h * 0.43);
  text(ctx, label, area.x + area.w / 2, area.y + area.h * 0.25, Math.min(11, area.h * 0.23), COLORS.muted, 'center', '400', area.w - 8);
  text(ctx, value, area.x + area.w / 2, area.y + area.h * 0.69, size, COLORS.green, 'center', '700', area.w - 8);
}

function information(ctx, layout, state) {
  const r = layout.scores, round = state.round, best = Math.max(Number(state.best) || 0, round.score);
  if (layout.landscape) {
    const items = [['得分', round.score], ['最佳', best], ['等级', round.level], ['消行', round.lines]], gap = 6, w = (r.w - gap * 3) / 4;
    items.forEach(([label, value], index) => metric(ctx, rect(r.x + index * (w + gap), r.y, w, r.h), label, value));
  } else {
    const h = (r.h - 5) / 2;
    metric(ctx, rect(r.x, r.y, r.w, h), '得分', round.score, true);
    metric(ctx, rect(r.x, r.y + h + 5, r.w, h), '本机最佳', best);
    const m = layout.metrics, w = (m.w - 5) / 2;
    metric(ctx, rect(m.x, m.y, w, m.h), '等级', round.level);
    metric(ctx, rect(m.x + w + 5, m.y, w, m.h), '消行', round.lines);
  }
}

function block(ctx, x, y, size, value, ghost = false) {
  const gap = Math.max(0.6, size * 0.07), area = rect(x + gap, y + gap, size - gap * 2, size - gap * 2);
  rounded(ctx, area, Math.max(0.7, size * 0.11), ghost ? '#274e42' : BLOCKS[value] || BLOCKS[1], ghost ? COLORS.ghost : null);
  if (!ghost && size > 6) {
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    ctx.fillRect(area.x + size * 0.1, area.y + size * 0.1, Math.max(1, area.w - size * 0.2), Math.max(1, size * 0.09));
  }
}

function preview(ctx, type, area) {
  const points = cells({ type, rotation: 0, x: 0, y: 0 });
  if (!points.length) return;
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  const size = Math.max(1, Math.min(17, area.w / 4.5, area.h / 2.8));
  const x = area.x + (area.w - (maxX - minX + 1) * size) / 2, y = area.y + (area.h - (maxY - minY + 1) * size) / 2;
  for (const [cx, cy] of points) block(ctx, x + (cx - minX) * size, y + (cy - minY) * size, size, TYPES.indexOf(type) + 1);
}

function nextPieces(ctx, layout, state) {
  const r = layout.next;
  rounded(ctx, r, 9, COLORS.paper, COLORS.line);
  const labelHeight = Math.min(22, r.h * 0.27);
  text(ctx, '接下来', r.x + r.w / 2, r.y + labelHeight / 2, Math.min(11, labelHeight * 0.65), COLORS.muted, 'center', '500', r.w - 8);
  const inner = rect(r.x + 3, r.y + labelHeight, r.w - 6, r.h - labelHeight - 3);
  const vertical = !layout.landscape && inner.h >= 112;
  state.round.queue.slice(0, 3).forEach((type, index) => {
    const cell = vertical ? rect(inner.x, inner.y + index * inner.h / 3, inner.w, inner.h / 3)
      : rect(inner.x + index * inner.w / 3, inner.y, inner.w / 3, inner.h);
    preview(ctx, type, cell);
  });
}

function drawBoard(ctx, layout, state) {
  const r = layout.board, size = layout.cell;
  rounded(ctx, rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6), 6, COLORS.board);
  ctx.fillStyle = COLORS.grid;
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    ctx.fillRect(r.x + x * size + size * 0.08, r.y + y * size + size * 0.08, size * 0.84, size * 0.84);
    const value = state.round.board[y * WIDTH + x];
    if (value) block(ctx, r.x + x * size, r.y + y * size, size, value);
    ctx.fillStyle = COLORS.grid;
  }
  const active = state.round.active;
  if (!active) return;
  const distance = dropDistance(state.round), value = TYPES.indexOf(active.type) + 1;
  for (const [x, y] of cells({ ...active, y: active.y + distance })) if (y >= 0 && y < HEIGHT && distance > 0)
    block(ctx, r.x + x * size, r.y + y * size, size, value, true);
  for (const [x, y] of cells(active)) if (y >= 0 && y < HEIGHT)
    block(ctx, r.x + x * size, r.y + y * size, size, value);
}

function controls(ctx, layout, targets, blocked) {
  const r = layout.controls, gap = 6;
  const choices = [['← 左移', 'left'], ['旋转', 'rotate'], ['右移 →', 'right'], ['↓ 软降', 'soft-drop'], ['直落', 'hard-drop']];
  if (layout.landscape) {
    const w = (r.w - gap * 4) / 5;
    choices.forEach(([label, action], i) => button(ctx, targets, rect(r.x + i * (w + gap), r.y, w, r.h), label, `tetris:${action}`, action === 'hard-drop', blocked));
  } else {
    const h = (r.h - gap) / 2, w = (r.w - gap * 2) / 3;
    choices.slice(0, 3).forEach(([label, action], i) => button(ctx, targets, rect(r.x + i * (w + gap), r.y, w, h), label, `tetris:${action}`, false, blocked));
    const bottomW = (r.w - gap) / 2;
    choices.slice(3).forEach(([label, action], i) => button(ctx, targets, rect(r.x + i * (bottomW + gap), r.y + h + gap, bottomW, h), label, `tetris:${action}`, action === 'hard-drop', blocked));
  }
  const t = layout.tools, h = layout.landscape ? t.h : (t.h - gap) / 2, w = layout.landscape ? (t.w - gap) / 2 : t.w;
  button(ctx, targets, rect(t.x, t.y, w, h), '暂停', 'tetris:pause', false, blocked);
  button(ctx, targets, rect(t.x + (layout.landscape ? w + gap : 0), t.y + (layout.landscape ? 0 : h + gap), w, h), '重开', 'tetris:new', false, blocked);
}

function overlay(ctx, layout, state, targets) {
  const over = state.status === 'over' || state.round.status === 'over';
  const y = layout.header.y + layout.header.h + 4, h = layout.bottom - y;
  ctx.fillStyle = 'rgba(247,248,242,.88)'; ctx.fillRect(0, y, layout.width, h);
  const panelW = Math.min(316, layout.width - 32), panelH = Math.min(176, h - 8);
  const panel = rect((layout.width - panelW) / 2, y + (h - panelH) / 2, panelW, panelH);
  rounded(ctx, panel, 15, COLORS.paper, COLORS.line);
  const actionH = panelH < 140 ? 34 : 44;
  text(ctx, over ? '本局结束' : '休息一下', panel.x + panelW / 2, panel.y + panelH * 0.23, Math.min(24, panelH * 0.2), COLORS.green, 'center', '700', panelW - 24);
  text(ctx, over ? `${state.round.score} 分 · 消除 ${state.round.lines} 行` : '进度已保留，准备好再继续', panel.x + panelW / 2,
    panel.y + panelH * 0.45, Math.min(13, panelH * 0.12), COLORS.muted, 'center', '400', panelW - 24);
  const result = targets.filter(target => target.action === 'home' || target.action === 'share');
  button(ctx, result, rect(panel.x + 16, panel.y + panelH - actionH - 12, panelW - 32, actionH), over ? '再来一局' : '继续游戏', over ? 'tetris:new' : 'tetris:resume', true);
  return result;
}

function renderGame(ctx, layout, state) {
  const targets = [], blocked = state.paused || state.status === 'over' || state.round.status === 'over';
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  header(ctx, layout, targets, blocked);
  information(ctx, layout, state); nextPieces(ctx, layout, state); drawBoard(ctx, layout, state);
  controls(ctx, layout, targets, blocked);
  if (layout.hint) {
    const r = layout.hint;
    const message = state.storageAvailable === false ? '暂无法存档，请保持本页打开' : '点棋盘旋转 · 左右滑动 · 直落立即放置';
    text(ctx, message, r.x + r.w / 2, r.y + r.h / 2, 11, COLORS.muted, 'center', '400', r.w - 4);
  } else if (state.storageAvailable === false) {
    const r = layout.next;
    rounded(ctx, r, 9, '#f5e7dc');
    text(ctx, '暂无法存档', r.x + r.w / 2, r.y + r.h / 2, Math.min(12, r.h * 0.38), '#8a5c44', 'center', '500', r.w - 8);
  }
  return blocked ? overlay(ctx, layout, state, targets) : targets;
}

module.exports = { createLayout, renderGame, COLORS, BLOCKS };
