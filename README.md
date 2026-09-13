# Vendedor IA para WhatsApp

Bot de WhatsApp que atiende, asesora y cierra ventas usando `whatsapp-web.js` + un modelo de IA
via OpenRouter (function calling). Pensado para un solo negocio/número de WhatsApp por instalación
(para instalarlo en varios clientes, copiá esta carpeta una vez por cliente).

## Que hace

- Responde al instante en el WhatsApp del negocio, las 24hs.
- Entiende audios y notas de voz: los transcribe y responde exactamente igual que si el
  cliente hubiera escrito.
- Asesora en base a un catalogo de productos/servicios (`catalog.json`) y, opcionalmente, una
  base de conocimiento extra (`knowledge/`).
- Cuando el cliente confirma que quiere comprar, registra el pedido, le manda una confirmacion
  con formato fijo (producto, cantidad, precio, total, entrega y pago) y le avisa al dueño del
  negocio por WhatsApp.
- Si un producto tiene foto configurada, la manda automaticamente al mencionarlo (ver seccion
  "Catalogo: fuente de datos e imagenes").
- Si la conversacion se complica (reclamo, algo fuera de catalogo, pedido explicito de hablar
  con una persona), deriva a un humano y tambien avisa al dueño.
- Guarda el historial de cada conversacion, asi que si el bot se reinicia no pierde contexto.
- Incluye un panel visual (dashboard) en el navegador con pedidos, derivaciones a humano y
  conversaciones activas, actualizado en vivo.

## Requisitos

