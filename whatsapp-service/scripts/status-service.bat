@echo off
title Status Tanabrew WhatsApp Service
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status.ps1"
exit
