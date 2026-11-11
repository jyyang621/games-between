import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LESSONS, getLesson } = require('../../微信小程序/src/games/sudoku/lessons.js');
const { createTrainingLayout, renderTraining } = require('../../微信小程序/src/games/sudoku/training-renderer.js');

const sizes = [
  { width: 320, height: 568, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } },
  { width: 375, height: 667, safeTop: 20, safeBottom: 0, capsuleRect: { bottom: 56 } },
  { width: 390, height: 844, safeTop: 44, safeBottom: 34, capsuleRect: { bottom: 82 } },
  { width: 768, height: 1024, safeTop: 24, safeBottom: 20, capsuleRect: { bottom: 58 } },
  { width: 844, height: 390, safeTop: 44, safeBottom: 24, capsuleRect: { bottom: 82 } }
];

function context() {
  const texts = [], fills = [];
  const ctx = new Proxy({
    texts, fills,
    measureText(value) {
      const size = Number(/([\d.]+)px/.exec(ctx.font || '12px')[1]);
      return { width: Array.from(String(value)).reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.58), 0) };
    },
    fillText(value, x, y) {
      const size = Number(/([\d.]+)px/.exec(ctx.font)[1]), width = ctx.measureText(value).width;
      texts.push({ value: String(value), x: x - (ctx.textAlign === 'center' ? width / 2 : ctx.textAlign === 'right' ? width : 0), y: y - size / 2, w: width, h: size, fill: ctx.fillStyle });
    },
    fillRect(x, y, w, h) { fills.push({ x, y, w, h, fill: ctx.fillStyle }); }
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  return ctx;
}
function intersects(a, b) { return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01; }
function checkLayout(targets, ctx, viewport) {
  const top = Math.max(viewport.safeTop, viewport.capsuleRect.bottom);
  for (const item of [...targets, ...ctx.texts]) {
    assert.ok(item.x >= -0.1 && item.y >= top - 0.1 && item.w > 0 && item.h > 0 && item.x + item.w <= viewport.width + 0.1 && item.y + item.h <= viewport.height - viewport.safeBottom + 0.1, JSON.stringify({ viewport, item }));
  }
  for (const item of targets) assert.ok(item.label && typeof item.action === 'string');
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) assert.equal(intersects(targets[i], targets[j]), false, JSON.stringify({ viewport, first: targets[i], second: targets[j] }));
}
function exercise(overrides = {}) {
  const board = new Array(81).fill(0); board[0] = 8;
  const candidates = new Array(81).fill(0b101001010);
  return { board, candidates, selected: 14, selectedCells: [9, 10], selectedEliminations: [{ index: 14, digit: 2 }], inputMode: 'support', hintLevel: 0, mode: 'independent', step: { technique: 'naked-pair', cells: [9, 10], digits: [2, 7], eliminations: [{ index: 14, digit: 2 }], units: [{ type: 'row', index: 1 }], explanation: '第 2 行的两格只有候选 2 和 7，所以该行其他格不能再填 2 或 7。' }, ...overrides };
}

test('all twelve lessons explain a condition, a method, a failure condition, and an original example', () => {
  assert.equal(LESSONS.length, 12);
  assert.equal(new Set(LESSONS.map(item => item.id)).size, 12);
  for (const lesson of LESSONS) {
    assert.equal(getLesson(lesson.id), lesson);
    assert.ok(lesson.principle.length > 25 && lesson.steps.length === 3 && lesson.mistakes.length > 15 && lesson.example.lines.length === 3);
    assert.ok(['place', 'eliminate'].includes(lesson.action));
  }
  assert.equal(getLesson('invented'), null);
  assert.ok(getLesson('xyz-wing').mistakes.includes('枢纽'));
  assert.ok(getLesson('naked-pair').mistakes.includes('第三个'));
});

test('catalog and every lesson page fit compact phones, tablets and landscape safe areas', () => {
  for (const viewport of sizes) {
    const layout = createTrainingLayout(viewport);
    for (let page = 0; page < 3; page++) {
      const ctx = context(), targets = renderTraining(ctx, layout, { screen: 'catalog', page });
      checkLayout(targets, ctx, viewport);
      assert.deepEqual(targets.filter(item => item.action === 'lesson').map(item => item.payload), LESSONS.slice(page * 4, page * 4 + 4).map(item => item.id));
    }
    for (const lesson of LESSONS) for (let page = 0; page < 3; page++) {
      const ctx = context(), targets = renderTraining(ctx, layout, { screen: 'lesson', lesson, page });
      checkLayout(targets, ctx, viewport);
      const practice = targets.filter(item => item.action === 'practice');
      assert.deepEqual(practice.map(item => item.payload), [{ id: lesson.id, mode: 'guided' }, { id: lesson.id, mode: 'independent' }]);
    }
  }
});

