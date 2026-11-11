'use strict';

const { TECHNIQUES, createLogicState, validateStep } = require('./logic.js');
const { getTrainingExamples, getPuzzle } = require('./bank.js');
const { getRecognitionById } = require('./training-recognition.js');
const clone = value => JSON.parse(JSON.stringify(value));
const validTechnique = id => TECHNIQUES.some(item => item.id === id);
const validIndex = index => Number.isInteger(index) && index >= 0 && index < 81;
const validDigit = digit => Number.isInteger(digit) && digit >= 1 && digit <= 9;
const finiteTime = value => Number.isSafeInteger(value) && value >= 0;
const DAY = 86400000;
let exerciseCache = null;

function lookupExercise(id) {
  if (!exerciseCache) exerciseCache = new Map(TECHNIQUES.flatMap(technique => getTrainingExamples(technique.id)).map(item => [item.id, item]));
  return exerciseCache.get(id) || null;
}
const trustedQuestion = (kind, id) => kind === 'recognize' ? getRecognitionById(id) : lookupExercise(id);

function findExercise(id) {
  if (typeof id !== 'string' || id.length > 200) return null;
  const exercise = lookupExercise(id);
  return exercise ? clone(exercise) : null;
}

function situationKey(exercise) {
  // Store/compare the full position instead of a hash: collisions cannot turn
  // cosmetic duplicates into separate mastery credit.
  return `${exercise.board.join('')}:${exercise.candidates.join(',')}`;
}

function cleanSubmission(value, fallback) {
  const result = { technique: validTechnique(value && value.technique) ? value.technique : fallback, cells: [], placements: [], eliminations: [] };
  if (!value || typeof value !== 'object' || !validTechnique(value.technique) || !Array.isArray(value.cells) || value.cells.length > 81 ||
    !Array.from(value.cells).every(validIndex) || !Array.isArray(value.placements) || value.placements.length > 81 ||
    !Array.from(value.placements).every(item => item && validIndex(item.index) && validDigit(item.value)) ||
    !Array.isArray(value.eliminations) || value.eliminations.length > 729 ||
    !Array.from(value.eliminations).every(item => item && validIndex(item.index) && validDigit(item.digit))) return null;
  result.cells = value.cells.slice().sort((a, b) => a - b);
  result.placements = value.placements.map(item => ({ index: item.index, value: item.value }));
  result.eliminations = value.eliminations.map(item => ({ index: item.index, digit: item.digit }));
  return result;
}

function cleanEvent(event, question, kind) {
  if (!event || !finiteTime(event.at) || !Number.isInteger(event.hints) || event.hints < 0 || event.hints > 3 ||
    !['guided', 'independent'].includes(event.mode) || typeof event.demonstrated !== 'boolean') return null;
  if (kind === 'recognize') {
    if (typeof event.judgment !== 'boolean') return null;
    return { at: event.at, hints: event.hints, mode: event.mode, demonstrated: event.demonstrated,
      judgment: event.judgment, correct: event.judgment === question.valid };
  }
  const response = cleanSubmission(event.response, question.technique);
  if (!response) return null;
  const correct = validateStep(createLogicState(question.board, question.candidates), response);
  return { at: event.at, hints: event.hints, mode: event.mode, demonstrated: event.demonstrated, response, correct };
}

class LearningRecords {
  constructor(saved = null, { now = Date.now } = {}) {
    this._now = typeof now === 'function' ? now : Date.now;
    this.items = Object.create(null);
    this.fullPuzzles = Object.create(null);
    if (saved) this.restore(saved);
  }

  now() { const value = this._now(); return Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0; }

  isExposed(id) {
    const record = this.items[`practice:${id}`];
    return Boolean(record && (record.maxHintLevel || record.demonstratedBeforeFirst || record.events.length));
  }

