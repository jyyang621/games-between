'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const e = require('../src/games/minesweeper/engine.js');
const { createGame } = require('../src/games/minesweeper/index.js');
const { createMiniGame } = require('../src/app/host.js');
const count = a => a.filter(Boolean).length;
function flood(r, first) {
  const seen = new Set(), queue = [first];
  while (queue.length) {
    const i = queue.pop();
    if (seen.has(i) || r.flags[i] || r.mines[i]) continue;
    seen.add(i);
    if (!e.adjacentMines(r, i)) queue.push(...e.neighbors(r, i).filter(n => !seen.has(n)));
  }
  return seen;
}
test('new and legacy layouts: deterministic, exact mine count, safe first ring, complete flood and persistence', () => {
  for (const d of e.DIFFICULTIES) for (let seed = 0; seed < 160; seed++) {
    for (const first of [0, d.cols - 1, Math.floor(d.rows / 2) * d.cols + 4, d.rows * d.cols - 1]) {
      for (const version of [1, 2]) {
        const r = e.createRound(d.id, seed); r.version = version;
        const copy = e.cloneRound(r);
        assert.equal(e.reveal(r, first), true); e.reveal(copy, first);
        assert.deepEqual(r, copy); assert.equal(count(r.mines), d.mines);
        assert.ok([first, ...e.neighbors(r, first)].every(i => !r.mines[i]));
        assert.deepEqual(new Set(r.revealed.flatMap((v, i) => v ? [i] : [])), flood(r, first));
        assert.deepEqual(e.validateRound(r), r);
      }
    }
  }
});
test('legacy layout remains byte-for-byte stable for seed 0, center click', () => {
  const r = e.createRound('beginner', 0); r.version = 1; e.reveal(r, 40);
  assert.deepEqual(r.mines.flatMap((v, i) => v ? [i] : []), [1, 13, 17, 19, 38, 43, 47, 54, 55, 58]);
});
function board() {
  const r = e.createRound(); r.started = true; r.status = 'playing'; r.firstIndex = 10;
  r.mines[0] = true; r.revealed[10] = true; return r;
}
test('chord requires exact flag count, opens all safe neighbors and trusts incorrect flags', () => {
  const r = board(); assert.equal(e.chord(r, 10), false);
  r.flags[0] = true; assert.equal(e.chord(r, 10), true);
  assert.equal(r.status, 'won'); assert.equal(count(r.revealed), 80);
  assert.equal(e.chord(r, 10), false);
  const wrong = board(); wrong.flags[1] = true;
  assert.equal(e.chord(wrong, 10), true); assert.equal(wrong.status, 'lost'); assert.equal(wrong.exploded, 0);
  const extra = board(); extra.flags[0] = extra.flags[1] = true; assert.equal(e.chord(extra, 10), false);
});
test('numbers open singly, flags block floods, invalid and terminal actions are inert', () => {
  const r = board(); r.flags[2] = true;
  assert.equal(e.reveal(r, 1), true); assert.equal(count(r.revealed), 2);
  assert.equal(e.reveal(r, 2), false); assert.equal(e.reveal(r, -1), false);
  assert.equal(e.reveal(r, 80), true); assert.equal(r.revealed[2], false);
  assert.equal(e.toggleFlag(r, 2), true); e.reveal(r, 2); assert.equal(r.status, 'won');
  assert.equal(e.toggleFlag(r, 0), false);
});
function context() { return new Proxy({ measureText: text => ({ width: String(text).length * 7 }) }, { get(t, k) { return k in t ? t[k] : () => {}; } }); }
function hostHarness() {
  let time = 1000; const callbacks = {}, saved = new Map(); const ctx = context();
  const platform = { createCanvas: () => ({ getContext: () => ctx }), getStorageSync: k => saved.get(k), setStorageSync: (k, v) => saved.set(k, v) };
  for (const n of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel', 'onHide', 'onShow', 'onWindowResize']) platform[n] = cb => { callbacks[n] = cb; };
  const host = createMiniGame(platform, { now: () => time, autoTick: false }); host.activate('openGame', 'minesweeper');
  const point = index => { const r = host.activeGame.layout.cells[index]; return { clientX: r.x + r.w / 2, clientY: r.y + r.h / 2, identifier: 1 }; };
  const touch = (event, index) => callbacks[event]({ changedTouches: [point(index)] });
  return { host, callbacks, touch, advance(ms) { time += ms; }, point };
}
test('real host hit targets defer until release; long hold flags once without revealing', () => {
  const h = hostHarness(); const g = h.host.activeGame;
  assert.ok(h.host.targets.some(t => t.action === 'minesweeper:press'));
  h.touch('onTouchStart', 40); assert.equal(g.model.round.started, false);
  h.advance(500); h.host.tick(); assert.equal(g.model.round.flags[40], true);
  h.host.tick(); h.touch('onTouchEnd', 40); h.touch('onTouchEnd', 40);
  assert.equal(g.model.round.flags[40], true); assert.equal(g.model.round.started, false);
  h.touch('onTouchStart', 40); h.advance(500); h.touch('onTouchEnd', 40);
  assert.equal(g.model.round.flags[40], false);
  h.touch('onTouchStart', 40); h.advance(50); h.touch('onTouchEnd', 40);
  assert.equal(g.model.round.started, true); assert.equal(g.model.round.revealed[40], true);
  h.host.dispose();
});
test('touch cancel, move off cell, pause, resize, difficulty switch and multi-touch cancel pending input', () => {
  for (const interrupt of ['cancel', 'move', 'pause', 'resize', 'difficulty', 'multi', 'background']) {
    const h = hostHarness(); const g = h.host.activeGame; h.touch('onTouchStart', 40);
    if (interrupt === 'cancel') h.touch('onTouchCancel', 40);
    if (interrupt === 'move') h.touch('onTouchMove', 41);
    if (interrupt === 'pause') { g.pause(); g.activate('minesweeper:resume'); }
    if (interrupt === 'resize') g.resize({ width: 375, height: 667 });
    if (interrupt === 'difficulty') g.activate('minesweeper:difficulty', 'expert');
    if (interrupt === 'multi') h.touch('onTouchStart', 41);
    if (interrupt === 'background') { h.callbacks.onHide(); h.callbacks.onShow({}); g.activate('minesweeper:resume'); }
    h.advance(500); h.touch('onTouchEnd', 40);
    assert.equal(count(g.model.round.flags), 0, interrupt); assert.equal(g.model.round.started, false, interrupt);
    h.host.dispose();
  }
});
test('tap an open clue chords in both modes; help explains risks and gestures', () => {
  for (const mode of ['flag', 'reveal']) {
    const dialogs = []; const g = createGame({ services: { modal: o => dialogs.push(o) } });
    Object.assign(g.model.round, board()); g.model.round.flags[0] = true;
    if (mode === 'flag') g.activate('minesweeper:mode', mode);
    g.activate('minesweeper:press', 10);
    const r = g.layout.cells[10]; g.pointer('end', [{ clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 }]);
    assert.equal(g.model.status, 'won');
    g.activate('minesweeper:help'); assert.match(dialogs[0].content, /长按/); assert.match(dialogs[0].content, /插错旗仍可能触雷/);
  }
});
test('opening selection reduces oversized starts across seeds and first positions without changing mine density', () => {
  for (const d of e.DIFFICULTIES) {
    const oldSizes = [], newSizes = [];
    for (let seed = 0; seed < 240; seed++) for (const first of [0, d.cols - 1, Math.floor(d.rows / 2) * d.cols + 4, d.rows * d.cols - 1]) {
      for (const version of [1, 2]) {
        const r = e.createRound(d.id, seed); r.version = version; e.reveal(r, first);
        (version === 1 ? oldSizes : newSizes).push(count(r.revealed));
      }
    }
    const mean = values => values.reduce((a, b) => a + b) / values.length;
    assert.ok(mean(newSizes) < mean(oldSizes) * 0.92, d.id);
    // Targets are a generation preference, not a hard flood-fill cap.
    const target = Math.max(9, Math.floor((d.rows * d.cols - d.mines) * 0.30));
    assert.ok(newSizes.filter(n => n <= target).length / newSizes.length > 0.95, d.id);
    assert.ok(new Set(newSizes).size > 10, d.id);
  }
});
test('legacy saves and bests resume, new rounds use version 2; corrupt mines are rejected', () => {
  const legacy = e.createRound('beginner', 0); legacy.version = 1; e.reveal(legacy, 40);
  const g = createGame({ read: () => ({ version: 1, round: legacy, bests: { beginner: 1234 }, mode: 'flag' }), services: { modal: (o, yes) => yes() } });
  assert.equal(g.model.paused, true); assert.deepEqual(g.model.round, legacy);
  assert.equal(g.model.bests.beginner, 1234); assert.equal(g.model.mode, 'flag');
  g.activate('minesweeper:resume'); g.activate('minesweeper:new');
  assert.equal(g.model.round.version, 2); assert.equal(g.model.bests.beginner, 1234);
  const corrupt = e.cloneRound(legacy); corrupt.mines[0] = !corrupt.mines[0]; assert.equal(e.validateRound(corrupt), null);
});
test('simultaneous triple touch stays blocked through all releases, then clean taps work', () => {
  for (const together of [false, true]) {
    const h = hostHarness(); const g = h.host.activeGame;
    const points = [0, 1, 2].map((i) => ({ ...h.point(i), identifier: i }));
    h.callbacks.onTouchStart({ changedTouches: points });
    h.advance(500); h.host.tick();
    // Releasing the most recent finger first used to trigger a reveal.
    if (together) h.callbacks.onTouchEnd({ changedTouches: points });
    else for (const point of [...points].reverse()) {
      h.callbacks.onTouchEnd({ changedTouches: [point] });
      assert.equal(g.model.round.started, false);
    }
    assert.equal(count(g.model.round.flags), 0); assert.equal(g.model.round.started, false);
    h.touch('onTouchStart', 40); h.advance(50); h.touch('onTouchEnd', 40);
    assert.equal(g.model.round.started, true);
    h.host.dispose();
  }
});
