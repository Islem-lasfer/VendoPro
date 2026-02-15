# 🌐 Guide Rapide - Configuration Réseau Multi-Postes

## ⚡ Installation Rapide (5 minutes)

### 1️⃣ Sur le Serveur (Une seule machine)

```bash
# Installer MySQL
# Windows: https://dev.mysql.com/downloads/installer/
# Linux: sudo apt install mysql-server

# Créer la base de données
mysql -u root -p < database-server/database.sql

# Configurer le serveur
cd database-server
npm install
cp .env.example .env

# Éditer .env avec vos paramètres
# Démarrer le serveur
npm start
```

**Note:** Le serveur démarre sur `http://VOTRE-IP:3001`

### 2️⃣ Sur Chaque Poste Client

1. Ouvrir l'application POS
2. Aller dans **⚙️ Paramètres → 🌐 Réseau**
3. Sélectionner **Mode Réseau**
4. Entrer: `http://192.168.1.XXX:3001` (remplacer par l'IP du serveur)
5. Activer **Synchronisation temps réel**
6. Cliquer **Tester** puis **Enregistrer**
7. Redémarrer l'application

### 3️⃣ C'est Terminé ! ✅

Tous vos postes partagent maintenant la même base de données en temps réel.

---

## 🔍 Trouver l'IP du Serveur

**Windows:**
```powershell
ipconfig
```
Chercher "Adresse IPv4" (ex: 192.168.1.100)

**Linux/Mac:**
```bash
ip addr show
# ou
ifconfig
```

---

## 🔥 Ouvrir le Pare-feu

**Windows (PowerShell Admin):**
```powershell
New-NetFirewallRule -DisplayName "POS Server" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

**Linux:**
```bash
sudo ufw allow 3001/tcp
```

---

## ✅ Test de Connexion

Depuis un navigateur ou terminal:
```
http://192.168.1.100:3001/api/health
```

Devrait afficher:
```json
{"status":"OK","message":"Serveur de base de données POS opérationnel"}
```

---

## 🆘 Problèmes ?

### Le client ne se connecte pas
1. ✅ Serveur démarré ? → `cd database-server && npm start`
2. ✅ Pare-feu ouvert ?
3. ✅ Même réseau WiFi ?
4. ✅ Bonne URL dans Paramètres → Réseau ?

### "Cannot connect to MySQL"
1. ✅ MySQL installé et démarré ?
2. ✅ Base de données créée ? → `database.sql` exécuté
3. ✅ Bon mot de passe dans `.env` ?

---

## 📦 Structure des Fichiers

```
Stock/
├── database-server/          ← SERVEUR (une seule machine)
│   ├── server.js
│   ├── database.sql          ← Script MySQL
│   ├── .env                  ← Configuration
│   └── routes/
└── src/                      ← CLIENT (tous les postes)
    ├── utils/
    │   ├── dbAPI.js         ← API Client
    │   └── realtimeSync.js  ← WebSocket
    └── pages/
        └── NetworkSettings/  ← Interface config
```

---

## 🎯 Configuration Réseau Typique

```
        WiFi/Câble Réseau (192.168.1.x)
                    │
    ┌───────────────┼───────────────┐
    │               │               │
Poste 1         Poste 2         Serveur
(Client)        (Client)    (MySQL + API)
.105            .106            .100:3001
```

---

## 📊 Fonctionnalités Synchronisées

✅ Produits (ajout, modification, suppression, stock)  
✅ Ventes et factures  
✅ Employés et absences  
✅ Factures fournisseurs  
⚡ **Temps réel** - Voir les changements instantanément !

---

Pour plus de détails, consultez: **NETWORK_MULTIPOSTE_GUIDE.md**
