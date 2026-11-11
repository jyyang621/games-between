'use strict';

// Canvas only: the controller owns input, the clock, rules and persistence.
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const COLORS = Object.freeze({
  background: '#f8f9f5', paper: '#ffffff', ink: '#263c35', muted: '#7d887f',
  green: '#36594e', pale: '#eaf0e8', line: '#dfe5db', board: '#d7dfd1',
  covered: '#f0f3e9', open: '#fffdf7', flag: '#bc7956', danger: '#d87661',
});
const DIFFICULTIES = Object.freeze({
  beginner: { label: '初级', rows: 9, cols: 9, mineCount: 10 },
  intermediate: { label: '中级', rows: 12, cols: 9, mineCount: 20 },
  expert: { label: '高级', rows: 16, cols: 12, mineCount: 40 },
});
const NUMBERS = ['#7b8779', '#447f9a', '#4c8063', '#b37358', '#7c689b', '#ac7651', '#4c8c88', '#5d665e', '#817568'];
const rect = (x, y, w, h) => ({ x, y, w, h });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function difficultyInfo(value) {
  const id = typeof value === 'string' ? value : value && value.difficulty;
  const preset = DIFFICULTIES[id] || DIFFICULTIES.beginner;
  return {
    id: DIFFICULTIES[id] ? id : 'beginner',
    rows: clamp(Math.trunc(Number(value && value.rows) || preset.rows), 1, 40),
    cols: clamp(Math.trunc(Number(value && value.cols) || preset.cols), 1, 40),
  };
}

