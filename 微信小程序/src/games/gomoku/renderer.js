'use strict';

// Canvas-only view. Rules, AI, lifecycle and persistence belong to the module.
const SIZE = 15;
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const COLORS = Object.freeze({
  background: '#f8f9f5', paper: '#ffffff', ink: '#263c35', muted: '#77837a',
  green: '#36594e', pale: '#eaf0e8', line: '#dfe5db', wood: '#e7c891',
  woodEdge: '#bb925c', grid: '#987447', black: '#29332e', white: '#fffdf6', red: '#bd5548',
});
const rect = (x, y, w, h) => ({ x, y, w, h });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createLayout(viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 375);
  const height = Math.max(240, Number(viewport.height) || 750);
  const safeTop = clamp(Number(viewport.safeTop) || 0, 0, height * 0.4);
  const safeBottom = clamp(Number(viewport.safeBottom) || 0, 0, height * 0.25);
  const capsule = viewport.capsuleRect;
  const capsuleBottom = capsule ? Number(capsule.bottom) || ((Number(capsule.y) || 0) + (Number(capsule.height) || 0)) : 0;
  const top = Math.max(safeTop, capsuleBottom) + 8, bottom = height - safeBottom - 8;
  const margin = width < 350 ? 12 : 16, mainWidth = Math.min(width - margin * 2, 1000);
  const x = (width - mainWidth) / 2, available = bottom - top;
  const landscape = width > height * 1.1 || available < 400;
  const compact = available < 540;
  const header = rect(x, top, mainWidth, available < 300 ? 32 : compact ? 36 : 42);
  const layout = { width, height, safeTop, safeBottom, top, bottom, landscape, compact, header };
  const bodyY = header.y + header.h + 8;

  if (landscape) {
    const bodyHeight = bottom - bodyY, gap = mainWidth < 400 ? 10 : 24;
    const railWidth = Math.min(clamp(mainWidth * 0.43, 130, 290), mainWidth * 0.58);
    const size = Math.max(20, Math.min(bodyHeight, mainWidth - railWidth - gap));
    const contentX = x + (mainWidth - size - gap - railWidth) / 2;
    layout.board = rect(contentX, bodyY + (bodyHeight - size) / 2, size, size);
    const railX = contentX + size + gap;
    const scale = Math.min(1, bodyHeight / 172), rowGap = 6 * scale;
    let y = bodyY + Math.max(0, Math.min(20, (bodyHeight - 172) / 2));
    layout.modes = rect(railX, y, railWidth, 34 * scale); y += layout.modes.h + rowGap;
    layout.status = rect(railX, y, railWidth, 54 * scale); y += layout.status.h + rowGap;
    layout.tools = rect(railX, y, railWidth, 36 * scale); y += layout.tools.h + rowGap;
    layout.hint = rect(railX, y, railWidth, 30 * scale);
  } else {
    layout.modes = rect(x, bodyY, mainWidth, compact ? 32 : 36);
    layout.status = rect(x, bodyY + layout.modes.h + 6, mainWidth, compact ? 34 : 44);
    layout.hint = rect(x, bottom - 20, mainWidth, 20);
    layout.tools = rect(x, layout.hint.y - 4 - (compact ? 36 : 42), mainWidth, compact ? 36 : 42);
    const boardTop = layout.status.y + layout.status.h + 8;
    const boardHeight = Math.max(20, layout.tools.y - 8 - boardTop);
    const size = Math.min(mainWidth, boardHeight);
    layout.board = rect(x + (mainWidth - size) / 2, boardTop + (boardHeight - size) / 2, size, size);
  }

  const padding = layout.board.w * 0.055;
  const grid = rect(layout.board.x + padding, layout.board.y + padding,
    layout.board.w - padding * 2, layout.board.h - padding * 2);
  layout.grid = grid;
  layout.step = grid.w / (SIZE - 1);
  layout.cells = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const cx = grid.x + index % SIZE * layout.step;
    const cy = grid.y + Math.floor(index / SIZE) * layout.step;
    return { ...rect(cx - layout.step / 2, cy - layout.step / 2, layout.step, layout.step), cx, cy };
  });
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
    if (measured && measured.width > maxWidth) ctx.font = `${weight} ${Math.max(1, size * maxWidth / measured.width)}px ${FONT}`;
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}

function button(ctx, targets, area, label, action, payload, primary = false, disabled = false) {
  rounded(ctx, area, 9, disabled ? '#edf0e9' : primary ? COLORS.green : COLORS.paper, primary ? null : COLORS.line);
  text(ctx, label, area.x + area.w / 2, area.y + area.h / 2, Math.min(13, area.h * 0.38),
    disabled ? '#9aa39b' : primary ? '#ffffff' : COLORS.green, 'center', '500', area.w - 8);
  if (!disabled) targets.push({ ...area, action, ...(payload === undefined ? {} : { payload }), label });
}

