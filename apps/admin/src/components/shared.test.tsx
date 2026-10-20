import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DatePicker } from '@/components/DatePicker';
import { strings } from '@/strings';

describe('ConfirmDialog', () => {
  function renderDialog(onConfirm: () => unknown) {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel the order?"
        destructive
        onConfirm={onConfirm}
      />,
    );
    return {
      onOpenChange,
      confirm: () => screen.getByRole('button', { name: strings.confirm.confirm }),
    };
  }

  it('stays open while onConfirm runs and closes once it resolves', async () => {
    let resolve = () => {};
    const { onOpenChange, confirm } = renderDialog(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );

    fireEvent.click(confirm());
    expect(confirm().hasAttribute('disabled')).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => resolve());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open, buttons enabled again, when onConfirm rejects', async () => {
    const { onOpenChange, confirm } = renderDialog(() => Promise.reject(new Error('failed')));

    await act(async () => {
      fireEvent.click(confirm());
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(confirm().hasAttribute('disabled')).toBe(false);
  });

  it('closes on Cancel', () => {
    const { onOpenChange } = renderDialog(() => {});

    fireEvent.click(screen.getByRole('button', { name: strings.confirm.cancel }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('DatePicker', () => {
  function Harness({ initial }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <DatePicker value={value} onChange={setValue} />
        <output>{value}</output>
      </>
    );
  }

  it('shows the value as a Hungarian date and picks another day from a Monday-first calendar', async () => {
    render(<Harness initial="2026-10-08" />);

    fireEvent.click(screen.getByRole('button', { name: /2026\. október 8\., csütörtök/ }));
    const grid = await screen.findByRole('grid');
    const weekdays = [...grid.querySelectorAll('thead th')].map((th) =>
      th.getAttribute('aria-label'),
    );
    expect(weekdays[0]).toBe('hétfő');
    expect(weekdays[6]).toBe('vasárnap');

    fireEvent.click(within(grid).getByRole('button', { name: /október 12\., hétfő/ }));
    expect(screen.getByRole('status').textContent).toBe('2026-10-12');
    expect(screen.getByRole('button', { name: /2026\. október 12\., hétfő/ })).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('shows the placeholder without a value', () => {
    render(<Harness />);

    expect(screen.getByRole('button', { name: strings.datePicker.placeholder })).toBeTruthy();
  });
});
