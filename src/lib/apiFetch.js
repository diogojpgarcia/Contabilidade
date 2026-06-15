import { supabase } from './supabase';

/**
 * fetch() para os endpoints /api/* da app. Injeta o JWT do Supabase no header
 * Authorization para que os endpoints serverless possam exigir autenticação
 * (evita que sejam usados como proxy aberto). Mantém as opções passadas
 * (ex. AbortController signal).
 */
export async function apiFetch(url, opts = {}) {
  let token;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token;
  } catch { /* sem sessão → segue sem header (dev) */ }
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}
