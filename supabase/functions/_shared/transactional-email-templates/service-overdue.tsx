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
  daysOverdue?: number
}

const Email = ({ recipientName, orgName, machineName, scheduleName, dueDate, daysOverdue }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{`Overdue: ${scheduleName ?? 'service'} on ${machineName ?? 'machine'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>MachineCare</Text></Section>
        <Heading style={h1}>⚠️ Service Overdue</Heading>
        <Text style={text}>Hi {recipientName ?? 'team'},</Text>
        <Text style={text}>
          The following service is <strong style={alert}>overdue{daysOverdue ? ` by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}` : ''}</strong>. Please take action immediately.
        </Text>
        <Section style={card}>
          <Text style={row}><span style={lbl}>Machine: </span>{machineName ?? '—'}</Text>
          <Text style={row}><span style={lbl}>Service: </span>{scheduleName ?? '—'}</Text>
          {dueDate && <Text style={row}><span style={lbl}>Was due: </span>{dueDate}</Text>}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>{orgName ?? 'Your organisation'} · sent by MachineCare</Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brandBar = { paddingBottom: '8px' }
const brand = { color: '#2563eb', fontWeight: 700, fontSize: '18px', margin: 0 }
const h1 = { color: '#b91c1c', fontSize: '22px', margin: '8px 0 16px' }
const text = { color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '8px 0' }
const alert = { color: '#b91c1c' }
const card = { background: '#fef2f2', borderRadius: '8px', padding: '14px 16px', margin: '12px 0', border: '1px solid #fecaca' }
const row = { color: '#111827', fontSize: '14px', margin: '4px 0' }
const lbl = { color: '#6b7280', fontWeight: 600 }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { color: '#9ca3af', fontSize: '12px' }

export const template = {
  component: Email,
  subject: (d: Props) => `⚠️ Overdue: ${d.scheduleName ?? 'service'} on ${d.machineName ?? 'machine'}`,
  displayName: 'Service overdue',
  previewData: { recipientName: 'Jane', orgName: 'Nairi Co.', machineName: 'CAT 320 #3', scheduleName: '250hr small service', dueDate: '2026-06-05', daysOverdue: 5 },
} satisfies TemplateEntry
