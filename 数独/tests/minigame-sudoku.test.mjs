import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSudokuGame, sharedRound } = require('../../微信小程序/src/games/sudoku/index.js');
const { SudokuGame } = require('../../微信小程序/src/games/sudoku/state.js');
const SAVE_KEY = 'games-between:sudoku:v1';
const SETTINGS_KEY = 'games-between:settings:v1';
const STATS_KEY = 'games-between:stats:v1';
const START_TIME = Date.parse('2026-10-17T16:00:00Z');
const clone = value => structuredClone(value);

function fixture(initial = []) {
  let timestamp = START_TIME;
  const storage = new Map(initial.map(([key, value]) => [key, clone(value)]));
  const reads = [], writes = [], modals = [], sheets = [], toasts = [];
  let invalidations = 0, homes = 0;
  const services = {
    storageAvailable: true,
    toast: message => toasts.push(message),
    modal: (config, confirm) => modals.push({ config, confirm }),
    actionSheet: config => sheets.push(config),
    home: () => { homes += 1; },
    invalidate: () => { invalidations += 1; },
  };
  const game = createSudokuGame({ now: () => timestamp, services,
    read(key) { reads.push(key); return clone(storage.get(key)); },
    write(key, value) { storage.set(key, clone(value)); writes.push(key); return true; },
  });
  return { game, services, storage, reads, writes, modals, sheets, toasts,
    advance(ms) { timestamp += ms; },
    get invalidations() { return invalidations; }, get homes() { return homes; },
  };
}

function savedRound() {
  const model = new SudokuGame({ now: () => START_TIME, seed: '已有进度 & 朋友 🧩', difficulty: 'hard', mode: 'classic' });
  model.fillAllNotes(); model.hint(); model.tick(1234); model.setPaused(true);
  return model.serialize();
}

function context() {
  return new Proxy({ measureText: text => ({ width: String(text).length * 8 }) }, {
    get(object, key) { return key in object ? object[key] : () => {}; },
  });
}

function confirmHint(f) {
  const previous = f.modals.length;
  assert.equal(f.game.activate('sudoku:hint'), true);
  if (f.modals.length > previous) f.modals.at(-1).confirm();
}

function finishWithHints(f) {
  for (let steps = 0; !f.game.model.completed && steps < 200; steps++) confirmHint(f);
  assert.equal(f.game.model.completed, true, 'the verified puzzle must finish within 200 logical hint steps');
}

test('Sudoku implements the common game contract and touches no unrelated storage', () => {
  const f = fixture([['other-game:v1', { score: 42 }]]);
  assert.deepEqual(f.reads, [SAVE_KEY, SETTINGS_KEY, STATS_KEY]);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.game.getResumeInfo(), { available: false, text: '' });
  assert.equal(f.game.id, 'sudoku'); assert.equal(f.game.frameInterval, 1000);
  assert.equal(f.game.pointer('start', []), false);
  assert.equal(f.game.activate('zuma:start'), false);
  f.game.enter({}, { source: 'hub' });
  assert.equal(f.game.getResumeInfo().available, true);
  assert.ok(f.storage.has(SAVE_KEY));
  assert.deepEqual(f.storage.get('other-game:v1'), { score: 42 });
  f.game.resize({ width: 390, height: 844, safeTop: 44, safeBottom: 34 });
  const targets = f.game.render(context());
  assert.equal(f.game.layout.width, 390);
  assert.ok(targets.some(target => target.action === 'home'));
  assert.ok(targets.some(target => target.action === 'share'));
  assert.ok(targets.some(target => target.action === 'sudoku:select'));
  assert.ok(targets.every(target => ['home', 'share'].includes(target.action) || target.action.startsWith('sudoku:')));
  assert.ok(targets.every(target => typeof target.label === 'string' && /[\u4e00-\u9fff]/.test(target.label)));
  assert.equal(f.game.statusText.includes('经典数独'), true);
});

test('shared puzzle parsing keeps legacy links and rejects malformed or other-game links', () => {
  assert.deepEqual(sharedRound({ p: '旧链接 & 🧩', d: 'hard', m: 'daily' }), { seed: '旧链接 & 🧩', difficulty: 'hard', mode: 'daily' });
  assert.deepEqual(sharedRound({ g: 'sudoku', p: 'seed', d: 'invalid', m: 'invalid' }), { seed: 'seed', difficulty: 'easy', mode: 'classic' });
  for (const query of [null, {}, { g: 'home', p: 'seed' }, { g: 'zuma', p: 'seed' }, { p: '' }, { p: ' ' },
    { p: 42 }, { p: 'a'.repeat(81) }, { p: 'abc\n' }, { p: '\ud800' }]) assert.equal(sharedRound(query), null);
});

