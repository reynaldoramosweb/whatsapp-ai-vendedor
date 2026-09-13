const fs = require('fs');
const path = require('path');

const DIR_CONOCIMIENTO = path.join(__dirname, '..', 'knowledge');
const URLS_PATH = path.join(DIR_CONOCIMIENTO, 'urls.txt');

// Limite de caracteres para no disparar el costo de cada llamada a la IA.
// Si tu base de conocimiento es mas grande que esto, avisame y armamos
// busqueda por relevancia en vez de mandar todo entero.
const LIMITE_CARACTERES = 8000;

let conocimientoCache = '';

function limpiarHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function leerArchivos() {
  if (!fs.existsSync(DIR_CONOCIMIENTO)) {
    fs.mkdirSync(DIR_CONOCIMIENTO, { recursive: true });
  }

  const archivos = fs
    .readdirSync(DIR_CONOCIMIENTO)
    .filter((f) => f.toLowerCase().endsWith('.txt') || f.toLowerCase().endsWith('.pdf'));

  const partes = [];

  for (const archivo of archivos) {
    const ruta = path.join(DIR_CONOCIMIENTO, archivo);
    try {
      if (archivo.toLowerCase().endsWith('.txt')) {
        const texto = fs.readFileSync(ruta, 'utf-8');
        partes.push(`--- ${archivo} ---\n${texto.trim()}`);
      } else {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(ruta);
        const data = await pdfParse(buffer);
        partes.push(`--- ${archivo} ---\n${data.text.trim()}`);
      }
      console.log(`📄 Leido: ${archivo}`);
    } catch (err) {
      console.error(`⚠️ No se pudo leer ${archivo}:`, err.message);
    }
  }

  return partes;
}

async function leerUrls() {
  if (!fs.existsSync(URLS_PATH)) return [];

  const urls = fs
    .readFileSync(URLS_PATH, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const partes = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const texto = limpiarHtml(html);
      partes.push(`--- ${url} ---\n${texto}`);
      console.log(`🌐 Leida: ${url}`);
    } catch (err) {
      console.error(`⚠️ No se pudo leer ${url}:`, err.message);
    }
  }

  return partes;
}

async function cargarConocimiento() {
  const [partesArchivos, partesUrls] = await Promise.all([leerArchivos(), leerUrls()]);
  let completo = [...partesArchivos, ...partesUrls].join('\n\n');

  if (completo.length > LIMITE_CARACTERES) {
    console.warn(
      `⚠️ La base de conocimiento tiene ${completo.length} caracteres, se recorta a ${LIMITE_CARACTERES}.`
    );
    completo = completo.slice(0, LIMITE_CARACTERES);
  }

  conocimientoCache = completo;
  const totalFuentes = partesArchivos.length + partesUrls.length;
  console.log(
    totalFuentes > 0
      ? `📚 Base de conocimiento cargada: ${totalFuentes} fuente(s), ${completo.length} caracteres.`
      : '📚 No hay archivos ni URLs en /knowledge, el bot responde solo con el catalogo.'
  );
  return conocimientoCache;
}

function getConocimiento() {
  return conocimientoCache;
}

module.exports = { cargarConocimiento, getConocimiento };
