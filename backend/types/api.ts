// Common response envelope shapes used by routes.

export interface ErrorResponse {
  error: string;
}

export interface MessageResponse {
  message: string;
}

/** Standard list pagination metadata used by feed endpoints. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
