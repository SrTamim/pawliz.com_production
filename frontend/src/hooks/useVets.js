import { useState, useCallback, useRef } from 'react';
import { vetsAPI } from '../lib/api';

export function useVets() {
  const [vets, setVets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const nextCursorRef = useRef(null);
  const searchRef = useRef({ search: '', location: '' });

  const loadVets = useCallback(async (search = '', location = '') => {
    setLoading(true);
    setError(null);
    nextCursorRef.current = null;
    searchRef.current = { search, location };
    try {
      const params = { cursor: '' };
      if (search) params.search = search;
      if (location) params.location = location;
      const res = await vetsAPI.getAll(params);
      setVets(res.vets || []);
      nextCursorRef.current = res.next_cursor || null;
      setHasMore(!!res.next_cursor);
      return res.vets || [];
    } catch (e) {
      setError(e.message);
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
      const params = { cursor: nextCursorRef.current };
      if (search) params.search = search;
      if (location) params.location = location;
      const res = await vetsAPI.getAll(params);
      setVets(prev => [...prev, ...(res.vets || [])]);
      nextCursorRef.current = res.next_cursor || null;
      setHasMore(!!res.next_cursor);
    } catch (e) {
      setError(e.message);
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
