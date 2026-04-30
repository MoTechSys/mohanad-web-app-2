/**
 * IdempotencyMiddleware — comprehensive Jest spec (P2-7).
 *
 * Coverage targets (≥85%):
 *   • safe verbs (GET/HEAD/OPTIONS) → no-op (next called, no DB hit)
 *   • missing/empty header → no-op
 *   • too-short / too-long key → silently ignored (no-op)
 *   • no existing record → request proceeds, response captured & saved
 *   • non-2xx response → NOT cached (e.g. 422 validation error)
 *   • existing + not expired + same user/endpoint → replay cached response
 *     with `Idempotent-Replay: true` header (next is NOT called)
 *   • existing + same key but different endpoint → 409 CONFLICT
 *   • existing + same key but different user → 409 CONFLICT
 *   • existing + expired → record deleted, request proceeds normally
 *   • DB lookup failure → swallowed (treated as miss, next called)
 *   • P2002 on insert (race) → swallowed silently
 *   • non-P2002 save error → logged but not surfaced to client
 *   • bearer token decoded → userId extracted from JWT `sub` claim
 *   • invalid bearer token → userId is null
 */

import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';

import { IdempotencyMiddleware } from '../idempotency.middleware';

// ─── Helpers ─────────────────────────────────────────────────────
const buildPrismaMock = () => ({
  idempotencyKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
});

interface MockRes {
  statusCode: number;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  // Internal: latest captured body (when middleware wraps res.json)
  _capturedBody?: unknown;
}

