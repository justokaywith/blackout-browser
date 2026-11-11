// Vendors the Ghostery adblocker into electron/vendor so the custom installer (which packs only
// electron/, ui/ and package.json) ships it, and pre-builds the filter engine so blocking works offline.
// Lists: Ghostery's prebuilt "ads and tracking" set (EasyList, EasyPrivacy, uBlock Origin filters
// including YouTube scriptlets). Re-run before each release to refresh the lists.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'electron/vendor');
fs.mkdirSync(out, { recursive: true });

// 1) Bundle the library (Electron stays external).
const entry = path.join(out, '.adblocker-entry.cjs');
fs.writeFileSync(entry, "module.exports=require('@ghostery/adblocker-electron');\n");
require('esbuild').buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], legalComments: 'eof', minifySyntax: true, outfile: path.join(out, 'ghostery-adblocker.cjs'), absWorkingDir: root });
fs.rmSync(entry);

// 2) Preload used for cosmetic filters and scriptlets (no dependencies besides electron).
fs.copyFileSync(path.join(root, 'node_modules/@ghostery/adblocker-electron-preload/dist/index.cjs'), path.join(out, 'ghostery-preload.cjs'));

// 3) Serialize the engine with lists fetched now.
(async () => {
  const { ElectronBlocker } = require(path.join(out, 'ghostery-adblocker.cjs'));
  const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  const bytes = blocker.serialize();
  fs.writeFileSync(path.join(out, 'adblock-engine.bin'), bytes);
  const meta = { builtAt: new Date().toISOString(), lists: 'ghostery prebuilt ads-and-tracking', bytes: bytes.length, library: require(path.join(root, 'node_modules/@ghostery/adblocker-electron/package.json')).version };
  fs.writeFileSync(path.join(out, 'adblock-engine.json'), JSON.stringify(meta, null, 2));
  console.log('Adblock engine', meta);
})().catch((error) => { console.error(error); process.exitCode = 1; });
