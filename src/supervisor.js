const { fork } = require('child_process');
const path = require('path');

const BOT_PATH = path.join(__dirname, 'bot.js');
const MAX_LINEAS_LOG = 500;
const SEÑAL_LISTO = 'Listo. El vendedor IA ya esta atendiendo';

let procesoHijo = null;
let estado = 'detenido'; // 'detenido' | 'iniciando' | 'corriendo' | 'deteniendo'
let detenidoManualmente = false;
let logs = [];
let timeoutListo = null;

function agregarLog(linea) {
  const hora = new Date().toLocaleTimeString('es-AR');
  logs.push(`[${hora}] ${linea}`);
  if (logs.length > MAX_LINEAS_LOG) logs.shift();
}

function procesarSalida(data, esError) {
  const texto = data.toString();
  // Seguimos mostrando todo en la consola real, tal como pasaba antes
  // (asi no se pierde la experiencia de ver el QR ahi si corres iniciar.bat).
  (esError ? process.stderr : process.stdout).write(texto);

  texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linea) => {
      agregarLog(esError ? `⚠️ ${linea}` : linea);
      if (linea.includes(SEÑAL_LISTO)) {
        estado = 'corriendo';
        if (timeoutListo) clearTimeout(timeoutListo);
      }
    });
}

function iniciarAgente() {
  if (procesoHijo) return { ok: false, motivo: 'ya esta corriendo' };

  detenidoManualmente = false;
  estado = 'iniciando';
  agregarLog('▶️ Iniciando el agente...');

  procesoHijo = fork(BOT_PATH, [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });

  procesoHijo.stdout.on('data', (data) => procesarSalida(data, false));
  procesoHijo.stderr.on('data', (data) => procesarSalida(data, true));

  procesoHijo.on('exit', (code) => {
    procesoHijo = null;
    if (timeoutListo) clearTimeout(timeoutListo);
    if (detenidoManualmente) {
      agregarLog('⏹️ Agente detenido.');
    } else {
      agregarLog(`⚠️ El agente se detuvo inesperadamente (codigo ${code}). Podes reiniciarlo desde el panel.`);
    }
    estado = 'detenido';
  });

  // Respaldo: si por algun motivo el texto exacto de "listo" cambia o no llega,
  // no dejamos el estado colgado en "iniciando" para siempre.
  timeoutListo = setTimeout(() => {
    if (estado === 'iniciando' && procesoHijo) estado = 'corriendo';
  }, 45000);

  return { ok: true };
}

function detenerAgente() {
  if (!procesoHijo) {
    estado = 'detenido';
    return { ok: false, motivo: 'ya esta detenido' };
  }
  detenidoManualmente = true;
  estado = 'deteniendo';
  agregarLog('⏹️ Deteniendo el agente (pedido desde el panel)...');
  procesoHijo.kill('SIGTERM');
  return { ok: true };
}

function reiniciarAgente() {
  agregarLog('🔄 Reiniciando el agente (pedido desde el panel)...');
  return new Promise((resolve) => {
    if (!procesoHijo) {
      iniciarAgente();
      return resolve({ ok: true });
    }
    detenidoManualmente = true;
    estado = 'deteniendo';
    const yaResolvio = { valor: false };
    procesoHijo.once('exit', () => {
      if (yaResolvio.valor) return;
      yaResolvio.valor = true;
      iniciarAgente();
      resolve({ ok: true });
    });
    procesoHijo.kill('SIGTERM');
    // Watchdog: si por algo no llega el exit, igual arrancamos de nuevo a los 6s.
    setTimeout(() => {
      if (yaResolvio.valor) return;
      yaResolvio.valor = true;
      procesoHijo = null;
      iniciarAgente();
      resolve({ ok: true });
    }, 6000);
  });
}

function obtenerEstado() {
  return { estado, corriendo: !!procesoHijo };
}

function obtenerLogs() {
  return logs;
}

module.exports = { iniciarAgente, detenerAgente, reiniciarAgente, obtenerEstado, obtenerLogs };
