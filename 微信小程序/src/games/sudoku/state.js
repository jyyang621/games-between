'use strict';

const { DIFFICULTIES, generatePuzzle, getAllCandidates, isComplete, dailySeed } = require('./core/engine.js');

const HISTORY_LIMIT = 100;
const SAVE_VERSION = 1;
const emptyNotes = () => Array.from({ length: 81 }, () => []);
const copyNotes = notes => notes.map(list => list.slice());
const validDifficulty = value => DIFFICULTIES.some(item => item.id === value);
const validMode = value => value === 'classic' || value === 'daily';
const validIndex = value => Number.isInteger(value) && value >= 0 && value < 81;
const validSelected = value => value === -1 || validIndex(value);
const validBoard = value => Array.isArray(value) && value.length === 81 &&
  Array.from(value).every(digit => Number.isInteger(digit) && digit >= 0 && digit <= 9);
const sameBoard = (a, b) => a.every((digit, index) => digit === b[index]);
const sameHouse = (a, b) => Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
  (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor(a % 9 / 3) === Math.floor(b % 9 / 3));

function validSeed(seed) {
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 80 || /[\u0000-\u001f\u007f]/.test(seed)) return false;
  // Reject lone UTF-16 surrogates before encoding a shared puzzle query.
  try { encodeURIComponent(seed); return true; } catch { return false; }
}

function validNotes(notes, board) {
  return Array.isArray(notes) && notes.length === 81 && Array.from(notes).every((list, index) =>
    Array.isArray(list) && list.length <= 9 && (!board[index] || list.length === 0) &&
    Array.from(list).every(digit => Number.isInteger(digit) && digit >= 1 && digit <= 9) &&
    new Set(list).size === list.length);
}

function validFillNotes(snapshot) {
  if (snapshot.fillNotesActive === undefined && snapshot.notesBeforeFill === undefined) return true;
  return typeof snapshot.fillNotesActive === 'boolean' && (snapshot.fillNotesActive
    ? validNotes(snapshot.notesBeforeFill, snapshot.board)
    : snapshot.notesBeforeFill == null);
}

function validSnapshot(snapshot, puzzle) {
  return snapshot != null && typeof snapshot === 'object' && validBoard(snapshot.board) &&
    puzzle.every((digit, index) => !digit || snapshot.board[index] === digit) &&
    validNotes(snapshot.notes, snapshot.board) && validSelected(snapshot.selected) &&
    typeof snapshot.noteMode === 'boolean' && validFillNotes(snapshot);
}

function cloneSnapshot(snapshot) {
  return {
    board: snapshot.board.slice(), notes: copyNotes(snapshot.notes),
    selected: snapshot.selected, noteMode: snapshot.noteMode,
    fillNotesActive: snapshot.fillNotesActive === true,
    notesBeforeFill: snapshot.fillNotesActive === true ? copyNotes(snapshot.notesBeforeFill) : null,
  };
}

/** Platform-independent game state. Only the host supplies foreground time. */
class SudokuGame {
  constructor({ seed, difficulty = 'easy', mode = 'classic', now = Date.now, saved = null } = {}) {
    this._now = typeof now === 'function' ? now : Date.now;
    this._roundSequence = 0;
    this.state = null;
    if (saved && this.restore(saved)) return;
    const safeMode = validMode(mode) ? mode : 'classic';
    const safeDifficulty = validDifficulty(difficulty) ? difficulty : 'easy';
    const safeSeed = validSeed(seed) ? seed : safeMode === 'daily'
      ? dailySeed(new Date(this._clock())) : this._newSeed();
    this.start(safeSeed, safeDifficulty, safeMode);
  }

  _clock() {
    const value = this._now();
    return Number.isFinite(value) ? value : 0;
  }

