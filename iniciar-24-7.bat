@echo off
cd /d "%~dp0"
title Vendedor IA - Modo 24/7 (PM2)
color 0B

if not exist ".env" (
  echo No se encontro el archivo .env
  echo.
  echo Primero tenes que ejecutar instalar.bat para configurar el bot.
  echo.
  pause
  exit /b 1
)

where pm2 >nul 2>nul
if errorlevel 1 (
  echo PM2 no esta instalado. Instalando...
  call npm install -g pm2
  if errorlevel 1 (
    echo No se pudo instalar PM2. Revisa el error de arriba.
    pause
    exit /b 1
  )
)

echo ========================================
echo  Iniciando en modo 24/7 con PM2
echo ========================================
echo.
echo IMPORTANTE: PM2 corre el bot en segundo plano (no vas a ver una ventana
echo con el QR). Despues de que termine este script, corre:
echo     pm2 logs vendedor-ia
echo para ver el codigo QR y escanearlo. Una vez conectado, apreta Ctrl+C
echo para salir de los logs (el bot sigue corriendo igual en segundo plano).
echo Las siguientes veces que reinicies la PC no hace falta escanear de nuevo.
echo.
echo Si esto corre en un servidor/VPS sin pantalla (no esta PC), poné
echo DASHBOARD_AUTOABRIR=false en el .env para que no intente abrir un navegador.
echo.

call pm2 start src\index.js --name vendedor-ia
call pm2 save

echo.
echo ========================================
echo  El bot quedo corriendo en segundo plano.
echo ========================================
echo.
echo Para ver el QR y la actividad ahora mismo, corre:
echo   pm2 logs vendedor-ia
echo.
echo Otros comandos utiles:
echo   pm2 restart vendedor-ia   - reiniciar el bot
echo   pm2 stop vendedor-ia      - detener el bot
echo.
pause
