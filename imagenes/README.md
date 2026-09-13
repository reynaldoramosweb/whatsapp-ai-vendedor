# Imagenes de productos

Poné acá las fotos de los productos/servicios que quieras que el bot pueda mandar por
WhatsApp cuando los recomienda.

## Como usarlas

1. Copiá la foto acá adentro (ej: `imagenes/corte-de-pelo.jpg`).
2. En `catalog.json` (o la columna `imagen` si usas Excel/Google Sheets), agregale al
   producto correspondiente la ruta relativa:
   ```json
   {
     "nombre": "Corte de pelo",
     "precio": 8000,
     "moneda": "ARS",
     "descripcion": "Corte clasico",
     "stock": true,
     "imagen": "imagenes/corte-de-pelo.jpg"
   }
   ```
3. Reiniciá el bot si estaba corriendo (o, si el catalogo es JSON, el proximo mensaje ya
   lo toma sin reiniciar).

## Tambien podes usar una URL

Si la foto ya esta en internet (por ejemplo, subida a tu sitio web, Google Drive publico,
Instagram, etc), poné la URL completa en vez de un archivo local:
```json
"imagen": "https://tunegocio.com/fotos/corte.jpg"
```

## Formatos soportados

JPG, PNG, WEBP. Evitá archivos muy pesados (mas de 3-4 MB) porque tardan mas en enviarse
por WhatsApp.

## Como funciona ahora (envio automatico)

El bot manda la foto SOLO cuando su propia respuesta de texto menciona el producto por su
nombre exacto (tal como esta en el catalogo). No hace falta pedirla ni que el cliente la
pida — en cuanto el bot recomienda o habla de ese producto, la imagen sale sola, una sola
vez por conversacion (no se repite en cada mensaje aunque se siga hablando del mismo
producto). Los productos sin `imagen` funcionan igual que siempre, solo con texto.
