const express = require('express');
const router = express.Router();
const License = require('../models/License');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PUBLIC_KEY_PATH = path.join(__dirname, '../config/public_key.pem');
const PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');

function verifySignature(payload, signature) {
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(payload);
  verify.end();
  return verify.verify(PUBLIC_KEY, signature, 'base64');
}

// POST /activate - 🔒 Activation sécurisée avec détection de piratage
router.post('/activate', async (req, res) => {
  const { license_key, machine_id } = req.body;
  
  if (!license_key || !machine_id) {
    return res.status(400).json({ error: 'License key and machine ID required' });
  }
  
  console.log('🔐 Activation request:', { license_key, machine_id });
  
  const license = await License.findOne({ license_key });
  
  if (!license) {
    console.log('❌ License not found:', license_key);
    return res.status(404).json({ error: 'Clé de licence invalide' });
  }
  
  // 🔒 SÉCURITÉ 1: Vérifier si blacklistée
  if (license.status === 'blacklisted') {
    console.log('🚫 Blacklisted license:', license_key);
    return res.status(403).json({ 
      error: 'Cette licence a été désactivée pour violation des conditions d\'utilisation',
      blacklisted: true 
    });
  }
  
  // 🔒 SÉCURITÉ 2: Vérifier la signature
  if (!license.payload || !license.signature) {
    return res.status(400).json({ error: 'License data incomplete' });
  }
  
  if (!verifySignature(Buffer.from(license.payload, 'base64'), license.signature)) {
    console.log('❌ Invalid signature for:', license_key);
    return res.status(400).json({ error: 'Signature de licence invalide' });
  }
  
  // 🔒 SÉCURITÉ 3: Détecter utilisation sur autre machine (PIRATAGE)
  if (license.machine_id && license.machine_id !== machine_id) {
    console.log('🚨 PIRACY DETECTED! License used on different machine:');
    console.log('   Registered:', license.machine_id);
    console.log('   Attempting:', machine_id);
    
    // Enregistrer la tentative de piratage
    license.piracy_attempts = (license.piracy_attempts || 0) + 1;
    license.last_piracy_attempt = {
      machine_id: machine_id,
      timestamp: new Date()
    };
    
    // Auto-blacklist après 3 tentatives
    if (license.piracy_attempts >= 3) {
      license.status = 'blacklisted';
      console.log('🚫 License auto-blacklisted after 3 piracy attempts');
    }
    
    await license.save();
    
    return res.status(409).json({ 
      error: 'Cette clé est déjà utilisée sur un autre ordinateur. Contactez le support.',
      piracy_detected: true,
      registered_machine: license.machine_id.substring(0, 8) + '...' // Afficher partiellement
    });
  }
  
  // 🔒 SÉCURITÉ 4: Vérifier limite d'activations
  if (license.activation_count >= license.max_devices && !license.machine_id) {
    return res.status(429).json({ error: 'Limite d\'activation atteinte' });
  }
  
  // 🔒 SÉCURITÉ 5: Vérifier expiration
  if (license.expire_at && new Date() > new Date(license.expire_at)) {
    return res.status(410).json({ error: 'Licence expirée' });
  }
  
  // ✅ Activation valide - Enregistrer
  const isFirstActivation = !license.machine_id;
  
  license.machine_id = machine_id;
  license.status = 'active';
  license.last_validation = new Date();
  license.last_ip = req.ip || req.connection.remoteAddress;
  
  if (isFirstActivation) {
    license.activation_count += 1;
    license.first_activated_at = new Date();
    console.log('✅ First activation successful:', license_key);
  } else {
    console.log('✅ Re-activation on same machine:', license_key);
  }
  
  await license.save();
  
  // Retourner données pour vérification offline
  res.json({ 
    success: true, 
    expire_at: license.expire_at,
    payload: license.payload,
    signature: license.signature,
    machine_id: machine_id,
    first_activation: isFirstActivation
  });
});

// POST /validate - 🔒 Validation périodique pour détecter piratage en temps réel
router.post('/validate', async (req, res) => {
  const { license_key, machine_id } = req.body;
  
  if (!license_key || !machine_id) {
    return res.status(400).json({ error: 'License key and machine ID required' });
  }
  
  const license = await License.findOne({ license_key });
  
  if (!license) {
    return res.status(404).json({ error: 'Clé invalide', valid: false });
  }
  
  // 🔒 Vérifier si blacklistée
  if (license.status === 'blacklisted') {
    console.log('🚫 Blacklisted license validation attempt:', license_key);
    return res.status(403).json({ 
      error: 'Licence désactivée', 
      valid: false, 
      blacklisted: true 
    });
  }
  
  // 🔒 PIRATAGE: Vérifier si utilisée sur autre machine
  if (license.machine_id && license.machine_id !== machine_id) {
    console.log('🚨 PIRACY DETECTED during validation!');
    console.log('   Expected:', license.machine_id);
    console.log('   Got:', machine_id);
    
    return res.status(409).json({ 
      error: 'Machine non autorisée', 
      valid: false,
      piracy_detected: true
    });
  }
  
  // 🔒 Vérifier expiration
  if (license.expire_at && new Date() > new Date(license.expire_at)) {
    return res.status(410).json({ 
      error: 'Licence expirée', 
      valid: false,
      expired: true 
    });
  }
  
  // ✅ Mise à jour dernière validation
  license.last_validation = new Date();
  license.validation_count = (license.validation_count || 0) + 1;
  await license.save();
  
  res.json({ 
    valid: true, 
    expire_at: license.expire_at,
    status: license.status,
    unlimited: license.expire_at && new Date(license.expire_at) > new Date('2099-01-01')
  });
});

// POST /blacklist - 🚫 Désactiver une licence (admin)
router.post('/blacklist', async (req, res) => {
  const { license_key, reason } = req.body;
  
  if (!license_key) {
    return res.status(400).json({ error: 'License key required' });
  }
  
  const license = await License.findOne({ license_key });
  
  if (!license) {
    return res.status(404).json({ error: 'License not found' });
  }
  
  license.status = 'blacklisted';
  license.blacklist_reason = reason || 'Admin action';
  license.blacklisted_at = new Date();
  
  await license.save();
  
  console.log('🚫 License blacklisted:', license_key);
  console.log('   Reason:', reason);
  
  res.json({ 
    success: true,
    message: 'License blacklisted successfully',
    license_key: license_key
  });
});

// GET /stats/:license_key - 📊 Obtenir statistiques d'une licence (admin)
router.get('/stats/:license_key', async (req, res) => {
  const { license_key } = req.params;
  
  const license = await License.findOne({ license_key });
  
  if (!license) {
    return res.status(404).json({ error: 'License not found' });
  }
  
  res.json({
    license_key: license.license_key,
    status: license.status,
    machine_id: license.machine_id,
    activation_count: license.activation_count,
    validation_count: license.validation_count,
    piracy_attempts: license.piracy_attempts,
    first_activated_at: license.first_activated_at,
    last_validation: license.last_validation,
    last_ip: license.last_ip,
    expire_at: license.expire_at,
    created_at: license.created_at
  });
});

module.exports = router;
