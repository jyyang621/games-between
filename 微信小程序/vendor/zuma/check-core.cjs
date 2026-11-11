'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function checkCore() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'core-manifest.json'), 'utf8'));
  for (const file of manifest.files) {
    for (const [name, expected] of [[file.source, file.sourceSha256], [file.generated, file.generatedSha256]]) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, name))).digest('hex');
      if (actual !== expected) throw new Error('Zuma source/generated core drift: ' + name);
    }
  }
  return true;
}
module.exports = { checkCore };
if (require.main === module) { checkCore(); console.log('Zuma vendored source and generated core hashes match.'); }
