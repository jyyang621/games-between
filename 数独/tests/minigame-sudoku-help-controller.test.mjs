import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSudokuGame } = require('../../微信小程序/src/games/sudoku/index.js');
const { getPuzzlesByTechnique } = require('../../微信小程序/src/games/sudoku/bank.js');
const { getAllCandidates, getConflicts } = require('../../微信小程序/src/games/sudoku/core/engine.js');
const SAVE = 'games-between:sudoku:v1', STATS = 'games-between:stats:v1';
const TRAINING = 'games-between:sudoku:training:v1', PRACTICE = 'games-between:sudoku:full-practice:v1';
const NOW = Date.parse('2026-11-06T00:00:00Z');
const baseEntry = getPuzzlesByTechnique('naked-single', { difficulty: 'easy' })[0];

function fixture({ saves = [], legacy = false, entry = baseEntry } = {}) {
  const storage = new Map(saves.map(([key, value]) => [key, structuredClone(value)]));
  const modals = [], sheets = [], toasts = [], texts = [];
  const ctx = new Proxy({
    measureText: value => ({ width: String(value).length * 7 }),
    fillText: value => texts.push(String(value)),
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  const game = createSudokuGame({
    now: () => NOW, read: key => structuredClone(storage.get(key)),
    write(key, value) { storage.set(key, structuredClone(value)); return true; },
    services: {
      storageAvailable: true, invalidate() {}, toast: value => toasts.push(value),
      modal(config, confirm) {
        for (const key of ['confirmText', 'cancelText']) if (config[key] !== undefined) {
          assert.equal(typeof config[key], 'string');
          assert.ok(Array.from(config[key]).length <= 4, 'native modal text must fit the WeChat limit');
        }
        const item = { config, confirm: () => confirm?.(), cancel: () => config.complete?.({ confirm: false, cancel: true }) };
        modals.push(item); return true;
      },
      actionSheet(config) { assert.ok(config.itemList.length <= 6); sheets.push(config); },
    },
  });
  game.resize({ width: 390, height: 844, safeTop: 44, safeBottom: 34 });
  game.enter(storage.has(SAVE) ? {} : legacy
    ? { g: 'sudoku', p: 'help-controller-legacy', d: 'easy', m: 'classic' }
    : { g: 'sudoku', p: 'help-controller', d: entry.difficulty, b: entry.id, v: '2' },
  { source: 'launch' });
  const targets = () => { texts.length = 0; return game.render(ctx); };
  return { game, storage, modals, sheets, toasts, texts, targets };
}
function act(f, action, payload) { return f.game.activate('sudoku:' + action, payload); }
function filling(model) {
  return structuredClone({ board: model.board, notes: model.notes, history: model.history,
    selected: model.selected, noteMode: model.noteMode });
}
function looseError(model) {
  const all = getAllCandidates(model.board);
  for (let index = 0; index < 81; index += 1) if (!model.puzzle[index] && !model.board[index]) {
    const value = all[index].find(digit => digit !== model.solution[index]);
    if (value) return { index, value };
  }
  assert.fail('the verified fixture should have a legal-looking incorrect candidate');
}
function put(f, index, value) { act(f, 'select', index); assert.equal(act(f, 'digit', value), true); }
function viewAnswer(f) {
  const count = f.modals.length;
  assert.equal(act(f, 'showAnswer'), true);
  if (f.modals.length > count) f.modals.at(-1).confirm();
  assert.equal(f.game.answerVisible, true);
}
function finish(f) {
  if (f.game.model.paused) act(f, 'pause');
  if (f.game.model.noteMode) act(f, 'notes');
  for (let index = 0; index < 81; index += 1) {
    const model = f.game.model;
    if (model.board[index] !== model.solution[index]) put(f, index, model.solution[index]);
  }
  assert.equal(f.game.model.completed, true);
}
function openPractice(f, lesson = 'naked-single') {
  assert.equal(act(f, 'mode', 'training'), true);
  assert.equal(act(f, 'lesson', lesson), true);
  assert.equal(act(f, 'trainingFullPuzzle'), true);
  assert.equal(f.game.practiceLessonId, lesson);
}

test('rated correction hints show the wrong cell, allow cancellation and apply only after confirmation', () => {
  const f = fixture(), model = f.game.model, wrong = looseError(model);
  put(f, wrong.index, wrong.value);
  const before = filling(model);
  assert.equal(act(f, 'hint'), true);
  const prompt = f.modals.at(-1);
  assert.equal(prompt.config.confirmText, '修正此格');
  assert.match(prompt.config.content, new RegExp('第 ' + (Math.floor(wrong.index / 9) + 1) + ' 行第 ' + (wrong.index % 9 + 1) + ' 列'));
  assert.ok(prompt.config.content.includes('正确数字为 ' + model.solution[wrong.index]));
  prompt.cancel();
  assert.deepEqual(filling(model), before); assert.equal(model.hints, 0);
  assert.equal(act(f, 'hint'), true); f.modals.at(-1).confirm();
  assert.equal(model.board[wrong.index], model.solution[wrong.index]); assert.equal(model.hints, 1);
  assert.equal(model.selected, wrong.index);
  assert.match(f.toasts.at(-1), /已修正.*可撤销/);
  assert.equal(act(f, 'undo'), true);
  assert.equal(model.board[wrong.index], wrong.value);
  assert.equal(model.hints, 1, 'undo does not erase the fact that a correction was used');
});

test('a wrong digit without a direct row, column or box conflict still receives a correction hint', () => {
  const f = fixture(), wrong = looseError(f.game.model);
  put(f, wrong.index, wrong.value);
  assert.equal(getConflicts(f.game.model.board).size, 0);
  assert.equal(act(f, 'hint'), true); f.modals.at(-1).confirm();
  assert.equal(f.game.model.board[wrong.index], f.game.model.solution[wrong.index]);
});

test('correction prioritizes the selected wrong cell instead of silently correcting another error', () => {
  const f = fixture(), model = f.game.model;
  const cells = model.puzzle.map((value, index) => value ? -1 : index).filter(index => index >= 0).slice(0, 2);
  for (const index of cells) put(f, index, model.solution[index] % 9 + 1);
  const otherValue = model.board[cells[0]];
  act(f, 'select', cells[1]); act(f, 'hint'); f.modals.at(-1).confirm();
  assert.equal(model.board[cells[1]], model.solution[cells[1]]);
  assert.equal(model.board[cells[0]], otherValue);
  assert.equal(model.selected, cells[1]); assert.equal(model.hints, 1);
});

test('logical elimination hints explicitly explain that candidates change, then locate the affected cell', () => {
  const entry = getPuzzlesByTechnique('pointing', { difficulty: 'medium' })[0];
  assert.ok(entry);
  const f = fixture({ entry }), model = f.game.model;
  let step;
  for (let count = 0; count < 200; count += 1) {
    step = model.nextLogicalStep();
    assert.ok(step, 'the rated trace should reach a candidate-elimination step');
    if (step.eliminations.length && !step.placements.length) break;
    assert.equal(model.applyLogicalStep(step), true);
  }
  assert.ok(step.eliminations.length && !step.placements.length);
  const before = filling(model), hints = model.hints;
  assert.equal(act(f, 'hint'), true);
  assert.match(f.modals.at(-1).config.content, /排除候选.*不会直接填数字/);
  assert.equal(f.modals.at(-1).config.confirmText, '应用提示');
  f.modals.at(-1).confirm();
  assert.deepEqual(model.board, before.board);
  assert.notDeepEqual(model.notes, before.notes);
  assert.equal(model.selected, step.eliminations[0].index);
  assert.equal(model.hints, hints + 1);
  assert.match(f.toasts.at(-1), /已排除.*候选.*高亮.*可撤销/);
});

test('answer confirmation opens the real read-only solution view without changing filling or completing the round', () => {
  const f = fixture(), model = f.game.model;
  const first = model.board.indexOf(0);
  put(f, first, model.solution[first]);
  const noteCell = model.board.indexOf(0);
  act(f, 'select', noteCell); act(f, 'notes'); act(f, 'digit', 1); act(f, 'notes');
  const before = filling(model), elapsed = model.elapsed;
  assert.equal(act(f, 'showAnswer'), true);
  assert.equal(f.game.answerVisible, false); assert.equal(model.answerViewed, false);
  assert.equal(f.modals.at(-1).config.confirmText, '显示答案');
  assert.match(f.modals.at(-1).config.content, /不计入成绩/);
  f.modals.at(-1).confirm();
  assert.equal(f.game.answerVisible, true); assert.equal(model.answerViewed, true);
  assert.equal(model.completed, false); assert.equal(model.paused, true); assert.equal(f.game.musicActive, false);
  assert.deepEqual(filling(model), before);
  const targets = f.targets();
  assert.deepEqual(targets.map(target => target.action), ['sudoku:closeAnswer']);
  assert.deepEqual(f.texts.filter(text => /^[1-9]$/.test(text)), model.solution.map(String));
  for (const action of ['digit', 'erase', 'undo', 'notes', 'autoNotes', 'hint', 'newGame', 'showAnswer']) assert.equal(act(f, action, 1), false, action);
  assert.equal(f.game.tick(60000), false);
  assert.equal(model.elapsed, elapsed); assert.deepEqual(filling(model), before);
  assert.equal(act(f, 'closeAnswer'), true);
  assert.equal(f.game.answerVisible, false); assert.equal(model.paused, false); assert.equal(f.game.musicActive, true);
  assert.deepEqual(filling(model), before);
});

test('canceling an answer preview has no assistance effect and only the first confirmed viewing needs a warning', () => {
  const f = fixture(), model = f.game.model;
  act(f, 'showAnswer'); f.modals.at(-1).cancel();
  assert.equal(f.game.answerVisible, false); assert.equal(model.answerViewed, false);
  assert.equal(model.paused, false);
  viewAnswer(f); act(f, 'closeAnswer');
  const count = f.modals.length;
  assert.equal(act(f, 'showAnswer'), true);
  assert.equal(f.game.answerVisible, true); assert.equal(f.modals.length, count);
  act(f, 'closeAnswer');
});

for (const initiallyPaused of [false, true]) {
  test('closing answer view restores prior pause state: ' + initiallyPaused, () => {
    const f = fixture(), model = f.game.model;
    if (initiallyPaused) act(f, 'pause');
    const before = model.elapsed;
    viewAnswer(f); f.game.tick(10000);
    assert.equal(model.elapsed, before);
    act(f, 'closeAnswer');
    assert.equal(model.paused, initiallyPaused);
    f.game.tick(1500);
    assert.equal(model.elapsed, before + (initiallyPaused ? 0 : 1500));
    assert.equal(f.game.musicActive, !initiallyPaused);
  });
}

test('backgrounding or rotating an open answer view keeps the underlying round paused on return', () => {
  for (const reason of ['background', 'resize']) {
    const f = fixture(), model = f.game.model;
    viewAnswer(f); f.game.pause(reason);
    assert.equal(f.game.answerVisible, true);
    act(f, 'closeAnswer');
    assert.equal(model.paused, true); assert.equal(f.game.musicActive, false);
    act(f, 'pause');
    assert.equal(model.paused, false); assert.equal(f.game.musicActive, true);
  }
});

test('answer assistance survives undo and a cold restore while the view itself does not persist', () => {
  const f = fixture(), model = f.game.model, index = model.board.indexOf(0);
  put(f, index, model.solution[index]);
  viewAnswer(f); act(f, 'closeAnswer'); assert.equal(act(f, 'undo'), true);
  assert.equal(model.board[index], 0); assert.equal(model.answerViewed, true);
  assert.equal(f.storage.get(SAVE).answerViewed, true);
  const restored = fixture({ saves: [...f.storage] });
  assert.equal(restored.game.model.roundId, model.roundId);
  assert.equal(restored.game.model.answerViewed, true); assert.equal(restored.game.answerVisible, false);
  const before = restored.modals.length;
  viewAnswer(restored); assert.equal(restored.modals.length, before);
  act(restored, 'closeAnswer'); finish(restored);
  assert.equal(restored.storage.get(STATS), undefined);
});

for (const legacy of [false, true]) {
  test('manually finishing after viewing answers earns no ordinary score: legacy=' + legacy, () => {
    const f = fixture({ legacy });
    const before = structuredClone(f.storage.get(STATS));
    viewAnswer(f); act(f, 'closeAnswer'); finish(f);
    assert.equal(f.game.model.completed, true);
    assert.deepEqual(f.storage.get(STATS), before);
    assert.match(f.toasts.at(-1), /本局不计成绩/);
  });
}

test('finishing a viewed full-practice answer earns neither course completion nor ordinary score', () => {
  const f = fixture(); openPractice(f);
  const ordinary = structuredClone(f.storage.get(SAVE));
  viewAnswer(f);
  assert.equal(f.storage.get(PRACTICE).rounds['naked-single'].answerViewed, true);
  act(f, 'closeAnswer'); finish(f);
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzle, 0);
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzleUnhinted, 0);
  assert.equal(f.storage.get(STATS), undefined);
  assert.deepEqual(f.storage.get(SAVE), ordinary);
  assert.equal((f.storage.get(TRAINING).fullPuzzles || []).length, 0);
});

