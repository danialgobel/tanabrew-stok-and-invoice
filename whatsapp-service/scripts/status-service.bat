@echo off
title Status Tanabrew WhatsApp Service
cd /d "D:\Downloads\tanabrew-stok-and-invoice-github\whatsapp-service"

echo ========================================================
echo   STATUS TANABREW WHATSAPP AUTOMATION SERVICE
echo ========================================================
echo.

powershell -NoProfile -Command ^
  "try { $r = Invoke-RestMethod -Uri 'http://localhost:3001/status' -TimeoutSec 4; Write-Host 'Server Port 3001: ONLINE [OK]' -ForegroundColor Green; if ($r.connected) { Write-Host 'Status WhatsApp: TERHUBUNG (Ready)' -ForegroundColor Green; Write-Host ('Akun           : ' + $r.user.name + ' (+' + $r.user.id + ')'); } else { Write-Host 'Status WhatsApp: MENUNGGU PENAUTAN (Belum Login)' -ForegroundColor Yellow; } } catch { Write-Host 'Server Port 3001: OFFLINE (Layanan Belum Dinyalakan)' -ForegroundColor Red; }"

echo.
powershell -NoProfile -Command ^
  "if (Get-Process cloudflared -ErrorAction SilentlyContinue) { Write-Host 'Cloudflare Tunnel: AKTIF [OK]' -ForegroundColor Green; try { $m = (Invoke-RestMethod -Uri 'http://127.0.0.1:20241/metrics' -TimeoutSec 2) -split \"`n\"; $u = ($m | Select-String 'userHostname=\"([^\"]+)\"'); if ($u -match 'userHostname=\"([^\"]+)\"') { Write-Host ('URL Publik       : ' + $matches[1]) -ForegroundColor Cyan; } } catch {} } else { Write-Host 'Cloudflare Tunnel: TIDAK AKTIF' -ForegroundColor Yellow; }"

echo.
echo ========================================================
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
exit
