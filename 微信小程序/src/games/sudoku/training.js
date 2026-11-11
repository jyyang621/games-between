'use strict';

const { LESSONS, getLesson } = require('./lessons.js');
const { getTrainingExamples } = require('./bank.js');
const { createLogicState, validateStep, findSteps, findStep, applyStep } = require('./logic.js');
const { LearningRecords, findExercise } = require('./learning-records.js');
const { getRecognitionExample, getRecognitionById } = require('./training-recognition.js');

const clone = value => JSON.parse(JSON.stringify(value));
const validCell = index => Number.isInteger(index) && index >= 0 && index < 81;
const validDigit = digit => Number.isInteger(digit) && digit >= 1 && digit <= 9;
const validLesson = id => Boolean(getLesson(id));
const emptyProgress = () => ({ solved: 0, independent: 0 });
const bounded = (value, maximum, fallback = 0) => Number.isInteger(value) ? Math.max(0, Math.min(maximum, value)) : fallback;
const exampleCounts = new Map();
function exampleCount(id) {
  if (!exampleCounts.has(id)) exampleCounts.set(id, getTrainingExamples(id).length);
  return exampleCounts.get(id);
}

class SudokuTraining {
  constructor(saved = null, { now = Date.now } = {}) {
    this.screen = 'catalog'; this.lessonId = LESSONS[0].id;
    this.page = 0; this.lessonPage = 0; this.diagramPage = 0; this.foundationPage = 0;
    this.indices = {}; this.recognitionIndices = {}; this.mixedIndex = 0;
    this.progress = {}; this.learned = []; this.notice = ''; this.training = null;
    this.records = new LearningRecords(null, { now });
    if (saved && [1, 2].includes(saved.schemaVersion)) this.restore(saved);
  }

  examples(id = this.lessonId) { return getTrainingExamples(id); }
  get lesson() {
    const t = this.training;
    if (this.screen === 'exercise' && t && t.hideTechnique && !t.completed) {
      const label = t.sessionMode === 'review' ? '错题复习' : '混合练习';
      return { id: 'mixed', label, action: 'either', tier: 0, summary: '不预告技巧，寻找一个合法突破。',
        principle: '可以使用已学技巧，先选出完整依据，再选择填数或删候选。', steps: [], mistakes: '', example: { lines: [] } };
    }
    return getLesson(this.screen === 'exercise' && t && t.completed && t.answerStep ? t.answerStep.technique : this.lessonId) || getLesson(this.lessonId);
  }
  get learningProgress() { return this.records.summary(); }
  get lessons() {
    return this._lessons(this.learningProgress);
  }
  _lessons(learning) { return LESSONS.map(lesson => ({ ...lesson, available: exampleCount(lesson.id) > 0,
    count: exampleCount(lesson.id), progress: this.progress[lesson.id] || emptyProgress(), learningProgress: learning[lesson.id] })); }
  get view() {
    const learning = this.learningProgress;
    return { screen: this.screen, lesson: this.lesson, lessonId: this.lessonId, page: this.page,
      lessonPage: this.lessonPage, diagramPage: this.diagramPage, foundationPage: this.foundationPage,
      lessons: this._lessons(learning), training: this.training, progress: this.progress, learningProgress: learning,
      learnedIds: this.learned.slice(), reviewCount: this.records.reviewItems().length, notice: this.notice };
  }

  _learn(id) { if (validLesson(id) && !this.learned.includes(id)) this.learned.push(id); }
  _kind(t = this.training) { return t && t.sessionMode === 'recognize' ? 'recognize' : 'practice'; }
  _expose() {
    const t = this.training;
    if (t) this.records.noteExposure(this._kind(t), t.id, { hints: t.hintLevel, demonstrated: t.demonstrated });
  }

  openLesson(id) {
    if (!validLesson(id)) return false;
    this.lessonId = id; this.lessonPage = 0; this.diagramPage = 0; this.screen = 'lesson'; this.notice = '';
    this._learn(id); this._exposeDiagram(2); return true;
  }

  _exposeDiagram(hints = 2) {
    const example = this.examples(this.lessonId)[0];
    if (example) this.records.noteExposure('practice', example.id, { hints });
  }

