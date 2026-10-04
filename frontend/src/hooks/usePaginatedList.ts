import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PagedResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

type FetcherArgs = {
  page: number;
  size: number;
  search: string;
  sort: string;
  filters: Record<string, any>;
};

/**
 * Generic pagination + debounced search + filters + sort, matching the
 * {content, totalElements, totalPages, page, size} shape every /search
 * backend endpoint returns. Use with PaginatedTable.
 */
export function usePaginatedList<T>(
  fetcher: (args: FetcherArgs) => Promise<PagedResponse<T>>,
  opts?: { initialSize?: number; initialSort?: string; debounceMs?: number }
) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(opts?.initialSize ?? 10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(opts?.initialSort ?? "");
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<T[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Debounce free-text search input -> triggers a fetch from page 0.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, opts?.debounceMs ?? 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const load = useCallback(async () => {
    const myId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher({ page, size, search, sort, filters });
      if (myId !== requestId.current) return; // stale response, ignore
      setRows(res.content ?? []);
      setTotalElements(res.totalElements ?? 0);
      setTotalPages(res.totalPages ?? 0);
    } catch (e: any) {
      if (myId !== requestId.current) return;
      setError(e?.response?.data?.error || e?.message || "Failed to load");
      setRows([]);
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size, search, sort, JSON.stringify(filters)]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(0);
  }, []);

  return useMemo(
    () => ({
      rows,
      totalElements,
      totalPages,
      page,
      size,
      loading,
      error,
      searchInput,
      setSearchInput,
      sort,
      setSort,
      filters,
      setFilter,
      clearFilters,
      setPage,
      setSize,
      reload: load,
    }),
    [rows, totalElements, totalPages, page, size, loading, error, searchInput, sort, filters, setFilter, clearFilters, load]
  );
}
