/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  orgName?: string
  machineName?: string
  scheduleName?: string
  dueDate?: string
  dueHours?: string
  daysAway?: number
}

const Email = ({ recipientName, orgName, machineName, scheduleName, dueDate, dueHours, daysAway }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{`Service due soon: ${scheduleName ?? 'maintenance'} for ${machineName ?? 'a machine'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>MachineCare</Text>
        </Section>
        <Heading style={h1}>🛠️ Service Due Soon</Heading>
        <Text style={text}>Hi {recipientName ?? 'team'},</Text>
        <Text style={text}>
          A scheduled service is coming up{daysAway !== undefined ? ` in ${daysAway} day${daysAway === 1 ? '' : 's'}` : ''}.
        </Text>
        <Section style={card}>
          <Row label="Machine" value={machineName ?? '—'} />
          <Row label="Service" value={scheduleName ?? '—'} />
          {dueDate && <Row label="Due date" value={dueDate} />}
          {dueHours && <Row label="Due at hours" value={dueHours} />}
        </Section>
        <Text style={text}>Please plan resources and parts ahead of time.</Text>
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
  subject: (d: Props) => `Service due soon: ${d.scheduleName ?? 'maintenance'} (${d.machineName ?? 'machine'})`,
  displayName: 'Service due soon',
  previewData: { recipientName: 'Jane', orgName: 'Nairi Co.', machineName: 'CAT 320 #3', scheduleName: '250hr small service', dueDate: '2026-06-18', daysAway: 8 },
} satisfies TemplateEntry
