const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {readDownloads,saveDownloads} = require('../electron/download-history.cjs');
test('completed downloads survive reload while unfinished transfers become interrupted', () => {
 const directory=fs.mkdtempSync(path.join(__dirname,'../work/download-history-')), file=path.join(directory,'downloads.json');
 saveDownloads(file,[{id:'one',filename:'report.pdf',savePath:'C:/report.pdf',state:'completed'},{id:'two',filename:'pending.zip',state:'progressing'}]);
 const restored=readDownloads(file);assert.equal(restored[0].savePath,'C:/report.pdf');assert.equal(restored[0].state,'completed');assert.equal(restored[1].state,'interrupted');
 saveDownloads(file,[]);assert.deepEqual(readDownloads(file),[]);
});
