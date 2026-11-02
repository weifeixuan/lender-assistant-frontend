import { describe, expect, it } from 'vitest';
import { truncateTitle } from './format';

describe('truncateTitle', () => {
  it('returns trimmed text when it is within the limit', () => {
    expect(truncateTitle('  首套贷款成数上限  ')).toBe('首套贷款成数上限');
  });

  it('keeps the first 20 characters when the text is longer', () => {
    const text = '一'.repeat(21);
    expect(truncateTitle(text)).toBe('一'.repeat(20));
  });

  it('counts an emoji as one code point instead of two UTF-16 units', () => {
    const text = '😀'.repeat(21);
    const title = truncateTitle(text);
    expect(Array.from(title)).toHaveLength(20);
    expect(title).toBe('😀'.repeat(20));
  });

  it('returns an empty string for blank input', () => {
    expect(truncateTitle('   ')).toBe('');
  });

  it('supports an explicit limit', () => {
    expect(truncateTitle('abcdef', 3)).toBe('abc');
  });
});
