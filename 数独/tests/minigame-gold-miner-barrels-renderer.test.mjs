import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MineEngine } = require('../../微信小程序/src/games/gold-miner/core/engine.js');
const { MineRenderer } = require('../../微信小程序/src/games/gold-miner/core/renderer.js');
const { ORE_TYPES } = require('../../微信小程序/src/games/gold-miner/core/levels.js');
const { WIDE_VIEWPORT } = require('../../微信小程序/src/games/gold-miner/core/viewport.js');

function ore(id, x, y, kind) { return { id, x, y, kind, radius: ORE_TYPES[kind].radius }; }
function level(ores = [ore('tnt', 640, 420, 'barrel'), ore('near', 745, 430, 'diamond'), ore('safe', 300, 550, 'goldLarge')]) {
  return { id: 1, name: '炸药范围测试', subtitle: '', target: 500, duration: 60, palette: 'ochre', ores };
}

// Record the same draw calls used by the game, including Canvas save/restore and
// transforms, so warning bounds can be checked against live engine geometry.
function recordingContext() {
  const paints = [], texts = [];
  const stack = [];
  const identity = [1, 0, 0, 1, 0, 0];
  let state = { matrix: [...identity], dash: [], globalAlpha: 1 }, path = [];
  const multiply = other => {
    const [a,b,c,d,e,f] = state.matrix, [g,h,i,j,k,l] = other;
    state.matrix = [a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];
  };
  const gradient = (kind, args) => ({ kind, args, matrix: [...state.matrix], addColorStop() {} });
  const target = {
    save() { stack.push({ ...state, matrix: [...state.matrix], dash: [...state.dash] }); },
    restore() { state = stack.pop(); },
    setTransform(...matrix) { state.matrix = matrix; },
    translate(x,y) { multiply([1,0,0,1,x,y]); },
    scale(x,y) { multiply([x,0,0,y,0,0]); },
    rotate(angle) { multiply([Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]); },
    setLineDash(dash) { state.dash = [...dash]; },
    beginPath() { path = []; },
    ellipse(...args) { path.push({ type: 'ellipse', args, matrix: [...state.matrix] }); },
    arc(...args) { path.push({ type: 'arc', args, matrix: [...state.matrix] }); },
    fill() { paints.push({ type: 'fill', path: structuredClone(path), ...state }); },
    stroke() { paints.push({ type: 'stroke', path: structuredClone(path), ...state }); },
    fillText(text,x,y) { texts.push({ text, x, y, alpha: state.globalAlpha }); },
    createLinearGradient(...args) { return gradient('linear', args); },
    createRadialGradient(...args) { return gradient('radial', args); },
    measureText(text) { return { width: String(text).length * 13 }; },
  };
  const ctx = new Proxy(target, {
    get(object,key) { return key in object ? object[key] : key in state ? state[key] : () => {}; },
    set(_object,key,value) { state[key] = value; return true; },
  });
  return { ctx, paints, texts, clear() { paints.length = 0; texts.length = 0; } };
}

function fixture(definition = level(), view = WIDE_VIEWPORT) {
  const engine = new MineEngine(definition);
  engine.setViewport(view);
  const recording = recordingContext(), renderer = new MineRenderer(recording.ctx);
  renderer.resize(view, 1); renderer.setLevel(definition);
  return { engine, renderer, recording };
}
function warnings(recording) {
  return recording.paints.filter(paint => paint.type === 'stroke' && paint.dash.length && paint.path.some(shape => shape.type === 'ellipse'));
}
function blasts(recording) { return recording.paints.filter(paint => paint.type === 'fill' && paint.fillStyle?.kind === 'radial'); }
function destructionLabels(recording) { return recording.texts.filter(label => label.text === '周围物件已炸毁'); }

test('TNT warning ellipse exactly follows the engine damage axes in landscape and portrait', () => {
  for (const view of [WIDE_VIEWPORT, { width: 640, height: 1100, portrait: true }]) {
    const { engine, renderer, recording } = fixture(level(), view);
    renderer.render(engine, 0, 0, true);
    const warning = warnings(recording);
    assert.equal(warning.length, 1);
    const bounds = engine.barrelBlastBounds(engine.ores[0]);
    assert.deepEqual(warning[0].path[0].args.slice(0,4), [bounds.x,bounds.y,bounds.radiusX,bounds.radiusY]);
    assert.deepEqual(warning[0].path[0].matrix, [1,0,0,1,0,0]);
    assert.ok(warning[0].strokeStyle.startsWith('#ff'));
  }
});

