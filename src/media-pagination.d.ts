export const MEDIA_PAGE_SIZE: number;

export interface PaginatedItems<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  start: number;
  end: number;
  totalItems: number;
}

export function paginateItems<T>(items: T[], requestedPage: number, pageSize?: number): PaginatedItems<T>;
export function visiblePageNumbers(currentPage: number, totalPages: number, maxButtons?: number): Array<number | 'ellipsis-before' | 'ellipsis-after'>;
