#!/usr/bin/env node

/**
 * Script de génération de licences de test
 * Génère une clé de licence avec payload et signature RSA
 * 
 * Usage: node generate-test-license.js [nombre_de_mois_validite]
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTitle(title) {
  console.log('\n' + '='.repeat(70));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(70));
}

// Générer une clé de licence aléatoire
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const parts = [];
  
  for (let i = 0; i < 4; i++) {
    let part = '';
    for (let j = 0; j < 4; j++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(part);
  }
  
  return parts.join('-');
}

// Signer le payload avec la clé privée RSA
function signPayload(payload, privateKeyPath) {
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Clé privée non trouvée: ${privateKeyPath}`);
  }
  
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(Buffer.from(payload, 'utf8'));
  sign.end();
  
  return sign.sign(privateKey, 'base64');
}

// Générer une licence complète
function generateLicense(validityMonths = 12) {
  logTitle('🔐 GÉNÉRATION DE LICENCE DE TEST');
  
  // 1. Générer la clé
  const licenseKey = generateLicenseKey();
  log(`\n1️⃣  Clé de licence générée: ${licenseKey}`, colors.green);
  
  // 2. Créer le payload
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + validityMonths);
  
  const payload = {
    license_key: licenseKey,
    expire_at: expiryDate.toISOString(),
    max_devices: 1,
    created_at: new Date().toISOString()
  };
  
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  log(`\n2️⃣  Payload créé:`, colors.blue);
  log(`    Expire le: ${expiryDate.toLocaleDateString('fr-FR')}`, colors.cyan);
  log(`    Validité: ${validityMonths} mois`, colors.cyan);
  
  // 3. Chercher la clé privée
  const privateKeyPaths = [
    path.join(__dirname, 'config', 'private_key.pem'),
    path.join(__dirname, 'license-server', 'config', 'private_key.pem'),
    path.join(__dirname, '..', 'config', 'private_key.pem'),
    'private_key.pem'
  ];
  
  let privateKeyPath = null;
  for (const keyPath of privateKeyPaths) {
    if (fs.existsSync(keyPath)) {
      privateKeyPath = keyPath;
      break;
    }
  }
  
  if (!privateKeyPath) {
    log(`\n⚠️  CLÉ PRIVÉE NON TROUVÉE`, colors.yellow);
    log(`\nCherché dans:`, colors.yellow);
    privateKeyPaths.forEach(p => log(`  • ${p}`, colors.yellow));
    log(`\nGénérez la clé privée d'abord:`, colors.cyan);
    log(`  cd license-server/config`, colors.cyan);
    log(`  ./generate-keys-complete.sh`, colors.cyan);
    log(`\nLICENCE GÉNÉRÉE SANS SIGNATURE (mode test uniquement):`, colors.yellow);
    
    return {
      license_key: licenseKey,
      payload: payloadBase64,
      signature: 'TEST-SIGNATURE-NO-PRIVATE-KEY',
      expire_at: expiryDate.toISOString(),
      max_devices: 1,
      status: 'inactive',
      activation_count: 0,
      created_at: new Date().toISOString()
    };
  }
  
  // 4. Signer le payload
  let signature;
  try {
    signature = signPayload(JSON.stringify(payload), privateKeyPath);
    log(`\n3️⃣  Signature RSA générée`, colors.green);
    log(`    Clé privée: ${path.basename(privateKeyPath)}`, colors.cyan);
  } catch (error) {
    log(`\n❌ Erreur lors de la signature: ${error.message}`, colors.red);
    throw error;
  }
  
  // 5. Préparer l'objet complet
  const licenseData = {
    license_key: licenseKey,
    payload: payloadBase64,
    signature: signature,
    expire_at: expiryDate.toISOString(),
    max_devices: 1,
    status: 'inactive',
    activation_count: 0,
    created_at: new Date().toISOString()
  };
  
  return licenseData;
}

// Afficher les instructions d'insertion MongoDB
function displayMongoInstructions(licenseData) {
  logTitle('📋 INSTRUCTIONS D\'INSERTION MONGODB');
  
  console.log('\nCopiez et collez cette commande dans MongoDB:');
  console.log('');
  log('use licenses', colors.cyan);
  console.log('');
  log('db.licenses.insertOne(' + JSON.stringify(licenseData, null, 2) + ')', colors.green);
  console.log('');
}

// Afficher les informations pour le test
function displayTestInstructions(licenseData) {
  logTitle('🧪 TEST DE LA LICENCE');
  
  console.log('\n1️⃣  Démarrer l\'application POS:');
  log('   npm run dev', colors.cyan);
  
  console.log('\n2️⃣  Entrer la clé de licence:');
  log(`   ${licenseData.license_key}`, colors.green + colors.bright);
  
  console.log('\n3️⃣  Vérifier l\'activation:');
  log('   • Mode online: "✅ Activation en ligne réussie !"', colors.green);
  log('   • Mode offline: "✅ Activation hors ligne réussie ✅"', colors.green);
  
  console.log('\n4️⃣  Tester le mode offline:');
  log('   • Activer une fois avec Internet', colors.cyan);
  log('   • Fermer l\'application', colors.cyan);
  log('   • Désactiver Internet (mode avion)', colors.cyan);
  log('   • Relancer et entrer la même clé', colors.cyan);
  log('   • ✅ Devrait fonctionner en mode offline !', colors.green);
}

// Sauvegarder dans un fichier
function saveLicenseToFile(licenseData) {
  const filename = `license-${licenseData.license_key}.json`;
  const filepath = path.join(__dirname, 'license-server', 'licenses', filename);
  
  try {
    // Créer le dossier si nécessaire
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(licenseData, null, 2));
    log(`\n💾 Licence sauvegardée: ${filename}`, colors.green);
  } catch (error) {
    log(`\n⚠️  Impossible de sauvegarder: ${error.message}`, colors.yellow);
  }
}

// Programme principal
function main() {
  try {
    // Récupérer la validité depuis les arguments
    const validityMonths = parseInt(process.argv[2]) || 12;
    
    // Générer la licence
    const licenseData = generateLicense(validityMonths);
    
    // Sauvegarder dans un fichier
    saveLicenseToFile(licenseData);
    
    // Afficher les instructions
    displayMongoInstructions(licenseData);
    displayTestInstructions(licenseData);
    
    // Résumé final
    logTitle('✅ LICENCE GÉNÉRÉE AVEC SUCCÈS !');
    
    log(`\nClé de licence: ${licenseData.license_key}`, colors.green + colors.bright);
    log(`Expire le: ${new Date(licenseData.expire_at).toLocaleDateString('fr-FR')}`, colors.cyan);
    log(`Validité: ${validityMonths} mois`, colors.cyan);
    
    console.log('\n' + '='.repeat(70) + '\n');
    
  } catch (error) {
    log(`\n❌ ERREUR: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main();
}

module.exports = { generateLicense, signPayload, generateLicenseKey };
