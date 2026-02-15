#!/usr/bin/env node

/**
 * Script de test pour le système de licence hybride Online/Offline
 * Usage: node test-license-hybrid.js
 */

const fs = require('fs');
const path = require('path');
const license = require('./electron/license');

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
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// Test data
const TEST_LICENSE = {
  license_key: 'TEST-1234-ABCD-5678',
  machine_id: license.getMacAddress() || 'TEST-MACHINE',
  payload: Buffer.from(JSON.stringify({
    license_key: 'TEST-1234-ABCD-5678',
    expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    machine_id: license.getMacAddress() || 'TEST-MACHINE'
  })).toString('base64'),
  signature: 'dummy-signature-for-testing' // En production, ceci serait une vraie signature RSA
};

async function testMachineId() {
  logTitle('TEST 1: Récupération du Machine ID');
  
  const machineId = license.getMacAddress();
  
  if (machineId) {
    logSuccess(`Machine ID récupéré: ${machineId}`);
    return true;
  } else {
    logError('Impossible de récupérer le Machine ID');
    return false;
  }
}

async function testOnlineActivation() {
  logTitle('TEST 2: Activation Online (avec Internet)');
  
  logInfo('Tentative de connexion au serveur cloud (13.60.180.65:3000)...');
  logInfo('Clé de test: ' + TEST_LICENSE.license_key);
  
  try {
    const result = await license.activateOnline(
      TEST_LICENSE.license_key,
      TEST_LICENSE.machine_id
    );
    
    if (result.success) {
      logSuccess('Activation online réussie !');
      logInfo(`Mode: ${result.mode}`);
      logInfo(`Données: ${JSON.stringify(result.data, null, 2)}`);
      return true;
    } else {
      logWarning('Activation online échouée (normal si serveur inaccessible)');
      logInfo(`Erreur: ${result.error}`);
      return false;
    }
  } catch (error) {
    logWarning('Exception lors de l\'activation online (normal si pas d\'internet)');
    logInfo(`Erreur: ${error.message}`);
    return false;
  }
}

async function testOfflineActivation() {
  logTitle('TEST 3: Activation Offline (sans Internet)');
  
  logInfo('Simulation d\'une activation offline avec données locales...');
  logInfo('Payload: ' + TEST_LICENSE.payload.substring(0, 50) + '...');
  
  try {
    const result = license.activateOffline(TEST_LICENSE);
    
    if (result.success) {
      logSuccess('Activation offline réussie !');
      logInfo(`Mode: ${result.mode}`);
      logInfo(`Données: ${JSON.stringify(result.data, null, 2)}`);
      return true;
    } else {
      logError('Activation offline échouée');
      logInfo(`Erreur: ${result.error}`);
      return false;
    }
  } catch (error) {
    logError('Exception lors de l\'activation offline');
    logInfo(`Erreur: ${error.message}`);
    return false;
  }
}

async function testHybridActivation() {
  logTitle('TEST 4: Activation Hybride (Online → Offline fallback)');
  
  logInfo('Test du système hybride complet...');
  logInfo('1. Tentative online');
  logInfo('2. Si échec → Fallback offline automatique');
  
  try {
    const result = await license.activateLicense(
      TEST_LICENSE.license_key,
      TEST_LICENSE.machine_id,
      TEST_LICENSE
    );
    
    if (result.success) {
      logSuccess(`Activation hybride réussie !`);
      logSuccess(`Mode utilisé: ${result.mode}`);
      
      if (result.mode === 'online') {
        logInfo('✅ Activation via serveur cloud (mode online)');
      } else if (result.mode === 'offline') {
        logInfo('✅ Activation via vérification locale RSA (mode offline)');
      }
      
      return true;
    } else {
      logError('Activation hybride échouée');
      logInfo(`Erreur: ${result.error}`);
      return false;
    }
  } catch (error) {
    logError('Exception lors de l\'activation hybride');
    logInfo(`Erreur: ${error.message}`);
    return false;
  }
}

