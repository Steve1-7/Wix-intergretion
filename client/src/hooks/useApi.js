import { useState, useEffect, useCallback } from 'react';

export function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useApiMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async (url, method = 'POST', body = null) => {
    setLoading(true);
    setError(null);
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const res = await fetch(url, options);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error?.message || errBody.error || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      return json;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
