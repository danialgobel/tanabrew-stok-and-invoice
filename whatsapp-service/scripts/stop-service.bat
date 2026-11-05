@echo off
title Matikan Tanabrew WhatsApp Service
cd /d "D:\Downloads\tanabrew-stok-and-invoice-github\whatsapp-service"

echo ========================================================
echo   MEMATIKAN TANABREW WHATSAPP AUTOMATION SERVICE
echo ========================================================
echo.

:: 1. Find and kill process on port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 2. Kill cloudflared
taskkill /f /im cloudflared.exe >nul 2>&1

echo [OK] Layanan WhatsApp dan Cloudflare Tunnel berhasil dimatikan.
echo Memori RAM Anda telah dibebaskan sepenuhnya.
echo.
timeout /t 3 >nul
exit

