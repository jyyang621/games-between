// Generated from vendor/gold-miner/original/modes.ts by vendor/gold-miner/generate.mjs.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_LABELS = void 0;
exports.emptyMatch = emptyMatch;
exports.roundWinner = roundWinner;
exports.scoreRound = scoreRound;
exports.readMatch = readMatch;
const levels_js_1 = require("./levels.js");
exports.MODE_LABELS = {
    solo: '单人模式', coop: '双人合作', versus: '双人对战',
};
function emptyMatch() {
    return { totals: [0, 0], wins: [0, 0], draws: 0 };
}
function roundWinner(incomes) {
    return incomes[0] === incomes[1] ? null : incomes[0] > incomes[1] ? 0 : 1;
}
/** A completed round creates a new score; replaying a checkpoint cannot mutate it. */
function scoreRound(previous, incomes) {
    const winner = roundWinner(incomes);
    return {
        totals: [previous.totals[0] + incomes[0], previous.totals[1] + incomes[1]],
        wins: [previous.wins[0] + (winner === 0 ? 1 : 0), previous.wins[1] + (winner === 1 ? 1 : 0)],
        draws: previous.draws + (winner === null ? 1 : 0),
    };
}
/** Reject partial/corrupt matches rather than inventing a player's missing score. */
function readMatch(value, completedRounds, maxRounds = levels_js_1.CAMPAIGN_LEVEL_COUNT, maxMoney = 1000000000) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return null;
    const source = value;
    const integer = (n, max) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
    if (!integer(completedRounds, maxRounds) ||
        !Array.isArray(source.totals) || source.totals.length !== 2 || !source.totals.every(n => integer(n, maxMoney)) ||
        !Array.isArray(source.wins) || source.wins.length !== 2 || !source.wins.every(n => integer(n, maxRounds)) ||
        !integer(source.draws, maxRounds) || source.wins[0] + source.wins[1] + source.draws !== completedRounds)
        return null;
    return { totals: [source.totals[0], source.totals[1]], wins: [source.wins[0], source.wins[1]], draws: source.draws };
}
