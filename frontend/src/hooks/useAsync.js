import { useState, useEffect, useCallback } from 'react';

/**
 * Hook: Execute async function, track loading/error/data state.
 * Auto-run (immediate=true): guarded with mounted flag — safe on unmount.
 * Manual execute(): caller-triggered, no unmount risk (component must be mounted to call it).
 * @param {Function} asyncFunction - Async function to execute
 * @param {boolean} immediate - Execute immediately on mount (default: true)
 * @param {Array} dependencies - Dependency array for re-execution
 * @returns {Object} { data, loading, error, execute }
 */
export function useAsync(asyncFunction, immediate = true, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  // Manual execute — called by user interaction, component is always mounted at call time
  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err?.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run on mount / dependency change — guarded with mounted flag
  useEffect(() => {
    if (!immediate) return;
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await asyncFunction();
        if (mounted) setData(result);
      } catch (err) {
        if (mounted) setError(err?.message || 'An error occurred');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, execute };
}