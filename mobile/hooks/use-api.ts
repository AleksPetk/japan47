import { DependencyList, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function useApi<T>(path: string | null, dependencies: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    if (!path) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((value) => { if (active) setData(value); })
      .catch((requestError) => { if (active) setError(requestError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Callers supply primitive values that determine the request identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, revision, ...dependencies]);

  return { data, loading, error, reload, setData };
}
