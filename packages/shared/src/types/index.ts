/**
 * Types مشتركة (DTOs، Responses، Domain types).
 */

// كود صلاحية (نصي)
export type PermissionCode = string;

// ─── API Envelope ───────────────────────────────
export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string; // مثلاً INSUFFICIENT_PERMISSIONS, VALIDATION_ERROR
  errors?: Array<{ path: string[]; message: string }>;
  requestId?: string;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ─── Auth ────────────────────────────────────────
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  storeId: string;
  roles: Array<{ id: string; name: string; labelAr: string }>;
  permissions: PermissionCode[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  // refresh token يأتي عبر httpOnly cookie
}

export interface AuthTokenPayload {
  sub: string; // user id
  username: string;
  storeId: string;
  roleIds: string[];
  permissions: string[];
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  jti?: string;
}

// ─── Health ─────────────────────────────────────
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  service?: string;
  uptime?: number;
  uptimeSeconds?: number;
  timestamp: string;
  version?: string;
}

export interface ReadinessResponse {
  status: string;
  checks: {
    database: { status: 'ok' | 'down'; latencyMs: number | null };
  };
  timestamp: string;
}

// ─── Audit ──────────────────────────────────────
export interface AuditContext {
  userId: string;
  username: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}
