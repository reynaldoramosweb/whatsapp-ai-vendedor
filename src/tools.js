const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const { crearPedido, crearEscalamiento, crearCita } = require('./db');
const config = require('./config');
const { obtenerCatalogo, normalizarClave } = require('./catalogo');
const { programarEnvio } = require('./envios');

const tools = [
  {
    type: 'function',
    function: {
      name: 'confirmar_pedido',
      description: 'Registra un pedido cuando el cliente confirmo que quiere comprar.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre del producto o servicio del catalogo' },
          cantidad: { type: 'number', description: 'Cantidad pedida' },
          datos_entrega: { type: 'string', description: 'Direccion, horario o forma de entrega/retiro' },
          metodo_pago: { type: 'string', description: 'Efectivo, transferencia, tarjeta, etc' }
        },
        required: ['producto', 'cantidad']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'escalar_humano',
      description: 'Deriva la conversacion a una persona del negocio porque el bot no puede resolverlo.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Por que se deriva: reclamo, pregunta fuera de catalogo, pedido explicito del cliente, etc' }
        },
        required: ['motivo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mostrar_imagen_producto',
      description: 'Envia por WhatsApp la foto de un producto del catalogo que tenga imagen disponible.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre exacto del producto tal como aparece en el catalogo' }
        },
        required: ['producto']
      }
    }
  }
];

// La agenda de citas es opcional: solo se le ofrece al modelo si el negocio
// la habilito durante la configuracion (AGENDA_CITAS_HABILITADA=true).
if (config.agendaCitasHabilitada) {
  tools.push({
    type: 'function',
    function: {
      name: 'agendar_cita',
      description:
        'Registra una cita o reunion cuando el cliente pide agendar un horario con el negocio.',
      parameters: {
        type: 'object',
        properties: {
          nombre_cliente: { type: 'string', description: 'Nombre del cliente, si lo dio' },
          fecha_hora: {
            type: 'string',
            description: 'Fecha y horario que pidio el cliente, en el formato mas claro posible (ej: "jueves 8 de agosto, 15:00" o "10/08 10hs")'
          },
          motivo: { type: 'string', description: 'Para que es la cita/reunion' }
        },
        required: ['fecha_hora']
      }
    }
  });
}

// Ejecuta la accion real detras de cada tool call. Devuelve un texto corto
// que se le pasa de vuelta al modelo como resultado de la funcion.
async function ejecutarTool(nombre, args, numero, whatsappClient) {
  if (nombre === 'confirmar_pedido') {
    const id = crearPedido(numero, args);

    // Buscamos el producto en el catalogo para poder incluir precio y total
    // en la confirmacion, si lo encontramos.
    const catalogo = await obtenerCatalogo();
    const buscado = normalizarClave(args.producto || '');
    const producto =
      catalogo.find((p) => normalizarClave(p.nombre) === buscado) ||
      catalogo.find(
        (p) => normalizarClave(p.nombre).includes(buscado) || buscado.includes(normalizarClave(p.nombre))
      );

    const cantidad = Number(args.cantidad) || 1;
    const mensajeConfirmacion = construirMensajeConfirmacionPedido({
      id,
      producto: args.producto,
      cantidad,
      datosEntrega: args.datos_entrega,
      metodoPago: args.metodo_pago,
      precioUnitario: producto ? producto.precio : null,
      moneda: producto ? producto.moneda : 'ARS'
    });

    await programarEnvio(() => whatsappClient.sendMessage(numero, mensajeConfirmacion));

    await notificarDuenio(
      whatsappClient,
      `🛒 Nuevo pedido #${id}\nCliente: ${numero.replace('@c.us', '')}\nProducto: ${args.producto}\nCantidad: ${cantidad}\nEntrega: ${args.datos_entrega || '-'}\nPago: ${args.metodo_pago || '-'}`
    );

    return `Ya se le mando al cliente la confirmacion del pedido #${id} con todos los detalles (producto, cantidad, precio, entrega y pago). No repitas ese detalle en tu respuesta de texto: solo cerrá la conversacion de forma breve y calida, y pregunta si necesita algo mas.`;
  }

  if (nombre === 'escalar_humano') {
    crearEscalamiento(numero, args.motivo);
    await notificarDuenio(
      whatsappClient,
      `⚠️ Conversacion derivada a humano\nCliente: ${numero.replace('@c.us', '')}\nMotivo: ${args.motivo}`
    );
    return 'Conversacion marcada para atencion humana.';
  }

  if (nombre === 'agendar_cita') {
    const id = crearCita(numero, args);
    await notificarDuenio(
      whatsappClient,
      `📅 Nueva cita #${id}\nCliente: ${args.nombre_cliente || numero.replace('@c.us', '')}\nFecha/hora pedida: ${args.fecha_hora}\nMotivo: ${args.motivo || '-'}`
    );
    return `Cita #${id} registrada. Recordale al cliente que el negocio va a confirmar el horario.`;
  }

  if (nombre === 'mostrar_imagen_producto') {
    return enviarImagenProducto(args.producto, numero, whatsappClient);
  }

  return 'Funcion no reconocida.';
}