  _startPreferred(id, mode) {
    // The UI may prefer an unseen position. Direct start()/explicit indices
    // remain stable for shared exercise ids and saved drafts.
    if (mode === 'independent' && validLesson(id)) {
      const examples = this.examples(id), fresh = examples.findIndex(item => !this.records.isExposed(item.id));
      if (fresh >= 0) this.indices[id] = fresh;
    }
    return this.start(id, mode);
  }

  _load(example, { mode = 'independent', sessionMode = 'practice', allowedTechniques = null } = {}) {
    if (!example) return false;
    this.lessonId = example.technique; this._learn(example.technique);
    const hidden = sessionMode === 'mixed' || sessionMode === 'review';
    this.training = {
      id: example.id, sourcePuzzleId: example.sourcePuzzleId, technique: example.technique,
      board: example.board.slice(), candidates: example.candidates.slice(), step: clone(example.step),
      selected: -1, selectedCells: [], selectedEliminations: [], inputMode: 'support',
      value: null, placementIndex: -1, mode, sessionMode, stage: 'solve', completed: false,
      hideTechnique: hidden, showTechniqueName: !hidden,
      allowedTechniques: allowedTechniques ? allowedTechniques.slice() : [example.technique],
      hintLevel: mode === 'guided' ? 2 : 0, feedback: '', attempts: 0, demonstrated: false, filterDigit: 0,
    };
    this.screen = 'exercise'; this.notice = ''; this._expose(); return true;
  }

  start(id = this.lessonId, mode = 'independent', advance = false) {
    if (!validLesson(id) || !['guided', 'independent'].includes(mode)) return false;
    const examples = this.examples(id);
    if (!examples.length) return false;
    const offset = (this.indices[id] || 0) + (advance ? 1 : 0);
    this.indices[id] = offset % examples.length;
    return this._load(examples[this.indices[id]], { mode });
  }

  startMixed(advance = false) {
    const learned = this.learned.length ? this.learned.slice() : ['naked-single', 'hidden-single'];
    for (const id of learned) this._learn(id);
    const groups = learned.filter(validLesson).map(id => this.examples(id));
    const pool = [];
    for (let i = 0; i < Math.max(0, ...groups.map(group => group.length)); i += 1) for (const group of groups) if (group[i]) pool.push(group[i]);
    if (!pool.length) return false;
    this.mixedIndex = (this.mixedIndex + (advance ? 1 : 0)) % pool.length;
    return this._load(pool[this.mixedIndex], { sessionMode: 'mixed', allowedTechniques: learned });
  }

  startRecognition(id = this.lessonId, advance = false, explicitId = null, { restoring = false } = {}) {
    if (!validLesson(id)) return false;
    const offset = (this.recognitionIndices[id] || 0) + (advance ? 1 : 0);
    const recognition = explicitId ? getRecognitionById(explicitId) : getRecognitionExample(id, offset);
    if (!recognition || recognition.technique !== id) return false;
    const previouslyShown = this.records.isExposed(recognition.exerciseId);
    this.recognitionIndices[id] = offset;
    this._load(recognition, { sessionMode: 'recognize' });
    Object.assign(this.training, { claim: recognition.claim, claimStep: clone(recognition.claimStep), judgment: null,
      recognitionExplanation: recognition.explanation });
    if (previouslyShown && !restoring) this.records.noteExposure('recognize', recognition.id, { hints: 2 });
    // A proposed proof is already a substantial cue about this exact position.
    // It must not become an unseen independent application card afterwards.
    this.records.noteExposure('practice', recognition.exerciseId, { hints: 2 });
    return true;
  }

  startReview() {
    const item = this.records.reviewItems()[0];
    if (!item) {
      this.notice = '暂时没有错题或到期复习。可以先做独立练习或混合练习。';
      if (this.training && this.training.completed) this.training.feedback = this.notice;
      return false;
    }
    if (item.kind === 'recognize') {
      const changed = this.startRecognition(item.technique, false, item.id);
      if (changed) { this.training.fromReview = true; this.training.reviewReason = item.reason; }
      return changed;
    }
    const example = findExercise(item.id);
    if (!example) return false;
    const learned = [...new Set([...this.learned, item.technique])];
    const changed = this._load(example, { sessionMode: 'review', allowedTechniques: learned });
    if (changed) this.training.reviewReason = item.reason;
    return changed;
  }

