'use strict';

/** All platform storage failures are contained at the boundary. */
function createStorage(platform) {
  let available = true;
  return {
    read(key) {
      try {
        const value = platform.getStorageSync(key);
        return value === '' || value === undefined ? null : value;
      } catch { available = false; return null; }
    },
    write(key, value) {
      try { platform.setStorageSync(key, value); available = true; return true; }
      catch { available = false; return false; }
    },
    get available() { return available; },
  };
}

function saveKey(gameId, slot = 'save', version = 1) {
  if (!/^[a-z][a-z0-9-]*$/.test(gameId) || !/^[a-z][a-z0-9-]*$/.test(slot) || !Number.isSafeInteger(version) || version < 1) {
    throw new TypeError('存档需要有效的游戏 ID、槽位和版本号。');
  }
  return `games-between:${gameId}:${slot}:v${version}`;
}

module.exports = { createStorage, saveKey };
