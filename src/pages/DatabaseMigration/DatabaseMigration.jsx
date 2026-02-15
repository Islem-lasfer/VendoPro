import React, { useState } from 'react';
import './DatabaseMigration.css';
import { migrateFromLocalStorage } from '../../utils/database';

const DatabaseMigration = ({ onComplete }) => {
  const [migrating, setMigrating] = useState(false);
  const [status, setStatus] = useState('');
  const [completed, setCompleted] = useState(false);

  const handleMigrate = async () => {
    setMigrating(true);
    setStatus('Starting migration...');

    try {
      setStatus('Migrating products...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setStatus('Migrating invoices...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setStatus('Migrating supplier invoices...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setStatus('Migrating employees...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await migrateFromLocalStorage();

      if (result.success) {
        setStatus('✅ Migration completed successfully!');
        setCompleted(true);
        
        // Clear localStorage after successful migration
        localStorage.removeItem('products');
        localStorage.removeItem('invoiceHistory');
        localStorage.removeItem('supplierInvoices');
        localStorage.removeItem('employees');
        localStorage.setItem('dbMigrated', 'true');
        
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 2000);
      } else {
        setStatus('❌ Migration failed: ' + result.error);
      }
    } catch (error) {
      setStatus('❌ Migration error: ' + error.message);
    } finally {
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('dbMigrated', 'true');
    if (onComplete) onComplete();
  };

  return (
    <div className="migration-overlay">
      <div className="migration-modal">
        <div className="migration-header">
          <h2>🗄️ Database Migration</h2>
          <p>We're upgrading to a new database system for better performance and reliability.</p>
        </div>

        <div className="migration-content">
          {!completed && (
            <>
              <div className="migration-info">
                <p>This will migrate your existing data from browser storage to SQLite database:</p>
                <ul>
                  <li>✓ All products and inventory</li>
                  <li>✓ Sales invoices and history</li>
                  <li>✓ Supplier invoices</li>
                  <li>✓ Employee records</li>
                  <li>✓ Settings and preferences</li>
                </ul>
                <p className="migration-note">
                  <strong>Note:</strong> This process is safe and won't delete your existing data until migration is complete.
                </p>
              </div>

              {status && (
                <div className={`migration-status ${completed ? 'success' : ''}`}>
                  {status}
                </div>
              )}

              <div className="migration-actions">
                <button
                  className="migrate-btn primary-btn"
                  onClick={handleMigrate}
                  disabled={migrating}
                >
                  {migrating ? '🔄 Migrating...' : '🚀 Start Migration'}
                </button>
                <button
                  className="skip-btn secondary-btn"
                  onClick={handleSkip}
                  disabled={migrating}
                >
                  Skip (Start Fresh)
                </button>
              </div>
            </>
          )}

          {completed && (
            <div className="migration-complete">
              <div className="success-icon">✅</div>
              <h3>Migration Complete!</h3>
              <p>Your data has been successfully migrated to the new database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseMigration;
