import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollX } from '.';

const setWidths = (scrollWidth: number) => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
};

describe('ScrollX', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is a focusable, named region when its content overflows, so the keyboard can scroll it', () => {
    setWidths(900);
    render(<ScrollX><table /></ScrollX>);
    const region = screen.getByRole('region', { name: 'Scrollable table' });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('adds no tab stop when nothing overflows, or when the caller gives its own role', () => {
    setWidths(300);
    const { unmount } = render(<ScrollX><table /></ScrollX>);
    expect(screen.queryByRole('region')).toBeNull();
    unmount();

    setWidths(900);
    render(<ScrollX role="tablist" aria-label="Sections" />);
    expect(screen.getByRole('tablist')).not.toHaveAttribute('tabindex');
  });
});
