// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { forint } from '../format';
import { strings } from '../strings';
import { publicConfig } from '../test/fixtures';
import { Contact, DeliveryCard, Hours } from './Landing';

const text = strings.landing;

afterEach(cleanup);

/** The `dd` of the row labelled `label` in `region`. */
const value = (region: HTMLElement, label: string) =>
  within(region).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

describe('Landing', () => {
  it('lists the opening hours and the intake window from the config', () => {
    render(<Hours config={publicConfig} />);
    const hours = screen.getByRole('region', { name: text.hours.title });
    expect(value(hours, text.hours.restaurant)).toBe(publicConfig.contact.openingHours);
    expect(value(hours, text.hours.intake)).toBe('7:30–9:30');
    expect(value(hours, text.hours.delivery)).toBe(text.hours.deliveryDays);
  });

  it('prices delivery from the config and links to the order page and the phone', () => {
    render(<DeliveryCard config={publicConfig} orderHref="/megrendeles" />);
    const card = screen.getByRole('region', { name: text.delivery.title });
    expect(value(card, text.delivery.fee)).toBe(text.delivery.feeValue(forint(150)));
    expect(value(card, text.delivery.minimum)).toBe(text.delivery.minimumValue(forint(2200)));
    expect(within(card).getByRole('link', { name: text.delivery.order }).getAttribute('href')).toBe(
      '/megrendeles',
    );
    expect(
      within(card).getByRole('link', { name: publicConfig.contact.phone }).getAttribute('href'),
    ).toBe('tel:+36304901122');
  });

  it('gives the address with a directions link that searches for it', () => {
    render(<Contact config={publicConfig} />);
    const contact = screen.getByRole('region', { name: text.contact.title });
    expect(value(contact, text.contact.address)).toBe(publicConfig.contact.address);
    const directions = within(contact).getByRole('link', { name: text.contact.directions });
    expect(new URL(directions.getAttribute('href') ?? '').searchParams.get('query')).toBe(
      publicConfig.contact.address,
    );
  });
});
