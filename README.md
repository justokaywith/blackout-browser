<div align="center">
  <h1>Blackout Browser by Pactuno</h1>
  <p><strong>The Sovereign Dark Desktop Browser by Pactuno for Deep Focus &amp; Heavy Multitasking</strong></p>
  <p>
    Built with Electron and Chromium for Windows. Minimalist, privacy-first, with native vertical workflows and local media caching. Part of the Pactuno ecosystem.
  </p>
  <p>
    <a href="https://pactuno.online/downloads/Blackout-Setup.exe"><strong>Download for Windows (.exe)</strong></a>
    &nbsp;·&nbsp;
    <a href="https://pactuno.online/blackout.html"><strong>Official Website</strong></a>
    &nbsp;·&nbsp;
    <a href="https://github.com/justokaywith/blackout-browser/releases/latest">Release Notes</a>
    &nbsp;·&nbsp;
    <a href="ROADMAP.md">Roadmap</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/justokaywith/blackout-browser/issues">Report Issue</a>
  </p>
  <p>
    <img alt="Latest Release: v0.2.32" src="https://img.shields.io/badge/release-v0.2.32-blue.svg" />
    <img alt="Platform: Windows x64" src="https://img.shields.io/badge/platform-Windows%20x64-0078D6.svg" />
    <img alt="License: Freeware" src="https://img.shields.io/badge/license-Freeware-green.svg" />
    <img alt="Tests Passing" src="https://img.shields.io/badge/tests-110%20passing-brightgreen.svg" />
  </p>
</div>

---

## Why Blackout Browser?

Modern mainstream browsers have become heavy notification centers packed with sponsored content, forced telemetry, and cluttered horizontal tab strips that disappear when you open more than fifteen links.

**Blackout Browser by Pactuno** was built from the ground up for researchers, engineers, and power users who need:
* **Deep Work & Zero Clutter:** A bespoke obsidian-dark aesthetic with zero promotional bloat.
* **Resilient Tab Stacks:** Reorder, group, and instantly recover tabs and entire windows without session loss.
* **Local Offline Media:** Integrated music player that theme-syncs with the window and caches real audio locally for offline focus.
* **Hardened Web Compatibility:** Modern user-agent client hints for web apps like WhatsApp Web, plus built-in ad and tracker blocking.

---

## Key Features

### Advanced Tab Management & Recovery
* **Mouse Reordering & Fluid Selection:** Drag and rearrange tabs easily; double-click any tab to close instantly.
* **Durable Session Recovery:** Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> to restore recently closed tabs or restore an entire previous session across browser restarts.
* **True Private Windows:** Dedicated in-memory sessions that leave zero disk trace, completely isolated from normal saved recovery.

### Glassmorphic Music Player & Offline Audio
* **Theme-Synced Player:** Frosted glass overlay that adapts to dark appearance themes.
* **Verified Local Caching:** Automatically saves streamed tracks locally into safe cache storage so music continues playing even when you go offline.

### Privacy & Web Apps Support
* **Ad & Tracker Neutralization:** Enhanced filtering for video stream ads, popups, and invasive tracking scripts.
* **Modern Client Hints:** Complete User-Agent Client Hints profile ensuring seamless support for WhatsApp Web and modern web applications.
* **Windows System Integration:** Full native registration for default browser capabilities, URL schemes (`http`, `https`), and document formats (`.html`, `.htm`, `.pdf`, `.svg`, `.webp`).

---

## Download & Installation

### Option 1: Standalone Installer (Recommended)
Download the latest verified Windows setup package:
* **[Download Blackout-Setup.exe](https://pactuno.online/downloads/Blackout-Setup.exe)** (Direct from Pactuno CDN)
* **[View GitHub Releases](https://github.com/justokaywith/blackout-browser/releases/latest)**

Run `Blackout-Setup-0.2.32.exe` to install. The browser automatically registers Windows default application associations.

---

## Run from Source

### Prerequisites
* Windows 10/11 x64
* Node.js 22.x or newer
* Git

### Quickstart

```sh
# Clone repository
git clone https://github.com/justokaywith/blackout-browser.git
cd blackout-browser

# Install dependencies
npm ci

# Run development browser
npm start

# Run automated test suite (110 tests)
npm test
```

### Build Windows Installer

```sh
npm run package:win
```

The packaged installer will be generated using the embedded NSIS configuration and artwork.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | Open new tab |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close active tab |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> | Reopen closed tab / Restore session |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | Open new normal window |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd> | Open new isolated private window |
| <kbd>Ctrl</kbd> + <kbd>L</kbd> | Focus address and search bar |
| <kbd>F5</kbd> / <kbd>Ctrl</kbd> + <kbd>R</kbd> | Reload page |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Bookmark active tab |

---

## Repository Architecture

```text
blackout-browser/
├── electron/          # Main process, window lifecycle, IPC handlers, protocol registration
├── ui/                # Modern renderer HTML, CSS styling, glassmorphic player, tab bar
├── build/             # App icons, visual assets, and NSIS installer scripts
├── website/           # Product website landing pages
└── test/              # Comprehensive automated Node.js regression test suite (110 tests)
```

---

## Security & Privacy Guidelines

* Blackout Browser does not transmit private browsing telemetry, search queries, or browsing history to any remote server.
* Do not commit local browser profile directories, user session tokens, or personal credentials to public issue reports.
* For vulnerability reporting, please review our [Security Policy](SECURITY.md).

---

## Community & Resources

* [Pactuno Home](https://pactuno.online/)
* [Pactuno Blog & Technical Guides](https://pactuno.online/blog/)
* [Contributing Guide](CONTRIBUTING.md)
* [Project Roadmap](ROADMAP.md)
* [Code of Conduct](CODE_OF_CONDUCT.md)


## Android / Android TV

The separate Android early-access edition lives in [mobile/](mobile/). It reuses Blackout branding and core workflows with native Android tabs and System WebView. APKs are separate from Windows installers. See the mobile README for actual features, private-mode requirements and desktop-only limitations. Android validation is tracked by the Blackout Android workflow; do not assume Windows feature or security parity.
