const config = require('./config');

// Mapea el mimetype que manda whatsapp-web.js al "format" que espera OpenRouter.
// Las notas de voz de WhatsApp vienen casi siempre como audio/ogg (codec opus).
function formatoDesdeMimetype(mimetype) {
  const tipo = (mimetype || '').split(';')[0].trim().toLowerCase();
  const mapa = {
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
    'audio/flac': 'flac'
  };
  return mapa[tipo] || 'ogg';
}

// Devuelve el texto transcripto, o null si no se pudo transcribir (para que
// quien llama decida como avisarle al cliente).
async function transcribirAudio(base64Data, mimetype) {
  const formato = formatoDesdeMimetype(mimetype);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.transcripcionModelo,
        input_audio: { data: base64Data, format: formato },
        ...(config.transcripcionIdioma ? { language: config.transcripcionIdioma } : {})
      })
    });

    if (!res.ok) {
      const texto = await res.text();
      console.error(`⚠️ Error transcribiendo audio (${res.status}):`, texto);
      return null;
    }

    const data = await res.json();
    const texto = (data.text || '').trim();
    return texto || null;
  } catch (err) {
    console.error('⚠️ No se pudo transcribir el audio:', err.message);
    return null;
  }
}

module.exports = { transcribirAudio };
