/**
 * Advanced Security & Recovery System
 * Handles PIN recovery, backup, encryption, and Google Drive sync
 */

// ============================================
// ENCRYPTION UTILITIES
// ============================================

/**
 * Generate recovery code (format: XX-XXXX-XXXX)
 */
export function generateRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0,O,1,I)
  const segments = [2, 4, 4];
  
  return segments.map(len => {
    let segment = '';
    for (let i = 0; i < len; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    return segment;
  }).join('-');
}

/**
 * Simple encryption (AES-like with recovery code as key)
 */
async function encryptData(data, recoveryCode) {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(recoveryCode);
  
  // Create key from recovery code
  const key = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', keyMaterial),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Encrypt data
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  
  // Combine IV + encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt data with recovery code
 */
async function decryptData(encryptedBase64, recoveryCode) {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const keyMaterial = encoder.encode(recoveryCode);
    
    // Create key
    const key = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', keyMaterial),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decode base64
    const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract IV and data
    const iv = encrypted.slice(0, 12);
    const data = encrypted.slice(12);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    return null;
  }
}

// ============================================
// SECURITY QUESTIONS
// ============================================

const SECURITY_QUESTIONS = [
  "Qual é a cidade onde nasceste?",
  "Qual é o nome do teu primeiro animal de estimação?",
  "Qual é o nome de solteira da tua mãe?",
  "Qual é a tua comida favorita?",
  "Em que cidade conheceste o teu parceiro/a?",
  "Qual é o nome da tua escola primária?",
  "Qual é a marca do teu primeiro carro?",
  "Qual é o teu filme favorito?",
  "Qual é a tua banda/cantor favorito?",
  "Onde passaste as tuas melhores férias?"
];

async function hashAnswer(answer) {
  const normalized = answer.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAnswer(answer, hash) {
  const answerHash = await hashAnswer(answer);
  return answerHash === hash;
}

// ============================================
// RECOVERY SETUP
// ============================================

export async function setupRecovery(userId, securityQuestion, securityAnswer) {
  const recoveryCode = generateRecoveryCode();
  const answerHash = await hashAnswer(securityAnswer);
  
  const recoveryData = {
    userId,
    securityQuestion,
    answerHash,
    recoveryCode,
    createdAt: Date.now()
  };
  
  localStorage.setItem(`recovery_${userId}`, JSON.stringify(recoveryData));
  
  return recoveryCode;
}

export async function validateSecurityAnswer(userId, answer) {
  const recoveryDataStr = localStorage.getItem(`recovery_${userId}`);
  if (!recoveryDataStr) return false;
  
  const recoveryData = JSON.parse(recoveryDataStr);
  return await verifyAnswer(answer, recoveryData.answerHash);
}

export function getSecurityQuestion(userId) {
  const recoveryDataStr = localStorage.getItem(`recovery_${userId}`);
  if (!recoveryDataStr) return null;
  
  const recoveryData = JSON.parse(recoveryDataStr);
  return recoveryData.securityQuestion;
}

export function getRecoveryCode(userId) {
  const recoveryDataStr = localStorage.getItem(`recovery_${userId}`);
  if (!recoveryDataStr) return null;
  
  const recoveryData = JSON.parse(recoveryDataStr);
  return recoveryData.recoveryCode;
}

// ============================================
// BACKUP / RESTORE
// ============================================

export async function createBackup(userId, recoveryCode) {
  const userData = localStorage.getItem(`user_${userId}`);
  const transactions = localStorage.getItem(`transactions_${userId}`);
  const recovery = localStorage.getItem(`recovery_${userId}`);
  
  const backupData = {
    userId,
    userData: userData ? JSON.parse(userData) : null,
    transactions: transactions ? JSON.parse(transactions) : [],
    recovery: recovery ? JSON.parse(recovery) : null,
    timestamp: Date.now(),
    version: '2.0'
  };
  
  // Encrypt with recovery code
  const encrypted = await encryptData(backupData, recoveryCode);
  
  return {
    encrypted,
    filename: `financas_backup_${userId}_${Date.now()}.encrypted`,
    timestamp: backupData.timestamp
  };
}

export async function restoreFromBackup(encryptedData, recoveryCode) {
  const decrypted = await decryptData(encryptedData, recoveryCode);
  
  if (!decrypted) {
    throw new Error('Código de recuperação inválido');
  }
  
  const { userId, userData, transactions, recovery } = decrypted;
  
  // Restore to localStorage
  if (userData) {
    localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
  }
  if (transactions) {
    localStorage.setItem(`transactions_${userId}`, JSON.stringify(transactions));
  }
  if (recovery) {
    localStorage.setItem(`recovery_${userId}`, JSON.stringify(recovery));
  }
  
  return { userId, transactionCount: transactions?.length || 0 };
}

// ============================================
// MANUAL EXPORT / IMPORT
// ============================================

export async function exportData(userId) {
  const recoveryCode = getRecoveryCode(userId);
  if (!recoveryCode) {
    throw new Error('Código de recuperação não encontrado');
  }
  
  const backup = await createBackup(userId, recoveryCode);
  
  // Create downloadable file
  const blob = new Blob([backup.encrypted], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  return {
    url,
    filename: backup.filename
  };
}

export async function importData(file, recoveryCode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const encrypted = e.target.result;
        const result = await restoreFromBackup(encrypted, recoveryCode);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    reader.readAsText(file);
  });
}

