const fs = require('fs');
const path = require('path');

// Almacenamiento simple en un archivo JSON. No requiere compilar nada nativo
// (a diferencia de better-sqlite3), asi que instala sin problemas en Windows.
// Para el volumen de un solo negocio esto sobra y sin dolores de cabeza.

const DATA_PATH = path.join(__dirname, '..', 'vendedor.json');

function leerDatos() {
  if (!fs.existsSync(DATA_PATH)) {
    return { conversaciones: {}, pedidos: [], escalamientos: [], citas: [] };
  }
  try {
    const datos = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    // Por si el archivo viene de una version anterior sin citas.
    if (!datos.citas) datos.citas = [];
    return datos;
  } catch (err) {
    console.error('No se pudo leer vendedor.json, se reinicia vacio:', err.message);
    return { conversaciones: {}, pedidos: [], escalamientos: [], citas: [] };
  }
}

function guardarDatos(datos) {
  // Escritura atomica: primero a un .tmp y despues rename, para no corromper
  // el archivo si el proceso se corta a mitad de escritura.
  const tmpPath = DATA_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(datos, null, 2));
  fs.renameSync(tmpPath, DATA_PATH);
}

function getConversacion(numero) {
  const datos = leerDatos();
  return datos.conversaciones[numero] || null;
}

function guardarConversacion(conv) {
  const datos = leerDatos();
  datos.conversaciones[conv.numero] = {
    numero: conv.numero,
    etapa: conv.etapa,
    historial: conv.historial,
    ultimaActividad: conv.ultimaActividad,
    imagenesMostradas: conv.imagenesMostradas || []
  };
  guardarDatos(datos);
}

function crearPedido(numero, { producto, cantidad, datos_entrega, metodo_pago }) {
  const datos = leerDatos();
  const id = datos.pedidos.length ? datos.pedidos[datos.pedidos.length - 1].id + 1 : 1;
  datos.pedidos.push({
    id,
    numero,
    producto,
    cantidad: cantidad || 1,
    datos_entrega: datos_entrega || '',
    metodo_pago: metodo_pago || '',
    estado: 'pendiente',
    creado_en: Date.now()
  });
  guardarDatos(datos);
  return id;
}

function crearEscalamiento(numero, motivo) {
  const datos = leerDatos();
  const id = datos.escalamientos.length ? datos.escalamientos[datos.escalamientos.length - 1].id + 1 : 1;
  datos.escalamientos.push({
    id,
    numero,
    motivo: motivo || '',
    estado: 'pendiente',
    creado_en: Date.now()
  });
  guardarDatos(datos);
  return id;
}

function actualizarEstadoPedido(id, estado) {
  const datos = leerDatos();
  const pedido = datos.pedidos.find((p) => p.id === id);
  if (!pedido) return false;
  pedido.estado = estado;
  guardarDatos(datos);
  return true;
}

function actualizarEstadoEscalamiento(id, estado) {
  const datos = leerDatos();
  const escalamiento = datos.escalamientos.find((e) => e.id === id);
  if (!escalamiento) return false;
  escalamiento.estado = estado;
  guardarDatos(datos);
  return true;
}

function crearCita(numero, { nombre_cliente, fecha_hora, motivo }) {
  const datos = leerDatos();
  const id = datos.citas.length ? datos.citas[datos.citas.length - 1].id + 1 : 1;
  datos.citas.push({
    id,
    numero,
    nombre_cliente: nombre_cliente || '',
    fecha_hora: fecha_hora || '',
    motivo: motivo || '',
    estado: 'pendiente',
    creado_en: Date.now()
  });
  guardarDatos(datos);
  return id;
}

function actualizarEstadoCita(id, estado) {
  const datos = leerDatos();
  const cita = datos.citas.find((c) => c.id === id);
  if (!cita) return false;
  cita.estado = estado;
  guardarDatos(datos);
  return true;
}

// Lectura completa de solo lectura, pensada para el dashboard. Devuelve todo
// tal cual esta guardado, sin modificar nada.
function leerDatosCompletos() {
  return leerDatos();
}

module.exports = {
  getConversacion,
  guardarConversacion,
  crearPedido,
  crearEscalamiento,
  actualizarEstadoPedido,
  actualizarEstadoEscalamiento,
  crearCita,
  actualizarEstadoCita,
  leerDatosCompletos
};
