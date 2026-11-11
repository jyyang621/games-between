import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMusic, MUSIC_SETTINGS_KEY, MUSIC_PLAYLIST, MUSIC_SOURCE, MUSIC_VOLUME } = require('../../微信小程序/src/platform/music.js');

async function flushMusic() { await Promise.resolve(); await Promise.resolve(); }

function setup({ saved = null, play, create, read, write, onError } = {}) {
  const storage = new Map([[MUSIC_SETTINGS_KEY, saved]]), writes = [], errors = [], players = [];
  let creates = 0;
  const platform = {
    createInnerAudioContext() {
      creates += 1;
      if (create) return create();
      const listeners = new Set(), playListeners = new Set(), endedListeners = new Set();
      let source = "";
      const player = {
        plays: 0, pauses: 0, destroys: 0, currentTime: 0, sourceChanges: [],
        get src() { return source; },
        set src(value) { source = value; this.sourceChanges.push(value); this.currentTime = 0; },
        play() { this.plays += 1; return play?.(this); },
        pause() { this.pauses += 1; },
        destroy() { this.destroys += 1; },
        onError(listener) { listeners.add(listener); },
        offError(listener) { listeners.delete(listener); },
        onPlay(listener) { playListeners.add(listener); this.lastPlayListener = listener; },
        offPlay(listener) { playListeners.delete(listener); },
        onEnded(listener) { endedListeners.add(listener); this.lastEndedListener = listener; },
        offEnded(listener) { endedListeners.delete(listener); },
        emitEnded() { for (const listener of [...endedListeners]) listener(); },
        emitEndedLive() {
          let dispatches = 0;
          for (const listener of endedListeners) {
            assert.ok(++dispatches < 8, 'native-style live dispatch must not visit replacement listeners');
            listener();
          }
          return dispatches;
        },
        emitError(error) { for (const listener of listeners) listener(error); },
        emitPlay() { for (const listener of playListeners) listener(); },
        get listenerCount() { return listeners.size; },
        get playListenerCount() { return playListeners.size; },
        get endedListenerCount() { return endedListeners.size; },
      };
      players.push(player);
      return player;
    },
  };
  const music = createMusic({ platform,
    read: read || (key => structuredClone(storage.get(key))),
    write: write || ((key, value) => { writes.push({ key, value }); storage.set(key, structuredClone(value)); }),
    onError: onError || (error => errors.push(error)),
  });
  return { music, platform, storage, players, writes, errors, get creates() { return creates; } };
}

test('music is enabled by default and creates its sole low-volume playlist player only when requested', () => {
  const mock = setup();
  assert.equal(mock.music.enabled, true);
  assert.equal(mock.music.status, 'idle');
  assert.equal(mock.creates, 0);
  assert.equal(mock.music.setPlaying(true), true);
  const player = mock.players[0];
  assert.equal(player.autoplay, false);
  assert.equal(player.src, MUSIC_SOURCE);
  assert.equal(player.src, 'assets/audio/pingsha-luoyan.mp3');
  assert.equal(player.loop, false);
  assert.equal(player.endedListenerCount, 1);
  assert.equal(player.volume, MUSIC_VOLUME);
  assert.ok(player.volume > 0 && player.volume < 0.5);
  for (let frame = 0; frame < 120; frame += 1) mock.music.setPlaying(true);
  assert.equal(mock.creates, 1);
  assert.equal(player.plays, 1);
  assert.deepEqual(mock.writes, []);
  mock.music.dispose();
});

test('pausing in the background preserves playback position and resumes the same player', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0];
  player.currentTime = 17.25;
  mock.music.setPlaying(false);
  assert.equal(mock.music.status, 'paused');
  assert.equal(player.pauses, 1);
  assert.equal(player.currentTime, 17.25);
  for (let frame = 0; frame < 120; frame += 1) mock.music.setPlaying(false);
  assert.equal(player.pauses, 1);
  mock.music.setPlaying(true);
  assert.equal(mock.creates, 1);
  assert.equal(player.plays, 2);
  assert.equal(player.currentTime, 17.25);
  mock.music.dispose();
});

