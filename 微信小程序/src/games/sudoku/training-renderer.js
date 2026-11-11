'use strict';

const { COLORS } = require('./renderer.js');
const { LESSONS, getLesson } = require('./lessons.js');
const { FOUNDATION_LESSONS, getFoundationPage } = require('./foundation-lessons.js');
const { getTeachingVisual, getStepRegions, getStepRoles } = require('./teaching-visuals.js');
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const TIERS = ['基础', '进阶', '困难', '专家'];
const rect = (x, y, w, h) => ({ x, y, w, h });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function createTrainingLayout(width, height, safeTop = 0, safeBottom = 0, capsuleRect = null) {
  if (width && typeof width === 'object') {
    const value = width;
    return createTrainingLayout(value.width, value.height, value.safeTop, value.safeBottom, value.capsuleRect);
  }
  const w = Math.max(240, Number(width) || 375), h = Math.max(240, Number(height) || 667);
  const top = Math.max(clamp(Number(safeTop) || 0, 0, h / 3), Math.min(h / 3, capsuleRect && Number(capsuleRect.bottom) || 0)) + 6;
  const bottom = h - clamp(Number(safeBottom) || 0, 0, h / 3) - 8;
  const landscape = w > h * 1.15, margin = w < 350 ? 12 : 16;
  const contentWidth = Math.min(w - margin * 2, landscape ? 940 : 560), x = (w - contentWidth) / 2;
  const compact = bottom - top < 560;
  const header = rect(x, top, contentWidth, 36);
  const content = rect(x, top + 42, contentWidth, bottom - top - 42 - 40);
  const footer = rect(x, bottom - 34, contentWidth, 34);
  const layout = { width: w, height: h, safeTop, safeBottom, top, bottom, compact, landscape, header, content, footer, targets: [], catalogPerPage: 4 };
  const intro = rect(x, header.y + header.h + 2, contentWidth, 24);
  layout.filter = rect(x, intro.y + intro.h, contentWidth, 24);
  if (landscape) {
    const size = Math.min(contentWidth * 0.45, bottom - intro.y - intro.h - 28);
    const sx = x + size + 16, sw = contentWidth - size - 16;
    layout.board = rect(x, intro.y + intro.h + 28, size, size);
    layout.filter = rect(x, intro.y + intro.h, size, 22);
    layout.inputMode = rect(sx, intro.y + 4, sw, 30);
    layout.digits = rect(sx, layout.inputMode.y + 38, sw, 34);
    layout.feedback = rect(sx, layout.digits.y + 42, sw, Math.max(42, footer.y - layout.digits.y - 50));
    layout.exerciseFooter = rect(sx, footer.y, sw, footer.h);
  } else {
    const feedbackH = compact ? 44 : 70;
    layout.exerciseFooter = footer;
    layout.feedback = rect(x, footer.y - feedbackH - 6, contentWidth, feedbackH);
    layout.digits = rect(x, layout.feedback.y - 36 - 6, contentWidth, 36);
    layout.inputMode = rect(x, layout.digits.y - 28 - 6, contentWidth, 28);
    const available = layout.inputMode.y - layout.filter.y - layout.filter.h - 8;
    const size = Math.min(contentWidth, Math.max(90, available));
    layout.board = rect(x + (contentWidth - size) / 2, layout.filter.y + layout.filter.h + 4 + Math.max(0, available - size) / 2, size, size);
  }
  layout.intro = intro;
  layout.cellSize = layout.board.w / 9;
  return layout;
}

