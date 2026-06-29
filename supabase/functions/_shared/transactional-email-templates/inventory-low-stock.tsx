/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface LowItem {
  name: string
  partNumber?: string | null
  quantity: number
  unit: string
  reorderLevel: number
  orderStatus?: string | null
}

interface Props {
  recipientName?: string
  orgName?: string
  items?: LowItem[]
}

const Email = ({ recipientName, orgName, items = [] }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{`${items.length} part${items.length === 1 ? '' : 's'} at or below reorder level`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>MachineCare</Text>
        </Section>
        <Heading style={h1}>📦 Low stock alert</Heading>
        <Text style={text}>Hi {recipientName ?? 'team'},</Text>
        <Text style={text}>
          The following part{items.length === 1 ? ' is' : 's are'} at or below the reorder level and may need to be ordered.
        </Text>
        <Section style={card}>
          {items.map((it, i) => (
            <Text key={i} style={rowStyle}>
              <span style={rowLabel}>{it.name}</span>
              {it.partNumber ? ` [${it.partNumber}]` : ''} — {it.quantity} {it.unit} in stock (reorder at {it.reorderLevel})
              {it.orderStatus && it.orderStatus !== 'none' ? ` · status: ${it.orderStatus.replace('_', ' ')}` : ''}
            </Text>
          ))}
        </Section>
        <Text style={text}>Open Inventory in MachineCare to mark items as requested, ordered or received.</Text>
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
const card = { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', margin: '12px 0' }
const rowStyle = { color: '#111827', fontSize: '14px', margin: '4px 0' }
const rowLabel = { color: '#92400e', fontWeight: 700 }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { color: '#9ca3af', fontSize: '12px' }

export const template = {
  component: Email,
  subject: (d: Props) => `Low stock: ${d.items?.length ?? 0} part${(d.items?.length ?? 0) === 1 ? '' : 's'} need attention`,
  displayName: 'Inventory low stock',
  previewData: {
    recipientName: 'Jane',
    orgName: 'Nairi Co.',
    items: [
      { name: 'Engine oil 15W-40', partNumber: 'CAT-DEO-15W40', quantity: 4, unit: 'litres', reorderLevel: 20, orderStatus: 'requested' },
      { name: 'Oil filter', partNumber: '90915-YZZD2', quantity: 0, unit: 'pcs', reorderLevel: 2, orderStatus: 'none' },
    ],
  },
} satisfies TemplateEntry
