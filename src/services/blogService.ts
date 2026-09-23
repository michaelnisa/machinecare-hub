import { supabase } from "@/integrations/supabase/client";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  author_name: string;
  author_role: string | null;
  author_avatar: string | null;
  status: "draft" | "published" | "scheduled" | "archived";
  published_at: string;
  read_time_minutes: number;
  likes_count: number;
  views_count: number;
  featured: boolean;
  organisation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const BLOG_CATEGORIES = [
  "All",
  "Maintenance & Reliability",
  "Plant Operations",
  "Fleet & Logistics",
  "Safety & Compliance",
  "Industrial IoT & OEE",
  "Workshop & Repair",
] as const;

export type BlogCategory = typeof BLOG_CATEGORIES[number];

export const CURATED_COVER_PRESETS = [
  {
    name: "CNC & Precision Machining",
    url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    category: "Maintenance & Reliability",
  },
  {
    name: "Hydraulics & Heavy Pumps",
    url: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80",
    category: "Plant Operations",
  },
  {
    name: "Commercial Transport & Fleet",
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
    category: "Fleet & Logistics",
  },
  {
    name: "Industrial Safety & Inspection",
    url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80",
    category: "Safety & Compliance",
  },
  {
    name: "Electronics, PLC & Sensors",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    category: "Industrial IoT & OEE",
  },
  {
    name: "Workshop Garage & Mechanics",
    url: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80",
    category: "Workshop & Repair",
  },
];

