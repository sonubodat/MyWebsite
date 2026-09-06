# Sonu Bodat — Portfolio & Resume Website
## Architecture & Build Guide

### Overview
A premium, interactive portfolio website featuring a 3D-driven hero experience, British Racing Green aesthetic, and a dedicated "Play a Game" portal. The site balances professional credibility with creative engineering flair.

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D Engine**: Three.js + React Three Fiber (R3F) + Drei
- **Animations**: Framer Motion (UI), GSAP (scroll/timeline), Lenis (smooth scroll)
- **Fonts**: Space Grotesk (headings), Inter (body), JetBrains Mono (code/accents)
- **Icons**: Lucide React + custom SVG
- **Deployment**: Vercel (primary), AWS S3/CloudFront (3D assets)

### File Structure
```
app/
├── page.tsx                 # Main landing (Hero + Sections)
├── layout.tsx               # Root layout, fonts, providers
├── globals.css              # Tailwind + custom CSS
├── sections/
│   ├── Hero.tsx             # 3D interactive hero
│   ├── About.tsx            # Professional summary
│   ├── Experience.tsx       # Work history timeline
│   ├── Projects.tsx         # Featured projects grid
│   ├── Skills.tsx           # Tech stack visualization
│   ├── Publications.tsx     # IEEE papers
│   ├── Education.tsx        # Academic background
│   ├── Contact.tsx          # CTA + social links
│   └── GamePortal.tsx       # "Play a Game" gateway
├── components/
│   ├── Navigation.tsx       # Fixed nav with blur
│   ├── Footer.tsx           # Minimal footer
│   ├── SectionWrapper.tsx   # Scroll-triggered reveals
│   ├── ThreeCanvas.tsx      # R3F canvas wrapper
│   ├── ParticleField.tsx    # Background particles
│   ├── Card3D.tsx           # 3D tilt cards
│   ├── TimelineItem.tsx     # Experience timeline
│   ├── SkillOrb.tsx         # Animated skill bubbles
│   └── GameButton.tsx       # CTA to game
├── hooks/
│   ├── useMousePosition.ts
│   ├── useScrollProgress.ts
│   └── useInView.ts
├── lib/
│   └── utils.ts
└── types/
    └── index.ts
```

### Performance Budget
- First Contentful Paint: < 1.2s
- Time to Interactive: < 2.5s
- 3D canvas: Lazy load below fold, reduce on mobile
- Images: WebP/AVIF, CDN-backed

### Build Commands
```bash
npm install three @react-three/fiber @react-three/drei framer-motion gsap @studio-freight/lenis lucide-react
npm run dev
```