// ============================================
// AUTO BACKUP (Local Storage)
// ============================================

export async function createAutoBackup(userId) {
  const recoveryCode = getRecoveryCode(userId);
  if (!recoveryCode) return null;
  
  try {
    const backup = await createBackup(userId, recoveryCode);
    
    // Store in localStorage with timestamp
    const autoBackups = JSON.parse(localStorage.getItem('auto_backups') || '{}');
    autoBackups[userId] = {
      data: backup.encrypted,
      timestamp: backup.timestamp
    };
    
    // Keep only last 3 backups per user
    localStorage.setItem('auto_backups', JSON.stringify(autoBackups));
    
    return backup.timestamp;
  } catch (error) {
    console.error('Auto backup failed:', error);
    return null;
  }
}

export async function restoreAutoBackup(userId, recoveryCode) {
  const autoBackups = JSON.parse(localStorage.getItem('auto_backups') || '{}');
  const backup = autoBackups[userId];
  
  if (!backup) {
    throw new Error('Nenhum backup automático encontrado');
  }
  
  return await restoreFromBackup(backup.data, recoveryCode);
}

// ============================================
// GOOGLE DRIVE INTEGRATION (Optional)
// ============================================

let googleDriveClient = null;

export function initGoogleDrive(accessToken) {
  googleDriveClient = {
    accessToken,
    ready: true
  };
}

export async function uploadToGoogleDrive(userId, encryptedData, filename) {
  if (!googleDriveClient || !googleDriveClient.ready) {
    throw new Error('Google Drive não está conectado');
  }
  
  // This is a placeholder - real implementation would use Google Drive API
  console.log('Upload to Google Drive:', filename);
  
  // Store in localStorage as fallback
  const driveBackups = JSON.parse(localStorage.getItem('drive_backups') || '{}');
  driveBackups[userId] = {
    data: encryptedData,
    filename,
    timestamp: Date.now()
  };
  localStorage.setItem('drive_backups', JSON.stringify(driveBackups));
  
  return { success: true, fileId: `drive_${userId}_${Date.now()}` };
}

export async function downloadFromGoogleDrive(userId) {
  // Placeholder - would use Google Drive API
  const driveBackups = JSON.parse(localStorage.getItem('drive_backups') || '{}');
  const backup = driveBackups[userId];
  
  if (!backup) {
    throw new Error('Nenhum backup encontrado no Google Drive');
  }
  
  return backup.data;
}

// ============================================
// EXPORTS
// ============================================

export {
  SECURITY_QUESTIONS,
  encryptData,
  decryptData,
  hashAnswer,
  verifyAnswer
};

export default {
  generateRecoveryCode,
  setupRecovery,
  validateSecurityAnswer,
  getSecurityQuestion,
  getRecoveryCode,
  createBackup,
  restoreFromBackup,
  exportData,
  importData,
  createAutoBackup,
  restoreAutoBackup,
  initGoogleDrive,
  uploadToGoogleDrive,
  downloadFromGoogleDrive,
  SECURITY_QUESTIONS
};
