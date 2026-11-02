/**
 * Standard Error Codes per Specification (AGENTS.md §5)
 */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type StandardErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Detailed validation or domain error
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  rule?: string;
}

/**
 * Consistent Error Envelope per AGENTS.md §5:
 * { "error": { "code": "STRING_CODE", "message": "...", "details": [...], "requestId": "..." } }
 */
export interface ApiErrorEnvelope {
  error: {
    code: StandardErrorCode | string;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
  };
}

/**
 * Successful response envelope
 */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Standard Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated API list response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Standard Query Parameters for list endpoints
 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}