test('the switch persists only its independent preference and restores disabled on a cold start', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  assert.equal(mock.music.toggle(), false);
  assert.equal(mock.music.status, 'disabled');
  assert.deepEqual(mock.writes, [{ key: MUSIC_SETTINGS_KEY, value: { enabled: false } }]);
  mock.music.setPlaying(true, { userGesture: true });
  assert.equal(mock.players[0].plays, 1);
  const restored = setup({ saved: mock.storage.get(MUSIC_SETTINGS_KEY) });
  restored.music.setPlaying(true);
  assert.equal(restored.music.enabled, false);
  assert.equal(restored.creates, 0);
  assert.equal(restored.music.toggle(), true);
  assert.equal(restored.players[0].plays, 1);
  mock.music.dispose();
  restored.music.dispose();
});

test('enabling while the host is paused does not start music until play resumes', () => {
  const mock = setup({ saved: { enabled: false } });
  mock.music.setPlaying(false);
  mock.music.toggle();
  assert.equal(mock.music.enabled, true);
  assert.equal(mock.music.status, 'paused');
  assert.equal(mock.creates, 0);
  mock.music.setPlaying(true);
  assert.equal(mock.players[0].plays, 1);
  mock.music.dispose();
});

test('malformed or unavailable saved preferences do not disable music or block play', () => {
  for (const saved of [null, '', false, { enabled: 'false' }, { other: false }]) {
    const mock = setup({ saved });
    assert.equal(mock.music.enabled, true);
    assert.doesNotThrow(() => mock.music.setPlaying(true));
    mock.music.dispose();
  }
  const mock = setup({ read: () => { throw new Error('storage unavailable'); }, write: () => { throw new Error('full'); } });
  mock.music.setPlaying(true);
  assert.doesNotThrow(() => mock.music.toggle());
  assert.equal(mock.music.enabled, false);
  assert.doesNotThrow(() => mock.music.toggle());
  assert.equal(mock.players[0].plays, 2);
  mock.music.dispose();
});

test('unsupported audio is harmless and reports once without repeatedly constructing anything', () => {
  const errors = [];
  const music = createMusic({ platform: {}, onError: error => errors.push(error) });
  for (let frame = 0; frame < 120; frame += 1) music.setPlaying(true, { userGesture: true });
  assert.equal(music.status, 'unsupported');
  assert.equal(errors.length, 1);
  assert.doesNotThrow(() => music.dispose());
  assert.equal(music.status, 'disposed');
});

test('a native failure blocks automatic retries but allows the next genuine interaction', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0];
  const error = { errCode: 10004, errMsg: 'not supported' };
  player.emitError(error);
  assert.equal(mock.music.status, 'blocked');
  assert.deepEqual(mock.errors, [error]);
  player.emitError(error);
  for (let frame = 0; frame < 120; frame += 1) mock.music.setPlaying(true);
  assert.equal(player.plays, 1);
  mock.music.setPlaying(false);
  mock.music.setPlaying(true);
  assert.equal(player.plays, 1, 'ordinary foreground state changes do not repeatedly retry a failed asset');
  mock.music.setPlaying(true, { userGesture: true });
  assert.equal(player.plays, 2);
  assert.equal(mock.creates, 1);
  player.emitError(error);
  assert.equal(mock.errors.length, 1);
  mock.music.toggle();
  mock.music.toggle();
  assert.equal(player.plays, 3);
  player.emitError(error);
  assert.equal(mock.errors.length, 2, 'explicitly enabling again starts a new error notification cycle');
  mock.music.dispose();
});

test('a rejected browser play Promise is handled and retried only with a gesture', async () => {
  let blocked = true;
  const error = new Error('NotAllowedError');
  const mock = setup({ play: () => blocked ? Promise.reject(error) : Promise.resolve() });
  mock.music.setPlaying(true);
  await Promise.resolve();
  assert.equal(mock.music.status, 'blocked');
  assert.deepEqual(mock.errors, [error]);
  mock.music.setPlaying(true);
  assert.equal(mock.players[0].plays, 1);
  blocked = false;
  mock.music.setPlaying(true, { userGesture: true });
  await Promise.resolve();
  assert.equal(mock.music.status, 'playing');
  assert.equal(mock.players[0].plays, 2);
  mock.music.dispose();
});

test('a stale rejected play Promise cannot change the newer resumed attempt', async () => {
  let rejectFirst;
  const mock = setup({ play: player => player.plays === 1 ? new Promise((resolve, reject) => { rejectFirst = reject; }) : Promise.resolve() });
  mock.music.setPlaying(true);
  mock.music.setPlaying(false);
  mock.music.setPlaying(true);
  rejectFirst(new Error('old interruption'));
  await Promise.resolve();
  assert.equal(mock.music.status, 'playing');
  assert.equal(mock.errors.length, 0);
  mock.music.dispose();
});

