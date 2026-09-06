# Page Architecture
## Routing, Layout & Navigation Flow

---

## Route Structure

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | `HomePage` | Main portfolio with all sections |
| `/game` | `GamePage` | Full-screen 3D game experience |
| `/#about` | Scroll anchor | About section |
| `/#experience` | Scroll anchor | Experience section |
| `/#projects` | Scroll anchor | Projects section |
| `/#skills` | Scroll anchor | Skills section |
| `/#publications` | Scroll anchor | Publications section |
| `/#education` | Scroll anchor | Education section |
| `/#contact` | Scroll anchor | Contact section |

---

## HomePage Layout

```
<HomePage>
  ├── Navigation (fixed, z-50)
  ├── HeroSection (100vh, 3D canvas background)
  ├── AboutSection
  ├── ExperienceSection
  ├── AchievementsSection
  ├── ProjectsSection
  ├── SkillsSection
  ├── PublicationsSection
  ├── EducationSection
  ├── ContactSection
  ├── Footer
  └── GamePortalModal (overlay, conditionally rendered)
```

---

## GamePage Layout

```
<GamePage>
  ├── GameCanvas (full viewport, Three.js/R3F)
  │   ├── 3D World (inspired by bruno-simon.com)
  │   ├── Player Vehicle/Character
  │   ├── Interactive Objects (projects, skills as 3D items)
  │   ├── Physics (cannon-es or Rapier)
  │   └── UI Overlay
  ├── GameUI (HUD)
  │   ├── Minimap
  │   ├── Objectives
  │   ├── Controls hint
  │   └── "Back to Portfolio" button
  └── Loading Screen (progress bar, tips)
```

**Game Concept**:
- Drive/navigate a vehicle through a stylized world
- Each area represents a project or skill category
- Collect/interact with objects to reveal information
- BRG and gold color scheme throughout
- Physics-based movement with satisfying controls

---

## Navigation Flow

### Scroll Behavior
- **Lenis smooth scroll**: `lerp: 0.1`, `duration: 1.2`
- **Anchor links**: Smooth scroll to section with offset for nav height (80px)
- **Scroll snap**: None (free scroll preferred for natural feel)
- **Progress indicator**: Thin BRG line at top of viewport showing scroll progress

### Navigation States
| State | Trigger | Visual |
|-------|---------|--------|
| Default | Top of page | Transparent bg, white text |
| Scrolled | Scroll > 100px | Glassmorphism bg, dark text |
| Hidden | Scroll down fast | translateY(-100%) |
| Visible | Scroll up | translateY(0) |

### Active Section
- Nav link highlights based on current section in viewport
- Use Intersection Observer with threshold 0.5
- Active indicator: BRG underline or dot

---

## Page Transitions

### Home → Game
1. User clicks "Play a Game"
2. GamePortal modal opens with preview
3. User clicks "Launch Game"
4. Current page fades out (opacity 0, scale 0.98)
5. Loading screen appears (3D scene loading)
6. GamePage mounts with entrance animation

### Game → Home
1. User clicks "Back to Portfolio" or presses ESC
2. Game canvas fades out
3. HomePage restores with scroll position remembered
4. Optional: return to #contact or last viewed section

---

## SEO & Meta

### HomePage Meta
```
title: Sonu Bodat — Full-Stack & Mobile Software Engineer
description: Full-Stack & Mobile Software Engineer. Co-Founder of Streefi. Building products from architecture to production with React Native, Next.js, and AWS.
keywords: Full-Stack Engineer, Mobile Developer, React Native, Next.js, AWS, Software Engineer, India
og:image: /og-image.jpg
og:title: Sonu Bodat — Portfolio
twitter:card: summary_large_image
```

### Structured Data (JSON-LD)
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Sonu Bodat",
  "jobTitle": "Full-Stack & Mobile Software Engineer",
  "url": "https://[your-domain].com",
  "sameAs": [
    "https://linkedin.com/in/sonu-bodat",
    "https://github.com/Sonu-GitHub"
  ],
  "worksFor": {
    "@type": "Organization",
    "name": "Streefi Private Limited"
  },
  "alumniOf": {
    "@type": "CollegeOrUniversity",
    "name": "Pandit Deendayal Energy University"
  }
}
```

---

## Accessibility

### Requirements
- All images have descriptive alt text
- Color contrast ratio > 4.5:1 for all text
- Focus states visible on all interactive elements
- Skip-to-content link
- Reduced motion support (`prefers-reduced-motion`)
- Semantic HTML (nav, main, section, article, footer)
- ARIA labels on 3D canvas and interactive elements

### Keyboard Navigation
- Tab order follows visual order
- Enter/Space activates buttons and links
- ESC closes modals and game portal
- Arrow keys for game controls (if focused)

---

## Performance Strategy

### Loading Priority
| Resource | Priority | Strategy |
|----------|----------|----------|
| Critical CSS | High | Inline in `<head>` |
| Fonts | High | `font-display: swap`, preload |
| Hero 3D | Medium | Lazy load after LCP |
| Below-fold images | Low | Lazy loading |
| Game assets | Low | Load on demand |

### Code Splitting
- Three.js/R3F: Dynamic import in Hero section
- Game page: Separate chunk, loaded on navigation
- GSAP ScrollTrigger: Dynamic import
- Heavy components: `next/dynamic` with `ssr: false` where appropriate