test('unavailable techniques remain readable but cannot start nonexistent exercises', () => {
  const targets = renderTraining(context(), createTrainingLayout(sizes[0]), { screen: 'lesson', lessonId: 'swordfish', lessons: [{ id: 'swordfish', available: false }] });
  assert.equal(targets.some(item => item.action === 'practice'), false);
  assert.ok(targets.some(item => item.action === 'lessonPage'));
});

test('exercise input exposes support cells and valid candidate operations without overlapping targets', () => {
  for (const viewport of sizes) for (const inputMode of ['support', 'eliminate', 'place']) for (const hintLevel of [0, 1, 2, 3]) {
    const ctx = context(), state = exercise({ inputMode, hintLevel }), snapshot = JSON.stringify(state);
    const targets = renderTraining(ctx, createTrainingLayout(viewport), { screen: 'exercise', lessonId: inputMode === 'place' ? 'hidden-single' : 'naked-pair', training: state });
    checkLayout(targets, ctx, viewport);
    assert.equal(JSON.stringify(state), snapshot, 'rendering must not alter a player selection or candidate state');
    assert.equal(targets.filter(item => item.action === 'trainingCell').length, 81);
    assert.ok(targets.some(item => item.action === 'trainingCheck'));
    assert.equal(targets.some(item => item.action === 'trainingNext'), false);
    if (inputMode === 'support') assert.equal(targets.some(item => ['trainingCandidate', 'trainingDigit'].includes(item.action)), false);
    if (inputMode === 'eliminate') {
      const values = targets.filter(item => item.action === 'trainingCandidate');
      assert.deepEqual(values.map(item => item.payload), [2, 4, 7, 9].map(digit => ({ index: 14, digit })));
    }
    if (inputMode === 'place') assert.equal(targets.filter(item => item.action === 'trainingDigit').length, 9);
  }
});

test('hint highlights advance from region to evidence and demo remains separate from independent success', () => {
  const layout = createTrainingLayout(sizes[2]);
  for (let level = 0; level <= 3; level++) {
    const ctx = context(); renderTraining(ctx, layout, { screen: 'exercise', lessonId: 'naked-pair', training: exercise({ hintLevel: level, selectedCells: [], selected: -1 }) });
    assert.equal(ctx.fills.some(item => item.fill === '#f0f4e8'), level >= 1);
    assert.equal(ctx.fills.some(item => item.fill === '#e0ebce'), level >= 2);
  }
  const guided = renderTraining(context(), layout, { screen: 'exercise', lessonId: 'naked-pair', training: exercise({ mode: 'guided', hintLevel: 3 }) });
  assert.ok(guided.some(item => item.action === 'trainingDemo' && item.label === '演示本步'));
  const independent = renderTraining(context(), layout, { screen: 'exercise', lessonId: 'naked-pair', training: exercise({ hintLevel: 3 }) });
  assert.equal(independent.some(item => item.action === 'trainingDemo'), false);
  const completed = renderTraining(context(), layout, { screen: 'exercise', lessonId: 'naked-pair', training: exercise({ completed: true }) });
  assert.ok(completed.some(item => item.action === 'trainingNext'));
  assert.equal(completed.some(item => ['trainingCell', 'trainingCheck', 'trainingMode', 'trainingCandidate', 'trainingDigit'].includes(item.action)), false);
});

test('foundation, diagram paging, new study routes and distinct-board progress stay usable on every viewport', () => {
  for (const viewport of sizes) {
    const layout = createTrainingLayout(viewport), catalog = context();
    const targets = renderTraining(catalog, layout, { screen: 'catalog', lessons: LESSONS.map(lesson => ({ ...lesson, count: 12 })),
      learningProgress: { 'naked-single': { uniqueIndependent: 2, firstTry: 1 } }, progress: { 'naked-single': { independent: 999, solved: 999 } } });
    checkLayout(targets, catalog, viewport);
    for (const action of ['foundationBasics', 'trainingMixed', 'trainingReview', 'trainingRecognize', 'trainingFullPuzzle']) assert.ok(targets.some(target => target.action === action));
    assert.ok(catalog.texts.some(item => item.value === '首次独立 2 个'));
    assert.equal(catalog.texts.some(item => item.value.includes('999')), false, 'replaying the same board is not advertised as distinct mastery');
    for (let foundationPage = 0; foundationPage < 4; foundationPage++) {
      const ctx = context(), foundation = renderTraining(ctx, layout, { screen: 'foundation', foundationPage });
      checkLayout(foundation, ctx, viewport);
      assert.ok(foundation.some(target => target.action === 'foundationComplete' && target.label === '跳过'));
      assert.ok(foundation.some(target => target.action === 'foundationExplanation'));
    }
    for (const lesson of LESSONS) for (let diagramPage = 0; diagramPage < 3; diagramPage++) {
      const ctx = context(), diagram = renderTraining(ctx, layout, { screen: 'lesson', lesson, lessonPage: 0, diagramPage });
      checkLayout(diagram, ctx, viewport);
      assert.ok(diagram.some(target => target.action === 'lessonExplanation'));
      assert.equal(diagram.some(target => target.action === 'lessonDiagram' && target.payload === -1), diagramPage > 0);
      assert.equal(diagram.some(target => target.action === 'lessonDiagram' && target.payload === 1), diagramPage < 2);
      assert.ok(diagram.filter(target => target.action === 'lessonDiagram').every(target => ['图解上一步', '图解下一步'].includes(target.label)));
      assert.ok(ctx.texts.some(item => item.value === '课程 1 / 3'));
    }
  }
});

