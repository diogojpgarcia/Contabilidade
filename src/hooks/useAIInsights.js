/**
 * useAIInsights — fetches AI-generated narrative analysis for a financial period.
 *
 * Caches results per period key so repeated renders don't re-fetch.
 * Never sends raw transaction descriptions to the server — only aggregated stats.
 */
import { useState, useEffect, useRef } from 'react';

// Module-level cache: key → { summary, narrative, recommendations, outlook }
const cache = new Map();

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
    if (cache.has(cacheKey)) {
      setData(cache.get(cacheKey));
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
      behavioralInsights: (behavioralInsights || []).slice(0, 5).map(i => ({
        title:   i.title,
        message: i.message,
      })),
    };

    fetch('/api/insights', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then(result => {
        cache.set(cacheKey, result);
        setData(result);
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
    if (cacheKey) cache.delete(cacheKey);
    setData(null);
  };

  return { data, loading, error, refresh };
}
