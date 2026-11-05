[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor DarkGray
Write-Host "      STATUS TANABREW WHATSAPP AUTOMATION SERVICE       " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor DarkGray
Write-Host ""

# 1. Local Node.js Service Status
try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/status" -TimeoutSec 4
    Write-Host "Server Port 3001 : ONLINE [OK]" -ForegroundColor Green
    if ($res.connected) {
        Write-Host "Status WhatsApp  : TERHUBUNG (Ready) 🟢" -ForegroundColor Green
        Write-Host "Akun WhatsApp    : $($res.user.name) (+$($res.user.id))" -ForegroundColor White
    } else {
        Write-Host "Status WhatsApp  : MENUNGGU PENAUTAN (Belum Login)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Server Port 3001 : OFFLINE (Layanan Belum Dinyalakan)" -ForegroundColor Red
}

Write-Host ""

# 2. Cloudflare Tunnel Status
$cfProc = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($cfProc) {
    Write-Host "Cloudflare Tunnel: AKTIF [OK]" -ForegroundColor Green
    try {
        $metrics = Invoke-RestMethod -Uri "http://127.0.0.1:20241/metrics" -TimeoutSec 2
        if ($metrics -match 'userHostname="([^"]+)"') {
            $tunnelUrl = $matches[1]
            Write-Host "URL Publik Aktif : $tunnelUrl" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "💡 Salin URL di atas ke menu Pengaturan WhatsApp di Web Kasir" -ForegroundColor DarkCyan
            Write-Host "   jika web menampilkan pesan 'WhatsApp Belum Terhubung'." -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "URL Publik       : (Sedang proses inisialisasi...)" -ForegroundColor Yellow
    }
} else {
    Write-Host "Cloudflare Tunnel: TIDAK AKTIF (Jalankan shortcut Nyalakan)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor DarkGray
Write-Host "Tekan tombol apa saja untuk menutup jendela ini..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