test('a late failure after pause or disposal cannot notify or restart the player', async () => {
  let rejectPlay;
  const mock = setup({ play: () => new Promise((resolve, reject) => { rejectPlay = reject; }) });
  mock.music.setPlaying(true);
  const player = mock.players[0];
  mock.music.setPlaying(false);
  player.emitError(new Error('background interruption'));
  mock.music.dispose();
  rejectPlay(new Error('late rejection'));
  await Promise.resolve();
  assert.equal(mock.music.status, 'disposed');
  assert.equal(mock.errors.length, 0);
  assert.equal(player.listenerCount, 0);
  assert.equal(player.playListenerCount, 0);
  assert.equal(player.endedListenerCount, 0);
  assert.equal(player.destroys, 1);
  assert.equal(mock.music.setPlaying(true, { userGesture: true }), false);
  assert.equal(mock.music.toggle(), false);
  mock.music.dispose();
  assert.equal(player.destroys, 1);
  assert.equal(player.plays, 1);
});

test('a throwing audio factory is isolated and retried on the next gesture', () => {
  const mock = setup({ create: () => { throw new Error('audio unavailable'); } });
  assert.equal(mock.music.setPlaying(true), false);
  assert.equal(mock.music.status, 'blocked');
  for (let frame = 0; frame < 120; frame += 1) mock.music.setPlaying(true);
  assert.equal(mock.creates, 1);
  mock.music.setPlaying(true, { userGesture: true });
  assert.equal(mock.creates, 2);
  assert.equal(mock.errors.length, 1);
  mock.music.dispose();
});

test('partially configured players are destroyed and notification or cleanup errors are contained', () => {
  let destroys = 0;
  const mock = setup({
    create: () => ({ play() {}, pause() {}, destroy() { destroys += 1; }, set src(value) { throw new Error('asset invalid'); } }),
    onError() { throw new Error('toast unavailable'); },
  });
  assert.doesNotThrow(() => mock.music.setPlaying(true));
  assert.equal(mock.music.status, 'blocked');
  assert.equal(destroys, 1);
  assert.doesNotThrow(() => mock.music.dispose());
});

test('late native playback after pause, disabling or disposal is immediately paused', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0];
  player.emitPlay();
  assert.equal(mock.music.status, 'playing');
  mock.music.setPlaying(false);
  const pausesAfterBackground = player.pauses;
  player.emitPlay();
  assert.equal(player.pauses, pausesAfterBackground + 1);
  assert.equal(mock.music.status, 'paused');
  mock.music.setPlaying(true);
  mock.music.toggle();
  const pausesAfterDisabling = player.pauses;
  player.emitPlay();
  assert.equal(player.pauses, pausesAfterDisabling + 1);
  assert.equal(mock.music.status, 'disabled');
  mock.music.toggle();
  player.emitPlay();
  assert.equal(mock.music.status, 'playing');
  const queuedNativeCallback = player.lastPlayListener;
  mock.music.dispose();
  assert.equal(player.playListenerCount, 0);
  const pausesAfterDisposal = player.pauses;
  queuedNativeCallback();
  assert.equal(player.pauses, pausesAfterDisposal + 1, 'a callback queued before offPlay still cannot start sound');
  assert.equal(mock.music.status, 'disposed');
});

test('older audio adapters without onPlay remain compatible', () => {
  const player = { plays: 0, pauses: 0, destroys: 0,
    play() { this.plays += 1; }, pause() { this.pauses += 1; }, destroy() { this.destroys += 1; },
  };
  const mock = setup({ create: () => player });
  assert.equal(mock.music.setPlaying(true), true);
  assert.equal(mock.music.status, 'playing');
  assert.equal(player.loop, true);
  assert.equal(player.src, MUSIC_SOURCE);
  mock.music.setPlaying(false);
  assert.equal(mock.music.status, 'paused');
  mock.music.setPlaying(true);
  assert.equal(player.plays, 2);
  assert.doesNotThrow(() => mock.music.dispose());
  assert.equal(player.destroys, 1);
});