  ensure(kind, question) {
    const key = `${kind}:${question.id}`;
    if (!this.items[key]) this.items[key] = { id: key, kind, exerciseId: question.id, technique: question.technique,
      firstSeenAt: this.now(), hintedBeforeFirst: false, demonstratedBeforeFirst: false, maxHintLevel: 0, events: [] };
    return this.items[key];
  }

  noteExposure(kind, id, { hints = 0, demonstrated = false } = {}) {
    const question = trustedQuestion(kind, id);
    if (!question) return false;
    const record = this.ensure(kind, question);
    const level = Number.isInteger(hints) ? Math.max(0, Math.min(3, hints)) : 0;
    record.maxHintLevel = Math.max(record.maxHintLevel, level);
    if (!record.events.length) {
      if (level) record.hintedBeforeFirst = true;
      if (demonstrated) record.demonstratedBeforeFirst = true;
    }
    return true;
  }

  recordAttempt(kind, id, input) {
    const question = trustedQuestion(kind, id);
    if (!question) return false;
    const event = cleanEvent({ ...input, at: this.now() }, question, kind);
    if (!event) return false;
    const record = this.ensure(kind, question);
    this.noteExposure(kind, id, event);
    record.events.push(event);
    // Keep the first answer permanently; bound repeat activity storage.
    if (record.events.length > 32) record.events.splice(1, record.events.length - 32);
    return true;
  }

  nextReviewAt(record) {
    const last = record.events[record.events.length - 1];
    if (!last) return record.maxHintLevel ? record.firstSeenAt + DAY / 2 : null;
    if (!last.correct) return last.at;
    if (last.hints || last.demonstrated || last.mode === 'guided') return last.at + DAY / 2;
    let successes = 0;
    for (let i = record.events.length - 1; i >= 0; i -= 1) {
      const event = record.events[i];
      if (!event.correct || event.hints || event.demonstrated || event.mode === 'guided') break;
      successes += 1;
    }
    return last.at + [1, 3, 7, 14][Math.min(3, Math.max(0, successes - 1))] * DAY;
  }

