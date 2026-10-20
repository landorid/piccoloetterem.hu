import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VariationsInput } from '@/components/VariationsInput';
import { strings } from '@/strings';

function Harness({
  initial,
  onChange,
}: {
  initial: string[];
  onChange: (value: string[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <VariationsInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function renderInput(initial: string[] = []) {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  return { onChange, input: screen.getByRole('textbox', { name: strings.variationsInput.label }) };
}

describe('VariationsInput', () => {
  it('adds the trimmed text as a chip on Enter', () => {
    const { onChange, input } = renderInput(['sertés']);

    fireEvent.change(input, { target: { value: '  csirke ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(['sertés', 'csirke']);
    expect(screen.getByText('csirke')).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('adds the typed text when the field is left', () => {
    const { onChange, input } = renderInput();

    fireEvent.change(input, { target: { value: 'nagy' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(['nagy']);
  });

  it('drops blank and repeated entries', () => {
    const { onChange, input } = renderInput(['sertés']);

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'sertés' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('removes a chip with its button, and the last one with Backspace', () => {
    const { onChange, input } = renderInput(['sertés', 'csirke', 'pulyka']);

    fireEvent.click(screen.getByRole('button', { name: strings.variationsInput.remove('csirke') }));
    expect(onChange).toHaveBeenLastCalledWith(['sertés', 'pulyka']);

    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith(['sertés']);
  });
});
