const fs = require('node:fs');
const path = require('node:path');
function readDownloads(file) {
  try {
    const entries = JSON.parse(fs.readFileSync(file,'utf8'));
    return Array.isArray(entries) ? entries.filter(d => d && typeof d.id === 'string' && typeof d.filename === 'string').slice(-500).map(d => ({...d, state: ['progressing','interrupted'].includes(d.state) ? 'interrupted' : d.state})) : [];
  } catch { return []; }
}
function saveDownloads(file, entries) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(entries.slice(-500)));
  fs.renameSync(temporary,file);
}
module.exports = {readDownloads, saveDownloads};
