import { type AllergenCode, allergenCodes, allergenLabelsHu } from '@piccolo/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AllergenSelect } from '@/components/AllergenSelect';
import { strings } from '@/strings';

function Harness({
  initial,
  onChange,
}: {
  initial: AllergenCode[];
  onChange: (value: AllergenCode[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AllergenSelect
      id="dessert-allergens"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('AllergenSelect', () => {
  it("lists core's EU-14 allergens with their Hungarian labels and shows the chosen ones", () => {
    render(<Harness initial={['milk', 'gluten']} onChange={() => {}} />);

    const trigger = screen.getByRole('button', {
      name: `${strings.allergenSelect.label}: ${allergenLabelsHu.gluten}, ${allergenLabelsHu.milk}`,
    });
    fireEvent.click(trigger);

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((box) => box.getAttribute('aria-checked'))).toEqual(
      allergenCodes.map((code) => String(code === 'gluten' || code === 'milk')),
    );
    expect(screen.getByRole('checkbox', { name: allergenLabelsHu.molluscs })).toBeTruthy();
  });

  it('keeps the value in the order of the EU list', () => {
    const onChange = vi.fn();
    render(<Harness initial={['milk']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Allergének/ }));

    fireEvent.click(screen.getByRole('checkbox', { name: allergenLabelsHu.eggs }));
    expect(onChange).toHaveBeenLastCalledWith(['eggs', 'milk']);

    fireEvent.click(screen.getByRole('checkbox', { name: allergenLabelsHu.milk }));
    expect(onChange).toHaveBeenLastCalledWith(['eggs']);
  });

  it('says when there are none', () => {
    render(<Harness initial={[]} onChange={() => {}} />);
    expect(
      screen.getByRole('button', {
        name: `${strings.allergenSelect.label}: ${strings.allergenSelect.none}`,
      }),
    ).toBeTruthy();
  });
});
