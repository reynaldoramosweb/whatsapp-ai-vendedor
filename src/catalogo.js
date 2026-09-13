const fs = require('fs');
const path = require('path');
const config = require('./config');

const JSON_PATH = path.join(__dirname, '..', 'catalog.json');

// Cache para Google Sheets: evita pegarle a Google en cada mensaje (lento y
// puede rate-limitear). Se refresca sola cada 2 minutos.
const SHEETS_CACHE_MS = 2 * 60 * 1000;
let cacheSheets = { datos: null, expira: 0 };

function normalizarClave(s) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // saca acentos
}

// Tolera nombres de columna con mayusculas/acentos distintos (ej "Precio",
// "PRECIO", "Descripción") y los mapea a nuestro esquema fijo.
function normalizarFila(fila) {
  const filaNormalizada = {};
  for (const [clave, valor] of Object.entries(fila)) {
    filaNormalizada[normalizarClave(clave)] = valor;
  }

  const get = (...claves) => {
    for (const c of claves) {
      if (filaNormalizada[c] !== undefined && filaNormalizada[c] !== '') return filaNormalizada[c];
    }
    return undefined;
  };

  const precio = get('precio');
  const stockCrudo = get('stock', 'disponible');
  const imagen = get('imagen', 'imagen_url', 'foto', 'foto_url');

  return {
    nombre: String(get('nombre', 'producto') || '').trim(),
    precio: precio !== undefined ? Number(precio) || 0 : 0,
    moneda: String(get('moneda') || 'ARS').trim(),
    descripcion: String(get('descripcion') || '').trim(),
    stock: stockCrudo === undefined ? true : /^(si|true|1|x|yes)$/i.test(String(stockCrudo).trim()),
    imagen: imagen ? String(imagen).trim() : undefined
  };
}

function leerDesdeJson() {
  try {
    const crudo = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    return crudo.filter((p) => p && p.nombre);
  } catch (err) {
    console.error('⚠️ No se pudo leer catalog.json:', err.message);
    return [];
  }
}

async function leerDesdeExcel() {
  const ExcelJS = require('exceljs');
  const archivo = path.join(__dirname, '..', config.catalogoExcelArchivo);
  try {
    if (!fs.existsSync(archivo)) {
      console.error(`⚠️ No se encontro el archivo de catalogo: ${config.catalogoExcelArchivo}`);
      return [];
    }

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(archivo);
    const hoja = libro.worksheets[0];
    if (!hoja) return [];

    const encabezados = {};
    hoja.getRow(1).eachCell((celda, col) => {
      encabezados[col] = String(celda.value ?? '').trim();
    });

    const filas = [];
    hoja.eachRow((fila, numFila) => {
      if (numFila === 1) return; // salteamos el encabezado
      const objeto = {};
      fila.eachCell({ includeEmpty: true }, (celda, col) => {
        const encabezado = encabezados[col];
        if (encabezado) objeto[encabezado] = celda.value;
      });
      filas.push(objeto);
    });

    return filas.map(normalizarFila).filter((p) => p.nombre);
  } catch (err) {
    console.error('⚠️ No se pudo leer el catalogo desde Excel:', err.message);
    return [];
  }
}

async function leerDesdeSheets() {
  const ahora = Date.now();
  if (cacheSheets.datos && ahora < cacheSheets.expira) {
    return cacheSheets.datos;
  }
  if (!config.catalogoSheetsUrl) {
    console.error('⚠️ CATALOGO_SHEETS_URL no esta configurada en el .env.');
    return cacheSheets.datos || [];
  }
  try {
    const Papa = require('papaparse');
    const res = await fetch(config.catalogoSheetsUrl);
    if (!res.ok) throw new Error(`respuesta ${res.status}`);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const productos = parsed.data.map(normalizarFila).filter((p) => p.nombre);
    cacheSheets = { datos: productos, expira: ahora + SHEETS_CACHE_MS };
    return productos;
  } catch (err) {
    console.error('⚠️ No se pudo leer el catalogo desde Google Sheets:', err.message);
    // Si falla pero ya tenemos un catalogo cacheado de antes, seguimos con ese
    // en vez de dejar al bot sin catalogo.
    return cacheSheets.datos || [];
  }
}

async function obtenerCatalogo() {
  if (config.catalogoFuente === 'excel') return leerDesdeExcel();
  if (config.catalogoFuente === 'sheets') return leerDesdeSheets();
  return leerDesdeJson();
}

module.exports = { obtenerCatalogo, normalizarClave };
