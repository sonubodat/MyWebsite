# Component Specification
## Reusable Components & Section Breakdown

---

## Global Components

### Navigation (`Navigation.tsx`)
**Behavior**: Fixed top, glassmorphism background on scroll
**Structure**:
```
<nav>
  ├── Logo/Name (left) — "SB" monogram or "Sonu Bodat" text
  ├── Nav Links (center, desktop only)
  ├── Contact Icons (right)
  └── Mobile Menu Button (hamburger, mobile only)
</nav>
```

**States**:
- Default: Transparent background, white text
- Scrolled: `bg-white/80 backdrop-blur-md shadow-sm`, text switches to dark
- Mobile: Full-screen overlay, BRG background, staggered link animations

**Animation**: Links fade in with 50ms stagger on load. Mobile menu slides from right with spring physics.

---

### Footer (`Footer.tsx`)
**Structure**:
```
<footer>
  ├── Top: Large "Let's talk" text with email link
  ├── Middle: Social links row (GitHub, LinkedIn, Email, Phone)
  └── Bottom: Copyright + "Built with..." tagline
</footer>
```

**Style**: Dark background (`--grey-900`), off-white text, minimal padding.

---

### SectionWrapper (`SectionWrapper.tsx`)
**Props**: `id`, `className`, `children`, `label`, `heading`
**Behavior**: Wraps every section with:
- Scroll-triggered fade-up animation (GSAP ScrollTrigger or Framer Motion `whileInView`)
- Consistent padding and max-width (`max-w-7xl mx-auto`)
- Optional section label (mono font, uppercase, BRG color)
- Optional heading (display-lg)

**Animation Config**:
```typescript
const sectionVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
}
```

---

### Card3D (`Card3D.tsx`)
**Props**: `children`, `className`, `intensity` (default: 15)
**Behavior**: 3D tilt effect on mouse hover using CSS transform
**Implementation**:
- Track mouse position relative to card center
- Apply `rotateX` and `rotateY` based on position
- Add `perspective: 1000px` on parent
- Smooth transition with `transition: transform 0.15s ease-out`
- Optional glare effect (radial gradient overlay)

**Usage**: Project cards, achievement cards, skill category cards

---

## Section-Specific Components

### Hero3D (`Hero.tsx`)
**Structure**:
```
<section id="hero">
  ├── ThreeCanvas (background, full viewport)
  │   ├── Floating geometric shapes (torus, icosahedron, octahedron)
  │   ├── Particle field (1000 particles, BRG + gold colors)
  │   └── Ambient lighting + mouse-follow spotlight
  ├── Content (centered, z-index above canvas)
  │   ├── Label: "Full-Stack & Mobile Engineer"
  │   ├── Name: "Sonu Bodat" (display-xl, split into animated chars)
  │   ├── Subtitle: "Building products from architecture to production"
  │   ├── Social proof line
  │   └── CTA Group (2 buttons)
  └── Scroll indicator (bottom center, bouncing chevron)
</section>
```

**3D Elements**:
- Floating torus knot: BRG color, slow rotation, responds to mouse
- Wireframe icosahedron: Gold edges, counter-rotation
- Small particle spheres: 50-100 instances, slow drift, connect with lines when close
- Mouse spotlight: PointLight that follows cursor position in 3D space

**Text Animation**: Name characters animate in with stagger (30ms per char), using Framer Motion. Each char starts `opacity: 0, y: 50, rotateX: -90` → ends `opacity: 1, y: 0, rotateX: 0`.

---

### AboutSection (`About.tsx`)
**Structure**:
```
<SectionWrapper id="about" label="01 — ABOUT" heading="Engineering products that matter">
  ├── Two-column layout (desktop)
  │   ├── Left (60%): Body text paragraphs
  │   └── Right (40%): Stats grid (2x2)
  └── Single column (mobile): Stacked
</SectionWrapper>
```

**Stats Component** (`StatCard`):
- Large number (animated counter from 0 to value)
- Label below
- Subtle border or background card
- Hover: slight scale up

---

