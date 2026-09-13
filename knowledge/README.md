# Base de conocimiento

Todo lo que pongas en esta carpeta se le suma al bot como contexto extra, ademas del
catalogo (`catalog.json`). Sirve para preguntas frecuentes, politicas de envio, garantias,
horarios, informacion tecnica de productos, etc.

## Como cargar contenido

1. **Archivos de texto**: poné cualquier archivo `.txt` directo en esta carpeta.
2. **Archivos PDF**: poné cualquier archivo `.pdf` directo en esta carpeta (se le extrae el
   texto automaticamente).
3. **Paginas web**: creá (o editá) el archivo `urls.txt` en esta misma carpeta, una URL por
   linea. Ejemplo:
   ```
   https://tunegocio.com/preguntas-frecuentes
   https://tunegocio.com/envios
   ```
   Las lineas que empiecen con `#` se ignoran (sirve para comentarios).

## Importante

- El contenido se carga **una sola vez, al arrancar el bot** (`npm start`). Si modificás algo
  en esta carpeta o en `urls.txt`, tenés que reiniciar el bot (`Ctrl+C` y `npm start` de nuevo)
  para que tome los cambios.
- Hay un limite de 8000 caracteres en total (configurable en `src/knowledge.js`, variable
  `LIMITE_CARACTERES`). Si te pasás, se recorta y te avisa en la consola. Para catalogos de
  preguntas frecuentes de un negocio chico/mediano normalmente alcanza de sobra.
- Si tu base de conocimiento crece mucho (varios PDFs largos, muchas paginas), avisale a
  quien te armo el bot para pasar a busqueda por relevancia en vez de mandar todo entero
  (mas eficiente en costo de la IA).