  submission(technique = this.training && this.training.technique) {
    const t = this.training;
    if (!t) return null;
    return { technique, cells: t.selectedCells.slice(), eliminations: clone(t.selectedEliminations),
      placements: validCell(t.placementIndex) && validDigit(t.value) ? [{ index: t.placementIndex, value: t.value }] : [] };
  }

  matchingStep() {
    const t = this.training;
    if (!t || t.sessionMode === 'recognize') return null;
    const state = createLogicState(t.board, t.candidates), cells = t.selectedCells.slice().sort((a, b) => a - b);
    const allowed = t.allowedTechniques || [t.technique];
    return findSteps(state).filter(step => allowed.includes(step.technique)).find(step => {
      const submitted = this.submission(step.technique);
      return step.cells.length === cells.length && step.cells.every((cell, i) => cell === cells[i]) && validateStep(state, submitted);
    }) || null;
  }

  isValidSubmission() { return Boolean(this.matchingStep()); }

  check() {
    const t = this.training;
    if (!t || t.completed || t.sessionMode === 'recognize') return false;
    t.attempts += 1;
    const accepted = this.matchingStep();
    const response = this.submission(accepted ? accepted.technique : t.technique);
    this.records.recordAttempt('practice', t.id, { response, hints: t.hintLevel, mode: t.mode, demonstrated: t.demonstrated });
    if (!t.selectedCells.length) { t.feedback = '先选出支持这次推理的格子。'; return true; }
    if (!accepted) { t.feedback = '这组依据与操作还不符合规则。检查完整的候选结构，并确认没有多删一个候选。'; return true; }
    t.completed = true; t.stage = 'complete'; t.answerStep = clone(accepted); t.acceptedSubmission = response;
    t.hideTechnique = false; t.showTechniqueName = true;
    const creditId = ['mixed', 'review'].includes(t.sessionMode) ? accepted.technique : this.lessonId;
    const previous = this.progress[creditId] || emptyProgress();
    this.progress[creditId] = {
      solved: Math.min(99999, previous.solved + (t.demonstrated ? 0 : 1)),
      independent: Math.min(99999, previous.independent + (t.mode === 'independent' && t.hintLevel === 0 && !t.demonstrated ? 1 : 0)),
    };
    t.feedback = t.demonstrated ? '示范完成。下一题试着自己找到这一步。' : `${t.mode === 'independent' && !t.hintLevel ? '独立推理正确！' : '推理正确！'}${accepted.explanation}`;
    return true;
  }

  judge(value) {
    const t = this.training;
    if (!t || t.completed || t.sessionMode !== 'recognize' || typeof value !== 'boolean') return false;
    const valid = validateStep(createLogicState(t.board, t.candidates), t.claimStep);
    t.judgment = value; t.attempts += 1;
    this.records.recordAttempt('recognize', t.id, { judgment: value, hints: t.hintLevel, mode: t.mode, demonstrated: t.demonstrated });
    if (valid !== value) { t.feedback = '再检查完整候选与支撑格。问题是这组依据能否推出提议操作，不是猜最终答案。'; return true; }
    t.completed = true; t.stage = 'complete'; t.answerStep = clone(t.step);
    t.feedback = t.recognitionExplanation;
    return true;
  }

