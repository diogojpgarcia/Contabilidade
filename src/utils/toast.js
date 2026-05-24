/**
 * toast.js — singleton acessível fora da árvore React.
 *
 * Os hooks (useSettings, useTransactions) importam `toast` daqui.
 * O ToastProvider regista os handlers reais ao montar.
 */

let _error   = null;
let _success = null;
let _warning = null;

export function registerToastHandlers({ showError, showSuccess, showWarning }) {
  _error   = showError;
  _success = showSuccess;
  _warning = showWarning;
}

export const toast = {
  error:   (msg) => { if (_error)   _error(msg);   else console.error('[toast]', msg); },
  success: (msg) => { if (_success) _success(msg); else console.log('[toast]', msg); },
  warning: (msg) => { if (_warning) _warning(msg); else console.warn('[toast]', msg); },
};
