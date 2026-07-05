/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Row { label: string; value: string }

interface Props {
  recipientName?: string
  orgName?: string
  emoji?: string
  heading?: string
  message?: string
  rows?: Row[]
}

const Email = ({ recipientName, orgName, emoji, heading, message, rows }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{heading ?? 'Fleet alert'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>MachineCare</Text>
        </Section>
        <Heading style={h1}>{emoji ?? '🚛'} {heading ?? 'Fleet alert'}</Heading>
        <Text style={text}>Hi {recipientName ?? 'team'},</Text>
        {message && <Text style={text}>{message}</Text>}
        {rows && rows.length > 0 && (
          <Section style={card}>
            {rows.map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
          </Section>
        )}
        <Hr style={hr} />
        <Text style={footer}>{orgName ?? 'Your organisation'} · sent by MachineCare</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: Row) => (
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
  subject: (d: Props) => d.heading ?? 'Fleet alert',
  displayName: 'Fleet alert',
  previewData: {
    recipientName: 'Jane',
    orgName: 'Nairi Co.',
    emoji: '🛞',
    heading: 'Tyre replacement due: T 123 ABC',
    message: 'A tyre on this vehicle has passed its target replacement distance.',
    rows: [
      { label: 'Vehicle', value: 'Isuzu FRR Truck 1 (T 123 ABC)' },
      { label: 'Position', value: 'FL' },
      { label: 'Target replace', value: '40,000 km' },
      { label: 'Current odometer', value: '41,200 km' },
    ],
  },
} satisfies TemplateEntry
