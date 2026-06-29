/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  orgName?: string
  woNumber?: string
  title?: string
  machineName?: string
  priority?: string
  dueDate?: string
  workOrderUrl?: string
}

const Email = ({ recipientName, orgName, woNumber, title, machineName, priority, dueDate, workOrderUrl }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{`Work order ${woNumber ?? ''} assigned to you`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>MachineCare</Text></Section>
        <Heading style={h1}>📋 Work Order Assigned</Heading>
        <Text style={text}>Hi {recipientName ?? 'there'},</Text>
        <Text style={text}>A new work order has been assigned to you.</Text>
        <Section style={card}>
          <Text style={row}><span style={lbl}>WO #: </span>{woNumber ?? '—'}</Text>
          <Text style={row}><span style={lbl}>Title: </span>{title ?? '—'}</Text>
          <Text style={row}><span style={lbl}>Machine: </span>{machineName ?? '—'}</Text>
          {priority && <Text style={row}><span style={lbl}>Priority: </span>{priority}</Text>}
          {dueDate && <Text style={row}><span style={lbl}>Due: </span>{dueDate}</Text>}
        </Section>
        {workOrderUrl && (
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={workOrderUrl} style={btn}>Open work order</Button>
          </Section>
        )}
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
const h1 = { color: '#111827', fontSize: '22px', margin: '8px 0 16px' }
const text = { color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '8px 0' }
const card = { background: '#eff6ff', borderRadius: '8px', padding: '14px 16px', margin: '12px 0' }
const row = { color: '#111827', fontSize: '14px', margin: '4px 0' }
const lbl = { color: '#6b7280', fontWeight: 600 }
const btn = { background: '#2563eb', color: '#ffffff', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { color: '#9ca3af', fontSize: '12px' }

export const template = {
  component: Email,
  subject: (d: Props) => `Work order ${d.woNumber ?? ''} assigned: ${d.title ?? ''}`,
  displayName: 'Work order assigned',
  previewData: { recipientName: 'Jane', orgName: 'Nairi Co.', woNumber: 'WO-2026-0042', title: 'Replace hydraulic filter', machineName: 'CAT 320 #3', priority: 'high', dueDate: '2026-06-12' },
} satisfies TemplateEntry
