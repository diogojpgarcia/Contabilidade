/**
 * api/_auth.js — shared request authentication for all Vercel serverless functions.
 *
 * Strategy: shared secret header (x-app-secret).
 * The secret lives in:
 *   - Server: process.env.API_SECRET  (Vercel env var — never in the bundle)
 *   - Client: import.meta.env.VITE_API_SECRET  (same value, set in Vercel + .env.local)
 *
 * This prevents casual abuse of the Anthropic API key by anonymous callers.
 * For stronger protection, replace with Supabase JWT verification.
 */

/**
 * Returns true if the request carries a valid shared secret, false otherwise.
 * If API_SECRET is not set in the environment, auth is skipped (dev mode).
 */
function isAuthorized(req) {
  const secret = process.env.API_SECRET;
  if (!secret) return true; // dev: no secret configured → allow all
  const header = req.headers['x-app-secret'];
  return header === secret;
}

/**
 * Call at the top of each handler. Sends 401 and returns false if unauthorized.
 * Usage: if (!requireAuth(req, res)) return;
 */
function requireAuth(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireAuth };
