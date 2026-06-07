/**
 * api/_auth.js — shared request authentication for all Vercel serverless functions.
 *
 * Strategy: Supabase JWT verification.
 * The client sends the user's access token in `Authorization: Bearer <token>`.
 * The server validates it against Supabase (auth.getUser) so only authenticated
 * users of THIS project can call the protected endpoints (which spend the
 * server-side Anthropic API key).
 *
 * Env (available to Vercel functions via process.env regardless of the VITE_ prefix):
 *   - VITE_SUPABASE_URL / SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 *
 * If Supabase env is not configured (local dev without env), auth is skipped.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let _client = null;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/** Extracts and verifies the Bearer token. Returns the user object or null. */
async function getUser(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const client = getClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Call at the top of each handler:  if (!(await requireAuth(req, res))) return;
 * Sends 401 and returns false if unauthorized.
 */
async function requireAuth(req, res) {
  // Dev: no Supabase env configured → allow all (local `vercel dev` without env).
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true;
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireAuth, getUser };
