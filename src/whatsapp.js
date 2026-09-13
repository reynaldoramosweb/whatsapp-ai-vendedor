const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const config = require('./config');
const { getConversacion, guardarConversacion } = require('./db');
const { construirSystemPrompt } = require('./prompts');
const { generarRespuesta } = require('./ai');
const { ejecutarTool, notificarDuenio, enviarImagenProducto } = require('./tools');
const { obtenerEstadoLicencia, mensajeVencimiento } = require('./licencia');
const { programarEnvio, esperar } = require('./envios');
const { obtenerCatalogo, normalizarClave } = require('./catalogo');
const { transcribirAudio } = require('./transcripcion');

// Si Puppeteer no pudo descargar su propio Chromium (pasa seguido en Windows por
// antivirus, permisos, o instalaciones sin scripts aprobados), usamos un Chrome/Edge
// que ya este instalado en la PC en vez de depender de esa descarga.
function detectarNavegadorInstalado() {
  const rutasPosibles = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  return rutasPosibles.find((ruta) => fs.existsSync(ruta));
}

const navegadorInstalado = detectarNavegadorInstalado();
if (navegadorInstalado) {
  console.log(`🌐 Usando navegador ya instalado: ${navegadorInstalado}`);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(navegadorInstalado ? { executablePath: navegadorInstalado } : {})
  }
});

// Momento (en segundos, formato timestamp de WhatsApp) desde el que se arranco
// el bot. Cualquier mensaje con fecha anterior es "viejo" (backlog que WhatsApp
// sincroniza al conectar) y NUNCA se responde, para no disparar una rafaga de
// respuestas automaticas a varios contactos de una (eso es lo que gatilla un
// bloqueo por spam).
const MOMENTO_INICIO = Math.floor(Date.now() / 1000);

// Ademas del filtro por fecha, esperamos un periodo de gracia despues de
// "ready" antes de empezar a responder, porque la sincronizacion de chats
// puede seguir emitiendo eventos unos segundos mas.
const SEGUNDOS_GRACIA = 20;
let botActivo = false;

// Espaciado minimo entre cada mensaje que el bot manda (ver src/envios.js,
// compartido tambien con tools.js para imagenes y avisos al dueño).

client.on('qr', (qr) => {
  console.log('\nEscaneá este QR con WhatsApp (el numero del negocio):\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado. Esperando sincronizacion antes de responder...');
  setTimeout(() => {
    botActivo = true;
    console.log('✅ Listo. El vendedor IA ya esta atendiendo mensajes nuevos.');
    avisarEstadoPrueba();
  }, SEGUNDOS_GRACIA * 1000);
});

async function avisarEstadoPrueba() {
  const licencia = obtenerEstadoLicencia();
  if (licencia.activada) return;

  if (licencia.vencida) {
    console.log('⛔ El periodo de prueba vencio. El bot no va a responder con IA hasta activar el plan.');
    await notificarDuenio(
      client,
      `⛔ El periodo de prueba de tu asistente IA vencio.\nEl bot dejo de responder consultas hasta activar el plan pago.`
    );
  } else if (licencia.diasRestantes <= 3) {
    console.log(`⏳ Quedan ${licencia.diasRestantes} dia(s) de prueba.`);
    await notificarDuenio(
      client,
      `⏳ Tu asistente IA esta en modo de prueba y le quedan ${licencia.diasRestantes} dia(s).\nDespues de eso, dejara de responder consultas hasta activar el plan pago.`
    );
  }
}

client.on('auth_failure', (msg) => {
  console.error('❌ Fallo de autenticacion:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ WhatsApp desconectado:', reason);
});

// msg.reply() a veces falla por una rareza interna de whatsapp-web.js
// ("Cannot read properties of undefined (reading 'getChat')"). Si eso pasa,
// respaldamos con un sendMessage directo al numero en vez de perder la respuesta.
async function responderMensaje(msg, texto) {
  try {
    return await msg.reply(texto);
  } catch (err) {
    console.warn('(msg.reply fallo, se manda con sendMessage directo)', err.message);
    return client.sendMessage(msg.from, texto);
  }
}

// Envia automaticamente la foto de cualquier producto con imagen que el bot
// haya mencionado por nombre en su respuesta, sin depender de que el modelo
// decida llamar a la funcion mostrar_imagen_producto. Evita repetir la misma
// foto mas de una vez por conversacion.
async function enviarImagenesDeProductosMencionados(texto, conv, numero, client) {
  if (!texto) return;
  const catalogo = await obtenerCatalogo();
  const textoNormalizado = normalizarClave(texto);
  if (!conv.imagenesMostradas) conv.imagenesMostradas = [];

  for (const producto of catalogo) {
    if (!producto.imagen) continue;
    if (conv.imagenesMostradas.includes(producto.nombre)) continue;

    const nombreNormalizado = normalizarClave(producto.nombre);
    if (nombreNormalizado.length < 4) continue; // evita falsos positivos con nombres muy cortos

    if (textoNormalizado.includes(nombreNormalizado)) {
      await enviarImagenProducto(producto.nombre, numero, client);
      conv.imagenesMostradas.push(producto.nombre);
    }
  }
}

function obtenerOCrearConversacion(numero) {
  const existente = getConversacion(numero);
  const ahora = Date.now();
  const minutosInactivo = existente
    ? (ahora - existente.ultimaActividad) / 1000 / 60
    : 0;

  if (!existente) {
    return {
      numero,
      etapa: 'inicio',
      historial: [],
      ultimaActividad: ahora,
      imagenesMostradas: []
    };
  }

  // Si estuvo mucho tiempo inactivo, reiniciamos la etapa (pero conservamos historial
  // reciente para no perder contexto si el cliente vuelve a escribir).
  if (minutosInactivo > config.minutosInactividad) {
    return { ...existente, etapa: 'inicio', imagenesMostradas: existente.imagenesMostradas || [] };
  }

  return { ...existente, imagenesMostradas: existente.imagenesMostradas || [] };
}

