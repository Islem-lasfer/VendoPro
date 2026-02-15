const mongoose = require('mongoose');

const LicenseSchema = new mongoose.Schema({
  license_key: { type: String, unique: true, required: true },
  payload: String,
  signature: String,
  machine_id: String,
  status: { type: String, enum: ['unused', 'active', 'inactive', 'blacklisted'], default: 'unused' },
  expire_at: Date,
  max_devices: { type: Number, default: 1 },
  activation_count: { type: Number, default: 0 },
  
  // 🔒 Sécurité anti-piratage
  piracy_attempts: { type: Number, default: 0 },
  last_piracy_attempt: {
    machine_id: String,
    timestamp: Date
  },
  
  // 📊 Tracking
  first_activated_at: Date,
  last_validation: Date,
  validation_count: { type: Number, default: 0 },
  last_ip: String,
  
  // 📝 Métadonnées
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Mettre à jour updated_at automatiquement
LicenseSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('License', LicenseSchema);
