/**
 * Masonry for the landing grid (landing.css): rows are `--lp-unit` tall, and each block spans as
 * many as its height plus the gap below it needs, so each column packs tight whatever the
 * week's menu makes the cards' heights. Without this script the grid keeps plain rows.
 */

export function rowSpan(height: number, gap: number, unit: number): number {
  return Math.max(1, Math.ceil((height + gap) / unit));
}

/** The grid's blocks; the menu island's are inside `astro-island`, which is `display: contents`. */
const blocks = (grid: HTMLElement) =>
  grid.querySelectorAll<HTMLElement>(':scope > [data-area], :scope > astro-island > [data-area]');

export function masonry(grid: HTMLElement): void {
  const length = (name: string) =>
    Number.parseFloat(getComputedStyle(grid).getPropertyValue(name)) || 0;

  const resize = new ResizeObserver((entries) => {
    const gap = length('--lp-gap');
    const unit = length('--lp-unit');
    if (unit <= 0) return;
    for (const { target, borderBoxSize } of entries) {
      const height = borderBoxSize[0]?.blockSize ?? target.getBoundingClientRect().height;
      (target as HTMLElement).style.gridRowEnd = `span ${rowSpan(height, gap, unit)}`;
    }
  });

  const observed = new WeakSet<HTMLElement>();
  const observeNew = () => {
    for (const block of blocks(grid)) {
      if (observed.has(block)) continue;
      observed.add(block);
      resize.observe(block);
    }
  };

  // The island adds its sections once the menu loads.
  new MutationObserver(observeNew).observe(grid, { childList: true, subtree: true });
  observeNew();
  grid.classList.add('is-masonry');
}
