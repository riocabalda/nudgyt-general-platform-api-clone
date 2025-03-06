export const getPaginationData = (paginate: { data: any[], metadata: { total: number }}, page: number, pageSize: number) => {
  // Calculate pagination details
  const total = paginate?.metadata ? paginate?.metadata.total : 0;
  const totalPages = Math.ceil(total / pageSize);
  const currentPage = page;
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Format the response
  const formattedResult = {
    data: paginate?.data,
    total: total,
    limit: pageSize,
    total_pages: totalPages,
    current_page: currentPage,
    paging_counter: currentPage,
    has_prev_page: hasPrevPage,
    has_next_page: hasNextPage,
    prev_page: hasPrevPage ? currentPage - 1 : null,
    next_page: hasNextPage ? currentPage + 1 : null,
    from: (currentPage - 1) * pageSize + 1,
    to: Math.min(currentPage * pageSize, total)
  };

  return formattedResult
};
