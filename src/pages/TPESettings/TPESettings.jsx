import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import tpeIntegration from '../../utils/tpeIntegration';
import './TPESettings.css';
import { notify } from '../../utils/notifications';

function TPESettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(tpeIntegration.config);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleChange = (field, value) => {
    setConfig({ ...config, [field]: value });
  };

  const handleCustomProtocolChange = (field, value) => {
    setConfig({
      ...config,
      customProtocol: {
        ...config.customProtocol,
        [field]: value
      }
    });
  };

  const handleSave = async () => {
    tpeIntegration.saveConfig(config);
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('show-message-box', {
        type: 'info',
        buttons: ['OK'],
        title: t('common.success') || 'Success',
        message: t('settings.saved') || 'Settings saved successfully!'
      });
    } else {
      notify(t('settings.saved') || 'Settings saved successfully!', 'success');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await tpeIntegration.testConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    }
    
    setTesting(false);
  };

  return (
    <div className="tpe-settings">
      <div className="tpe-settings-header">
        <h1>💳 {t('tpe.title') || 'TPE Configuration (Card Terminal)'}</h1>
        <p>{t('tpe.description') || 'Configure your electronic payment terminal for card payments'}</p>
      </div>

      <div className="tpe-settings-content">
        {/* Enable TPE */}
        <div className="settings-section">
          <h2>{t('tpe.enable') || 'Enable Card Terminal'}</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
            />
            <span>{config.enabled ? (t('tpe.enabled') || 'Enabled') : (t('tpe.disabled') || 'Disabled')}</span>
          </label>
        </div>

        {config.enabled && (
          <>
            {/* Terminal Brand */}
            <div className="settings-section">
              <h2>{t('tpe.brand') || 'Terminal Brand'}</h2>
              <select
                value={config.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                className="tpe-select"
              >
                <option value="generic">{t('tpe.generic') || 'Generic (Auto-detect)'}</option>
                <option value="custom">{t('tpe.custom') || '🔧 Custom Protocol (Advanced)'}</option>
                <option value="ingenico">Ingenico / Telium</option>
                <option value="verifone">Verifone VX</option>
                <option value="worldline">Worldline</option>
                <option value="pax">PAX Technology</option>
                <option value="sumup">SumUp</option>
                <option value="stripe">Stripe Terminal</option>
              </select>
              
              {config.brand === 'custom' && (
                <div className="custom-notice">
                  <strong>⚙️ {t('tpe.customMode') || 'Custom Protocol Mode'}</strong>
                  <p>{t('tpe.customModeDesc') || 'Configure your own terminal protocol below (Network or Serial configuration)'}</p>
                </div>
              )}
            </div>

            {/* Test Mode & Debug */}
            <div className="settings-section">
              <h2>🧪 {t('tpe.advanced') || 'Advanced Options'}</h2>
              
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={config.testMode}
                  onChange={(e) => handleChange('testMode', e.target.checked)}
                />
                <span>
                  <strong>{t('tpe.testMode') || '🧪 Test Mode (Simulate Payments)'}</strong>
                  <br/>
                  <small>{t('tpe.testModeDesc') || 'Enable to test payments without real terminal (90% approval rate)'}</small>
                </span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={config.debug}
                  onChange={(e) => handleChange('debug', e.target.checked)}
                />
                <span>
                  <strong>{t('tpe.debugMode') || '🐛 Debug Mode'}</strong>
                  <br/>
                  <small>{t('tpe.debugDesc') || 'Show detailed logs in browser console (for troubleshooting)'}</small>
                </span>
              </label>
            </div>

            {/* Connection Type */}
            <div className="settings-section">
              <h2>{t('tpe.connectionType') || 'Connection Type'}</h2>
              <div className="connection-selector">
                <label className={`connection-option ${config.connectionType === 'network' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="network"
                    checked={config.connectionType === 'network'}
                    onChange={(e) => handleChange('connectionType', e.target.value)}
                  />
                  <div>
                    <strong>🌐 {t('tpe.network') || 'Network (IP)'}</strong>
                    <p>{t('tpe.networkDesc') || 'Connect via Ethernet/WiFi'}</p>
                  </div>
                </label>

                <label className={`connection-option ${config.connectionType === 'serial' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="serial"
                    checked={config.connectionType === 'serial'}
                    onChange={(e) => handleChange('connectionType', e.target.value)}
                  />
                  <div>
                    <strong>🔌 {t('tpe.serial') || 'Serial (COM/USB)'}</strong>
                    <p>{t('tpe.serialDesc') || 'Connect via serial cable'}</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Network Configuration */}
            {config.connectionType === 'network' && (
              <div className="settings-section">
                <h2>{t('tpe.networkConfig') || 'Network Configuration'}</h2>
                
                <div className="form-group">
                  <label>{t('tpe.ipAddress') || 'IP Address'}</label>
                  <input
                    type="text"
                    value={config.ipAddress}
                    onChange={(e) => handleChange('ipAddress', e.target.value)}
                    placeholder="192.168.1.100"
                    className="tpe-input"
                  />
                </div>

                <div className="form-group">
                  <label>{t('tpe.port') || 'Port'}</label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => handleChange('port', parseInt(e.target.value))}
                    placeholder="8080"
                    className="tpe-input"
                  />
                </div>

                {['sumup', 'stripe', 'worldline'].includes(config.brand) && (
                  <div className="form-group">
                    <label>{t('tpe.apiKey') || 'API Key'}</label>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) => handleChange('apiKey', e.target.value)}
                      placeholder="sk_live_..."
                      className="tpe-input"
                    />
                  </div>
                )}

                {/* Custom Network Protocol */}
                {config.brand === 'custom' && (
                  <>
                    <div className="form-group">
                      <label>{t('tpe.endpoint') || 'API Endpoint (optional)'}</label>
                      <input
                        type="text"
                        value={config.apiEndpoint || ''}
                        onChange={(e) => handleChange('apiEndpoint', e.target.value)}
                        placeholder="http://192.168.1.100:8080/payment"
                        className="tpe-input"
                      />
                      <small>{t('tpe.endpointHelp') || 'Leave empty to use IP:Port/payment'}</small>
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.httpMethod') || 'HTTP Method'}</label>
                      <select
                        value={config.customProtocol?.httpMethod || 'POST'}
                        onChange={(e) => handleCustomProtocolChange('httpMethod', e.target.value)}
                        className="tpe-select"
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.bodyTemplate') || 'Request Body Template'}</label>
                      <textarea
                        value={config.customProtocol?.httpBodyTemplate || ''}
                        onChange={(e) => handleCustomProtocolChange('httpBodyTemplate', e.target.value)}
                        placeholder='{"amount":{amount},"currency":"{currency}","reference":"{txId}"}'
                        className="tpe-textarea"
                        rows="4"
                      />
                      <small>{t('tpe.bodyHelp') || 'Use {amount}, {currency}, {txId} as placeholders'}</small>
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.approvedKeywords') || 'Approval Keywords (comma-separated)'}</label>
                      <input
                        type="text"
                        value={config.customProtocol?.approvedKeywords?.join(',') || ''}
                        onChange={(e) => handleCustomProtocolChange('approvedKeywords', e.target.value.split(',').map(k => k.trim()))}
                        placeholder="APPROVED,OK,00,SUCCESS"
                        className="tpe-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.declinedKeywords') || 'Declined Keywords (comma-separated)'}</label>
                      <input
                        type="text"
                        value={config.customProtocol?.declinedKeywords?.join(',') || ''}
                        onChange={(e) => handleCustomProtocolChange('declinedKeywords', e.target.value.split(',').map(k => k.trim()))}
                        placeholder="DECLINED,REFUSED,ERROR,FAILED"
                        className="tpe-input"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Serial Configuration */}
            {config.connectionType === 'serial' && (
              <div className="settings-section">
                <h2>{t('tpe.serialConfig') || 'Serial Configuration'}</h2>
                
                <div className="form-group">
                  <label>{t('tpe.serialPort') || 'Serial Port'}</label>
                  <select
                    value={config.serialPort}
                    onChange={(e) => handleChange('serialPort', e.target.value)}
                    className="tpe-select"
                  >
                    <option value="COM1">COM1</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                    <option value="/dev/ttyUSB0">/dev/ttyUSB0 (Linux)</option>
                    <option value="/dev/ttyUSB1">/dev/ttyUSB1 (Linux)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('tpe.baudRate') || 'Baud Rate'}</label>
                  <select
                    value={config.baudRate}
                    onChange={(e) => handleChange('baudRate', parseInt(e.target.value))}
                    className="tpe-select"
                  >
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="115200">115200</option>
                  </select>
                </div>

                {/* Custom Serial Protocol */}
                {config.brand === 'custom' && (
                  <>
                    <div className="form-group">
                      <label>{t('tpe.paymentCommand') || 'Payment Command Template'}</label>
                      <textarea
                        value={config.customProtocol?.paymentCommand || ''}
                        onChange={(e) => handleCustomProtocolChange('paymentCommand', e.target.value)}
                        placeholder="PAY:{amount}:{currency}:{txId}\r\n"
                        className="tpe-textarea"
                        rows="3"
                      />
                      <small>{t('tpe.commandHelp') || 'Use {amount}, {currency}, {txId} as placeholders. \\r\\n for newlines.'}</small>
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.responseTerminator') || 'Response Terminator'}</label>
                      <input
                        type="text"
                        value={config.customProtocol?.responseTerminator || ''}
                        onChange={(e) => handleCustomProtocolChange('responseTerminator', e.target.value)}
                        placeholder="\r\n or \n or custom"
                        className="tpe-input"
                      />
                      <small>{t('tpe.terminatorHelp') || 'Character(s) that end the response'}</small>
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.approvedKeywords') || 'Approval Keywords (comma-separated)'}</label>
                      <input
                        type="text"
                        value={config.customProtocol?.approvedKeywords?.join(',') || ''}
                        onChange={(e) => handleCustomProtocolChange('approvedKeywords', e.target.value.split(',').map(k => k.trim()))}
                        placeholder="APPROVED,OK,00,SUCCESS"
                        className="tpe-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('tpe.declinedKeywords') || 'Declined Keywords (comma-separated)'}</label>
                      <input
                        type="text"
                        value={config.customProtocol?.declinedKeywords?.join(',') || ''}
                        onChange={(e) => handleCustomProtocolChange('declinedKeywords', e.target.value.split(',').map(k => k.trim()))}
                        placeholder="DECLINED,REFUSED,ERROR,FAILED"
                        className="tpe-input"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Test Connection */}
            <div className="settings-section">
              <h2>{t('tpe.testConnection') || 'Test Connection'}</h2>
              <button onClick={handleTest} disabled={testing} className="btn-test">
                {testing ? (t('tpe.testing') || 'Testing...') : (t('tpe.test') || 'Test Terminal')}
              </button>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  <span className="result-icon">{testResult.success ? '✅' : '❌'}</span>
                  <span>{testResult.message || testResult.error || (testResult.success ? 'Connection successful!' : 'Connection failed')}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Save Button */}
        <div className="settings-actions">
          <button onClick={handleSave} className="btn-save">
            {t('settings.save') || 'Save Settings'}
          </button>
        </div>

        {/* Information */}
        <div className="settings-section info-section">
          <h2>ℹ️ {t('tpe.info') || 'Information'}</h2>
          <ul>
            <li><strong>{t('tpe.info1') || 'Network mode:'}</strong> {t('tpe.info1Desc') || 'For modern IP-based terminals (Ethernet/WiFi)'}</li>
            <li><strong>{t('tpe.info2') || 'Serial mode:'}</strong> {t('tpe.info2Desc') || 'For traditional terminals with COM/USB cable'}</li>
            <li><strong>{t('tpe.info3') || 'Supported brands:'}</strong> Ingenico, Verifone, PAX, Worldline, SumUp, Stripe</li>
            <li><strong>{t('tpe.info4') || 'Payment flow:'}</strong> {t('tpe.info4Desc') || 'Amount is automatically sent to terminal when customer pays by card'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TPESettings;
