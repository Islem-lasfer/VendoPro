// WebSocket Client pour la synchronisation en temps réel
import { io } from 'socket.io-client';

class RealtimeSync {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Se connecter au serveur WebSocket
  async connect(serverURL) {
    if (this.socket && this.connected) {
      console.log('Déjà connecté au serveur temps réel');
      return;
    }

    const url = serverURL || localStorage.getItem('db_server_url') || 'http://localhost:3001';

    // Reject obvious link-local addresses to avoid noisy connection errors
    const linkLocalPattern = /^https?:\/\/169\.254\.(?:\d{1,3})\.(?:\d{1,3})(?::\d+)?$/;
    if (linkLocalPattern.test(url)) {
      console.warn('Refusing to connect to link-local address for realtime socket:', url);
      this.emit('connection-failed');
      try { localStorage.setItem('db_mode', 'local'); } catch (e) {}
      return;
    }

    // Quick reachability probe to avoid noisy socket.io polling errors when server is unreachable
    try {
      const probeOk = await this.probeServer(url, 2000);
      if (!probeOk) {
        console.warn('Realtime server not reachable, switching to local mode:', url);
        this.emit('connection-failed');
        try { localStorage.setItem('db_mode', 'local'); } catch (e) {}
        return;
      }
    } catch (e) {
      console.warn('Realtime server probe failed:', e && e.message ? e.message : e);
      this.emit('connection-failed');
      try { localStorage.setItem('db_mode', 'local'); } catch (e) {}
      return;
    }

    console.log('🔌 Connexion au serveur temps réel:', url);
    
    this.socket = io(url, {
      transports: ['websocket'], // prefer websocket to avoid xhr polling noise
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventHandlers();
  }

  // Configurer les gestionnaires d'événements
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur temps réel');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Déconnecté du serveur temps réel');
      this.connected = false;
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      // Downgrade noisy connection errors to warnings to avoid flooding console
      console.warn('⚠️ Erreur de connexion temps réel (connect_error):', error && error.message ? error.message : error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('❌ Nombre maximum de tentatives de reconnexion atteint — switching to local mode');
        this.emit('connection-failed');
        // Switch to local DB mode and disconnect to avoid noisy errors
        try { localStorage.setItem('db_mode', 'local'); } catch (e) {}
        try { this.socket.disconnect(); } catch (e) {}
      }
    });

    // Écouter les événements de synchronisation
    this.socket.on('product:created', (data) => this.emit('product:created', data));
    this.socket.on('product:updated', (data) => this.emit('product:updated', data));
    this.socket.on('product:deleted', (data) => this.emit('product:deleted', data));
    this.socket.on('product:quantity-updated', (data) => this.emit('product:quantity-updated', data));
    
    this.socket.on('invoice:created', (data) => this.emit('invoice:created', data));
    this.socket.on('invoice:deleted', (data) => this.emit('invoice:deleted', data));
    
    this.socket.on('employee:created', (data) => this.emit('employee:created', data));
    this.socket.on('employee:updated', (data) => this.emit('employee:updated', data));
    this.socket.on('employee:deleted', (data) => this.emit('employee:deleted', data));
    
    this.socket.on('absence:created', (data) => this.emit('absence:created', data));
    this.socket.on('absence:deleted', (data) => this.emit('absence:deleted', data));
    
    this.socket.on('supplier-invoice:created', (data) => this.emit('supplier-invoice:created', data));
    this.socket.on('supplier-invoice:deleted', (data) => this.emit('supplier-invoice:deleted', data));
  }

// Quick HTTP probe to check server reachability (calls /api/health)
    async probeServer(baseUrl, timeout = 2000) {
      try {
        const healthUrl = baseUrl.replace(/\/$/, '') + '/api/health';
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(id);
        return res && res.ok;
      } catch (e) {
        return false;
      }
    }

    // Déconnecter
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      console.log('Déconnexion du serveur temps réel');
    }
  }

  // Rejoindre une room spécifique
  joinRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('join-room', room);
    }
  }

  // Écouter un événement
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Retirer un écouteur
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  // Émettre un événement vers les écouteurs locaux
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erreur dans le callback de l'événement ${event}:`, error);
      }
    });
  }

  // Vérifier l'état de la connexion
  isConnected() {
    return this.connected;
  }
}

// Export singleton
const realtimeSync = new RealtimeSync();
export default realtimeSync;
