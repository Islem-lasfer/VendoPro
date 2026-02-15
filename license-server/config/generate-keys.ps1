# Générateur de clés RSA pour Windows PowerShell
# Génère la paire de clés privée/publique pour le système de licence

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🔐 GÉNÉRATION DES CLÉS RSA" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Vérifier si OpenSSL est disponible
$openssl = Get-Command openssl -ErrorAction SilentlyContinue

if (-not $openssl) {
    Write-Host "`n❌ ERREUR: OpenSSL n'est pas installé" -ForegroundColor Red
    Write-Host "`nSolutions:" -ForegroundColor Yellow
    Write-Host "  1. Installer Git for Windows (inclut OpenSSL)" -ForegroundColor White
    Write-Host "     https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "`n  2. Ou installer OpenSSL:" -ForegroundColor White
    Write-Host "     https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
    Write-Host "`n  3. Puis relancer ce script`n" -ForegroundColor White
    exit 1
}

# Créer le dossier si nécessaire
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "`n✅ OpenSSL détecté: $($openssl.Source)" -ForegroundColor Green

# Générer la clé privée (2048 bits)
Write-Host "`n1️⃣  Génération de la clé privée (2048 bits)..." -ForegroundColor Cyan
& openssl genrsa -out private_key.pem 2048 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Clé privée créée: private_key.pem" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la génération de la clé privée" -ForegroundColor Red
    exit 1
}

# Extraire la clé publique
Write-Host "`n2️⃣  Extraction de la clé publique..." -ForegroundColor Cyan
& openssl rsa -in private_key.pem -outform PEM -pubout -out public_key.pem 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Clé publique créée: public_key.pem" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de l'extraction de la clé publique" -ForegroundColor Red
    exit 1
}

# Copier la clé publique dans Electron
$electronDir = Join-Path $scriptDir "..\..\electron"
if (Test-Path $electronDir) {
    Write-Host "`n3️⃣  Copie de la clé publique dans Electron..." -ForegroundColor Cyan
    Copy-Item public_key.pem "$electronDir\public_key.pem" -Force
    Write-Host "✅ Clé publique copiée dans: $electronDir\public_key.pem" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Dossier Electron non trouvé: $electronDir" -ForegroundColor Yellow
    Write-Host "    Copiez manuellement public_key.pem dans le dossier electron\" -ForegroundColor Yellow
}

# Afficher les emplacements
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "📋 EMPLACEMENTS DES CLÉS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Clé privée (serveur):   $scriptDir\private_key.pem" -ForegroundColor White
Write-Host "Clé publique (serveur):  $scriptDir\public_key.pem" -ForegroundColor White
Write-Host "Clé publique (client):   $electronDir\public_key.pem" -ForegroundColor White

# Avertissements de sécurité
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "⚠️  SÉCURITÉ IMPORTANTE" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🔴 NE JAMAIS partager private_key.pem" -ForegroundColor Red
Write-Host "🔴 NE JAMAIS commit private_key.pem dans Git" -ForegroundColor Red
Write-Host "🟢 public_key.pem peut être distribué" -ForegroundColor Green

# Créer .gitignore si nécessaire
if (-not (Test-Path ".gitignore")) {
    "private_key.pem" | Out-File -FilePath ".gitignore" -Encoding UTF8
    Write-Host "`n✅ .gitignore créé" -ForegroundColor Green
}

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "✅ GÉNÉRATION TERMINÉE" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "`nProchaine étape:" -ForegroundColor White
Write-Host "  cd ..\license-server" -ForegroundColor Yellow
Write-Host "  node generate-offline-license.js [mois]" -ForegroundColor Yellow
Write-Host ""
