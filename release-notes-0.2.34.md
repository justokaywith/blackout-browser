# Blackout 0.2.34

Enables the built-in Chromium PDF viewer in browser tabs and website popups. This corrects a missing viewer setting affecting local/downloaded PDFs. Renderer sandbox, context isolation, web security and disabled Node integration remain in place.

Viewer construction/security regression tests pass. Native rendering acceptance remains pending because the isolated Electron test process exits before initialization in the build environment. Existing user profiles are preserved by the installer.
