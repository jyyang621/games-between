'use strict';
const { SHOOTER } = require('./core/model.js');
const { createZumaSession, SAVE_KEY } = require('./session.js');
const { CAMPAIGN_LEVELS, DIFFICULTIES, getDifficulty } = require('./levels.js');
const { createZumaLayout, screenToWorld, renderZuma } = require('./renderer.js');

const STATUS = { ready: '等待探险者', playing: '旅程进行中', paused: '旅程已暂停', won: '关卡已完成', lost: '旅程暂告段落' };

/** Session owns progression; this adapter owns gestures and presentation state. */
function createZumaGame(options = {}) {
  const session = createZumaSession(options);
  const services = options.services || {};
  let view = session.hasProgress ? 'play' : 'menu';
  let selectedLevel = session.levelIndex;
  let layout = createZumaLayout();
  let aim = { x: SHOOTER.x, y: 140 };
  let gesture = null;
  let help = false;
  let resumeAfterHelp = false;
  let generation = 0;
  let particles = [], labels = [];
  let swapFeedback = null;
  const model = () => session.model;
  const invalidate = () => { if (services.invalidate) services.invalidate(); };
  const save = () => session.save();

  function clearEffects() { particles = []; labels = []; gesture = null; swapFeedback = null; aim = { x: SHOOTER.x, y: 140 }; }
  function pause() {
    generation += 1; gesture = null; resumeAfterHelp = false;
    session.pause();
  }
  function play() {
    generation += 1; help = false; view = 'play'; gesture = null;
    if (model().status === 'ready') model().start();
    else if (model().status === 'paused') model().resume();
    save(); return true;
  }
  function replaceRound(title, content, start) {
    if (session.hasProgress && typeof services.modal === 'function') {
      pause();
      const expectedGeneration = generation;
      return services.modal({ title, content, confirmText: '开始挑战', cancelText: '保留进度' }, () => {
        if (generation !== expectedGeneration) return;
        start(); clearEffects(); play(); invalidate();
      }) !== false;
    }
    start(); clearEffects(); return play();
  }
  function switchMode(mode) {
    if (!['campaign', 'endless'].includes(mode)) return false;
    pause(); clearEffects();
    if (mode !== session.mode) session.selectMode(mode);
    view = 'menu'; selectedLevel = session.levelIndex; save(); return true;
  }
  function switchDifficulty(difficulty) {
    if (!DIFFICULTIES.some(item => item.id === difficulty) || difficulty === session.difficulty) return false;
    pause(); clearEffects();
    session.selectDifficulty(difficulty);
    view = 'menu'; selectedLevel = session.levelIndex; return true;
  }

  function activate(action, payload) {
    if (action === 'zuma:help') {
      if (help) return false;
      gesture = null; resumeAfterHelp = view === 'play' && model().status === 'playing';
      model().pause(); help = true; return true;
    }
    if (action === 'zuma:help-close') {
      if (!help) return false;
      help = false;
      if (resumeAfterHelp && view === 'play') model().resume();
      resumeAfterHelp = false; return true;
    }
    if (help) return false;
    if (action === 'zuma:menu') { pause(); view = 'menu'; selectedLevel = session.levelIndex; return true; }
    if (action === 'zuma:mode') return switchMode(payload);
    if (action === 'zuma:difficulty' && view === 'menu') return switchDifficulty(payload);
    if (action === 'zuma:enter-endless') return switchMode('endless');
    if (action === 'zuma:select-level' && view === 'menu' && session.mode === 'campaign') {
      if (!Number.isInteger(payload) || payload < 0 || payload >= CAMPAIGN_LEVELS.length) return false;
      selectedLevel = payload; return true;
    }
    if (action === 'zuma:start') {
      if (view === 'play') return model().status === 'ready' ? play() : false;
      if (session.mode === 'endless') {
        return replaceRound('开始新的无尽挑战？', '会从第 1 波出发，最佳成绩保留。闯关进度不受影响。', () => session.startEndless());
      }
      if (selectedLevel > session.unlocked) return false;
      if (selectedLevel === session.levelIndex && model().status === 'ready') return play();
      return replaceRound('重新进入这一关？', '当前闯关局面会被替换，已解锁关卡和最佳成绩保留。', () => session.startCampaign(selectedLevel));
    }
    if (action === 'zuma:new-endless') {
      if (session.mode !== 'endless') switchMode('endless');
      return replaceRound('开始新的无尽挑战？', '会从第 1 波出发，最佳成绩保留。闯关进度不受影响。', () => session.startEndless());
    }
    if (action === 'zuma:continue') {
      if (!session.hasProgress && model().status !== 'ready') return false;
      view = 'play';
      return ['ready', 'paused'].includes(model().status) ? play() : true;
    }
    if (action === 'zuma:next') {
      if (!session.next()) return false;
      selectedLevel = session.levelIndex; clearEffects(); return play();
    }
    if (action === 'zuma:resume' && model().status === 'paused') return play();
    if (action === 'zuma:pause' && view === 'play' && model().status === 'playing') { pause(); return true; }
    if (action === 'zuma:restart') {
      return replaceRound('重新挑战？', session.mode === 'endless' ? '本次无尽挑战将从第 1 波重来，最佳成绩保留。' : '本关重新开始，已解锁关卡和最佳成绩保留。', () => session.restart());
    }
    if (action === 'zuma:swap' && view === 'play' && ['ready', 'playing', 'paused'].includes(model().status)) {
      gesture = null;
      const changed = model().swap();
      swapFeedback = { text: changed ? '已换球' : '前后同色', life: 0.8 };
      if (!changed && services.toast) services.toast('当前与下一颗球同色，发射后会补入新球');
      save(); return true;
    }
    return false;
  }

  const pointId = point => point.identifier === undefined ? 0 : point.identifier;
  function pointer(type, points = []) {
    if (help || view !== 'play' || model().status !== 'playing') { gesture = null; return false; }
    if (type === 'cancel') { const hadGesture = Boolean(gesture); gesture = null; return hadGesture; }
    const list = Array.isArray(points) ? points : [];
    if (type === 'start') {
      if (gesture) return false;
      const point = list[0];
      if (!point || !Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) return false;
      const world = screenToWorld(layout, point.clientX, point.clientY);
      if (!world) return false;
      gesture = { id: pointId(point) }; aim = world; return true;
    }
    if (!gesture) return false;
    const point = list.find(item => item && pointId(item) === gesture.id);
    if (!point && list.length) return false;
    if (point && Number.isFinite(point.clientX) && Number.isFinite(point.clientY)) {
      const world = screenToWorld(layout, point.clientX, point.clientY);
      if (world) aim = world;
    }
    if (type === 'end') { gesture = null; return model().fire(aim.x, aim.y); }
    return type === 'move';
  }

  function tick(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(delta / 1000, 0.05);
    if (swapFeedback) { swapFeedback.life -= dt; if (swapFeedback.life <= 0) swapFeedback = null; }
    if (view !== 'play' || help || model().status !== 'playing') return;
    const events = session.step(dt);
    for (const event of events) if (event.type === 'pop') {
      const count = Math.min(32, (event.count || 3) * 5);
      for (let i = 0; i < count; i += 1) {
        const angle = i / count * Math.PI * 2, speed = 55 + i % 5 * 21;
        particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .65, max: .65, color: event.color || 0, size: 2 + i % 3 });
      }
      labels.push({ x: event.x, y: event.y, life: 1, text: (event.combo > 1 ? `连锁 ×${event.combo}  ` : '') + '+' + event.points });
    }
    particles = particles.filter(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; return p.life > 0; }).slice(-240);
    labels = labels.filter(label => { label.life -= dt; return label.life > 0; }).slice(-8);
  }

  return {
    id: 'zuma', frameInterval: 16,
    enter(query = {}) {
      generation += 1; gesture = null;
      const sharedMode = ['campaign', 'endless'].includes(query.m);
      const sharedDifficulty = DIFFICULTIES.some(item => item.id === query.difficulty);
      if (sharedMode || sharedDifficulty) {
        switchMode(sharedMode ? query.m : session.mode);
        if (sharedDifficulty) switchDifficulty(query.difficulty);
        const level = Number(query.l);
        if (session.mode === 'campaign' && Number.isInteger(level) && level >= 1 && level <= CAMPAIGN_LEVELS.length) selectedLevel = level - 1;
      }
    },
    resize(viewport) { gesture = null; layout = createZumaLayout(viewport); },
    render(ctx) { return renderZuma(ctx, layout, {
      model: model(), best: session.best, score: session.score, aim, particles, labels, help,
      view, mode: session.mode, levelIndex: session.levelIndex, wave: session.wave,
      unlocked: session.unlocked, definition: session.definition, bestWave: session.bestWave,
      hasProgress: session.hasProgress, selectedLevel,
      difficulty: session.difficulty,
      swapFeedback,
    }); },
    tick, activate, pointer, pause, save,
    sharePayload() { return { title: `一起来玩 Zuma${session.mode === 'endless' ? '无尽挑战' : '闯关'} · ${getDifficulty(session.difficulty).title} · 游戏之间`, query: `g=zuma&m=${session.mode}&difficulty=${session.difficulty}${session.mode === 'campaign' ? `&l=${session.levelIndex + 1}` : ''}` }; },
    getResumeInfo() { return { text: `${getDifficulty(session.difficulty).title} · ${session.mode === 'endless' ? `无尽第 ${session.wave} 波` : `第 ${session.levelIndex + 1} 关 · ${session.definition.title}`} · ${session.score} 分`, available: session.hasProgress }; },
    get model() { return model(); },
    get musicActive() { return view === 'play' && !help && model().status === 'playing'; },
    get statusText() { return help ? '玩法指南' : `${getDifficulty(session.difficulty).title} · ${session.mode === 'endless' ? `无尽第 ${session.wave} 波` : `第 ${session.levelIndex + 1} 关 · ${session.definition.title}`} · ${STATUS[model().status]}`; },
    get best() { return session.best; },
    get mode() { return session.mode; },
    get difficulty() { return session.difficulty; },
    get view() { return view; },
    get session() { return session; },
    get layout() { return layout; },
  };
}

module.exports = { createZumaGame, SAVE_KEY };
