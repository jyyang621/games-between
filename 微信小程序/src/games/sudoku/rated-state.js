'use strict';

const { SudokuGame, validFillNotes } = require('./state.js');
const { getPuzzle, selectPuzzle, RATING_VERSION, DIFFICULTIES } = require('./bank.js');
const { createLogicState, findStep, applyStep, validateStep } = require('./logic.js');
const { getAllCandidates } = require('./core/engine.js');

const clone = value => JSON.parse(JSON.stringify(value));
const validSeed = value => {
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try { encodeURIComponent(value); return true; } catch { return false; }
};
const isBoard = value => Array.isArray(value) && value.length === 81 && Array.from(value).every(n => Number.isInteger(n) && n >= 0 && n <= 9);
const extendsBoard = (board, base) => base.every((n, i) => !n || n === board[i]);
const selectedOK = n => Number.isInteger(n) && n >= -1 && n < 81;
const notesOK = (notes, board) => Array.isArray(notes) && notes.length === 81 && Array.from(notes).every((list, i) =>
  Array.isArray(list) && list.length <= 9 && (!board[i] || !list.length) && new Set(list).size === list.length &&
  Array.from(list).every(n => Number.isInteger(n) && n >= 1 && n <= 9));
const masksToNotes = state => state.candidates.map((mask, i) => state.board[i] ? [] :
  Array.from({ length: 9 }, (_, n) => n + 1).filter(n => mask & (1 << (n - 1))));

/** New WeChat rounds use the rated bank; legacy rounds keep their seed engine. */
class RatedSudokuGame extends SudokuGame {
  start(seed, difficulty = this.difficulty || 'easy', mode = this.mode || 'classic', bankId = null) {
    if (!validSeed(seed) || !DIFFICULTIES.some(item => item.id === difficulty) || !['classic', 'daily'].includes(mode)) return false;
    const entry = bankId ? getPuzzle(bankId) : selectPuzzle(seed, difficulty);
    if (!entry || entry.difficulty !== difficulty) return false;
    this.state = {
      board: entry.puzzle.slice(), puzzle: entry.puzzle.slice(), solution: entry.solution.slice(),
      seed, difficulty, mode, selected: entry.puzzle.indexOf(0), noteMode: false,
      notes: Array.from({ length: 81 }, () => []), history: [], deductions: [],
      fillNotesActive: false, notesBeforeFill: null,
      elapsed: 0, paused: false, completed: false, hints: 0, answerViewed: false, roundId: this._roundId(),
      bankId: entry.id, ratingVersion: RATING_VERSION, ratingProfile: clone(entry.profile),
    };
    return true;
  }

  _snapshot() {
    super._snapshot();
    this.history[this.history.length - 1].deductions = clone(this.state.deductions);
  }

  // Each proof was established on an anchored board. Adding values keeps its
  // facts true; removing/replacing a value invalidates those anchors. Rebuild
  // all prior candidate deductions before checking the next proof, so storage
  // cannot manufacture a pattern by hiding arbitrary pencil marks.
  _proofState(board = this.board, proofs = this.state.deductions) {
    const raw = createLogicState(board);
    if (!raw.valid || !Array.isArray(proofs) || proofs.length > 128) return { state: raw, proofs: [] };
    const effects = [];
    const accepted = [];
    let previous = this.puzzle;
    for (const proof of proofs) {
      if (!proof || !isBoard(proof.board) || !extendsBoard(proof.board, previous) ||
        !extendsBoard(board, proof.board) || proof.board.some((n, i) => n && n !== this.solution[i]) ||
        !proof.step || !Array.isArray(proof.step.placements) || proof.step.placements.length ||
        !Array.isArray(proof.step.eliminations) || !proof.step.eliminations.length) return { state: raw, proofs: [] };
      const atProof = createLogicState(proof.board);
      for (const effect of effects) if (!atProof.board[effect.index]) atProof.candidates[effect.index] &= ~(1 << (effect.digit - 1));
      if (!validateStep(atProof, proof.step) || !applyStep(atProof, proof.step)) return { state: raw, proofs: [] };
      effects.push(...proof.step.eliminations);
      accepted.push(clone(proof));
      previous = proof.board;
    }
    for (const effect of effects) if (!raw.board[effect.index]) raw.candidates[effect.index] &= ~(1 << (effect.digit - 1));
    if (raw.candidates.some((mask, i) => !raw.board[i] && !mask)) return { state: createLogicState(board), proofs: [] };
    return { state: raw, proofs: accepted };
  }

  input(digit) {
    const index = this.selected;
    const wasNote = this.noteMode;
    const replacing = index >= 0 && this.board[index] !== 0;
    const changed = super.input(digit);
    if (changed && !wasNote && (replacing || digit !== this.solution[index])) this.state.deductions = [];
    return changed;
  }

  erase() {
    const removingValue = this.selected >= 0 && this.board[this.selected] !== 0;
    const changed = super.erase();
    if (changed && removingValue) this.state.deductions = [];
    return changed;
  }

  undo() {
    const previous = this.history[this.history.length - 1];
    const changed = super.undo();
    if (changed) this.state.deductions = clone(previous.deductions || []);
    return changed;
  }

  _fillNotesState(board = this.board, proofs = this.state.deductions) {
    const verified = this._proofState(board, proofs);
    return { notes: verified.state.valid ? masksToNotes(verified.state) : getAllCandidates(board), deductions: verified.proofs };
  }