function rounded(ctx, r, fill, stroke, radius = 8) {
  const z = Math.min(radius, r.w / 2, r.h / 2);
  ctx.beginPath(); ctx.moveTo(r.x + z, r.y); ctx.lineTo(r.x + r.w - z, r.y);
  ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + z);
  ctx.lineTo(r.x + r.w, r.y + r.h - z); ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - z, r.y + r.h);
  ctx.lineTo(r.x + z, r.y + r.h); ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - z);
  ctx.lineTo(r.x, r.y + z); ctx.quadraticCurveTo(r.x, r.y, r.x + z, r.y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function text(ctx, label, x, y, size = 13, color = COLORS.ink, align = 'left', weight = '400') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(String(label), x, y);
}
function measure(ctx, label, size) {
  ctx.font = `400 ${size}px ${FONT}`;
  const measured = ctx.measureText && ctx.measureText(String(label));
  return measured && Number.isFinite(measured.width) ? measured.width : Array.from(String(label)).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? size : size * 0.58), 0);
}
function ellipsis(ctx, label, maxWidth, size) {
  let value = String(label || '');
  if (measure(ctx, value, size) <= maxWidth) return value;
  while (value.length && measure(ctx, value + '…', size) > maxWidth) value = value.slice(0, -1);
  return value + '…';
}
function wrap(ctx, label, width, size) {
  const lines = []; let value = '';
  for (const char of String(label || '')) {
    if (char === '\n' || (value && measure(ctx, value + char, size) > width)) { lines.push(value); value = char === '\n' ? '' : char; }
    else value += char;
  }
  if (value) lines.push(value);
  return lines;
}
function paragraph(ctx, label, area, size = 13, color = COLORS.ink, lineH = 21) {
  if (area.h < size || area.w <= 0) return 0;
  const lines = wrap(ctx, label, area.w, size), count = Math.max(1, Math.floor(area.h / lineH));
  lines.slice(0, count).forEach((value, i) => text(ctx, i === count - 1 && lines.length > count ? ellipsis(ctx, value + '…', area.w, size) : value, area.x, area.y + lineH * i + lineH / 2, size, color));
  return Math.min(lines.length, count) * lineH;
}
function target(targets, area, action, payload, label) {
  targets.push({ ...area, action, ...(payload === undefined ? {} : { payload }), label: label || action });
}
function button(ctx, targets, area, label, action, payload, options = {}) {
  const active = options.active, disabled = options.disabled;
  rounded(ctx, area, disabled ? '#eef0eb' : active ? COLORS.green : COLORS.paper, active ? null : COLORS.line, 7);
  const size = options.size || 12;
  text(ctx, ellipsis(ctx, label, area.w - 8, size), area.x + area.w / 2, area.y + area.h / 2, size, disabled ? '#a1a89e' : active ? COLORS.paper : COLORS.green, 'center', active ? '500' : '400');
  if (!disabled) target(targets, area, action, payload, options.accessibleLabel || label);
}
function header(ctx, layout, view, targets) {
  const h = layout.header;
  button(ctx, targets, rect(h.x, h.y + 2, 54, 30), view.screen === 'catalog' ? '‹ 数独' : '‹ 课程', 'trainingBack', undefined);
  const lesson = view.lesson || getLesson(view.lessonId);
  const title = view.screen === 'catalog' ? '技巧课堂' : view.screen === 'foundation' ? '基础入门' : view.screen === 'lesson' ? lesson && lesson.label || '技巧讲解' : '专项练习';
  text(ctx, ellipsis(ctx, title, h.w - 76, layout.compact ? 18 : 21), h.x + 66, h.y + 17, layout.compact ? 18 : 21, COLORS.ink, 'left', '500');
  if (view.screen === 'foundation') button(ctx, targets, rect(h.x + h.w - 48, h.y + 2, 48, 30), '跳过', 'foundationComplete');
  else if (h.w > 400) text(ctx, '一步一步，理解每次落笔', h.x + h.w, h.y + 18, 11, COLORS.muted, 'right');
}
function drawCatalog(ctx, layout, view, targets) {
  const lessons = view.lessons || LESSONS, pageCount = Math.max(1, Math.ceil(lessons.length / 4));
  const page = clamp(Number(view.page) || 0, 0, pageCount - 1), area = layout.content;
  text(ctx, '理解 → 识别 → 混合使用 → 整题实战', area.x, area.y + 10, 11, COLORS.green);
  const launchRows = layout.landscape ? 2 : 3, launchCols = layout.landscape ? 3 : 2;
  const launchH = layout.compact ? 26 : 32, launchGap = 5, launchW = (area.w - launchGap * (launchCols - 1)) / launchCols;
  const entries = [['规则与候选', 'foundationBasics'], ['混合练习', 'trainingMixed'], ['错题复习', 'trainingReview'], ['条件辨认', 'trainingRecognize'], ['整题实战', 'trainingFullPuzzle']];
  entries.forEach(([label, action], i) => button(ctx, targets, rect(area.x + i % launchCols * (launchW + launchGap), area.y + 24 + Math.floor(i / launchCols) * (launchH + launchGap), launchW, launchH), label, action, undefined, { active: i === 0, size: 11 }));
  const unused = rect(area.x + (launchCols - 1) * (launchW + launchGap), area.y + 24 + (launchRows - 1) * (launchH + launchGap), launchW, launchH);
  text(ctx, ellipsis(ctx, view.notice || '每一步都有理由', unused.w - 4, 10), unused.x + unused.w / 2, unused.y + unused.h / 2, 10, COLORS.muted, 'center');
  const launchBottom = area.y + 24 + launchRows * (launchH + launchGap);
  const grid = rect(area.x, launchBottom + 3, area.w, area.y + area.h - launchBottom - 3);
  const cols = layout.landscape ? 2 : 1, rows = layout.landscape ? 2 : 4, gap = layout.compact ? 6 : 10;
  const cw = (grid.w - gap * (cols - 1)) / cols, ch = (grid.h - gap * (rows - 1)) / rows;
  lessons.slice(page * 4, page * 4 + 4).forEach((lesson, i) => {
    const card = rect(grid.x + (i % cols) * (cw + gap), grid.y + Math.floor(i / cols) * (ch + gap), cw, ch);
    rounded(ctx, card, COLORS.paper, COLORS.line, 10);
    const progress = view.progress && view.progress[lesson.id], learning = lesson.learningProgress || view.learningProgress && view.learningProgress[lesson.id] || {};
    const completed = learning.uniqueIndependent > 0;
    const badge = `首次独立 ${learning.uniqueIndependent || 0} 个`;
    const fontSize = ch < 70 ? 13 : 16, badgeW = measure(ctx, badge, 10);
    text(ctx, ellipsis(ctx, `${String(page * 4 + i + 1).padStart(2, '0')}  ${lesson.label}`, card.w - badgeW - 38, fontSize), card.x + 12, card.y + Math.min(23, ch * 0.32), fontSize, COLORS.ink, 'left', '500');
    text(ctx, badge, card.x + card.w - 12, card.y + Math.min(23, ch * 0.3), 10, completed ? COLORS.green : COLORS.muted, 'right');
    paragraph(ctx, lesson.summary, rect(card.x + 12, card.y + Math.min(38, ch * 0.56), card.w - 24, Math.max(12, ch - 43)), ch < 70 ? 10 : 12, COLORS.muted, ch < 70 ? 14 : 18);
    if (ch >= 80) {
      text(ctx, ellipsis(ctx, `完成 ${learning.uniqueSolved || 0} 个 · 待复习 ${learning.reviewDue || 0} 个`, card.w - 110, 10), card.x + 12, card.y + ch - 16, 10, COLORS.muted);
      text(ctx, '进入课程 ›', card.x + card.w - 12, card.y + ch - 16, 11, COLORS.green, 'right');
    }
    target(targets, card, 'lesson', lesson.id, `学习${lesson.label}`);
  });
  pager(ctx, targets, layout.footer, 'coursePage', page, pageCount);
}
function pager(ctx, targets, area, action, page, count, middle) {
  const diagram = action === 'lessonDiagram';
  button(ctx, targets, rect(area.x, area.y, 78, area.h), diagram ? '上一步' : '上一页', action, -1, { disabled: page <= 0, accessibleLabel: diagram ? '图解上一步' : '上一页' });
  text(ctx, middle || `${action === 'lessonPage' ? '课程 ' : ''}${page + 1} / ${count}`, area.x + area.w / 2, area.y + area.h / 2, 12, COLORS.muted, 'center');
  const next = diagram ? page === 0 ? '看推理' : page === 1 ? '看结果' : '已看完' : '下一页';
  button(ctx, targets, rect(area.x + area.w - 78, area.y, 78, area.h), next, action, 1, { disabled: page >= count - 1, accessibleLabel: diagram ? '图解下一步' : '下一页' });
}
function drawLesson(ctx, layout, view, targets) {
  const lesson = view.lesson || getLesson(view.lessonId) || LESSONS[0], page = clamp(Number(view.lessonPage === undefined ? view.page : view.lessonPage) || 0, 0, 2);
  const a = layout.content;
  const card = rect(a.x, a.y, a.w, a.h - 42);
  rounded(ctx, card, COLORS.paper, COLORS.line, 10);
  const inner = rect(card.x + 14, card.y + 36, card.w - 28, card.h - 50);
  const size = layout.compact ? 12 : 14, lineH = layout.compact ? 19 : 23;
  let y = inner.y;
  const headingX = layout.landscape && page === 0 ? card.x + card.h + 6 : card.x + 14;
  text(ctx, ['01 · 看懂这一步', '02 · 怎样识别', '03 · 开始练习'][page], headingX, card.y + 17, 11, COLORS.muted);
  const fullText = rect(card.x + card.w - 92, card.y + 3, 82, 26);
  text(ctx, '完整讲解 ›', fullText.x + fullText.w / 2, fullText.y + fullText.h / 2, 10, COLORS.green, 'center');
  target(targets, fullText, 'lessonExplanation', undefined, `查看${lesson.label}完整讲解`);
  if (page === 0) {
    const visual = getTeachingVisual(lesson.id, view.diagramPage);
    if (visual) {
      const sz = Math.min(layout.landscape ? card.h - 18 : inner.h - 83, layout.landscape ? inner.w * 0.4 : inner.w);
      const area = rect(layout.landscape ? card.x + 10 : inner.x + (inner.w - sz) / 2, layout.landscape ? card.y + 9 : inner.y + 14, sz, sz);
      const legend = Number.isInteger(visual.roles.pivot) ? '紫：枢纽　绿：两翼　橙：可排除' : visual.roles.baseUnits.length ? '浅绿：基准方向　浅蓝：交叉方向' : lesson.action === 'place' ? '绿：依据　蓝：确定的数字' : '绿：依据　橙：可排除　红划线：已排除';
      const sideX = area.x + sz + 14, sideW = card.x + card.w - 14 - sideX;
      text(ctx, ellipsis(ctx, legend, layout.landscape ? sideW : inner.w, 9), layout.landscape ? sideX : inner.x, layout.landscape ? card.y + 39 : inner.y + 4, 9, COLORS.muted);
      drawDiagram(ctx, area, visual);
      const controls = layout.landscape ? rect(sideX, card.y + card.h - 32, sideW, 28) : rect(inner.x, inner.y + inner.h - 28, inner.w, 28);
      const caption = layout.landscape ? rect(sideX, card.y + 50, sideW, card.h - 86)
        : rect(inner.x, area.y + sz + 4, inner.w, Math.max(0, controls.y - area.y - sz - 12));
      paragraph(ctx, visual.caption, caption, layout.compact ? 10 : 12, COLORS.muted, layout.compact ? 15 : 18);
      pager(ctx, targets, controls, 'lessonDiagram', visual.page, 3, `${visual.title} ${visual.page + 1}/3`);
    } else paragraph(ctx, lesson.principle, inner, size, COLORS.ink, lineH);
  } else if (page === 1) {
    lesson.steps.forEach((value, i) => { y += paragraph(ctx, `${i + 1}. ${value}`, rect(inner.x, y, inner.w, Math.max(0, inner.y + inner.h - y)), size, COLORS.ink, lineH) + 8; });
    if (inner.y + inner.h - y > lineH) {
      text(ctx, '容易误用的地方', inner.x, y + 9, 11, COLORS.green, 'left', '500'); y += 25;
      paragraph(ctx, lesson.mistakes, rect(inner.x, y, inner.w, Math.max(0, inner.y + inner.h - y)), size - 1, COLORS.muted, lineH);
    }
  } else {
    const operation = lesson.action === 'place' ? '选择依据格，再点下方数字填写答案。提交时会检查这一步的推理依据。' : '先用“选依据”标出支撑格；再切到“删候选”，点目标格和下方候选数字。最后提交检查。';
    const blocks = [
      ['跟练', '可以逐层查看提示：先观察区域，再看支撑结构，最后阅读完整推理。演示只用于学习，不计入独立通过。'],
      ['独立练习', operation],
      ['学会后再混合使用', '候选数已经填好。本题只练一个有效逻辑步骤，完成后可以继续下一题。']
    ];
    blocks.forEach(([title, copy]) => {
      if (inner.y + inner.h - y < lineH * 2 + 38) return;
      text(ctx, title, inner.x, y + 9, size, COLORS.green, 'left', '500'); y += 24;
      y += paragraph(ctx, copy, rect(inner.x, y, inner.w, Math.max(0, inner.y + inner.h - y - 38)), size - 1, COLORS.muted, lineH) + 12;
    });
    button(ctx, targets, rect(inner.x, inner.y + inner.h - 32, inner.w, 30), '用这一招解整题 ›', 'trainingFullPuzzle', lesson.id, { size: 12 });
  }
  pager(ctx, targets, rect(a.x, a.y + a.h - 34, a.w, 30), 'lessonPage', page, 3);
  const source = (view.lessons || []).find(value => value.id === lesson.id);
  const available = view.available !== false && (!source || source.available !== false);
  const gap = 8, bw = (layout.footer.w - gap) / 2;
  button(ctx, targets, rect(layout.footer.x, layout.footer.y, bw, layout.footer.h), available ? '跟练 · 分层提示' : '练习题准备中', 'practice', { id: lesson.id, mode: 'guided' }, { disabled: !available });
  button(ctx, targets, rect(layout.footer.x + bw + gap, layout.footer.y, bw, layout.footer.h), '独立练习', 'practice', { id: lesson.id, mode: 'independent' }, { active: true, disabled: !available });
}

