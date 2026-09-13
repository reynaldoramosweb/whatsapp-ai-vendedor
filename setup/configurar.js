const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE_PATH = path.join(__dirname, '..', '.env.example');

const MODELOS = {
  '1': { slug: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (mejor calidad de venta, mas caro)' },
  '2': { slug: 'openai/gpt-4o-mini', label: 'GPT-4o mini (mas economico)' },
  '3': { slug: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (economico y rapido)' }
};

function leerEnvActual() {
  const valores = {};
  const rutaBase = fs.existsSync(ENV_PATH) ? ENV_PATH : ENV_EXAMPLE_PATH;
  if (!fs.existsSync(rutaBase)) return valores;
  const contenido = fs.readFileSync(rutaBase, 'utf-8');
  contenido.split('\n').forEach((linea) => {
    const match = linea.match(/^([A-Z_]+)=(.*)$/);
    if (match) valores[match[1]] = match[2];
  });
  return valores;
}

async function main() {
  console.log('========================================');
  console.log(' Configuracion del Vendedor IA');
  console.log('========================================');
  console.log('Respondé cada pregunta. Si ya hay un valor cargado, apretá Enter para dejarlo igual.\n');

  const actual = leerEnvActual();
  const rl = readline.createInterface({ input, output });
  const lector = rl[Symbol.asyncIterator]();

  async function preguntar(texto, valorActual) {
    const sufijo = valorActual ? ` (Enter para dejar: "${valorActual}")` : '';
    output.write(`${texto}${sufijo}\n> `);
    const { value, done } = await lector.next();
    if (done) return valorActual || '';
    const respuesta = value.trim();
    return respuesta || valorActual || '';
  }

  const negocioNombre = await preguntar('¿Nombre del negocio?', actual.NEGOCIO_NOMBRE);
  const vendedorNombre = await preguntar('¿Nombre del vendedor/a (como se presenta el bot)?', actual.VENDEDOR_NOMBRE || 'Sofia');
  const vendedorTono = await preguntar(
    '¿Tono de venta? (ej: cercano y directo, tuteo, emojis con moderacion)',
    actual.VENDEDOR_TONO || 'cercano y directo, tuteo, emojis con moderacion'
  );
  const duenioNumero = await preguntar(
    '¿Numero de WhatsApp del dueño para recibir avisos de pedidos? (cod. pais + numero, sin +, ej: 5493884000000)',
    actual.DUENIO_NUMERO
  );
  const openrouterApiKey = await preguntar('¿API Key de OpenRouter?', actual.OPENROUTER_API_KEY);

  console.log('\nModelos disponibles:');
  Object.entries(MODELOS).forEach(([num, m]) => console.log(`  ${num}) ${m.label}`));
  const opcionModelo = await preguntar('¿Cuál elegís? (1/2/3)', '1');
  const openrouterModel = (MODELOS[opcionModelo] || MODELOS['1']).slug;

  console.log(
    '\n¿Este negocio necesita agendar citas o reuniones con clientes? (ej: peluqueria, consultorio,\n' +
      'estudio, asesoria). Si decis que si, el bot va a poder tomar pedidos de horario y quedan\n' +
      'anotados en el panel visual para que el negocio los confirme.'
  );
  const agendaRespuesta = await preguntar('¿Habilitar agenda de citas? (s/n)', actual.AGENDA_CITAS_HABILITADA === 'true' ? 's' : 'n');
  const agendaCitasHabilitada = /^s/i.test(agendaRespuesta);

  console.log(
    '\n¿Como vas a mantener actualizado el catalogo de productos/servicios?\n' +
      '  1) Editando el archivo catalog.json a mano (mas simple, por defecto)\n' +
      '  2) Con un archivo Excel (catalog.xlsx en esta misma carpeta)\n' +
      '  3) Con una hoja de Google Sheets publicada en la web'
  );
  const fuenteActualNum = actual.CATALOGO_FUENTE === 'excel' ? '2' : actual.CATALOGO_FUENTE === 'sheets' ? '3' : '1';
  const opcionCatalogo = await preguntar('¿Cuál elegís? (1/2/3)', fuenteActualNum);
  const FUENTES = { '1': 'json', '2': 'excel', '3': 'sheets' };
  const catalogoFuente = FUENTES[opcionCatalogo] || 'json';

  let catalogoExcelArchivo = actual.CATALOGO_EXCEL_ARCHIVO || 'catalog.xlsx';
  let catalogoSheetsUrl = actual.CATALOGO_SHEETS_URL || '';

  if (catalogoFuente === 'excel') {
    catalogoExcelArchivo = await preguntar(
      '¿Nombre del archivo Excel? (tiene que estar en esta misma carpeta)',
      catalogoExcelArchivo
    );
  } else if (catalogoFuente === 'sheets') {
    console.log(
      '\nPara publicar la hoja: en Google Sheets, Archivo > Compartir > Publicar en la web >\n' +
        'elegí la hoja correcta > formato "Valores separados por comas (.csv)" > Publicar.\n' +
        'Pegá aca el link que te da (termina en "output=csv").'
    );
    catalogoSheetsUrl = await preguntar('¿URL publicada de Google Sheets?', catalogoSheetsUrl);
  }

  console.log(
    '\nEl bot incluye un panel visual con los pedidos y conversaciones, accesible desde el navegador.\n' +
      'Si le poner usuario y clave, va a pedir login para verlo (recomendado). Dejalos vacios\n' +
      '(Enter) si no te importa que cualquiera en la misma red WiFi lo pueda abrir sin clave.'
  );
  const dashboardUsuario = await preguntar('¿Usuario para el panel? (opcional)', actual.DASHBOARD_USUARIO);
  const dashboardClave = await preguntar('¿Clave para el panel? (opcional)', actual.DASHBOARD_CLAVE);

  rl.close();

  const contenido = `# --- OpenRouter ---
OPENROUTER_API_KEY=${openrouterApiKey}
OPENROUTER_MODEL=${openrouterModel}

# --- Datos del negocio ---
NEGOCIO_NOMBRE=${negocioNombre}
VENDEDOR_NOMBRE=${vendedorNombre}
VENDEDOR_TONO=${vendedorTono}

DUENIO_NUMERO=${duenioNumero}

MINUTOS_INACTIVIDAD=${actual.MINUTOS_INACTIVIDAD || '180'}
MAX_HISTORIAL_MENSAJES=${actual.MAX_HISTORIAL_MENSAJES || '20'}

# --- De donde se lee el catalogo ---
CATALOGO_FUENTE=${catalogoFuente}
CATALOGO_EXCEL_ARCHIVO=${catalogoExcelArchivo}
CATALOGO_SHEETS_URL=${catalogoSheetsUrl}

# --- Agenda de citas (opcional) ---
AGENDA_CITAS_HABILITADA=${agendaCitasHabilitada ? 'true' : 'false'}

# --- Panel visual (dashboard) ---
DASHBOARD_PUERTO=${actual.DASHBOARD_PUERTO || '3210'}
DASHBOARD_USUARIO=${dashboardUsuario}
DASHBOARD_CLAVE=${dashboardClave}
DASHBOARD_AUTOABRIR=${actual.DASHBOARD_AUTOABRIR || 'true'}

# --- Prueba / licencia (uso interno, no se pregunta aca) ---
DIAS_PRUEBA=${actual.DIAS_PRUEBA || '15'}
LICENCIA_ACTIVADA=${actual.LICENCIA_ACTIVADA || 'false'}
CONTACTO_ACTIVACION=${actual.CONTACTO_ACTIVACION || 'con quien te instalo este servicio'}
`;

  fs.writeFileSync(ENV_PATH, contenido);

  console.log('\n✅ Configuracion guardada en .env');
  console.log('\nTe falta, antes de arrancar:');
  if (catalogoFuente === 'json') {
    console.log('  1. Editar catalog.json con los productos/servicios reales del negocio.');
  } else if (catalogoFuente === 'excel') {
    console.log(`  1. Completar ${catalogoExcelArchivo} con los productos/servicios reales (ver catalog-plantilla.xlsx de ejemplo).`);
  } else {
    console.log('  1. Verificar que la hoja de Google Sheets tenga las columnas: nombre, precio, moneda, descripcion, stock, imagen.');
  }
  console.log('  2. (Opcional) sumar preguntas frecuentes en la carpeta knowledge/.');
  console.log('  3. (Opcional) sumar fotos de productos en la carpeta imagenes/ y referenciarlas en el catalogo.');
  console.log('\nCuando eso este listo, arrancá con iniciar.bat (o "npm start").');
  console.log(`El panel visual va a estar en: http://localhost:${actual.DASHBOARD_PUERTO || '3210'}\n`);
}

main().catch((err) => {
  console.error('❌ Error durante la configuracion:', err.message);
  process.exit(1);
});