test('only an unobstructed hook aim emphasizes the barrel warning', () => {
  const { engine, renderer, recording } = fixture(level([ore('tnt',640,420,'barrel'),ore('front',640,280,'goldSmall')]));
  engine.angle = 0;
  renderer.render(engine, 0, 0, true);
  const obstructed = warnings(recording)[0];
  engine.ores[1].removed = true;
  recording.clear(); renderer.render(engine, 0, 0, true);
  const aimed = warnings(recording)[0];
  assert.ok(aimed.lineWidth > obstructed.lineWidth, 'the nearest collision target controls emphasis');
  assert.notEqual(aimed.strokeStyle, obstructed.strokeStyle);
  engine.angle = -.85;
  recording.clear(); renderer.render(engine, 0, 0, true);
  assert.equal(warnings(recording)[0].lineWidth, obstructed.lineWidth);
});

test('a real detonation removes the warning, animates the exact damage range and labels destruction without income', () => {
  const { engine, renderer, recording } = fixture();
  const bounds = engine.barrelBlastBounds(engine.ores[0]);
  engine.angle = 0; assert.equal(engine.launch(), true); engine.update(.7);
  const events = engine.drainEvents();
  assert.equal(events.filter(event => event.type === 'blast').length, 1);
  assert.equal(engine.ores[0].removed, true);
  assert.equal(engine.ores[1].removed, true);
  assert.equal(engine.ores[2].removed, false);
  assert.equal(engine.income, 0);
  for (const event of events) renderer.event(event);
  renderer.render(engine, 0, 0, true);
  assert.equal(warnings(recording).length, 0);
  assert.equal(blasts(recording).length, 1);
  assert.deepEqual(blasts(recording)[0].fillStyle.matrix, [bounds.radiusX,0,0,bounds.radiusY,bounds.x,bounds.y]);
  assert.equal(destructionLabels(recording).length, 1);
  assert.equal(recording.texts.some(label => label.text.startsWith('+ ¥')), false);
});

test('pausing freezes blast size, opacity and destruction labels until rendering resumes', () => {
  const { engine, renderer, recording } = fixture();
  engine.ores[0].removed = true;
  renderer.event({ type:'blast', ...engine.barrelBlastBounds(engine.ores[0]) });
  renderer.render(engine, 1, .1);
  const before = { blast: blasts(recording)[0], label: destructionLabels(recording)[0] };
  recording.clear(); renderer.render(engine, 10, 20, true);
  assert.deepEqual(blasts(recording)[0].path[0].args, before.blast.path[0].args);
  assert.deepEqual(blasts(recording)[0].fillStyle.matrix.slice(0,4), before.blast.fillStyle.matrix.slice(0,4));
  assert.equal(blasts(recording)[0].globalAlpha, before.blast.globalAlpha);
  assert.deepEqual(destructionLabels(recording)[0], before.label);
  recording.clear(); renderer.render(engine, 10.1, .1);
  assert.notEqual(blasts(recording)[0].path[0].args[2], before.blast.path[0].args[2]);
  assert.ok(destructionLabels(recording)[0].y < before.label.y);
  recording.clear(); renderer.render(engine, 11, .6);
  recording.clear(); renderer.render(engine, 11, 0, true);
  assert.equal(blasts(recording).length, 0);
});

test('simultaneous blast effects and future barrel-heavy maps keep visual queues bounded', () => {
  const { engine, renderer, recording } = fixture(level(Array.from({length:8}, (_,id) => ore(String(id), 200+id*100, 450, 'barrel'))));
  for (let index=0;index<50;index++) renderer.event({type:'blast',x:640,y:450,radiusX:140,radiusY:140});
  renderer.render(engine, 0, 0, true);
  assert.equal(warnings(recording).length, 2);
  assert.equal(blasts(recording).length, 10);
  assert.equal(destructionLabels(recording).length, 24);
});

test('rotating the mine clears obsolete explosion coordinates without clearing the mine itself', () => {
  const { engine, renderer, recording } = fixture();
  engine.ores[0].removed = true;
  renderer.event({ type: 'blast', ...engine.barrelBlastBounds(engine.ores[0]) });
  renderer.render(engine, 0, 0, true);
  assert.equal(blasts(recording).length, 1);
  renderer.resize(engine.viewport, 0.5);
  recording.clear(); renderer.render(engine, 0, 0, true);
  assert.equal(blasts(recording).length, 1, 'Display-scale updates during normal rendering retain current effects');
  const removed = engine.ores.map(ore => ore.removed);
  engine.setViewport({ width: 720, height: 1000, portrait: true });
  renderer.resize(engine.viewport, 0.5);
  recording.clear(); renderer.render(engine, 0, 0, true);
  assert.equal(blasts(recording).length, 0); assert.equal(destructionLabels(recording).length, 0);
  assert.deepEqual(engine.ores.map(ore => ore.removed), removed);
});
