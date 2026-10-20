import { loadConfig } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { fixtureSubmission } from '../fixture';
import { forint } from '../format';
import { confirmationEmail } from '../view';
import { renderOrderConfirmation } from './OrderConfirmation';

const { view } = confirmationEmail(fixtureSubmission, loadConfig({ RESTAURANT: 'piccolo' }));
const { html, text } = await renderOrderConfirmation(view);

/** Every price line of the e-mail, in the order it prints them. */
const priceLines = [
  ...view.days.flatMap((day) => [
    ...day.menus.flatMap((menu) => [...menu.lines, menu.total]),
    ...(day.extras?.lines ?? []),
    ...day.totals,
  ]),
  view.grandTotal,
];

describe('renderOrderConfirmation', () => {
  it('renders a Hungarian HTML e-mail with every day, menu and price line', () => {
    expect(html).toMatch(/^<!DOCTYPE html/);
    expect(html).toMatch(/<html[^>]* lang="hu"/);
    for (const day of view.days) {
      expect(html).toContain(day.date);
      for (const menu of day.menus) {
        expect(html).toContain(menu.title);
      }
    }
    for (const line of priceLines) {
      expect(html).toContain(line.label);
      expect(html).toContain(forint(line.amount));
    }
    expect(html).toContain('href="tel:+36304901122"');
    expect(html).toContain('href="mailto:info@piccoloetterem.hu"');
  });

  it('stays inside what Gmail and Outlook render: tables and inline styles only', () => {
    expect(html).not.toMatch(/<img|<style|<link|display:\s*(flex|grid)|var\(--/);
  });

  it('prints every price line as one "label  amount" line of the plain text', () => {
    const lines = text.split('\n');
    for (const line of priceLines) {
      expect(lines).toContain(`${line.label}  ${forint(line.amount)}`);
    }
    expect(text).toContain('2026. október 13., kedd');
    expect(text).toContain(view.replyNote);
    expect(text).not.toContain('tel:+36');
  });
});
