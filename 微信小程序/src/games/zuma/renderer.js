/* Original Marble Trail palette and procedural artwork, adapted to Canvas 2D. MIT. */
'use strict';
const { WIDTH, HEIGHT, BALL_RADIUS, SHOOTER } = require('./core/model.js');
const { Track } = require('./core/track.js');
const { DIFFICULTIES, getDifficulty, CAMPAIGN_LEVELS, getCampaignLevel, getEndlessLevel } = require('./levels.js');
const PALETTE = [
  { light: '#c1f0c5', mid: '#5dbf92', dark: '#16644c' },
  { light: '#fff0b1', mid: '#edbd5c', dark: '#a26127' },
  { light: '#ffc3a0', mid: '#e98070', dark: '#9e3d39' },
  { light: '#b5edf1', mid: '#70bbd1', dark: '#285d85' },
];
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';

function rounded(ctx, x, y, w, h, radius, fill, stroke) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function text(ctx, value, x, y, size = 14, fill = '#efe7c9', align = 'left', weight = 'normal') {
  ctx.fillStyle = fill; ctx.font = weight + ' ' + size + 'px ' + FONT;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y);
}
function circle(ctx, x, y, radius, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function createZumaLayout(viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 375);
  const height = Math.max(240, Number(viewport.height) || 667);
  const safeTop = Math.max(0, Number(viewport.safeTop) || 0);
  const safeBottom = Math.max(0, Number(viewport.safeBottom) || 0);
  const capsuleBottom = viewport.capsuleRect && Number(viewport.capsuleRect.bottom) || 0;
  const top = Math.min(height * 0.3, Math.max(safeTop + 8, capsuleBottom + 8));
  const landscape = width > height * 1.15;
  let area, rail = null;
  if (landscape) {
    const railWidth = Math.max(128, Math.min(174, width * 0.21));
    rail = { x: 14, y: top, w: railWidth - 8, h: height - top - safeBottom - 12 };
    area = { x: railWidth + 20, y: top, w: width - railWidth - 34, h: height - top - safeBottom - 12 };
  } else area = { x: 12, y: top + 94, w: width - 24, h: Math.max(120, height - top - 94 - safeBottom - 88) };
  const rotated = !landscape;
  const logicalW = rotated ? HEIGHT : WIDTH, logicalH = rotated ? WIDTH : HEIGHT;
  const scale = Math.min(area.w / logicalW, area.h / logicalH);
  const board = { x: area.x + (area.w - logicalW * scale) / 2, y: area.y + (area.h - logicalH * scale) / 2, w: logicalW * scale, h: logicalH * scale };
  return { width, height, safeBottom, top, landscape, rotated, rail, scale, board };
}

function screenToWorld(layout, x, y) {
  const b = layout.board, s = layout.scale;
  if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return null;
  return layout.rotated ? { x: (y - b.y) / s, y: HEIGHT - (x - b.x) / s } : { x: (x - b.x) / s, y: (y - b.y) / s };
}

function marble(ctx, x, y, radius, color, rotation = 0) {
  if (color === 4) {
    circle(ctx, x + radius * 0.08, y + radius * 0.25, radius * 1.06, 'rgba(5,22,15,.28)');
    const rainbow = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    ['#ff8b91', '#ffd47c', '#a5ed99', '#75dbe5', '#a9a0f7', '#f0a4df'].forEach((fill, i) => rainbow.addColorStop(i / 5, fill));
    circle(ctx, x, y, radius, rainbow, '#fff6d6', Math.max(1, radius * 0.075));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation * 0.18 - Math.PI / 2); ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = i * Math.PI / 5, r = radius * (i % 2 ? 0.27 : 0.65);
      if (!i) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fillStyle = '#fffdf0'; ctx.strokeStyle = '#7486a4'; ctx.lineWidth = Math.max(0.7, radius * 0.055); ctx.fill(); ctx.stroke(); ctx.restore();
    circle(ctx, x - radius * 0.35, y - radius * 0.49, radius * 0.16, 'rgba(255,255,255,.85)');
    return;
  }
  const c = PALETTE[color] || PALETTE[0];
  circle(ctx, x + radius * 0.08, y + radius * 0.25, radius * 1.06, 'rgba(5,22,15,.28)');
  const glow = ctx.createRadialGradient(x - radius * 0.36, y - radius * 0.45, radius * 0.06, x + radius * 0.05, y + radius * 0.08, radius);
  glow.addColorStop(0, c.light); glow.addColorStop(0.4, c.mid); glow.addColorStop(1, c.dark);
  circle(ctx, x, y, radius, glow, 'rgba(255,240,194,.65)', 0.9);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(radius / 17, radius / 17);
  ctx.strokeStyle = 'rgba(255,252,219,.68)'; ctx.lineWidth = 1.5; ctx.beginPath();
  if (color === 0) { ctx.moveTo(-5, 7); ctx.bezierCurveTo(-15, -4, 1, -13, 7, -8); ctx.bezierCurveTo(8, 1, 3, 6, -5, 7); ctx.moveTo(-5, 7); ctx.lineTo(4, -5); }
  if (color === 1) { ctx.arc(0, 0, 4.5, 0, Math.PI * 2); for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } }
  if (color === 2) { ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); }
  if (color === 3) { for (let i = 0; i < 3; i += 1) { const y0 = -5 + i * 5; ctx.moveTo(-8, y0); ctx.bezierCurveTo(-3, y0 - 5, 3, y0 + 5, 8, y0); } }
  ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,236,.52)'; ctx.beginPath(); ctx.ellipse(x - radius * 0.36, y - radius * 0.52, radius * 0.27, radius * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
}

