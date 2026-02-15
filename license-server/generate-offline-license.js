#!/usr/bin/env node

/**
 * Générateur de fichier de licence OFFLINE (.lic)
 * Permet l'activation sans Internet dès la première fois
 * 
 * Usage: 
 *   node generate-offline-license.js [mois_validité]
 *   node generate-offline-license.js 12         # 12 mois
 *   node generate-offline-license.js 0          # Illimitée
 *   node generate-offline-license.js unlimited  # Illimitée
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
  bright: '\x1b[1m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

// Générer clé de licence
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const parts = [];
  
  for (let i = 0; i < 5; i++) {
    let part = '';
    for (let j = 0; j < 5; j++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(part);
  }
  
  return parts.join('-');
}

// Signer le payload
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

// Générer fichier de licence
function generateOfflineLicense(validityMonths = 12) {
  console.log('\n' + '='.repeat(70));
  log('🔐 GÉNÉRATION DE FICHIER DE LICENCE OFFLINE', colors.bright + colors.cyan);
  console.log('='.repeat(70) + '\n');
  
  // 1. Générer clé
  const licenseKey = generateLicenseKey();
  log(`1️⃣  Clé générée: ${licenseKey}`, colors.green);
  
  // 2. Créer payload
  const isUnlimited = validityMonths === 0 || validityMonths === 'unlimited';
  const expiryDate = isUnlimited ? new Date('2099-12-31T23:59:59.999Z') : new Date();
  
  if (!isUnlimited) {
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);
  }
  
  const payload = {
    license_key: licenseKey,
    expire_at: expiryDate.toISOString(),
    max_devices: 1,
    created_at: new Date().toISOString(),
    unlimited: isUnlimited
  };
  
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  log(`\n2️⃣  Payload créé:`, colors.cyan);
  if (isUnlimited) {
    log(`    Expire le: JAMAIS (licence illimitée) ♾️`, colors.green);
    log(`    Validité: UNLIMITED`, colors.green);
  } else {
    log(`    Expire le: ${expiryDate.toLocaleDateString('fr-FR')}`, colors.cyan);
    log(`    Validité: ${validityMonths} mois`, colors.cyan);
  }
  
  // 3. Chercher clé privée
  const privateKeyPaths = [
    path.join(__dirname, 'config', 'private_key.pem'),
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
    log(`\nGénérez-la d'abord:`, colors.yellow);
    log(`  cd config`, colors.cyan);
    log(`  ./generate-keys-complete.sh\n`, colors.cyan);
    process.exit(1);
  }
  
  // 4. Signer
  let signature;
  try {
    signature = signPayload(JSON.stringify(payload), privateKeyPath);
    log(`\n3️⃣  Signature RSA générée`, colors.green);
    log(`    Clé privée: ${path.basename(privateKeyPath)}`, colors.cyan);
  } catch (error) {
    log(`\n❌ Erreur de signature: ${error.message}`, colors.yellow);
    process.exit(1);
  }
  
  // 5. Créer fichier .lic
  const licenseFile = {
    license_key: licenseKey,
    payload: payloadBase64,
    signature: signature,
    expire_at: expiryDate.toISOString(),
    max_devices: 1,
    created_at: new Date().toISOString()
  };
  
  const filename = `license-${licenseKey}.lic`;
  const filepath = path.join(__dirname, 'licenses', filename);
  
  // Créer dossier si nécessaire
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(licenseFile, null, 2));
  
  log(`\n4️⃣  Fichier créé: ${filename}`, colors.green);
  log(`    Emplacement: ${filepath}`, colors.cyan);
  
  // 6. Instructions
  console.log('\n' + '='.repeat(70));
  log('📋 INSTRUCTIONS POUR LE CLIENT', colors.bright + colors.cyan);
  console.log('='.repeat(70));
  
  console.log('\n1️⃣  SANS INTERNET (Activation Offline):');
  log('   • Envoyer le fichier au client: ' + filename, colors.cyan);
  log('   • Le client lance l\'application', colors.cyan);
  log('   • Clic sur "📄 Ou utiliser un fichier de licence"', colors.cyan);
  log('   • Choisir le fichier .lic', colors.cyan);
  log('   • ✅ Activation réussie sans Internet !', colors.green);
  
  console.log('\n2️⃣  AVEC INTERNET (Activation Online):');
  log('   • Insérer dans MongoDB:', colors.cyan);
  console.log('');
  log('   use licenses', colors.yellow);
  log('   db.licenses.insertOne(' + JSON.stringify({
    license_key: licenseKey,
    payload: payloadBase64,
    signature: signature,
    expire_at: expiryDate.toISOString(),
    max_devices: 1,
    status: 'inactive',
    activation_count: 0,
    created_at: new Date().toISOString()
  }, null, 2) + ')', colors.yellow);
  console.log('');
  log('   • Le client entre la clé: ' + licenseKey, colors.cyan);
  log('   • ✅ Activation online normale', colors.green);
  
  console.log('\n' + '='.repeat(70));
  log('✅ RÉSUMÉ', colors.bright + colors.green);
  console.log('='.repeat(70));
  
  log(`\nClé de licence: ${licenseKey}`, colors.green);
  log(`Fichier offline: ${filename}`, colors.cyan);
  if (isUnlimited) {
    log(`Expire le: JAMAIS (licence illimitée) ♾️`, colors.green);
    log(`Validité: UNLIMITED`, colors.green);
  } else {
    log(`Expire le: ${expiryDate.toLocaleDateString('fr-FR')}`, colors.cyan);
    log(`Validité: ${validityMonths} mois`, colors.cyan);
  }
  
  console.log('\n💡 La même clé fonctionne:');
  log('   ✅ Offline (avec fichier .lic)', colors.green);
  log('   ✅ Online (si insérée dans MongoDB)', colors.green);
  
  console.log('\n' + '='.repeat(70) + '\n');
}

// Exécution
const arg = process.argv[2];
let validityMonths = 12;

if (arg === 'unlimited' || arg === '0') {
  validityMonths = 0; // 0 = unlimited
} else if (arg) {
  validityMonths = parseInt(arg);
}

generateOfflineLicense(validityMonths);