function drawDiagram(ctx, area, visual) {
  const step = { ...(visual.step || {}), cells: visual.cells || [], units: visual.units || [], eliminations: visual.eliminations || [], placements: visual.placements || [], digits: visual.digits || [] };
  drawBoard(ctx, { board: area, cellSize: area.w / 9 }, { board: visual.board, candidates: visual.candidates,
    completed: true, hintLevel: 3, step, roles: visual.roles, sourceCells: visual.sourceCells, forbiddenCells: visual.forbiddenCells,
    boxes: visual.boxes, emphasizeDigits: visual.digits, originalCandidates: visual.originalCandidates,
    diagramEliminations: visual.page === 2 ? visual.eliminations : [], selectedEliminations: visual.page === 1 ? [] : visual.eliminations || [], selectedCells: [],
    placementIndex: visual.placements && visual.placements[0] && visual.placements[0].index,
    value: visual.placements && visual.placements[0] && visual.placements[0].value }, []);
}

function drawFoundation(ctx, layout, view, targets) {
  const page = clamp(Number(view.foundationPage) || 0, 0, FOUNDATION_LESSONS.length - 1), lesson = getFoundationPage(page), area = layout.content;
  text(ctx, lesson.title, area.x, area.y + 12, layout.compact ? 16 : 19, COLORS.green, 'left', '500');
  const full = rect(area.x + area.w - 80, area.y + 27, 80, 24);
  text(ctx, '阅读讲解 ›', full.x + full.w / 2, full.y + 12, 10, COLORS.green, 'center');
  target(targets, full, 'foundationExplanation', undefined, `阅读${lesson.title}完整讲解`);
  const size = Math.min(layout.landscape ? area.h - 32 : area.h - 114, layout.landscape ? area.w * 0.4 : area.w);
  const board = rect(layout.landscape ? area.x : area.x + (area.w - size) / 2, area.y + (layout.landscape ? 32 : 55), size, size);
  drawDiagram(ctx, board, lesson.diagram);
  const prose = layout.landscape ? rect(board.x + size + 16, area.y + 58, area.w - size - 16, area.h - 58) : rect(area.x, board.y + size + 7, area.w, area.y + area.h - board.y - size - 7);
  paragraph(ctx, lesson.summary + '\n' + lesson.diagram.caption, prose, layout.compact ? 11 : 13, COLORS.muted, layout.compact ? 17 : 21);
  const footer = layout.footer;
  button(ctx, targets, rect(footer.x, footer.y, 78, footer.h), '上一课', 'foundationPage', -1, { disabled: page === 0 });
  text(ctx, `${page + 1} / ${FOUNDATION_LESSONS.length}`, footer.x + footer.w / 2, footer.y + footer.h / 2, 12, COLORS.muted, 'center');
  button(ctx, targets, rect(footer.x + footer.w - 100, footer.y, 100, footer.h), page === FOUNDATION_LESSONS.length - 1 ? '完成入门' : '下一课', page === FOUNDATION_LESSONS.length - 1 ? 'foundationComplete' : 'foundationPage', 1, { active: true });
}