function plant(ctx, x, y, size, rotation) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  ctx.strokeStyle = '#294d34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, size * 0.4); ctx.lineTo(0, -size); ctx.stroke();
  for (let i = 0; i < 4; i += 1) for (const side of [-1, 1]) {
    const y0 = -size + i * size * 0.34;
    ctx.fillStyle = i % 2 ? '#476b43' : '#587a4c'; ctx.beginPath(); ctx.moveTo(0, y0 + size * 0.22);
    ctx.quadraticCurveTo(side * size * 0.7, y0 + size * 0.05, side * size * 0.5, y0 - size * 0.2);
    ctx.quadraticCurveTo(side * size * 0.12, y0 - size * 0.2, 0, y0 + size * 0.22); ctx.fill();
  }
  ctx.restore();
}

function terrain(ctx, model, palette = {}) {
  const ground = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  ground.addColorStop(0, palette.ground || '#3f5842'); ground.addColorStop(1, palette.sky || '#263f35'); ctx.fillStyle = ground; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = 'rgba(15,41,30,.2)'; ctx.lineWidth = 1;
  for (let y = -30; y < HEIGHT; y += 84) for (let x = -30; x < WIDTH; x += 116) {
    const ox = x + Math.round(y / 84) % 2 * 58; rounded(ctx, ox + 3, y + 3, 108, 76, 5, null, 'rgba(15,41,30,.18)');
  }
  const path = model.track.samples;
  const stroke = (fill, width, offset = 0) => {
    ctx.beginPath(); path.forEach((point, index) => { if (index % 3 && index !== path.length - 1) return; if (!index) ctx.moveTo(point.x, point.y + offset); else ctx.lineTo(point.x, point.y + offset); });
    ctx.strokeStyle = fill; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  };
  stroke('rgba(9,24,15,.30)', 78, 9); stroke('#283c2b', 74); stroke('#8a8860', 67); stroke('#b2a67b', 59); stroke(palette.stone || '#c2b58c', 48); stroke('rgba(234,216,167,.2)', 37);
  for (let s = 10; s < model.track.length; s += 48) {
    const p = model.track.pointAt(s), t = model.track.tangentAt(s), nx = -t.y, ny = t.x;
    ctx.beginPath(); ctx.moveTo(p.x + nx * 28, p.y + ny * 28); ctx.lineTo(p.x - nx * 28, p.y - ny * 28); ctx.strokeStyle = 'rgba(79,75,48,.3)'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const item of [[30, 50, 55, 0.5], [250, 40, 40, -0.4], [900, 35, 48, 0.7], [1070, 100, 55, 2], [1072, 565, 58, 2.8], [875, 657, 62, 3.1], [510, 663, 38, 3.5], [150, 650, 52, 4], [30, 470, 48, 4.4], [310, 420, 26, 0.6], [765, 400, 27, 2.6], [815, 260, 23, 1.2]]) plant(ctx, ...item);
  for (const [x, y, angle] of [[88, 90, 0.3], [1058, 605, -0.3], [780, 52, 0.14], [81, 615, -0.6]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); rounded(ctx, -32, -26, 61, 49, 5, '#737b58', '#4d6245'); ctx.strokeStyle = '#9a9a6c'; ctx.lineWidth = 2; ctx.strokeRect(-23, -18, 43, 32); ctx.beginPath(); ctx.moveTo(-10, -13); ctx.lineTo(9, 0); ctx.lineTo(-8, 14); ctx.stroke(); ctx.restore();
  }
  circle(ctx, SHOOTER.x, SHOOTER.y + 9, 80, 'rgba(10,25,17,.25)');
  circle(ctx, SHOOTER.x, SHOOTER.y, 76, '#646e4c', '#2a4633', 5);
  circle(ctx, SHOOTER.x, SHOOTER.y, 66, null, '#a09d6b', 2);
  for (let i = 0; i < 16; i += 1) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(SHOOTER.x + Math.cos(a) * 69, SHOOTER.y + Math.sin(a) * 69); ctx.lineTo(SHOOTER.x + Math.cos(a) * 75, SHOOTER.y + Math.sin(a) * 75); ctx.strokeStyle = 'rgba(188,181,120,.6)'; ctx.stroke(); }
  const end = model.track.pointAt(model.track.length);
  const leading = Math.max(0, ...model.balls.map(ball => ball.s));
  if (leading > model.track.length - 250) circle(ctx, end.x, end.y, 48 + Math.sin(model.elapsed * 6) * 3, 'rgba(239,155,100,.13)', 'rgba(255,173,121,.55)', 3);
  ctx.save(); ctx.translate(end.x, end.y); ctx.rotate(0.45);
  rounded(ctx, -37, -43, 74, 80, 18, '#88906b', '#314d37'); ctx.strokeStyle = '#a7a77c'; ctx.lineWidth = 2; ctx.strokeRect(-26, -31, 52, 54);
  rounded(ctx, -23, 0, 46, 35, 13, '#1b3428'); ctx.fillStyle = '#293e2c';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 25, -20); ctx.lineTo(side * 5, -13); ctx.lineTo(side * 25, -9); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#b0ae79'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(7, -2); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill(); ctx.restore();
}