function createLayout(viewport = {}, roundOrDifficulty = 'beginner') {
  const width = Math.max(240, Number(viewport.width) || 375);
  const height = Math.max(240, Number(viewport.height) || 667);
  const safeTop = clamp(Number(viewport.safeTop) || 0, 0, height * 0.4);
  const safeBottom = clamp(Number(viewport.safeBottom) || 0, 0, height * 0.25);
  const capsule = viewport.capsuleRect;
  const capsuleBottom = capsule ? Number(capsule.bottom) || (Number(capsule.y) || 0) + (Number(capsule.height) || 0) : 0;
  const top = Math.max(safeTop, capsuleBottom) + 6;
  const bottom = height - safeBottom - 6;
  const available = bottom - top;
  const compact = available < 340;
  const landscape = width > height * 1.08 || compact;
  const margin = width < 350 ? 10 : 16;
  const mainWidth = Math.min(width - margin * 2, 1000);
  const x = (width - mainWidth) / 2;
  const header = rect(x, top, mainWidth, compact ? 30 : 36);
  const layout = { width, height, safeTop, safeBottom, top, bottom, compact, landscape, header, capsuleRect: capsule || null, ...difficultyInfo(roundOrDifficulty) };
  const bodyY = header.y + header.h + 6;
  const bodyHeight = Math.max(20, bottom - bodyY);

  if (landscape) {
    const gap = compact ? 10 : 24;
    const railWidth = Math.min(compact ? 150 : 260, mainWidth * (compact ? 0.47 : 0.38));
    const boardWidth = Math.max(10, mainWidth - railWidth - gap);
    const cell = Math.max(0.5, Math.min((boardWidth - 4) / layout.cols, (bodyHeight - 4) / layout.rows));
    const bw = cell * layout.cols + 4, bh = cell * layout.rows + 4;
    const contentWidth = bw + gap + railWidth;
    const contentX = x + (mainWidth - contentWidth) / 2;
    layout.board = rect(contentX, bodyY + (bodyHeight - bh) / 2, bw, bh);
    const railX = contentX + bw + gap;
    const rowGap = compact ? 4 : 10;
    const rowHeight = compact ? Math.min(24, (bodyHeight - rowGap * 3) / 4) : Math.min(36, (bodyHeight - rowGap * 3) / 4);
    layout.scores = rect(railX, bodyY, railWidth, rowHeight);
    layout.difficulty = rect(railX, bodyY + rowHeight + rowGap, railWidth, rowHeight);
    layout.mode = rect(railX, bodyY + (rowHeight + rowGap) * 2, railWidth, rowHeight);
    layout.tools = rect(railX, bodyY + (rowHeight + rowGap) * 3, railWidth, rowHeight);
    const hintY = layout.tools.y + rowHeight + rowGap;
    layout.hint = bottom - hintY >= 28 ? rect(railX, hintY, railWidth, Math.min(54, bottom - hintY)) : null;
  } else {
    layout.scores = rect(x, bodyY, mainWidth, 32);
    layout.difficulty = rect(x, layout.scores.y + layout.scores.h + 6, mainWidth, 30);
    const toolHeight = 36;
    layout.tools = rect(x, bottom - toolHeight, mainWidth, toolHeight);
    layout.mode = layout.tools;
    layout.hint = rect(x, layout.tools.y - 22, mainWidth, 16);
    const boardTop = layout.difficulty.y + layout.difficulty.h + 8;
    const boardHeight = Math.max(10, layout.hint.y - 8 - boardTop);
    const cell = Math.max(0.5, Math.min((mainWidth - 4) / layout.cols, (boardHeight - 4) / layout.rows));
    const bw = cell * layout.cols + 4, bh = cell * layout.rows + 4;
    layout.board = rect(x + (mainWidth - bw) / 2, boardTop + (boardHeight - bh) / 2, bw, bh);
  }

  layout.cellSize = (layout.board.w - 4) / layout.cols;
  layout.gap = clamp(layout.cellSize * 0.055, 0.5, 2);
  layout.cells = Array.from({ length: layout.rows * layout.cols }, (_, index) => rect(
    layout.board.x + 2 + index % layout.cols * layout.cellSize + layout.gap / 2,
    layout.board.y + 2 + Math.floor(index / layout.cols) * layout.cellSize + layout.gap / 2,
    layout.cellSize - layout.gap, layout.cellSize - layout.gap,
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
      fitted = Math.max(1, fitted * Math.max(1, maxWidth) / measured.width);
      ctx.font = `${weight} ${fitted}px ${FONT}`;
    }
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function button(ctx, targets, area, label, action, payload, primary = false) {
  rounded(ctx, area, Math.min(9, area.h * 0.24), primary ? COLORS.green : COLORS.paper, primary ? null : COLORS.line);
  text(ctx, label, area.x + area.w / 2, area.y + area.h / 2, area.h < 28 ? 10 : 12,
    primary ? '#ffffff' : COLORS.green, 'center', '500', area.w - 6);
  targets.push({ ...area, action, ...(payload === undefined ? {} : { payload }), label });
}

function drawHeader(ctx, layout, targets) {
  const h = layout.header, buttonWidth = h.h + 6;
  button(ctx, targets, rect(h.x, h.y, buttonWidth, h.h), '大厅', 'home');
  button(ctx, targets, rect(h.x + h.w - buttonWidth, h.y, buttonWidth, h.h), '分享', 'share');
  text(ctx, '扫雷', h.x + h.w / 2, h.y + h.h / 2, layout.compact ? 22 : 27, COLORS.green, 'center', '700', h.w - buttonWidth * 2 - 12);
}

function timeLabel(milliseconds) {
  const seconds = Math.floor(Math.max(0, Math.min(359999000, Number(milliseconds) || 0)) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function drawScores(ctx, layout, state) {
  const r = layout.scores;
  const round = state.round;
  const flags = (round.flags || []).filter(Boolean).length;
  const best = state.bests && state.bests[round.difficulty];
  const labels = [
    `余雷 ${Number(round.mineCount) - flags}`,
    timeLabel(round.elapsedMs),
    best === null || best === undefined ? '最佳 —' : `最佳 ${timeLabel(best)}`,
  ];
  rounded(ctx, r, Math.min(9, r.h / 4), COLORS.pale);
  labels.forEach((label, i) => text(ctx, label, r.x + r.w * (i + 0.5) / 3, r.y + r.h / 2,
    layout.compact ? 9 : 11, i === 1 ? COLORS.green : COLORS.muted, 'center', i === 1 ? '600' : '400', r.w / 3 - 5));
}

function drawChoices(ctx, layout, state, targets) {
  const choices = Object.entries(DIFFICULTIES), d = layout.difficulty;
  const gap = layout.compact ? 3 : 6, w = (d.w - gap * 2) / 3;
  choices.forEach(([id, value], i) => button(ctx, targets, rect(d.x + i * (w + gap), d.y, w, d.h),
    value.label, 'minesweeper:difficulty', id, state.round.difficulty === id));
  const modeChoices = [['翻开', 'minesweeper:mode', 'reveal'], ['插旗', 'minesweeper:mode', 'flag']];
  const toolChoices = [[state.paused ? '继续' : '暂停', state.paused ? 'minesweeper:resume' : 'minesweeper:pause'], ['重开', 'minesweeper:new'], ['玩法', 'minesweeper:help']];
  const drawRow = (area, options) => {
    const rowGap = layout.compact ? 3 : 5, width = (area.w - rowGap * (options.length - 1)) / options.length;
    options.forEach(([label, action, payload], i) => button(ctx, targets, rect(area.x + i * (width + rowGap), area.y, width, area.h), label,
      action, payload, action === 'minesweeper:mode' && (state.mode || 'reveal') === payload));
  };
  if (layout.landscape) { drawRow(layout.mode, modeChoices); drawRow(layout.tools, toolChoices); }
  else drawRow(layout.tools, [...modeChoices, ...toolChoices]);
}

function adjacent(round, index) {
  const row = Math.floor(index / round.cols), col = index % round.cols;
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
    const y = row + dr, x = col + dc;
    if ((dr || dc) && y >= 0 && y < round.rows && x >= 0 && x < round.cols && round.mines[y * round.cols + x]) count += 1;
  }
  return count;
}

function drawFlag(ctx, cell) {
  const cx = cell.x + cell.w * 0.46, top = cell.y + cell.h * 0.22, low = cell.y + cell.h * 0.78;
  ctx.lineWidth = Math.max(1, cell.w * 0.065); ctx.strokeStyle = COLORS.green;
  ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, low); ctx.moveTo(cell.x + cell.w * 0.27, low); ctx.lineTo(cell.x + cell.w * 0.72, low); ctx.stroke();
  ctx.fillStyle = COLORS.flag; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cell.x + cell.w * 0.77, cell.y + cell.h * 0.36); ctx.lineTo(cx, cell.y + cell.h * 0.51); ctx.closePath(); ctx.fill();
}

function drawMine(ctx, cell) {
  const x = cell.x + cell.w / 2, y = cell.y + cell.h / 2, radius = cell.w * 0.19;
  ctx.strokeStyle = COLORS.green; ctx.lineWidth = Math.max(1, cell.w * 0.06);
  for (let i = 0; i < 4; i += 1) {
    const a = i * Math.PI / 4, dx = Math.cos(a) * radius * 1.5, dy = Math.sin(a) * radius * 1.5;
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  }
  ctx.fillStyle = COLORS.green; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - radius * 0.3, y - radius * 0.3, Math.max(0.4, radius * 0.2), 0, Math.PI * 2); ctx.fill();
}

