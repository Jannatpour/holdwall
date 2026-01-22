/**
 * Lazy Loader
 * 
 * Lazy loading for large datasets
 * Uses pagination and virtual scrolling
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
  total?: number;
}

export interface LazyLoadResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Lazy load with pagination
 */
export async function lazyLoad<T>(
  loader: (offset: number, limit: number) => Promise<{ items: T[]; total?: number }>,
  options: PaginationOptions
): Promise<LazyLoadResult<T>> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;

  const { items, total } = await loader(offset, pageSize);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: total || items.length,
      hasMore: total ? offset + items.length < total : items.length === pageSize,
    },
  };
}

/**
 * Virtual scrolling helper
 * Calculates which items to load based on scroll position
 */
export function calculateVirtualRange(
  scrollTop: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
): { startIndex: number; endIndex: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = startIndex + visibleCount + overscan * 2;

  return { startIndex, endIndex };
}

/**
 * Load items for virtual scrolling
 */
export async function loadVirtualItems<T>(
  allItems: T[],
  startIndex: number,
  endIndex: number
): Promise<T[]> {
  return allItems.slice(startIndex, endIndex);
}