function launcher(ctx, model, aim) {
  const angle = Math.atan2(aim.y - SHOOTER.y, aim.x - SHOOTER.x);
  ctx.save(); ctx.translate(SHOOTER.x, SHOOTER.y); ctx.rotate(angle);
  if (model.status === 'playing') for (let d = 88; d < 280; d += 24) circle(ctx, d, 0, 2, 'rgba(255,239,197,' + ((1 - d / 300) * 0.5) + ')');
  ctx.fillStyle = '#ad9c67'; ctx.strokeStyle = '#4d603d'; ctx.lineWidth = 3;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-14, side * 29, 20, 10, side * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  const shell = ctx.createRadialGradient(-17, -17, 5, 0, 0, 48); shell.addColorStop(0, '#789c63'); shell.addColorStop(1, '#193f30');
  ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(-4, 0, 42, 35, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#c2ae72'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(20, 0); ctx.moveTo(-25, -18); ctx.lineTo(-8, 0); ctx.lineTo(-25, 18); ctx.strokeStyle = '#aeae73'; ctx.lineWidth = 1.5; ctx.stroke();
  rounded(ctx, 12, -21, 44, 42, 13, '#4d7c52', '#d1be80');
  for (const side of [-1, 1]) { circle(ctx, 24, side * 20, 9, '#b8b37b'); circle(ctx, 26, side * 20, 5.8, '#eee3a1'); circle(ctx, 28, side * 20, 3, '#193a29'); }
  marble(ctx, 39, 0, BALL_RADIUS + 2, model.currentColor); ctx.restore();
  marble(ctx, SHOOTER.x, SHOOTER.y + 39, 11, model.nextColor);
}

// Track previews share the same sampled geometry as play, including curved turns.
const previewTracks = new Map();
function trackPreview(ctx, definition, x, y, w, h, muted = false) {
  let track = previewTracks.get(definition.trackPoints);
  if (!track) { track = new Track(definition.trackPoints); previewTracks.set(definition.trackPoints, track); }
  const scale = Math.min(w / WIDTH, h / HEIGHT);
  const ox = x + (w - WIDTH * scale) / 2, oy = y + (h - HEIGHT * scale) / 2;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
  const palette = definition.palette || {};
  rounded(ctx, 0, 0, WIDTH, HEIGHT, 35, palette.ground || '#3f5842');
  ctx.beginPath(); track.samples.forEach((p, i) => { if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.strokeStyle = muted ? '#86988a' : palette.stone || '#c2b58c'; ctx.lineWidth = 29; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  const first = track.pointAt(0), last = track.pointAt(track.length);
  circle(ctx, first.x, first.y, 25, '#c1f0c5'); circle(ctx, last.x, last.y, 29, '#e98070', '#fff0b1', 5);
  circle(ctx, SHOOTER.x, SHOOTER.y, 42, '#d6bd7c', '#233d30', 10);
  ctx.restore();
}

function renderZuma(ctx, layout, state) {
  const { model, best = 0, aim = { x: SHOOTER.x, y: 140 }, particles = [], labels = [], help } = state;
  const mode = state.mode || 'campaign', endless = mode === 'endless';
  const levelIndex = Number.isInteger(state.levelIndex) ? state.levelIndex : 0;
  const wave = Math.max(1, Number(state.wave) || 1);
  const difficulty = getDifficulty(state.difficulty || state.definition && state.definition.difficulty);
  const definition = state.definition || getCampaignLevel(levelIndex, difficulty.id);
  const palette = definition.palette || {};
  const score = state.score === undefined ? model.score : state.score;
  const stage = (endless ? '无尽第 ' + wave + ' 波' : '第 ' + (levelIndex + 1) + '/' + CAMPAIGN_LEVELS.length + ' 关 · ' + definition.title) + ' · ' + difficulty.title;
  const number = value => Number(value.toFixed(1)).toString();
  const targets = [], b = layout.board;
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, layout.width, layout.height); bg.addColorStop(0, '#142b23'); bg.addColorStop(1, palette.sky || '#233d30'); ctx.fillStyle = bg; ctx.fillRect(0, 0, layout.width, layout.height);
  function button(label, x, y, w, h, action, primary = false, disabled = false, payload) {
    rounded(ctx, x, y, w, h, Math.min(11, h / 3), disabled ? '#294238' : primary ? '#d6bd7c' : '#2b4739', primary ? '#f0d99a' : '#4f6750');
    if (action === 'zuma:swap') {
      const cy = y + (h >= 40 ? 10 : 8), r = h >= 40 ? 5 : 4.2;
      marble(ctx, x + w / 2 - 12, cy, r, model.currentColor); marble(ctx, x + w / 2 + 12, cy, r, model.nextColor);
      text(ctx, '›', x + w / 2, cy, 11, '#c8d5b7', 'center');
      text(ctx, model.currentColor === model.nextColor ? '同色' : '换球', x + w / 2, y + h - (h >= 40 ? 12 : 9), 12, disabled ? '#748b79' : '#ece5c9', 'center');
    } else text(ctx, label, x + w / 2, y + h / 2, Math.min(13, (w - 12) / Math.max(2, Array.from(label).length)), disabled ? '#748b79' : primary ? '#263d2d' : '#ece5c9', 'center', primary ? '600' : 'normal');
    if (!disabled) { const target = { x, y, w, h, action, label: action === 'zuma:swap' ? '换球' : label }; if (payload !== undefined) target.payload = payload; targets.push(target); }
  }

  function menu() {
    const bottom = layout.height - layout.safeBottom;
    const selected = Math.max(0, Math.min(CAMPAIGN_LEVELS.length - 1, Number(state.selectedLevel) || 0));
    const selectedDefinition = endless ? getEndlessLevel(wave, 74219, difficulty.id) : getCampaignLevel(selected, difficulty.id);
    const unlocked = Math.max(0, Number(state.unlocked) || 0);
    const locked = selected > unlocked;
    let grid, footerX, footerW, footerY, startY, difficultyX, difficultyY, difficultyW, difficultyH, startH = 40;
    if (layout.landscape) {
      const sideW = Math.max(180, Math.min(230, layout.width * 0.25));
      const sideX = 14, sideY = layout.top;
      button('‹ 大厅', sideX, sideY, (sideW - 20) / 2, 30, 'home'); button('分享', sideX + (sideW - 8) / 2, sideY, (sideW - 20) / 2, 30, 'share');
      text(ctx, '遗迹弹珠', sideX + (sideW - 8) / 2, sideY + 46, 22, '#f1e9c9', 'center', '600');
      const tabW = (sideW - 14) / 2;
      button('闯关', sideX, sideY + 65, tabW, 30, 'zuma:mode', !endless, false, 'campaign'); button('无尽', sideX + tabW + 6, sideY + 65, tabW, 30, 'zuma:mode', endless, false, 'endless');
      grid = { x: sideW + 28, y: layout.top + 4, w: layout.width - sideW - 42, h: bottom - layout.top - 20 };
      footerX = sideX; footerW = sideW - 8; footerY = sideY + 133;
      difficultyX = sideX; difficultyY = sideY + 103; difficultyW = footerW; difficultyH = 27;
      startY = bottom - (state.hasProgress ? 94 : 58); startH = 38;
    } else {
      button('‹ 大厅', 14, layout.top, 66, 32, 'home'); button('分享', layout.width - 72, layout.top, 58, 32, 'share');
      text(ctx, '遗迹弹珠', layout.width / 2, layout.top + 13, 21, '#f1e9c9', 'center', '600');
      text(ctx, '六段遗迹 · 无限挑战', layout.width / 2, layout.top + 36, 10, '#a8b994', 'center');
      const tabW = (layout.width - 34) / 2;
      button('闯关模式', 14, layout.top + 53, tabW, 34, 'zuma:mode', !endless, false, 'campaign'); button('无尽模式', 20 + tabW, layout.top + 53, tabW, 34, 'zuma:mode', endless, false, 'endless');
      grid = { x: 14, y: layout.top + 138, w: layout.width - 28, h: bottom - layout.top - 260 };
      footerX = 14; footerW = layout.width - 28; footerY = bottom - 108; startY = bottom - 58;
      difficultyX = 14; difficultyY = layout.top + 96; difficultyW = footerW; difficultyH = 30;
    }
    const difficultyGap = layout.landscape ? 4 : 6, dw = (difficultyW - difficultyGap * 3) / 4;
    DIFFICULTIES.forEach((choice, i) => button(choice.title, difficultyX + i * (dw + difficultyGap), difficultyY, dw, difficultyH, 'zuma:difficulty', choice.id === difficulty.id, false, choice.id));
    if (!endless) {
      const columns = layout.landscape ? 3 : 2, rows = Math.ceil(CAMPAIGN_LEVELS.length / columns), gap = 8;
      const cw = (grid.w - gap * (columns - 1)) / columns, ch = (grid.h - gap * (rows - 1)) / rows;
      CAMPAIGN_LEVELS.forEach((level, i) => {
        const x = grid.x + (i % columns) * (cw + gap), y = grid.y + Math.floor(i / columns) * (ch + gap);
        const isLocked = i > unlocked, active = selected === i;
        rounded(ctx, x, y, cw, ch, 12, active ? '#344e3c' : '#203d2d', active ? '#e3c782' : '#4d6851');
        if (active) rounded(ctx, x + 2, y + 2, cw - 4, ch - 4, 10, null, '#ad9c64');
        const compact = ch < 82;
        if (compact) {
          text(ctx, String(i + 1).padStart(2, '0'), x + 9, y + 12, 11, isLocked ? '#a6b7a3' : '#f1e8c7', 'left', '600');
          text(ctx, level.title, x + 9, y + 28, 10, isLocked ? '#a6b7a3' : '#f1e8c7', 'left', '600');
          trackPreview(ctx, level, x + cw * 0.46, y + 7, cw * 0.49, ch - 14, isLocked);
        } else {
          text(ctx, String(i + 1).padStart(2, '0') + ' · ' + level.title, x + 9, y + 13, Math.min(12, (cw - 18) / (level.title.length + 5)), isLocked ? '#a6b7a3' : '#f1e8c7', 'left', '600');
          trackPreview(ctx, level, x + 8, y + 25, cw - 16, Math.max(12, ch - 43), isLocked);
        }
        text(ctx, isLocked ? compact ? '待解锁' : '待解锁 · 可预览' : active ? compact ? '已选择' : '已选择 · 已解锁' : '已解锁', compact ? x + 9 : x + cw / 2, y + ch - 9, compact ? 7.5 : 8, isLocked ? '#9cac99' : '#c7c99c', compact ? 'left' : 'center');
        targets.push({ x, y, w: cw, h: ch, action: 'zuma:select-level', payload: i, label: '第 ' + (i + 1) + ' 关 ' + level.title + (isLocked ? ' 待解锁' : ' 已解锁') });
      });
    } else {
      const d = selectedDefinition, x = grid.x, y = grid.y, w = grid.w, h = grid.h;
      rounded(ctx, x, y, w, h, 16, '#213f31', '#718365');
      const compact = h < 240;
      text(ctx, 'ENDLESS TRAIL', x + w / 2, y + (compact ? 16 : 24), 10, '#b5c79f', 'center');
      text(ctx, '无尽遗迹', x + w / 2, y + (compact ? 39 : 52), compact ? 23 : 28, '#f0e3b5', 'center', '600');
      const previewY = y + (compact ? 58 : 75), previewH = Math.max(28, h - (compact ? 140 : 159));
      trackPreview(ctx, d, x + 20, previewY, w - 40, previewH);
      text(ctx, '逐波提速 · 最高' + number(difficulty.endlessSpeedCap), x + w / 2, y + h - 65, 12, '#e5d69e', 'center');
      text(ctx, '险境缓速 · 清波休息', x + w / 2, y + h - 43, 12, '#b6c7aa', 'center');
      text(ctx, '最高抵达第 ' + Math.max(0, Number(state.bestWave) || 0) + ' 波', x + w / 2, y + h - 20, 10, '#98b596', 'center');
    }
    text(ctx, difficulty.title + ' · 本档最佳 ' + best, footerX + footerW / 2, footerY + 7, 10, '#e0dfb7', 'center');
    const stats = selectedDefinition.totalBalls + ' 颗 · 初速 ' + number(selectedDefinition.speed) + ' · 上限 ' + number(selectedDefinition.maxSpeed);
    const statsUnits = Array.from(stats).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 1 : 0.58), 0);
    text(ctx, stats, footerX + footerW / 2, footerY + 22, Math.min(11, (footerW - 8) / statsUnits), '#d2d7ad', 'center');
    text(ctx, endless ? '清波休息 · 准备好再继续' : locked ? '先通过第 ' + selected + ' 关即可解锁' : '逐渐提速 · 每关新轨道', footerX + footerW / 2, footerY + 37, Math.min(10, footerW / 16), locked && !endless ? '#dfab88' : '#a9bb9f', 'center');
    if (layout.landscape) {
      button(endless ? '开始无尽挑战' : locked ? '先通前关' : '开始第 ' + (selected + 1) + ' 关', footerX, startY, footerW, startH, endless ? 'zuma:new-endless' : 'zuma:start', true, !endless && locked);
      if (state.hasProgress) button('继续上次旅程', footerX, bottom - 50, footerW, 32, 'zuma:continue');
    } else {
      const sw = state.hasProgress ? (footerW - 8) / 2 : footerW;
      button(endless ? '开始无尽挑战' : locked ? '先通前关' : '开始第 ' + (selected + 1) + ' 关', footerX, startY, sw, startH, endless ? 'zuma:new-endless' : 'zuma:start', true, !endless && locked);
      if (state.hasProgress) button('继续上次旅程', footerX + sw + 8, startY, sw, startH, 'zuma:continue');
    }
  }

  function play() {
    const remaining = Math.max(0, model.totalBalls - model.spawned + model.balls.length);
    const progress = Math.min(1, Math.max(0, 1 - remaining / model.totalBalls));
    const speed = Number.isFinite(model.currentSpeed) ? model.currentSpeed : model.speed;
    const limit = definition.maxSpeed || model.maxSpeed || 48;
    const danger = definition.dangerSlowdown === true && model.balls.length > 0 && Math.max(...model.balls.map(ball => ball.s)) / model.track.length >= 0.78;
    const hasWildcard = model.currentColor === 4 || model.nextColor === 4;
    const swapFeedback = state.swapFeedback && state.swapFeedback.life > 0 ? state.swapFeedback.text : '';
    const canSwap = ['ready', 'playing', 'paused'].includes(model.status);
    const pauseLabel = model.status === 'paused' ? '继续' : '暂停';
    const pauseAction = model.status === 'paused' ? 'zuma:resume' : 'zuma:pause';
    if (layout.landscape) {
      const r = layout.rail, shortRail = r.h < 300;
      button('‹ 大厅', r.x, r.y, (r.w - 6) / 2, 30, 'home'); button('分享', r.x + (r.w + 6) / 2, r.y, (r.w - 6) / 2, 30, 'share');
      text(ctx, '遗迹弹珠', r.x + r.w / 2, r.y + (shortRail ? 48 : 55), 22, '#f1e9c9', 'center', '600');
      text(ctx, stage, r.x + r.w / 2, r.y + (shortRail ? 68 : 78), Math.min(11, r.w / (stage.length * 0.95)), '#c3c8a1', 'center');
      if (hasWildcard) text(ctx, '彩球·万能', r.x + r.w / 2, r.y + (shortRail ? 79 : 91), 9, '#f1d2ed', 'center');
      const statY = r.y + (shortRail ? 91 : 106), step = shortRail ? 21 : 29;
      for (const [label, value, dy] of [['得分', score, 0], ['最佳', best, step], ['剩余', remaining + ' 颗', step * 2]]) {
        text(ctx, label, r.x + 3, statY + dy, 11, '#a6b697'); text(ctx, value, r.x + r.w - 3, statY + dy, 17, '#f2e8bd', 'right', '600');
      }
      const speedY = statY + step * 2 + 20;
      text(ctx, swapFeedback || (danger ? '险境缓速' : '速度 ' + Math.round(speed)), r.x + 3, speedY, 10, swapFeedback ? '#f2e2a8' : danger ? '#f2bc8e' : '#b8c89f');
      rounded(ctx, r.x + r.w - 67, speedY - 3, 64, 5, 2, '#162d22'); rounded(ctx, r.x + r.w - 67, speedY - 3, Math.max(2, Math.min(1, speed / limit) * 64), 5, 2, danger ? '#dfaa7b' : '#c9bd80');
      const y = r.y + r.h - 101, hw = (r.w - 6) / 2;
      button('换球', r.x, y, hw, 34, 'zuma:swap', false, !canSwap); button(pauseLabel, r.x + hw + 6, y, hw, 34, pauseAction, false, !['playing', 'paused'].includes(model.status));
      button('重开', r.x, y + 35, hw, 34, 'zuma:restart'); button('选关/模式', r.x + hw + 6, y + 35, hw, 34, 'zuma:menu');
      button('玩法', r.x, y + 70, r.w, 34, 'zuma:help');
    } else {
      const y = layout.top;
      button('‹ 大厅', 14, y, 66, 32, 'home'); button('分享', layout.width - 72, y, 58, 32, 'share');
      text(ctx, '遗迹弹珠', layout.width / 2, y + 13, 21, '#f1e9c9', 'center', '600');
      text(ctx, stage, layout.width / 2, y + 42, 11, '#c3c8a1', 'center');
      for (const [label, value, i] of [['当前得分', score, 0], ['最佳纪录', best, 1], ['剩余弹珠', remaining, 2]]) {
        const x = 20 + (layout.width - 40) * (i + 0.5) / 3;
        text(ctx, label, x, y + 61, 9, '#a6b697', 'center'); text(ctx, value, x, y + 80, Math.min(20, (layout.width - 50) / 3 / Math.max(1, String(value).length * 0.62)), '#f2e8bd', 'center', '600');
      }
      const controlsY = b.y + b.h + 12, gap = 5, bw = (layout.width - 28 - gap * 4) / 5;
      const controls = [['换球', 'zuma:swap', !canSwap], [pauseLabel, pauseAction, !['playing', 'paused'].includes(model.status)], ['重开', 'zuma:restart'], ['选关', 'zuma:menu'], ['玩法', 'zuma:help']];
      controls.forEach(([label, action, disabled], i) => button(label, 14 + i * (bw + gap), controlsY, bw, 44, action, false, disabled));
      text(ctx, '当前 › 下颗', 14 + bw / 2, controlsY - 5, 8, '#c7cfb0', 'center');
      text(ctx, '拖动瞄准 · 松手发射 · 同色三连消除', layout.width / 2, controlsY + 61, 10, '#a6b697', 'center');
    }
    rounded(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 9, '#9c9469', '#bdb180');
    ctx.save(); rounded(ctx, b.x, b.y, b.w, b.h, 7); ctx.clip();
    ctx.translate(b.x, b.y); ctx.scale(layout.scale, layout.scale);
    if (layout.rotated) { ctx.translate(HEIGHT, 0); ctx.rotate(Math.PI / 2); }
    terrain(ctx, model, palette);
    for (const ball of model.balls) { const p = model.track.pointAt(ball.s); marble(ctx, p.x, p.y, BALL_RADIUS + 1, ball.color, ball.s / 110); }
    for (const shot of model.projectiles) marble(ctx, shot.x, shot.y, BALL_RADIUS + 1, shot.color, model.elapsed * 3);
    launcher(ctx, model, aim);
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); circle(ctx, p.x, p.y, p.size, (PALETTE[p.color] || { light: '#fff1ff' }).light); }
    ctx.globalAlpha = 1; ctx.restore();
    // Labels remain upright when the board is rotated in portrait.
    for (const label of labels) {
      const p = layout.rotated ? { x: b.x + (HEIGHT - label.y) * layout.scale, y: b.y + label.x * layout.scale } : { x: b.x + label.x * layout.scale, y: b.y + label.y * layout.scale };
      ctx.globalAlpha = Math.min(1, label.life * 3); text(ctx, label.text, p.x, p.y - (1 - label.life) * 20, 15, '#fff0b1', 'center', '600');
    }
    ctx.globalAlpha = 1;
    if (!layout.landscape) {
      rounded(ctx, b.x + 8, b.y + 7, b.w - 16, 22, 7, 'rgba(18,42,29,.85)');
      const speedText = danger ? '险境缓速' + (hasWildcard ? '' : ' · 留住下一击') : '速度 ' + Math.round(speed) + ' / ' + number(limit);
      text(ctx, (hasWildcard ? '彩球·万能 · ' : '') + speedText, b.x + b.w / 2, b.y + 18, 9, hasWildcard ? '#f1d2ed' : danger ? '#f2bc8e' : '#efe2b9', 'center');
      rounded(ctx, b.x + 16, b.y + 31, b.w - 32, 3, 1.5, '#1b3828'); rounded(ctx, b.x + 16, b.y + 31, Math.max(2, (b.w - 32) * Math.min(1, speed / limit)), 3, 1.5, danger ? '#dfaa7b' : '#ddc384');
    }
    rounded(ctx, b.x + 12, b.y + b.h - 12, b.w - 24, 3, 1.5, 'rgba(10,27,18,.55)');
    if (progress > 0) rounded(ctx, b.x + 12, b.y + b.h - 12, (b.w - 24) * progress, 3, 1.5, '#d8c184');
    if (model.status !== 'playing' && !help) {
      ctx.fillStyle = 'rgba(10,30,21,.65)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      const finalLevel = !endless && levelIndex === CAMPAIGN_LEVELS.length - 1;
      const copy = {
        ready: [stage, definition.title, [definition.subtitle, '清空珠链，守住遗迹入口'], '开始探索', 'zuma:start'],
        paused: ['TAKE YOUR TIME', '旅程已暂停', ['色彩与连锁都停在这里', '准备好后，继续你的下一击'], '继续旅程', 'zuma:resume'],
        won: [endless ? 'WAVE CLEARED' : 'PASSAGE CLEARED', finalLevel ? '六段遗迹，全部通关' : endless ? '第 ' + wave + ' 波已清空' : definition.title + ' · 已通过', [endless ? '清波休息，准备好再继续' : finalLevel ? '新的无尽旅程正等着你' : '下一段遗迹，换一条新轨道', '累计得分 ' + score + ' · 连锁 ×' + Math.max(1, model.bestCombo)], finalLevel ? '挑战无尽' : endless ? '下一波' : '下一关', finalLevel ? 'zuma:enter-endless' : 'zuma:next'],
        lost: ['THE TRAIL CONTINUES', '差一点，下次会更好', ['珠链抵达了遗迹入口', '本次得分 ' + score + ' · 试试换球'], '重新挑战', 'zuma:restart'],
      }[model.status];
      if (copy) {
        const w = Math.min(330, layout.landscape ? b.w - 24 : layout.width - 28), h = Math.min(236, b.h - 12), x = b.x + (b.w - w) / 2, y = b.y + (b.h - h) / 2;
        rounded(ctx, x, y, w, h, 16, 'rgba(27,52,36,.98)', '#8e9368');
        const heading = copy[0] + (model.status === 'ready' ? '' : ' · ' + difficulty.title);
        text(ctx, heading, x + w / 2, y + 24, Math.min(10, (w - 32) / heading.length), '#b5bb8f', 'center');
        text(ctx, copy[1], x + w / 2, y + 56, Math.min(21, (w - 36) / copy[1].length), '#f5eac4', 'center', '600');
        copy[2].forEach((line, i) => text(ctx, line, x + w / 2, y + 90 + i * 22, Math.min(12, (w - 32) / line.length), '#bec9aa', 'center'));
        button(copy[3], x + 24, y + h - 66, w - 48, 40, copy[4], true);
        text(ctx, model.status === 'won' ? '此刻可以休息，进度已保存' : '拖动瞄准 · 松手发射', x + w / 2, y + h - 14, 9, '#91a58a', 'center');
      }
    }
    // Draw confirmation above the pause card so a paused swap stays visible.
    if (swapFeedback && !layout.landscape) {
      rounded(ctx, b.x + 8, b.y + 7, b.w - 16, 22, 7, '#183727', '#b3aa70');
      text(ctx, swapFeedback, b.x + b.w / 2, b.y + 18, 11, '#f2e2a8', 'center', '600');
    }
  }
  if (state.view === 'menu') menu(); else play();
  if (help) {
    targets.length = 0;
    ctx.fillStyle = 'rgba(5,19,13,.87)'; ctx.fillRect(0, 0, layout.width, layout.height);
    const w = Math.min(365, layout.width - 28), h = Math.min(365, layout.height - layout.top - layout.safeBottom - 20);
    const x = (layout.width - w) / 2, y = layout.top + (layout.height - layout.top - layout.safeBottom - h) / 2;
    rounded(ctx, x, y, w, h, 18, '#223f2e', '#88966b');
    text(ctx, '每一次连锁，都从一击开始', x + w / 2, y + 29, Math.min(19, w / 17), '#f1e7bf', 'center', '600');
    const lines = ['拖动瞄准，松手发射；轻点也可射击。', '连接至少 3 颗紧邻同色珠，即可消除。', '消除后两端回吸，同色接触会产生连锁。', '“换球”钮内左为当前球，右为下一颗。', '稀有彩球：命中后变成相邻珠的颜色。', '四档难度越高，球速更快、弹珠更多。', '闯关：清空珠链，解锁新的遗迹轨道。', '无尽：逐波提速，清波后休息再继续。', '速度有上限，无尽险境会自动减速。', '离开或切到后台会暂停，并保存进度。'];
    const spacing = Math.min(28, (h - 130) / (lines.length - 1));
    lines.forEach((line, i) => text(ctx, line, x + 18, y + 62 + i * spacing, Math.min(12, (w - 36) / 22), '#bfccb0'));
    button('知道了', x + 24, y + h - 56, w - 48, 38, 'zuma:help-close', true);
  }
  ctx.restore(); return targets;
}

module.exports = { PALETTE, createZumaLayout, screenToWorld, renderZuma };
