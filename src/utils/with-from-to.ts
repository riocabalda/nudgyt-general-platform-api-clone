// This will add from and to properties in mongoose paginate v2 result object
export function withFromAndTo(paginatedResult: any) {
  const { paging_counter, limit, current_page, total } =
    paginatedResult;
  const to = Math.min(limit * current_page, total);
  const from = to !== 0 ? paging_counter : 0;
  return { ...paginatedResult, from, to };
}
