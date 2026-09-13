@echo off
setlocal
cd /d "%~dp0"
title Instalador - Vendedor IA WhatsApp
color 0A

echo ========================================
echo  Instalador - Vendedor IA para WhatsApp
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js instalado en esta PC.
  echo.
  echo Instala Node.js version 18 o superior desde:
  echo     https://nodejs.org
  echo.
  echo Elegi la version "LTS". Despues de instalarla, volve a hacer
  echo doble clic en instalar.bat para continuar.
  echo.
  pause
  exit /b 1
)

echo Node.js encontrado, version:
node -v
echo.

echo Instalando dependencias del proyecto...
echo (esto puede tardar varios minutos la primera vez, no cierres la ventana)
echo.
call npm install
if errorlevel 1 (
  echo.
  echo ========================================
  echo  Hubo un error instalando las dependencias.
  echo  Revisa el mensaje de arriba y volve a intentar.
  echo ========================================
  pause
  exit /b 1
)

echo.
echo Dependencias instaladas correctamente.
echo.
echo Verificando que el navegador necesario este disponible...
call npx puppeteer browsers install chrome
if errorlevel 1 (
  echo.
  echo No se pudo descargar el navegador automaticamente. No es grave: si esta PC
  echo ya tiene Google Chrome o Microsoft Edge instalado, el bot los va a usar
  echo directamente. Si al arrancar el bot te da un error de conexion, avisale a
  echo quien te instalo esto.
  echo.
)

echo.
echo ----------------------------------------
echo  Ahora vamos a configurar los datos del negocio
echo ----------------------------------------
echo.
node setup\configurar.js

echo.
echo ========================================
echo  Instalacion completa
echo ========================================
echo.
echo Antes de arrancar el bot, no te olvides de:
echo   1. Editar catalog.json con los productos/servicios reales del negocio
echo      (podes abrirlo con el Bloc de notas)
echo   2. Opcionalmente, sumar preguntas frecuentes en la carpeta knowledge\
echo.
echo Para arrancar el bot de ahora en mas, hace doble clic en iniciar.bat
echo.
pause
