// Simple password hashing using browser's crypto API
export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Generate random verification code
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store auth data
export const saveAuthData = (email, passwordHash = null) => {
  const authData = {
    email,
    passwordHash,
    setupCompleted: true
  };
  localStorage.setItem('authData', JSON.stringify(authData));
};

// Get auth data
export const getAuthData = () => {
  const data = localStorage.getItem('authData');
  return data ? JSON.parse(data) : null;
};

// Check if setup is completed
export const isSetupCompleted = () => {
  const authData = getAuthData();
  // Setup is completed only if authData exists and has setupCompleted flag set to true
  return authData?.setupCompleted === true;
};

// Check if password is required
export const isPasswordRequired = () => {
  const authData = getAuthData();
  // Password is required only if passwordHash exists and is not null/undefined
  return !!(authData?.passwordHash);
};

// Verify password
export const verifyPassword = async (inputPassword) => {
  const authData = getAuthData();
  console.log('🔍 Verify Password - Auth Data:', authData);
  
  if (!authData?.passwordHash) {
    console.log('⚠️ No password hash found - allowing access');
    return true; // No password set
  }
  
  const inputHash = await hashPassword(inputPassword);
  console.log('🔑 Input Hash:', inputHash);
  console.log('🔑 Stored Hash:', authData.passwordHash);
  console.log('✅ Match:', inputHash === authData.passwordHash);
  
  return inputHash === authData.passwordHash;
};

// Update password
export const updatePassword = async (newPassword) => {
  const authData = getAuthData();
  if (!authData) return false;
  
  const newHash = await hashPassword(newPassword);
  authData.passwordHash = newHash;
  localStorage.setItem('authData', JSON.stringify(authData));
  return true;
};

// Store verification code with expiry
export const storeVerificationCode = (code) => {
  const data = {
    code,
    expiry: Date.now() + 10 * 60 * 1000 // 10 minutes
  };
  localStorage.setItem('verificationCode', JSON.stringify(data));
};

// Verify code
export const verifyCode = (inputCode) => {
  const data = localStorage.getItem('verificationCode');
  if (!data) return false;
  
  const { code, expiry } = JSON.parse(data);
  
  if (Date.now() > expiry) {
    localStorage.removeItem('verificationCode');
    return false;
  }
  
  return code === inputCode;
};

// Logout - clear session
export const logout = () => {
  sessionStorage.removeItem('authenticated');
  sessionStorage.removeItem('loginMode');
};

// Clear verification code
export const clearVerificationCode = () => {
  localStorage.removeItem('verificationCode');
};
