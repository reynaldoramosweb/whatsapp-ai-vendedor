const fs = require('fs');
const path = require('path');
const config = require('./config');

// Archivo separado de vendedor.json a proposito: asi un cliente que borra los
// pedidos/conversaciones para "empezar de cero" no reinicia sin querer el
// contador de la prueba.
const LICENCIA_PATH = path.join(__dirname, '..', '.licencia.json');

function obtenerFechaInstalacion() {
  if (fs.existsSync(LICENCIA_PATH)) {
    try {
      const datos = JSON.parse(fs.readFileSync(LICENCIA_PATH, 'utf-8'));
      if (typeof datos.fechaInstalacion === 'number') return datos.fechaInstalacion;
    } catch (err) {
      // si el archivo esta corrupto, lo recreamos abajo
    }
  }
  const fecha = Date.now();
  fs.writeFileSync(LICENCIA_PATH, JSON.stringify({ fechaInstalacion: fecha }, null, 2));
  return fecha;
}

function obtenerEstadoLicencia() {
  const fechaInstalacion = obtenerFechaInstalacion();
  const diasTranscurridos = (Date.now() - fechaInstalacion) / (1000 * 60 * 60 * 24);
  const diasRestantes = Math.max(0, Math.ceil(config.diasPrueba - diasTranscurridos));
  const vencida = !config.licenciaActivada && diasTranscurridos >= config.diasPrueba;

  return {
    activada: config.licenciaActivada,
    vencida,
    diasRestantes,
    diasTranscurridos: Math.floor(diasTranscurridos),
    diasPrueba: config.diasPrueba,
    fechaInstalacion
  };
}

function mensajeVencimiento() {
  return (
    `👋 Este asistente esta en modo de prueba y el periodo de evaluacion ya termino.\n\n` +
    `Para seguir usandolo, contactate ${config.contactoActivacion} para activar el plan pago.`
  );
}

module.exports = { obtenerEstadoLicencia, mensajeVencimiento };