function drawBoard(ctx, layout, state, targets) {
  const round = state.round, terminal = round.status === 'won' || round.status === 'lost';
  rounded(ctx, layout.board, Math.min(9, layout.cellSize * 0.24), COLORS.board);
  layout.cells.forEach((cell, index) => {
    const revealed = !state.paused && Boolean(round.revealed[index]);
    const flagged = !state.paused && Boolean(round.flags[index]);
    const mineVisible = !state.paused && terminal && round.mines[index];
    rounded(ctx, cell, Math.max(0.5, Math.min(4, cell.w * 0.12)),
      mineVisible && round.exploded === index ? '#f2cfc1' : revealed || mineVisible ? COLORS.open : COLORS.covered);
    let label = '未翻开';
    if (mineVisible) { drawMine(ctx, cell); label = '地雷'; }
    else if (flagged) { drawFlag(ctx, cell); label = '已插旗'; }
    else if (revealed) {
      const count = adjacent(round, index);
      if (count) text(ctx, count, cell.x + cell.w / 2, cell.y + cell.h / 2 + cell.h * 0.02,
        cell.w * 0.62, NUMBERS[count], 'center', '600', cell.w * 0.9);
      label = count ? `周围有${count}颗雷` : '空白';
    }
    // Labels for covered cells deliberately never inspect a hidden mine.
    if (!state.paused && !terminal) targets.push({ ...cell, action: 'minesweeper:cell', payload: index,
      label: `第${Math.floor(index / layout.cols) + 1}行第${index % layout.cols + 1}列，${label}` });
  });
}