function header(ctx, layout, targets) {
  const r = layout.header, w = Math.min(42, r.h + 4), gap = 5;
  button(ctx, targets, rect(r.x, r.y, w, r.h), '大厅', 'home');
  button(ctx, targets, rect(r.x + r.w - w * 2 - gap, r.y, w, r.h), '玩法', 'gomoku:help');
  button(ctx, targets, rect(r.x + r.w - w, r.y, w, r.h), '分享', 'share');
  const titleX = r.x + w + 10, titleWidth = r.w - w * 3 - gap - 20;
  text(ctx, '五子棋', titleX, r.y + r.h / 2, Math.min(26, r.h * 0.65), COLORS.green, 'left', '700', titleWidth);
}

function statusLabel(state) {
  const round = state.round;
  if (round.status === 'won') return round.mode === 'ai' ? round.winner === round.humanColor ? '你赢了！' : '电脑获胜' : round.winner === 1 ? '黑棋获胜' : '白棋获胜';
  if (round.status === 'draw') return '和棋，再来一局';
  if (state.paused) return '已暂停';
  if (state.thinking || (round.mode === 'ai' && round.turn !== round.humanColor)) return '电脑思考中';
  return round.mode === 'ai' ? '轮到你落子' : round.turn === 1 ? '轮到黑棋' : '轮到白棋';
}

function choices(ctx, layout, state, targets) {
  const round = state.round, modes = layout.modes, gap = 6;
  const difficultyLabel = round.difficulty === 'easy' ? '简单' : round.difficulty === 'hard' ? '困难' : '普通';
  const choiceCount = round.mode === 'ai' ? 3 : 2;
  const w = (modes.w - gap * (choiceCount - 1)) / choiceCount;
  const paused = state.paused && round.status === 'playing';
  [['人机对战', 'ai'], ['同机双人', 'local']].forEach(([label, mode], i) =>
    button(ctx, targets, rect(modes.x + i * (w + gap), modes.y, w, modes.h), label, 'gomoku:mode', mode, round.mode === mode, paused));
  if (round.mode === 'ai') button(ctx, targets, rect(modes.x + 2 * (w + gap), modes.y, w, modes.h),
    `${difficultyLabel}难度`, 'gomoku:chooseDifficulty', undefined, false, paused);
  const r = layout.status, switchWidth = Math.min(66, r.w * 0.34);
  rounded(ctx, r, 9, COLORS.pale);
  const titleY = r.y + r.h * 0.33, subtitleY = r.y + r.h * 0.77;
  const size = Math.min(15, r.h * 0.4), stoneRadius = Math.min(5, r.h * 0.12);
  const statusColor = round.status === 'won' ? round.winner : round.turn;
  ctx.fillStyle = statusColor === 1 ? COLORS.black : COLORS.white;
  ctx.strokeStyle = '#8a947f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(r.x + 12, titleY, stoneRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  text(ctx, statusLabel(state), r.x + 23, titleY, size, COLORS.green, 'left', '600', r.w - 31 - (round.mode === 'ai' ? switchWidth + 6 : 0));
  const side = round.mode === 'ai' ? `你执${round.humanColor === 1 ? '黑' : '白'} · ${difficultyLabel}电脑` : '黑白轮流落子';
  text(ctx, `${side} · ${round.moves.length} 手`, r.x + 10, subtitleY, Math.min(11, r.h * 0.27), COLORS.muted, 'left', '400', r.w - 20);
  if (round.mode === 'ai') button(ctx, targets,
    rect(r.x + r.w - switchWidth - 5, r.y + 4, switchWidth, Math.min(28, r.h * 0.52)),
    '换先后', 'gomoku:color', round.humanColor === 1 ? 2 : 1, false, paused);
  const tools = layout.tools, bw = (tools.w - 12) / 3;
  const live = round.status === 'playing';
  const canUndo = round.mode === 'ai' ? round.moves.length >= round.humanColor : round.moves.length > 0;
  button(ctx, targets, rect(tools.x, tools.y, bw, tools.h), '悔棋', 'gomoku:undo', undefined, false, paused || !canUndo);
  button(ctx, targets, rect(tools.x + bw + 6, tools.y, bw, tools.h), live ? '重开' : '再来一局', 'gomoku:new', undefined, false, paused);
  button(ctx, targets, rect(tools.x + (bw + 6) * 2, tools.y, bw, tools.h), state.paused && live ? '继续' : '暂停', state.paused ? 'gomoku:resume' : 'gomoku:pause', undefined, false, !live);
}

