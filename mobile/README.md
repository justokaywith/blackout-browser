# Blackout for Android

A native Android / Android TV edition of Blackout, aligned with the desktop browser's mark, Obsidian surfaces, Eclipse/Ember/Aurora accents, tabs and compact favourites. **Early access; Android System WebView is the rendering engine.** Windows installers do not work on Android. Samsung Tizen TVs cannot install APKs; an Android/Android TV box is required.

## Supported features

- Real native tabs, switching/closing, long-press tab movement, reopen closed tabs and standard-session restore. Up to32 tabs; inactive rendering contexts are evicted to limit memory.
- Search/address navigation, bookmarks bar with previous/next scrolling, paged favourites with real website favicons and a neutral fallback, browsing history and search-engine selection.
- Browser light/dark appearance and three accent themes; website themes remain under website control.
- Separate-process private browsing on Android9+ with a separate WebView directory. Private visits are not saved to history or session restore. Standard cookies are not cleared when private browsing closes. Android8 users receive a clear unsupported notice for this feature.
- Confirmed downloads through Android Downloads, Android's user-selected file uploads, local PDF viewing and local audio playback while browsing.
- Fullscreen HTML5 media and device-supported Picture in Picture.
- Android TV launcher support, keyboard shortcuts, D-pad focus and optional virtual pointer. Device firmware must provide Android System WebView and a document picker for file selection.
- Default-denied website camera/microphone/location permissions, third-party cookies off, HTTPS certificate failures blocked, explicit clear-data confirmation and a small optional tracker-host denylist.

## Compatibility and limits

Android8/API26+; isolated private sessions require Android9/API28+. The APK has no ABI-specific native libraries. Actual compatibility depends on the firmware, available memory and WebView version. Keep System WebView updated. PTCL/Samsung hardware acceptance is separate from emulator tests.

Chrome desktop extensions, Windows WireGuard integration, Windows yt-dlp downloads, desktop window-management controls and Windows auto-updates are not Android features. Tracker blocking is a small host list, not comprehensive protection. Private mode does not hide activity from websites or networks; downloaded files remain. The system download service receives no browser session cookies. Session-protected or blob downloads need a website-provided downloadable link. Local music does not include a desktop YouTube extraction backend or guaranteed background playback after the app is stopped. No Tor/VPN/anonymity claims.

## Build

Install JDK17/21 and Android SDK35/build-tools34.0.0. Set ANDROID_HOME or create an ignored android/local.properties with sdk.dir. Then:

```sh
cd mobile/android
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintRelease
```

For a fresh checkout, Android expects a standard debug keystore; create an ignored mobile/.local/debug.keystore for this project's debug signing config:

```sh
mkdir -p ../.local
keytool -genkeypair -keystore ../.local/debug.keystore -storepass android -alias androiddebugkey -keypass android -dname CN=AndroidDebug,O=Android,C=US -validity 10000 -keyalg RSA -keysize 2048
```

Release signing uses a private mobile/keystore/keystore.properties and JKS. Missing release signing produces an unsigned release, never a silent debug-signed public APK. Keep the original release key for update compatibility. Keys, local SDK paths and build outputs must never be committed. The CI workflow uses only debug signing; production signing remains private.

## Validation

Navigation/file-scheme/download-path unit tests and Android UIAutomator journeys live under android/app/src/test and android/app/src/androidTest. The private-home journey checks Manage/PDF/Music/Search actions and normal/private cookie separation across processes. The remote-site fixture asserts that BlackoutNative is undefined. Tests use a loopback fixture, not customer accounts. Check the actual CI result before claiming device acceptance.

Source is published for version control under the parent repository's existing license/terms; no third-party browser branding or code was copied. Security reports: support@pactuno.online.

### TV picture cropped at the edges

Android 0.3.1 keeps browser controls inside a 5% screen-safe margin on Android TV/SHOQ boxes, including system-bar/cutout insets. Open **Menu → TV screen fit** and choose 3%, 5%, 7% or 10% if your TV needs a different margin. Full screen removes only the extra margin, never the system-bar protection. This adjusts browser layout without shrinking website text. Applies to standard and private browser windows; the local PDF reader also respects TV margins. Physical PTCL/SHOQ hardware acceptance is still required. See [Android TV layout guidance](https://developer.android.com/training/tv/playback/compose/layouts).
