const config = require('./config');
const { iniciarDashboard } = require('./dashboard');
const supervisor = require('./supervisor');

console.log(`Iniciando panel y vendedor IA para "${config.negocioNombre}"...`);

// El panel queda siempre encendido, corra o no el agente. Asi, si el agente
// se detiene (manualmente o por un error), el panel sigue disponible para
// reiniciarlo sin tener que volver a la consola.
iniciarDashboard();
supervisor.iniciarAgente();

// Si cerras esta ventana o apretas Ctrl+C, nos aseguramos de apagar tambien
// el agente (y su navegador) en vez de dejarlo huerfano corriendo en segundo plano.
function apagarTodo() {
  supervisor.detenerAgente();
  setTimeout(() => process.exit(0), 1000);
}
process.on('SIGINT', apagarTodo);
process.on('SIGTERM', apagarTodo);