function cellIndex(value) { return Number.isInteger(value.index) ? value.index : value.cell; }
function markedElimination(list, index, digit) { return (list || []).some(value => cellIndex(value) === index && (value.digit || value.value) === digit); }
function noteMask(training, index) {
  const candidates = training.candidates || training.notes || [];
  const value = candidates[index];
  return Array.isArray(value) ? value.reduce((mask, digit) => mask | (1 << (digit - 1)), 0) : Number(value) || 0;
}
function sameUnit(index, unit) {
  if (!unit) return false;
  if (unit.type === 'row') return Math.floor(index / 9) === unit.index;
  if (unit.type === 'column' || unit.type === 'col') return index % 9 === unit.index;
  return unit.type === 'box' && Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3) === unit.index;
}
function drawBoard(ctx, layout, training, targets) {
  const b = layout.board, size = layout.cellSize, step = training.continuation && training.continuation.lastStep || training.answerStep || training.step || {}, level = Number(training.hintLevel) || 0;
  const selectedCells = training.selectedCells || [], selected = Number.isInteger(training.selected) ? training.selected : -1;
  const regions = getStepRegions(step), roles = { pivot: null, wings: [], baseUnits: [], crossUnits: [], ...(training.roles || getStepRoles(step, training.candidates || [])) };
  const filter = Number(training.filterDigit) || 0;
  for (let index = 0; index < 81; index++) {
    const x = b.x + index % 9 * size, y = b.y + Math.floor(index / 9) * size;
    const chosen = selectedCells.includes(index), evidence = level >= 2 && (step.cells || []).includes(index);
    const region = level >= 1 && regions.some(unit => sameUnit(index, unit));
    const pivot = level >= 2 && roles.pivot === index, wing = level >= 2 && roles.wings.includes(index);
    const base = level >= 1 && roles.baseUnits.some(unit => sameUnit(index, unit)), cross = level >= 1 && roles.crossUnits.some(unit => sameUnit(index, unit));
    const forbidden = training.forbiddenCells && training.forbiddenCells.includes(index), source = training.sourceCells && training.sourceCells.includes(index);
    const foundationBox = training.boxes && training.boxes.some(box => sameUnit(index, { type: 'box', index: box }));
    ctx.fillStyle = chosen ? COLORS.selected : pivot ? '#e7dcef' : wing ? '#deedd5' : evidence ? '#e0ebce' : selected === index ? '#e5edf4' : forbidden ? '#f5e2df' : source ? '#e0eaf5' : base && cross ? '#dce7e1' : base ? '#edf3e5' : cross ? '#e8f0f7' : foundationBox ? '#f1ebdf' : region ? '#f0f4e8' : COLORS.paper;
    ctx.fillRect(x, y, size, size);
    const value = training.board && training.board[index];
    const pending = !value && training.placementIndex === index && Number.isInteger(training.value) && training.value >= 1 && training.value <= 9;
    const isPlacement = (step.placements || []).some(action => action.index === index && action.value === value) && level >= 3;
    if (value || pending) text(ctx, value || training.value, x + size / 2, y + size / 2, size * 0.59, pending || isPlacement || source ? COLORS.blue : filter && value !== filter ? '#b9c0b7' : COLORS.ink, 'center', '500');
    else {
      const ghosts = (training.diagramEliminations || []).filter(action => action.index === index).reduce((mask, action) => mask | 1 << (action.digit - 1), 0);
      const mask = noteMask(training, index) | ghosts;
      for (let digit = 1; digit <= 9; digit++) if (mask & (1 << (digit - 1))) {
        const dx = x + ((digit - 1) % 3 + 0.5) * size / 3, dy = y + (Math.floor((digit - 1) / 3) + 0.5) * size / 3;
        const removed = markedElimination(training.selectedEliminations, index, digit);
        const hinted = level >= 3 && markedElimination(step.eliminations, index, digit);
        const deemphasized = filter && digit !== filter || training.emphasizeDigits && training.emphasizeDigits.length && !training.emphasizeDigits.includes(digit);
        text(ctx, digit, dx, dy, Math.max(5, size * 0.22), removed ? COLORS.error : hinted ? '#b87c21' : deemphasized ? filter ? '#bcc6b8' : '#a1ac9c' : '#596a5d', 'center');
        if (removed) { ctx.beginPath(); ctx.moveTo(dx - size * 0.1, dy); ctx.lineTo(dx + size * 0.1, dy); ctx.lineWidth = 1; ctx.strokeStyle = COLORS.error; ctx.stroke(); }
      }
    }
    if (forbidden) { ctx.beginPath(); ctx.moveTo(x + size * 0.35, y + size * 0.35); ctx.lineTo(x + size * 0.65, y + size * 0.65); ctx.moveTo(x + size * 0.65, y + size * 0.35); ctx.lineTo(x + size * 0.35, y + size * 0.65); ctx.strokeStyle = '#ba8a82'; ctx.lineWidth = 1; ctx.stroke(); }
    if (chosen || evidence) { ctx.strokeStyle = chosen ? COLORS.green : '#9bb46e'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, size - 4, size - 4); }
    if (!training.completed) target(targets, rect(x, y, size, size), 'trainingCell', index, `第 ${Math.floor(index / 9) + 1} 行第 ${index % 9 + 1} 列${value ? '，已填 ' + value : ''}`);
  }
  if (level >= 2 && Number.isInteger(roles.pivot)) {
    const px = b.x + (roles.pivot % 9 + 0.5) * size, py = b.y + (Math.floor(roles.pivot / 9) + 0.5) * size;
    for (const wing of roles.wings) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(b.x + (wing % 9 + 0.5) * size, b.y + (Math.floor(wing / 9) + 0.5) * size); ctx.strokeStyle = 'rgba(115,94,137,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath(); ctx.moveTo(b.x + i * size, b.y); ctx.lineTo(b.x + i * size, b.y + b.h);
    ctx.moveTo(b.x, b.y + i * size); ctx.lineTo(b.x + b.w, b.y + i * size);
    ctx.strokeStyle = i % 3 === 0 ? COLORS.border : COLORS.line; ctx.lineWidth = i % 3 === 0 ? 1.6 : 0.6; ctx.stroke();
  }
}
function drawFilter(ctx, layout, training, targets) {
  const area = layout.filter, gap = 2, firstW = Math.min(38, area.w * 0.15), digitW = (area.w - firstW - gap * 9) / 9;
  button(ctx, targets, rect(area.x, area.y, firstW, area.h), '全部', 'trainingFilter', 0, { active: !training.filterDigit, size: 9 });
  for (let digit = 1; digit <= 9; digit++) button(ctx, targets, rect(area.x + firstW + gap + (digit - 1) * (digitW + gap), area.y, digitW, area.h), String(digit), 'trainingFilter', digit, { active: training.filterDigit === digit, size: 10, accessibleLabel: `只看数字 ${digit}` });
}
function drawExercise(ctx, layout, view, targets) {
  const training = view.training || {}, lesson = view.lesson || getLesson(view.lessonId || training.technique) || LESSONS[0];
  const inputMode = training.inputMode || 'support', mixed = training.sessionMode === 'mixed' || training.sessionMode === 'review', recognize = training.sessionMode === 'recognize';
  const fill = inputMode === 'place' || !mixed && lesson.action === 'place';
  const name = recognize ? '条件辨认 · 这组依据成立吗？' : training.hideTechnique && !training.completed ? `${training.sessionMode === 'review' ? '错题复习' : '混合练习'} · 找出有效一步` : `${lesson.label} · ${training.mode === 'independent' ? '独立练习' : '跟练'}`;
  text(ctx, ellipsis(ctx, name, layout.intro.w - 2, 12), layout.intro.x, layout.intro.y + 11, 12, COLORS.green);
  drawFilter(ctx, layout, training, targets);
  const claim = training.claimStep || training.step || {};
  // A proposal is not a proved structure. Neutral evidence marks and proposed
  // actions are visible from the start, with no inferred pivot/fish roles and
  // without changing the stored hint level, board, or player selections.
  const shown = recognize && !training.continuation ? { ...training, step: claim, answerStep: claim,
    roles: { pivot: null, wings: [], baseUnits: [], crossUnits: [] }, hintLevel: 3, completed: true,
    selectedCells: [], selectedEliminations: [], placementIndex: claim.placements && claim.placements[0] && claim.placements[0].index,
    value: claim.placements && claim.placements[0] && claim.placements[0].value } : training;
  drawBoard(ctx, layout, shown, targets);
  if (recognize) { drawRecognition(ctx, layout, training, targets); return; }
  const modes = mixed ? [['support', '① 选依据'], ['place', '填数字'], ['eliminate', '删候选']] : [['support', '① 选依据'], [fill ? 'place' : 'eliminate', fill ? '② 填数字' : '② 删候选']];
  const mw = (layout.inputMode.w - 6 * (modes.length - 1)) / modes.length;
  modes.forEach(([id, label], index) => button(ctx, targets, rect(layout.inputMode.x + index * (mw + 6), layout.inputMode.y, mw, layout.inputMode.h), label, 'trainingMode', id, { active: id === inputMode, disabled: training.completed }));
  const gap = 3, dw = (layout.digits.w - gap * 8) / 9, selected = Number.isInteger(training.selected) ? training.selected : -1;
  for (let digit = 1; digit <= 9; digit++) {
    const area = rect(layout.digits.x + (digit - 1) * (dw + gap), layout.digits.y, dw, layout.digits.h);
    const mask = selected >= 0 ? noteMask(training, selected) : 0;
    const isElim = !fill && inputMode === 'eliminate', active = isElim ? markedElimination(training.selectedEliminations, selected, digit) : fill && (training.value || training.selectedDigit) === digit;
    const disabled = training.completed || inputMode === 'support' || selected < 0 || training.board && training.board[selected] > 0 || isElim && !(mask & (1 << (digit - 1)));
    button(ctx, targets, area, String(digit), isElim ? 'trainingCandidate' : 'trainingDigit', isElim ? { index: selected, digit } : digit, { active, disabled, size: 16, accessibleLabel: isElim ? `删除第 ${Math.floor(selected / 9) + 1} 行第 ${selected % 9 + 1} 列候选 ${digit}` : `填写 ${digit}` });
  }
  const level = Number(training.hintLevel) || 0, step = training.continuation && training.continuation.lastStep || training.answerStep || training.step || {};
  const feedback = training.feedback && (typeof training.feedback === 'string' ? training.feedback : training.feedback.message);
  const instruction = inputMode === 'support' ? '选出支撑推理的格子，再切到第 ② 步。' : fill ? '点目标格，再用下方数字选择答案。' : '点目标格，再点下方数字标记要删除的候选。';
  const structureText = step.technique === 'xy-wing' ? '紫色是枢纽，绿色是两翼。目标必须同时看见两翼。' : step.technique === 'xyz-wing' ? '紫色是枢纽，绿色是两翼。目标必须同时看见这三格。' : ['x-wing', 'swordfish'].includes(step.technique) ? '浅绿是基准方向，浅蓝是交叉方向。观察同一数字被限制的位置。' : '浅绿框显示支撑结构。请检查它们共同限制了哪些数字。';
  const hintText = level >= 3 ? step.explanation : level === 2 ? structureText : level === 1 ? '有颜色的区域是观察范围，请先寻找相关候选的位置。' : instruction;
  rounded(ctx, layout.feedback, training.completed ? '#eaf2e1' : '#eef2eb', null, 7);
  const fullReason = (level >= 3 || training.completed) && Boolean(step.explanation);
  paragraph(ctx, feedback || (training.completed ? '这一步已完成。继续下一题，再试一次独立推理。' : hintText), rect(layout.feedback.x + 9, layout.feedback.y + 4, layout.feedback.w - 18, layout.feedback.h - 8 - (fullReason ? 14 : 0)), layout.compact ? 11 : 12, training.completed ? COLORS.green : COLORS.muted, layout.compact ? 17 : 19);
  if (fullReason) {
    text(ctx, '查看推理全文 ›', layout.feedback.x + layout.feedback.w - 9, layout.feedback.y + layout.feedback.h - 9, 10, COLORS.green, 'right');
    target(targets, layout.feedback, 'trainingExplanation', undefined, '查看完整推理');
  }
  const footer = layout.exerciseFooter, fw = (footer.w - 12) / 3;
  if (training.completed) {
    button(ctx, targets, rect(footer.x, footer.y, fw, footer.h), training.continuation && training.continuation.done ? '推演已完成' : '继续推演', 'trainingContinue', undefined, { disabled: training.continuation && training.continuation.done, size: 11 });
    button(ctx, targets, rect(footer.x + fw + 6, footer.y, fw, footer.h), '整题实战', 'trainingFullPuzzle', undefined, { size: 11 });
    button(ctx, targets, rect(footer.x + (fw + 6) * 2, footer.y, fw, footer.h), '下一题', 'trainingNext', undefined, { active: true });
    return;
  }
  const demo = level >= 3 && training.mode !== 'independent' && !training.completed;
  button(ctx, targets, rect(footer.x, footer.y, fw, footer.h), demo ? '演示本步' : `提示 ${Math.min(3, level)}/3`, demo ? 'trainingDemo' : 'trainingHint', undefined, { disabled: training.completed || level >= 3 && !demo });
  button(ctx, targets, rect(footer.x + fw + 6, footer.y, fw, footer.h), '检查答案', 'trainingCheck', undefined, { active: true, disabled: training.completed });
  button(ctx, targets, rect(footer.x + (fw + 6) * 2, footer.y, fw, footer.h), '下一题', 'trainingNext', undefined, { disabled: !training.completed });
}

