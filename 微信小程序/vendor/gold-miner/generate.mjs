import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const output = resolve(directory, '../../src/games/gold-miner/core');
const names = ['engine', 'levels', 'modes', 'storage', 'viewport', 'renderer'];
const maintained = new Set(['engine', 'levels', 'renderer']);
const sourcePath = name => resolve(directory, maintained.has(name) ? '' : 'original', `${name}.ts`);
const hash = value => createHash('sha256').update(value).digest('hex');
const manifestPath = resolve(directory, 'manifest.json');

export async function checkGoldMinerSources() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.generator !== hash(await readFile(fileURLToPath(import.meta.url)))) throw new Error('Gold miner generator changed; regenerate the core.');
  for (const name of names) {
    for (const [kind, path] of [['original', resolve(directory, 'original', `${name}.ts`)], ['source', sourcePath(name)], ['output', resolve(output, `${name}.js`)]]) {
      if (manifest.files[name][kind] !== hash(await readFile(path))) throw new Error(`Gold miner ${name} ${kind} changed; regenerate the core.`);
    }
  }
  return true;
}

function adapt(name, input) {
  let source = input.replace(/from '\.\/original\/([^']+)\.ts'/g, "from './$1.js'").replace(/from '(\.\/[^']+)\.ts'/g, "from '$1.js'");
  if (name === 'storage') {
    source = source.replace('function sanitize(', 'export function sanitize(');
    const start = source.indexOf('/** Returns an independent, validated snapshot');
    const end = source.indexOf('/** Clears only the current adventure.');
    source = source.slice(0, start) + `
export function storageKey(mode: GameMode = 'solo', endless = false): string {
  return (endless ? ENDLESS_STORAGE_KEYS : STORAGE_KEYS)[mode];
}
export function loadSave(mode: GameMode = 'solo', endless = false, read: (key: string) => unknown = () => null): SaveData {
  try {
    const raw = read(storageKey(mode, endless));
    return sanitize(typeof raw === 'string' ? JSON.parse(raw) : raw, mode, endless);
  } catch { return { ...DEFAULT_SAVE }; }
}
export function saveGame(data: SaveData, mode: GameMode = 'solo', endless = false, write: (key: string, value: unknown) => unknown = () => false): boolean {
  try {
    if (!isRecord(data) || data.version !== 1) return false;
    return write(storageKey(mode, endless), sanitize(data, mode, endless)) !== false;
  } catch { return false; }
}
` + source.slice(end);
  }
  if (name === 'renderer') {
    source = source.replace('  private ctx: CanvasRenderingContext2D;\n  private background: HTMLCanvasElement;', '  private ctx: CanvasRenderingContext2D;');
    const start = source.indexOf('  constructor(private canvas: HTMLCanvasElement)');
    const end = source.indexOf('  setLevel(level: LevelDefinition)');
    source = source.slice(0, start) + `  constructor(ctx: CanvasRenderingContext2D) { this.ctx = ctx; }
  resize(view: MineViewport, displayScale = 1) {
    if (this.viewport.width !== view.width || this.viewport.height !== view.height || this.viewport.portrait !== view.portrait) {
      this.particles = []; this.floaters = []; this.blastRings = []; this.shake = 0;
    }
    this.viewport = { ...view };
    this.displayScale = displayScale > 0 ? displayScale : 1;
  }
  setContext(ctx: CanvasRenderingContext2D) { this.ctx = ctx; }

` + source.slice(end);
    source = source.replace('    this.rebuildBackground();\n', '');
    source = source.replace('    const ctx = this.background.getContext(\'2d\')!;', '    const ctx = this.ctx;');
    source = source.replace(/    ctx\.setTransform\(1, 0, 0, 1, 0, 0\);\r?\n    ctx\.clearRect\(0, 0, this\.background\.width, this\.background\.height\);\r?\n    ctx\.setTransform\(this\.background\.width \/ width, 0, 0, this\.background\.height \/ height, 0, 0\);\r?\n/, '');
    source = source.replace('    ctx.beginPath();ctx.roundRect(x,y,w,h,r);', `    const radius=Math.max(0,Math.min(r,w/2,h/2));
    ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
    ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();`);
    source = source.replace(/    ctx\.setTransform\(1,0,0,1,0,0\);ctx\.clearRect\(0,0,this\.canvas\.width,this\.canvas\.height\);\r?\n    ctx\.setTransform\(this\.canvas\.width\/width,0,0,this\.canvas\.height\/height,0,0\);ctx\.save\(\);/, '    ctx.save();');
    source = source.replace('    ctx.drawImage(this.background,0,0,width,height);', '    this.rebuildBackground();');
    // Canvas text letterSpacing is not consistently implemented in Mini Games.
    source = source.replace(/ctx\.letterSpacing=[^;]+;/g, '');
    source = source.replace('    for(let i=0;i<Math.round(360*textureArea);i++)', '    for(let i=0;i<Math.min(120,Math.round(360*textureArea));i++)');
  }
  return source;
}

export async function generateGoldMinerSources(typescriptPath) {
  const require = createRequire(import.meta.url);
  const ts = require(typescriptPath || 'typescript');
  await mkdir(output, { recursive: true });
  const manifest = { generator: hash(await readFile(fileURLToPath(import.meta.url))), files: {} };
  for (const name of names) {
    const original = await readFile(resolve(directory, 'original', `${name}.ts`), 'utf8');
    const source = await readFile(sourcePath(name), 'utf8');
    const input = source.replace(/\r\n/g, '\n');
    const result = ts.transpileModule(adapt(name, input), {
      fileName: `${name}.ts`, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, removeComments: false },
    });
    const generated = '// Generated from vendor/gold-miner/' + (maintained.has(name) ? name + '.ts' : 'original/' + name + '.ts') + ' by vendor/gold-miner/generate.mjs.\n' + result.outputText;
    if (/\b(?:window|document|HTMLCanvasElement)\b/.test(generated)) throw new Error(`Unexpected browser dependency in ${name}`);
    await writeFile(resolve(output, `${name}.js`), generated);
    manifest.files[name] = { original: hash(original), source: hash(source), output: hash(generated) };
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) { await checkGoldMinerSources(); console.log('Gold miner generated core is current.'); }
  else { const index = process.argv.indexOf('--typescript'); await generateGoldMinerSources(index >= 0 ? process.argv[index + 1] : undefined); }
}
