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
  const searchRef = useRef<{ search: string; location: string }>({ search: '', location: '' });

  const loadVets = useCallback(async (search = '', location = '') => {
    setLoading(true);
    setError(null);
    nextCursorRef.current = null;
    searchRef.current = { search, location };
    try {
      const params: Record<string, string> = { cursor: '' };
      if (search) params.search = search;
      if (location) params.location = location;
      const res = await vetsAPI.getAll(params);
      setVets(res.vets || []);
      nextCursorRef.current = res.next_cursor || null;
      setHasMore(!!res.next_cursor);
      return res.vets || [];
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursorRef.current || loading) return;
    setError(null); // Clear previous error so retry doesn't show stale banner
    setLoading(true);
    try {
      const { search, location } = searchRef.current;
      const params: Record<string, string> = { cursor: nextCursorRef.current };
      if (search) params.search = search;
      if (location) params.location = location;
      const res = await vetsAPI.getAll(params);
      setVets(prev => [...prev, ...(res.vets || [])]);
      nextCursorRef.current = res.next_cursor || null;
      setHasMore(!!res.next_cursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await vetsAPI.getLocations();
      setLocations(res.locations || []);
    } catch {}
  }, []);

  return { vets, setVets, locations, loading, error, hasMore, loadVets, loadMore, loadLocations };
}
