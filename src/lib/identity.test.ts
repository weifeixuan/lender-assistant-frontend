import { describe, expect, it } from 'vitest';
import { DEV_USER_ID } from './identity';

describe('DEV_USER_ID', () => {
  it('uses the development user id required by the backend contract', () => {
    expect(DEV_USER_ID).toBe('dev-user-001');
  });

  it('matches the allowed user id format', () => {
    expect(DEV_USER_ID).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});
