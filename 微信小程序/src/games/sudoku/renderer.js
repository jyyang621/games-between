'use strict';

// All dimensions are logical pixels. The host owns device-pixel-ratio and input;
// the Sudoku module supplies its state. This renderer only paints that state.
const COLORS = Object.freeze({
  background: '#f8f9f5', paper: '#ffffff', ink: '#263c35', muted: '#88918b',
  green: '#36594e', light: '#eaf0e8', line: '#dfe5db', selected: '#cce0cf',
  related: '#f0f4ed', same: '#e1ebdc', accent: '#9fb68d', blue: '#3b6e94',
  error: '#b94b4b', errorFill: '#fbebea', border: '#5d705b'
});
const DIFFICULTIES = [
  ['easy', '简单'], ['medium', '中等'], ['hard', '困难'], ['expert', '专家']
];
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';

function rect(x, y, w, h) { return { x, y, w, h }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/**
 * Lay out a complete, non-scrolling game for phone and tablet screens.
 * safeTop/safeBottom are edge insets, not absolute safe-area coordinates.
 * capsuleRect is the rect returned by wx.getMenuButtonBoundingClientRect().
 */
function createLayout(width, height, safeTop = 0, safeBottom = 0, capsuleRect = null) {
  const w = Math.max(240, Number(width) || 375);
  const h = Math.max(240, Number(height) || 667);
  const topInset = clamp(Number(safeTop) || 0, 0, h / 3);
  const bottomInset = clamp(Number(safeBottom) || 0, 0, h / 3);
  const landscape = w > h * 1.15;
  const compact = h - topInset - bottomInset < 650;
  const margin = w <= 340 ? 12 : 16;
  const mainWidth = Math.min(w - margin * 2, landscape ? 920 : 560);
  const x = (w - mainWidth) / 2;
  const top = topInset + 8;
  const bottom = h - bottomInset - 8;
  const headerHeight = compact ? 42 : 52;
  const settingsHeight = compact ? 36 : 40;
  const gap = compact ? 4 : 7;
  const header = rect(x, top, mainWidth, headerHeight);
  const settings = rect(x, header.y + header.h + gap, mainWidth, settingsHeight);
  const modeWidth = Math.min(132, Math.max(100, mainWidth * 0.32));
  const modes = rect(settings.x, settings.y, modeWidth, settings.h);
  const difficulty = rect(settings.x + modeWidth + 8, settings.y, mainWidth - modeWidth - 8, settings.h);
  const layout = {
    width: w, height: h, safeTop: topInset, safeBottom: bottomInset,
    compact, landscape, capsuleRect, header, modes, difficulty,
    main: rect(x, top, mainWidth, bottom - top), targets: []
  };

  const contentTop = settings.y + settings.h + gap;
  const contentHeight = bottom - contentTop;
  if (landscape) {
    // Size both columns from the same available height. A fixed side offset
    // otherwise pushes the footer into the home indicator on short screens.
    const dense = contentHeight < 196;
    const numbersHeight = dense ? 40 : 46;
    const toolsHeight = dense ? 48 : 58;
    const toolsGap = dense ? 4 : 8;
    const footerGap = dense ? 4 : 12;
    const footerHeight = 44;
    const sideHeight = numbersHeight + toolsGap + toolsHeight + footerGap + footerHeight;
    // Six tools retain 44px hit slots, including short landscape windows.
    const size = Math.max(1, Math.min(mainWidth * 0.52, contentHeight - 48, Math.max(1, mainWidth - 16 - 264)));
    const bx = x;
    layout.meta = rect(bx, contentTop, size, 26);
    layout.board = rect(bx, contentTop + 26, size, size);
    layout.status = rect(bx, layout.board.y + size + 3, size, 19);
    const sideX = bx + size + 16;
    const sideW = mainWidth - size - 16;
    const sideY = contentTop + Math.max(0, Math.min(28, contentHeight - sideHeight));
    layout.numbers = rect(sideX, sideY, sideW, numbersHeight);
    layout.tools = rect(sideX, layout.numbers.y + numbersHeight + toolsGap, sideW, toolsHeight);
    layout.footer = rect(sideX, layout.tools.y + toolsHeight + footerGap, sideW, footerHeight);
    layout.orientation = rect(sideX, layout.footer.y + footerHeight + 8, sideW, 18);
  } else {
    const dense = contentHeight < 324;
    const metaHeight = dense ? 22 : compact ? 26 : 30;
    const statusHeight = dense ? 18 : compact ? 20 : 24;
    const numbersHeight = dense ? 40 : compact ? 44 : 54;
    const toolsHeight = dense ? 44 : compact ? 52 : 62;
    const footerHeight = compact ? 44 : 46;
    const controlGap = dense ? 2 : gap;
    const fixedHeight = metaHeight + statusHeight + numbersHeight + toolsHeight + footerHeight + controlGap * 3;
    // Reserve controls first, then give the board the remaining square. Keeping
    // a hard minimum board size can move the entire footer outside safeBottom.
    const boardSize = Math.max(1, Math.min(mainWidth, contentHeight - fixedHeight));
    // When height limits the square, keep controls aligned to the full width.
    const boardX = x + (mainWidth - boardSize) / 2;
    const extra = Math.max(0, contentHeight - fixedHeight - boardSize);
    const beforeBoard = Math.min(extra * 0.32, 18);
    layout.meta = rect(boardX, contentTop + beforeBoard, boardSize, metaHeight);
    layout.board = rect(boardX, layout.meta.y + metaHeight, boardSize, boardSize);
    layout.status = rect(boardX, layout.board.y + boardSize, boardSize, statusHeight);
    layout.numbers = rect(x, layout.status.y + statusHeight + controlGap, mainWidth, numbersHeight);
    layout.tools = rect(x, layout.numbers.y + numbersHeight + controlGap, mainWidth, toolsHeight);
    layout.footer = rect(x, layout.tools.y + toolsHeight + controlGap + Math.min(extra * 0.22, 12), mainWidth, footerHeight);
  }
  layout.cellSize = layout.board.w / 9;
  return layout;
}

function roundedPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function box(ctx, r, fill, stroke, radius = 8, lineWidth = 1) {
  roundedPath(ctx, r.x, r.y, r.w, r.h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function text(ctx, value, x, y, size = 14, color = COLORS.ink, align = 'left', weight = '400') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y);
}

function fitText(ctx, value, x, y, maxWidth, size, color, align = 'left', weight = '400') {
  let label = String(value);
  ctx.font = `${weight} ${size}px ${FONT}`;
  if (ctx.measureText(label).width > maxWidth) {
    while (label.length > 1 && ctx.measureText(`${label}…`).width > maxWidth) label = label.slice(0, -1);
    label += '…';
  }
  text(ctx, label, x, y, size, color, align, weight);
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function gridIcon(ctx, x, y, size, color) {
  box(ctx, rect(x, y, size, size), null, color, 3, 1.3);
  for (let n = 1; n <= 2; n += 1) {
    line(ctx, x + size * n / 3, y, x + size * n / 3, y + size, color, 1);
    line(ctx, x, y + size * n / 3, x + size, y + size * n / 3, color, 1);
  }
}

function icon(ctx, name, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.65;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (name === 'undo') {
    ctx.moveTo(8, 5); ctx.lineTo(3, 10); ctx.lineTo(8, 15);
    ctx.moveTo(4, 10); ctx.lineTo(13, 10);
    ctx.bezierCurveTo(24, 10, 23, 22, 12, 21);
  } else if (name === 'erase') {
    ctx.moveTo(4, 14); ctx.lineTo(13, 4); ctx.lineTo(21, 11);
    ctx.lineTo(13, 21); ctx.lineTo(10, 21); ctx.closePath();
    ctx.moveTo(8, 10); ctx.lineTo(17, 17);
    ctx.moveTo(10, 21); ctx.lineTo(22, 21);
  } else if (name === 'notes') {
    ctx.moveTo(4, 16); ctx.lineTo(16, 4); ctx.lineTo(21, 9);
    ctx.lineTo(9, 21); ctx.lineTo(3, 22); ctx.closePath();
    ctx.moveTo(13, 7); ctx.lineTo(18, 12);
  } else if (name === 'autoNotes') {
    ctx.moveTo(3, 6); ctx.lineTo(3, 3); ctx.lineTo(6, 3);
    ctx.moveTo(18, 3); ctx.lineTo(21, 3); ctx.lineTo(21, 6);
    ctx.moveTo(21, 18); ctx.lineTo(21, 21); ctx.lineTo(18, 21);
    ctx.moveTo(6, 21); ctx.lineTo(3, 21); ctx.lineTo(3, 18);
  } else if (name === 'hint') {
    ctx.moveTo(8, 16);
    ctx.bezierCurveTo(8, 12, 5, 12, 5, 8);
    ctx.bezierCurveTo(5, -1, 19, -1, 19, 8);
    ctx.bezierCurveTo(19, 12, 16, 12, 16, 16);
    ctx.closePath();
    ctx.moveTo(9, 19); ctx.lineTo(15, 19);
    ctx.moveTo(10, 22); ctx.lineTo(14, 22);
  } else if (name === 'showAnswer') {
    ctx.rect(4, 3, 16, 18);
    ctx.moveTo(8, 8); ctx.lineTo(16, 8);
    ctx.moveTo(8, 12); ctx.lineTo(16, 12);
    ctx.moveTo(8, 16); ctx.lineTo(13, 16);
  } else if (name === 'pause') {
    ctx.moveTo(8, 4); ctx.lineTo(8, 20);
    ctx.moveTo(16, 4); ctx.lineTo(16, 20);
  } else if (name === 'play') {
    ctx.moveTo(8, 4); ctx.lineTo(20, 12); ctx.lineTo(8, 20); ctx.closePath();
  } else if (name === 'share') {
    ctx.moveTo(8, 8); ctx.lineTo(8, 5); ctx.lineTo(19, 5); ctx.lineTo(19, 16); ctx.lineTo(16, 16);
    ctx.moveTo(12, 12); ctx.lineTo(19, 5);
    ctx.moveTo(12, 5); ctx.lineTo(19, 5); ctx.lineTo(19, 12);
    ctx.moveTo(14, 9); ctx.lineTo(4, 9); ctx.lineTo(4, 21); ctx.lineTo(16, 21); ctx.lineTo(16, 12);
  } else if (name === 'plus') {
    ctx.moveTo(12, 4); ctx.lineTo(12, 20);
    ctx.moveTo(4, 12); ctx.lineTo(20, 12);
  } else if (name === 'check') {
    ctx.moveTo(4, 12); ctx.lineTo(9, 17); ctx.lineTo(20, 6);
  }
  ctx.stroke();
  if (name === 'autoNotes') {
    text(ctx, '1', 8, 8, 7, color, 'center');
    text(ctx, '2', 16, 8, 7, color, 'center');
    text(ctx, '3', 8, 16, 7, color, 'center');
    text(ctx, '4', 16, 16, 7, color, 'center');
  }
  if (name === 'more') {
    for (let n = 0; n < 3; n += 1) {
      ctx.beginPath(); ctx.arc(5 + 7 * n, 12, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function timeLabel(elapsed) {
  const total = Math.max(0, Math.floor((Number(elapsed) || 0) / 1000));
  const seconds = String(total % 60).padStart(2, '0');
  const minutes = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ''}${minutes}:${seconds}`;
}

function sameHouse(a, b) {
  return Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
    (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor(a % 9 / 3) === Math.floor(b % 9 / 3));
}

function conflictSet(board) {
  const found = new Set();
  for (let a = 0; a < 81; a += 1) {
    if (!board[a]) continue;
    for (let b = a + 1; b < 81; b += 1) {
      if (board[a] === board[b] && sameHouse(a, b)) { found.add(a); found.add(b); }
    }
  }
  return found;
}

function addTarget(targets, r, action, payload, label) {
  const target = { x: r.x, y: r.y, w: r.w, h: r.h, action };
  if (payload !== undefined) target.payload = payload;
  if (label) target.label = label;
  targets.push(target);
}

function segmented(ctx, r, choices, current, action, targets, disabled, fontSize) {
  box(ctx, r, '#eef2e9', null, 8);
  const inset = 3;
  const width = (r.w - inset * 2) / choices.length;
  choices.forEach((choice, index) => {
    const area = rect(r.x + inset + index * width, r.y + inset, width, r.h - inset * 2);
    const active = current === choice[0];
    if (active) box(ctx, area, COLORS.paper, null, 6);
    text(ctx, choice[1], area.x + area.w / 2, area.y + area.h / 2, fontSize,
      active ? COLORS.green : COLORS.muted, 'center', active ? '500' : '400');
    if (!disabled) addTarget(targets, rect(area.x, r.y, area.w, r.h), action, choice[0]);
  });
}

function drawHeader(ctx, layout, ui, targets) {
  const r = layout.header;
  const logoSize = layout.compact ? 30 : 34;
  const logoY = r.y + 3;
  box(ctx, rect(r.x, logoY, logoSize, logoSize), COLORS.green, null, 8);
  gridIcon(ctx, r.x + 7, logoY + 7, logoSize - 14, '#edf3e7');
  const tx = r.x + logoSize + 10;
  const cap = layout.capsuleRect;
  const capLeft = cap && Number.isFinite(cap.left) ? cap.left : layout.width;
  const capTop = cap && Number.isFinite(cap.top) ? cap.top : -1;
  const capBottom = cap && Number.isFinite(cap.bottom) ? cap.bottom : capTop + ((cap && cap.height) || 0);
  const titleUnderCapsule = capTop < r.y + 24 && capBottom > r.y;
  const titleWidth = (titleUnderCapsule ? capLeft - 8 : r.x + r.w) - tx;
  fitText(ctx, '数独之间', tx, r.y + 12, Math.max(80, titleWidth), layout.compact ? 20 : 22, COLORS.ink, 'left', '500');
  const subtitle = '‹ 返回大厅 · 给专注一点时间';
  const subtitleUnderCapsule = capTop < r.y + 40 && capBottom > r.y + 22;
  const subtitleWidth = (subtitleUnderCapsule ? capLeft - 8 : r.x + r.w) - tx;
  fitText(ctx, subtitle, tx, r.y + 33, Math.max(60, subtitleWidth), 10, COLORS.muted);
  addTarget(targets, rect(r.x, r.y, Math.min(230, r.w), r.h), 'home');
}

function drawMeta(ctx, layout, game, targets, generating) {
  const r = layout.meta;
  const name = DIFFICULTIES.find(item => item[0] === game.difficulty);
  const label = game.mode === 'daily' ? '每日挑战' : '经典数独';
  const small = r.w < 265;
  text(ctx, small ? (name ? name[1] : '数独') : `${label} · ${name ? name[1] : '简单'}`,
    r.x, r.y + r.h / 2, small ? 11 : 12, COLORS.green, 'left', '500');
  const timer = rect(r.x + r.w - 100, r.y - 4, 102, Math.max(36, r.h + 4));
  const iconX = timer.x + timer.w - 23;
  text(ctx, timeLabel(game.elapsed), iconX - 8, r.y + r.h / 2, small ? 12 : 13,
    COLORS.muted, 'right');
  icon(ctx, game.paused ? 'play' : 'pause', iconX, r.y + r.h / 2 - 7, 14, COLORS.muted);
  if (!game.completed && !generating) addTarget(targets, timer, 'pause');
}

function drawBoard(ctx, layout, game, ui, targets) {
  const r = layout.board;
  const cell = layout.cellSize;
  const board = game.board || [];
  const puzzle = game.puzzle || [];
  const notes = game.notes || [];
  const hintCells = new Set(Array.isArray(ui.hintCells) ? ui.hintCells : []);
  const selected = Number.isInteger(game.selected) ? game.selected : -1;
  const selectedValue = board[selected];
  const showHighlight = !ui.settings || ui.settings.highlight !== false;
  const conflicts = !ui.settings || ui.settings.conflicts !== false ? conflictSet(board) : new Set();
  const blocked = game.paused || game.completed || ui.generating;
  ctx.save();
  box(ctx, r, COLORS.paper, null, 3);
  roundedPath(ctx, r.x, r.y, r.w, r.h, 3);
  ctx.clip();
  for (let i = 0; i < 81; i += 1) {
    const area = rect(r.x + (i % 9) * cell, r.y + Math.floor(i / 9) * cell, cell, cell);
    let fill = COLORS.paper;
    if (showHighlight && selected >= 0 && sameHouse(i, selected)) fill = COLORS.related;
    if (showHighlight && selectedValue && board[i] === selectedValue) fill = COLORS.same;
    if (conflicts.has(i)) fill = COLORS.errorFill;
    if (i === selected) fill = conflicts.has(i) ? '#f2d6d2' : COLORS.selected;
    if (hintCells.has(i) && !conflicts.has(i)) fill = '#fbf0d3';
    ctx.fillStyle = fill;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (board[i]) {
      let color = puzzle[i] ? '#344436' : COLORS.blue;
      if (i === ui.hinted || i === game.hinted || hintCells.has(i)) color = '#967637';
      if (conflicts.has(i)) color = COLORS.error;
      text(ctx, board[i], area.x + cell / 2, area.y + cell / 2 + 0.5,
        clamp(cell * 0.57, 15, 36), color, 'center', puzzle[i] ? '500' : '400');
    } else if (Array.isArray(notes[i])) {
      for (let n = 1; n <= 9; n += 1) {
        if (!notes[i].includes(n)) continue;
        text(ctx, n, area.x + cell * (0.2 + ((n - 1) % 3) * 0.3),
          area.y + cell * (0.2 + Math.floor((n - 1) / 3) * 0.3),
          clamp(cell * 0.225, 6, 13), hintCells.has(i) ? '#967637' : '#7a8e72', 'center');
      }
    }
    if (!blocked) addTarget(targets, area, 'select', i);
  }
  for (let n = 1; n < 9; n += 1) {
    const thick = n % 3 === 0;
    line(ctx, r.x + cell * n, r.y, r.x + cell * n, r.y + r.h,
      thick ? '#78886f' : COLORS.line, thick ? 1.65 : 0.7);
    line(ctx, r.x, r.y + cell * n, r.x + r.w, r.y + cell * n,
      thick ? '#78886f' : COLORS.line, thick ? 1.65 : 0.7);
  }
  if (selected >= 0 && selected < 81 && !blocked) {
    const sx = r.x + selected % 9 * cell;
    const sy = r.y + Math.floor(selected / 9) * cell;
    ctx.strokeStyle = '#8dac84'; ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, cell - 2, cell - 2);
  }
  ctx.restore();
  box(ctx, r, null, COLORS.border, 3, 2);
  if (blocked) drawOverlay(ctx, layout, game, ui, targets);
}

function drawAnswerView(ctx, layout, game, targets) {
  const margin = layout.width <= 340 ? 12 : 16;
  const capsule = layout.capsuleRect;
  const capsuleBottom = capsule && Number.isFinite(capsule.bottom)
    ? capsule.bottom : capsule && Number.isFinite(capsule.top) && Number.isFinite(capsule.height)
      ? capsule.top + capsule.height : 0;
  const top = Math.max(layout.safeTop + 8, capsuleBottom + 8);
  const bottom = layout.height - layout.safeBottom - 8;
  const width = layout.width - margin * 2;
  const available = Math.max(1, bottom - top);
  const landscape = layout.landscape;
  const size = Math.max(1, landscape
    ? Math.min(available, width - 180)
    : Math.min(width, available - 154));
  const board = rect(landscape ? margin : (layout.width - size) / 2,
    landscape ? top : top + 82, size, size);
  const info = landscape
    ? rect(board.x + size + 20, top, Math.max(1, width - size - 20), available)
    : rect(margin, top, width, 72);
  const tx = landscape ? info.x : layout.width / 2;
  const align = landscape ? 'left' : 'center';
  text(ctx, '正确答案', tx, top + 15, layout.compact ? 23 : 26, COLORS.green, align, '500');
  fitText(ctx, '仅供对照，返回后继续原题', tx, top + 43, info.w, 12, COLORS.muted, align);
  const completedBeforeView = game.completed && !game.answerViewed;
  fitText(ctx, completedBeforeView ? '本题已完成，原有成绩保留' : '查看答案后，本局不计成绩',
    tx, top + 62, info.w, 12, COLORS.muted, align);

  const puzzle = game.puzzle || [];
  const solution = game.solution || [];
  const cell = size / 9;
  ctx.save();
  box(ctx, board, COLORS.paper, null, 3);
  roundedPath(ctx, board.x, board.y, board.w, board.h, 3);
  ctx.clip();
  for (let index = 0; index < 81; index += 1) {
    const x = board.x + index % 9 * cell;
    const y = board.y + Math.floor(index / 9) * cell;
    ctx.fillStyle = puzzle[index] ? '#f0f4ed' : COLORS.paper;
    ctx.fillRect(x, y, cell, cell);
    text(ctx, solution[index] || '', x + cell / 2, y + cell / 2 + 0.5,
      clamp(cell * 0.57, 8, 34), puzzle[index] ? '#344436' : COLORS.blue,
      'center', puzzle[index] ? '500' : '400');
  }
  for (let n = 1; n < 9; n += 1) {
    const thick = n % 3 === 0;
    line(ctx, board.x + cell * n, board.y, board.x + cell * n, board.y + size,
      thick ? '#78886f' : COLORS.line, thick ? 1.65 : 0.7);
    line(ctx, board.x, board.y + cell * n, board.x + size, board.y + cell * n,
      thick ? '#78886f' : COLORS.line, thick ? 1.65 : 0.7);
  }
  ctx.restore();
  box(ctx, board, null, COLORS.border, 3, 2);
  const legend = '深色：题面  蓝色：答案';
  text(ctx, legend, landscape ? tx : layout.width / 2,
    landscape ? top + 91 : board.y + size + 12, 10, COLORS.muted, align);
  const close = landscape
    ? rect(info.x, bottom - 44, Math.min(info.w, 200), 44)
    : rect((layout.width - Math.min(200, width)) / 2, board.y + size + 28, Math.min(200, width), 44);
  box(ctx, close, COLORS.green, null, 8);
  text(ctx, '返回题目', close.x + close.w / 2, close.y + close.h / 2, 14, '#ffffff', 'center', '500');
  addTarget(targets, close, 'closeAnswer', undefined, '返回题目');
}

function drawOverlay(ctx, layout, game, ui, targets) {
  const r = layout.board;
  box(ctx, rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2),
    game.completed ? 'rgba(248,249,245,0.94)' : 'rgba(248,249,245,0.985)', null, 2);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const small = r.w < 260;
  const titleSize = small ? 19 : 23;
  if (r.w < 180) {
    text(ctx, ui.generating ? '正在准备' : game.completed ? '已完成' : '休息一下', cx, r.y + 23, 16, COLORS.green, 'center', '500');
    if (game.completed && game.answerViewed) {
      text(ctx, '已查看答案', cx, r.y + 35, 8, COLORS.muted, 'center');
      text(ctx, '本局不计成绩', cx, r.y + 45, 8, COLORS.muted, 'center');
    }
    if (!ui.generating) {
      const button = rect(r.x + 6, r.y + r.h - 50, r.w - 12, 44);
      box(ctx, button, COLORS.green, null, 8);
      text(ctx, game.completed ? '再来一局' : '继续游戏', cx, button.y + 22, 12, '#ffffff', 'center', '500');
      addTarget(targets, button, game.completed ? 'newGame' : 'pause');
    }
    return;
  }
  if (ui.generating) {
    gridIcon(ctx, cx - 16, cy - 46, 32, '#8fa780');
    text(ctx, '正在准备新题', cx, cy + 8, titleSize, COLORS.green, 'center', '500');
    text(ctx, '留一点空白，给新的可能', cx, cy + 36, 11, COLORS.muted, 'center');
    return;
  }
  const completed = !!game.completed;
  const artY = cy - (small ? 66 : 78);
  box(ctx, rect(cx - 22, artY, 44, 44), '#e7eddd', null, 22);
  icon(ctx, completed ? 'check' : 'pause', cx - 11, artY + 11, 22, '#77976a');
  text(ctx, completed ? '这一题，完成了' : '休息一下', cx, cy - 5, titleSize, COLORS.green, 'center', '500');
  text(ctx, completed ? game.answerViewed ? '已查看答案，本局不计成绩' : `用时 ${timeLabel(game.elapsed)}${game.hints ? ` · 提示 ${game.hints} 次` : ''}` : '回来时，思路依然在这里',
    cx, cy + 23, small ? 10 : 12, COLORS.muted, 'center');
  const button = rect(cx - Math.min(80, r.w * 0.31), cy + 47,
    Math.min(160, r.w * 0.62), 38);
  box(ctx, button, COLORS.green, null, 8);
  text(ctx, completed ? '再来一局' : '继续游戏', cx, button.y + button.h / 2, 13, '#ffffff', 'center', '500');
  addTarget(targets, button, completed ? 'newGame' : 'pause');
}

function drawStatus(ctx, layout, game, ui) {
  const r = layout.status;
  const filled = (game.board || []).reduce((sum, value) => sum + (value ? 1 : 0), 0);
  const y = r.y + Math.max(8, r.h / 2 - 1);
  const small = r.w < 260;
  text(ctx, `已填 ${filled} / 81`, r.x, y, small ? 9 : 10, COLORS.muted);
  const saved = `${ui.ratingLabel ? `${ui.ratingLabel} · ` : ''}${ui.storageAvailable === false ? '暂未保存' : '自动保存'}`;
  text(ctx, saved, r.x + r.w, y, small ? 9 : 10,
    ui.storageAvailable === false ? '#ab795a' : COLORS.muted, 'right');
  const progressY = r.y + r.h - 2;
  box(ctx, rect(r.x, progressY, r.w, 2), '#e8ede2', null, 1);
  if (filled) box(ctx, rect(r.x, progressY, r.w * filled / 81, 2), COLORS.accent, null, 1);
}

function drawNumbers(ctx, layout, game, targets, disabled) {
  const r = layout.numbers;
  const gap = r.w < 300 ? 3 : 4;
  const width = (r.w - gap * 8) / 9;
  const counts = Array(10).fill(0);
  (game.board || []).forEach(value => { if (value) counts[value] += 1; });
  const fontSize = clamp(width * 0.72, 20, 31);
  for (let n = 1; n <= 9; n += 1) {
    const area = rect(r.x + (width + gap) * (n - 1), r.y, width, r.h);
    const complete = counts[n] >= 9;
    box(ctx, area, game.noteMode ? '#f0f5eb' : '#f0f3ec', game.noteMode ? '#cfddc4' : '#e7ecdf', 6);
    const color = disabled || complete ? '#b8c2b1' : game.noteMode ? '#6e8b5d' : '#536b49';
    text(ctx, n, area.x + area.w / 2, area.y + area.h * 0.39, fontSize, color, 'center', '500');
    text(ctx, String(Math.max(0, 9 - counts[n])), area.x + area.w / 2,
      area.y + area.h * 0.81, 8, disabled || complete ? '#c3cbbd' : '#9ca88f', 'center');
    if (!disabled) addTarget(targets, area, 'digit', n);
  }
}

function drawTools(ctx, layout, game, targets, disabled, generating = false) {
  const r = layout.tools;
  const choices = [
    ['undo', '撤销'], ['erase', '擦除'], ['notes', '笔记'], ['autoNotes', game.fillNotesActive ? '取消填全' : '填全笔记'], ['hint', '提示'], ['showAnswer', '显示答案']
  ];
  const width = r.w / choices.length;
  const size = layout.compact ? 21 : 24;
  choices.forEach((choice, index) => {
    const slot = rect(r.x + index * width, r.y, width, r.h);
    const area = rect(slot.x + 2, slot.y, Math.max(1, slot.w - 4), slot.h);
    const active = choice[0] === 'notes' && game.noteMode || choice[0] === 'autoNotes' && game.fillNotesActive;
    const unavailable = choice[0] === 'showAnswer' ? generating
      : disabled || (choice[0] === 'undo' && (!game.history || game.history.length === 0));
    const color = unavailable ? '#bbc4b5' : active ? COLORS.green : '#7b8d71';
    if (active) box(ctx, area, '#e4edde', null, 8);
    const iconX = area.x + area.w / 2 - size / 2;
    const iconY = area.y + (layout.compact ? 5 : 8);
    icon(ctx, choice[0], iconX, iconY, size, color);
    if (choice[0] === 'notes') {
      const badge = rect(iconX + size - 2, iconY - 3, 14, 12);
      box(ctx, badge, active ? COLORS.green : '#e8ede3', null, 3);
      text(ctx, active ? '开' : '关', badge.x + 7, badge.y + 6, 8, active ? '#ffffff' : '#92a087', 'center');
    }
    text(ctx, choice[1], area.x + area.w / 2, area.y + area.h - 10,
      r.w < 300 ? 10 : 11, color, 'center');
    // Adjacent full-width hit slots preserve at least 44px on compact landscape screens.
    if (!unavailable) addTarget(targets, slot, choice[0], undefined, choice[1]);
  });
}

function drawFooter(ctx, layout, targets, generating, ui = {}) {
  const r = layout.footer;
  const gap = 8;
  const newWidth = Math.max(92, r.w * 0.42);
  const moreWidth = Math.max(72, r.w * 0.23);
  const newGame = rect(r.x, r.y, newWidth, r.h);
  const share = rect(r.x + newWidth + gap, r.y, r.w - newWidth - moreWidth - gap * 2, r.h);
  const more = rect(r.x + r.w - moreWidth, r.y, moreWidth, r.h);
  box(ctx, newGame, generating ? '#91a58d' : COLORS.green, null, 8);
  const newCenter = newGame.x + newGame.w / 2;
  icon(ctx, 'plus', newCenter - 34, newGame.y + newGame.h / 2 - 7, 14, '#e1eadb');
  text(ctx, ui.practiceLabel ? '换一题练习' : '新的一局', newCenter + 9, newGame.y + newGame.h / 2, 12, '#ffffff', 'center', '500');
  box(ctx, share, '#edf2e6', '#e3e9da', 8);
  if (share.w >= 64) icon(ctx, 'share', share.x + share.w / 2 - 23, share.y + share.h / 2 - 8, 16, '#7e956d');
  text(ctx, '分享', share.x + share.w / 2 + (share.w >= 64 ? 10 : 0), share.y + share.h / 2, 12, '#6a825a', 'center');
  box(ctx, more, '#eaf0e5', '#d9e2d2', 8);
  icon(ctx, 'more', more.x + more.w / 2 - 24, more.y + more.h / 2 - 9, 18, COLORS.green);
  text(ctx, '更多', more.x + more.w / 2 + 12, more.y + more.h / 2, 12, COLORS.green, 'center', '500');
  if (!generating) { addTarget(targets, newGame, 'newGame'); addTarget(targets, share, 'share'); }
  addTarget(targets, more, 'more');
}

function drawToast(ctx, layout, value) {
  const message = typeof value === 'string' ? value : value && value.message;
  if (!message) return;
  const maxWidth = Math.min(layout.width - 32, 390);
  const fontSize = 12;
  ctx.font = `400 ${fontSize}px ${FONT}`;
  const lines = [];
  let current = '';
  for (const letter of String(message)) {
    if (letter === '\n' || (current && ctx.measureText(current + letter).width > maxWidth - 32)) {
      lines.push(current); current = letter === '\n' ? '' : letter;
    } else current += letter;
  }
  if (current) lines.push(current);
  const shown = lines.slice(0, 3);
  const width = Math.min(maxWidth, Math.max(150, ...shown.map(item => ctx.measureText(item).width + 32)));
  const height = 18 + shown.length * 19;
  const bottom = Math.min(layout.footer.y - 6, layout.height - layout.safeBottom - 12);
  const area = rect((layout.width - width) / 2, bottom - height, width, height);
  box(ctx, area, 'rgba(38,60,53,0.94)', null, 9);
  shown.forEach((item, index) => text(ctx, item, layout.width / 2, area.y + 18 + index * 19,
    fontSize, '#ffffff', 'center'));
}

/**
 * Paint without mutating game state. Returns {x,y,w,h,action,payload?} hit targets.
 * ui accepts toast, subtitle, storageAvailable, generating, hinted, hintCells,
 * answerVisible and settings. Answer mode paints solution without changing the game.
 * Action names: select, difficulty, mode, pause, digit, undo, erase, notes,
 * autoNotes, hint, showAnswer, closeAnswer, newGame, share, more. Elapsed time is in milliseconds.
 */
function render(ctx, layout, game, ui = {}) {
  const targets = [];
  const state = game || { board: [], puzzle: [], notes: [], selected: -1 };
  ctx.save();
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  if (ui.answerVisible) {
    drawAnswerView(ctx, layout, state, targets);
    ctx.restore();
    layout.targets = targets;
    return targets;
  }
  drawHeader(ctx, layout, ui, targets);
  if (ui.practiceLabel) {
    segmented(ctx, layout.modes, [['training', '‹ 返回课堂']], 'training', 'mode', targets, ui.generating, 11);
    box(ctx, layout.difficulty, COLORS.light, null, 8);
    fitText(ctx, `整题实战 · ${ui.practiceLabel}  ⓘ`, layout.difficulty.x + 8, layout.difficulty.y + layout.difficulty.h / 2,
      layout.difficulty.w - 16, layout.width <= 340 ? 10 : 11, COLORS.green);
    addTarget(targets, layout.difficulty, 'practiceInfo');
  } else {
    segmented(ctx, layout.modes, [['classic', '经典'], ['daily', '每日'], ['training', '课堂']],
      state.mode || 'classic', 'mode', targets, ui.generating, layout.width <= 340 ? 11 : 12);
    segmented(ctx, layout.difficulty, DIFFICULTIES, state.difficulty || 'easy',
      'difficulty', targets, ui.generating, layout.width <= 340 ? 11 : 12);
  }
  drawMeta(ctx, layout, state, targets, ui.generating);
  drawBoard(ctx, layout, state, ui, targets);
  drawStatus(ctx, layout, state, ui);
  const blocked = state.paused || state.completed || ui.generating;
  drawNumbers(ctx, layout, state, targets, blocked);
  drawTools(ctx, layout, state, targets, blocked, ui.generating);
  drawFooter(ctx, layout, targets, ui.generating, ui);
  if (layout.orientation && layout.orientation.y + 18 < layout.height - layout.safeBottom) {
    text(ctx, '竖屏体验更佳', layout.orientation.x + layout.orientation.w / 2,
      layout.orientation.y + 9, 10, '#9ba690', 'center');
  }
  drawToast(ctx, layout, ui.toast);
  ctx.restore();
  layout.targets = targets;
  return targets;
}

module.exports = { createLayout, render, timeLabel, COLORS };
