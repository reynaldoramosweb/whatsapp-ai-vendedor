const config = require('./config');
const { tools } = require('./tools');

async function llamarOpenRouter(mensajes) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages: mensajes,
      tools,
      max_tokens: 600,
      temperature: 0.6
    })
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${texto}`);
  }

  const data = await res.json();
  if (!data.choices || !data.choices.length) {
    throw new Error(`Respuesta inesperada de OpenRouter: ${JSON.stringify(data)}`);
  }
  return data.choices[0].message;
}

// Orquesta el flujo completo: llama al modelo, si pide ejecutar funciones
// las ejecuta, le devuelve el resultado, y vuelve a llamar al modelo para
// obtener el texto final que se le manda al cliente por WhatsApp.
async function generarRespuesta(historial, ejecutarTool) {
  const mensajes = [...historial];
  const primeraRespuesta = await llamarOpenRouter(mensajes);

  if (!primeraRespuesta.tool_calls || primeraRespuesta.tool_calls.length === 0) {
    return {
      textoFinal: primeraRespuesta.content,
      mensajesNuevos: [{ role: 'assistant', content: primeraRespuesta.content }]
    };
  }

  // El modelo pidio ejecutar una o mas funciones
  const mensajesNuevos = [
    {
      role: 'assistant',
      content: primeraRespuesta.content || null,
      tool_calls: primeraRespuesta.tool_calls
    }
  ];

  for (const toolCall of primeraRespuesta.tool_calls) {
    const args = JSON.parse(toolCall.function.arguments || '{}');
    const resultado = await ejecutarTool(toolCall.function.name, args);
    mensajesNuevos.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: resultado
    });
  }

  const segundaRespuesta = await llamarOpenRouter([...mensajes, ...mensajesNuevos]);
  mensajesNuevos.push({ role: 'assistant', content: segundaRespuesta.content });

  return {
    textoFinal: segundaRespuesta.content,
    mensajesNuevos
  };
}

module.exports = { generarRespuesta };
