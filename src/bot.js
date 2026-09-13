const config = require('./config');

if (!config.openrouterApiKey) {
  console.error('❌ Falta OPENROUTER_API_KEY en el archivo .env');
  process.exit(1);
}

const { cargarConocimiento } = require('./knowledge');
const { client } = require('./whatsapp');

const MAX_REINTENTOS = 3;

function mostrarAyudaError(err) {
  const mensaje = err.message || String(err);
  console.error('\n❌ Error de conexion con WhatsApp:', mensaje);

  if (/spawn/i.test(mensaje)) {
    console.error(
      '\nEsto significa que no se pudo abrir el navegador que usa el bot por detras.\n' +
        'Pasos para solucionarlo:\n' +
        '1. Corré: npx puppeteer browsers install chrome\n' +
        '   (esto fuerza la descarga del navegador, puede tardar unos minutos)\n' +
        '2. Volvé a correr: npm start (o iniciar.bat)\n' +
        '3. Si en esta PC ya tenes Google Chrome o Edge instalado, el bot ahora lo\n' +
        '   detecta y usa automaticamente, asi que probablemente ni haga falta el paso 1.\n' +
        '4. Si nada de esto funciona, revisá que el antivirus no este bloqueando\n' +
        '   la carpeta node_modules del proyecto.\n'
    );
    return;
  }

  console.error(
    '\nEsto suele ser un problema transitorio conocido de whatsapp-web.js. Si persiste:\n' +
      '1. Cerrá el proceso (Ctrl+C) y borrá la carpeta "session" para forzar un QR nuevo.\n' +
      '2. Corré: npm install whatsapp-web.js@latest\n' +
      '3. Volvé a correr: npm start\n' +
      '4. Si te sigue pasando de forma intermitente, usá el boton "Reiniciar" del panel\n' +
      '   o PM2 para que reinicie solo — es la solucion mas robusta contra estos\n' +
      '   cuelgues esporadicos de la libreria.\n'
  );
}

// Red de seguridad: si algo dentro de la libreria de WhatsApp falla de una forma
// que no se puede atrapar con try/catch normal (pasa con este error puntual),
// esto evita que el proceso muera con un stack trace feo sin explicacion.
process.on('unhandledRejection', (err) => {
  mostrarAyudaError(err);
  process.exit(1);
});

// Si el panel (o quien sea) pide detener este proceso, cerramos el navegador
// de forma prolija antes de salir, para no dejar procesos de Chrome huerfanos.
async function apagarProlijo(señal) {
  console.log(`🛑 Deteniendo el agente (${señal})...`);
  try {
    await client.destroy();
  } catch (err) {
    // si ya estaba caido, no importa
  }
  process.exit(0);
}
process.on('SIGTERM', () => apagarProlijo('SIGTERM'));
process.on('SIGINT', () => apagarProlijo('SIGINT'));

async function conectarConReintentos(intento = 1) {
  try {
    await client.initialize();
  } catch (err) {
    console.error(`Intento ${intento}/${MAX_REINTENTOS} fallo.`);
    if (intento >= MAX_REINTENTOS) {
      mostrarAyudaError(err);
      process.exit(1);
    }
    console.log('Reintentando en 5 segundos...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await conectarConReintentos(intento + 1);
  }
}

async function iniciar() {
  console.log(`Iniciando vendedor IA para "${config.negocioNombre}"...`);
  await cargarConocimiento();
  await conectarConReintentos();
}

iniciar();
