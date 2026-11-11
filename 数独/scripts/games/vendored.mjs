import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Committed generated cores make ordinary builds independent of TypeScript and
// the original projects. Regeneration remains an explicit vendor maintenance step.
export async function check({ output }) {
  const require = createRequire(import.meta.url);
  require(path.join(output, 'vendor', 'zuma', 'check-core.cjs')).checkCore();
  await access(path.join(output, 'src', 'games', 'zuma', 'LICENSE.txt'));
  const { checkGoldMinerSources } = await import(pathToFileURL(path.join(output, 'vendor', 'gold-miner', 'generate.mjs')));
  await checkGoldMinerSources();
  return '移植核心哈希与来源归属';
}

export const build = check;
