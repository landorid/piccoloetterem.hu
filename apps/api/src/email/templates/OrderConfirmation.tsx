import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  render,
  Section,
  Text,
  toPlainText,
} from '@react-email/components';
import type { CSSProperties } from 'react';
import { forint } from '../format';
import type { ConfirmationDayView, ConfirmationView, PriceLine } from '../view';

/*
 * The order confirmation, as e-mail clients need it: tables (React Email's Section, Row and Column)
 * instead of flex or grid, every style inline, hex colours, a system font stack, no images and no
 * web fonts, so Gmail and Outlook show the same layout. Everything it prints is decided by
 * `confirmationEmail`; this only lays it out.
 */

const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const ink = '#1f2328';
const muted = '#59636e';
const rule = '#d1d9e0';

const styles = {
  body: { backgroundColor: '#f6f8fa', fontFamily: font, color: ink, margin: 0, padding: '24px 0' },
  container: {
    backgroundColor: '#ffffff',
    border: `1px solid ${rule}`,
    borderRadius: '8px',
    maxWidth: '600px',
    padding: '24px',
  },
  greeting: { fontSize: '18px', fontWeight: 600, lineHeight: '26px', margin: '0 0 8px' },
  paragraph: { fontSize: '15px', lineHeight: '22px', margin: '0 0 16px' },
  day: { fontSize: '17px', fontWeight: 600, lineHeight: '24px', margin: '24px 0 4px' },
  fulfilment: { color: muted, fontSize: '14px', lineHeight: '20px', margin: '0 0 12px' },
  group: { fontSize: '15px', fontWeight: 600, lineHeight: '22px', margin: '12px 0 2px' },
  label: { fontSize: '14px', lineHeight: '22px', paddingRight: '12px' },
  amount: { fontSize: '14px', lineHeight: '22px', whiteSpace: 'nowrap', width: '110px' },
  strong: { fontWeight: 600 },
  hr: { borderColor: rule, margin: '12px 0' },
  grandTotal: { fontSize: '17px', fontWeight: 700, lineHeight: '26px' },
  noteLabel: { fontSize: '14px', fontWeight: 600, lineHeight: '20px', margin: '16px 0 2px' },
  contactLine: { fontSize: '14px', lineHeight: '20px', margin: 0 },
  link: { color: '#0969da' },
  replyNote: { color: muted, fontSize: '13px', lineHeight: '18px', margin: '16px 0 0' },
} satisfies Record<string, CSSProperties>;

/** Marks a price line's table, so the plain-text part prints it as one `label  amount` line. */
const priceLineClass = 'price-line';

function Line({ line, emphasis }: { line: PriceLine; emphasis?: CSSProperties }) {
  return (
    <Row className={priceLineClass}>
      <Column style={{ ...styles.label, ...emphasis }}>{line.label}</Column>
      <Column align="right" style={{ ...styles.amount, ...emphasis }}>
        {forint(line.amount)}
      </Column>
    </Row>
  );
}

function Day({ day }: { day: ConfirmationDayView }) {
  const lastTotal = day.totals.length - 1;
  return (
    <Section>
      <Heading as="h2" style={styles.day}>
        {day.date}
      </Heading>
      <Text style={styles.fulfilment}>
        {day.fulfilment.value === null
          ? day.fulfilment.label
          : `${day.fulfilment.label}: ${day.fulfilment.value}`}
      </Text>
      {day.menus.map((menu) => (
        <Section key={menu.title}>
          <Text style={styles.group}>{menu.title}</Text>
          {menu.lines.map((line) => (
            <Line key={line.label} line={line} />
          ))}
          <Line line={menu.total} emphasis={styles.strong} />
        </Section>
      ))}
      {day.extras && (
        <Section>
          <Text style={styles.group}>{day.extras.title}</Text>
          {day.extras.lines.map((line) => (
            <Line key={line.label} line={line} />
          ))}
        </Section>
      )}
      <Hr style={styles.hr} />
      {day.totals.map((line, index) => (
        <Line
          key={line.label}
          line={line}
          emphasis={index === lastTotal ? styles.strong : undefined}
        />
      ))}
    </Section>
  );
}

export function OrderConfirmation({ view }: { view: ConfirmationView }) {
  const { contact } = view;
  return (
    <Html lang="hu">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Preview>{view.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.greeting}>{view.greeting}</Text>
          <Text style={styles.paragraph}>{view.intro}</Text>
          {view.days.map((day) => (
            <Day key={day.date} day={day} />
          ))}
          {view.note && (
            <Section>
              <Text style={styles.noteLabel}>{view.note.label}</Text>
              <Text style={styles.contactLine}>{view.note.text}</Text>
            </Section>
          )}
          <Hr style={styles.hr} />
          <Line line={view.grandTotal} emphasis={styles.grandTotal} />
          <Hr style={styles.hr} />
          <Section>
            <Text style={styles.noteLabel}>{contact.title}</Text>
            <Text style={styles.contactLine}>{contact.name}</Text>
            <Text style={styles.contactLine}>{contact.address}</Text>
            <Text style={styles.contactLine}>
              <Link href={contact.phone.href} style={styles.link}>
                {contact.phone.text}
              </Link>
              {' · '}
              <Link href={contact.email.href} style={styles.link}>
                {contact.email.text}
              </Link>
            </Text>
            <Text style={styles.contactLine}>{contact.openingHours}</Text>
          </Section>
          <Text style={styles.replyNote}>{view.replyNote}</Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * How the plain-text part reads the HTML: a price line's cells side by side, two spaces apart (by
 * default a table's cells run together), the day headings as written rather than upper-cased, and
 * links as their text alone.
 */
const plainText = {
  selectors: [
    {
      selector: `table.${priceLineClass}`,
      format: 'dataTable',
      options: { colSpacing: 2, leadingLineBreaks: 1, trailingLineBreaks: 1 },
    },
    { selector: 'h2', options: { uppercase: false } },
    { selector: 'a', options: { ignoreHref: true } },
  ],
};

/** The e-mail's HTML, and its plain-text part derived from that HTML. */
export async function renderOrderConfirmation(
  view: ConfirmationView,
): Promise<{ html: string; text: string }> {
  const html = await render(<OrderConfirmation view={view} />);
  return { html, text: toPlainText(html, plainText) };
}
