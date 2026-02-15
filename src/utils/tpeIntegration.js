/**
 * TPE (Terminal de Paiement Électronique) Integration
 * Supports multiple card terminal brands and protocols
 */

class TPEIntegration {
  constructor() {
    this.config = this.loadConfig();
    this.ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
  }

  loadConfig() {
    const savedConfig = localStorage.getItem('tpe_config');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    
    // Default configuration
    return {
      enabled: false,
      brand: 'generic', // generic, ingenico, verifone, worldline, pax, sumup, stripe, custom
      connectionType: 'network', // network, serial, usb
      ipAddress: '192.168.1.100',
      port: 8080,
      serialPort: 'COM1',
      baudRate: 9600,
      timeout: 30000, // 30 seconds
      apiKey: '',
      apiEndpoint: '',
      
      // Advanced custom configuration
      customProtocol: {
        paymentCommand: 'PAY:{amount}:{currency}:{txId}\r\n',
        cancelCommand: 'CANCEL:{txId}\r\n',
        statusCommand: 'STATUS\r\n',
        responseTerminator: '\r\n',
        approvedKeywords: ['APPROVED', 'OK', '00'],
        declinedKeywords: ['DECLINED', 'REFUSED', 'ERROR'],
        parseResponse: 'auto', // auto, json, xml, custom
        httpMethod: 'POST',
        httpHeaders: {},
        httpBodyTemplate: '{"amount":{amount},"currency":"{currency}","reference":"{txId}"}'
      },
      
      // Debug mode
      debug: false,
      testMode: false // Simulate payments without real terminal
    };
  }