test('existing saves and same-puzzle cold and warm shares preserve all progress', () => {
  const saved = savedRound();
  const f = fixture([[SAVE_KEY, saved]]);
  const query = { g: 'sudoku', p: saved.seed, d: saved.difficulty, m: saved.mode };
  assert.deepEqual(f.game.model.serialize(), saved);
  f.game.enter(query, { source: 'launch' });
  assert.deepEqual(f.game.model.serialize(), saved);
  f.game.enter(query, { source: 'show' });
  assert.deepEqual(f.game.model.serialize(), saved);
  assert.equal(f.modals.length, 0);
  const share = f.game.sharePayload();
  const decoded = Object.fromEntries(new URLSearchParams(share.query));
  assert.equal(decoded.g, 'sudoku');
  assert.deepEqual(sharedRound(decoded), { seed: saved.seed, difficulty: saved.difficulty, mode: saved.mode });
  assert.ok(share.title.includes('困难数独'));
});

test('different warm shares confirm replacement while cold launch shares open directly', () => {
  const saved = savedRound();
  const query = { g: 'sudoku', p: '朋友的新题', d: 'expert', m: 'daily' };
  const warm = fixture([[SAVE_KEY, saved]]);
  warm.game.enter(query, { source: 'show' });
  assert.equal(warm.modals.length, 1);
  assert.deepEqual(warm.game.model.serialize(), saved, 'Pending or cancelled confirmation keeps the current round');
  warm.modals[0].confirm();
  assert.equal(warm.game.model.seed, query.p);
  assert.equal(warm.game.model.difficulty, query.d);
  assert.equal(warm.game.model.mode, query.m);
  assert.equal(warm.game.model.paused, false);
  assert.equal(warm.game.model.elapsed, 0);
  assert.equal(warm.storage.get(SAVE_KEY).seed, query.p);
  assert.ok(warm.invalidations > 0);
  const cold = fixture([[SAVE_KEY, saved]]);
  cold.game.enter(query, { source: 'launch' });
  assert.equal(cold.modals.length, 0);
  assert.equal(cold.game.model.seed, query.p);
});

test('lifecycle pause invalidates delayed confirmations and menus without silently resuming', () => {
  const f = fixture([[SAVE_KEY, savedRound()]]);
  f.game.enter({}, { source: 'hub' });
  f.game.activate('sudoku:newGame');
  const before = f.game.model.serialize();
  f.game.pause('home');
  f.modals[0].confirm();
  assert.deepEqual(f.game.model.serialize(), before);
  f.game.enter({}, { source: 'hub' });
  assert.equal(f.game.model.paused, true);
  f.game.tick(5000); assert.equal(f.game.model.elapsed, before.elapsed);
  f.game.activate('sudoku:pause'); f.game.tick(1000);
  assert.equal(f.game.model.elapsed, before.elapsed + 1000);
  f.game.activate('sudoku:more');
  f.game.pause('background');
  f.sheets[0].success({ tapIndex: 2 });
  assert.equal(f.storage.has(SETTINGS_KEY), false);
  assert.equal(f.game.model.paused, true);
});

test('notes, hints, undo, settings and records remain owned by Sudoku', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  assert.equal(f.game.activate('sudoku:autoNotes'), true);
  assert.ok(f.game.model.notes.some(list => list.length));
  assert.ok(f.toasts.at(-1).includes('候选数'));
  assert.equal(f.game.activate('sudoku:undo'), true);
  assert.equal(f.game.activate('sudoku:hint'), true);
  assert.equal(f.game.model.hints, 0, 'opening the explanation does not apply an answer');
  assert.ok(f.modals.at(-1).config.title.includes('唯一'));
  assert.ok(f.modals.at(-1).config.content.length > 15);
  assert.equal(f.modals.at(-1).config.confirmText, '应用提示');
  f.modals.at(-1).confirm();
  assert.equal(f.game.model.hints, 1);
  assert.match(f.toasts.at(-1), /已填入推理结果.*可撤销/);
  f.game.activate('sudoku:more');
  f.sheets.at(-1).success({ tapIndex: 2 });
  assert.deepEqual(f.storage.get(SETTINGS_KEY), { conflicts: false, highlight: true });
  f.game.activate('sudoku:more');
  assert.ok(f.sheets.at(-1).itemList.includes('冲突提示：关'));
  f.sheets.at(-1).success({ tapIndex: 3 });
  assert.deepEqual(f.storage.get(SETTINGS_KEY), { conflicts: false, highlight: false });
  f.game.activate('sudoku:more'); f.sheets.at(-1).success({ tapIndex: 4 });
  assert.equal(f.modals.at(-1).config.title, '我的数独成绩');
  assert.ok(f.modals.at(-1).config.content.includes('尚未完成'));
  f.game.activate('sudoku:more'); f.sheets.at(-1).success({ tapIndex: 5 });
  assert.equal(f.modals.at(-1).config.title, '本题难度说明');
  assert.equal(f.homes, 0, 'returning home is available from the header rather than a duplicate seventh menu entry');
});

test('more fits native action sheet limits and distinguishes cancellation from failures', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  for (let index = 0; index < 3; index += 1) {
    f.game.activate('sudoku:more');
    const sheet = f.sheets.at(-1);
    assert.equal(sheet.itemList.length, 6);
    assert.ok(sheet.itemList.includes('本题难度说明'));
    sheet.fail({ errMsg: 'showActionSheet:fail cancel' });
    assert.equal(f.toasts.length, 0);
  }
  f.sheets.at(-1).fail({ errMsg: 'showActionSheet:fail native error' });
  assert.ok(f.toasts.at(-1).includes('菜单'));
  const count = f.toasts.length;
  f.game.pause('background');
  f.sheets.at(-1).fail({ errMsg: 'showActionSheet:fail native error' });
  assert.equal(f.toasts.length, count);
});

