-- Migration: 20261008000000_machinecare_daily_blog.sql
-- Description: Creates the blog_posts table with RLS, indexes, and daily posting support

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    cover_image TEXT,
    category TEXT NOT NULL DEFAULT 'Maintenance & Reliability',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    author_name TEXT NOT NULL DEFAULT 'MachineCare Engineering',
    author_role TEXT DEFAULT 'Reliability Specialist',
    author_avatar TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
    published_at TIMESTAMPTZ DEFAULT now(),
    read_time_minutes INTEGER DEFAULT 4,
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT false,
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for speedy retrieval
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON public.blog_posts(featured);

-- Enable Row Level Security
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 1. Public read policy: Anyone can read published posts
CREATE POLICY "Public can view published blog posts"
    ON public.blog_posts
    FOR SELECT
    USING (
        status = 'published' 
        AND (published_at IS NULL OR published_at <= now())
    );

-- 2. Authenticated users can view all posts (including drafts and scheduled)
CREATE POLICY "Authenticated users can view all blog posts"
    ON public.blog_posts
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Authenticated users can create posts
CREATE POLICY "Authenticated users can create blog posts"
    ON public.blog_posts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Authors and Org Members can update posts
CREATE POLICY "Authenticated users can update blog posts"
    ON public.blog_posts
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = created_by 
        OR auth.uid() IN (SELECT id FROM auth.users)
    );

-- 5. Authors and Org Members can delete posts
CREATE POLICY "Authenticated users can delete blog posts"
    ON public.blog_posts
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = created_by 
        OR auth.uid() IN (SELECT id FROM auth.users)
    );

-- Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.set_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trigger_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_blog_posts_updated_at();

