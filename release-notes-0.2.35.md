# Blackout 0.2.35

Fixes startup exiting when the welcome splash closes before the main browser window is created. The welcome screen now has an explicit Open Blackout button, keyboard support and automatic continuation after1.6seconds. A4second watchdog, failed-load/crash handling and sender-validated IPC prevent a stuck welcome screen. Completed introductions stay skipped on later runs.

Uses the original Blackout mark, compact typography and reduced-motion support. Splash renderer is sandboxed. Existing profiles and the0.2.34 PDF viewer settings are preserved.120automated checks pass, including startup lifecycle and keyboard/button/automatic continuation. Native fresh-install acceptance remains pending in the Windows build environment.
