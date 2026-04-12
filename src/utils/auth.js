/**
 * Authentication utilities for PIN-based login
 * Uses SHA-256 hashing for secure PIN storage
 */

const USERS = {
  diogo: {
    id: 'diogo',
    name: 'Diogo Garcia',
    initials: 'DG',
    color: '#3b82f6'
  },
  leila: {
    id: 'leila',
    name: 'Leila Ferreira',
    initials: 'LF',
    color: '#ec4899'
  }
};

/**
 * Hash a PIN using SHA-256
 */
async function hashPIN(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against stored hash
 */
async function verifyPIN(pin, hash) {
  const pinHash = await hashPIN(pin);
  return pinHash === hash;
}

/**
 * Get user data from localStorage
 */
function getUserData(userId) {
  const key = `user_${userId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Save user data to localStorage
 */
function saveUserData(userId, data) {
  const key = `user_${userId}`;
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Check if user has created a PIN
 */
function hasUserSetupPIN(userId) {
  const userData = getUserData(userId);
  return userData && userData.pinHash;
}

/**
 * Create PIN for user (first time setup)
 */
async function createUserPIN(userId, pin) {
  const pinHash = await hashPIN(pin);
  const userData = getUserData(userId) || {};
  userData.pinHash = pinHash;
  userData.pinLength = pin.length;
  saveUserData(userId, userData);
  return true;
}

/**
 * Validate user PIN
 */
async function validateUserPIN(userId, pin) {
  const userData = getUserData(userId);
  if (!userData || !userData.pinHash) {
    return false;
  }
  return await verifyPIN(pin, userData.pinHash);
}

/**
 * Get current session
 */
function getCurrentSession() {
  const session = sessionStorage.getItem('current_session');
  return session ? JSON.parse(session) : null;
}

/**
 * Set current session
 */
function setCurrentSession(userId) {
  const sessionData = {
    userId,
    timestamp: Date.now()
  };
  sessionStorage.setItem('current_session', JSON.stringify(sessionData));
}

/**
 * Clear current session
 */
function clearCurrentSession() {
  sessionStorage.removeItem('current_session');
}

export {
  USERS,
  hashPIN,
  verifyPIN,
  getUserData,
  saveUserData,
  hasUserSetupPIN,
  createUserPIN,
  validateUserPIN,
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession
};