### ExperienceTimeline (`Experience.tsx`)
**Structure**:
```
<SectionWrapper id="experience" label="02 — EXPERIENCE" heading="Where I've built">
  ├── Vertical timeline (center line, alternating left/right on desktop)
  │   ├── TimelineItem (Streefi)
  │   ├── TimelineItem (BrainyBeams)
  │   └── TimelineItem (Internship)
  └── Mobile: Single column, left-aligned line
</SectionWrapper>
```

**TimelineItem Component**:
```
<TimelineItem>
  ├── Date badge (top)
  ├── Connector dot (on center line)
  ├── Card (3D tilt)
  │   ├── Header: Role + Company + Location
  │   ├── Period badge
  │   ├── Highlights list (bullet points)
  │   └── Tech tags (horizontal scroll on mobile)
  └── Type badge (Full-time/Internship)
</TimelineItem>
```

**Animation**: Items slide in from their respective side (left items from left, right from right). Center line draws itself as user scrolls (SVG stroke-dasharray animation).

---

### AchievementsGrid (`Achievements.tsx`)
**Structure**:
```
<SectionWrapper id="achievements" label="03 — ACHIEVEMENTS" heading="Impact that speaks">
  ├── 5 achievement cards in staggered grid
  │   ├── Card 1: Co-founded Streefi (spans 2 cols)
  │   ├── Card 2: IEEE Paper
  │   ├── Card 3: Payment Infrastructure
  │   ├── Card 4: Cloud Infrastructure
  │   └── Card 5: Growth Infrastructure (spans 2 cols)
  └── Mobile: Single column stack
</SectionWrapper>
```

**AchievementCard Component**:
- Icon/Number indicator (large, gold)
- Title (heading-md)
- Description (body-sm)
- BRG border-left or top accent
- 3D tilt on hover
- Background: subtle gradient or glass effect

---

### ProjectsGrid (`Projects.tsx`)
**Structure**:
```
<SectionWrapper id="projects" label="04 — PROJECTS" heading="Things I've shipped">
  ├── Filter tabs (All / Mobile / Web / Research)
  ├── Project cards grid (2 columns desktop, 1 mobile)
  │   ├── ProjectCard (Streefi)
  │   ├── ProjectCard (Streefi 3D Website)
  │   ├── ProjectCard (AES Encryption)
  │   └── ProjectCard (Image Flare)
  └── "View All on GitHub" link
</SectionWrapper>
```

**ProjectCard Component**:
```
<ProjectCard>
  ├── Image/Thumbnail area (aspect-video, 3D tilt container)
  │   └── Project screenshot or abstract 3D shape
  ├── Content
  │   ├── Category tag (caption, mono)
  │   ├── Title (heading-lg)
  │   ├── Description (body-sm, 2-3 lines)
  │   ├── Feature bullets (3 items, check icons)
  │   └── Tech stack tags
  └── Footer
      ├── Links (Live, GitHub, Paper)
      └── Arrow icon (animated on hover)
</ProjectCard>
```

**Hover State**:
- Card lifts (translateY -8px)
- Shadow increases
- Image scales slightly (1.05)
- Arrow icon slides right

---

### SkillsVisualization (`Skills.tsx`)
**Structure**:
```
<SectionWrapper id="skills" label="05 — SKILLS" heading="Tools I wield">
  ├── Two visualizations
  │   ├── Orbital Cloud (desktop): Skills as floating bubbles
  │   └── Category Grid (mobile): Accordion or tabbed list
  └── Proficiency indicators (optional)
</SectionWrapper>
```

**SkillOrb Component** (desktop):
- Circular "bubble" with skill name
- Size varies by importance/frequency
- Colors: BRG primary, gold for core skills, grey for secondary
- Float animation (gentle sine wave, random phase)
- On hover: scale up, bring to front, show tooltip with category
- Click: filter projects by that skill

**CategoryAccordion** (mobile):
- Expandable sections per category
- Skills as tag pills inside
- Smooth height animation on expand

---

