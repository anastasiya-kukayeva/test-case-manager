const fs = require('fs');
const text = fs.readFileSync('node_modules/prosemirror-model/dist/index.js', 'utf8');
const idx = text.indexOf('marks() {');
console.log(text.slice(idx, idx + 1800));
