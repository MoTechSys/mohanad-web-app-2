import type { AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

import { type ApiEnvelope, extractApiError, unwrap } from '../api';

function makeRes<T>(payload: T): AxiosResponse<ApiEnvelope<T>> {
  return {
    data: { data: payload, meta: { requestId: 'req-1' } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  };
}

describe('lib/api · unwrap()', () => {
  it('extracts the `data` payload from the standard envelope', () => {
    const res = makeRes({ id: 'u1', name: 'علي' });
    expect(unwrap(res)).toEqual({ id: 'u1', name: 'علي' });
  });

  it('preserves arrays as-is', () => {
    const res = makeRes([1, 2, 3]);
    expect(unwrap(res)).toEqual([1, 2, 3]);
  });
});

describe('lib/api · extractApiError()', () => {
  it('reads the standard NestJS envelope at meta.error', () => {
    const err = {
      response: {
        data: {
          data: null,
          meta: {
            error: {
              statusCode: 403,
              code: 'PERMISSION_DENIED',
              message: 'ليس لديك صلاحية',
            },
          },
        },
      },
    };
    const out = extractApiError(err);
    expect(out.statusCode).toBe(403);
    expect(out.code).toBe('PERMISSION_DENIED');
    expect(out.message).toBe('ليس لديك صلاحية');
  });

  it('falls back to the legacy { statusCode, message } shape', () => {
    const err = {
      response: { data: { statusCode: 401, message: 'Unauthorized' } },
    };
    const out = extractApiError(err);
    expect(out.statusCode).toBe(401);
    expect(out.message).toBe('Unauthorized');
  });

  it('returns the bare axios error message when no payload is present', () => {
    const out = extractApiError({ message: 'Network Error' });
    expect(out.message).toBe('Network Error');
  });

  it('falls back to a generic Arabic message when nothing is available', () => {
    const out = extractApiError({});
    expect(out.message).toBe('حدث خطأ غير متوقع');
  });

  it('does not throw on null / undefined inputs', () => {
    expect(() => extractApiError(null)).not.toThrow();
    expect(() => extractApiError(undefined)).not.toThrow();
  });
});
