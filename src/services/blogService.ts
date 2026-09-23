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
    title: "Daily Preventive Maintenance Tip: [Machine/Subsystem]",
    category: "Maintenance & Reliability",
    summary: "Today's quick maintenance protocol to eliminate micro-stoppages and extend component service life.",
    content: `## Today's Maintenance Focus

Today we examine preventative upkeep on **[Insert Asset Name or Class]**. Proactive adjustments take under 10 minutes but avert catastrophic downtime.

### Key Inspection Points
- [ ] Check lubricant level and oil clarity through the sight glass.
- [ ] Measure surface operating temperature using an infrared thermometer (Baseline: < 65°C).
- [ ] Inspect mounting bolts and vibration dampers for signs of fretting corrosion.
- [ ] Clean dust accumulation off motor cooling fins to avoid thermal derating.

> **💡 Maintenance Rule of the Day:**
> "Clean machines speak louder." A clean surface reveals early leaks, cracks, and fastener migration hours before vibration monitors trip.

### Corrective Action Protocol
If temperature exceeds normal operating range by more than 15°C, log a priority inspection in MachineCare immediately before shifting load.`,
  },
  {
    title: "Daily Safety Briefing: [Operational Hazard]",
    category: "Safety & Compliance",
    summary: "Essential safety checks before shift handover to ensure zero incidents and protect plant personnel.",
    content: `## Shift Safety Toolbox Talk

Prioritizing human safety and rigorous hazard identification before starting machine cycles.

### 5-Minute Safety Checklist
1. **PPE Verification:** Hard hats, steel-toe boots, eye protection, and hearing protection checked and rated.
2. **Emergency Stops:** Verify that all E-stop buttons along conveyor and machine perimeter latch freely and reset without sticking.
3. **Guards & Interlocks:** Ensure interlock switches on enclosure doors trip the drive circuit within 150ms.
4. **Housekeeping:** Keep walking aisles free of spilled coolant, hydraulic mist, and loose air hoses.

> **⚠️ Golden Safety Rule:**
> Never bypass a safety door interlock with a magnet or override key to "speed up clearance." An interlock was put there because someone previously lost a finger or hand.`,
  },
  {
    title: "Root Cause Investigation: [Fault / Stoppage Analysis]",
    category: "Plant Operations",
    summary: "Breaking down a recent breakdown using the 5-Whys methodology to prevent recurrence across sister lines.",
    content: `## Incident Overview & 5-Whys Breakdown

When a major stoppage occurs, replacing the failed component without addressing root systemic causes guarantees a repeat breakdown within 90 days.

### The 5-Whys Analysis
1. **Why did the line stop?** Motor drive tripped on thermal overload.
2. **Why was the motor overloaded?** Conveyor gearbox encountered excessive rotational torque.
3. **Why did the gearbox encounter high torque?** Drive chain tension was overtightened and unlubricated.
4. **Why was it overtightened?** Previous shift tightened tensioner bolts to eliminate chain slap instead of replacing elongated chain links.
5. **Why was an elongated chain not replaced?** Spare chain was out of stock in inventory, and no low-stock alert had been configured.

### Permanent Preventive Fix
- Configured automatic reorder point in MachineCare Inventory for ANSI #60 drive chains.
- Instituted monthly pitch gauge elongation checks on all main transfer drives.`,
  },
  {
    title: "Daily Fleet Dispatch Tip: Tyre Pressure & Fuel Economy",
    category: "Fleet & Logistics",
    summary: "How maintaining precise cold inflation pressures saves 3-5% on fleet fuel consumption and prevents blowouts.",
    content: `## The Hidden Cost of Under-Inflated Tyres

Tyres represent the second largest operating expense in commercial fleets after diesel fuel. Under-inflation by just 10 PSI increases rolling resistance, escalating fuel consumption by **2.5%** while increasing tyre carcass heat buildup significantly.

### Best Practice Cold Inflation Protocol
- Always test tyre pressure in the morning before vehicles embark on transit runs.
- Inspect dual-tyre pairs: if pressure difference between inner and outer tyre exceeds 5 PSI, the outer tyre carries up to 70% of the axle weight, causing premature bald spots.
- Check valve stems for metal hex caps with internal rubber O-rings to prevent centrifugal pressure leakage at highway speeds.

> **🚛 Fleet Pro Tip:**
> Check tread wear patterns monthly. Shoulder wear indicates persistent under-inflation; center rib wear indicates over-inflation; feathering indicates toe-in alignment errors.`,
  },
];