  continueReasoning() {
    const t = this.training;
    if (!t || !t.completed || t.continuation && t.continuation.done) return false;
    const state = createLogicState(t.board, t.candidates);
    let step;
    if (!t.continuation) {
      const source = this._kind(t) === 'recognize' ? getRecognitionById(t.id) : findExercise(t.id);
      if (!source) return false;
      t.answerHintLevel = t.hintLevel;
      t.continuation = { index: 0, steps: [], lastStep: null, done: false,
        fromRejectedClaim: this._kind(t) === 'recognize' && source.valid === false };
      step = this._kind(t) === 'recognize' ? source.step : { ...clone(t.answerStep), ...clone(t.acceptedSubmission || this.submission(t.answerStep.technique)) };
    } else step = findStep(state);
    if (!step || !applyStep(state, step)) {
      t.continuation.done = true;
      t.feedback = state.board.includes(0) ? '当前已支持的逻辑没有下一步。推演在这里停止，不会猜数。' : '这个局面已经解完。';
      return true;
    }
    t.board = state.board.slice(); t.candidates = state.candidates.slice();
    t.continuation.steps.push(clone(step)); t.continuation.index += 1; t.continuation.lastStep = clone(step);
    t.continuation.done = t.continuation.index >= 4 || !state.board.includes(0);
    t.answerStep = clone(step); t.hintLevel = 3;
    const prefix = t.continuation.index === 1 ? t.continuation.fromRejectedClaim ? '原提议未执行。换一组正确依据：' : '应用这一步：' : '接着推理：';
    t.feedback = `${prefix}${step.explanation}${t.continuation.done ? ' 本次推演结束，可以继续下一题。' : ''}`;
    return true;
  }

  recordFullPuzzle(record) { return this.records.recordFullPuzzle(record); }

  activate(action, payload) {
    if (action === 'lesson') return this.openLesson(payload);
    if (action === 'foundationBasics') { this.screen = 'foundation'; this.foundationPage = 0; this.notice = ''; return true; }
    if (action === 'foundationPage') { this.foundationPage = bounded(this.foundationPage + (payload === -1 ? -1 : 1), 3); return true; }
    if (action === 'foundationComplete') { this.screen = 'catalog'; return true; }
    if (action === 'lessonDiagram') { this.diagramPage = bounded(this.diagramPage + (payload === -1 ? -1 : 1), 2); this._exposeDiagram(this.diagramPage === 2 ? 3 : 2); return true; }
    if (action === 'coursePage') { this.page = bounded(this.page + (payload === -1 ? -1 : 1), Math.ceil(LESSONS.length / 4) - 1); return true; }
    if (action === 'lessonPage') { this.lessonPage = bounded(this.lessonPage + (payload === -1 ? -1 : 1), 2); return true; }
    if (action === 'practice') return this._startPreferred(payload && payload.id, payload && payload.mode || 'independent');
    if (action === 'trainingMixed') return this.startMixed();
    if (action === 'trainingReview') return this.startReview() || Boolean(this.notice);
    if (action === 'trainingRecognize') return this.startRecognition(typeof payload === 'string' ? payload : this.lessonId);
    if (action === 'trainingBack') {
      if (this.screen === 'exercise') this.screen = this.training && (['mixed', 'review'].includes(this.training.sessionMode) || this.training.fromReview) ? 'catalog' : 'lesson';
      else this.screen = 'catalog';
      return true;
    }
    const t = this.training;
    if (!t || this.screen !== 'exercise') return false;
    if (action === 'trainingNext') {
      if (t.fromReview || t.sessionMode === 'review') return this.startReview() || Boolean(this.notice);
      if (t.sessionMode === 'mixed') return this.startMixed(true);
      if (t.sessionMode === 'recognize') return this.startRecognition(this.lessonId, true);
      return this.start(this.lessonId, t.mode, true);
    }
    if (action === 'trainingContinue') return this.continueReasoning();
    if (action === 'trainingFilter' && Number.isInteger(payload) && payload >= 0 && payload <= 9) { t.filterDigit = payload; return true; }
    if (action === 'trainingJudge') return this.judge(payload);
    if (action === 'trainingHint' && !t.completed) { t.hintLevel = Math.min(3, t.hintLevel + 1); t.feedback = ''; this._expose(); return true; }
    if (action === 'trainingDemo' && !t.completed) {
      t.hintLevel = 3; t.demonstrated = true; this._expose();
      if (t.sessionMode === 'recognize') return this.judge(validateStep(createLogicState(t.board, t.candidates), t.claimStep));
      t.selectedCells = t.step.cells.slice(); t.selectedEliminations = clone(t.step.eliminations);
      if (t.step.placements.length) { t.placementIndex = t.step.placements[0].index; t.value = t.step.placements[0].value; }
      return this.check();
    }
    if (action === 'trainingCheck') return this.check();
    if (t.completed || t.sessionMode === 'recognize') return false;
    if (action === 'trainingMode' && ['support', 'eliminate', 'place'].includes(payload)) { t.inputMode = payload; t.feedback = ''; return true; }
    if (action === 'trainingCell' && validCell(payload)) {
      t.selected = payload;
      if (t.inputMode === 'support' && !t.board[payload]) t.selectedCells = t.selectedCells.includes(payload) ? t.selectedCells.filter(index => index !== payload) : t.selectedCells.concat(payload).sort((a, b) => a - b);
      t.feedback = ''; return true;
    }
    if (action === 'trainingCandidate' && payload && validCell(payload.index) && validDigit(payload.digit)) {
      t.selected = payload.index;
      if (t.inputMode === 'support') return this.activate('trainingCell', payload.index);
      return this.activate('trainingDigit', payload.digit);
    }
    if (action === 'trainingDigit' && validCell(t.selected) && !t.board[t.selected] && validDigit(payload)) {
      if (!(t.candidates[t.selected] & (1 << (payload - 1)))) return false;
      if (t.inputMode === 'eliminate') {
        const existing = t.selectedEliminations.find(item => item.index === t.selected && item.digit === payload);
        t.selectedEliminations = existing ? t.selectedEliminations.filter(item => item !== existing) : t.selectedEliminations.concat({ index: t.selected, digit: payload });
      } else if (t.inputMode === 'place') { t.placementIndex = t.selected; t.value = payload; }
      else return false;
      t.feedback = ''; return true;
    }
    return false;
  }