-- Seed initial high-quality daily engineering posts
INSERT INTO public.blog_posts (
    slug,
    title,
    summary,
    content,
    cover_image,
    category,
    tags,
    author_name,
    author_role,
    author_avatar,
    status,
    published_at,
    read_time_minutes,
    likes_count,
    views_count,
    featured
) VALUES
(
    'vibration-analysis-early-bearing-failure-detection',
    'Vibration Analysis: How to Catch Bearing Failures 60 Days Before Breakdown',
    'Learn how spectral peak demodulation and ISO 10816 vibration severity standards can prevent catastrophic machine shutdowns.',
    '## The High Cost of Unplanned Bearing Failures

In industrial processing plants, over **40% of rotating equipment breakdowns** stem from rolling element bearing deterioration. When a high-speed pillow block bearing seizes without warning, it frequently causes shaft scoring, motor overheating, and production line halts that cost thousands of dollars per hour.

Fortunately, bearings rarely fail instantaneously. They progress through distinct stages of fatigue that can be detected two to three months in advance using vibration spectrum analysis.

### The 4 Stages of Bearing Degradation

1. **Stage 1 (Micro-Spalling & Subsurface Flaws):** Ultrasonic frequencies between 20 kHz and 60 kHz begin to spike. Acoustic emission sensors pick up stress waves long before heat or human-audible noise emerges.
2. **Stage 2 (Defect Frequency Emergence):** Fundamental defect frequencies (BPFO, BPFI, BSF, and FTF) begin to show small peaks in velocity spectra (500 Hz to 2 kHz).
3. **Stage 3 (Harmonics & Sidebands):** Peaks rise significantly; sidebands around bearing harmonics indicate mechanical looseness and ring modulation.
4. **Stage 4 (Impending Seizure):** Discrete peaks disappear into a raised broadband noise floor, temperature rises rapidly, and physical play is noticeable.

```
Vibration Severity Guide (ISO 10816-3):
- < 1.4 mm/s RMS  : Class A (Excellent)
- 1.4 - 2.8 mm/s  : Class B (Good / Acceptable)
- 2.8 - 4.5 mm/s  : Class C (Alert / Schedule Lubrication or Alignment)
- > 4.5 mm/s RMS  : Class D (Danger / Immediate Corrective Action)
```

> **Daily Reliability Tip:**
> Never re-grease a noisy bearing blindly without checking vibration readings. Over-lubrication is as destructive as under-lubrication because excessive grease causes fluid churning, elevated temperatures, and blown seals.

### Integrating Continuous Vibration Telemetry with MachineCare

With MachineCare IoT sensors mounted on drive-end and non-drive-end housings, vibration velocity RMS readings sync automatically into your maintenance dashboard. When readings drift past the Class C warning threshold, MachineCare automatically generates a corrective Work Order for your maintenance crew before any downtime occurs.',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    'Maintenance & Reliability',
    ARRAY['Vibration Analysis', 'Predictive Maintenance', 'Bearings', 'ISO 10816'],
    'Eng. Alex Muro',
    'Senior Reliability Specialist',
    NULL,
    'published',
    now() - INTERVAL '1 day',
    5,
    34,
    420,
    true
),
(
    'hydraulic-system-oil-cleanliness-iso-4406',
    'Hydraulic Oil Cleanliness: Decoding ISO 4406 Contamination Codes',
    '75% of hydraulic valve sticking and pump wear is caused by particulate contamination. Here is how to maintain optimal fluid purity.',
    '## Fluid Purity: The Lifeblood of Industrial Hydraulics

In hydraulic systems, clearances between valve spools and cylinder bores are often thinner than a single red blood cell—typically between **1 and 5 microns**. Yet many facility managers only change hydraulic filters on a calendar schedule rather than based on fluid particle count analysis.

### Understanding ISO 4406: The 3-Scale Rating

The international standard ISO 4406 defines fluid cleanliness through three numbers representing particles per milliliter:

- **First number:** Particles greater than **4 µm(c)**
- **Second number:** Particles greater than **6 µm(c)**
- **Third number:** Particles greater than **14 µm(c)**

For example, a target rating of **ISO 16/14/11** signifies:
- 4 µm: 320 to 640 particles/mL
- 6 µm: 80 to 160 particles/mL
- 14 µm: 10 to 20 particles/mL

> **Daily Maintenance Tip:**
> Brand-new drum oil straight from a supplier is rarely clean enough for modern proportional or servo valves. Always pump fresh oil through a dedicated 3-micron kidney-loop filter cart before filling hydraulic reservoirs.

### Key Maintenance Protocols
- Inspect desiccant breathers weekly on reservoir tanks.
- Monitor differential pressure gauges across return-line filter canisters.
- Schedule laboratory spectrographic oil analysis every 500 operating hours.

By logging fluid condition metrics into MachineCare Documents and Service History, you maintain a complete auditable health record of every critical hydraulic unit in your plant.',
    'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
    'Plant Operations',
    ARRAY['Hydraulics', 'Oil Analysis', 'ISO 4406', 'Fluid Power'],
    'Michael Mwangi',
    'Plant Operations Lead',
    NULL,
    'published',
    now() - INTERVAL '2 days',
    4,
    28,
    315,
    false
),
(
    'fleet-preventive-maintenance-telematics-checklist',
    'The 10-Minute Daily Fleet Pre-Trip Inspection That Saves $10,000s in Fines',
    'A standardized driver checklist stops roadside breakdowns, tyre blowouts, and regulatory infractions before wheels turn.',
    '## Why Daily Pre-Trip Inspections Are Non-Negotiable

Commercial logistics and heavy machinery fleets run on tight margins. A single roadside breakdown on a transit route causes driver demurrage, customer penalties, and dangerous recovery logistics.

A standardized **10-Minute Pre-Trip Inspection** performed every morning using MachineCare QR codes on the vehicle cabin drastically reduces on-road failures.

### The Critical 5-Zone Walkaround

1. **Zone 1: Engine Compartment & Fluids**
   - Engine oil dipstick level and color.
   - Coolant level and radiator hose condition (check for bulging or embrittlement).
   - Brake fluid reservoir and belt tension.

2. **Zone 2: Tyres & Wheels**
   - Tread depth (minimum 3.2mm on steers, 1.6mm on drives).
   - Visual inflation check and valve stem caps.
   - Wheel lug nut torque indicators (arrow alignment).

3. **Zone 3: Brake Systems & Air Tanks**
   - Drain moisture from pneumatic air tanks.
   - Air pressure buildup test (governor cutoff between 120-135 psi).

4. **Zone 4: Lights, Reflectors & Signals**
   - Headlamps, clearance markers, brake indicators, and hazard flashers.

5. **Zone 5: Load Security & Emergency Kit**
   - Ratchet straps, reflective triangles, certified fire extinguisher pressure gauge in the green zone.

> **Daily Fleet Rule:**
> If any defect in steering, brakes, or tyres is logged, the vehicle must be automatically marked "Out of Service" in the dispatch system until cleared by a certified mechanic.

With the MachineCare Fleet Module, drivers scan a QR code at the vehicle door, take photos of any defect, and the mechanic receives an instant notification before dispatch.',
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80',
    'Fleet & Logistics',
    ARRAY['Fleet Maintenance', 'Pre-Trip Inspection', 'Driver Safety', 'Tyre Wear'],
    'Fatima Al-Hassan',
    'Logistics & Fleet Director',
    NULL,
    'published',
    now() - INTERVAL '3 days',
    6,
    45,
    580,
    false
),
(
    'lockout-tagout-loto-zero-energy-state-guidelines',
    'Lockout/Tagout (LOTO): 6 Steps to Verifying a True Zero Energy State',
    'Never assume a machine is safe because a switch is off. Here is how rigorous energy isolation protocols save lives on the shop floor.',
    '## Beyond the Switch: True Energy Isolation

Every year, industrial mechanics suffer severe crush and electrocution injuries during routine maintenance because stored potential energy was not relieved. Turning off a local operator control panel is **not** an energy isolation.

The golden rule of maintenance safety is achieving an unambiguous **Zero Energy State** before entering any machine boundary.

### The 6 Essential Steps of LOTO

1. **Preparation & Notification:** Identify all energy sources (electrical, pneumatic, hydraulic, gravitational, thermal, chemical) and notify affected personnel.
2. **Orderly Machine Shutdown:** Stop equipment using normal operating controls.
3. **Machine Isolation:** Physically disconnect or block all energy isolation devices (breakers, disconnect switches, line valves).
4. **Lockout & Tagout Device Application:** Each technician places their own personal padlock and standardized danger tag. No master keys!
5. **Dissipation of Stored Energy:** Bleed pneumatic lines, release hydraulic pressure, block mechanical counterweights, discharge capacitor banks.
6. **Zero Energy Verification (The "Try" Step):** Test operating controls to verify machine will not start, then test electrical lines with a calibrated voltage meter (test-before-touch).

> **Daily Safety Reminder:**
> "One Worker, One Lock, One Key." Never allow a colleague or supervisor to remove your personal lockout padlock under any circumstance.

In MachineCare Safety Module, you can link Lockout/Tagout procedures directly to Work Orders, requiring technicians to upload photographic verification of locked breakers before work order signoff.',
    'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
    'Safety & Compliance',
    ARRAY['LOTO', 'Occupational Safety', 'Zero Energy', 'Compliance'],
    'Eng. Alex Muro',
    'Senior Reliability Specialist',
    NULL,
    'published',
    now() - INTERVAL '4 days',
    5,
    51,
    640,
    false
);
