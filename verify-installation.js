#!/usr/bin/env node

/**
 * Script de vérification de l'installation du système de licence hybride
 * Vérifie que tous les fichiers nécessaires sont présents et correctement configurés
 */

const fs = require('fs');
const path = require('path');

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

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Vérifications
const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function checkFile(filepath, description) {
  const fullPath = path.join(__dirname, filepath);
  if (fs.existsSync(fullPath)) {
    logSuccess(`${description} : ${filepath}`);
    checks.passed++;
    return true;
  } else {
    logError(`${description} manquant : ${filepath}`);
    checks.failed++;
    return false;
  }
}

function checkFileContent(filepath, searchString, description) {
  const fullPath = path.join(__dirname, filepath);
  if (!fs.existsSync(fullPath)) {
    logError(`${description} - Fichier manquant : ${filepath}`);
    checks.failed++;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(searchString)) {
    logSuccess(`${description} : Trouvé dans ${filepath}`);
    checks.passed++;
    return true;
  } else {
    logWarning(`${description} - Texte non trouvé dans ${filepath}`);
    checks.warnings++;
    return false;
  }
}

logTitle('🔍 VÉRIFICATION DE L\'INSTALLATION DU SYSTÈME DE LICENCE');

// 1. Fichiers Core
logTitle('1️⃣  Fichiers Core');
checkFile('electron/license.js', 'Module de licence');
checkFile('electron/public_key.pem', 'Clé publique RSA');
checkFile('main.js', 'Main Electron');
checkFile('src/components/License/License.jsx', 'Interface de licence');

// 2. Fonctions dans license.js
logTitle('2️⃣  Fonctions dans electron/license.js');
checkFileContent('electron/license.js', 'activateLicense', 'Fonction activateLicense');
checkFileContent('electron/license.js', 'activateOnline', 'Fonction activateOnline');
checkFileContent('electron/license.js', 'activateOffline', 'Fonction activateOffline');
checkFileContent('electron/license.js', 'verifySignatureOffline', 'Fonction verifySignatureOffline');

// 3. Handler IPC dans main.js
logTitle('3️⃣  Handlers IPC dans main.js');
checkFileContent('main.js', 'activate-license', 'Handler activate-license');
checkFileContent('main.js', 'license.activateLicense', 'Appel à activateLicense');

// 4. Interface utilisateur
logTitle('4️⃣  Interface Utilisateur');
checkFileContent('src/components/License/License.jsx', 'handleActivate', 'Fonction d\'activation');
checkFileContent('src/components/License/License.jsx', 'Mode hors ligne', 'Messages offline (FR)');
checkFileContent('src/components/License/License.jsx', 'ipcRenderer', 'Utilisation IPC');

// 5. Serveur de licence
logTitle('5️⃣  Serveur de Licence');
checkFile('license-server/routes/license.js', 'Routes du serveur');
checkFile('license-server/generate-test-license.js', 'Générateur de licences');
checkFileContent('license-server/routes/license.js', 'payload', 'Retour du payload');
checkFileContent('license-server/routes/license.js', 'signature', 'Retour de la signature');

// 6. Documentation
logTitle('6️⃣  Documentation');
checkFile('LICENCE_HYBRIDE_README.md', 'Documentation technique');
checkFile('GUIDE_RAPIDE_ACTIVATION.md', 'Guide rapide');
checkFile('IMPLEMENTATION_COMPLETE.md', 'Récapitulatif d\'implémentation');
checkFile('RELEASE_NOTES_V2.md', 'Notes de version');
checkFile('GUIDE_VISUEL_UTILISATEUR.md', 'Guide visuel utilisateur');

// 7. Scripts de test
logTitle('7️⃣  Scripts de Test');
checkFile('test-license-hybrid.js', 'Suite de tests');
checkFile('license-server/config/generate-keys-complete.sh', 'Script de génération de clés');

// 8. Vérifications de contenu spécifiques
logTitle('8️⃣  Vérifications de Sécurité');

// Vérifier la clé publique
const publicKeyPath = path.join(__dirname, 'electron/public_key.pem');
if (fs.existsSync(publicKeyPath)) {
  const keyContent = fs.readFileSync(publicKeyPath, 'utf8');
  if (keyContent.includes('BEGIN PUBLIC KEY') && keyContent.includes('END PUBLIC KEY')) {
    logSuccess('Clé publique RSA au format correct');
    checks.passed++;
  } else {
    logError('Clé publique RSA au format incorrect');
    checks.failed++;
  }
} else {
  logError('Clé publique RSA manquante');
  checks.failed++;
}

