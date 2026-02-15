#!/usr/bin/env node

/**
 * Générateur de clés RSA pour le système de licence
 * Utilise crypto de Node.js (pas besoin d'OpenSSL externe)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Couleurs console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bright: '\x1b[1m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

console.log('\n' + '='.repeat(70));
log('🔐 GÉNÉRATION DES CLÉS RSA', colors.bright + colors.cyan);
console.log('='.repeat(70) + '\n');

try {
  // Générer la paire de clés RSA (2048 bits)
  log('1️⃣  Génération de la paire de clés RSA (2048 bits)...', colors.cyan);
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  log('✅ Paire de clés générée', colors.green);
  
  // Sauvegarder la clé privée
  const configDir = __dirname;
  const privateKeyPath = path.join(configDir, 'private_key.pem');
  const publicKeyPath = path.join(configDir, 'public_key.pem');
  
  log('\n2️⃣  Sauvegarde de la clé privée...', colors.cyan);
  fs.writeFileSync(privateKeyPath, privateKey);
  log(`✅ Clé privée sauvegardée: ${privateKeyPath}`, colors.green);
  
  log('\n3️⃣  Sauvegarde de la clé publique...', colors.cyan);
  fs.writeFileSync(publicKeyPath, publicKey);
  log(`✅ Clé publique sauvegardée: ${publicKeyPath}`, colors.green);
  
  // Copier la clé publique dans Electron
  const electronDir = path.join(configDir, '..', '..', 'electron');
  const electronPublicKeyPath = path.join(electronDir, 'public_key.pem');
  
  if (fs.existsSync(electronDir)) {
    log('\n4️⃣  Copie de la clé publique dans Electron...', colors.cyan);
    fs.copyFileSync(publicKeyPath, electronPublicKeyPath);
    log(`✅ Clé publique copiée: ${electronPublicKeyPath}`, colors.green);
  } else {
    log(`\n⚠️  Dossier Electron non trouvé: ${electronDir}`, colors.yellow);
    log('    Copiez manuellement public_key.pem dans le dossier electron/', colors.yellow);
  }
  
  // Créer .gitignore
  const gitignorePath = path.join(configDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, 'private_key.pem\n');
    log('\n✅ .gitignore créé', colors.green);
  }
  
  // Afficher les emplacements
  console.log('\n' + '='.repeat(70));
  log('📋 EMPLACEMENTS DES CLÉS', colors.bright + colors.cyan);
  console.log('='.repeat(70));
  log(`Clé privée (serveur):   ${privateKeyPath}`, colors.cyan);
  log(`Clé publique (serveur): ${publicKeyPath}`, colors.cyan);
  log(`Clé publique (client):  ${electronPublicKeyPath}`, colors.cyan);
  
  // Avertissements de sécurité
  console.log('\n' + '='.repeat(70));
  log('⚠️  SÉCURITÉ IMPORTANTE', colors.bright + colors.yellow);
  console.log('='.repeat(70));
  log('🔴 NE JAMAIS partager private_key.pem', colors.red);
  log('🔴 NE JAMAIS commit private_key.pem dans Git', colors.red);
  log('🟢 public_key.pem peut être distribué', colors.green);
  
  console.log('\n' + '='.repeat(70));
  log('✅ GÉNÉRATION TERMINÉE', colors.bright + colors.green);
  console.log('='.repeat(70));
  
  console.log('\nProchaine étape:');
  log('  cd ..', colors.cyan);
  log('  node generate-offline-license.js [mois]', colors.cyan);
  console.log();
  
} catch (error) {
  log(`\n❌ ERREUR: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
}
