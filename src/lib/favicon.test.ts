import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('favicon mark', () => {
  const svg = readFileSync(resolve(process.cwd(), 'public/favicon.svg'), 'utf8');

  it('is a pegboard mark with a marble', () => {
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain('#33261B');
    expect(svg).toContain('#C19A4A');
    expect(svg).toContain('#E8C56A');
  });
});
