# MachineCare Hub

A full-featured fleet and machinery maintenance management platform built with React, TypeScript, and Supabase.

## Features

- **Machines** — fleet registry with QR codes, cover images, service schedules and history
- **Work Orders** — full job lifecycle (open → assigned → in progress → done → closed)
- **Inventory** — parts stock with auto-deduct on service
- **Fuel Logs** — consumption and odometer tracking per machine
- **Documents** — file attachments with expiry reminders
- **OEE** — Overall Equipment Effectiveness tracking
- **Safety** — incident reporting and tracking
- **Induction** — training programmes, quizzes and digital certificates
- **Notifications** — unified inbox for floor issues and service alerts
- **Live TV** — fullscreen real-time KPI dashboard
- **Analytics** — cost, service frequency and fleet trends
- **Team** — role-based access (owner / manager / engineer / technician / viewer)
- **Simple mode** — lite sidebar for small fleets (≤10 machines)

## Tech stack

- React 18 + TypeScript + Vite
- Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- Tailwind CSS + shadcn/ui
- Recharts, React Hook Form, Zod, TanStack Query

## Running locally

1. Copy `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```
2. Install dependencies and start:
   ```bash
   npm install
   npm run dev
   ```
3. Apply DB migrations (first time only):
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

App runs at **http://localhost:8080**
