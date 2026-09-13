const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('❌ No se encontro el archivo .env en este proyecto. ¿Estas en la carpeta correcta?');
    process.exit(1);
  }

  let contenido = fs.readFileSync(ENV_PATH, 'utf-8');

  if (/^LICENCIA_ACTIVADA=/m.test(contenido)) {
    contenido = contenido.replace(/^LICENCIA_ACTIVADA=.*$/m, 'LICENCIA_ACTIVADA=true');
  } else {
    contenido += `\nLICENCIA_ACTIVADA=true\n`;
  }

  fs.writeFileSync(ENV_PATH, contenido);

  console.log('✅ Plan activado. El limite de dias de prueba queda desactivado.');
  console.log('   Si el bot ya estaba corriendo, reinicialo (Ctrl+C y npm start / iniciar.bat)');
  console.log('   para que tome el cambio.');
}

main();