### PublicationsList (`Publications.tsx`)
**Structure**:
```
<SectionWrapper id="publications" label="06 — PUBLICATIONS" heading="Research & Contributions">
  ├── Publication cards (stacked, 2 max)
  │   ├── PublicationCard (IEEE)
  │   └── PublicationCard (Springer)
  └── "View on Google Scholar" link (if applicable)
</SectionWrapper>
```

**PublicationCard Component**:
```
<PublicationCard>
  ├── Badge: Venue/Conference (gold accent)
  ├── Title (heading-md)
  ├── Authors
  ├── Venue details
  ├── DOI link (mono font, copy button)
  └── Abstract (collapsible, 2 lines preview)
</PublicationCard>
```

**Style**: Academic but modern. Border-left in gold. Hover reveals full abstract.

---

### EducationCards (`Education.tsx`)
**Structure**:
```
<SectionWrapper id="education" label="07 — EDUCATION" heading="Academic foundation">
  ├── Horizontal scroll or 3-card row (desktop)
  │   ├── EducationCard (PDEU)
  │   ├── EducationCard (Parth)
  │   └── EducationCard (Alembic)
  └── Mobile: Vertical stack
</SectionWrapper>
```

**EducationCard Component**:
```
<EducationCard>
  ├── Institution name (heading-md)
  ├── Degree
  ├── Period
  ├── Score/CGPA (large, prominent)
  └── Decorative element (graduation cap icon)
</EducationCard>
```

**Style**: Clean, minimal. Score is the visual focal point.

---

### ContactSection (`Contact.tsx`)
**Structure**:
```
<SectionWrapper id="contact" label="08 — CONTACT" heading="Let's build something">
  ├── Two-column layout
  │   ├── Left (50%): Body text + contact details list
  │   │   ├── Phone (click to call)
  │   │   ├── Email (click to mail)
  │   │   ├── LinkedIn (external link)
  │   │   └── GitHub (external link)
  │   └── Right (50%): Large CTA area
  │       ├── "Have an idea?" text
  │       ├── Email CTA button (large, BRG)
  │       └── Game CTA (secondary)
  └── Background: Subtle 3D shape or particle field
</SectionWrapper>
```

**ContactDetail Component**:
- Icon + Label + Value
- Hover: icon rotates or bounces
- Click: copies to clipboard (with toast notification)

---

### GamePortal (`GamePortal.tsx`)
**Structure**:
```
<Component>
  ├── Trigger Button (floating or in nav)
  │   └── "Play a Game" with gamepad icon
  └── Overlay/Modal (when active)
      ├── Backdrop: blur + dark overlay
      ├── Modal Card (centered, large)
      │   ├── 3D Preview (small canvas showing game scene)
      │   ├── Title: "Explore my world"
      │   ├── Description: "Navigate a 3D world to discover more about my work"
      │   ├── "Launch Game" button (large, gold)
      │   └── "Maybe Later" close button
      └── Close: ESC key or click outside
</SectionWrapper>
```

**Trigger Locations**:
1. Hero section (secondary CTA)
2. Navigation (persistent link)
3. Contact section (tertiary CTA)
4. Floating action button (bottom-right on scroll)

**Animation**: Modal scales in from 0.9 with spring, backdrop fades in.

---

## Utility Components

### ParticleField (`ParticleField.tsx`)
**Purpose**: Background ambient particles
**Props**: `count`, `color`, `speed`, `connectDistance`
**Implementation**: Canvas 2D or R3F Points. Particles drift slowly, connect with lines when close.

### TextReveal (`TextReveal.tsx`)
**Purpose**: Animate text on scroll
**Props**: `text`, `type` ("chars" | "words" | "lines"), `stagger`, `delay`
**Implementation**: Split text into spans, animate each with Framer Motion stagger.

### MagneticButton (`MagneticButton.tsx`)
**Purpose**: Button that follows cursor slightly when hovered
**Props**: `children`, `strength` (default: 0.3)
**Implementation**: Track mouse relative to button center, apply translateX/Y with lerp smoothing.

### Toast (`Toast.tsx`)
**Purpose**: Copy-to-clipboard confirmation
**Style**: Small pill, BRG background, white text, slides up from bottom
**Duration**: 2 seconds
