import { useState, useEffect, useCallback } from 'react';

/**
 * Hook: Execute async function, track loading/error/data state.
 * Auto-run (immediate=true): guarded with mounted flag — safe on unmount.
 * Manual execute(): caller-triggered, no unmount risk (component must be mounted to call it).
 * @param asyncFunction Async function to execute
 * @param immediate Execute immediately on mount (default: true)
 * @param dependencies Dependency array for re-execution
 * @returns { data, loading, error, execute }
 */
export function useAsync<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  immediate = true,
  dependencies: any[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  // Manual execute — called by user interaction, component is always mounted at call time
  const execute = useCallback(async (...args: any[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...args);
      setData(result);
      return result;
    } catch (err: any) {
      setError((err as Error)?.message || 'An error occurred');
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
      } catch (err: any) {
        if (mounted) setError((err as Error)?.message || 'An error occurred');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, execute };
}
