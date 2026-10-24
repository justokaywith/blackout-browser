; ────────────────────────────────────────────────────────────────
; Blackout Browser — Custom NSIS Installer Script
; Included automatically by electron-builder via build/installer.nsh
; ────────────────────────────────────────────────────────────────

!macro customHeader
!macroend

!macro preInit
!macroend

!macro customInstall
  ; Write a first-launch marker so the Electron app can show the splash animation on first run
  FileOpen $0 "$INSTDIR\resources\.first-launch" w
  FileWrite $0 "1"
  FileClose $0
!macroend

!macro customUnInstall
  Delete "$INSTDIR\resources\.first-launch"
!macroend
