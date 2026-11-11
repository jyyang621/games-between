/* Run: node wechat-minigame/vendor/zuma/generate-core.cjs [path/to/typescript.js]
 * TypeScript is needed only to regenerate, never to build or play the mini game.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require(process.argv[2] || 'typescript');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const files = ['model', 'track'].map(name => {
  const input = fs.readFileSync(path.join(__dirname, name + '.ts'), 'utf8');
  const output = '/* Generated from vendor/zuma/' + name + '.ts; MIT, Marble Trail contributors. */\n' +
    ts.transpileModule(input, { compilerOptions: {
      target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS, removeComments: false,
    } }).outputText;
  const target = path.join(__dirname, '../../src/games/zuma/core', name + '.js');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
  return { source: name + '.ts', generated: '../../src/games/zuma/core/' + name + '.js', sourceSha256: digest(input), generatedSha256: digest(output) };
});
fs.writeFileSync(path.join(__dirname, 'core-manifest.json'), JSON.stringify({
  sourceProject: 'Marble Trail / D:\\祖玛Zuma', license: 'MIT', compiler: 'TypeScript ' + ts.version,
  compilerOptions: { target: 'ES2019', module: 'CommonJS', removeComments: false }, files,
}, null, 2) + '\n');
console.log('Generated Zuma model and track, with source/output SHA-256 manifest.');
