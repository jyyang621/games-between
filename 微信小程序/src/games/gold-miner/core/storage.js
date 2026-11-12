// Generated from vendor/gold-miner/storage.ts by vendor/gold-miner/generate.mjs.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SAVE = void 0;
exports.sanitize = sanitize;
exports.storageKey = storageKey;
exports.loadSave = loadSave;
exports.saveGame = saveGame;
exports.clearRun = clearRun;
const modes_js_1 = require("./modes.js");
const levels_js_1 = require("./levels.js");
exports.DEFAULT_SAVE = {
    version: 1,
    sound: true,
    bestEarned: 0,
    highestCleared: 0,
    checkpoint: null,
    shop: null,
};
const STORAGE_KEYS = {
    solo: 'gold-miner-save-v1', coop: 'gold-miner-save-coop-v1', versus: 'gold-miner-save-versus-v1',
};
const ENDLESS_STORAGE_KEYS = {
    solo: 'gold-miner-save-endless-v1', coop: 'gold-miner-save-coop-endless-v1', versus: 'gold-miner-save-versus-endless-v1',
};
const MAX_MONEY = 1000000000;
const MAX_ENDLESS_MONEY = 1000000000000;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isInteger(value, minimum, maximum) {
    return typeof value === 'number' && Number.isSafeInteger(value)
        && value >= minimum && value <= maximum;
}
function readRun(value, levelCount, maxMoney) {
    if (!isRecord(value)
        || !isInteger(value.levelIndex, 0, levelCount - 1)
        || !isInteger(value.wallet, 0, maxMoney)
        || !isInteger(value.bombs, 0, 5)
        || typeof value.strength !== 'boolean'
        || typeof value.diamondBonus !== 'boolean'
        || !isInteger(value.totalEarned, 0, maxMoney)) {
        return null;
    }
    const run = {
        levelIndex: value.levelIndex,
        wallet: value.wallet,
        bombs: value.bombs,
        strength: value.strength,
        diamondBonus: value.diamondBonus,
        totalEarned: value.totalEarned,
    };
    // The generator uses a 32-bit seed. A damaged optional seed does not discard progress.
    if (isInteger(value.seed, 0, 4294967295))
        run.seed = value.seed;
    if (value.layoutVersion === 2)
        run.layoutVersion = 2;
    if (value.match !== undefined) {
        const match = (0, modes_js_1.readMatch)(value.match, run.levelIndex, levelCount, maxMoney);
        if (!match)
            return null;
        run.match = match;
    }
    return run;
}
function readShop(value, levelCount, maxMoney) {
    const run = readRun(value, levelCount, maxMoney);
    if (!run || !isRecord(value) || !isRecord(value.purchaseCounts))
        return null;
    const counts = value.purchaseCounts;
    if (!isInteger(counts.bomb, 0, 2)
        || !isInteger(counts.strength, 0, 1)
        || !isInteger(counts.diamond, 0, 1))
        return null;
    return {
        levelIndex: run.levelIndex,
        wallet: run.wallet,
        bombs: run.bombs,
        strength: run.strength,
        diamondBonus: run.diamondBonus,
        totalEarned: run.totalEarned,
        ...(run.seed !== undefined ? { seed: run.seed } : {}),
        ...(run.layoutVersion === 2 ? { layoutVersion: 2 } : {}),
        purchaseCounts: {
            bomb: counts.bomb,
            strength: counts.strength,
            diamond: counts.diamond,
        },
    };
}
function sanitize(value, mode = 'solo', endless = false) {
    if (!isRecord(value) || value.version !== 1)
        return { ...exports.DEFAULT_SAVE };
    const levelCount = endless ? levels_js_1.MAX_ENDLESS_LEVEL : levels_js_1.CAMPAIGN_LEVEL_COUNT;
    const maxMoney = endless ? MAX_ENDLESS_MONEY : MAX_MONEY;
    const data = {
        version: 1,
        sound: typeof value.sound === 'boolean' ? value.sound : exports.DEFAULT_SAVE.sound,
        bestEarned: isInteger(value.bestEarned, 0, maxMoney) ? value.bestEarned : 0,
        highestCleared: isInteger(value.highestCleared, 0, levelCount) ? value.highestCleared : 0,
        checkpoint: readRun(value.checkpoint, levelCount, maxMoney),
        shop: readShop(value.shop, levelCount, maxMoney),
    };
    if (mode === 'versus') {
        data.shop = null;
        const run = data.checkpoint;
        if (run && (!run.match || run.totalEarned !== run.match.totals[0] + run.match.totals[1] || run.wallet !== run.totalEarned))
            data.checkpoint = null;
    }
    return data;
}
function storageKey(mode = 'solo', endless = false) {
    return (endless ? ENDLESS_STORAGE_KEYS : STORAGE_KEYS)[mode];
}
function loadSave(mode = 'solo', endless = false, read = () => null) {
    try {
        const raw = read(storageKey(mode, endless));
        return sanitize(typeof raw === 'string' ? JSON.parse(raw) : raw, mode, endless);
    }
    catch {
        return { ...exports.DEFAULT_SAVE };
    }
}
function saveGame(data, mode = 'solo', endless = false, write = () => false) {
    try {
        if (!isRecord(data) || data.version !== 1)
            return false;
        return write(storageKey(mode, endless), sanitize(data, mode, endless)) !== false;
    }
    catch {
        return false;
    }
}
/** Clears only the current adventure. The caller decides when to persist the result. */
function clearRun(data, mode = 'solo', endless = false) {
    const validated = sanitize(data, mode, endless);
    validated.checkpoint = null;
    validated.shop = null;
    return validated;
}