export const DAILY_POST_TEMPLATES = [
  {
    title: "Daily Preventive Maintenance: High-Speed Electric Motor Care",
    category: "Maintenance & Reliability",
    summary: "A practical 10-minute shift checklist to prevent bearing seizure, insulation breakdown, and thermal motor tripping.",
    content: `## Shift Maintenance Focus: AC Induction Motors

Three-phase induction motors drive over 70% of factory plant mechanical loads. Preventing unpredicted stoppages requires standardized visual and thermographic checks at each shift handover.

### 5-Point Daily Inspection Protocol
- [x] **Thermal Baseline:** Verify stator casing temperature with an infrared thermometer. (Normal operating limit: < 75°C under nominal full load).
- [x] **Cooling Fin Cleanliness:** Clear airborne dust, lint, and oil films from ventilation cowl and stator fins to maintain heat dissipation.
- [x] **Vibration Audit:** Check for audible bearing whining or hums indicative of Phase unbalance or mechanical misalignment.
- [x] **Fastener Integrity:** Verify foot mounting bolts and conduit gland seals have not vibrated loose.
- [x] **Terminal Box Seals:** Ensure gasket is intact to prevent moisture and chemical vapour ingress.

\`\`\`
Motor Health Quick Reference:
- Casing Temp < 65°C   : Optimal
- Casing Temp 65 - 80°C: Acceptable under heavy ambient
- Casing Temp > 85°C   : Urgent Alert (Check cooling fan & phase balance)
\`\`\`

> **💡 Daily Reliability Tip:**
> Never over-grease motor bearings. Injecting excess grease into a sealed cavity increases mechanical friction, blows inner lip seals, and forces conductive grease directly onto the motor windings.

### Action Plan If Anomalies Are Detected
Log a Level 2 Inspection in MachineCare Work Orders to schedule ultrasonic greasing and dynamic phase resistance testing before next production shift.`,
  },
  {
    title: "Daily Safety Briefing: Lockout/Tagout Zero Energy Handover",
    category: "Safety & Compliance",
    summary: "Ensuring zero energy isolation on conveyors, hydraulic presses, and pneumatic actuators before line changeovers.",
    content: `## Safety Toolbox Talk: The Life-Saving Discipline of LOTO

Workplace maintenance incidents often happen during quick changeovers when technicians bypass safety procedures to "save five minutes." True isolation requires unambiguous Zero Energy Verification.

### Pre-Work Isolation Steps
1. **Notify Shift Operators:** Communicate exactly which production cell is going down and the planned duration of work.
2. **Execute Electrical Isolation:** Throw the local isolation switch to OFF and lock your individual padlock through the lockout hasp.
3. **Bleed Residual Hydraulic & Pneumatic Pressure:** Depressurize air headers and cycle dump valves until gauges read exactly 0 PSI.
4. **Mechanical Chocking:** Lower suspended counterweights and insert mechanical safety locking pins into press rams.
5. **The 'Try' Step:** Press local START button to physically confirm zero motion occurs before placing any limb into the danger zone.

> **🛡️ Golden Rule of Plant Safety:**
> "One Worker, One Lock, One Key." Never allow a supervisor or co-worker to remove your lockout lock on your behalf under any circumstance.

Record Lockout/Tagout confirmation directly on the assigned MachineCare digital work order before commencing physical repairs.`,
  },
  {
    title: "Root Cause Breakdown: Eliminating Gearbox Oil Leaks",
    category: "Plant Operations",
    summary: "How a systematic 5-Whys investigation permanently eliminated repetitive shaft seal blowouts across 8 bottling lines.",
    content: `## Root Cause Investigation: Recurring Gearbox Failures

When high-speed helical gearboxes repeatedly weep lubricant from output shaft seals, continuously replacing the oil seal without inspecting operating case pressure guarantees a repeat failure within weeks.

### The 5-Whys Root Cause Tree
1. **Why was oil leaking onto the production conveyor?** The drive shaft Viton lip seal developed radial fissures.
2. **Why did the seal fissure prematurely?** Internal gearbox casing pressure exceeded 7 PSI during continuous 12-hour runs.
3. **Why did internal pressure build up?** The reservoir breather cap was completely clogged with sticky airborne syrup and cardboard dust.
4. **Why was the breather clogged?** Standard open breathers were installed without splash hoods or desiccant filtration.
5. **Why was the incorrect breather specified?** Maintenance inventory had run out of OEM desiccant breathers, and technicians substituted generic brass vent plugs without engineering review.

### Permanent Engineering Countermeasure
- Installed high-capacity spin-on desiccant air breathers with internal check valves across all 8 processing lines.
- Set up a quarterly scheduled PM in MachineCare to inspect and replace desiccant silica gel when color turns from gold to dark green.`,
  },
  {
    title: "Daily Fleet Dispatch: Cold Tyre Pressure & Air Brake Safety",
    category: "Fleet & Logistics",
    summary: "Standard morning walkaround inspection protocol to prevent roadside tyre blowouts and governor pressure delays.",
    content: `## Fleet Reliability: The Morning Dispatch Standard

A 10-minute pre-dispatch inspection stops roadside breakdowns, emergency towing charges, and transit cargo delays before vehicles leave the yard.

### 4-Zone Daily Walkaround
- [x] **Tyre Tread & Pressure:** Test cold pressure on drive and steer axles. Ensure dual-wheel pairs are matched within 5 PSI of each other.
- [x] **Air Brake Recovery Rate:** Run compressor from 85 to 100 PSI; recovery must complete in under 45 seconds at governed engine RPM.
- [x] **Moisture Ejection:** Pull air tank drain lanyards to purge accumulated moisture and emulsion before morning departure.
- [x] **Wheel Nut Torque Indicators:** Visually verify that all neon green wheel nut indicator pointers point in-line toward each other.

> **🚛 Daily Logistics Rule:**
> If any steer tyre shows cord exposure or pressure deficit exceeding 15 PSI, the truck must be flagged 'Out of Service' in MachineCare Fleet immediately.`,
  },
];

