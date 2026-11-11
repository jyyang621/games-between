'use strict';

const { SudokuGame } = require('./state.js');
const { RatedSudokuGame } = require('./rated-state.js');
const { SudokuTraining } = require('./training.js');
const { createLayout, render, timeLabel } = require('./renderer.js');
const { createTrainingLayout, renderTraining } = require('./training-renderer.js');
const { DIFFICULTIES, dailySeed } = require('./core/engine.js');
const { getPuzzle, getTrainingExamples, selectPuzzleByTechnique } = require('./bank.js');
const { getLesson } = require('./lessons.js');
const { getFoundationPage } = require('./foundation-lessons.js');
const { TECHNIQUES } = require('./logic.js');

// Preserve the original keys so existing installs keep their puzzle and scores.
const SAVE_KEY = 'games-between:sudoku:v1';
const SETTINGS_KEY = 'games-between:settings:v1';
const STATS_KEY = 'games-between:stats:v1';
const TRAINING_KEY = 'games-between:sudoku:training:v1';
const PRACTICE_KEY = 'games-between:sudoku:full-practice:v1';
const isDifficulty = id => DIFFICULTIES.some(item => item.id === id);

/** Accept both current g=sudoku links and the original links without a game id. */
function sharedRound(query) {
  if (!query || (query.g && query.g !== 'sudoku')) return null;
  const seed = query.p;
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 80 || /[\u0000-\u001f\u007f]/.test(seed)) return null;
  try { encodeURIComponent(seed); } catch { return null; }
  if (query.v !== undefined) {
    if (query.v !== '2') return null;
    const entry = getPuzzle(query.b);
    if (!entry || entry.difficulty !== query.d) return null;
    if (query.fp !== undefined && (!getLesson(query.fp) || !entry.profile.techniqueCounts[query.fp])) return null;
    return { seed, difficulty: entry.difficulty, mode: query.m === 'daily' ? 'daily' : 'classic', bankId: entry.id, version: 2,
      ...(query.fp ? { practiceLessonId: query.fp } : {}) };
  }
  return { seed, difficulty: isDifficulty(query.d) ? query.d : 'easy', mode: query.m === 'daily' ? 'daily' : 'classic' };
}

