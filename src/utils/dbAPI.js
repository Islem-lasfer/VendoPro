// API Client pour la connexion au serveur de base de données réseau
// Utilisé par l'application Electron pour se connecter au serveur centralisé

class DatabaseAPI {
  constructor() {
    // Store base URL without /api suffix - we'll add it per endpoint
    let savedURL = localStorage.getItem('db_server_url') || 'http://localhost:3001';

    // If savedURL is an APIPA/link-local address (169.254.x.x) it's unlikely to be reachable; fallback to localhost
    const linkLocalPattern = /^https?:\/\/169\.254\.(?:\d{1,3})\.(?:\d{1,3})(?::\d+)?$/;
    if (linkLocalPattern.test(savedURL)) {
      console.warn('Saved db_server_url looks like a link-local address and may be invalid:', savedURL);
      localStorage.removeItem('db_server_url');
      savedURL = 'http://localhost:3001';
    }

    this.baseURL = savedURL.replace(/\/api$/, ''); // Remove /api if present
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 secondes
  }

  // Configurer l'URL du serveur
  // NOTE: a validated setter is defined further below that rejects link-local addresses and returns a boolean
  setServerURL(url) {
    // legacy: forward to validated setter
    return this._validatedSetServerURL ? this._validatedSetServerURL(url) : (this.baseURL = url.replace(/\/api$/, ''), localStorage.setItem('db_server_url', this.baseURL), true);
  }

  // Short reachability probe using AbortController to avoid long waits
  async isReachable(timeout = 3000) {
    const healthUrl = `${this.baseURL}/api/health`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch (e) {
      clearTimeout(id);
      return false;
    }
  }

  // Méthode générique pour les requêtes
  async request(endpoint, options = {}) {
    // Add /api prefix to all endpoints
    const url = `${this.baseURL}/api${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || 'Erreur réseau');
        } else {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
      }

      return await response.json();
    } catch (error) {
      // Ne pas afficher l'erreur en console si c'est juste une connexion refusée (serveur non démarré)
      if (endpoint !== '/health') {
        console.error(`Erreur API [${endpoint}]:`, error);
      }
      throw error;
    }
  }

  // ==================== PRODUITS ====================
  
  async getProducts() {
    const cacheKey = 'products_all';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const data = await this.request('/products');
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async searchProducts(query) {
    return await this.request(`/products/search?query=${encodeURIComponent(query)}`);
  }

  async getProductByBarcode(barcode) {
    return await this.request(`/products/barcode/${encodeURIComponent(barcode)}`);
  }

  async createProduct(product) {
    this.cache.clear();
    return await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
    
  }

  async updateProduct(id, product) {
    this.cache.clear();
    return await this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    });
  }

  async deleteProduct(id) {
    this.cache.clear();
    return await this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  }

  async updateProductQuantity(id, quantity) {
    this.cache.clear();
    return await this.request(`/products/${id}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });
  }

  // ==================== FACTURES ====================
  
  async getInvoices(type = null) {
    const endpoint = type ? `/invoices?type=${type}` : '/invoices';
    return await this.request(endpoint);
  }

  async getInvoice(id) {
    return await this.request(`/invoices/${id}`);
  }

  async createInvoice(invoice) {
    return await this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice)
    });
  }

  // ==================== LOCATIONS ====================
  async getLocations() {
    const cacheKey = 'locations_all';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.data;
    const data = await this.request('/locations');
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async getLocation(id) {
    return await this.request(`/locations/${id}`);
  }

  // Location transfers - server API
  async getLocationTransfers(productId) {
    return await this.request(`/products/${productId}/transfers`);
  }

  async deleteLocationTransfer(transferId) {
    return await this.request(`/products/transfers/${transferId}`, { method: 'DELETE' });
  }

  async deleteInvoice(id) {
    return await this.request(`/invoices/${id}`, {
      method: 'DELETE'
    });
  }

  async clearAllInvoices() {
    this.cache.clear();
    return await this.request('/invoices', {
      method: 'DELETE'
    });
  }

  // ==================== EMPLOYÉS ====================
  
  async getEmployees() {
    return await this.request('/employees');
  }

  async createEmployee(employee) {
    return await this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employee)
    });
  }

  async updateEmployee(id, employee) {
    return await this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employee)
    });
  }

  async deleteEmployee(id) {
    return await this.request(`/employees/${id}`, {
      method: 'DELETE'
    });
  }

  async getEmployeeAbsences(id) {
    return await this.request(`/employees/${id}/absences`);
  }

  async addAbsence(employeeId, absence) {
    return await this.request(`/employees/${employeeId}/absences`, {
      method: 'POST',
      body: JSON.stringify(absence)
    });
  }

  async deleteAbsence(employeeId, absenceId) {
    return await this.request(`/employees/${employeeId}/absences/${absenceId}`, {
      method: 'DELETE'
    });
  }

  // ==================== FACTURES FOURNISSEURS ====================
  
  async getSupplierInvoices() {
    return await this.request('/supplier-invoices');
  }

  async getSupplierInvoice(id) {
    return await this.request(`/supplier-invoices/${id}`);
  }

  async createSupplierInvoice(invoice) {
    return await this.request('/supplier-invoices', {
      method: 'POST',
      body: JSON.stringify(invoice)
    });
  }

  async deleteSupplierInvoice(id) {
    return await this.request(`/supplier-invoices/${id}`, {
      method: 'DELETE'
    });
  }

  // ==================== STATISTIQUES ====================
  
  async getOverviewStats() {
    return await this.request('/stats/overview');
  }

  async getSalesByPeriod(period = 'month') {
    return await this.request(`/stats/sales-by-period?period=${period}`);
  }

  async getTopProducts(limit = 10) {
    return await this.request(`/stats/top-products?limit=${limit}`);
  }

  async getSalesByCategory() {
    return await this.request('/stats/sales-by-category');
  }

  async getLowStock(threshold = 5) {
    return await this.request(`/stats/low-stock?threshold=${threshold}`);
  }

  // ==================== SANTÉ DU SERVEUR ====================
  
  async checkHealth() {
    try {
      return await this.request('/health');
    } catch (error) {
      return { status: 'ERROR', message: error.message };
    }
  }

  // Helper to set server url, with link-local detection
  _validatedSetServerURL(url) {
    const linkLocalPattern = /^https?:\/\/169\.254\.(?:\d{1,3})\.(?:\d{1,3})(?::\d+)?$/;
    if (linkLocalPattern.test(url)) {
      console.warn('Attempt to set a link-local address as server URL, ignoring and keeping previous or default value:', url);
      return false;
    }

    // Remove /api suffix if present
    this.baseURL = url.replace(/\/api$/, '');
    localStorage.setItem('db_server_url', this.baseURL);
    return true;
  }

  // Nettoyer le cache
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton
const dbAPI = new DatabaseAPI();
export default dbAPI;