test('the playlist is immutable and advances A-B-A on one shared player', async () => {
  assert.ok(Object.isFrozen(MUSIC_PLAYLIST));
  assert.ok(MUSIC_PLAYLIST.every(Object.isFrozen));
  assert.deepEqual(MUSIC_PLAYLIST.map(track => track.title), ['平沙落雁', '阳关三叠']);
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0];
  const firstEnded = player.lastEndedListener;
  player.emitEnded();
  await flushMusic();
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  assert.equal(player.endedListenerCount, 1);
  firstEnded();
  assert.equal(player.src, MUSIC_PLAYLIST[1].src, 'an already queued first-track event cannot skip the second track');
  assert.equal(player.plays, 2);
  player.emitEnded();
  await flushMusic();
  assert.equal(player.src, MUSIC_PLAYLIST[0].src);
  assert.equal(player.plays, 3);
  assert.equal(player.endedListenerCount, 1);
  assert.equal(mock.creates, 1);
  assert.deepEqual(player.sourceChanges, [MUSIC_PLAYLIST[0].src, MUSIC_PLAYLIST[1].src, MUSIC_PLAYLIST[0].src]);
  mock.music.dispose();
  assert.equal(player.endedListenerCount, 0);
});

test('a completion queued before pause selects the next track only when the host resumes', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0], endedBeforePause = player.lastEndedListener;
  player.currentTime = 83;
  mock.music.setPlaying(false);
  endedBeforePause();
  endedBeforePause();
  assert.equal(mock.music.status, 'paused');
  assert.equal(player.plays, 1);
  assert.equal(player.src, MUSIC_PLAYLIST[0].src);
  assert.equal(player.currentTime, 83);
  mock.music.setPlaying(true);
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.currentTime, 0);
  assert.equal(player.plays, 2);
  mock.music.dispose();
});

test('a completion while disabled stays silent and resumes the next track when enabled', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0], endedBeforeDisable = player.lastEndedListener;
  mock.music.toggle();
  endedBeforeDisable();
  assert.equal(mock.music.status, 'disabled');
  assert.equal(player.plays, 1);
  assert.equal(player.src, MUSIC_PLAYLIST[0].src);
  for (let frame = 0; frame < 120; frame += 1) mock.music.setPlaying(true);
  assert.equal(player.plays, 1);
  mock.music.toggle();
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  mock.music.dispose();
});

test('a completion already queued at disposal cannot change sources or restart audio', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0], queuedEnded = player.lastEndedListener;
  mock.music.dispose();
  queuedEnded();
  assert.equal(mock.music.status, 'disposed');
  assert.equal(player.plays, 1);
  assert.equal(player.sourceChanges.length, 1);
  assert.equal(player.endedListenerCount, 0);
  assert.equal(player.listenerCount, 0);
  assert.equal(player.playListenerCount, 0);
  assert.equal(player.destroys, 1);
});

test('a failed next-track play blocks frame retries and retries that same track on a gesture', async () => {
  const failure = new Error('next track unavailable');
  let failNext = true;
  const mock = setup({ play: player => { if (player.plays === 2 && failNext) throw failure; } });
  mock.music.setPlaying(true);
  const player = mock.players[0];
  player.emitEnded();
  await flushMusic();
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(mock.music.status, 'blocked');
  assert.deepEqual(mock.errors, [failure]);
  for (let frame = 0; frame < 120; frame += 1) mock.music.setPlaying(true);
  assert.equal(player.plays, 2);
  failNext = false;
  mock.music.setPlaying(true, { userGesture: true });
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 3);
  assert.equal(mock.music.status, 'playing');
  assert.equal(mock.creates, 1);
  mock.music.dispose();
});

test('a rejected next-track Promise is isolated and does not trigger automatic track skipping', async () => {
  const failure = new Error('NotAllowedError');
  const mock = setup({ play: player => player.plays === 2 ? Promise.reject(failure) : Promise.resolve() });
  mock.music.setPlaying(true);
  const player = mock.players[0];
  player.emitEnded();
  await flushMusic();
  assert.equal(mock.music.status, 'blocked');
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  assert.deepEqual(mock.errors, [failure]);
  mock.music.setPlaying(true);
  assert.equal(player.plays, 2);
  mock.music.setPlaying(true, { userGesture: true });
  await flushMusic();
  assert.equal(mock.music.status, 'playing');
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  mock.music.dispose();
});

test('a previous-track Promise rejection cannot block the newly playing track', async () => {
  let rejectFirst;
  const mock = setup({ play: player => player.plays === 1 ? new Promise((resolve, reject) => { rejectFirst = reject; }) : Promise.resolve() });
  mock.music.setPlaying(true);
  const player = mock.players[0];
  player.emitEnded();
  rejectFirst(new Error('previous track interrupted'));
  await flushMusic();
  assert.equal(mock.music.status, 'playing');
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  assert.equal(mock.errors.length, 0);
  mock.music.dispose();
});

