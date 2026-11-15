import test from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_PAGE_SIZE, paginateItems, visiblePageNumbers } from '../src/media-pagination.js';

test('headline pagination returns only the requested page and correct item range', () => {
  const items = Array.from({ length: 23 }, (_, index) => `headline-${index + 1}`);
  assert.equal(MEDIA_PAGE_SIZE, 10);
  assert.deepEqual(paginateItems(items, 1), {
    items: items.slice(0, 10), currentPage: 1, totalPages: 3, start: 1, end: 10, totalItems: 23
  });
  assert.deepEqual(paginateItems(items, 2).items, items.slice(10, 20));
  assert.deepEqual(paginateItems(items, 3), {
    items: items.slice(20), currentPage: 3, totalPages: 3, start: 21, end: 23, totalItems: 23
  });
});

test('pagination clamps invalid page requests and handles empty results', () => {
  const items = ['a', 'b', 'c'];
  assert.equal(paginateItems(items, 0, 2).currentPage, 1);
  assert.equal(paginateItems(items, 99, 2).currentPage, 2);
  assert.deepEqual(paginateItems([], 5), {
    items: [], currentPage: 1, totalPages: 0, start: 0, end: 0, totalItems: 0
  });
});

test('numbered controls remain compact for large archives', () => {
  assert.deepEqual(visiblePageNumbers(1, 30), [1, 2, 3, 4, 5, 'ellipsis-after', 30]);
  assert.deepEqual(visiblePageNumbers(15, 30), [1, 'ellipsis-before', 14, 15, 16, 'ellipsis-after', 30]);
  assert.deepEqual(visiblePageNumbers(30, 30), [1, 'ellipsis-before', 26, 27, 28, 29, 30]);
  assert.deepEqual(visiblePageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(visiblePageNumbers(1, 0), []);
});
