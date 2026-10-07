import { useCallback, useEffect, useState } from 'react';

// Runs `fn` whenever `deps` change (deps must be JSON-serialisable) and exposes
// { data, error, loading, reload }. Previous data stays available while a new request runs.
export default function useAsync(fn, deps = []) {
  const [tick, setTick] = useState(0);
  const key = `${JSON.stringify(deps)}#${tick}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(fn)
      .then((data) => { if (!cancelled) setResult({ key, data, error: null }); })
      .catch((error) => { if (!cancelled) setResult({ key, data: null, error }); });
    return () => { cancelled = true; };
    // `fn` is intentionally excluded: `deps` describes when to run again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: result.data, error: result.error, loading: result.key !== key, reload };
}
