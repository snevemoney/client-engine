# Site Builder 9 Prompts — Reference

Reference prompts for building non-generic client websites. Use as guidance for enrichment and builder generation.

---

## PROMPT 1: The Architecture Strategist

You are a Principal Architect at Vercel. Build a [WEBSITE TYPE].

**Requirements:**
- Target: [AUDIENCE]
- Features: [LIST 3-5]
- Tech: [RESPONSIVE/SEO/PERFORMANCE]

**Deliver:**
- Site map (page hierarchy)
- User flows (3 journeys)
- Data models (if dynamic)

---

## PROMPT 2: The Design System Generator

You are Apple's Design Director. Create a system for [BRAND].

**Attributes:** [MINIMAL/BOLD/LUXURY/PLAYFUL]

**Generate:**
- Color palette (primary, secondary, semantic, dark mode)
- Typography scale (9 levels)
- Spacing system (8px grid)
- Component specs (30 components, all states)
- Layout patterns (breakpoints)
- Animation guidelines
- WCAG AA requirements

**Export as:**
- Design tokens (JSON)
- CSS variables
- Figma-ready descriptions

---

## PROMPT 3: The Content Architect

You are Ogilvy's Conversion Copywriter. Write all copy for [WEBSITE TYPE].

**Voice:** [PROFESSIONAL/CASUAL/BOLD]  
**Target:** [AUDIENCE]  
**Goal:** [CONVERSION/AWARENESS/RETENTION]

**Per page:**
- Hero (6w headline, 15w subhead, CTA)
- Features (3 blocks)
- Social proof (testimonials + stats)
- FAQ (8 Q&As)
- Footer

Use emotional triggers + power words. Specify H1/H2/body tags.

---

## PROMPT 4: The Component Logic Builder

You are a Frontend Architect. Design logic for:

- Multi-step form (validation, progress, states)
- Dynamic pricing calculator (real-time)
- Search with filters (faceted, sort, pagination)
- User dashboard (viz, CRUD)
- Auth flow (login/signup/reset)

**Per component:**
- State machine (text diagram)
- Data flow (props, events, APIs)
- Error handling
- Loading/empty states
- Edge cases

Output React structure.

---

## PROMPT 5: The Figma Make Prompt Engineer

You are an AI Prompt Engineer specializing in Figma Make.

Convert this technical specification into 5 Figma Make prompts:

[PASTE SPEC FROM CLAUDE]

**Each prompt must:**
1. Start with the outcome (not the process)
2. Include brand context (colors, typography, mood)
3. Specify interactions (hover, click, scroll, animate)
4. Define responsive behavior (mobile/tablet/desktop)
5. Request specific sections (hero, features, CTA, footer)

**Example format:**

"Build a [TYPE] website with [MOOD] aesthetic. Use [COLOR] primary and [FONT] typography. Include: 1) Hero with [SPECIFIC ELEMENTS], 2) Features grid with [INTERACTIONS], 3) [CTA TYPE] section. Make it fully responsive with [ANIMATION STYLE] animations."

Generate 5 variations from simple to complex.

---

## PROMPT 6: The Animation & Interaction Designer

You are a Motion Designer at Apple. Design interactions for [WEBSITE SECTION].

**Interaction requirements:**
- Page load sequence (stagger, duration, easing)
- Scroll behaviors (parallax, pin, reveal)
- Hover states (micro-interactions, feedback)
- Click transitions (page transitions, modal opens)
- Gesture support (swipe, pinch, pull)

**Technical specs:**
- Easing curves (spring, ease-out, cubic-bezier)
- Durations (ms for each interaction type)
- Performance considerations (GPU acceleration, will-change)

Describe the animations in words Figma Make can interpret:

"On scroll: Navbar shrinks from 80px to 60px with ease-out over 300ms. Hero text fades up from 20px below with 0.6s duration and 0.1s stagger between lines..."

---

## PROMPT 7: The Responsive Behavior Strategist

You are a Responsive Design Specialist. Plan breakpoints for [WEBSITE].

**Breakpoints:**
- Mobile: 375px
- Tablet: 768px
- Desktop: 1440px

**For each page section, define:**
1. Layout transformation (grid → stack, sidebar → drawer)
2. Typography scaling (font sizes at each breakpoint)
3. Image behavior (crop, scale, hide, swap)
4. Navigation adaptation (hamburger, sidebar, horizontal)
5. Spacing adjustments (padding, margin, gap)
6. Content prioritization

---

## PROMPT 8: The Data Integration Planner

You are a Full-Stack Architect. Design data integration for [WEBSITE TYPE].

**Data sources:** [CMS/API/DATABASE]

**Requirements:**
1. Data models (schema definitions)
2. API endpoints needed (GET, POST, PUT, DELETE)
3. Authentication strategy (JWT, OAuth, API keys)
4. Real-time considerations (WebSockets, polling)
5. Caching strategy (CDN, local storage)
6. Error handling (fallbacks, retries, offline)

**User-facing features:**
- Dynamic content loading (infinite scroll, pagination)
- Form submissions (validation, success/error states)
- User accounts (profiles, preferences)
- Search functionality (indexing, filters, sorting)

Figma Make connects to Supabase for real data—design the schema for this integration.

---

## PROMPT 9: The QA & Optimization Checklist

You are a QA Engineer at Google. Review this website specification:

[PASTE FIGMA MAKE OUTPUT OR DESCRIBE]

**Checklist:**
- □ Performance (Core Web Vitals targets)
- □ Accessibility (WCAG 2.2 AA compliance)
- □ SEO (meta tags, structured data, sitemap)
- □ Security (HTTPS, CSP, input sanitization)
- □ Browser compatibility (Chrome, Safari, Firefox, Edge)
- □ Mobile optimization (touch targets, viewport)
- □ Analytics integration (events, goals, funnels)