- Node.js 18 o superior (`node -v` para chequear). Si no lo tenes, instalalo desde
  [nodejs.org](https://nodejs.org) (version "LTS").
- Un numero de WhatsApp dedicado al negocio (recomendado, no usar el numero personal).
- Una cuenta en [openrouter.ai](https://openrouter.ai) con creditos cargados y una API key.

## Instalacion rapida (Windows)

Para instalar esto en la PC de un cliente sin usar la terminal:

1. Copiá toda esta carpeta a la PC del cliente (o a la tuya, si vas a operar el bot vos).
2. Hacé **doble clic en `instalar.bat`**. Esto revisa que tenga Node.js instalado, instala
   las dependencias, y te va a preguntar los datos del negocio (nombre, tono de venta, numero
   para notificaciones, API key de OpenRouter, que modelo de IA usar) para armar el `.env` solo.
3. Cuando termine, editá `catalog.json` con los productos/servicios reales (con el Bloc de notas
   alcanza) y, si queres, sumá contenido en `knowledge/`.
4. Hacé **doble clic en `iniciar.bat`** para arrancar el bot y escanear el QR.

Para dejarlo corriendo 24/7 (que sobreviva si se cierra la ventana o se reinicia la PC), una vez
que ya probaste que funciona bien, usá `iniciar-24-7.bat` en vez de `iniciar.bat` — instala y usa
[PM2](https://pm2.keymetrics.io/) automaticamente.

## Instalacion manual (Mac/Linux, o si preferis la terminal)

1. **Entrar a la carpeta**:
   ```bash
   cd whatsapp-ai-vendedor
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```
   Ninguna de las dependencias requiere compilar nada nativo, asi que en Windows, Mac o Linux
   deberia instalar sin pedirte Python ni Visual Studio Build Tools.

3. **Configurar variables de entorno**. Con el asistente interactivo (recomendado):
   ```bash
   npm run setup
   ```
   O a mano:
   ```bash
   cp .env.example .env
   ```
   Editar `.env` y completar:
   - `OPENROUTER_API_KEY`: tu API key de OpenRouter
   - `OPENROUTER_MODEL`: que modelo usar (por defecto `anthropic/claude-sonnet-5`; para bajar
     costo podes probar `openai/gpt-4o-mini` o `google/gemini-2.0-flash-001`)
   - `NEGOCIO_NOMBRE`, `VENDEDOR_NOMBRE`, `VENDEDOR_TONO`: como se va a presentar el bot
   - `DUENIO_NUMERO`: tu numero (o el del dueño del negocio) para recibir notificaciones de
     pedidos y escalamientos. Formato: codigo de pais + numero, sin `+` (ej: `5493884000000`)

4. **Cargar el catalogo real** en `catalog.json` (reemplazar los productos de ejemplo):
   ```json
   [
     {
       "nombre": "Nombre del producto",
       "precio": 10000,
       "moneda": "ARS",
       "descripcion": "Que es, para quien, beneficio principal",
       "stock": true,
       "imagen": "imagenes/nombre-del-producto.jpg"
     }
   ]
   ```
   El catalogo se relee en cada mensaje, asi que podes editarlo con el bot corriendo y el
   proximo mensaje ya va a usar los datos nuevos (no hace falta reiniciar para esto en particular).
   El campo `imagen` es opcional (ruta local o URL) — ver la seccion **"Catalogo: fuente de
   datos e imagenes"** mas abajo para el detalle, y para usar Excel o Google Sheets en vez de
   este archivo.

5. **Ajustar el prompt de venta** si hace falta en `src/prompts.js` (proceso de venta, reglas de
   tono, como manejar objeciones). El catalogo se inyecta automaticamente ahi.

## Poner en funcionamiento

1. Levantar el bot:
   ```bash
   npm start
   ```

2. Va a aparecer un **codigo QR en la terminal**. Escanealo desde el WhatsApp del negocio:
   `WhatsApp > Configuracion > Dispositivos vinculados > Vincular un dispositivo`.

3. Cuando veas en consola `✅ WhatsApp conectado y listo`, el bot ya esta atendiendo. Cualquier
   mensaje que le llegue al numero vinculado (que no sea de un grupo) va a ser respondido por la IA.

4. La sesion de WhatsApp queda guardada en la carpeta `session/`, asi que no vas a tener que
   escanear el QR de nuevo en cada reinicio (salvo que cierres la sesion desde el celular).

## Dejarlo corriendo 24/7

Para que no se caiga cuando cerrás la terminal, usa un gestor de procesos. El mas simple es
[PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start src/index.js --name vendedor-ia
pm2 save
pm2 startup   # deja el proceso iniciando automaticamente si reinicia el servidor
```

Comandos utiles de PM2:
```bash
pm2 logs vendedor-ia     # ver logs en vivo
pm2 restart vendedor-ia  # reiniciar
pm2 stop vendedor-ia     # detener
```

> Nota: desde la version con panel de control, ya podes Iniciar/Detener/Reiniciar el agente
> y ver sus logs directamente desde el navegador (ver seccion "Panel visual"), sin instalar
> nada. PM2 sigue siendo util para un caso que el panel no cubre: que **todo el programa**
> (panel incluido) arranque solo si se reinicia la PC o el servidor.

Si lo vas a correr en una VPS (recomendado para produccion, ej. DigitalOcean, un droplet chico
alcanza), instala Node ahi, cloná/copiá el proyecto, y segui los mismos pasos.

## Catalogo: fuente de datos e imagenes

### De donde se lee el catalogo

Configurable con `CATALOGO_FUENTE` en el `.env` (o respondiendo la pregunta correspondiente
en `instalar.bat` / `npm run setup`). Tres opciones:

- **`json`** (por defecto): editas `catalog.json` a mano. Se relee en cada mensaje, no hace
  falta reiniciar el bot despues de cambiarlo.
- **`excel`**: el catalogo vive en un archivo `.xlsx` (por defecto `catalog.xlsx`, en la raiz
  del proyecto — configurable con `CATALOGO_EXCEL_ARCHIVO`). Tambien se relee en cada mensaje.
  Incluido `catalog-plantilla.xlsx` como ejemplo del formato esperado: abrilo con Excel/Google
  Sheets/LibreOffice para ver las columnas.
- **`sheets`**: el catalogo vive en una hoja de Google Sheets. Pasos para publicarla:
  1. En Google Sheets: `Archivo > Compartir > Publicar en la web`.
  2. Elegi la hoja correcta y el formato **"Valores separados por comas (.csv)"**.
  3. Publicar, copiar el link (termina en `output=csv`), y pegarlo en `CATALOGO_SHEETS_URL`.
  El bot cachea el resultado 2 minutos (para no pegarle a Google en cada mensaje), asi que un
  cambio en la hoja puede tardar hasta 2 minutos en reflejarse.

En los tres casos, las columnas/campos esperados son: `nombre`, `precio`, `moneda`,
`descripcion`, `stock` (`si`/`no`/`true`/`false`), e `imagen` (opcional, ver mas abajo). Para
Excel/Sheets, el nombre de columna no distingue mayusculas ni tildes (`Precio`, `PRECIO` y
`precio` funcionan igual), y tambien acepta `producto` en vez de `nombre` y `disponible` en
vez de `stock`.

### Fotos de productos

Cualquiera de las tres fuentes soporta una columna/campo `imagen` opcional, con:
- Una ruta local relativa (ej: `imagenes/corte-de-pelo.jpg`, poniendo el archivo real en la
  carpeta `imagenes/`), o
- Una URL completa a una foto ya publicada en internet (ej: `https://tusitio.com/foto.jpg`).

El envio es **automatico**: en cuanto la respuesta del bot menciona por su nombre exacto a un
producto que tiene imagen, la foto sale sola (con el nombre y precio como texto del mensaje),
sin que el cliente tenga que pedirla. Para no ser repetitivo, cada foto se manda una sola vez
por conversacion, aunque se siga hablando de ese producto despues. Los productos sin imagen
funcionan exactamente igual que antes, solo con texto. Mas detalle en `imagenes/README.md`.

## Audios y notas de voz

Cuando un cliente manda un audio o nota de voz por WhatsApp, el bot lo transcribe a texto
automaticamente (usando el mismo `OPENROUTER_API_KEY` que ya tenes configurado, sin necesidad
de otra cuenta) y lo procesa exactamente igual que si lo hubiera escrito: mismo catalogo,
mismo tono de venta, misma capacidad de confirmar pedidos, agendar citas o mandar fotos.

Si no se pudo entender el audio (mala conexion, ruido, formato raro), el bot le avisa al
cliente y le pide que lo escriba, en vez de fallar en silencio.

Configuracion en `.env` (los valores por defecto andan bien para la mayoria de los casos):
- `TRANSCRIPCION_HABILITADA`: en `false` lo desactiva (el bot le pide al cliente que escriba
  en vez de mandar audio).
- `TRANSCRIPCION_MODELO`: `openai/whisper-1` por defecto (confiable, ronda los u$s0.006 por
  minuto de audio). Podes cambiarlo por otro modelo de transcripcion de OpenRouter si queres.
- `TRANSCRIPCION_IDIOMA`: `es` por defecto. Dejalo vacio si el negocio atiende clientes en
  varios idiomas y preferis que lo detecte solo.

Cada audio transcripto genera un costo pequeño en tu cuenta de OpenRouter (ademas del costo
normal de la respuesta de IA), asi que si el negocio recibe muchisimos audios por dia, es
bueno tenerlo en cuenta al calcular el gasto mensual.

### Si te aparece "Error transcribiendo audio" en la consola

El mensaje de error de whatsapp-web.js suele ser poco descriptivo (a veces literalmente una
letra). El bot ya reintenta la descarga del audio una vez sola antes de rendirse, asi que si
el error persiste despues de eso, puede ser:
- **Problema de conexion a internet** de la PC del negocio.
- **Cuenta de OpenRouter sin creditos o con creditos muy bajos** — ver seccion siguiente.

### Error 402 de OpenRouter ("in_flight_budget_exhausted" o "insufficient credits")

Este error es de tu cuenta de OpenRouter, no del bot: significa que no tenes saldo suficiente,
o que tu cuenta tiene muy poco saldo y por eso OpenRouter solo te deja tener 1 o 2 pedidos
"en simultaneo" (algo que se agota rapido si un cliente manda varios mensajes/audios seguidos).

**Solucion**: cargar creditos en [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits).
Con apenas unos dolares de saldo cargado, ese limite de "en simultaneo" sube bastante y el
problema deja de aparecer. El bot ya procesa los mensajes de un mismo cliente de a uno (no en
paralelo) para no agravar esto, pero si varios clientes distintos escriben a la vez, cada uno
sigue generando su propio pedido a la IA.


## Base de conocimiento (opcional)

Ademas del catalogo, le podes sumar al bot preguntas frecuentes, politicas de envio, garantias,
o cualquier info extra, para que responda con mas precision.

Poné archivos `.txt` o `.pdf` directo en la carpeta `knowledge/`, o URLs (una por linea) en
`knowledge/urls.txt`. El bot los lee automaticamente al arrancar. Mas detalle en
`knowledge/README.md`.

Ojo: se carga solo al iniciar (`npm start`). Si cambiás algo ahí, reiniciá el bot para que lo
tome.

## Panel visual (dashboard)

El bot levanta automaticamente un panel web en **http://localhost:3210** (o el puerto que
pongas en `DASHBOARD_PUERTO`), sin necesidad de nada extra, y **se abre solo en tu navegador**
apenas arranca el bot (podes desactivar esto con `DASHBOARD_AUTOABRIR=false` en el `.env`, por
ejemplo en instalaciones en servidor sin pantalla). Ahi se ve:

- **Estadisticas rapidas**: conversaciones totales, activas en las ultimas 24hs, pedidos de
  hoy, pedidos totales, derivaciones a humano pendientes (y citas pendientes, si esa funcion
  esta habilitada).
- **Pedidos**: fecha, numero, producto, cantidad, y un selector para marcarlos como
  `entregado` o `cancelado` a medida que los vas gestionando.
- **Agenda de citas** *(opcional, ver mas abajo)*: fecha/hora que pidio cada cliente, motivo,
  y un selector para marcarlas `confirmada` o `cancelada`.
- **Derivados a humano**: fecha, numero y motivo por el que el bot no pudo resolver la
  consulta solo, con un selector para marcarlos como `atendido`.
- **Conversaciones**: lista de todas las conversaciones, con la etapa en la que estan y el
  ultimo mensaje del cliente. **Hace clic en cualquiera para ver la conversacion completa**
  (todos los mensajes, en formato de chat) en una ventana emergente.
- **Control del agente**: estado en vivo (corriendo / iniciando / detenido), y botones para
  **Iniciar**, **Reiniciar** y **Detener** el agente, mas un visor de **logs** en tiempo real —
  todo sin tener que abrir una consola. Detalle abajo.

Se actualiza solo cada 8 segundos (no hace falta refrescar la pagina a mano).

### Control del agente sin usar la consola

Arriba del todo en el panel hay una barra con el estado del agente y cuatro botones:

- **Iniciar**: prende el agente si estaba detenido.
- **Reiniciar**: lo apaga y lo vuelve a prender (util si esta haciendo algo raro, sin tener
  que cerrar la ventana de la consola). No hace falta volver a escanear el QR: la sesion de
  WhatsApp queda guardada.
- **Detener**: lo apaga. El bot deja de responder mensajes hasta que lo vuelvas a iniciar. El
  panel sigue andando igual, para poder prenderlo de nuevo cuando quieras.
- **Ver logs**: abre un visor con la actividad reciente del agente (conexiones, errores,
  pedidos procesados, etc), actualizado cada 3 segundos mientras esta abierto — lo mismo que
  verias en la consola, pero desde el navegador.

Tecnicamente, esto funciona porque el panel y el agente corren como **dos procesos separados**:
el panel (que siempre queda prendido) controla al agente como si fuera un proceso hijo. Asi,
aunque detengas o reinicies el agente, el panel nunca se cae — siempre vas a poder volver a
prenderlo desde ahi. Si el agente se cae solo por un error (no porque lo detuviste vos), el
panel lo marca claramente como "Detenido" y el motivo queda en los logs, listo para que le des
a "Reiniciar".

**Para verlo desde tu celular** (util para chequear pedidos sin estar en la PC), conectate a
la misma red WiFi que la PC donde corre el bot, y entra a `http://[IP-de-esa-PC]:3210` desde el
navegador del celular. Para saber la IP de la PC en Windows: `ipconfig` en PowerShell, buscá
"Direccion IPv4".

**Seguridad**: por defecto, cualquiera en la misma red (WiFi del local, por ejemplo) puede
abrir el panel sin pedir nada. Si te importa, completá `DASHBOARD_USUARIO` y `DASHBOARD_CLAVE`
en el `.env` (o respondé esas preguntas en `instalar.bat` / `npm run setup`) para que pida
usuario y clave.

### Agenda de citas (opcional)

Pensada para negocios que agendan turnos o reuniones (peluquerias, consultorios, estudios,
asesorias, etc), no solo venden productos. Se activa respondiendo "s" a la pregunta
correspondiente en `instalar.bat` / `npm run setup`, o poniendo `AGENDA_CITAS_HABILITADA=true`
a mano en el `.env`.

Cuando esta activada:
- El bot puede tomar el pedido de dia/horario del cliente (usando la funcion `agendar_cita`) y
  le aclara que el negocio va a confirmar el turno — el bot no tiene acceso a una agenda real,
  solo registra la solicitud.
- Aparece la seccion "Agenda de citas" en el panel visual, con nombre del cliente, fecha/hora
  pedida, motivo, y un selector de estado (`pendiente` / `confirmada` / `cancelada`).
- Le llega un aviso por WhatsApp al dueño del negocio (`DUENIO_NUMERO`) por cada cita nueva,
  igual que con los pedidos.

Si el negocio no la necesita, dejala en `false` (o simplemente no la actives): el bot ni
menciona la posibilidad de agendar, y la seccion no aparece en el panel.

## Prueba gratuita de 15 dias (uso interno, para vos como instalador)

Cada instalacion arranca en modo de prueba automaticamente, sin que tengas que configurar
nada. Asi funciona:

- La primera vez que corre el bot en la PC del cliente, se guarda la fecha en un archivo
  `.licencia.json` (separado de `vendedor.json` a proposito, para que borrar pedidos/historial
  no reinicie sin querer el contador).
- Pasados `DIAS_PRUEBA` (15 por defecto, configurable en `.env`), el bot deja de responder con
  IA a los clientes por WhatsApp. En su lugar, contesta siempre con un aviso fijo explicando que
  la prueba vencio y que se contacten con vos para activar el plan (el texto exacto de contacto
  sale de `CONTACTO_ACTIVACION` en el `.env` — poné ahi tu numero o email).
- El dueño del negocio recibe un aviso por WhatsApp cuando quedan 3 dias o menos, y otro cuando
  vence, para que sepa que tiene que gestionar el pago.
- En el panel visual aparece un banner (amarillo si quedan pocos dias, rojo si ya vencio).

**Para activar el plan pago** cuando el cliente te paga, entrá a la carpeta de ese cliente
(remoto con AnyDesk/TeamViewer, o yendo vos) y corré:
```bash
npm run activar
```
Reiniciá el bot despues (`Ctrl+C` y `iniciar.bat` de nuevo, o `pm2 restart vendedor-ia` si esta
en modo 24/7) para que tome el cambio. Esto pone `LICENCIA_ACTIVADA=true` en el `.env` de esa
instalacion puntual, sin limite de tiempo.

**Limitaciones a tener en cuenta:**
- Esto corre completamente local, sin verificar nada contra un servidor tuyo. Es un freno
  practico para un dueño de negocio comun, pero alguien con conocimientos tecnicos podria
  editar el `.env` o borrar `.licencia.json` para saltarselo. Para la gran mayoria de tus
  clientes esto no va a ser un problema.
- El asistente de instalacion (`instalar.bat` / `npm run setup`) no pregunta nada sobre esto a
  proposito, para no exponerselo al cliente. Si necesitas cambiar `DIAS_PRUEBA` o
  `CONTACTO_ACTIVACION` para un cliente puntual, editalo vos a mano en su `.env`.


## Riesgo de bloqueo de WhatsApp (leer antes de conectar tu número real)

`whatsapp-web.js` no es la API oficial de WhatsApp Business, automatiza WhatsApp Web. Eso trae
un riesgo real: si el bot responde en ráfaga a varios contactos de una (por ejemplo, al conectar
por primera vez, cuando WhatsApp sincroniza el historial de chats no leídos), el sistema
antispam de WhatsApp puede bloquear la cuenta.

Este proyecto ya incluye mitigaciones para eso:
- **Nunca responde mensajes viejos**: cualquier mensaje anterior al momento en que arrancó el
  bot se ignora, aunque WhatsApp lo reenvíe al sincronizar.
- **Período de gracia de 20 segundos** después de conectar, antes de empezar a responder.
- **Espaciado mínimo de 3 segundos entre cada mensaje enviado**, para que nunca salga una ráfaga.

Aun así, seguí estas reglas:
- **Nunca pruebes esto por primera vez con el número real del negocio.** Usá un número
  secundario (un chip prepago alcanza) para las primeras pruebas, durante varios días.
- Cuando migres al número real, arrancá con poco volumen y anuncialo gradualmente, no le des
  el número a toda tu base de contactos el primer día.
- Si en algún momento el número queda bloqueado, revisá `Configuración > Ayuda > Contactar con
  nosotros` en la app de WhatsApp del celular afectado, para solicitar una revisión.

## Estructura del proyecto

```
whatsapp-ai-vendedor/
├── instalar.bat           # Instalador para Windows (doble clic)
├── iniciar.bat             # Arranca el bot en Windows (doble clic, uso diario)
├── iniciar-24-7.bat        # Arranca el bot con PM2 en Windows (produccion)
├── catalog.json          # Catalogo de productos/servicios (si CATALOGO_FUENTE=json)
├── catalog-plantilla.xlsx # Ejemplo de formato para catalogo en Excel
├── imagenes/               # Fotos de productos referenciadas desde el catalogo
├── knowledge/             # Base de conocimiento extra: .txt, .pdf, urls.txt
├── setup/
│   ├── configurar.js      # Asistente interactivo que arma el .env
│   └── activar.js         # Activa el plan pago (npm run activar)
├── dashboard/
│   └── public/index.html  # Panel visual (HTML/CSS/JS, sin dependencias externas)
├── .env                   # Variables de entorno (crear a partir de .env.example)
├── .licencia.json          # Fecha de instalacion, para el conteo de la prueba (se crea solo)
├── vendedor.json          # Datos guardados: conversaciones, pedidos, escalamientos (se crea solo)
├── session/                # Sesion de WhatsApp guardada (se crea sola)
└── src/
    ├── index.js           # Punto de entrada: arranca el panel + el agente (supervisor)
    ├── bot.js              # Logica del agente de WhatsApp (corre como proceso hijo)
    ├── supervisor.js        # Arranca/detiene/reinicia bot.js y guarda sus logs
    ├── config.js          # Carga la configuracion general
    ├── catalogo.js         # Lee el catalogo desde JSON, Excel o Google Sheets
    ├── knowledge.js        # Carga y cachea la base de conocimiento
    ├── db.js              # Conversaciones, pedidos, escalamientos (archivo JSON)
    ├── dashboard.js        # Servidor del panel visual (API + estatico + control del agente)
    ├── licencia.js          # Control de la prueba gratuita de 15 dias
    ├── envios.js            # Espaciado anti-rafaga compartido para todo envio de WhatsApp
    ├── transcripcion.js      # Transcribe audios/notas de voz a texto via OpenRouter
    ├── prompts.js          # Arma el system prompt de venta con el catalogo
    ├── tools.js            # Funciones que puede ejecutar el modelo (pedido, escalar, imagen)
    ├── ai.js               # Llamadas a OpenRouter + flujo de function calling
    └── whatsapp.js         # Cliente whatsapp-web.js y manejo de mensajes
```

## Ver los pedidos registrados

Los pedidos y escalamientos quedan en `vendedor.json`, en la raiz del proyecto. Es un archivo de
texto plano, lo podes abrir con cualquier editor (Notepad, VS Code, etc) y mirar los arrays
`pedidos` y `escalamientos`. Si preferis verlo mas prolijo desde la terminal:

```bash
# PowerShell
Get-Content vendedor.json | ConvertFrom-Json | Select-Object -ExpandProperty pedidos
```

## Personalizaciones tipicas que vas a querer hacer

- **Cambiar el modelo de IA**: solo tocando `OPENROUTER_MODEL` en `.env`.
- **Sumar mas acciones** (ej. consultar stock en tiempo real, agendar un turno): agregar una nueva
  funcion en el array `tools` de `src/tools.js` y su handler en `ejecutarTool`.
- **Catalogo grande (50+ items)**: en vez de mandar todo el catalogo en el prompt, conviene armar
  una funcion `buscar_producto(query)` que el modelo llame para traer solo lo relevante. Si llegas
  a ese punto, avisame y lo agregamos.
- **Multiples negocios/numeros**: este proyecto esta pensado para un solo cliente/numero. Si mas
  adelante queres ofrecerlo como servicio a varios negocios, se puede evolucionar a una
  arquitectura multi-tenant (eso ya es otro proyecto, con webhooks separados por negocio).

## Notas importantes

- **No es la app oficial de WhatsApp Business API** (Meta/Twilio); usa `whatsapp-web.js`, que
  automatiza WhatsApp Web. Es la forma mas rapida y economica de arrancar, pero al no ser la API
  oficial, tiene mas riesgo de baneo si se manda spam o volumen muy alto. Para un vendedor
  atendiendo consultas reales de clientes uno a uno, el riesgo es bajo, pero evita mandar
  mensajes masivos no solicitados con este mismo numero.
- El numero del negocio debe permanecer con el celular conectado a internet (whatsapp-web.js
  necesita que el telefono este vinculado), aunque no hace falta que la pantalla este activa.