function drawBoard(ctx, layout, state, targets) {
  const { board, grid, step } = layout, round = state.round;
  rounded(ctx, board, Math.min(12, board.w * 0.035), COLORS.wood, COLORS.woodEdge);
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = Math.max(0.6, step * 0.035);
  for (let i = 0; i < SIZE; i += 1) {
    const d = i * step;
    ctx.beginPath(); ctx.moveTo(grid.x + d, grid.y); ctx.lineTo(grid.x + d, grid.y + grid.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(grid.x, grid.y + d); ctx.lineTo(grid.x + grid.w, grid.y + d); ctx.stroke();
  }
  ctx.fillStyle = COLORS.grid;
  for (const [row, col] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) {
    ctx.beginPath(); ctx.arc(grid.x + col * step, grid.y + row * step, Math.max(1.3, step * 0.1), 0, Math.PI * 2); ctx.fill();
  }
  const active = !state.paused && !state.thinking && round.status === 'playing' && (round.mode !== 'ai' || round.turn === round.humanColor);
  const lastMove = round.moves[round.moves.length - 1];
  const winning = new Set(round.winningLine || []);
  layout.cells.forEach((cell, index) => {
    const color = round.board[index];
    if (color) {
      const radius = step * 0.43;
      ctx.beginPath(); ctx.arc(cell.cx + radius * 0.05, cell.cy + radius * 0.13, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(72,49,24,.18)'; ctx.fill();
      ctx.beginPath(); ctx.arc(cell.cx, cell.cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color === 1 ? COLORS.black : COLORS.white; ctx.fill();
      ctx.lineWidth = winning.has(index) ? Math.max(1.5, step * 0.1) : 0.7;
      ctx.strokeStyle = winning.has(index) ? COLORS.red : color === 1 ? '#19261f' : '#a99b7e'; ctx.stroke();
      ctx.fillStyle = color === 1 ? 'rgba(255,255,255,.12)' : '#ffffff';
      ctx.beginPath(); ctx.arc(cell.cx - radius * 0.25, cell.cy - radius * 0.29, radius * 0.28, 0, Math.PI * 2); ctx.fill();
      if (lastMove === index) {
        ctx.fillStyle = COLORS.red; ctx.beginPath(); ctx.arc(cell.cx, cell.cy, Math.max(1.3, step * 0.095), 0, Math.PI * 2); ctx.fill();
      }
    } else if (active) targets.push({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, action: 'gomoku:cell', payload: index,
      label: `第${Math.floor(index / SIZE) + 1}行第${index % SIZE + 1}列，落${round.turn === 1 ? '黑' : '白'}棋` });
  });
  if (round.winningLine && round.winningLine.length > 1) {
    const first = layout.cells[round.winningLine[0]], last = layout.cells[round.winningLine[round.winningLine.length - 1]];
    if (first && last) {
      ctx.strokeStyle = 'rgba(189,85,72,.75)'; ctx.lineWidth = Math.max(1.5, step * 0.08);
      ctx.beginPath(); ctx.moveTo(first.cx, first.cy); ctx.lineTo(last.cx, last.cy); ctx.stroke();
    }
  }
}

function pauseOverlay(ctx, layout, targets) {
  const board = layout.board;
  rounded(ctx, board, 10, 'rgba(248,249,245,.86)');
  const w = board.w * 0.84, h = Math.min(132, board.h * 0.86);
  const panel = rect(board.x + (board.w - w) / 2, board.y + (board.h - h) / 2, w, h);
  rounded(ctx, panel, 12, COLORS.paper, COLORS.line);
  text(ctx, '棋局已保留', panel.x + w / 2, panel.y + h * 0.27, Math.min(20, h * 0.2), COLORS.green, 'center', '600', w - 12);
  const result = targets.filter(item => item.action === 'home' || item.action === 'share' || item.action === 'gomoku:help' || item.action === 'gomoku:resume');
  button(ctx, result, rect(panel.x + 10, panel.y + h * 0.52, w - 20, h * 0.33), '继续游戏', 'gomoku:resume', undefined, true);
  return result;
}

function renderGame(ctx, layout, state) {
  const targets = [];
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  header(ctx, layout, targets);
  choices(ctx, layout, state, targets);
  drawBoard(ctx, layout, state, targets);
  const r = layout.hint;
  const hint = state.storageAvailable === false ? '暂无法存档，请保持本页打开' : '黑先 · 连成五子获胜 · 无禁手';
  text(ctx, hint, r.x + r.w / 2, r.y + r.h / 2, Math.min(11, r.h * 0.5), COLORS.muted, 'center', '400', r.w - 4);
  return state.paused && state.round.status === 'playing' ? pauseOverlay(ctx, layout, targets) : targets;
}

module.exports = { createLayout, renderGame, statusLabel, COLORS };