function recortarHistorial(historial) {
  if (historial.length <= config.maxHistorialMensajes) return historial;
  return historial.slice(-config.maxHistorialMensajes);
}

// Si un mismo cliente manda varios mensajes muy seguidos (por ejemplo, reenvia
// un audio porque no vio respuesta), esto asegura que se procesen de a uno,
// nunca en paralelo. Ademas de ser mas prolijo, evita mandar varias llamadas
// simultaneas a OpenRouter (lo que puede disparar limites de la cuenta).
const colasPorNumero = new Map();

function encolarPorNumero(numero, tarea) {
  const anterior = colasPorNumero.get(numero) || Promise.resolve();
  const actual = anterior.then(tarea, tarea).finally(() => {
    if (colasPorNumero.get(numero) === actual) colasPorNumero.delete(numero);
  });
  colasPorNumero.set(numero, actual);
  return actual;
}

// Descarga el audio con un reintento: whatsapp-web.js a veces falla la primera
// vez por una rareza interna de la libreria (da un error poco descriptivo tipo
// "r"), y suele andar bien en el segundo intento.
async function descargarMediaConReintento(msg, intentos = 2) {
  let ultimoError;
  for (let i = 1; i <= intentos; i++) {
    try {
      const media = await msg.downloadMedia();
      if (media && media.data) return media;
      ultimoError = new Error('downloadMedia devolvio vacio');
    } catch (err) {
      ultimoError = err;
    }
    if (i < intentos) await esperar(1000);
  }
  throw ultimoError;
}

function detalleError(err) {
  return (err && (err.message || err.stack)) || String(err);
}

client.on('message', async (msg) => {
  if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;
  if (msg.fromMe) return;
  await encolarPorNumero(msg.from, () => procesarMensaje(msg));
});

async function procesarMensaje(msg) {
  try {
    // Filtro clave anti-bloqueo: nunca responder mensajes de antes de arrancar
    // el bot, ni mientras todavia estamos en el periodo de gracia post-conexion.
    if (msg.timestamp < MOMENTO_INICIO) return;
    if (!botActivo) {
      console.log(`(en gracia, se ignora mensaje de ${msg.from})`);
      return;
    }

    // Si el periodo de prueba vencio y no se activo el plan pago, no se llama
    // a la IA: se responde siempre con el aviso de vencimiento.
    const licencia = obtenerEstadoLicencia();
    if (licencia.vencida) {
      await programarEnvio(() => responderMensaje(msg, mensajeVencimiento()));
      return;
    }

    const numero = msg.from;

    // Si es un audio o nota de voz, lo transcribimos primero y seguimos el
    // mismo camino que un mensaje de texto normal, con el texto transcripto.
    let textoUsuario = msg.body;

    if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
      if (!config.transcripcionHabilitada) {
        await programarEnvio(() =>
          responderMensaje(msg, 'Por ahora no puedo escuchar audios, ¿me lo podés escribir? 🙏')
        );
        return;
      }

      try {
        const media = await descargarMediaConReintento(msg);

        const transcripto = await transcribirAudio(media.data, media.mimetype);
        if (!transcripto) {
          await programarEnvio(() =>
            responderMensaje(msg, 'No pude entender bien el audio, ¿me lo podés escribir? 🙏')
          );
          return;
        }

        textoUsuario = transcripto;
        console.log(`🎙️ Audio transcripto de ${numero}: "${transcripto}"`);
      } catch (err) {
        console.error('Error transcribiendo audio:', detalleError(err));
        await programarEnvio(() =>
          responderMensaje(msg, 'Tuve un problema tecnico escuchando el audio, ¿me lo podés escribir?')
        );
        return;
      }
    }

    const conv = obtenerOCrearConversacion(numero);
    conv.historial.push({ role: 'user', content: textoUsuario });
    conv.historial = recortarHistorial(conv.historial);

    // Simulacion de tipeo humano: da mejor sensacion que responder instantaneo.
    // Es solo estetico, asi que si falla (puede pasar por incompatibilidades
    // internas de la libreria con WhatsApp Web) no debe frenar la respuesta real.
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
    } catch (err) {
      console.warn('(no se pudo simular "escribiendo...", se sigue igual)', err.message);
    }
    const demoraMs = 1500 + Math.random() * 2500;
    await esperar(demoraMs);

    const { textoFinal, mensajesNuevos } = await generarRespuesta(
      [{ role: 'system', content: await construirSystemPrompt() }, ...conv.historial],
      (nombre, args) => ejecutarTool(nombre, args, numero, client)
    );

    conv.historial.push(...mensajesNuevos);
    conv.ultimaActividad = Date.now();

    await programarEnvio(() => responderMensaje(msg, textoFinal || 'Disculpá, ¿podés repetir eso?'));

    // Si el texto menciona por nombre algun producto con foto, la manda sola,
    // sin que el cliente tenga que pedirla ni que la IA se acuerde de hacerlo.
    await enviarImagenesDeProductosMencionados(textoFinal, conv, numero, client);

    guardarConversacion(conv);
  } catch (err) {
    console.error('Error procesando mensaje:', detalleError(err));
    try {
      await programarEnvio(() =>
        responderMensaje(msg, 'Uy, tuve un problema tecnico. Ya te responde alguien del equipo en breve.')
      );
    } catch (_) {
      // si ni siquiera se puede responder, solo lo logueamos
    }
  }
}

module.exports = { client };