function drawRecognition(ctx, layout, training, targets) {
  const proposal = rect(layout.inputMode.x, layout.inputMode.y, layout.inputMode.w, layout.digits.y + layout.digits.h - layout.inputMode.y);
  rounded(ctx, proposal, COLORS.paper, COLORS.line, 8);
  paragraph(ctx, training.claim || '观察高亮的依据与候选。这一组结构能支持所提出的操作吗？', rect(proposal.x + 9, proposal.y + 5, proposal.w - 18, proposal.h - 22), 11, COLORS.ink, 17);
  text(ctx, '蓝：提议填写　橙：提议删除；尚未执行。', proposal.x + 9, proposal.y + proposal.h - 10, 9, COLORS.muted);
  const showReason = training.completed || training.hintLevel >= 3;
  const reason = training.feedback || (showReason ? training.recognitionExplanation : training.hintLevel > 0 ? '检查高亮格是否满足完整条件，留意遗漏的位置或多出的候选。' : '请在下方判断：成立，还是不成立？');
  rounded(ctx, layout.feedback, training.completed ? '#eaf2e1' : '#eef2eb', null, 7);
  paragraph(ctx, reason, rect(layout.feedback.x + 9, layout.feedback.y + 4, layout.feedback.w - 18, layout.feedback.h - 8 - (showReason ? 14 : 0)), layout.compact ? 11 : 12, COLORS.muted, layout.compact ? 17 : 19);
  if (showReason) {
    text(ctx, '查看判断理由 ›', layout.feedback.x + layout.feedback.w - 9, layout.feedback.y + layout.feedback.h - 9, 10, COLORS.green, 'right');
    target(targets, layout.feedback, 'trainingExplanation', undefined, '查看判断理由全文');
  }
  const footer = layout.exerciseFooter, w = (footer.w - 12) / 3;
  if (training.completed) {
    button(ctx, targets, rect(footer.x, footer.y, w, footer.h), training.continuation && training.continuation.done ? '推演已完成' : '继续推演', 'trainingContinue', undefined, { disabled: training.continuation && training.continuation.done, size: 11 });
    button(ctx, targets, rect(footer.x + w + 6, footer.y, w, footer.h), '整题实战', 'trainingFullPuzzle', undefined, { size: 11 });
    button(ctx, targets, rect(footer.x + (w + 6) * 2, footer.y, w, footer.h), '下一题', 'trainingNext', undefined, { active: true });
  } else {
    button(ctx, targets, rect(footer.x, footer.y, w, footer.h), `提示 ${Math.min(3, training.hintLevel || 0)}/3`, 'trainingHint', undefined, { disabled: training.hintLevel >= 3, size: 11 });
    button(ctx, targets, rect(footer.x + w + 6, footer.y, w, footer.h), '成立', 'trainingJudge', true, { active: training.judgment === true });
    button(ctx, targets, rect(footer.x + (w + 6) * 2, footer.y, w, footer.h), '不成立', 'trainingJudge', false, { active: training.judgment === false });
  }
}

/** The host owns state/input. Targets have unprefixed actions and readable labels. */
function renderTraining(ctx, layout, view = {}) {
  const targets = [];
  ctx.save(); ctx.clearRect(0, 0, layout.width, layout.height); ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  header(ctx, layout, view, targets);
  if (view.screen === 'exercise') drawExercise(ctx, layout, view, targets);
  else if (view.screen === 'foundation') drawFoundation(ctx, layout, view, targets);
  else if (view.screen === 'lesson') drawLesson(ctx, layout, view, targets);
  else drawCatalog(ctx, layout, view, targets);
  ctx.restore(); layout.targets = targets; return targets;
}

module.exports = { createTrainingLayout, renderTraining };
