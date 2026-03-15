#!/usr/bin/env node
// setup-admin.js — Crée le premier compte administrateur
// Usage: node setup-admin.js <username> <password> <nom_complet>
// Exemple: node setup-admin.js charles-antoine MonMotDePasse "Charles-Antoine Morin"

async function main() {
  const [,, username, password, nom_complet] = process.argv;

  if (!username || !password || !nom_complet) {
    console.log('\n  Usage: node setup-admin.js <username> <password> "Nom Complet"\n');
    console.log('  Exemple: node setup-admin.js admin MonMotDePasse "Charles-Antoine Morin"\n');
    process.exit(1);
  }

  if (password.length < 6) {
    console.log('\n  Erreur: Le mot de passe doit contenir au moins 6 caractères.\n');
    process.exit(1);
  }

  // Init la BD d'abord (sql.js est async)
  const { initDatabase, stmts } = require('./database');
  await initDatabase();

  const { hashPassword } = require('./auth');

  // Vérifier si l'utilisateur existe déjà
  const existing = stmts.getUserByUsername(username);
  if (existing) {
    console.log(`\n  L'utilisateur "${username}" existe déjà.\n`);
    process.exit(1);
  }

  const hash = await hashPassword(password);
  stmts.insertUser(username, hash, nom_complet, 'admin', null);

  console.log(`\n  ✓ Compte admin créé avec succès !`);
  console.log(`    Username:  ${username}`);
  console.log(`    Nom:       ${nom_complet}`);
  console.log(`    Rôle:      admin`);
  console.log(`\n  Connecte-toi sur /admin pour accéder au back-office.\n`);
}

main().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