// Seed posts loaded when database table is not yet created or working offline
const SEED_POSTS: BlogPost[] = [
  {
    id: "seed-post-1",
    slug: "vibration-analysis-early-bearing-failure-detection",
    title: "Vibration Analysis: How to Catch Bearing Failures 60 Days Before Breakdown",
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
- < 1.4 mm/s RMS  : Class A (Excellent)
- 1.4 - 2.8 mm/s  : Class B (Good / Acceptable)
- 2.8 - 4.5 mm/s  : Class C (Alert / Schedule Lubrication or Alignment)
- > 4.5 mm/s RMS  : Class D (Danger / Immediate Corrective Action)
\`\`\`

> **💡 Daily Reliability Tip:**
> Never re-grease a noisy bearing blindly without checking vibration readings. Over-lubrication is as destructive as under-lubrication because excessive grease causes fluid churning, elevated temperatures, and blown seals.

### Integrating Continuous Vibration Telemetry with MachineCare

With MachineCare IoT sensors mounted on drive-end and non-drive-end housings, vibration velocity RMS readings sync automatically into your maintenance dashboard. When readings drift past the Class C warning threshold, MachineCare automatically generates a corrective Work Order for your maintenance crew before any downtime occurs.`,
    cover_image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    category: "Maintenance & Reliability",
    tags: ["Vibration Analysis", "Predictive Maintenance", "Bearings", "ISO 10816"],
    author_name: "Eng. Alex Muro",
    author_role: "Senior Reliability Specialist",
    author_avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
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
    author_name: "Michael Mwangi",
    author_role: "Plant Operations Lead",
    author_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
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
    author_name: "Fatima Al-Hassan",
    author_role: "Logistics & Fleet Director",
    author_avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
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
    author_name: "Eng. Alex Muro",
    author_role: "Senior Reliability Specialist",
    author_avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
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
        // Fallback to seed posts combined with any user local posts
        const local = getLocalPosts().filter((p) => p.status === "published");
        posts = [...local, ...SEED_POSTS];
      }
    } catch {
      const local = getLocalPosts().filter((p) => p.status === "published");
      posts = [...local, ...SEED_POSTS];
    }

    // Filter by category
    if (category && category !== "All") {
      posts = posts.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    // Filter by search query
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

    // Sort: featured first, then published_at descending
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
   * Fetch all posts for in-app / admin management (includes drafts, scheduled)
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
    // Merge local and seed posts without duplicate slugs
    const existingSlugs = new Set(local.map((p) => p.slug));
    const combined = [...local, ...SEED_POSTS.filter((p) => !existingSlugs.has(p.slug))];
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Create or update a blog post
   */
  async savePost(
    post: Partial<BlogPost> & { title: string; content: string },
    userProfile?: { name?: string; role?: string; avatar?: string; id?: string; orgId?: string }
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
      tags: post.tags || [],
      author_name: post.author_name || userProfile?.name || "MachineCare Engineer",
      author_role: post.author_role || userProfile?.role || "Reliability Specialist",
      author_avatar:
        post.author_avatar ||
        userProfile?.avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
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

    // Always update local storage so it is immediately visible even offline
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

  /**
   * Delete post
   */
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

  /**
   * Toggle Like
   */
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

    // Update in local cache
    const local = getLocalPosts();
    const match = local.find((p) => p.id === post.id);
    if (match) {
      match.likes_count = newCount;
      saveLocalPosts(local);
    }

    return { liked: !isCurrentlyLiked, newCount };
  },

  /**
   * Increment view count
   */
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

  /**
   * Compute daily writing streak
   */
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

    // Count consecutive days backward starting today or yesterday
    let streak = 0;
    let checkDate = new Date();

    if (!postedToday) {
      // Check if posted yesterday to keep the streak alive
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