  _manualNotesAfterFill(next) {
    const notes = super._manualNotesAfterFill(next);
    for (const proof of next.deductions || []) for (const { index, digit } of proof.step.eliminations) {
      notes[index] = notes[index].filter(value => value !== digit);
    }
    return notes;
  }

  nextLogicalStep() {
    if (this.paused || this.completed || this.board.some((n, i) => n && n !== this.solution[i])) return null;
    return findStep(this._proofState().state);
  }

  applyLogicalStep(step) {
    if (this.paused || this.completed || this.board.some((n, i) => n && n !== this.solution[i])) return false;
    if (!step || typeof step !== 'object') return false;
    step = { ...step, placements: step.placements || [], eliminations: step.eliminations || [] };
    const verified = this._proofState();
    if (!validateStep(verified.state, step)) return false;
    const proofBoard = this.board.slice();
    if (!applyStep(verified.state, step)) return false;
    this._snapshot();
    this.state.board = verified.state.board.slice();
    this.state.notes = masksToNotes(verified.state);
    this.state.deductions = verified.proofs;
    if (step.eliminations.length) this.state.deductions.push({ board: proofBoard, step: clone(step) });
    if (this.fillNotesActive) {
      for (const { index, value } of step.placements) {
        this.state.notesBeforeFill[index] = [];
        this._cleanPeerNotes(index, value);
      }
      this.state.notesBeforeFill = this._manualNotesAfterFill({ deductions: this.state.deductions });
    }
    if (step.placements.length) this.state.selected = step.placements[0].index;
    this.state.hints = Math.min(Number.MAX_SAFE_INTEGER, this.hints + 1);
    this._checkComplete();
    return true;
  }

  applyCorrectionHint(index) {
    const changed = super.applyCorrectionHint(index);
    if (changed) this.state.deductions = [];
    return changed;
  }

  hint() {
    const step = this.nextLogicalStep();
    if (!step || !this.applyLogicalStep(step)) return null;
    return { step, ...(step.placements[0] || {}), corrected: false };
  }

  restart() { return this.start(this.seed, this.difficulty, this.mode, this.bankId); }

  serialize() {
    return { ...super.serialize(), schemaVersion: 2, bankId: this.bankId, ratingVersion: RATING_VERSION,
      deductions: clone(this.state.deductions),
      history: this.history.map(snapshot => ({ ...clone(snapshot), deductions: clone(snapshot.deductions || []) })),
    };
  }

  restore(saved) {
    if (!saved || saved.schemaVersion !== 2 || saved.ratingVersion !== RATING_VERSION || !validSeed(saved.seed)) return false;
    const entry = getPuzzle(saved.bankId);
    if (!entry || entry.difficulty !== saved.difficulty || !['classic', 'daily'].includes(saved.mode) ||
      !isBoard(saved.board) || !extendsBoard(saved.board, entry.puzzle) || !notesOK(saved.notes, saved.board) ||
      !selectedOK(saved.selected) || typeof saved.noteMode !== 'boolean' || !validFillNotes(saved) || typeof saved.paused !== 'boolean' ||
      !Number.isFinite(saved.elapsed) || saved.elapsed < 0 || saved.elapsed > Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(saved.hints) || saved.hints < 0 ||
      (saved.answerViewed !== undefined && typeof saved.answerViewed !== 'boolean') || typeof saved.roundId !== 'string' ||
      !saved.roundId || saved.roundId.length > 160 || /[\u0000-\u001f\u007f]/.test(saved.roundId) ||
      !Array.isArray(saved.history) || saved.history.length > 100 ||
      !Array.from(saved.history).every(snapshot => snapshot && isBoard(snapshot.board) && extendsBoard(snapshot.board, entry.puzzle) &&
        notesOK(snapshot.notes, snapshot.board) && selectedOK(snapshot.selected) && typeof snapshot.noteMode === 'boolean' && validFillNotes(snapshot))) return false;
    const next = {
      board: saved.board.slice(), puzzle: entry.puzzle.slice(), solution: entry.solution.slice(),
      notes: saved.notes.map(list => list.slice()), seed: saved.seed, difficulty: saved.difficulty, mode: saved.mode,
      selected: saved.selected, noteMode: saved.noteMode, elapsed: saved.elapsed, paused: saved.paused,
      hints: saved.hints, answerViewed: saved.answerViewed === true, roundId: saved.roundId, completed: false, history: clone(saved.history),
      deductions: [], bankId: entry.id, ratingVersion: RATING_VERSION, ratingProfile: clone(entry.profile),
    };
    const previous = this.state;
    this.state = next;
    try {
      next.deductions = this._proofState(next.board, saved.deductions || []).proofs;
      Object.assign(next, this._restoredFillNotes({ ...saved, deductions: next.deductions }));
      next.history = next.history.map(snapshot => {
        const deductions = this._proofState(snapshot.board, snapshot.deductions || []).proofs;
        return { ...snapshot, deductions, ...this._restoredFillNotes({ ...snapshot, deductions }) };
      });
      this._checkComplete();
      return true;
    } catch { this.state = previous; return false; }
  }

  shareQuery() { return `${super.shareQuery()}&v=2&b=${encodeURIComponent(this.bankId)}`; }
  get bankId() { return this.state && this.state.bankId; }
  get ratingVersion() { return this.state && this.state.ratingVersion; }
  get ratingProfile() { return this.state && this.state.ratingProfile; }
}

module.exports = { RatedSudokuGame };
