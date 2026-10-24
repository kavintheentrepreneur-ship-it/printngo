# Printngo Kiosk Hardware & Laptop Setup Guide

This guide details how to configure a physical laptop or mini-PC running **Windows 11** or **Ubuntu Linux** as an automated, self-healing Printngo self-service kiosk.

---

## 1. Operating System Power Management

To ensure uninterrupted self-service operation, the kiosk screen must never sleep, hibernate, or lock.

### Windows 11 Power Settings
1. Open **Windows Terminal (PowerShell as Administrator)** and run:
   ```powershell
   # Disable screen sleep when plugged into AC power
   powercfg -change -monitor-timeout-ac 0
   powercfg -change -standby-timeout-ac 0
   powercfg -change -hibernate-timeout-ac 0

   # Prevent laptop from sleeping when lid is closed
   powercfg -setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
   powercfg -setactive SCHEME_CURRENT
   ```
2. Disable Windows Lock Screen and notifications:
   - Settings > Accounts > Sign-in options > **Require sign-in**: set to **Never**.
   - Settings > System > Notifications: turn **Off**.

### Ubuntu Linux Power Settings
```bash
# Disable screen blanking and suspend
gsettings set org.gnome.desktop.session idle-delay 0
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

---

## 2. Chromium Fullscreen Kiosk Launcher

The kiosk display runs in dedicated Chromium Kiosk Mode without browser address bars, navigation buttons, or devtools.

### Windows Launcher Script (`start-kiosk.bat`)
Save to `C:\Printngo\start-kiosk.bat`:
```cmd
@echo off
title Printngo Kiosk Supervisor
cd /d "C:\Printngo"

:loop
echo [%date% %time%] Starting Printngo Kiosk Display...
start /wait "" "chrome.exe" ^
  --kiosk ^
  --incognito ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-translate ^
  --disable-features=Translate ^
  --disable-session-crashed-bubble ^
  --disable-infobars ^
  --check-for-update-interval=31536000 ^
  --user-data-dir="C:\Printngo\kiosk-profile" ^
  "http://localhost:3001/kiosk"

echo [%date% %time%] Browser exited. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
```

### Auto-start on Boot (Windows)
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a shortcut to `C:\Printngo\start-kiosk.bat` in this folder.
3. Configure Windows Auto-Logon using Microsoft Sysinternals `Autologon.exe`.

---

## 3. Print Agent Local Daemon Setup

The local print agent runs as a background Windows Service or Startup Task.

### Configuration (`apps/print-agent/.env`)
```env
DEFAULT_KIOSK_ID=kiosk_dev_01
DEFAULT_KIOSK_SECRET=kiosk_super_secret_hmac_key_32_chars
API_BASE_URL=http://localhost:4000/api/v1
PRINTER_NAME="Canon iR-ADV C3530" # Name of the default physical printer
```

### Starting the Print Agent
```powershell
pnpm --filter @printngo/print-agent start
```

---

## 4. Printer Verification & Testing

Verify that your office printer supports standard paper sizes:
1. Ensure the printer driver is installed and named correctly in `PRINTER_NAME`.
2. Verify trays have standard media loaded:
   - Tray 1: A4
   - Tray 2: A3 / Legal
3. Run test print:
   ```powershell
   pnpm --filter @printngo/print-agent test
   ```

---

## 5. Staff Console Access on Kiosk Screen
To access the hidden staff modal on the physical kiosk:
1. Tap the **Printngo Logo** on the top-left 5 times rapidly.
2. Enter the staff PIN: **`1234`**.
3. Options available:
   - **Pause Kiosk**: Disables QR and warns customers.
   - **Resume Kiosk**: Restores live self-service.
   - **Manual UPI Confirmation**: Enter reference code to confirm payment.
   - **Reprint**: Re-queue a failed or damaged print.