const buildRes = (initialStatus = 200): MockRes => {
  const res: MockRes = {
    statusCode: initialStatus,
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  // status(...) should set statusCode and return res chainable
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  // Default json passes through; tests may override
  res.json.mockImplementation((body: unknown) => {
    res._capturedBody = body;
    return res;
  });
  return res;
};

const buildReq = (
  overrides: {
    method?: string;
    headers?: Record<string, string>;
    originalUrl?: string;
    url?: string;
  } = {},
): Request => {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides.headers ?? {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    method: overrides.method ?? 'POST',
    originalUrl: overrides.originalUrl ?? '/api/v1/users',
    url: overrides.url ?? '/api/v1/users',
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
};

// ─── Suite ───────────────────────────────────────────────────────
describe('IdempotencyMiddleware', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwt: jest.Mocked<JwtService>;
  let config: jest.Mocked<ConfigService>;
  let middleware: IdempotencyMiddleware;

  const VALID_KEY = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    prisma = buildPrismaMock();
    jwt = { verify: jest.fn() } as unknown as jest.Mocked<JwtService>;
    config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as jest.Mocked<ConfigService>;
    middleware = new IdempotencyMiddleware(prisma as unknown as never, jwt, config);
  });

  // ─── Safe verbs / missing key ─────────────────────────────────
  it('skips middleware for safe verbs (GET)', async () => {
    const req = buildReq({ method: 'GET' });
    const res = buildRes();
    const next: NextFunction = jest.fn();
    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('skips middleware when Idempotency-Key header is absent', async () => {
    const req = buildReq({ headers: {} });
    const res = buildRes();
    const next: NextFunction = jest.fn();
    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('silently ignores too-short keys (< 8 chars)', async () => {
    const req = buildReq({ headers: { 'idempotency-key': 'short' } });
    const res = buildRes();
    const next: NextFunction = jest.fn();
    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('silently ignores too-long keys (> 128 chars)', async () => {
    const req = buildReq({ headers: { 'idempotency-key': 'x'.repeat(200) } });
    const res = buildRes();
    const next: NextFunction = jest.fn();
    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  // ─── First request (no existing record) ───────────────────────
  it('caches a successful 2xx response after the handler runs', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    prisma.idempotencyKey.create.mockResolvedValueOnce({ key: VALID_KEY });

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes(201);
    const next: NextFunction = jest.fn();

    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Simulate handler emitting JSON body
    (res.json as jest.Mock)({ id: 'user-1', username: 'alice' });

    // Allow the fire-and-forget create() promise to resolve
    await new Promise((r) => setImmediate(r));

    expect(prisma.idempotencyKey.create).toHaveBeenCalledTimes(1);
    const saved = prisma.idempotencyKey.create.mock.calls[0][0].data;
    expect(saved.key).toBe(VALID_KEY);
    expect(saved.endpoint).toBe('POST /api/v1/users');
    expect(saved.statusCode).toBe(201);
    expect(saved.response).toEqual({ id: 'user-1', username: 'alice' });
    expect(saved.expiresAt).toBeInstanceOf(Date);
  });

  it('does NOT cache non-2xx responses (e.g. 422 validation error)', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes(422);
    const next: NextFunction = jest.fn();

    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    (res.json as jest.Mock)({ error: { code: 'VALIDATION_ERROR' } });
    await new Promise((r) => setImmediate(r));

    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('strips query string from endpoint when storing', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    prisma.idempotencyKey.create.mockResolvedValueOnce({ key: VALID_KEY });

    const req = buildReq({
      headers: { 'idempotency-key': VALID_KEY },
      originalUrl: '/api/v1/users?page=1&limit=10',
    });
    const res = buildRes(201);
    await middleware.use(req as never, res as unknown as Response, jest.fn());
    (res.json as jest.Mock)({ ok: true });
    await new Promise((r) => setImmediate(r));

    expect(prisma.idempotencyKey.create.mock.calls[0][0].data.endpoint).toBe('POST /api/v1/users');
  });

  // ─── Replay (cache hit) ──────────────────────────────────────
  it('replays cached response when key exists, not expired, same user+endpoint', async () => {
    const cached = {
      key: VALID_KEY,
      userId: null,
      endpoint: 'POST /api/v1/users',
      statusCode: 201,
      response: { id: 'user-1' },
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(cached);

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes();
    const next: NextFunction = jest.fn();

    await middleware.use(req as never, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replay', 'true');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'user-1' });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  // ─── Conflict scenarios ──────────────────────────────────────
  it('throws CONFLICT when same key is reused on a DIFFERENT endpoint', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: VALID_KEY,
      userId: null,
      endpoint: 'POST /api/v1/roles',
      statusCode: 201,
      response: {},
      expiresAt: new Date(Date.now() + 60_000),
    });

    const req = buildReq({
      headers: { 'idempotency-key': VALID_KEY },
      originalUrl: '/api/v1/users',
    });
    const res = buildRes();
    const next: NextFunction = jest.fn();

    let caught: ConflictException | null = null;
    try {
      await middleware.use(req as never, res as unknown as Response, next);
    } catch (err) {
      caught = err as ConflictException;
    }
    expect(caught).toBeInstanceOf(ConflictException);
    const body = (caught as ConflictException).getResponse() as { code?: string };
    expect(body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    expect(next).not.toHaveBeenCalled();
  });

  it('throws CONFLICT when same key is reused by a DIFFERENT user', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce({
      key: VALID_KEY,
      userId: 'user-A',
      endpoint: 'POST /api/v1/users',
      statusCode: 201,
      response: {},
      expiresAt: new Date(Date.now() + 60_000),
    });

    // Simulate Bearer of user-B
    jwt.verify.mockReturnValueOnce({ sub: 'user-B' } as never);

    const req = buildReq({
      headers: {
        'idempotency-key': VALID_KEY,
        authorization: 'Bearer token-B',
      },
    });
    const res = buildRes();

    await expect(
      middleware.use(req as never, res as unknown as Response, jest.fn()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ─── Expiration ──────────────────────────────────────────────
  it('deletes expired key and proceeds as a fresh request', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce({
      key: VALID_KEY,
      userId: null,
      endpoint: 'POST /api/v1/users',
      statusCode: 201,
      response: {},
      expiresAt: new Date(Date.now() - 1_000), // expired
    });
    prisma.idempotencyKey.delete.mockResolvedValueOnce({ key: VALID_KEY });
    prisma.idempotencyKey.create.mockResolvedValueOnce({ key: VALID_KEY });

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes(201);
    const next: NextFunction = jest.fn();

    await middleware.use(req as never, res as unknown as Response, next);

    expect(prisma.idempotencyKey.delete).toHaveBeenCalledWith({
      where: { key: VALID_KEY },
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalledWith('Idempotent-Replay', 'true');
  });

  // ─── Error tolerance ────────────────────────────────────────
  it('treats DB lookup error as a cache miss and proceeds', async () => {
    prisma.idempotencyKey.findUnique.mockRejectedValueOnce(new Error('DB down'));

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes(201);
    const next: NextFunction = jest.fn();

    await middleware.use(req as never, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('swallows P2002 (race-condition) errors on insert', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    prisma.idempotencyKey.create.mockRejectedValueOnce({ code: 'P2002' });

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes(201);
    await middleware.use(req as never, res as unknown as Response, jest.fn());

    // Trigger save
    (res.json as jest.Mock)({ ok: true });
    await new Promise((r) => setImmediate(r));

    // No assertion failure means the rejection was swallowed
    expect(prisma.idempotencyKey.create).toHaveBeenCalled();
  });

  it('logs (but does not throw) on non-P2002 save errors', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    prisma.idempotencyKey.create.mockRejectedValueOnce({
      code: 'P9999',
      message: 'unexpected',
    });

    const req = buildReq({ headers: { 'idempotency-key': VALID_KEY } });
    const res = buildRes(201);
    await middleware.use(req as never, res as unknown as Response, jest.fn());

    (res.json as jest.Mock)({ ok: true });
    await new Promise((r) => setImmediate(r));

    expect(prisma.idempotencyKey.create).toHaveBeenCalled();
    // No exception leaked
  });

  // ─── JWT extraction ─────────────────────────────────────────
  it('extracts userId from valid Bearer token and scopes the cache to it', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    prisma.idempotencyKey.create.mockResolvedValueOnce({ key: VALID_KEY });
    jwt.verify.mockReturnValueOnce({ sub: 'user-42' } as never);

    const req = buildReq({
      headers: {
        'idempotency-key': VALID_KEY,
        authorization: 'Bearer my-token',
      },
    });
    const res = buildRes(201);
    await middleware.use(req as never, res as unknown as Response, jest.fn());

    (res.json as jest.Mock)({ ok: true });
    await new Promise((r) => setImmediate(r));

    expect(prisma.idempotencyKey.create.mock.calls[0][0].data.userId).toBe('user-42');
  });

  it('falls back to anonymous (null userId) when Bearer token is invalid', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    prisma.idempotencyKey.create.mockResolvedValueOnce({ key: VALID_KEY });
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('jwt malformed');
    });

    const req = buildReq({
      headers: {
        'idempotency-key': VALID_KEY,
        authorization: 'Bearer garbage',
      },
    });
    const res = buildRes(201);
    await middleware.use(req as never, res as unknown as Response, jest.fn());

    (res.json as jest.Mock)({ ok: true });
    await new Promise((r) => setImmediate(r));

    expect(prisma.idempotencyKey.create.mock.calls[0][0].data.userId).toBeNull();
  });
});
