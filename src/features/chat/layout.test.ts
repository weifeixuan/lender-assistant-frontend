import { describe, expect, it } from 'vitest';
import { shouldAutoCollapse } from './layout';

describe('shouldAutoCollapse', () => {
  it('collapses the conversation side panels on narrow viewports', () => {
    expect(shouldAutoCollapse(420)).toBe(true);
    expect(shouldAutoCollapse(1023)).toBe(true);
  });

  it('keeps the panels open from 1024px upwards', () => {
    expect(shouldAutoCollapse(1024)).toBe(false);
    expect(shouldAutoCollapse(1440)).toBe(false);
  });
});
