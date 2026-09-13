const path = require('path');
const { exec } = require('child_process');
const express = require('express');

const config = require('./config');
const {
  leerDatosCompletos,
  actualizarEstadoPedido,
  actualizarEstadoEscalamiento,
  actualizarEstadoCita
} = require('./db');
const { obtenerEstadoLicencia } = require('./licencia');
const supervisor = require('./supervisor');

function requiereLogin(req, res, next) {
  if (!config.dashboardUsuario || !config.dashboardClave) return next();

  const header = req.headers.authorization || '';
  const [tipo, credenciales] = header.split(' ');
  if (tipo === 'Basic' && credenciales) {
    const [usuario, clave] = Buffer.from(credenciales, 'base64').toString('utf-8').split(':');
    if (usuario === config.dashboardUsuario && clave === config.dashboardClave) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Panel del vendedor IA"');
  return res.status(401).send('Acceso restringido.');
}

function ocultarNumero(numero) {
  // Formatea el numero de WhatsApp (viene como "5493884xxxxxx@c.us") a algo legible
  return numero.replace('@c.us', '');
}

function armarResumen() {
  const datos = leerDatosCompletos();
  const conversaciones = Object.values(datos.conversaciones || {});

  const ahora = Date.now();
  const unDiaMs = 24 * 60 * 60 * 1000;

  const pedidos = [...(datos.pedidos || [])].sort((a, b) => b.creado_en - a.creado_en);
  const escalamientos = [...(datos.escalamientos || [])].sort((a, b) => b.creado_en - a.creado_en);
  const citas = [...(datos.citas || [])].sort((a, b) => b.creado_en - a.creado_en);

  const conversacionesOrdenadas = conversaciones
    .map((c) => ({
      numero: ocultarNumero(c.numero),
      numeroId: encodeURIComponent(c.numero),
      etapa: c.etapa,
      cantidadMensajes: (c.historial || []).filter((m) => m.role === 'user').length,
      ultimaActividad: c.ultimaActividad,
      ultimoMensaje:
        [...(c.historial || [])].reverse().find((m) => m.role === 'user')?.content?.slice(0, 140) || ''
    }))
    .sort((a, b) => b.ultimaActividad - a.ultimaActividad);

  return {
    negocioNombre: config.negocioNombre,
    agendaCitasHabilitada: config.agendaCitasHabilitada,
    licencia: obtenerEstadoLicencia(),
    agente: supervisor.obtenerEstado(),
    stats: {
      totalConversaciones: conversaciones.length,
      conversacionesActivas24h: conversaciones.filter((c) => ahora - c.ultimaActividad < unDiaMs).length,
      totalPedidos: pedidos.length,
      pedidosHoy: pedidos.filter((p) => ahora - p.creado_en < unDiaMs).length,
      totalEscalamientos: escalamientos.length,
      escalamientosPendientes: escalamientos.filter((e) => e.estado === 'pendiente').length,
      citasPendientes: citas.filter((c) => c.estado === 'pendiente').length
    },
    pedidos: pedidos.map((p) => ({ ...p, numero: ocultarNumero(p.numero) })),
    escalamientos: escalamientos.map((e) => ({ ...e, numero: ocultarNumero(e.numero) })),
    citas: citas.map((c) => ({ ...c, numero: ocultarNumero(c.numero) })),
    conversaciones: conversacionesOrdenadas
  };
}

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(requiereLogin);
  app.use(express.static(path.join(__dirname, '..', 'dashboard', 'public')));

  app.get('/api/resumen', (req, res) => {
    try {
      res.json(armarResumen());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Historial completo de una conversacion puntual, para verla entera en el panel.
  app.get('/api/conversaciones/:numeroId', (req, res) => {
    try {
      const numero = decodeURIComponent(req.params.numeroId);
      const datos = leerDatosCompletos();
      const conv = datos.conversaciones[numero];
      if (!conv) return res.status(404).json({ error: 'Conversacion no encontrada' });

      const mensajes = (conv.historial || []).filter(
        (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
      );

      res.json({
        numero: ocultarNumero(conv.numero),
        etapa: conv.etapa,
        ultimaActividad: conv.ultimaActividad,
        mensajes
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/pedidos/:id/estado', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { estado } = req.body;
    const ok = actualizarEstadoPedido(id, estado);
    if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ ok: true });
  });

  app.post('/api/escalamientos/:id/estado', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { estado } = req.body;
    const ok = actualizarEstadoEscalamiento(id, estado);
    if (!ok) return res.status(404).json({ error: 'Escalamiento no encontrado' });
    res.json({ ok: true });
  });

  app.post('/api/citas/:id/estado', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { estado } = req.body;
    const ok = actualizarEstadoCita(id, estado);
    if (!ok) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json({ ok: true });
  });

  // Control del agente: para poder pausarlo/reiniciarlo/ver que esta pasando
  // sin tener que entrar a la consola de la PC.
  app.get('/api/agente/estado', (req, res) => {
    res.json(supervisor.obtenerEstado());
  });

  app.get('/api/agente/logs', (req, res) => {
    res.json({ logs: supervisor.obtenerLogs() });
  });

  app.post('/api/agente/iniciar', (req, res) => {
    res.json(supervisor.iniciarAgente());
  });

  app.post('/api/agente/detener', (req, res) => {
    res.json(supervisor.detenerAgente());
  });

  app.post('/api/agente/reiniciar', async (req, res) => {
    res.json(await supervisor.reiniciarAgente());
  });

  return app;
}

function abrirNavegador(url) {
  const plataforma = process.platform;
  const comando =
    plataforma === 'win32'
      ? `start "" "${url}"`
      : plataforma === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(comando, (err) => {
    if (err) {
      console.log(`(no se pudo abrir el navegador automaticamente, abrí manualmente: ${url})`);
    }
  });
}

function iniciarDashboard() {
  const app = crearApp();
  app.listen(config.dashboardPuerto, () => {
    const url = `http://localhost:${config.dashboardPuerto}`;
    console.log(`📊 Panel del vendedor disponible en ${url}`);
    if (!config.dashboardUsuario) {
      console.log(
        '   (sin usuario/clave configurados: cualquiera en tu red local puede abrirlo. ' +
          'Para protegerlo, completá DASHBOARD_USUARIO y DASHBOARD_CLAVE en el .env)'
      );
    }
    if (config.dashboardAutoAbrir) {
      abrirNavegador(url);
    }
  });
}

module.exports = { iniciarDashboard };