test('viewing an already completed ordinary round retains the recorded score and opens without a warning', () => {
  const f = fixture(); finish(f);
  const before = structuredClone(f.storage.get(STATS)), count = f.modals.length;
  assert.equal(before.rated.completed.easy.count, 1);
  viewAnswer(f);
  assert.equal(f.modals.length, count); assert.equal(f.game.model.answerViewed, false);
  act(f, 'closeAnswer');
  assert.deepEqual(f.storage.get(STATS), before);
  assert.equal(f.game.model.completed, true);
});

test('viewing an already completed full-practice round retains the course completion record', () => {
  const f = fixture(); openPractice(f); finish(f);
  const before = structuredClone(f.storage.get(TRAINING));
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzle, 1);
  const count = f.modals.length; viewAnswer(f);
  assert.equal(f.modals.length, count); assert.equal(f.game.model.answerViewed, false);
  act(f, 'closeAnswer');
  assert.deepEqual(f.storage.get(TRAINING), before);
  assert.equal(f.game.training.view.learningProgress['naked-single'].fullPuzzle, 1);
});

for (const boundary of ['background', 'rotation', 'home', 'new-round', 'classroom']) {
  test('an answer confirmation queued before ' + boundary + ' cannot expose or mark the new context', () => {
    const f = fixture();
    act(f, 'showAnswer'); const old = f.modals.at(-1);
    if (boundary === 'background') f.game.pause('background');
    else if (boundary === 'rotation') {
      f.game.pause('resize');
      f.game.resize({ width: 844, height: 390, safeTop: 0, safeBottom: 24 });
    } else if (boundary === 'home') {
      f.game.pause('home'); f.game.enter({}, { source: 'hub' });
    } else if (boundary === 'new-round') act(f, 'newGame');
    else act(f, 'mode', 'training');
    const model = f.game.model, before = model.serialize();
    old.confirm();
    assert.equal(f.game.answerVisible, false); assert.equal(model.answerViewed, false);
    assert.deepEqual(model.serialize(), before);
    if (boundary === 'classroom') assert.equal(f.game.section, 'training');
  });
}

test('a stale answer confirmation cannot reveal a board that changed while the dialog was pending', () => {
  const f = fixture(); act(f, 'showAnswer'); const old = f.modals.at(-1);
  const index = f.game.model.board.indexOf(0);
  put(f, index, f.game.model.solution[index]);
  const before = filling(f.game.model); old.confirm();
  assert.equal(f.game.answerVisible, false); assert.equal(f.game.model.answerViewed, false);
  assert.deepEqual(filling(f.game.model), before);
});