  _newSeed() {
    return `${Math.floor(this._clock()).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  _roundId() {
    this._roundSequence += 1;
    return `${Math.floor(this._clock()).toString(36)}-${Math.random().toString(36).slice(2, 12)}-${this._roundSequence}`;
  }

  _snapshot() {
    this.history.push(cloneSnapshot(this.state));
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  _editable() {
    return !this.paused && !this.completed && validIndex(this.selected) && !this.puzzle[this.selected];
  }

  _cleanPeerNotes(index, digit) {
    const clean = notes => notes.map((list, other) => sameHouse(index, other)
      ? list.filter(value => value !== digit) : list);
    this.state.notes = clean(this.notes);
    if (this.fillNotesActive) this.state.notesBeforeFill = clean(this.state.notesBeforeFill);
  }

  _checkComplete() {
    // Generation guarantees uniqueness; compare with that solution as well as
    // validating the full grid, rather than treating a merely full board as won.
    this.state.completed = sameBoard(this.board, this.solution) && isComplete(this.board);
    if (this.completed) this.state.paused = false;
  }

  select(index) {
    if (!validIndex(index) || this.paused || this.completed || this.selected === index) return false;
    this.state.selected = index;
    return true;
  }

  input(digit) {
    if (!this._editable() || !Number.isInteger(digit) || digit < 1 || digit > 9) return false;
    const index = this.selected;
    if (this.noteMode) {
      if (this.board[index]) return false;
      this._snapshot();
      const list = this.notes[index];
      this.state.notes[index] = list.includes(digit) ? list.filter(value => value !== digit)
        : list.concat(digit).sort((a, b) => a - b);
      if (this.fillNotesActive) {
        const manual = this.state.notesBeforeFill[index].filter(value => value !== digit);
        this.state.notesBeforeFill[index] = list.includes(digit) ? manual : manual.concat(digit).sort((a, b) => a - b);
      }
    } else {
      if (this.board[index] === digit) return false;
      this._snapshot();
      this.state.board[index] = digit;
      this.state.notes[index] = [];
      if (this.fillNotesActive) this.state.notesBeforeFill[index] = [];
      this._cleanPeerNotes(index, digit);
      this._checkComplete();
    }
    return true;
  }

  erase() {
    if (!this._editable() || (!this.board[this.selected] && !this.notes[this.selected].length)) return false;
    this._snapshot();
    this.state.board[this.selected] = 0;
    this.state.notes[this.selected] = [];
    if (this.fillNotesActive) this.state.notesBeforeFill[this.selected] = [];
    return true;
  }

  undo() {
    if (this.paused || !this.history.length) return false;
    const previous = this.history.pop();
    this.state.board = previous.board;
    this.state.notes = previous.notes;
    this.state.selected = previous.selected;
    this.state.noteMode = previous.noteMode;
    this.state.fillNotesActive = previous.fillNotesActive === true;
    this.state.notesBeforeFill = this.state.fillNotesActive ? previous.notesBeforeFill : null;
    // Hints, elapsed time and answer exposure deliberately survive undo.
    this._checkComplete();
    return true;
  }

  toggleNotes() {
    if (this.paused || this.completed) return false;
    this.state.noteMode = !this.noteMode;
    return true;
  }

  _fillNotesState(board = this.board) {
    return { notes: getAllCandidates(board) };
  }

  // Keep the recompute API for lesson/logic callers; the toolbar uses the toggle.
  fillAllNotes() {
    if (this.paused || this.completed || !this.board.includes(0)) return false;
    const next = this._fillNotesState();
    const notes = next.notes;
    if (notes.every((list, index) => list.length === this.notes[index].length &&
      list.every((digit, offset) => digit === this.notes[index][offset]))) return false;
    this._snapshot();
    Object.assign(this.state, next);
    return true;
  }

  toggleFillAllNotes() {
    if (this.paused || this.completed || !this.board.includes(0)) return false;
    const next = this._fillNotesState();
    this._snapshot();
    if (this.fillNotesActive) {
      // Restore the user's marks, including mistakes. Actual placements and
      // proved eliminations maintain this backup when they happen.
      const restored = this._manualNotesAfterFill(next);
      Object.assign(this.state, next, { notes: restored, fillNotesActive: false, notesBeforeFill: null });
    } else {
      const manual = copyNotes(this.notes);
      Object.assign(this.state, next, { fillNotesActive: true, notesBeforeFill: manual });
    }
    return true;
  }

  _manualNotesAfterFill() {
    return this.state.notesBeforeFill.map((list, index) => this.board[index] ? [] : list.slice());
  }

  _restoredFillNotes(snapshot) {
    if (snapshot.fillNotesActive !== undefined) return {
      fillNotesActive: snapshot.fillNotesActive,
      notesBeforeFill: snapshot.fillNotesActive ? copyNotes(snapshot.notesBeforeFill) : null,
    };
    // Old saves did not record the switch. A complete, nonempty candidate grid
    // is the only unambiguous legacy case; partial manual notes stay untouched.
    const expected = this._fillNotesState(snapshot.board, snapshot.deductions || []).notes;
    const filled = expected.some(list => list.length) && expected.every((list, index) =>
      list.length === snapshot.notes[index].length && list.every(digit => snapshot.notes[index].includes(digit)));
    return { fillNotesActive: filled, notesBeforeFill: filled ? emptyNotes() : null };
  }

  hint() {
    if (this.paused || this.completed) return null;
    const preferred = validIndex(this.selected) && !this.puzzle[this.selected] &&
      this.board[this.selected] !== this.solution[this.selected];
    const index = preferred ? this.selected : this.board.findIndex((digit, other) => digit !== this.solution[other]);
    if (index < 0) return null;
    const corrected = this.board[index] !== 0;
    const value = this.solution[index];
    this._snapshot();
    this.state.board[index] = value;
    this.state.notes[index] = [];
    if (this.fillNotesActive) this.state.notesBeforeFill[index] = [];
    this._cleanPeerNotes(index, value);
    this.state.selected = index;
    this.state.hints = Math.min(Number.MAX_SAFE_INTEGER, this.hints + 1);
    this._checkComplete();
    return { index, value, corrected };
  }

  markAnswerViewed() {
    if (this.completed || this.answerViewed) return false;
    // Assistance is round metadata, not an undoable board edit.
    this.state.answerViewed = true;
    return true;
  }

  applyCorrectionHint(index) {
    if (this.paused || this.completed || !validIndex(index) || this.puzzle[index] ||
        !this.board[index] || this.board[index] === this.solution[index]) return false;
    const value = this.solution[index];
    this._snapshot();
    this.state.board[index] = value;
    this.state.notes[index] = [];
    if (this.fillNotesActive) this.state.notesBeforeFill[index] = [];
    this._cleanPeerNotes(index, value);
    this.state.selected = index;
    this.state.hints = Math.min(Number.MAX_SAFE_INTEGER, this.hints + 1);
    this._checkComplete();
    return true;
  }

  setPaused(value) {
    if (typeof value !== 'boolean' || this.completed || this.paused === value) return false;
    this.state.paused = value;
    return true;
  }

  tick(deltaMs) {
    if (this.paused || this.completed || !Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    this.state.elapsed = Math.min(Number.MAX_SAFE_INTEGER, this.elapsed + deltaMs);
    return true;
  }

  start(seed, difficulty = this.difficulty || 'easy', mode = this.mode || 'classic') {
    if (!validSeed(seed) || !validDifficulty(difficulty) || !validMode(mode)) return false;
    const generated = generatePuzzle(seed, difficulty);
    this.state = {
      board: generated.puzzle.slice(), puzzle: generated.puzzle.slice(), solution: generated.solution.slice(),
      notes: emptyNotes(), difficulty, mode, seed, selected: generated.puzzle.indexOf(0), noteMode: false,
      fillNotesActive: false, notesBeforeFill: null,
      history: [], elapsed: 0, paused: false, completed: false, hints: 0, answerViewed: false, roundId: this._roundId(),
    };
    return true;
  }

  restart() {
    return this.start(this.seed, this.difficulty, this.mode);
  }

  serialize() {
    // Puzzle/solution are reconstructed from the seed, not trusted from storage.
    return {
      schemaVersion: SAVE_VERSION, seed: this.seed, difficulty: this.difficulty, mode: this.mode,
      ...cloneSnapshot(this.state), history: this.history.map(cloneSnapshot),
      elapsed: this.elapsed, paused: this.paused, hints: this.hints, answerViewed: this.answerViewed, roundId: this.roundId,
    };
  }

  restore(saved) {
    if (!saved || typeof saved !== 'object' || saved.schemaVersion !== SAVE_VERSION ||
      !validSeed(saved.seed) || !validDifficulty(saved.difficulty) || !validMode(saved.mode) ||
      !validBoard(saved.board) || !validNotes(saved.notes, saved.board) ||
      !validSelected(saved.selected) || typeof saved.noteMode !== 'boolean' || !validFillNotes(saved) ||
      typeof saved.paused !== 'boolean' || !Number.isFinite(saved.elapsed) ||
      saved.elapsed < 0 || saved.elapsed > Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(saved.hints) || saved.hints < 0 ||
      (saved.answerViewed !== undefined && typeof saved.answerViewed !== 'boolean') ||
      typeof saved.roundId !== 'string' || !saved.roundId || saved.roundId.length > 160 ||
      /[\u0000-\u001f\u007f]/.test(saved.roundId) ||
      !Array.isArray(saved.history) || saved.history.length > HISTORY_LIMIT) return false;
    const generated = generatePuzzle(saved.seed, saved.difficulty);
    if (generated.puzzle.some((digit, index) => digit && saved.board[index] !== digit) ||
      !Array.from(saved.history).every(snapshot => validSnapshot(snapshot, generated.puzzle))) return false;
    this.state = {
      ...cloneSnapshot(saved), puzzle: generated.puzzle.slice(), solution: generated.solution.slice(),
      seed: saved.seed, difficulty: saved.difficulty, mode: saved.mode,
      history: saved.history.map(cloneSnapshot), elapsed: saved.elapsed, paused: saved.paused,
      completed: false, hints: saved.hints, answerViewed: saved.answerViewed === true, roundId: saved.roundId,
    };
    Object.assign(this.state, this._restoredFillNotes(saved));
    this.state.history = saved.history.map(snapshot => ({ ...cloneSnapshot(snapshot), ...this._restoredFillNotes(snapshot) }));
    this._checkComplete();
    return true;
  }

  shareQuery() {
    return `p=${encodeURIComponent(this.seed)}&d=${encodeURIComponent(this.difficulty)}&m=${this.mode}`;
  }
}

for (const key of ['board', 'puzzle', 'solution', 'notes', 'difficulty', 'mode', 'seed', 'selected',
  'noteMode', 'fillNotesActive', 'history', 'elapsed', 'paused', 'completed', 'hints', 'answerViewed', 'roundId']) {
  Object.defineProperty(SudokuGame.prototype, key, { get() { return this.state && this.state[key]; } });
}

module.exports = { SudokuGame, validFillNotes };