  serialize() {
    const t = this.training;
    return { schemaVersion: 2, screen: this.screen, lessonId: this.lessonId, page: this.page,
      lessonPage: this.lessonPage, diagramPage: this.diagramPage, foundationPage: this.foundationPage,
      indices: { ...this.indices }, recognitionIndices: { ...this.recognitionIndices }, mixedIndex: this.mixedIndex,
      learned: this.learned.slice(), progress: clone(this.progress), learning: this.records.serialize(),
      exercise: t ? { id: t.id, mode: t.mode, sessionMode: t.sessionMode, fromReview: Boolean(t.fromReview),
        allowedTechniques: t.allowedTechniques.slice(), selected: t.selected, selectedCells: t.selectedCells.slice(),
        selectedEliminations: clone(t.selectedEliminations), value: t.value, placementIndex: t.placementIndex, inputMode: t.inputMode,
        completed: t.completed, hintLevel: t.continuation ? t.answerHintLevel : t.hintLevel, demonstrated: t.demonstrated, attempts: t.attempts,
        filterDigit: t.filterDigit, judgment: t.judgment, continuationCount: t.continuation ? t.continuation.index : 0 } : null };
  }

  restore(saved) {
    if (!saved || ![1, 2].includes(saved.schemaVersion) || !validLesson(saved.lessonId)) return false;
    this.lessonId = saved.lessonId; this.page = bounded(saved.page, Math.ceil(LESSONS.length / 4) - 1);
    this.lessonPage = bounded(saved.lessonPage, 2); this.diagramPage = bounded(saved.diagramPage, 2); this.foundationPage = bounded(saved.foundationPage, 3);
    this.learned = Array.isArray(saved.learned) ? [...new Set(saved.learned.filter(validLesson))] : [this.lessonId];
    this.indices = {}; this.recognitionIndices = {}; this.progress = {}; this.training = null; this.notice = '';
    this.mixedIndex = Number.isSafeInteger(saved.mixedIndex) && saved.mixedIndex >= 0 ? saved.mixedIndex : 0;
    if (saved.schemaVersion === 2 && saved.learning) this.records.restore(saved.learning);
    for (const lesson of LESSONS) {
      const offset = saved.indices && saved.indices[lesson.id];
      if (Number.isSafeInteger(offset) && offset >= 0) this.indices[lesson.id] = offset;
      const recognition = saved.recognitionIndices && saved.recognitionIndices[lesson.id];
      if (Number.isSafeInteger(recognition) && recognition >= 0) this.recognitionIndices[lesson.id] = recognition;
      const record = saved.progress && saved.progress[lesson.id];
      if (record && Number.isSafeInteger(record.solved) && record.solved >= 0 && Number.isSafeInteger(record.independent) && record.independent >= 0) this.progress[lesson.id] = { solved: Math.min(99999, record.solved), independent: Math.min(99999, record.independent, record.solved) };
    }
    const draft = saved.exercise;
    if (draft && typeof draft.id === 'string') {
      const session = ['practice', 'mixed', 'review', 'recognize'].includes(draft.sessionMode) ? draft.sessionMode : 'practice';
      if (session === 'recognize') {
        const recognition = getRecognitionById(draft.id);
        if (recognition) this.startRecognition(recognition.technique, false, recognition.id, { restoring: true });
      } else {
        const source = findExercise(draft.id);
        if (source && (session !== 'practice' || source.technique === this.lessonId)) {
          const allowed = Array.isArray(draft.allowedTechniques) ? draft.allowedTechniques.filter(id => validLesson(id) && this.learned.includes(id)) : [];
          this._load(source, { mode: draft.mode === 'guided' ? 'guided' : 'independent', sessionMode: session,
            allowedTechniques: session === 'practice' ? [source.technique] : [...new Set([...allowed, source.technique])] });
          const index = this.examples(source.technique).findIndex(item => item.id === source.id);
          if (index >= 0) this.indices[source.technique] = index;
        }
      }
      const t = this.training;
      if (t) {
        if (Array.isArray(draft.selectedCells) && draft.selectedCells.length <= 81) t.selectedCells = [...new Set(draft.selectedCells.filter(validCell))];
        if (Array.isArray(draft.selectedEliminations) && draft.selectedEliminations.length <= 729) {
          const seen = new Set();
          t.selectedEliminations = draft.selectedEliminations.filter(item => {
            if (!item || !validCell(item.index) || !validDigit(item.digit) || !(t.candidates[item.index] & (1 << (item.digit - 1)))) return false;
            const key = `${item.index}:${item.digit}`; if (seen.has(key)) return false; seen.add(key); return true;
          }).map(item => ({ index: item.index, digit: item.digit }));
        }
        t.selected = validCell(draft.selected) ? draft.selected : -1; t.placementIndex = validCell(draft.placementIndex) ? draft.placementIndex : -1;
        t.value = validDigit(draft.value) ? draft.value : null; t.inputMode = ['support', 'eliminate', 'place'].includes(draft.inputMode) ? draft.inputMode : 'support';
        t.hintLevel = Math.max(t.mode === 'guided' ? 2 : 0, bounded(draft.hintLevel, 3)); t.filterDigit = bounded(draft.filterDigit, 9);
        t.demonstrated = draft.demonstrated === true; t.attempts = bounded(draft.attempts, 99999); t.fromReview = draft.fromReview === true;
        t.judgment = typeof draft.judgment === 'boolean' ? draft.judgment : null; this._expose();
        if (session === 'recognize') {
          t.completed = draft.completed === true && t.judgment !== null && validateStep(createLogicState(t.board, t.candidates), t.claimStep) === t.judgment;
          if (t.completed) { t.answerStep = clone(t.step); t.feedback = t.recognitionExplanation; }
        } else {
          const accepted = this.matchingStep(); t.completed = draft.completed === true && Boolean(accepted);
          if (t.completed) { t.answerStep = clone(accepted); t.acceptedSubmission = this.submission(accepted.technique); t.feedback = '这一题已完成，可以继续下一题。'; t.hideTechnique = false; t.showTechniqueName = true; }
        }
        if (t.completed) {
          t.stage = 'complete';
          for (let i = 0; i < bounded(draft.continuationCount, 4); i += 1) if (!this.continueReasoning()) break;
        }
      }
    }
    this.screen = ['catalog', 'lesson', 'exercise', 'foundation'].includes(saved.screen) && (saved.screen !== 'exercise' || this.training) ? saved.screen : 'catalog';
    return true;
  }
}

module.exports = { SudokuTraining };
