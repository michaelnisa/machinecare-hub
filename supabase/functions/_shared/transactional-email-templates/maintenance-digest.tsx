/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item { machine: string; name: string; due: string }
interface Props {
  recipientName?: string
  orgName?: string
  overdue?: Item[]
  dueSoon?: Item[]
  openWorkOrders?: number
}

const Email = ({ recipientName, orgName, overdue = [], dueSoon = [], openWorkOrders = 0 }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{`Maintenance digest: ${overdue.length} overdue, ${dueSoon.length} due soon`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>MachineCare</Text></Section>
        <Heading style={h1}>🗓️ Daily Maintenance Digest</Heading>
        <Text style={text}>Hi {recipientName ?? 'team'},</Text>
        <Text style={text}>Here's your maintenance summary for today:</Text>

        <Section style={stats}>
          <Text style={statRow}>
            <span style={statRed}>{overdue.length}</span> overdue &nbsp;·&nbsp;
            <span style={statAmber}>{dueSoon.length}</span> due soon &nbsp;·&nbsp;
            <span style={statBlue}>{openWorkOrders}</span> open WOs
          </Text>
        </Section>

        {overdue.length > 0 && (
          <>
            <Heading as="h2" style={h2}>⚠️ Overdue</Heading>
            {overdue.slice(0, 15).map((i, idx) => (
              <Text key={idx} style={listRow}>• {i.machine} — {i.name} <span style={dim}>(was due {i.due})</span></Text>
            ))}
          </>
        )}

        {dueSoon.length > 0 && (
          <>
            <Heading as="h2" style={h2}>🛠️ Due soon</Heading>
            {dueSoon.slice(0, 20).map((i, idx) => (
              <Text key={idx} style={listRow}>• {i.machine} — {i.name} <span style={dim}>({i.due})</span></Text>
            ))}
          </>
        )}

        {overdue.length === 0 && dueSoon.length === 0 && (
          <Text style={text}>✅ Nothing due in the next few days. Great job keeping things on schedule.</Text>
        )}

        <Hr style={hr} />
        <Text style={footer}>{orgName ?? 'Your organisation'} · sent by MachineCare</Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const brandBar = { paddingBottom: '8px' }
const brand = { color: '#2563eb', fontWeight: 700, fontSize: '18px', margin: 0 }
const h1 = { color: '#111827', fontSize: '22px', margin: '8px 0 16px' }
const h2 = { color: '#111827', fontSize: '16px', margin: '20px 0 8px' }
const text = { color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '8px 0' }
const stats = { background: '#f3f4f6', borderRadius: '8px', padding: '12px 16px', margin: '12px 0' }
const statRow = { fontSize: '14px', margin: 0, color: '#374151' }
const statRed = { color: '#b91c1c', fontWeight: 700, fontSize: '18px' }
const statAmber = { color: '#b45309', fontWeight: 700, fontSize: '18px' }
const statBlue = { color: '#2563eb', fontWeight: 700, fontSize: '18px' }
const listRow = { color: '#111827', fontSize: '13px', margin: '2px 0' }
const dim = { color: '#9ca3af' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { color: '#9ca3af', fontSize: '12px' }

export const template = {
  component: Email,
  subject: (d: Props) => `Maintenance digest — ${(d.overdue?.length ?? 0)} overdue, ${(d.dueSoon?.length ?? 0)} due soon`,
  displayName: 'Daily maintenance digest',
  previewData: {
    recipientName: 'Jane', orgName: 'Nairi Co.', openWorkOrders: 4,
    overdue: [{ machine: 'CAT 320 #3', name: '250hr small service', due: '2026-06-05' }],
    dueSoon: [{ machine: 'Toyota LC #1', name: 'Engine oil change', due: '2026-06-18' }],
  },
} satisfies TemplateEntry