test('more has a generous visible hit area within the footer safe area on phones and landscape', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  for (const viewport of [
    { width: 320, height: 480, safeTop: 44, safeBottom: 24 },
    { width: 480, height: 320, safeTop: 44, safeBottom: 24 },
    { width: 320, height: 568, safeTop: 24, safeBottom: 20 },
    { width: 390, height: 844, safeTop: 44, safeBottom: 34 },
    { width: 844, height: 390, safeTop: 0, safeBottom: 21 },
  ]) {
    f.game.resize(viewport);
    const targets = f.game.render(context());
    const more = targets.find(target => target.action === 'sudoku:more');
    assert.ok(more.w >= 72 && more.h >= 44);
    assert.ok(more.x >= 0 && more.x + more.w <= viewport.width);
    assert.ok(more.y + more.h <= viewport.height - viewport.safeBottom);
    const { board, numbers, tools, footer } = f.game.layout;
    assert.ok(board.y >= viewport.safeTop && board.y + board.h <= viewport.height - viewport.safeBottom);
    assert.ok(numbers.y + numbers.h <= tools.y);
    assert.ok(tools.y + tools.h <= footer.y);
    for (const control of [numbers, tools, footer]) {
      assert.ok(control.y >= viewport.safeTop && control.y + control.h <= viewport.height - viewport.safeBottom);
    }
    for (const target of targets.filter(target => ['share', 'sudoku:newGame'].includes(target.action))) {
      assert.ok(target.x + target.w <= more.x);
    }
  }
});

test('completion statistics are counted once per round across undo and restored saves', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' }); f.game.tick(2500);
  finishWithHints(f);
  const roundId = f.game.model.roundId;
  let record = f.storage.get(STATS_KEY);
  assert.deepEqual(record.rated.completed.easy, { count: 1, best: 2500 });
  assert.deepEqual(record.rated.rounds, [roundId]);
  assert.deepEqual(record.completed, {});
  assert.deepEqual(record.rounds, []);
  f.game.activate('sudoku:undo'); confirmHint(f);
  assert.deepEqual(f.storage.get(STATS_KEY), record);
  const restored = fixture([...f.storage]);
  restored.game.enter({}, { source: 'hub' });
  restored.game.activate('sudoku:undo'); confirmHint(restored);
  assert.deepEqual(restored.storage.get(STATS_KEY), record);
  restored.game.activate('sudoku:newGame'); restored.game.tick(1000);
  finishWithHints(restored);
  record = restored.storage.get(STATS_KEY);
  assert.deepEqual(record.rated.completed.easy, { count: 2, best: 1000 });
  assert.equal(new Set(record.rated.rounds).size, 2);
});

test('daily mode and difficulty retain deterministic dates and the daily replay confirmation', () => {
  const f = fixture(); f.game.enter({}, { source: 'hub' });
  f.game.activate('sudoku:mode', 'daily');
  assert.equal(f.game.model.mode, 'daily'); assert.equal(f.game.model.seed, '2026-10-18');
  f.game.activate('sudoku:difficulty', 'hard');
  assert.equal(f.game.model.difficulty, 'hard'); assert.equal(f.game.model.seed, '2026-10-18');
  const id = f.game.model.roundId;
  f.game.activate('sudoku:newGame');
  assert.equal(f.modals.at(-1).config.title, '今天的每日挑战');
  assert.equal(f.game.model.roundId, id);
  f.modals.at(-1).confirm(); assert.notEqual(f.game.model.roundId, id);
  f.advance(24 * 60 * 60 * 1000);
  f.game.activate('sudoku:newGame');
  assert.equal(f.game.model.seed, '2026-10-19');
  f.game.activate('sudoku:mode', 'classic');
  assert.equal(f.game.model.mode, 'classic'); assert.notEqual(f.game.model.seed, '2026-10-19');
});

test('malformed legacy settings and stats are sanitized while valid results remain readable', () => {
  const f = fixture([[SETTINGS_KEY, { conflicts: 'off', highlight: false, extra: true }],
    [STATS_KEY, { rounds: ['valid-round', 1, 'x'.repeat(161)], completed: {
      easy: { count: -1, best: 50 }, medium: { count: 2, best: 123000 }, hard: { count: 2, best: NaN },
    } }]]);
  f.game.enter({}, { source: 'hub' });
  f.game.activate('sudoku:more');
  assert.ok(f.sheets.at(-1).itemList.includes('冲突提示：开'));
  assert.ok(f.sheets.at(-1).itemList.includes('关联高亮：关'));
  f.sheets.at(-1).success({ tapIndex: 4 });
  const content = f.modals.at(-1).config.content;
  assert.ok(content.includes('简单：尚未完成'));
  assert.ok(content.includes('中等：2 题 · 最快 02:03'));
  assert.ok(content.includes('困难：尚未完成'));
});
