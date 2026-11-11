'use strict';

const MUSIC_SETTINGS_KEY = 'games-between:music:settings:v1';
const MUSIC_PLAYLIST = Object.freeze([
  Object.freeze({ src: 'assets/audio/pingsha-luoyan.mp3', title: '平沙落雁' }),
  Object.freeze({ src: 'assets/audio/yangguan-sandie.mp3', title: '阳关三叠' }),
]);
const MUSIC_SOURCE = MUSIC_PLAYLIST[0].src;
const MUSIC_VOLUME = 0.4;

/** One shared player; the host decides when a game is actively running. */
function createMusic({ platform, read = () => null, write = () => false, onError = () => {} } = {}) {
  let enabled = true;
  try {
    const saved = read(MUSIC_SETTINGS_KEY);
    if (saved && typeof saved.enabled === 'boolean') enabled = saved.enabled;
  } catch {}

  let audio = null;
  let errorListener = null;
  let playListener = null;
  let endedListener = null;
  let supportsEnded = false;
  let trackIndex = 0;
  let trackGeneration = 0;
  let pendingAdvance = false;
  let needsSource = true;
  let wanted = false;
  let disposed = false;
  let blocked = false;
  let errorReported = false;
  let attempt = 0;
  let status = enabled ? 'idle' : 'disabled';

  function report(error) {
    if (errorReported) return;
    errorReported = true;
    try { onError(error); } catch {}
  }

  function pause() {
    attempt += 1; // A late browser play() rejection belongs to the old attempt.
    if (audio) {
      try { audio.pause(); } catch {}
    }
  }

  function fail(error, token) {
    if (disposed || token !== attempt || !wanted || !enabled) return;
    blocked = true;
    status = 'blocked';
    pause();
    report(error);
  }

  function prepareSource(player) {
    if (pendingAdvance) {
      trackIndex = (trackIndex + 1) % MUSIC_PLAYLIST.length;
      pendingAdvance = false;
      needsSource = true;
    }
    if (!needsSource) return;
    if (endedListener && typeof player.offEnded === 'function') player.offEnded(endedListener);
    endedListener = null;
    const generation = ++trackGeneration;
    if (supportsEnded) {
      endedListener = () => {
        if (disposed || player !== audio || generation !== trackGeneration || pendingAdvance || needsSource) return;
        // Invalidate this callback before changing sources. Native callbacks may
        // already be queued when offEnded removes their listener.
        trackGeneration += 1;
        attempt += 1;
        pendingAdvance = true;
        // A completion queued just before pause only selects the next track.
        // The host must request playback again before its source is loaded.
        if (!enabled || !wanted || blocked) return;
        // Return before rebinding native listeners: some platforms dispatch a
        // live listener collection. Recheck host state after that dispatch ends.
        Promise.resolve().then(() => {
          if (disposed || !enabled || !wanted || blocked || !pendingAdvance) return;
          status = 'idle';
          sync();
        });
      };
      player.onEnded(endedListener);
    }
    player.src = MUSIC_PLAYLIST[trackIndex].src;
    needsSource = false;
  }

  function getAudio() {
    if (audio) return audio;
    const player = platform.createInnerAudioContext();
    try {
      if (!player || typeof player.play !== 'function' || typeof player.pause !== 'function') {
        throw new TypeError('当前设备暂不支持背景音乐。');
      }
      // Keep the platform's mute-switch behavior; never force sound in silent mode.
      player.autoplay = false;
      supportsEnded = typeof player.onEnded === 'function';
      // Old adapters without completion events still provide a single-song loop.
      player.loop = !supportsEnded;
      player.volume = MUSIC_VOLUME;
      errorListener = error => fail(error, attempt);
      if (typeof player.onError === 'function') player.onError(errorListener);
      playListener = () => {
        // Native playback can begin after a pending request was paused. Use the
        // captured player even after disposal clears the controller reference.
        if (disposed || !enabled || !wanted || blocked) {
          try { player.pause(); } catch {}
          return;
        }
        status = 'playing';
      };
      if (typeof player.onPlay === 'function') player.onPlay(playListener);
      prepareSource(player);
      audio = player;
      return player;
    } catch (error) {
      trackGeneration += 1;
      needsSource = true;
      try { if (errorListener && player && typeof player.offError === 'function') player.offError(errorListener); } catch {}
      try { if (playListener && player && typeof player.offPlay === 'function') player.offPlay(playListener); } catch {}
      try { if (endedListener && player && typeof player.offEnded === 'function') player.offEnded(endedListener); } catch {}
      try { if (player && typeof player.destroy === 'function') player.destroy(); } catch {}
      errorListener = null;
      playListener = null;
      endedListener = null;
      throw error;
    }
  }

  function sync({ userGesture = false } = {}) {
    if (disposed) return false;
    if (!enabled) { status = 'disabled'; return false; }
    if (!wanted) { status = 'paused'; return false; }
    if (!platform || typeof platform.createInnerAudioContext !== 'function') {
      status = 'unsupported';
      report(new Error('当前设备暂不支持背景音乐。'));
      return false;
    }
    if (blocked && !userGesture) { status = 'blocked'; return false; }
    if (status === 'playing') return true;

    blocked = false;
    const token = ++attempt;
    status = 'playing';
    try {
      const player = getAudio();
      prepareSource(player);
      const result = player.play();
      // Native WeChat play() is void; the browser preview may return a Promise.
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).catch(error => fail(error, token));
      }
      return status === 'playing';
    } catch (error) {
      fail(error, token);
      return false;
    }
  }

  return {
    get enabled() { return enabled; },
    get status() { return status; },
    setPlaying(shouldPlay, options = {}) {
      if (disposed) return false;
      const previousWanted = wanted;
      wanted = Boolean(shouldPlay);
      if (!wanted && previousWanted) pause();
      return sync(options);
    },
    toggle() {
      if (disposed) return false;
      enabled = !enabled;
      try { write(MUSIC_SETTINGS_KEY, { enabled }); } catch {}
      if (!enabled) {
        pause();
        status = 'disabled';
      } else {
        blocked = false;
        errorReported = false;
        sync({ userGesture: true });
      }
      return enabled;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      wanted = false;
      trackGeneration += 1;
      pause();
      if (audio) {
        try { if (errorListener && typeof audio.offError === 'function') audio.offError(errorListener); } catch {}
        try { if (playListener && typeof audio.offPlay === 'function') audio.offPlay(playListener); } catch {}
        try { if (endedListener && typeof audio.offEnded === 'function') audio.offEnded(endedListener); } catch {}
        try { if (typeof audio.destroy === 'function') audio.destroy(); } catch {}
      }
      audio = null;
      errorListener = null;
      playListener = null;
      endedListener = null;
      status = 'disposed';
    },
  };
}

module.exports = { createMusic, MUSIC_SETTINGS_KEY, MUSIC_PLAYLIST, MUSIC_SOURCE, MUSIC_VOLUME };
