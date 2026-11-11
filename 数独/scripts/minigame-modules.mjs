import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Follow the same relative CommonJS graph in the native package and preview.
export async function collectMiniGameModules(directory, entry = 'src/main.js') {
  const modules = new Map();
  async function resolveModule(request) {
    if (request.startsWith('../') || path.posix.isAbsolute(request)) throw new Error(`小游戏模块越界：${request}`);
    const candidates = path.posix.extname(request) ? [request] : [`${request}.js`, `${request}/index.js`];
    for (const id of candidates) {
      try { return { id, source: await readFile(path.join(directory, id), 'utf8') }; }
      catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; }
    }
    throw new Error(`小游戏模块不存在：${request}`);
  }
  async function visit(request) {
    const { id, source } = await resolveModule(request);
    if (modules.has(id)) return;
    modules.set(id, source);
    for (const match of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!match[1].startsWith('.')) throw new Error(`小游戏不应依赖外部运行时：${id}: ${match[1]}`);
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(id), match[1]));
      await visit(dependency);
    }
  }
  await visit(entry);
  return [...modules].sort(([a], [b]) => a.localeCompare(b));
}
