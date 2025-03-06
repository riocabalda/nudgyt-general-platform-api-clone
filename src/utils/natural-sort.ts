const DEFAULT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  ignorePunctuation: true
});

/**
 * Sorts e.g.
 *
 * `2, 3, 4, 6, 1a, 1b, 5a, Notes, 5b, 7, 13b, 13c, 13a, 10, 11, 12` to
 *
 * `1a, 1b, 2, 3, 4, 5a, 5b, 6, 7, 10, 11, 12, 13a, 13b, 13c, Notes`
 *
 * - https://blog.codinghorror.com/sorting-for-humans-natural-sort-order/
 * - https://fuzzytolerance.info/blog/2019/07/19/The-better-way-to-do-natural-sort-in-JavaScript/
 * - https://stackoverflow.com/a/64038833
 * - https://stackoverflow.com/a/52369951
 */
function naturalSort(
  a: string,
  b: string,
  collator = DEFAULT_COLLATOR
) {
  return collator.compare(a, b);
}

export default naturalSort;
