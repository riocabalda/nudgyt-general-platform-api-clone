export type SortOption =
  | 'newest'
  | 'oldest'
  | 'alphabetical'
  | 'most_attempts'
  | 'least_attempts';

export type SortQuery = {
  [key: string]: 1 | -1;
};

export function getSortQuery(
  sortBy?: SortOption,
  alphabeticalField: string = 'title'
): SortQuery {
  switch (sortBy) {
    case 'newest':
      return { created_at: -1 };
    case 'oldest':
      return { created_at: 1 };
    case 'alphabetical':
      return { [alphabeticalField]: 1 };
    case 'most_attempts':
      return { attempts_count: -1, created_at: -1 };
    case 'least_attempts':
      return { attempts_count: 1, created_at: -1 };
    default:
      return { created_at: -1 };
  }
}
