#!/usr/bin/env node

/**
 * Script pour réinitialiser la licence
 * Permet de retester l'activation
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔄 RÉINITIALISATION DE LA LICENCE\n');
console.log('=' .repeat(50));

// Fichiers à supprimer
const filesToDelete = [
  path.join(__dirname, 'electron', 'license.json'),
  path.join(__dirname, 'electron', 'license-store.json')
];

let deletedCount = 0;

filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log(`✅ Supprimé : ${path.basename(file)}`);
      deletedCount++;
    } catch (error) {
      console.log(`❌ Erreur : ${path.basename(file)} - ${error.message}`);
    }
  } else {
    console.log(`ℹ️  Pas trouvé : ${path.basename(file)}`);
  }
});

console.log('=' .repeat(50));
console.log(`\n✅ Fichiers supprimés : ${deletedCount}\n`);

console.log('⚠️  IMPORTANT : Suppression du localStorage\n');
console.log('Pour supprimer complètement la licence, vous devez aussi :');
console.log('1. Lancer l\'application : npm run dev');
console.log('2. Ouvrir DevTools (F12 ou Ctrl+Shift+I)');
console.log('3. Aller dans l\'onglet "Console"');
console.log('4. Taper cette commande :\n');
console.log('   localStorage.removeItem("mockActivation"); window.location.reload();\n');
console.log('5. L\'écran de licence devrait apparaître !\n');

console.log('=' .repeat(50));
console.log('\n📋 OU PLUS SIMPLE : Utilisez le raccourci clavier :\n');
console.log('   Ctrl+Shift+R (déjà configuré dans main.js)\n');
console.log('=' .repeat(50));

console.log('\n💡 Pour générer une clé de test :');
console.log('   cd license-server');
console.log('   node generate-test-license.js 12\n');
