import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError } from "../types/api";

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
    // loader identity is controlled by deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
