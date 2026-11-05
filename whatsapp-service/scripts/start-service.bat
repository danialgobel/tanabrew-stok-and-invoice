@echo off
title Tanabrew WhatsApp Service
cd /d "D:\Downloads\tanabrew-stok-and-invoice-github\whatsapp-service"

echo ========================================================
echo   TANABREW WHATSAPP AUTOMATION SERVICE (CHROME ENGINE)
echo ========================================================
echo.

:: 1. Check if Node is already running on port 3001
netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo [INFO] WhatsApp Service sudah aktif di port 3001.
) else (
    echo [INFO] Menyalakan Tanabrew WhatsApp Service...
    start /min "Tanabrew WA Service" cmd /c "npm run start"
    timeout /t 3 /nobreak >nul
)

:: 2. Check if cloudflared is running
tasklist /fi "imagename eq cloudflared.exe" | findstr /i "cloudflared.exe" >nul
if %errorlevel% equ 0 (
    echo [INFO] Cloudflare Tunnel sudah aktif.
) else (
    echo [INFO] Menyalakan Cloudflare Tunnel...
    if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
        start /min "Tanabrew Tunnel" "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3001
    ) else (
        start /min "Tanabrew Tunnel" cloudflared tunnel --url http://localhost:3001
    )
)

echo.
echo ========================================================
echo   STATUS: LAYANAN AKTIF & SIAP MENGIRIM INVOICE PDF!
echo ========================================================
echo Jendela ini akan otomatis tertutup dalam 4 detik...
timeout /t 4 >nul
exit

