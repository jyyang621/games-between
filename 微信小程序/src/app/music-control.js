'use strict';

/** A shared 44px control sits beside the native capsule, clear of game tools. */
function musicControl(viewport) {
  const { width, height, safeTop = 0 } = viewport;
  const cap = viewport.capsuleRect;
  const left = cap && Number.isFinite(cap.left) ? cap.left : width - 8;
  const top = cap && Number.isFinite(cap.top) ? cap.top - 6 : safeTop + 4;
  const area = { x: Math.max(8, left - 48), y: Math.max(safeTop, Math.min(height - 44, top)), w: 44, h: 44 };
  const right = cap && Number.isFinite(cap.right) ? cap.right : area.x + area.w;
  const bottom = cap && Number.isFinite(cap.bottom) ? cap.bottom : area.y + area.h;
  const exclusion = {
    left: area.x, top: Math.min(area.y, cap && Number.isFinite(cap.top) ? cap.top : area.y),
    right: Math.max(right, area.x + area.w), bottom: Math.max(bottom, area.y + area.h),
  };
  exclusion.width = exclusion.right - exclusion.left;
  exclusion.height = exclusion.bottom - exclusion.top;
  return { area, exclusion };
}

function renderMusicControl(ctx, area, enabled, playing, available) {
  const x = area.x + 22, y = area.y + 22;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f7ef'; ctx.fill();
  ctx.strokeStyle = enabled && available ? '#36594e' : '#8a9585'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 3); ctx.lineTo(x - 4, y - 3); ctx.lineTo(x + 1, y - 7);
  ctx.lineTo(x + 1, y + 7); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x - 8, y + 3); ctx.closePath(); ctx.stroke();
  ctx.beginPath();
  if (enabled && available) {
    ctx.arc(x + 1, y, 6, -0.7, 0.7);
    ctx.moveTo(x + 1 + Math.cos(-0.7) * 10, y + Math.sin(-0.7) * 10);
    ctx.arc(x + 1, y, 10, -0.7, 0.7);
  } else { ctx.moveTo(x + 5, y - 5); ctx.lineTo(x + 11, y + 5); ctx.moveTo(x + 11, y - 5); ctx.lineTo(x + 5, y + 5); }
  ctx.stroke();
  if (playing) { ctx.beginPath(); ctx.arc(x + 11, y + 11, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#769763'; ctx.fill(); }
  ctx.restore();
  return { ...area, action: 'music:toggle', label: available ? `背景音乐：${enabled ? '开，点击关闭' : '关，点击开启'}` : '背景音乐：暂不可用，点击重试' };
}

module.exports = { musicControl, renderMusicControl };