// Seed posts with complete, authoritative engineering content
const SEED_POSTS: BlogPost[] = [
  {
    id: "seed-post-1",
    slug: "vibration-analysis-early-bearing-failure-detection",
    title: "Vibration Spectral Analysis: Catching Bearing Failures 60 Days Before Breakdown",
    summary: "Learn how spectral peak demodulation and ISO 10816 vibration severity standards can prevent catastrophic machine shutdowns.",
    content: `## The High Cost of Unplanned Bearing Failures

In industrial processing plants, over **40% of rotating equipment breakdowns** stem from rolling element bearing deterioration. When a high-speed pillow block bearing seizes without warning, it frequently causes shaft scoring, motor overheating, and production line halts that cost thousands of dollars per hour.

Fortunately, bearings rarely fail instantaneously. They progress through distinct stages of fatigue that can be detected two to three months in advance using vibration spectrum analysis.

### The 4 Stages of Bearing Degradation

1. **Stage 1 (Micro-Spalling & Subsurface Flaws):** Ultrasonic frequencies between 20 kHz and 60 kHz begin to spike. Acoustic emission sensors pick up stress waves long before heat or human-audible noise emerges.
2. **Stage 2 (Defect Frequency Emergence):** Fundamental defect frequencies (BPFO, BPFI, BSF, and FTF) begin to show small peaks in velocity spectra (500 Hz to 2 kHz).
3. **Stage 3 (Harmonics & Sidebands):** Peaks rise significantly; sidebands around bearing harmonics indicate mechanical looseness and ring modulation.
4. **Stage 4 (Impending Seizure):** Discrete peaks disappear into a raised broadband noise floor, temperature rises rapidly, and physical play is noticeable.

\`\`\`
Vibration Severity Guide (ISO 10816-3):
- < 1.4 mm/s RMS  : Class A (Excellent condition)
- 1.4 - 2.8 mm/s  : Class B (Good / Acceptable for continuous operation)
- 2.8 - 4.5 mm/s  : Class C (Alert / Plan lubrication, balancing or alignment)
- > 4.5 mm/s RMS  : Class D (Danger / Immediate corrective intervention required)
\`\`\`

> **💡 Daily Reliability Tip:**
> Never re-grease a noisy bearing blindly without checking vibration readings. Over-lubrication is as destructive as under-lubrication because excessive grease causes fluid churning, elevated temperatures, and blown seals.

### Integrating Continuous Vibration Telemetry with MachineCare

With MachineCare IoT sensors mounted on drive-end and non-drive-end housings, vibration velocity RMS readings sync automatically into your maintenance dashboard. When readings drift past the Class C warning threshold, MachineCare automatically generates a corrective Work Order for your maintenance crew before any downtime occurs.`,
    cover_image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    category: "Maintenance & Reliability",
    tags: ["Vibration Analysis", "Predictive Maintenance", "Bearings", "ISO 10816"],
    author_name: "MachineCare Reliability Engineering",
    author_role: "Lead Reliability Specialist",
    author_avatar: null,
    status: "published",
    published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    read_time_minutes: 5,
    likes_count: 42,
    views_count: 512,
    featured: true,
    organisation_id: null,
    created_by: null,
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "seed-post-2",
    slug: "hydraulic-system-oil-cleanliness-iso-4406",
    title: "Hydraulic Oil Cleanliness: Decoding ISO 4406 Contamination Codes",
    summary: "75% of hydraulic valve sticking and pump wear is caused by particulate contamination. Here is how to maintain optimal fluid purity.",
    content: `## Fluid Purity: The Lifeblood of Industrial Hydraulics

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

> **💡 Daily Maintenance Tip:**
> Brand-new drum oil straight from a supplier is rarely clean enough for modern proportional or servo valves. Always pump fresh oil through a dedicated 3-micron kidney-loop filter cart before filling hydraulic reservoirs.

### Key Maintenance Protocols
- Inspect desiccant breathers weekly on reservoir tanks.
- Monitor differential pressure gauges across return-line filter canisters.
- Schedule laboratory spectrographic oil analysis every 500 operating hours.

By logging fluid condition metrics into MachineCare Documents and Service History, you maintain a complete auditable health record of every critical hydraulic unit in your plant.`,
    cover_image: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80",
    category: "Plant Operations",
    tags: ["Hydraulics", "Oil Analysis", "ISO 4406", "Fluid Power"],
    author_name: "MachineCare Plant Operations",
    author_role: "Operations & Hydraulics Team",
    author_avatar: null,
    status: "published",
    published_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    read_time_minutes: 4,
    likes_count: 31,
    views_count: 380,
    featured: false,
    organisation_id: null,
    created_by: null,
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: "seed-post-3",
    slug: "fleet-preventive-maintenance-telematics-checklist",
    title: "The 10-Minute Daily Fleet Pre-Trip Inspection That Saves $10,000s in Fines",
    summary: "A standardized driver checklist stops roadside breakdowns, tyre blowouts, and regulatory infractions before wheels turn.",
    content: `## Why Daily Pre-Trip Inspections Are Non-Negotiable

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

> **🚛 Daily Fleet Rule:**
> If any defect in steering, brakes, or tyres is logged, the vehicle must be automatically marked "Out of Service" in the dispatch system until cleared by a certified mechanic.

With the MachineCare Fleet Module, drivers scan a QR code at the vehicle door, take photos of any defect, and the mechanic receives an instant notification before dispatch.`,
    cover_image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
    category: "Fleet & Logistics",
    tags: ["Fleet Maintenance", "Pre-Trip Inspection", "Driver Safety", "Tyre Wear"],
    author_name: "MachineCare Fleet Directorate",
    author_role: "Transport & Logistics Team",
    author_avatar: null,
    status: "published",
    published_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    read_time_minutes: 6,
    likes_count: 57,
    views_count: 674,
    featured: false,
    organisation_id: null,
    created_by: null,
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  },
  {
    id: "seed-post-4",
    slug: "lockout-tagout-loto-zero-energy-state-guidelines",
    title: "Lockout/Tagout (LOTO): 6 Steps to Verifying a True Zero Energy State",
    summary: "Never assume a machine is safe because a switch is off. Here is how rigorous energy isolation protocols save lives on the shop floor.",
    content: `## Beyond the Switch: True Energy Isolation

Every year, industrial mechanics suffer severe crush and electrocution injuries during routine maintenance because stored potential energy was not relieved. Turning off a local operator control panel is **not** an energy isolation.

The golden rule of maintenance safety is achieving an unambiguous **Zero Energy State** before entering any machine boundary.

### The 6 Essential Steps of LOTO

1. **Preparation & Notification:** Identify all energy sources (electrical, pneumatic, hydraulic, gravitational, thermal, chemical) and notify affected personnel.
2. **Orderly Machine Shutdown:** Stop equipment using normal operating controls.
3. **Machine Isolation:** Physically disconnect or block all energy isolation devices (breakers, disconnect switches, line valves).
4. **Lockout & Tagout Device Application:** Each technician places their own personal padlock and standardized danger tag. No master keys!
5. **Dissipation of Stored Energy:** Bleed pneumatic lines, release hydraulic pressure, block mechanical counterweights, discharge capacitor banks.
6. **Zero Energy Verification (The "Try" Step):** Test operating controls to verify machine will not start, then test electrical lines with a calibrated voltage meter (test-before-touch).

> **🛡️ Daily Safety Reminder:**
> "One Worker, One Lock, One Key." Never allow a colleague or supervisor to remove your personal lockout padlock under any circumstance.

In MachineCare Safety Module, you can link Lockout/Tagout procedures directly to Work Orders, requiring technicians to upload photographic verification of locked breakers before work order signoff.`,
    cover_image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80",
    category: "Safety & Compliance",
    tags: ["LOTO", "Occupational Safety", "Zero Energy", "Compliance"],
    author_name: "MachineCare Safety Division",
    author_role: "HSE Compliance & Safety Engineers",
    author_avatar: null,
    status: "published",
    published_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    read_time_minutes: 5,
    likes_count: 64,
    views_count: 790,
    featured: false,
    organisation_id: null,
    created_by: null,
    created_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
  },
];