  saveConfig(config) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('tpe_config', JSON.stringify(this.config));
  }

  /**
   * Send payment request to TPE terminal
   * @param {number} amount - Amount in cents (e.g., 1550 for 15.50€)
   * @param {string} currency - Currency code (EUR, USD, etc.)
   * @param {string} transactionId - Unique transaction identifier
   * @returns {Promise<Object>} Payment result
   */
  async requestPayment(amount, currency = 'EUR', transactionId = null) {
    if (!this.config.enabled) {
      console.warn('TPE is disabled in settings');
      return {
        success: false,
        error: 'TPE_DISABLED',
        message: 'Card terminal is disabled in settings'
      };
    }

    // Test mode - simulate payment
    if (this.config.testMode) {
      return this.simulatePayment(amount, currency);
    }

    const txId = transactionId || `TXN-${Date.now()}`;
    
    if (this.config.debug) {
      console.log(`[TPE] Initiating payment: ${amount/100} ${currency} - TX: ${txId}`);
      console.log('[TPE] Config:', this.config);
    }

    try {
      switch (this.config.brand.toLowerCase()) {
        case 'custom':
          return await this.customPayment(amount, currency, txId);
        
        case 'ingenico':
          return await this.ingenicopayment(amount, currency, txId);
        
        case 'verifone':
          return await this.verifonepayment(amount, currency, txId);
        
        case 'worldline':
          return await this.worldlinePayment(amount, currency, txId);
        
        case 'pax':
          return await this.paxPayment(amount, currency, txId);
        
        case 'sumup':
          return await this.sumupPayment(amount, currency, txId);
        
        case 'stripe':
          return await this.stripePayment(amount, currency, txId);
        
        case 'generic':
        default:
          return await this.genericPayment(amount, currency, txId);
      }
    } catch (error) {
      console.error('[TPE] Payment error:', error);
      return {
        success: false,
        error: 'PAYMENT_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Simulate payment for testing (no real terminal needed)
   */
  async simulatePayment(amount, currency) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 90% success rate in test mode
        const success = Math.random() > 0.1;
        resolve({
          success,
          status: success ? 'APPROVED' : 'DECLINED',
          authCode: success ? `TEST${Math.random().toString(36).substr(2, 6).toUpperCase()}` : '',
          cardType: 'TEST_CARD',
          message: success ? 'Test payment approved' : 'Test payment declined',
          testMode: true
        });
      }, 2000); // 2 second delay to simulate real terminal
    });
  }

  /**
   * Custom payment protocol - fully configurable by user
   */
  async customPayment(amount, currency, txId) {
    if (this.config.connectionType === 'network') {
      return await this.customNetworkPayment(amount, currency, txId);
    } else if (this.config.connectionType === 'serial') {
      return await this.customSerialPayment(amount, currency, txId);
    }
  }

  /**
   * Custom network payment with user-defined protocol
   */
  async customNetworkPayment(amount, currency, txId) {
    const protocol = this.config.customProtocol;
    const url = this.config.apiEndpoint || `http://${this.config.ipAddress}:${this.config.port}/payment`;
    
    // Replace placeholders in body template
    let body = protocol.httpBodyTemplate
      .replace(/{amount}/g, amount)
      .replace(/{currency}/g, currency)
      .replace(/{txId}/g, txId);
    
    if (this.config.debug) {
      console.log('[TPE Custom] URL:', url);
      console.log('[TPE Custom] Body:', body);
    }
    
    const response = await fetch(url, {
      method: protocol.httpMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...protocol.httpHeaders,
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
      },
      body: body
    });

    const responseText = await response.text();
    
    if (this.config.debug) {
      console.log('[TPE Custom] Response:', responseText);
    }

    return this.parseCustomResponse(responseText);
  }

  /**
   * Custom serial payment with user-defined protocol
   */
  async customSerialPayment(amount, currency, txId) {
    const protocol = this.config.customProtocol;
    
    // Build command from template
    const command = protocol.paymentCommand
      .replace(/{amount}/g, amount)
      .replace(/{currency}/g, currency)
      .replace(/{txId}/g, txId);

    if (this.config.debug) {
      console.log('[TPE Custom Serial] Command:', command);
    }

    return await this.serialPayment(amount, currency, txId, command);
  }

  /**
   * Parse custom response based on user configuration
   */
  parseCustomResponse(response) {
    const protocol = this.config.customProtocol;
    
    // Check for approval keywords
    const isApproved = protocol.approvedKeywords.some(keyword => 
      response.toUpperCase().includes(keyword.toUpperCase())
    );
    
    const isDeclined = protocol.declinedKeywords.some(keyword => 
      response.toUpperCase().includes(keyword.toUpperCase())
    );

    if (isApproved) {
      return {
        success: true,
        status: 'APPROVED',
        response: response,
        authCode: this.extractAuthCode(response)
      };
    } else if (isDeclined) {
      return {
        success: false,
        status: 'DECLINED',
        response: response,
        message: 'Payment declined by terminal'
      };
    } else {
      // Try JSON parsing
      try {
        const json = JSON.parse(response);
        return {
          success: json.success || json.approved || json.status === 'approved',
          status: json.status || 'UNKNOWN',
          response: json,
          authCode: json.authCode || json.auth_code || ''
        };
      } catch {
        return {
          success: false,
          error: 'PARSE_ERROR',
          message: 'Cannot parse terminal response',
          response: response
        };
      }
    }
  }

  extractAuthCode(response) {
    // Try common patterns
    const patterns = [
      /AUTH[:\s]+([A-Z0-9]+)/i,
      /AUTHCODE[:\s]+([A-Z0-9]+)/i,
      /CODE[:\s]+([A-Z0-9]+)/i,
      /"authCode":"([^"]+)"/,
      /"auth_code":"([^"]+)"/
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) return match[1];
    }

    return '';
  }

  /**
   * Generic payment - works with most terminals via serial/network
   */
  async genericPayment(amount, currency, txId) {
    if (this.config.connectionType === 'network') {
      return await this.networkPayment(amount, currency, txId);
    } else if (this.config.connectionType === 'serial') {
      return await this.serialPayment(amount, currency, txId);
    } else {
      throw new Error('Unsupported connection type');
    }
  }

  /**
   * Network/HTTP payment (REST API)
   */
  async networkPayment(amount, currency, txId) {
    const url = `http://${this.config.ipAddress}:${this.config.port}/payment`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : undefined
      },
      body: JSON.stringify({
        amount,
        currency,
        transactionId: txId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Serial/COM port payment (via Electron IPC)
   */
  async serialPayment(amount, currency, txId, customCommand = null) {
    if (!this.ipcRenderer) {
      throw new Error('Electron IPC not available');
    }

    // Use custom command if provided, otherwise use default
    const command = customCommand || `PAY:${amount}:${currency}:${txId}\r\n`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Payment timeout'));
      }, this.config.timeout);

      this.ipcRenderer.once('tpe-payment-response', (event, result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      this.ipcRenderer.send('tpe-payment-request', {
        amount,
        currency,
        transactionId: txId,
        port: this.config.serialPort,
        baudRate: this.config.baudRate,
        command: command, // Send custom command
        terminator: this.config.customProtocol?.responseTerminator || '\r\n',
        approvedKeywords: this.config.customProtocol?.approvedKeywords || ['APPROVED', '00'],
        declinedKeywords: this.config.customProtocol?.declinedKeywords || ['DECLINED', 'ERROR'],
        debug: this.config.debug
      });
    });
  }

  /**
   * Ingenico terminal (Telium protocol)
   */
  async ingenicopayment(amount, currency, txId) {
    // Ingenico uses Telium protocol (serial or TCP/IP)
    if (this.config.connectionType === 'network') {
      const url = `http://${this.config.ipAddress}:${this.config.port}/cgi-bin/payment`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          Amount: amount.toString(),
          Currency: currency,
          TransactionID: txId,
          PaymentType: '1' // 1=Sale, 2=Refund
        })
      });

      const text = await response.text();
      return this.parseIngenicoResponse(text);
    } else {
      return await this.serialPayment(amount, currency, txId);
    }
  }

  parseIngenicoResponse(response) {
    // Parse Ingenico response format
    if (response.includes('APPROVED') || response.includes('00')) {
      return {
        success: true,
        status: 'APPROVED',
        authCode: response.match(/AUTH:(\w+)/)?.[1] || '',
        cardType: response.match(/CARD:(\w+)/)?.[1] || 'UNKNOWN'
      };
    } else {
      return {
        success: false,
        error: 'DECLINED',
        message: response
      };
    }
  }

  /**
   * Verifone terminal (VX protocol)
   */
  async verifonepayment(amount, currency, txId) {
    const url = `http://${this.config.ipAddress}:${this.config.port}/v1/transactions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.config.apiKey
      },
      body: JSON.stringify({
        transaction_type: 'sale',
        amount: amount,
        currency: currency,
        reference: txId
      })
    });

    return await response.json();
  }

  /**
   * Worldline (formerly Ingenico Group)
   */
  async worldlinePayment(amount, currency, txId) {
    const url = this.config.apiEndpoint || `https://payment.preprod.worldline-solutions.com/v1/payments`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        amount: {
          value: amount,
          currency: currency
        },
        merchantReference: txId,
        paymentMethod: 'card'
      })
    });

    return await response.json();
  }

  /**
   * PAX terminal
   */
  async paxPayment(amount, currency, txId) {
    // PAX uses REST API or cloud integration
    const url = `http://${this.config.ipAddress}:${this.config.port}/api/sale`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TransAmount: (amount / 100).toFixed(2),
        RefNum: txId
      })
    });

    return await response.json();
  }

  /**
   * SumUp terminal (Cloud API)
   */
  async sumupPayment(amount, currency, txId) {
    const url = 'https://api.sumup.com/v0.1/checkouts';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        checkout_reference: txId,
        amount: amount / 100,
        currency: currency,
        merchant_code: this.config.merchantCode
      })
    });

    return await response.json();
  }

  /**
   * Stripe Terminal
   */
  async stripePayment(amount, currency, txId) {
    const url = 'https://api.stripe.com/v1/terminal/readers/{READER_ID}/process_payment_intent';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        currency: currency.toLowerCase(),
        description: txId
      })
    });

    return await response.json();
  }

  /**
   * Test connection to TPE
   */
  async testConnection() {
    try {
      if (this.config.connectionType === 'network') {
        const url = `http://${this.config.ipAddress}:${this.config.port}/status`;
        const response = await fetch(url, { timeout: 5000 });
        return { success: response.ok, status: response.status };
      } else if (this.config.connectionType === 'serial' && this.ipcRenderer) {
        return new Promise((resolve) => {
          this.ipcRenderer.once('tpe-test-response', (event, result) => {
            resolve(result);
          });
          this.ipcRenderer.send('tpe-test-connection', {
            port: this.config.serialPort,
            baudRate: this.config.baudRate
          });
        });
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel ongoing payment
   */
  async cancelPayment(transactionId) {
    console.log(`[TPE] Cancelling payment: ${transactionId}`);
    
    if (this.ipcRenderer) {
      this.ipcRenderer.send('tpe-cancel-payment', { transactionId });
    }

    return { success: true, message: 'Payment cancelled' };
  }
}

// Export singleton instance
const tpeIntegration = new TPEIntegration();
export default tpeIntegration;
