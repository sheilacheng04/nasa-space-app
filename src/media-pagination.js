export const MEDIA_PAGE_SIZE = 10;

export function paginateItems(items, requestedPage, pageSize = MEDIA_PAGE_SIZE) {
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : MEDIA_PAGE_SIZE;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / size);
  const currentPage = totalPages ? Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages) : 1;
  const startOffset = (currentPage - 1) * size;

  return {
    items: items.slice(startOffset, startOffset + size),
    currentPage,
    totalPages,
    start: totalItems ? startOffset + 1 : 0,
    end: Math.min(startOffset + size, totalItems),
    totalItems
  };
}

export function visiblePageNumbers(currentPage, totalPages, maxButtons = 7) {
  if (totalPages <= 0) return [];
  if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = [1];
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 4) {
    start = 2;
    end = 5;
  } else if (currentPage >= totalPages - 3) {
    start = totalPages - 4;
    end = totalPages - 1;
  }

  if (start > 2) pages.push('ellipsis-before');
  for (let page = start; page <= end; page++) pages.push(page);
  if (end < totalPages - 1) pages.push('ellipsis-after');
  pages.push(totalPages);
  return pages;
}