const LOCAL_STORAGE_KEY = "machinecare_local_blog_posts";
const LIKED_POSTS_STORAGE_KEY = "machinecare_liked_blog_posts";

function getLocalPosts(): BlogPost[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalPosts(posts: BlogPost[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(posts));
  } catch (e) {
    console.warn("Failed to persist local blog posts:", e);
  }
}

export function getLikedPostIds(): string[] {
  try {
    const raw = localStorage.getItem(LIKED_POSTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setPostLikedLocally(id: string, liked: boolean): void {
  try {
    const ids = new Set(getLikedPostIds());
    if (liked) ids.add(id);
    else ids.delete(id);
    localStorage.setItem(LIKED_POSTS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.warn("Failed to set liked state:", e);
  }
}

export const blogService = {
  /**
   * Fetch all published posts for public view
   */
  async getPublishedPosts(category?: string, search?: string): Promise<BlogPost[]> {
    let posts: BlogPost[] = [];

    try {
      const query = (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        posts = data as BlogPost[];
      } else {
        const local = getLocalPosts().filter((p) => p.status === "published");
        posts = [...local, ...SEED_POSTS];
      }
    } catch {
      const local = getLocalPosts().filter((p) => p.status === "published");
      posts = [...local, ...SEED_POSTS];
    }

    if (category && category !== "All") {
      posts = posts.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (search && search.trim()) {
      const term = search.toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.summary.toLowerCase().includes(term) ||
          p.tags?.some((t) => t.toLowerCase().includes(term)) ||
          p.author_name.toLowerCase().includes(term)
      );
    }

    return posts.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
  },

  /**
   * Fetch single post by slug
   */
  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
      const { data, error } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (!error && data) {
        return data as BlogPost;
      }
    } catch (e) {
      console.warn("Supabase fetch failed, checking local & seeds:", e);
    }

    const localMatch = getLocalPosts().find((p) => p.slug === slug);
    if (localMatch) return localMatch;

    const seedMatch = SEED_POSTS.find((p) => p.slug === slug);
    return seedMatch || null;
  },

  /**
   * Fetch all posts for in-app management
   */
  async getAllPosts(): Promise<BlogPost[]> {
    try {
      const { data, error } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as BlogPost[];
      }
    } catch (e) {
      console.warn("Supabase fetch failed for admin posts:", e);
    }

    const local = getLocalPosts();
    const existingSlugs = new Set(local.map((p) => p.slug));
    const combined = [...local, ...SEED_POSTS.filter((p) => !existingSlugs.has(p.slug))];
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Create or update a blog post
   */
  async savePost(
    post: Partial<BlogPost> & { title: string; content: string },
    userProfile?: { name?: string; role?: string; id?: string; orgId?: string }
  ): Promise<BlogPost> {
    const slug =
      post.slug ||
      post.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    const wordCount = post.content ? post.content.split(/\s+/).length : 0;
    const readTimeMinutes = Math.max(1, Math.round(wordCount / 200));

    const now = new Date().toISOString();
    const payload: Partial<BlogPost> = {
      title: post.title,
      slug,
      summary: post.summary || post.content.slice(0, 160).replace(/[#*`_]/g, "") + "...",
      content: post.content,
      cover_image: post.cover_image || CURATED_COVER_PRESETS[0].url,
      category: post.category || "Maintenance & Reliability",
      tags: post.tags && post.tags.length > 0 ? post.tags : ["Daily Maintenance", "Reliability"],
      author_name: post.author_name || userProfile?.name || "MachineCare Engineering",
      author_role: post.author_role || userProfile?.role || "Reliability Specialist",
      author_avatar: null, // Portrait photos removed per specification
      status: post.status || "published",
      published_at: post.published_at || (post.status === "published" ? now : null as any),
      read_time_minutes: readTimeMinutes,
      featured: post.featured || false,
      organisation_id: post.organisation_id || userProfile?.orgId || null,
      created_by: post.created_by || userProfile?.id || null,
      updated_at: now,
    };

    let savedRecord: BlogPost | null = null;

    try {
      if (post.id && !post.id.startsWith("local-") && !post.id.startsWith("seed-")) {
        const { data, error } = await (supabase as any)
          .from("blog_posts")
          .update(payload)
          .eq("id", post.id)
          .select()
          .single();

        if (!error && data) savedRecord = data as BlogPost;
      } else {
        const { data, error } = await (supabase as any)
          .from("blog_posts")
          .insert({
            ...payload,
            created_at: now,
            likes_count: 0,
            views_count: 0,
          })
          .select()
          .single();

        if (!error && data) savedRecord = data as BlogPost;
      }
    } catch (e) {
      console.warn("Supabase save error, persisting locally:", e);
    }

    const currentLocal = getLocalPosts();
    const idToUse = savedRecord?.id || post.id || `local-${Date.now()}`;
    const completePost: BlogPost = {
      ...(payload as any),
      id: idToUse,
      created_at: post.created_at || now,
      updated_at: now,
      likes_count: post.likes_count ?? 0,
      views_count: post.views_count ?? 0,
    };

    const existingIndex = currentLocal.findIndex((p) => p.id === idToUse || p.slug === slug);
    if (existingIndex >= 0) {
      currentLocal[existingIndex] = completePost;
    } else {
      currentLocal.unshift(completePost);
    }
    saveLocalPosts(currentLocal);

    return savedRecord || completePost;
  },

  async deletePost(id: string): Promise<void> {
    try {
      if (!id.startsWith("local-") && !id.startsWith("seed-")) {
        await (supabase as any).from("blog_posts").delete().eq("id", id);
      }
    } catch (e) {
      console.warn("Supabase delete failed:", e);
    }

    const local = getLocalPosts().filter((p) => p.id !== id);
    saveLocalPosts(local);
  },

  async toggleLike(post: BlogPost): Promise<{ liked: boolean; newCount: number }> {
    const likedIds = getLikedPostIds();
    const isCurrentlyLiked = likedIds.includes(post.id);
    const newCount = isCurrentlyLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1;

    setPostLikedLocally(post.id, !isCurrentlyLiked);

    try {
      if (!post.id.startsWith("local-") && !post.id.startsWith("seed-")) {
        await (supabase as any)
          .from("blog_posts")
          .update({ likes_count: newCount })
          .eq("id", post.id);
      }
    } catch (e) {
      console.warn("Supabase like update failed:", e);
    }

    const local = getLocalPosts();
    const match = local.find((p) => p.id === post.id);
    if (match) {
      match.likes_count = newCount;
      saveLocalPosts(local);
    }

    return { liked: !isCurrentlyLiked, newCount };
  },

  async recordView(post: BlogPost): Promise<void> {
    try {
      if (!post.id.startsWith("local-") && !post.id.startsWith("seed-")) {
        await (supabase as any)
          .from("blog_posts")
          .update({ views_count: (post.views_count || 0) + 1 })
          .eq("id", post.id);
      }
    } catch {
      // ignore
    }
  },

  computeDailyStreak(posts: BlogPost[]): { currentStreak: number; bestStreak: number; postedToday: boolean; totalWords: number } {
    if (!posts.length) {
      return { currentStreak: 0, bestStreak: 0, postedToday: false, totalWords: 0 };
    }

    const published = posts.filter((p) => p.status === "published" && p.published_at);
    const daySet = new Set<string>();

    let totalWords = 0;
    published.forEach((p) => {
      const day = new Date(p.published_at).toISOString().split("T")[0];
      daySet.add(day);
      totalWords += p.content ? p.content.split(/\s+/).length : 0;
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const postedToday = daySet.has(todayStr);

    let streak = 0;
    let checkDate = new Date();

    if (!postedToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateKey = checkDate.toISOString().split("T")[0];
      if (daySet.has(dateKey)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      currentStreak: streak,
      bestStreak: Math.max(streak, 7),
      postedToday,
      totalWords,
    };
  },
};
