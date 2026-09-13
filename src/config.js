require('dotenv').config();

module.exports = {
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5',

  negocioNombre: process.env.NEGOCIO_NOMBRE || 'el negocio',
  vendedorNombre: process.env.VENDEDOR_NOMBRE || 'Asistente',
  vendedorTono: process.env.VENDEDOR_TONO || 'cercano y profesional',

  duenioNumero: process.env.DUENIO_NUMERO || null,

  minutosInactividad: parseInt(process.env.MINUTOS_INACTIVIDAD || '180', 10),
  maxHistorialMensajes: parseInt(process.env.MAX_HISTORIAL_MENSAJES || '20', 10),

  dashboardPuerto: parseInt(process.env.DASHBOARD_PUERTO || '3210', 10),
  dashboardUsuario: process.env.DASHBOARD_USUARIO || null,
  dashboardClave: process.env.DASHBOARD_CLAVE || null,
  dashboardAutoAbrir: process.env.DASHBOARD_AUTOABRIR !== 'false',

  agendaCitasHabilitada: process.env.AGENDA_CITAS_HABILITADA === 'true',

  diasPrueba: parseInt(process.env.DIAS_PRUEBA || '15', 10),
  licenciaActivada: process.env.LICENCIA_ACTIVADA === 'true',
  contactoActivacion: process.env.CONTACTO_ACTIVACION || 'con quien te instalo este servicio',

  // De donde se lee el catalogo: 'json' (catalog.json, por defecto), 'excel' (.xlsx),
  // o 'sheets' (Google Sheets publicada como CSV).
  catalogoFuente: process.env.CATALOGO_FUENTE || 'json',
  catalogoExcelArchivo: process.env.CATALOGO_EXCEL_ARCHIVO || 'catalog.xlsx',
  catalogoSheetsUrl: process.env.CATALOGO_SHEETS_URL || null,

  // Transcripcion de audios/notas de voz, via OpenRouter (misma API key de arriba).
  transcripcionHabilitada: process.env.TRANSCRIPCION_HABILITADA !== 'false',
  transcripcionModelo: process.env.TRANSCRIPCION_MODELO || 'openai/whisper-1',
  // Codigo de idioma (es, en, pt, etc). Vacio = detecta el idioma solo.
  transcripcionIdioma: process.env.TRANSCRIPCION_IDIOMA || 'es'
};

