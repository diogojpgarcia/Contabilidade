/**
 * useAIInsights — fetches AI-generated narrative analysis for a financial period.
 *
 * Caches results per period key so repeated renders don't re-fetch.
 * Never sends raw transaction descriptions to the server — only aggregated stats.
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// LRU cache — max 12 entries (one per month for a year's browsing history)
const CACHE_MAX = 12;
const cache = new Map(); // insertion-order Map acts as LRU when we delete-then-set

function cacheSet(key, value) {
  if (cache.has(key)) cache.delete(key); // move to end (most recent)
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value); // evict oldest
}

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key); // move to end
  cache.set(key, value);
  return value;
}

/**
 * @param {object|null} summary  Output of buildInsightsSummary() from insights.js
 *                               Pass null to skip fetching.
 * @param {array}       behavioralInsights  Top behavioral insight objects (title+message only)
 */
export function useAIInsights(summary, behavioralInsights = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Stable cache key — only depends on period + core numbers, not full object identity
  const cacheKey = summary
    ? `${summary.period}|${summary.income}|${summary.expenses}|${summary.savings}`
    : null;

  const abortRef = useRef(null);

  useEffect(() => {
    if (!summary || !cacheKey) {
      setData(null);
      return;
    }

    // Cache hit
    const cached = cacheGet(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const payload = {
      ...summary,
      behavioralInsights: (behavioralInsights || []).slice(0, 6).map(i => ({
        title:   i.title,
        message: i.message,
      })),
    };

    // Autentica via JWT do Supabase — o token é verificado server-side em /api/_auth.
    supabase.auth.getSession()
      .then(({ data: { session } }) => fetch('/api/insights', {
        method:  'POST',
        headers: {
          'content-type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      }))
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(result => {
        // Normalise missing fields so consumers never need to guard undefined.map()
        const safe = {
          summary:         result.summary         || '',
          narrative:       result.narrative        || '',
          detailedAnalysis:result.detailedAnalysis || '',
          strengths:       Array.isArray(result.strengths)       ? result.strengths       : [],
          concerns:        Array.isArray(result.concerns)        ? result.concerns        : [],
          recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
          categoryInsights:Array.isArray(result.categoryInsights)? result.categoryInsights: [],
          projections:     result.projections      || '',
          outlook:         result.outlook          || '',
        };
        cacheSet(cacheKey, safe);
        setData(safe);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('[useAIInsights]', err);
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Manually clear cache for this period and re-fetch */
  const refresh = () => {
    if (cacheKey) cache.delete(cacheKey); // direct delete — no LRU bookkeeping needed
    setData(null);
  };

  return { data, loading, error, refresh };
}
