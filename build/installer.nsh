; Custom NSIS script to uninstall any existing Haloryn build silently
; before installing the new one. Keeps the installer from failing on
; locked files that belong to the previous version.

!macro customInit
  ; Look up prior uninstall command (per-user install)
  ReadRegStr $0 HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Haloryn" "UninstallString"

  ; Fallback to machine-wide key if ever used
  StrCmp $0 "" 0 +2
    ReadRegStr $0 HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Haloryn" "UninstallString"

  ; If found, run it silently and wait
  StrCmp $0 "" done
    ExecWait '$0 /S'
  done:
!macroend
