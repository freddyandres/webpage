'use strict';
/**
 * Crea (o restablece) una cuenta de administrador.
 * La contraseña se escribe de forma oculta en la terminal y se guarda cifrada (scrypt);
 * nunca queda escrita en el código.
 *
 *   npm run admin:create
 *   npm run admin:create -- --user samantha --name "Samantha Castillo Cano"
 *   npm run admin:create -- --user invitado --name "Invitado" --role lector
 */
const readline = require('node:readline');
const db = require('../server/db');
const auth = require('../server/auth');

const KNOWN = {
  samantha: 'Samantha Castillo Cano',
  angel: 'Ángel Esteban Cano Narváez',
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(''); };
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

(async () => {
  db.open();
  console.log('\n🐾 Unidos por una Patita — crear administrador\n');
  const username = (arg('user') || await ask('Usuario (por ejemplo: samantha o angel): ')).toLowerCase();
  const fullName = arg('name') || KNOWN[username] || await ask('Nombre completo: ');
  const role = arg('role') || 'admin';

  const password = process.env.NEW_ADMIN_PASSWORD || await askHidden('Contraseña (mínimo 10 caracteres, letras y números): ');
  if (!process.env.NEW_ADMIN_PASSWORD) {
    const again = await askHidden('Repite la contraseña: ');
    if (again !== password) { console.error('\n❌ Las contraseñas no coinciden.'); process.exit(1); }
  }
  try {
    const r = auth.createAdmin({ username, fullName, password, role });
    console.log(`\n✅ Cuenta "${username}" (${fullName}, rol: ${role}) ${r.updated ? 'actualizada' : 'creada'} correctamente.`);
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
})();