function construirMensajeConfirmacionPedido({
  id,
  producto,
  cantidad,
  datosEntrega,
  metodoPago,
  precioUnitario,
  moneda
}) {
  const lineas = [`✅ *Pedido confirmado* #${id}`, '', `🛒 *Producto:* ${producto}`, `🔢 *Cantidad:* ${cantidad}`];

  if (precioUnitario !== null && precioUnitario !== undefined) {
    const total = precioUnitario * cantidad;
    lineas.push(`💵 *Precio unitario:* $${precioUnitario} ${moneda}`);
    if (cantidad > 1) {
      lineas.push(`💰 *Total:* $${total} ${moneda}`);
    }
  }

  lineas.push(`📍 *Entrega/retiro:* ${datosEntrega || 'a coordinar'}`);
  lineas.push(`💳 *Pago:* ${metodoPago || 'a coordinar'}`);
  lineas.push('', '¡Gracias por tu compra! 🙌');

  return lineas.join('\n');
}

async function enviarImagenProducto(nombreProducto, numero, whatsappClient) {
  const catalogo = await obtenerCatalogo();
  const buscado = normalizarClave(nombreProducto || '');

  const producto =
    catalogo.find((p) => normalizarClave(p.nombre) === buscado) ||
    catalogo.find(
      (p) => normalizarClave(p.nombre).includes(buscado) || buscado.includes(normalizarClave(p.nombre))
    );

  if (!producto || !producto.imagen) {
    return 'No hay imagen disponible para ese producto. Segui la conversacion solo con texto.';
  }

  try {
    let media;
    if (/^https?:\/\//i.test(producto.imagen)) {
      media = await MessageMedia.fromUrl(producto.imagen, { unsafeMime: true });
    } else {
      const rutaLocal = path.join(__dirname, '..', producto.imagen);
      if (!fs.existsSync(rutaLocal)) {
        console.error(`⚠️ Imagen configurada pero no encontrada en disco: ${rutaLocal}`);
        return 'La imagen de ese producto no se encontro en el servidor. Segui solo con texto.';
      }
      media = MessageMedia.fromFilePath(rutaLocal);
    }

    const caption = `${producto.nombre} — $${producto.precio} ${producto.moneda}`;
    await programarEnvio(() => whatsappClient.sendMessage(numero, media, { caption }));
    return 'Imagen enviada correctamente. No hace falta que la describas en el texto.';
  } catch (err) {
    console.error('No se pudo enviar la imagen del producto:', err.message);
    return 'Hubo un problema tecnico enviando la imagen. Segui la conversacion solo con texto.';
  }
}

async function notificarDuenio(whatsappClient, mensaje) {
  if (!config.duenioNumero) return;
  const destino = config.duenioNumero.includes('@c.us')
    ? config.duenioNumero
    : `${config.duenioNumero}@c.us`;
  try {
    await whatsappClient.sendMessage(destino, mensaje);
  } catch (err) {
    console.error('No se pudo notificar al dueño:', err.message);
  }
}

module.exports = { tools, ejecutarTool, notificarDuenio, enviarImagenProducto };
