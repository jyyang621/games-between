# Zuma source attribution

`original/model.ts` and `original/track.ts` are unchanged copies of `D:\祖玛Zuma\src\game` from the existing Marble Trail project, licensed under MIT by Marble Trail contributors (2026). The complete license is in `LICENSE`. `model.original.test.ts` preserves the original rule tests for reference. The source project is not modified by this port.

`src/games/zuma/core/*.js` is generated from the maintained `model.ts` and `track.ts` using TypeScript 5.9.3, targeting ES2019 CommonJS. Local model additions allow a supplied track, active-time acceleration and an optional smooth slowdown near the exit. Default construction retains the original 26 px/s constant speed. Projectile collision, insertion, matching and 190 px/s gap recall retain the original rules. `track.ts` remains unchanged. The mini game Canvas renderer adapts the original `TrailScene` palette, jade beetle, stone trail and marble patterns; it has no Phaser, DOM or browser dependency. Portrait mode rotates the original world and inversely transforms touches, preserving track geometry and physics.

From the repository root `D:\怀旧小游戏`, regenerate only when intentionally updating the vendored source:

```text
node 微信小程序/vendor/zuma/generate-core.cjs D:/祖玛Zuma/node_modules/typescript/lib/typescript.js
```

The normal build needs no TypeScript installation or access to the original folder. Verify the committed source/output hashes with:

```text
node 微信小程序/vendor/zuma/check-core.cjs
```

`src/games/zuma/state.js` adds a versioned local snapshot around the original core. It stores finite simulation state, gap combo metadata, and the number of random draws since construction; restore reconstructs the original seeded generator then advances those draws. This preserves future ammunition and chain reactions without saving an unbounded input replay. A live round always restores paused.

Touch interaction: tap the board to fire; drag to aim and release to fire. Cancel, pause, orientation changes and leaving the game discard the current gesture. Huge foreground frame deltas are clamped to 50 ms, matching the original scene's catch-up limit. Sound is not included in this Canvas port.

`src/games/zuma/levels.js` supplies six campaign definitions. The first retains the original route, seed 74219 and 78 marbles; the five additional routes and six palettes are original additions for this collection. Each definition can be passed directly to `new GameModel(definition)`. Campaign speed starts at 26–41 px/s, increases during each active round, and caps at 34–50 px/s. Endless mode generates one deterministic finite wave at a time, rotates these six routes, caps the wave at 126 marbles and forward speed at 48 px/s, then smoothly slows the approach from 78% to 95% of the route to 58% of its nominal speed. Neither wave counts nor difficulty parameters allocate an ever-growing list. Since the ramp depends on the saved `elapsed` value, pausing and restoration preserve its progression.

The values above describe the unscaled route baseline. Easy, Normal, Hard and Hell now apply speed multipliers of 1.6, 2.2, 3 and 4.2, and rounded population multipliers of 0.8, 1, 1.15 and 1.3. Endless hard caps are respectively 76.8, 105.6, 140 and 192 px/s. `session.js` maintains separate campaign/endless profiles for each difficulty and migrates earlier saves to Normal. Each definition carries exact earlier motion values so snapshots with those known settings can upgrade speed without losing the board, ammunition or progress.

The maintained model also supports optional rainbow ammunition (`wildcards:true` in collection levels; disabled in default legacy construction). Color 4 is reserved for ammunition and projectiles. After at least eight normal ammunition refills, a refill has a 4% chance of being rainbow; a rainbow resets that interval. One random draw per refill keeps random-state snapshots bounded and deterministic. A rainbow inherits the largest physically connected neighboring color run on impact, preferring the hit color on ties, then follows normal insertion, matching and scoring. It never remains a fifth color in the chain. Swap and color refresh preserve an existing rainbow. Snapshots store the refill interval, random draw count and any rainbow ammunition in flight; older snapshots without the rainbow setting or interval remain migratable when their existing physical configuration matches.

Ammo swap is available during ready, playing and paused states; it returns whether two different ammunition colors were exchanged. It consumes no random draw and cannot generate another rainbow. The controller saves the exchange, cancels an outstanding aim gesture, and gives explicit feedback for identical colors.
