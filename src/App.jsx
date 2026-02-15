import React, { useState, useEffect } from 'react';
import License from './components/License/License';
import licenseUtil from './utils/license';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout/Layout';
import Setup from './pages/Setup/Setup';
import LoginChoice from './components/LoginChoice/LoginChoice';
import Login from './components/Login/Login';
import ForgotPassword from './components/ForgotPassword/ForgotPassword';
import Checkout from './pages/Checkout/Checkout';
import SalesByInvoices from './pages/SalesByInvoices/SalesByInvoices';
import Products from './pages/Products/Products';
import SalesStats from './pages/SalesStats/SalesStats';
import Employees from './pages/Employees/Employees';
import Dashboard from './pages/Dashboard/Dashboard';
import InvoiceHistory from './pages/InvoiceHistory/InvoiceHistory';
import ProductReturn from './pages/ProductReturn/ProductReturn';
import SupplierInvoices from './pages/SupplierInvoices/SupplierInvoices';
import Settings from './pages/Settings/Settings';
import Contact from './pages/Contact/Contact';
import DatabaseMigration from './pages/DatabaseMigration/DatabaseMigration';
import NetworkSettings from './pages/NetworkSettings/NetworkSettings';
import TPESettings from './pages/TPESettings/TPESettings';
import { isSetupCompleted, isPasswordRequired } from './utils/auth';
import './App.css';
import Notification from './components/Notification/Notification';
import UpdateNotification from './update/UpdateNotification';

// Clear session before anything else
if (typeof window !== 'undefined') {
  sessionStorage.removeItem('authenticated');
  console.log('🔄 Session cleared on module load');
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Force check on every mount
    const checkAuth = () => {
      // Check if password is required for protected pages
      const needsPassword = isPasswordRequired();
      console.log('🔍 ProtectedRoute - Password required:', needsPassword);
      
      if (!needsPassword) {
        console.log('✅ No password set - allowing access');
        setIsAuthenticated(true);
      } else {
        // Check if already authenticated in this session
        const sessionAuth = sessionStorage.getItem('authenticated');
        console.log('🔑 Session authenticated:', sessionAuth);
        
        if (sessionAuth === 'true') {
          console.log('✅ Session valid - allowing access');
          setIsAuthenticated(true);
        } else {
          console.log('❌ Not authenticated - showing login');
          setShowLogin(true);
          setIsAuthenticated(false);
        }
      }
    };
    
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    sessionStorage.setItem('authenticated', 'true');
    setIsAuthenticated(true);
    setShowLogin(false);
  };

  return (
    <>
      {/* Always render the page content */}
      {children}
      
      {/* Show login modal overlay if not authenticated */}
      {!isAuthenticated && (
        <>
          <Login 
            isOpen={showLogin} 
            onClose={() => setShowLogin(false)}
            onSuccess={handleLoginSuccess}
            showForgotPassword={() => {
              setShowLogin(false);
              setShowForgotPassword(true);
            }}
          />
          <ForgotPassword
            isOpen={showForgotPassword}
            onClose={() => {
              setShowForgotPassword(false);
              setShowLogin(true);
            }}
          />
        </>
      )}
    </>
  );
};



function App() {
  const [activated, setActivated] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState(true);
  const [showLoginChoice, setShowLoginChoice] = useState(false);

  // Global app notification state (listens to CustomEvent 'app-notification')
  const [appNotification, setAppNotification] = useState(null);

  useEffect(() => {
    const handler = (e) => setAppNotification(e?.detail || null);
    window.addEventListener('app-notification', handler);
    return () => window.removeEventListener('app-notification', handler);
  }, []);

  // Check license activation status on app launch
  useEffect(() => {
    const checkLicense = async () => {
      const machineId = licenseUtil.getMachineId();
      const activation = await licenseUtil.loadActivation(machineId);
      if (
        activation &&
        activation.license_key &&
        activation.machine_id === machineId &&
        activation.expiry &&
        new Date(activation.expiry) > new Date()
      ) {
        setActivated(true);
      } else {
        setActivated(false);
      }
    };
    checkLicense();
  }, []);

  // Clear session on layout effect
  React.useLayoutEffect(() => {
    const cleared = sessionStorage.getItem('authenticated');
    if (cleared) {
      sessionStorage.removeItem('authenticated');
      console.log('🔄 Session cleared in useLayoutEffect');
    }
  }, []);

  // Setup and migration checks
  useEffect(() => {
    // Check if auth data exists at all (first run detection)
    const hasAuthData = localStorage.getItem('authData');
    if (!hasAuthData) {
      setSetupCompleted(false);
      setShowLoginChoice(false);
    } else {
      const isCompleted = isSetupCompleted();
      setSetupCompleted(isCompleted);
      if (isCompleted) {
        setShowLoginChoice(true);
      }
    }
    const dbMigrated = localStorage.getItem('dbMigrated');
    const hasData = localStorage.getItem('products') || localStorage.getItem('invoiceHistory') || localStorage.getItem('employees');
    if (!dbMigrated && hasData) {
      setShowMigration(true);
    }
    setLoading(false);
  }, []);

  // Only allow Setup page if activated
  return (
    <SettingsProvider>
      <UpdateNotification />
      {/* Global Notification bridge (shown on any 'app-notification' event) */}
      {appNotification && (
        <Notification
          message={appNotification.message}
          type={appNotification.type || 'info'}
          onClose={() => setAppNotification(null)}
        />
      )}
      <Router>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)'
          }}>
            <h2>Loading...</h2>
          </div>
        ) : !activated ? (
          <License onActivated={() => setActivated(true)} />
        ) : !setupCompleted ? (
          <Routes>
            <Route path="*" element={<Setup onComplete={() => setSetupCompleted(true)} />} />
          </Routes>
        ) : showMigration ? (
          <DatabaseMigration onComplete={() => setShowMigration(false)} />
        ) : showLoginChoice ? (
          <LoginChoice
            onLoginSuccess={() => setShowLoginChoice(false)}
            onSkipLogin={() => setShowLoginChoice(false)}
          />
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Checkout />} />
              <Route path="/document-generator" element={<SalesByInvoices />} />
              <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/sales" element={<ProtectedRoute><SalesStats /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
              <Route path="/supplier-invoices" element={<ProtectedRoute><SupplierInvoices /></ProtectedRoute>} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/invoices" element={<InvoiceHistory />} />
              <Route path="/returns" element={<ProductReturn />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/network" element={<NetworkSettings />} />
              <Route path="/tpe" element={<TPESettings />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </Layout>
        )}
      </Router>
    </SettingsProvider>
  );
}

export default App;