test('mixed and recognition exercise views hide the named technique and expose their specific controls', () => {
  for (const viewport of sizes) {
    const layout = createTrainingLayout(viewport), mixed = context();
    const targets = renderTraining(mixed, layout, { screen: 'exercise', lessonId: 'naked-pair', training: exercise({ sessionMode: 'mixed', hideTechnique: true }) });
    checkLayout(targets, mixed, viewport);
    assert.equal(mixed.texts.some(item => item.value.includes('显性数对')), false);
    assert.deepEqual(targets.filter(item => item.action === 'trainingMode').map(item => item.payload), ['support', 'place', 'eliminate']);
    assert.deepEqual(targets.filter(item => item.action === 'trainingFilter').map(item => item.payload), Array.from({ length: 10 }, (_, i) => i));
    const recognition = exercise({ sessionMode: 'recognize', claim: '这两格可以组成数对，并排除同一行其他格的 2。', claimStep: exercise().step, recognitionExplanation: '额外候选使数对条件不成立。', judgment: null });
    for (const completed of [false, true]) {
      const ctx = context(), targets = renderTraining(ctx, layout, { screen: 'exercise', lessonId: 'naked-pair', training: { ...recognition, completed } });
      checkLayout(targets, ctx, viewport);
      assert.equal(targets.some(target => target.action === 'trainingCell'), false);
      if (!completed) assert.deepEqual(targets.filter(target => target.action === 'trainingJudge').map(target => target.payload), [true, false]);
      else for (const action of ['trainingContinue', 'trainingFullPuzzle', 'trainingNext', 'trainingExplanation']) assert.ok(targets.some(target => target.action === action));
    }
  }
});

test('recognition proposals expose the proposed operation without claiming a valid pivot or fish structure', () => {
  const { getRecognitionExample } = require('../../微信小程序/src/games/sudoku/training-recognition.js');
  const layout = createTrainingLayout(sizes[0]);
  for (const lesson of LESSONS) for (const number of [0, 1]) {
    const proposal = getRecognitionExample(lesson.id, number);
    assert.ok(proposal, lesson.id);
    const training = { ...proposal, sessionMode: 'recognize', hintLevel: 0, selectedCells: [], selectedEliminations: [], completed: false, claimStep: proposal.claimStep };
    const before = structuredClone(training), ctx = context();
    const targets = renderTraining(ctx, layout, { screen: 'exercise', lessonId: lesson.id, training });
    checkLayout(targets, ctx, sizes[0]);
    assert.deepEqual(training, before, 'visible proposals cannot raise hints or change trusted board data');
    assert.equal(ctx.fills.some(item => ['#e7dcef', '#deedd5', '#edf3e5', '#e8f0f7'].includes(item.fill)), false, 'unvalidated proposals must not reuse proved pivot/wing/fish role styling');
    const color = proposal.claimStep.placements.length ? '#3b6e94' : '#b87c21';
    assert.ok(ctx.texts.some(item => item.fill === color), `${lesson.id} must show its proposed ${proposal.claimStep.placements.length ? 'placement' : 'elimination'} before any hint`);
    assert.ok(targets.some(item => item.action === 'trainingJudge' && item.payload === false));
    assert.ok(targets.some(item => item.action === 'trainingJudge' && item.payload === true));
  }
});

test('a portrait explanation uses the space below its diagram to show the whole reasoning', () => {
  const { getTeachingVisual } = require('../../微信小程序/src/games/sudoku/teaching-visuals.js');
  const ctx = context();
  renderTraining(ctx, createTrainingLayout(sizes[2]), { screen: 'lesson', lessonId: 'pointing', lessonPage: 0, diagramPage: 1 });
  const drawn = ctx.texts.map(item => item.value).join('').replace(/\s/g, '');
  assert.ok(drawn.includes(getTeachingVisual('pointing', 1).caption.replace(/\s/g, '')));
});