function overlay(ctx, layout, state, targets) {
  const round = state.round, terminal = round.status === 'won' || round.status === 'lost';
  const title = terminal ? round.status === 'won' ? '雷区，顺利排除！' : '碰到地雷啦' : '歇一会儿，再继续';
  const subtitle = terminal ? round.status === 'won' ? `用时 ${timeLabel(round.elapsedMs)} · 再试一个好成绩` : '换个思路，再来一局' : '棋盘与计时已为你保留';
  const top = layout.header.y + layout.header.h + 4, height = layout.bottom - top;
  ctx.fillStyle = state.paused && !terminal ? COLORS.background : 'rgba(248,249,245,.84)';
  ctx.fillRect(0, top, layout.width, height);
  const h = Math.min(170, height), w = Math.min(330, layout.width - 32);
  const panel = rect((layout.width - w) / 2, top + (height - h) / 2, w, h);
  rounded(ctx, panel, Math.min(16, h * 0.1), COLORS.paper, COLORS.line);
  const short = h < 130, buttonHeight = short ? 26 : 38;
  const buttonY = panel.y + panel.h - buttonHeight - (short ? 8 : 14);
  text(ctx, title, panel.x + panel.w / 2, panel.y + (short ? 18 : 32), short ? 17 : 23, COLORS.green, 'center', '600', panel.w - 20);
  text(ctx, subtitle, panel.x + panel.w / 2, panel.y + (short ? 41 : 66), short ? 10 : 12, COLORS.muted, 'center', '400', panel.w - 20);
  const result = targets.filter(item => item.action === 'home' || item.action === 'share');
  button(ctx, result, rect(panel.x + 14, buttonY, panel.w - 28, buttonHeight), terminal ? '再来一局' : '继续游戏', terminal ? 'minesweeper:new' : 'minesweeper:resume', undefined, true);
  return result;
}

function renderGame(ctx, layout, state) {
  const targets = [];
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  drawHeader(ctx, layout, targets);
  drawScores(ctx, layout, state);
  drawChoices(ctx, layout, state, targets);
  drawBoard(ctx, layout, state, targets);
  if (layout.hint) {
    const r = layout.hint;
    const hint = state.storageAvailable === false ? '暂无法存档，请保持本页打开' : !state.round.started ? '首步安全 · 先翻开一格试试' : state.mode === 'flag' ? '插旗模式 · 再点旗子可取消' : '翻开模式 · 点数字可快速排查';
    text(ctx, hint, r.x + r.w / 2, r.y + r.h / 2, layout.compact ? 10 : 11, COLORS.muted, 'center', '400', r.w - 4);
  }
  return state.paused || state.round.status === 'won' || state.round.status === 'lost' ? overlay(ctx, layout, state, targets) : targets;
}

module.exports = { createLayout, renderGame, COLORS };
