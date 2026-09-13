// Espaciado minimo entre cada mensaje que el bot manda (texto o imagen), para
// que nunca salga una rafaga aunque varias cosas se disparen casi juntas.
// Se comparte entre whatsapp.js (respuestas normales) y tools.js (imagenes,
// avisos al dueño) para que todo pase por el mismo control.
const GAP_MINIMO_ENVIO_MS = 3000;
let colaEnvios = Promise.resolve();
let ultimoEnvio = 0;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function programarEnvio(fn) {
  colaEnvios = colaEnvios.then(async () => {
    const espera = Math.max(0, GAP_MINIMO_ENVIO_MS - (Date.now() - ultimoEnvio));
    if (espera > 0) await esperar(espera);
    ultimoEnvio = Date.now();
    return fn();
  });
  return colaEnvios;
}

module.exports = { programarEnvio, esperar };
