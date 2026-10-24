# Blackout Browser

A Windows desktop browser by Pactuno, built with Electron and Chromium. Early access.

[Website](https://pactuno.online/blackout.html) · [Download for Windows](https://pactuno.online/downloads/Blackout-Setup.exe) · [Report an issue](https://github.com/justokaywith/blackout-browser/issues)

## Features

- Flexible tabs with mouse reordering and double-click close.
- Ctrl+Shift+T reopens a closed tab or restores a saved normal window after restarting.
- Private windows use a separate in-memory session and are excluded from saved window recovery.
- Favorites, themes, downloads, extensions and a music player.

Protection controls remain in development. Private browsing does not make network activity anonymous. No independently audited security claim is made.

## Run from source

Requires Windows x64 and Node.js 22 or newer.

~~~sh
npm ci
npm start
npm test
~~~

For optional media downloading, obtain yt-dlp.exe from its official yt-dlp/yt-dlp releases and place it in vendor/yt-dlp.exe. Do not download executables from issue comments or untrusted mirrors.

~~~sh
npm run package:win
~~~

The packaged installer uses the existing build/ artwork and NSIS configuration. Release binaries are distributed in GitHub Releases rather than committed to the source tree.

## Repository layout

- electron/: main process, preload and browser services
- ui/: browser HTML, styles and renderer code
- test/: Node regression tests
- build/: installer assets
- website/: Blackout public product-page source

Keep real browser profiles, credentials, logs and private browsing data out of contributions and bug reports. Report reproducible UI issues with app version and Windows version.

No new open-source license grant is added by this publication; applicable rights and third-party licenses remain with their respective holders.
