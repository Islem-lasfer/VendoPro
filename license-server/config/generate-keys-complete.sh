#!/bin/bash

# ========================================
# GUIDE DE GÉNÉRATION DE CLÉS RSA
# Pour le système de licence hybride
# ========================================

echo "🔐 Génération des clés RSA pour le système de licence"
echo "======================================================"
echo ""

# 1. Générer la clé privée RSA (2048 bits)
echo "📝 Étape 1: Génération de la clé privée..."
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048

if [ $? -eq 0 ]; then
    echo "✅ Clé privée générée: private_key.pem"
else
    echo "❌ Erreur lors de la génération de la clé privée"
    exit 1
fi

echo ""

# 2. Extraire la clé publique
echo "📝 Étape 2: Extraction de la clé publique..."
openssl rsa -in private_key.pem -pubout -out public_key.pem

if [ $? -eq 0 ]; then
    echo "✅ Clé publique générée: public_key.pem"
else
    echo "❌ Erreur lors de l'extraction de la clé publique"
    exit 1
fi

echo ""

# 3. Afficher les clés générées
echo "======================================================"
echo "✅ CLÉS GÉNÉRÉES AVEC SUCCÈS !"
echo "======================================================"
echo ""

echo "📁 Fichiers créés:"
echo "  • private_key.pem (GARDER SECRET - Sur serveur uniquement)"
echo "  • public_key.pem  (À copier dans l'application client)"
echo ""

echo "🔒 SÉCURITÉ:"
echo "  ⚠️  NE JAMAIS partager private_key.pem"
echo "  ⚠️  Stocker private_key.pem sur le serveur uniquement"
echo "  ✅ public_key.pem peut être distribué avec l'application"
echo ""

echo "📋 PROCHAINES ÉTAPES:"
echo ""
echo "1️⃣  Sécuriser la clé privée (serveur):"
echo "   chmod 600 private_key.pem"
echo "   mv private_key.pem /chemin/securise/"
echo ""
echo "2️⃣  Copier la clé publique (client):"
echo "   cp public_key.pem /chemin/vers/Stock/electron/"
echo ""
echo "3️⃣  Tester la génération d'une licence:"
echo "   node generate-test-license.js"
echo ""

# 4. Afficher le contenu des clés (optionnel)
echo "======================================================"
echo "📄 CONTENU DES CLÉS"
echo "======================================================"
echo ""

echo "--- CLÉ PRIVÉE (private_key.pem) ---"
echo "⚠️  NE PAS PARTAGER !"
head -n 3 private_key.pem
echo "..."
tail -n 3 private_key.pem
echo ""

echo "--- CLÉ PUBLIQUE (public_key.pem) ---"
echo "✅ Peut être copiée dans l'application"
cat public_key.pem
echo ""

echo "======================================================"
echo "✅ GÉNÉRATION TERMINÉE !"
echo "======================================================"
