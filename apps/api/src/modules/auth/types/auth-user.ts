/**
 * Shape of `request.user` after JwtAuthGuard runs.
 * Populated by JwtStrategy.validate().
 */
export interface AuthUser {
  /** User cuid. */
  id: string;
  username: string;
  fullName: string;
  /** Tenant scoping. */
  storeId: string;
  /** Effective permission codes (deduped union over user's roles). */
  permissions: string[];
  /** Role keys (e.g., 'Owner', 'Manager', …). */
  roles: string[];
  /** Issued-at unix seconds (from access token). */
  iat?: number;
  /** Expires-at unix seconds (from access token). */
  exp?: number;
}
