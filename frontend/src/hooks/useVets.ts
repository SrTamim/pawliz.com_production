import { useState, useCallback, useRef } from 'react';
import { vetsAPI } from '../lib/api';
import type { Vet } from '../types';

export function useVets() {
  const [vets, setVets] = useState<Vet[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const searchRef = useRef<{ search: string; location: string; minRating: number }>({ search: '', location: '', minRating: 0 });
  // Monotonic id for the latest filter/search request. Every loadVets bumps it;
  // both loadVets and loadMore stamp their id and discard their result if a newer
  // loadVets has since started. Prevents a slow earlier query (e.g. "clinic")
  // from overwriting a faster later one ("clin"), and stops loadMore from
  // appending a stale page after the filter changed.
  const requestIdRef = useRef(0);

  const loadVets = useCallback(async (search = '', location = '', noCache = false, minRating = 0) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    nextCursorRef.current = null;
    searchRef.current = { search, location, minRating };
    try {
      const params: Record<string, string> = { cursor: '' };
      if (search) params.search = search;
      if (location) params.location = location;
      if (minRating > 0) params.min_rating = String(minRating);
      const res = await vetsAPI.getAll(params, noCache);
      // A newer loadVets started while this was in flight — drop this result.
      if (reqId !== requestIdRef.current) return [];
      setVets(res.vets || []);
      nextCursorRef.current = res.next_cursor || null;
      setHasMore(!!res.next_cursor);
      return res.vets || [];
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return [];
      setError((e as Error).message);
      return [];
    } finally {
      // Only the latest request controls the shared loading flag.
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursorRef.current || loading) return;
    const reqId = requestIdRef.current; // tied to the current filter generation
    setError(null); // Clear previous error so retry doesn't show stale banner
    setLoading(true);
    try {
      const { search, location, minRating } = searchRef.current;
      const params: Record<string, string> = { cursor: nextCursorRef.current };
      if (search) params.search = search;
      if (location) params.location = location;
      if (minRating > 0) params.min_rating = String(minRating);
      const res = await vetsAPI.getAll(params);
      // The filter changed (a new loadVets ran) — this page is for the old list.
      if (reqId !== requestIdRef.current) return;
      setVets(prev => [...prev, ...(res.vets || [])]);
      nextCursorRef.current = res.next_cursor || null;
      setHasMore(!!res.next_cursor);
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      setError((e as Error).message);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [loading]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await vetsAPI.getLocations();
      setLocations(res.locations || []);
    } catch (e) {
      // Non-fatal: the location filter just stays empty. Log so a persistent
      // backend failure is visible instead of silently swallowed.
      console.debug('loadLocations failed:', e);
    }
  }, []);

  return { vets, setVets, locations, loading, error, hasMore, loadVets, loadMore, loadLocations };
}