test('late play and ended callbacks cannot bypass a blocked player', () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0];
  player.emitError(new Error('native interruption'));
  const pausesAfterFailure = player.pauses;
  player.emitPlay();
  player.emitEnded();
  assert.equal(player.pauses, pausesAfterFailure + 1);
  assert.equal(mock.music.status, 'blocked');
  assert.equal(player.src, MUSIC_PLAYLIST[0].src);
  assert.equal(player.plays, 1);
  mock.music.setPlaying(true);
  assert.equal(player.plays, 1);
  mock.music.setPlaying(true, { userGesture: true });
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  mock.music.dispose();
});

test('a source failure during track change retries the same next track without replacing the player', async () => {
  let source = '', ended, failSecondSource = true;
  const player = {
    plays: 0, pauses: 0, destroys: 0,
    get src() { return source; },
    set src(value) {
      if (value === MUSIC_PLAYLIST[1].src && failSecondSource) throw new Error('cannot load next source');
      source = value;
    },
    play() { this.plays += 1; }, pause() { this.pauses += 1; }, destroy() { this.destroys += 1; },
    onEnded(listener) { ended = listener; }, offEnded(listener) { if (ended === listener) ended = null; },
  };
  const mock = setup({ create: () => player });
  mock.music.setPlaying(true);
  ended();
  await flushMusic();
  assert.equal(mock.music.status, 'blocked');
  assert.equal(player.src, MUSIC_PLAYLIST[0].src);
  assert.equal(player.plays, 1);
  assert.equal(mock.errors.length, 1);
  ended(); // A failed source never actually began and cannot complete.
  mock.music.setPlaying(true);
  assert.equal(player.plays, 1);
  failSecondSource = false;
  mock.music.setPlaying(true, { userGesture: true });
  assert.equal(mock.music.status, 'playing');
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  assert.equal(mock.creates, 1);
  mock.music.dispose();
  assert.equal(ended, null);
});

test('native-style live Set completion dispatch returns before installing the next track listener', { timeout: 1000 }, async () => {
  const mock = setup();
  mock.music.setPlaying(true);
  const player = mock.players[0];
  assert.equal(player.emitEndedLive(), 1);
  assert.equal(player.src, MUSIC_PLAYLIST[0].src, 'the source must not change inside native event dispatch');
  assert.equal(player.plays, 1);
  await flushMusic();
  assert.equal(player.src, MUSIC_PLAYLIST[1].src);
  assert.equal(player.plays, 2);
  assert.equal(player.endedListenerCount, 1);
  assert.equal(player.emitEndedLive(), 1);
  await flushMusic();
  assert.equal(player.src, MUSIC_PLAYLIST[0].src);
  assert.equal(player.plays, 3);
  assert.equal(mock.creates, 1);
  mock.music.dispose();
});

for (const interruption of ['pause', 'disable', 'dispose', 'error']) {
  test(`an immediate ${interruption} after completion prevents its queued next-track playback`, async () => {
    const mock = setup();
    mock.music.setPlaying(true);
    const player = mock.players[0];
    player.emitEnded();
    if (interruption === 'pause') mock.music.setPlaying(false);
    if (interruption === 'disable') mock.music.toggle();
    if (interruption === 'dispose') mock.music.dispose();
    if (interruption === 'error') player.emitError(new Error('interrupted before next track'));
    await flushMusic();
    assert.equal(player.src, MUSIC_PLAYLIST[0].src);
    assert.equal(player.plays, 1);
    assert.equal(player.sourceChanges.length, 1);
    assert.equal(mock.music.status, { pause: 'paused', disable: 'disabled', dispose: 'disposed', error: 'blocked' }[interruption]);
    if (interruption === 'dispose') {
      assert.equal(player.endedListenerCount, 0);
      assert.equal(player.destroys, 1);
    } else {
      if (interruption === 'disable') mock.music.toggle();
      else mock.music.setPlaying(true, { userGesture: interruption === 'error' });
      assert.equal(player.src, MUSIC_PLAYLIST[1].src);
      assert.equal(player.plays, 2);
      assert.equal(player.sourceChanges.length, 2);
      mock.music.dispose();
    }
  });
}