/** Sudoku owns its rules, view, settings and saves; the host owns platform APIs. */
function createSudokuGame({ read = () => null, write = () => false, now = Date.now, services = {} } = {}) {
  const saved = read(SAVE_KEY);
  let game = saved && saved.schemaVersion === 1 ? new SudokuGame({ now, saved }) : new RatedSudokuGame({ now, saved });
  if (saved && game.roundId !== saved.roundId) game = new RatedSudokuGame({ now });
  let activeRound = Boolean(saved && game.roundId === saved.roundId);
  let layout = null;
  let trainingLayout = null;
  let section = 'play';
  let training = null;
  let ordinaryGame = null;
  let practiceLessonId = null;
  let practiceHintViews = 0;
  let practiceSaves = null;
  // Every lifecycle boundary invalidates delayed menu and confirmation callbacks.
  let generation = 0;
  let answerVisible = false;
  let answerWasPaused = false;
  let hintCells = [];
  const settings = { conflicts: true, highlight: true };
  const savedSettings = read(SETTINGS_KEY);
  if (savedSettings && typeof savedSettings === 'object') {
    for (const key of ['conflicts', 'highlight']) {
      if (typeof savedSettings[key] === 'boolean') settings[key] = savedSettings[key];
    }
  }
  const rawStats = read(STATS_KEY);
  const stats = { completed: {}, rounds: [], rated: { completed: {}, rounds: [] } };
  if (rawStats && typeof rawStats === 'object') {
    if (Array.isArray(rawStats.rounds)) stats.rounds = rawStats.rounds.filter(id => typeof id === 'string' && id.length <= 160).slice(-200);
    for (const item of DIFFICULTIES) {
      const value = rawStats.completed && rawStats.completed[item.id];
      if (value && Number.isSafeInteger(value.count) && value.count >= 0 && Number.isFinite(value.best) && value.best >= 0) {
        stats.completed[item.id] = { count: value.count, best: value.best };
      }
    }
  }
  if (rawStats && rawStats.rated && typeof rawStats.rated === 'object') {
    const rated = rawStats.rated;
    if (Array.isArray(rated.rounds)) stats.rated.rounds = rated.rounds.filter(id => typeof id === 'string' && id.length <= 160).slice(-200);
    for (const item of DIFFICULTIES) {
      const value = rated.completed && rated.completed[item.id];
      if (value && Number.isSafeInteger(value.count) && value.count >= 0 && Number.isFinite(value.best) && value.best >= 0) stats.rated.completed[item.id] = { count: value.count, best: value.best };
    }
  }

  function invalidate() { if (typeof services.invalidate === 'function') services.invalidate(); }
  function toast(message) { if (typeof services.toast === 'function') services.toast(message); }
  function save() {
    if (training) write(TRAINING_KEY, training.serialize());
    if (practiceLessonId && practiceSaves) {
      practiceSaves.rounds[practiceLessonId] = { ...game.serialize(), practiceHintViews };
      practiceSaves.assistance[game.bankId] = Math.max(practiceHintViews, practiceSaves.assistance[game.bankId] || 0);
      write(PRACTICE_KEY, practiceSaves);
    }
    return activeRound ? write(SAVE_KEY, (ordinaryGame || game).serialize()) : false;
  }
  function leavePractice() {
    if (!ordinaryGame) return;
    game.setPaused(true);
    save();
    game = ordinaryGame;
    ordinaryGame = null;
    practiceLessonId = null;
    practiceHintViews = 0;
  }
  function openTraining() {
    const returningLesson = practiceLessonId;
    leavePractice();
    generation += 1;
    game.setPaused(true);
    if (!training) training = new SudokuTraining(read(TRAINING_KEY), { now });
    if (returningLesson) training.openLesson(returningLesson);
    section = 'training'; save(); invalidate();
  }

  function openFullPractice(replace = false, incoming = null) {
    const lessonId = incoming && incoming.practiceLessonId || practiceLessonId || training && training.lessonId;
    if (!getLesson(lessonId)) return false;
    if (!practiceSaves) {
      const stored = read(PRACTICE_KEY);
      practiceSaves = { schemaVersion: 1, rounds: {}, assistance: {} };
      if (stored && stored.schemaVersion === 1 && stored.rounds && typeof stored.rounds === 'object') {
        for (const technique of TECHNIQUES) if (stored.rounds[technique.id]) practiceSaves.rounds[technique.id] = stored.rounds[technique.id];
        if (stored.assistance && typeof stored.assistance === 'object') {
          for (const [id, count] of Object.entries(stored.assistance).slice(0, 512)) {
            if (getPuzzle(id) && Number.isSafeInteger(count) && count >= 0) practiceSaves.assistance[id] = Math.min(99999, count);
          }
        }
      }
    }
    let next = null, hintViews = 0;
    const savedPractice = !replace && practiceSaves.rounds[lessonId];
    const savedEntry = savedPractice && getPuzzle(savedPractice.bankId);
    if (savedEntry && (!incoming || savedEntry.id === incoming.bankId) && savedEntry.profile.techniqueCounts[lessonId] > 0) {
      const restored = new RatedSudokuGame({ now, saved: savedPractice });
      if (restored.roundId === savedPractice.roundId && !restored.completed) {
        next = restored;
        hintViews = Number.isSafeInteger(savedPractice.practiceHintViews) && savedPractice.practiceHintViews >= 0
          ? Math.min(99999, savedPractice.practiceHintViews) : restored.hints;
      }
    }
    if (!next) {
      const seed = incoming ? incoming.seed : freshSeed();
      const techniqueIndex = TECHNIQUES.findIndex(item => item.id === lessonId);
      const entry = incoming ? getPuzzle(incoming.bankId) : selectPuzzleByTechnique(seed, lessonId, {
        difficulty: DIFFICULTIES[TECHNIQUES[techniqueIndex].tier].id,
        allowedTechniques: TECHNIQUES.slice(0, techniqueIndex + 1).map(item => item.id),
        excludeId: replace ? game.bankId : undefined });
      if (!entry) { toast('这个技巧的整题还在准备中，可以先做专项练习。'); return false; }
      next = new RatedSudokuGame({ now, seed, difficulty: entry.difficulty });
      if (!next.start(seed, entry.difficulty, 'classic', entry.id)) return false;
    }
    game.setPaused(true);
    if (!ordinaryGame) ordinaryGame = game;
    game = next;
    game.setPaused(false);
    practiceLessonId = lessonId;
    practiceHintViews = Math.max(hintViews, next.hints, practiceSaves.assistance[next.bankId] || 0);
    generation += 1;
    activeRound = true;
    section = 'play';
    save(); invalidate();
    return true;
  }
  function changedBoard(model = game) {
    return model.board.some((digit, index) => digit !== model.puzzle[index]) || model.notes.some(list => list.length);
  }
  function wouldReplacePractice(incoming) {
    let current = practiceLessonId === incoming.practiceLessonId ? game : null;
    if (!current) {
      const stored = practiceSaves || read(PRACTICE_KEY);
      const candidate = stored && stored.schemaVersion === 1 && stored.rounds && stored.rounds[incoming.practiceLessonId];
      if (candidate && getPuzzle(candidate.bankId)) {
        const restored = new RatedSudokuGame({ now, saved: candidate });
        if (restored.roundId === candidate.roundId) current = restored;
      }
    }
    return Boolean(current && current.bankId !== incoming.bankId && !current.completed && changedBoard(current));
  }
  function freshSeed() { return `${Math.floor(now()).toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }

  function modal(config, onConfirm) {
    if (typeof services.modal !== 'function') { toast('请在微信开发者工具或微信内使用此功能'); return false; }
    const currentGeneration = generation;
    const fail = result => {
      if (currentGeneration !== generation) return;
      toast('弹窗暂时无法打开，请再试一次');
      if (typeof config.fail === 'function') config.fail(result);
    };
    try {
      return services.modal({ ...config, fail }, () => {
        if (currentGeneration !== generation) return;
        if (onConfirm) onConfirm();
        save(); invalidate();
      }) !== false;
    } catch (error) { fail(error); return false; }
  }

  function showAnswer() {
    const current = game;
    const board = game.board.join('');
    const show = () => {
      if (game !== current || game.board.join('') !== board || section !== 'play') return;
      game.markAnswerViewed();
      if (practiceLessonId && !game.completed) practiceHintViews = Math.max(1, practiceHintViews);
      answerWasPaused = game.paused;
      answerVisible = true;
      hintCells = [];
      game.setPaused(true);
      generation += 1;
      save(); invalidate();
    };
    if (game.completed || game.answerViewed) { show(); return true; }
    return modal({ title: '显示正确答案？', content: '将显示本题的完整答案供你对照，不会改动当前填写。返回后可继续原题；本局将标记为已查看答案，不计入成绩。',
      confirmText: '显示答案', cancelText: '继续解题' }, show);
  }

  function startRound(seed, difficulty, mode, force = false, legacy = false, bankId = null) {
    const start = () => {
      const reuse = legacy ? !game.ratingVersion : Boolean(game.ratingVersion);
      const next = reuse ? game : legacy ? new SudokuGame({ now, seed, difficulty, mode }) : new RatedSudokuGame({ now, seed, difficulty, mode });
      if ((reuse || bankId) && !next.start(seed, difficulty, mode, bankId)) return;
      generation += 1;
      answerVisible = false; hintCells = [];
      game = next;
      if (practiceLessonId) practiceHintViews = practiceSaves.assistance[next.bankId] || 0;
      section = 'play';
      activeRound = true;
      save(); invalidate();
    };
    if (!force && !game.completed && changedBoard()) {
      modal({ title: '开始新的一局？', content: '当前这一题的进度会被新题替换。', confirmText: '开始新局', cancelText: '继续这题' }, start);
    } else start();
  }

  function recordCompletion(wasComplete) {
    if (!wasComplete && game.completed && game.answerViewed) { toast('已对照答案完成，本局不计成绩'); return; }
    if (practiceLessonId) {
      if (!wasComplete && game.completed && training) {
        training.recordFullPuzzle({ id: game.bankId, lessonId: practiceLessonId, hints: Math.max(game.hints, practiceHintViews), elapsed: game.elapsed });
        write(TRAINING_KEY, training.serialize());
        toast('整题实战完成，学习记录已保存。');
      }
      return;
    }
    const bucket = game.ratingVersion ? stats.rated : stats;
    if (wasComplete || !game.completed || bucket.rounds.includes(game.roundId)) return;
    bucket.rounds.push(game.roundId);
    bucket.rounds = bucket.rounds.slice(-200);
    const before = bucket.completed[game.difficulty];
    bucket.completed[game.difficulty] = {
      count: Math.min(Number.MAX_SAFE_INTEGER, (before ? before.count : 0) + 1),
      best: before ? Math.min(before.best, game.elapsed) : game.elapsed,
    };
    write(STATS_KEY, stats);
  }

  function more() {
    if (typeof services.actionSheet !== 'function') { toast('更多功能请在微信中打开'); return; }
    const currentGeneration = generation;
    services.actionSheet({ itemList: ['游戏规则', '重新开始本题', `冲突提示：${settings.conflicts ? '开' : '关'}`,
      `关联高亮：${settings.highlight ? '开' : '关'}`, '查看成绩', '本题难度说明'],
    success(result) {
      if (currentGeneration !== generation) return;
      if (result.tapIndex === 0) modal({ title: '数独怎么玩', content: '每行、每列和每个九宫格填入 1–9，不能重复。\n\n新题按逻辑技巧评级：简单用单数，中等含区块或数对，困难含三数组或 X-Wing，专家含翼技巧或剑鱼。旧存档保留原题。\n\n点击“填全笔记”补全候选，再点“取消填全”恢复之前的手动笔记，已填数字保留；两步都可撤销。已证明的候选排除仍会保留。改填或擦除数字可能需要重建推理。“提示”先展示理由，确认后应用；填错时可先修正一格。“显示答案”可对照完整答案，不改填写，查看后的本局不计成绩。上方“课堂”可学习并练习技巧。', showCancel: false });
      else if (result.tapIndex === 1) modal({ title: '重新开始本题？', content: '会清空这一题的填写、笔记和计时。', confirmText: '重新开始' }, () => startRound(game.seed, game.difficulty, game.mode, true, !game.ratingVersion, game.bankId || null));
      else if (result.tapIndex === 2 || result.tapIndex === 3) {
        const key = result.tapIndex === 2 ? 'conflicts' : 'highlight';
        settings[key] = !settings[key];
        write(SETTINGS_KEY, { ...settings });
      } else if (result.tapIndex === 4) {
        const rows = bucket => DIFFICULTIES.map(item => {
          const record = bucket.completed[item.id];
          return `${item.label || item.name}：${record ? `${record.count} 题 · 最快 ${timeLabel(record.best)}` : '尚未完成'}`;
        }).join('\n');
        if (!training) training = new SudokuTraining(read(TRAINING_KEY), { now });
        const progress = Object.values(training.learningProgress);
        const total = key => progress.reduce((sum, item) => sum + item[key], 0);
        modal({ title: '我的数独成绩', content: `逻辑评级题\n${rows(stats.rated)}\n\n技巧学习\n不同局面完成 ${total('uniqueSolved')} 个\n首次无辅助独立通过 ${total('uniqueIndependent')} 个\n整题实战 ${total('fullPuzzle')} 题，其中无提示 ${total('fullPuzzleUnhinted')} 题\n\n旧版记录（保留）\n${rows(stats)}\n\n成绩保存在当前微信设备，普通通关含提示；查看完整答案的本局不计成绩。整题完成不代表已证明使用目标题法。`, showCancel: false });
      } else if (result.tapIndex === 5) puzzleInfo();
      save(); invalidate();
    },
    fail(result) {
      if (currentGeneration !== generation || /cancel/i.test(String(result && result.errMsg || ''))) return;
      toast('菜单暂时无法打开，请再试一次');
    } });
  }

  function puzzleInfo() {
    const entry = game.bankId && getPuzzle(game.bankId);
    if (!entry) { modal({ title: '本题说明', content: '这是保留的旧版题。新开一局可以体验按逻辑技巧评级的题目。', showCancel: false }); return; }
    const labels = Object.keys(entry.profile.techniqueCounts).filter(id => entry.profile.techniqueCounts[id] > 0)
      .map(id => `${(TECHNIQUES.find(item => item.id === id) || {}).label || id} ${entry.profile.techniqueCounts[id]} 次`);
    const experience = entry.experienceProfile;
    const observations = experience ? `\n\n观察与推理量\n最高档技巧 ${experience.criticalSteps} 次\n初盘每个空格平均 ${experience.initialCandidateDensity.toFixed(1)} 个候选\n参考路径中，同时可用的结构最少 ${experience.availableSteps.min} 个，平均 ${experience.availableSteps.mean.toFixed(1)} 个。` : '';
    modal({ title: practiceLessonId ? `${getLesson(practiceLessonId).label} · 整题实战` : '本题难度说明',
      content: `${practiceLessonId ? '从初盘完成这道题。参考解法包含本课技巧；你也可以采用其他正确解法。实战进度单独保存，点“返回课堂”可继续学习。\n\n' : ''}参考逻辑解法共 ${entry.profile.steps} 步。\n${labels.join('\n')}${observations}\n\n难度依据当前技巧集合与参考路径；次数不是所有解法的最低要求，也不是玩家耗时预测。`, showCancel: false });
  }

  function activate(action, payload) {
    if (typeof action !== 'string') return false;
    if (action.startsWith('sudoku:')) action = action.slice('sudoku:'.length);
    if (answerVisible) {
      if (action !== 'closeAnswer') return false;
      answerVisible = false;
      generation += 1;
      game.setPaused(answerWasPaused);
      save(); invalidate();
      return true;
    }
    if (action === 'showAnswer') return section === 'play' ? showAnswer() : false;
    if (action !== 'hint') hintCells = [];
    if (action === 'mode' && payload === 'training') { openTraining(); return true; }
    if (section === 'training') {
      if (action === 'trainingFullPuzzle') return openFullPractice();
      if (action === 'foundationExplanation') {
        const page = getFoundationPage(training.view.foundationPage);
        modal({ title: page.title, content: page.paragraphs.join('\n\n'), showCancel: false });
        return true;
      }
      if (action === 'trainingBack' && training.screen === 'catalog') { section = 'play'; save(); invalidate(); return true; }
      if (action === 'lessonExplanation') {
        const lesson = training.lesson;
        modal({ title: `${lesson.label} · 完整讲解`, content: `${lesson.principle}\n\n怎样识别\n${lesson.steps.map((text, i) => `${i + 1}. ${text}`).join('\n')}\n\n易错点\n${lesson.mistakes}\n\n${lesson.example.lines.join('\n')}`, showCancel: false });
        return true;
      }
      if (action === 'trainingExplanation') {
        const t = training.training;
        if (t) modal({ title: `${training.lesson.label} · 完整推理`, content: t.continuation ? t.feedback : t.recognitionExplanation || t.feedback || (t.answerStep || t.step).explanation, showCancel: false });
        return true;
      }
      const changed = training.activate(action, payload);
      if (changed) {
        if (action === 'trainingHint' && training.training.hintLevel === 3) modal({ title: '完整推理', content: training.training.recognitionExplanation || training.training.step.explanation, showCancel: false });
        save(); invalidate();
      }
      return changed;
    }
    if (action === 'practiceInfo') { puzzleInfo(); return true; }
    if (practiceLessonId && action === 'newGame') {
      if (!game.completed && changedBoard()) modal({ title: '换一道实战题？', content: '这道实战题的进度会被替换，普通对局仍保留。', confirmText: '换一题', cancelText: '继续这题' }, () => openFullPractice(true));
      else openFullPractice(true);
      return true;
    }
    if (practiceLessonId && ['difficulty', 'mode'].includes(action)) return false;
    if (action === 'more') { more(); return true; }
    if (action === 'difficulty' && isDifficulty(payload) && payload !== game.difficulty) {
      startRound(game.mode === 'daily' ? dailySeed(new Date(now())) : game.seed, payload, game.mode); return true;
    }
    if (action === 'mode' && ['classic', 'daily'].includes(payload) && payload !== game.mode) {
      startRound(payload === 'daily' ? dailySeed(new Date(now())) : freshSeed(), game.difficulty, payload); return true;
    }
    if (action === 'newGame') {
      if (game.mode === 'daily' && game.seed === dailySeed(new Date(now()))) {
        modal({ title: '今天的每日挑战', content: '同一难度的每日挑战每天只有一道。可以重玩本题，也可以切换经典模式获取新题。', confirmText: '重玩本题' }, () => startRound(game.seed, game.difficulty, game.mode, true, !game.ratingVersion, game.bankId || null));
      } else startRound(game.mode === 'daily' ? dailySeed(new Date(now())) : freshSeed(), game.difficulty, game.mode);
      return true;
    }
    const wasComplete = game.completed;
    let changed = false;
    if (action === 'select') changed = game.select(payload);
    else if (action === 'digit') changed = game.input(payload);
    else if (action === 'erase') changed = game.erase();
    else if (action === 'undo') changed = game.undo();
    else if (action === 'notes') changed = game.toggleNotes();
    else if (action === 'autoNotes') {
      changed = game.toggleFillAllNotes();
      if (changed) toast(game.fillNotesActive ? '已填全候选数，再点可取消' : '已取消填全，恢复手动笔记');
    } else if (action === 'hint') {
      if (game.ratingVersion) {
        if (game.paused || game.completed) return false;
        const current = game;
        const board = game.board.join('');
        const wrong = index => Number.isInteger(index) && index >= 0 && index < 81 && !game.puzzle[index] &&
          game.board[index] && game.board[index] !== game.solution[index];
        const wrongIndex = wrong(game.selected) ? game.selected : game.board.findIndex((_, index) => wrong(index));
        if (wrongIndex >= 0) {
          const row = Math.floor(wrongIndex / 9) + 1, column = wrongIndex % 9 + 1;
          if (practiceLessonId) { practiceHintViews = Math.min(99999, practiceHintViews + 1); save(); }
          return modal({ title: '修正一处填写', content: '第 ' + row + ' 行第 ' + column + ' 列填入的 ' +
            game.board[wrongIndex] + ' 与本题唯一解不符，正确数字为 ' + game.solution[wrongIndex] +
            '。修正后可继续获取逻辑提示。', confirmText: '修正此格', cancelText: '继续思考' }, () => {
            if (game !== current || game.board.join('') !== board) return;
            const completed = game.completed;
            if (game.applyCorrectionHint(wrongIndex)) {
              hintCells = [wrongIndex]; recordCompletion(completed);
              toast('已修正第 ' + row + ' 行第 ' + column + ' 列，可撤销');
            } else toast('题目状态已变化，请重新获取提示');
          });
        }
        const step = game.nextLogicalStep();
        if (!step) { toast('暂时没有可用的逻辑步骤，可点“显示答案”进行对照。'); return false; }
        const technique = TECHNIQUES.find(item => item.id === step.technique);
        if (practiceLessonId) { practiceHintViews = Math.min(99999, practiceHintViews + 1); save(); }
        return modal({ title: technique ? technique.label : '解题提示',
          content: (step.placements.length ? '' : '这一步先排除候选，不会直接填数字。\n\n') + step.explanation,
          confirmText: '应用提示', cancelText: '继续思考' }, () => {
          if (game !== current || game.board.join('') !== board) return;
          const completed = game.completed;
          if (game.applyLogicalStep(step)) {
            hintCells = [...new Set([...step.cells, ...step.placements.map(item => item.index), ...step.eliminations.map(item => item.index)])];
            if (!game.completed) game.select(step.placements.length ? step.placements[0].index : step.eliminations[0].index);
            recordCompletion(completed);
            toast(step.placements.length ? '已填入推理结果，相关格已高亮；可撤销' :
              '已排除 ' + step.eliminations.length + ' 个候选，相关格已高亮；可撤销');
          } else toast('题目状态已变化，请重新获取提示');
        });
      }
      const hint = game.hint(); changed = Boolean(hint);
      if (hint) { hintCells = [hint.index]; toast(`第 ${Math.floor(hint.index / 9) + 1} 行第 ${hint.index % 9 + 1} 列${hint.corrected ? '已修正为' : '填入'} ${hint.value}`); }
    } else if (action === 'pause') changed = game.setPaused(!game.paused);
    if (changed) { recordCompletion(wasComplete); save(); invalidate(); }
    return changed;
  }

  function enter(query, { source } = {}) {
    generation += 1;
    answerVisible = false; hintCells = [];
    activeRound = true;
    const incoming = sharedRound(query);
    if (incoming && !incoming.practiceLessonId) { leavePractice(); section = 'play'; }
    if (incoming && incoming.practiceLessonId) {
      const open = () => {
        openTraining();
        training.openLesson(incoming.practiceLessonId);
        openFullPractice(false, incoming);
      };
      if (wouldReplacePractice(incoming)) modal({ title: '打开朋友的实战题？',
        content: '这节课还有一道未完成的实战题。切换后，该课的草稿会被朋友的题目替换；普通对局仍保留。',
        confirmText: '切换题目', cancelText: '保留进度' }, open);
      else open();
    } else if (query && ['basics', 'mixed'].includes(query.learn)) {
      openTraining();
      training.activate(query.learn === 'basics' ? 'foundationBasics' : 'trainingMixed');
    } else if (query && query.tr && getLesson(query.tr)) {
      openTraining();
      const examples = getTrainingExamples(query.tr);
      const index = examples.findIndex(example => example.id === query.ex);
      const recognitionOpened = query.rc && training.startRecognition(query.tr, false, query.rc);
      if (!recognitionOpened) {
        if (index >= 0) { training.indices[query.tr] = index; training.start(query.tr, 'independent'); }
        else training.openLesson(query.tr);
      }
    } else if (incoming && (incoming.seed !== game.seed || incoming.difficulty !== game.difficulty || incoming.mode !== game.mode ||
      Boolean(incoming.version) !== Boolean(game.ratingVersion) || incoming.bankId && incoming.bankId !== game.bankId)) {
      startRound(incoming.seed, incoming.difficulty, incoming.mode, source === 'launch', !incoming.version, incoming.bankId || null);
    }
    save();
    return true;
  }

  function targetLabel(target) {
    const labels = { home: '返回大厅', share: '分享', more: '更多', digit: `填入 ${target.payload}`,
      newGame: practiceLessonId ? '换一道实战题' : '新的一局', practiceInfo: '整题实战说明', pause: game.paused ? '继续游戏' : '暂停', undo: '撤销', erase: '擦除',
      notes: '笔记', autoNotes: game.fillNotesActive ? '取消填全' : '填全笔记', hint: '提示', showAnswer: '显示正确答案', closeAnswer: '返回题目' };
    if (target.action === 'select') return `第 ${Math.floor(target.payload / 9) + 1} 行第 ${target.payload % 9 + 1} 列`;
    if (target.action === 'mode') return target.payload === 'training' ? (practiceLessonId ? '返回课堂' : '技巧课堂') : target.payload === 'daily' ? '每日挑战' : '经典数独';
    if (target.action === 'difficulty') {
      const entry = DIFFICULTIES.find(item => item.id === target.payload);
      return `难度：${entry.label || entry.name}`;
    }
    return labels[target.action] || '数独操作';
  }

  function trainingStatus() {
    if (training.screen === 'foundation') return `基础入门 · ${getFoundationPage(training.foundationPage).title}`;
    const t = training.training;
    if (training.screen !== 'exercise' || !t) return `技巧课堂${training.screen === 'lesson' ? ` · ${training.lesson.label}` : ''}`;
    const name = t.sessionMode === 'recognize' ? `条件辨认 · ${training.lesson.label}`
      : t.sessionMode === 'mixed' ? `混合练习${t.completed ? ` · ${training.lesson.label}` : ''}`
      : t.sessionMode === 'review' ? `错题复习${t.completed ? ` · ${training.lesson.label}` : ''}` : `技巧课堂 · ${training.lesson.label}`;
    return `${name} · ${t.completed ? '已完成' : '练习中'}${t.continuation ? ` · 推演 ${t.continuation.index}/4` : ` · 提示 ${t.hintLevel}/3`}`;
  }

  return {
    id: 'sudoku', frameInterval: 1000, activate, enter, save,
    resize(viewport) {
      layout = createLayout(viewport.width, viewport.height, viewport.safeTop, viewport.safeBottom, viewport.capsuleRect);
      trainingLayout = createTrainingLayout(viewport.width, viewport.height, viewport.safeTop, viewport.safeBottom, viewport.capsuleRect);
    },
    render(ctx) {
      if (!layout) return [];
      if (section === 'training') {
        return renderTraining(ctx, trainingLayout, training.view).map(target => ({ ...target,
          action: ['home', 'share'].includes(target.action) ? target.action : `sudoku:${target.action}` }));
      }
      const targets = render(ctx, layout, game, { settings, answerVisible, hintCells, storageAvailable: services.storageAvailable,
        ratingLabel: practiceLessonId ? '整题实战' : game.ratingVersion ? '逻辑评级' : '旧版题',
        practiceLabel: practiceLessonId ? getLesson(practiceLessonId).label : null, subtitle: '给专注一点时间' })
        .map(target => ({ ...target, label: targetLabel(target),
          action: ['home', 'share'].includes(target.action) ? target.action : `sudoku:${target.action}` }));
      layout.targets = targets;
      return targets;
    },
    tick(deltaMs) { return section === 'play' && !answerVisible ? game.tick(deltaMs) : false; },
    pointer() { return false; },
    pause(reason) {
      generation += 1;
      if (answerVisible) { answerWasPaused = true; if (['home', 'share', 'dispose'].includes(reason)) answerVisible = false; }
      game.setPaused(true); save();
    },
    dispose() { generation += 1; answerVisible = false; game.setPaused(true); },
    sharePayload() {
      if (section === 'training') {
        if (training.screen === 'foundation') return { title: '一起学数独：规则与候选数', query: 'g=sudoku&learn=basics' };
        const t = training.screen === 'exercise' && training.training;
        if (t && ['mixed', 'review'].includes(t.sessionMode)) return { title: '一起练数独：不预告技巧的混合练习', query: 'g=sudoku&learn=mixed' };
        return { title: `一起练数独：${training.lesson.label}`, query: `g=sudoku&tr=${encodeURIComponent(training.lessonId)}${t ? `&${t.sessionMode === 'recognize' ? 'rc' : 'ex'}=${encodeURIComponent(t.id)}` : ''}` };
      }
      const difficulty = DIFFICULTIES.find(item => item.id === game.difficulty);
      return { title: practiceLessonId ? `一起实战：${getLesson(practiceLessonId).label}` : `这道${difficulty.label || difficulty.name}数独，等你来挑战`,
        query: `g=sudoku&${game.shareQuery()}${practiceLessonId ? `&fp=${encodeURIComponent(practiceLessonId)}` : ''}` };
    },
    getResumeInfo() {
      if (section === 'training') return { available: true, text: trainingStatus() };
      const filled = game.board.filter(Boolean).length;
      return { available: activeRound, text: activeRound ? (practiceLessonId ? `整题实战 · ${getLesson(practiceLessonId).label} · 已填 ${filled}/81` : game.completed ? '上一题已完成 · 再来一局' : `已填 ${filled}/81 · 用时 ${timeLabel(game.elapsed)}`) : '' };
    },
    get statusText() {
      if (answerVisible) return '正确答案 · 仅供对照，返回题目可继续';
      if (section === 'training') return trainingStatus();
      const difficulty = DIFFICULTIES.find(item => item.id === game.difficulty);
      return `${practiceLessonId ? `整题实战 · ${getLesson(practiceLessonId).label}` : game.mode === 'daily' ? '每日挑战' : '经典数独'} · ${difficulty.label || difficulty.name} · 已填 ${game.board.filter(Boolean).length}/81 · ${timeLabel(game.elapsed)}${game.completed ? ' · 已完成' : game.paused ? ' · 已暂停' : ''}`;
    },
    get musicActive() {
      if (section === 'training') return Boolean(training && training.screen === 'exercise' && training.training && !training.training.completed);
      return !answerVisible && !game.paused && !game.completed;
    },
    get answerVisible() { return answerVisible; },
    get model() { return game; },
    get training() { return training; },
    get section() { return section; },
    get practiceLessonId() { return practiceLessonId; },
    get layout() { return layout; },
  };
}

module.exports = { createSudokuGame, sharedRound };