// Vérifier la configuration du serveur
const licenseJsPath = path.join(__dirname, 'electron/license.js');
if (fs.existsSync(licenseJsPath)) {
  const content = fs.readFileSync(licenseJsPath, 'utf8');
  if (content.includes('13.60.180.65')) {
    logSuccess('Adresse du serveur cloud configurée');
    checks.passed++;
  } else {
    logWarning('Adresse du serveur cloud non trouvée ou différente');
    checks.warnings++;
  }
}

// 9. Vérification de la structure package.json
logTitle('9️⃣  Configuration du Projet');

const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Vérifier Electron dans dependencies ou devDependencies
  if ((packageJson.dependencies && packageJson.dependencies.electron) || 
      (packageJson.devDependencies && packageJson.devDependencies.electron)) {
    logSuccess('Electron installé');
    checks.passed++;
  } else {
    logError('Electron non trouvé dans dependencies/devDependencies');
    checks.failed++;
  }
  
  if (packageJson.dependencies && packageJson.dependencies.react) {
    logSuccess('React installé');
    checks.passed++;
  } else {
    logError('React non trouvé dans dependencies');
    checks.failed++;
  }
} else {
  logError('package.json manquant');
  checks.failed++;
}

// Résumé
logTitle('📊 RÉSUMÉ DE LA VÉRIFICATION');

console.log('');
log(`Total de vérifications : ${checks.passed + checks.failed + checks.warnings}`, colors.cyan);
logSuccess(`Réussies : ${checks.passed}`);

if (checks.warnings > 0) {
  logWarning(`Avertissements : ${checks.warnings}`);
}

if (checks.failed > 0) {
  logError(`Échecs : ${checks.failed}`);
}

console.log('');

// Conclusion
if (checks.failed === 0) {
  logTitle('✅ INSTALLATION COMPLÈTE ET CORRECTE !');
  console.log('');
  logSuccess('Le système de licence hybride est correctement installé.');
  console.log('');
  logInfo('Prochaines étapes :');
  console.log('');
  log('  1. Générer une clé de licence de test :', colors.cyan);
  log('     cd license-server', colors.cyan);
  log('     node generate-test-license.js', colors.cyan);
  console.log('');
  log('  2. Démarrer l\'application :', colors.cyan);
  log('     npm run dev', colors.cyan);
  console.log('');
  log('  3. Tester l\'activation avec la clé générée', colors.cyan);
  console.log('');
  
  if (checks.warnings > 0) {
    logWarning('\n⚠️  Il y a quelques avertissements, mais rien de bloquant.');
  }
} else {
  logTitle('❌ INSTALLATION INCOMPLÈTE');
  console.log('');
  logError(`${checks.failed} élément(s) manquant(s) ou incorrect(s).`);
  console.log('');
  logInfo('Consultez les erreurs ci-dessus et corrigez-les.');
  console.log('');
  logInfo('Documentation disponible :');
  log('  • IMPLEMENTATION_COMPLETE.md', colors.cyan);
  log('  • LICENCE_HYBRIDE_README.md', colors.cyan);
  console.log('');
}

// Suggestions supplémentaires
if (checks.failed === 0 && checks.warnings === 0) {
  logTitle('🚀 COMMANDES UTILES');
  console.log('');
  log('Tester le système de licence :', colors.bright);
  log('  node test-license-hybrid.js', colors.cyan);
  console.log('');
  log('Générer une licence de test :', colors.bright);
  log('  cd license-server', colors.cyan);
  log('  node generate-test-license.js 12  # 12 mois de validité', colors.cyan);
  console.log('');
  log('Démarrer le serveur de licences :', colors.bright);
  log('  cd license-server', colors.cyan);
  log('  node src/server.js', colors.cyan);
  console.log('');
  log('Démarrer l\'application POS :', colors.bright);
  log('  npm run dev', colors.cyan);
  console.log('');
}

console.log('='.repeat(70));
console.log('');

process.exit(checks.failed > 0 ? 1 : 0);
