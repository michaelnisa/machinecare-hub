/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  orgName?: string
  subjectLabel?: string
  docType?: string
  holderLabel?: string
  expiresOn?: string
  daysAway?: number
}

const Email = ({ recipientName, orgName, subjectLabel, docType, holderLabel, expiresOn, daysAway }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{`${subjectLabel ?? 'A document'} is expiring soon`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>MachineCare</Text>
        </Section>
        <Heading style={h1}>📄 Document Expiring Soon</Heading>
        <Text style={text}>Hi {recipientName ?? 'team'},</Text>
        <Text style={text}>
          {subjectLabel ?? 'A document'} is expiring{daysAway !== undefined ? ` in ${daysAway} day${daysAway === 1 ? '' : 's'}` : ''}.
        </Text>
        <Section style={card}>
          <Row label="Type" value={docType ?? '—'} />
          <Row label="For" value={holderLabel ?? '—'} />
          {expiresOn && <Row label="Expires on" value={expiresOn} />}
        </Section>
        <Text style={text}>Please renew it before it lapses.</Text>
        <Hr style={hr} />
        <Text style={footer}>{orgName ?? 'Your organisation'} · sent by MachineCare</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowStyle}><span style={rowLabel}>{label}: </span>{value}</Text>
)

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brandBar = { paddingBottom: '8px' }
const brand = { color: '#2563eb', fontWeight: 700, fontSize: '18px', margin: 0 }
const h1 = { color: '#111827', fontSize: '22px', margin: '8px 0 16px' }
const text = { color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '8px 0' }
const card = { background: '#f3f4f6', borderRadius: '8px', padding: '14px 16px', margin: '12px 0' }
const rowStyle = { color: '#111827', fontSize: '14px', margin: '4px 0' }
const rowLabel = { color: '#6b7280', fontWeight: 600 }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { color: '#9ca3af', fontSize: '12px' }

export const template = {
  component: Email,
  subject: (d: Props) => `Expiring soon: ${d.subjectLabel ?? 'document'}`,
  displayName: 'Document expiring',
  previewData: {
    recipientName: 'Jane',
    orgName: 'Nairi Co.',
    subjectLabel: 'Insurance for T 123 ABC',
    docType: 'Insurance',
    holderLabel: 'T 123 ABC',
    expiresOn: '2026-07-20',
    daysAway: 14,
  },
} satisfies TemplateEntry