  reviewItems() {
    const now = this.now();
    return Object.values(this.items).map(record => {
      const last = record.events[record.events.length - 1];
      const dueAt = this.nextReviewAt(record);
      return { id: record.exerciseId, kind: record.kind, technique: record.technique, dueAt,
        wrong: Boolean(last && !last.correct), reason: last && !last.correct ? 'wrong' : 'due' };
    }).filter(item => item.dueAt !== null && (item.wrong || item.dueAt <= now)).sort((a, b) =>
      Number(b.wrong) - Number(a.wrong) || a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  }

  summary() {
    const pending = this.reviewItems();
    const result = Object.fromEntries(TECHNIQUES.map(item => [item.id, { seen: 0, uniqueSolved: 0, uniqueIndependent: 0,
      firstTry: 0, wrong: 0, hinted: 0, reviewDue: 0, recognitionSolved: 0, recognitionCorrect: 0,
      reviewedIndependent: 0, fullPuzzle: 0, fullPuzzleUnhinted: 0 }]));
    const sets = Object.fromEntries(TECHNIQUES.map(item => [item.id, { solved: new Set(), independent: new Set(), first: new Set(), reviewed: new Set() }]));
    for (const record of Object.values(this.items)) {
      const question = trustedQuestion(record.kind, record.exerciseId);
      if (!question || !result[record.technique]) continue;
      const stats = result[record.technique]; stats.seen += 1;
      stats.wrong += record.events.filter(event => !event.correct).length;
      if (record.maxHintLevel) stats.hinted += 1;
      const first = record.events[0], earned = record.events.filter(event => event.correct && !event.demonstrated);
      if (record.kind === 'recognize') {
        if (earned.length) stats.recognitionSolved += 1;
        if (first && first.correct && !first.hints && !first.demonstrated && !record.hintedBeforeFirst && !record.demonstratedBeforeFirst) stats.recognitionCorrect += 1;
        continue;
      }
      const position = situationKey(question);
      for (const event of earned) {
        const skill = event.response.technique, credit = sets[skill];
        if (!credit) continue;
        credit.solved.add(position);
        if (!event.hints && event.mode === 'independent') credit.reviewed.add(position);
      }
      if (first && first.correct && !first.demonstrated) {
        const credit = sets[first.response.technique];
        if (credit) {
          credit.first.add(position);
          if (!first.hints && first.mode === 'independent' && !record.hintedBeforeFirst && !record.demonstratedBeforeFirst) credit.independent.add(position);
        }
      }
    }
    for (const [id, set] of Object.entries(sets)) Object.assign(result[id], {
      uniqueSolved: set.solved.size, uniqueIndependent: set.independent.size, firstTry: set.first.size, reviewedIndependent: set.reviewed.size,
      reviewDue: pending.filter(item => item.technique === id).length,
    });
    for (const record of Object.values(this.fullPuzzles)) {
      const stats = result[record.lessonId];
      if (!stats) continue;
      stats.fullPuzzle += 1;
      if (record.hints === 0) stats.fullPuzzleUnhinted += 1;
    }
    return result;
  }

  recordFullPuzzle({ id, lessonId, hints, elapsed } = {}) {
    const puzzle = getPuzzle(id);
    if (!puzzle || !validTechnique(lessonId) || !puzzle.profile || !puzzle.profile.techniqueCounts[lessonId] ||
      !Number.isSafeInteger(hints) || hints < 0 || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > Number.MAX_SAFE_INTEGER) return false;
    const key = `${lessonId}:${id}`, previous = this.fullPuzzles[key];
    if (previous) return false;
    this.fullPuzzles[key] = { id, lessonId, hints, elapsed, completedAt: this.now() };
    return true;
  }

  serialize() {
    return { schemaVersion: 1, items: Object.values(this.items).map(record => ({ ...clone(record),
      firstAnswer: record.events.length ? clone(record.events[0]) : null, nextReviewAt: this.nextReviewAt(record) })), fullPuzzles: clone(Object.values(this.fullPuzzles)) };
  }

  restore(saved) {
    if (!saved || saved.schemaVersion !== 1) return false;
    const items = Object.create(null), fullPuzzles = Object.create(null);
    if (Array.isArray(saved.items) && saved.items.length <= 2000) for (const stored of saved.items) {
      if (!stored || !['practice', 'recognize'].includes(stored.kind) || !finiteTime(stored.firstSeenAt) ||
        !Array.isArray(stored.events) || stored.events.length > 32) continue;
      const question = trustedQuestion(stored.kind, stored.exerciseId);
      if (!question) continue;
      const events = stored.events.map(event => cleanEvent(event, question, stored.kind)).filter(Boolean);
      // Do not silently turn a damaged first answer into a later first success.
      if (events.length !== stored.events.length || events.some((event, index) => event.at < stored.firstSeenAt || index && event.at < events[index - 1].at)) continue;
      const key = `${stored.kind}:${question.id}`;
      if (items[key]) continue;
      items[key] = { id: key, kind: stored.kind, exerciseId: question.id, technique: question.technique,
        firstSeenAt: stored.firstSeenAt, hintedBeforeFirst: stored.hintedBeforeFirst === true,
        demonstratedBeforeFirst: stored.demonstratedBeforeFirst === true,
        maxHintLevel: Number.isInteger(stored.maxHintLevel) ? Math.max(0, Math.min(3, stored.maxHintLevel)) : 0, events };
    }
    this.items = items;
    this.fullPuzzles = fullPuzzles;
    if (Array.isArray(saved.fullPuzzles) && saved.fullPuzzles.length <= 2000) for (const stored of saved.fullPuzzles) {
      if (!stored || !finiteTime(stored.completedAt)) continue;
      if (this.recordFullPuzzle(stored)) this.fullPuzzles[`${stored.lessonId}:${stored.id}`].completedAt = stored.completedAt;
    }
    return true;
  }
}

module.exports = { LearningRecords, findExercise, situationKey };
