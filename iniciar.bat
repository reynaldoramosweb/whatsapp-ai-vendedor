@echo off
cd /d "%~dp0"
title Vendedor IA - WhatsApp
color 0A

if not exist ".env" (
  echo No se encontro el archivo .env
  echo.
  echo Primero tenes que ejecutar instalar.bat para configurar el bot.
  echo.
  pause
  exit /b 1
)

echo ========================================
echo  Vendedor IA - WhatsApp
echo ========================================
echo.
echo Iniciando... dejá esta ventana abierta mientras el bot este funcionando.
echo Para detenerlo, cerra esta ventana o apreta Ctrl+C.
echo.
echo El panel visual (pedidos, conversaciones, etc) se abre en el navegador en:
echo     http://localhost:3210
echo (o el puerto que hayas configurado en .env)
echo.

call npm start

echo.
echo El bot se detuvo.
pause