async function testPublicKeyExists() {
  logTitle('TEST 5: Vérification de la clé publique RSA');
  
  const publicKeyPath = path.join(__dirname, 'electron', 'public_key.pem');
  
  if (fs.existsSync(publicKeyPath)) {
    logSuccess('Clé publique RSA trouvée');
    logInfo(`Chemin: ${publicKeyPath}`);
    
    const keyContent = fs.readFileSync(publicKeyPath, 'utf8');
    const keySize = keyContent.length;
    
    if (keyContent.includes('BEGIN PUBLIC KEY')) {
      logSuccess('Format de clé valide');
      logInfo(`Taille: ${keySize} caractères`);
      return true;
    } else {
      logError('Format de clé invalide');
      return false;
    }
  } else {
    logError('Clé publique RSA non trouvée !');
    logWarning('La vérification offline ne fonctionnera pas sans cette clé');
    return false;
  }
}

async function testLicenseStorage() {
  logTitle('TEST 6: Test du stockage de licence');
  
  const licenseStorePath = path.join(__dirname, 'electron', 'license.json');
  
  logInfo('Création d\'une licence de test...');
  
  const testLicense = {
    key: TEST_LICENSE.license_key,
    machine_id: TEST_LICENSE.machine_id,
    expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    payload: TEST_LICENSE.payload,
    signature: TEST_LICENSE.signature,
    activated_at: new Date().toISOString(),
    mode: 'test'
  };
  
  try {
    fs.writeFileSync(licenseStorePath, JSON.stringify(testLicense, null, 2));
    logSuccess('Licence sauvegardée avec succès');
    
    const stored = JSON.parse(fs.readFileSync(licenseStorePath, 'utf8'));
    
    if (stored.key === testLicense.key) {
      logSuccess('Lecture de la licence réussie');
      logInfo(`Clé: ${stored.key}`);
      logInfo(`Expire: ${stored.expire_at}`);
      logInfo(`Mode: ${stored.mode}`);
      return true;
    } else {
      logError('Données de licence incorrectes après lecture');
      return false;
    }
  } catch (error) {
    logError('Erreur lors du stockage de licence');
    logInfo(`Erreur: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  logTitle('🚀 TESTS DU SYSTÈME DE LICENCE HYBRIDE ONLINE/OFFLINE');
  
  logInfo('Ces tests vérifient que le système de licence fonctionne correctement');
  logInfo('en mode online (avec Internet) et offline (sans Internet)');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  const tests = [
    { name: 'Machine ID', fn: testMachineId },
    { name: 'Clé publique RSA', fn: testPublicKeyExists },
    { name: 'Stockage de licence', fn: testLicenseStorage },
    { name: 'Activation offline', fn: testOfflineActivation },
    { name: 'Activation online', fn: testOnlineActivation },
    { name: 'Activation hybride', fn: testHybridActivation }
  ];
  
  for (const test of tests) {
    results.total++;
    const passed = await test.fn();
    
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Petit délai entre les tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Résumé
  logTitle('📊 RÉSUMÉ DES TESTS');
  
  log(`Total: ${results.total}`, colors.cyan);
  logSuccess(`Réussis: ${results.passed}`);
  
  if (results.failed > 0) {
    logError(`Échoués: ${results.failed}`);
  } else {
    logSuccess('Tous les tests sont passés ! ✅');
  }
  
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    logSuccess('\n🎉 Le système de licence hybride fonctionne parfaitement !');
    logInfo('\nProchaines étapes :');
    logInfo('1. Générer une vraie clé de licence avec le serveur');
    logInfo('2. Tester l\'activation online avec le serveur cloud');
    logInfo('3. Tester l\'activation offline en mode avion');
  } else {
    logWarning('\n⚠️  Certains tests ont échoué');
    logInfo('Vérifiez les erreurs ci-dessus pour plus de détails');
    logInfo('\nNotes :');
    logInfo('- L\'échec de "Activation online" est normal si le serveur est inaccessible');
    logInfo('- L\'activation offline devrait toujours fonctionner pour les tests de base');
  }
  
  console.log('');
}

// Exécution des tests
runAllTests().catch(error => {
  logError('Erreur fatale lors de l\'exécution des tests');
  console.error(error);
  process.exit(1);
});
