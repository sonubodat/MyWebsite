# Game Portal Specification
## "Play a Game" Integration & 3D Game Page

---

## Overview
The "Play a Game" feature is a standout element inspired by bruno-simon.com. It provides an interactive 3D world where visitors can explore and discover information about Sonu's work in a gamified environment.

**Current State**: Game is already built. This spec covers the portal/link integration.
**Future**: Link will be updated to actual game URL.

---

## Entry Points

### 1. Hero Section CTA (Secondary)
**Position**: Below primary "View My Work" button
**Style**: Outlined button, BRG border, white text
**Icon**: Gamepad2 (Lucide)
**Label**: `Play a Game`
**Behavior**: Opens GamePortal modal

### 2. Navigation Link
**Position**: Right side of nav, after "Contact"
**Style**: Same as other nav links, with gamepad icon
**Label**: `Play`
**Behavior**: Direct navigation to `/game` or opens modal

### 3. Contact Section CTA (Tertiary)
**Position**: Below email CTA
**Style**: Ghost button, gold accent
**Icon**: Gamepad2
**Label**: `Or play my game`
**Behavior**: Opens GamePortal modal

### 4. Floating Action Button (Optional)
**Position**: Bottom-right corner, appears after scrolling past hero
**Style**: Circular, BRG background, white gamepad icon
**Size**: 56px diameter
**Shadow**: `--shadow-lg`
**Behavior**: Opens GamePortal modal
**Animation**: Slides up from bottom on scroll, subtle pulse

---

## GamePortal Modal

### Trigger
- Any "Play a Game" button click
- Keyboard shortcut: `G` key (when not typing)

### Layout
```
<Dialog/Modal>
  ├── Backdrop
  │   ├── Blur: backdrop-blur-xl
  │   └── Background: rgba(0, 0, 0, 0.6)
  ├── Modal Card
  │   ├── Max-width: 640px
  │   ├── Background: var(--off-white) or glassmorphism
  │   ├── Border-radius: 24px
  │   ├── Padding: 48px
  │   └── Shadow: --shadow-xl
  │
  ├── Content
  │   ├── Close Button (top-right)
  │   │   ├── Icon: X
  │   │   └── Hover: rotate 90deg
  │   │
  │   ├── 3D Preview (optional)
  │   │   ├── Small R3F canvas (200x150px)
  │   │   ├── Rotating geometric shape
  │   │   └── BRG + gold colors
  │   │
  │   ├── Title
  │   │   ├── Text: "Explore My World"
  │   │   ├── Font: display-md
  │   │   └── Color: --grey-900
  │   │
  │   ├── Description
  │   │   ├── Text: "Navigate a 3D world built with Three.js to discover projects, skills, and achievements in an interactive way."
  │   │   ├── Font: body-lg
  │   │   └── Color: --grey-500
  │   │
  │   ├── Feature List (3 items)
 │   │   ├── "🎮 Drive through a custom 3D world"
  │   │   ├── "🏆 Discover hidden project showcases"
  │   │   └── "🚀 Built with Three.js & React Three Fiber"
  │   │   ├── Icon + text layout
  │   │   └── Font: body
  │   │
  │   ├── CTA Buttons
  │   │   ├── Primary: "Launch Game"
  │   │   │   ├── Style: Solid BRG, white text
  │   │   │   ├── Size: Large (py-4 px-8)
  │   │   │   ├── Icon: Rocket (right side)
  │   │   │   └── Link: /game (or external URL)
  │   │   │
  │   │   └── Secondary: "Maybe Later"
  │   │       ├── Style: Ghost, grey text
  │   │       └── Action: Close modal
  │   │
  │   └── Hint Text
  │       ├── "Press ESC to close"
  │       ├── Font: caption
  │       └── Color: --grey-300
  │
  └── Decorative Elements
      ├── Corner accents (subtle BRG shapes)
      └── Particle overlay (very subtle)
```

### Animation
```
Open:
  1. Backdrop fades in (opacity 0→1, 300ms)
  2. Modal scales up (scale 0.9→1, opacity 0→1)
  3. Content staggers in (title, desc, features, buttons)
  4. Total: ~600ms

Close:
  1. Content fades out
  2. Modal scales down (scale 1→0.95, opacity 1→0)
  3. Backdrop fades out
  4. Total: ~300ms
```

### Accessibility
- Focus trap inside modal
- ESC key closes
- Click outside closes
- Return focus to trigger on close
- `aria-labelledby` + `aria-describedby`
- Role: `dialog`

---

## Game Page (`/game`)

### Layout
```
<GamePage>
  ├── Loading Screen (initial)
  │   ├── Background: --brg-dark
  │   ├── Logo/Name
  │   ├── Progress bar (BRG to gold gradient)
  │   ├── Loading tips:
  │   │   ├── "Use WASD or Arrow keys to move"
  │   │   ├── "Discover all project showcases"
  │   │   └── "Built with Three.js + React Three Fiber"
  │   └── "Loading world..." text
  │
  ├── Game Canvas (full viewport)
  │   ├── Three.js / R3F scene
  │   ├── Physics world
  │   ├── Player vehicle/character
  │   ├── Interactive zones (projects, skills)
  │   └── Environment (BRG + gold themed)
  │
  ├── HUD Overlay
  │   ├── Top-left: "Back to Portfolio" button
  │   │   ├── Icon: ArrowLeft
  │   │   ├── Style: Pill, glassmorphism
  │   │   └── Link: /
  │   │
  │   ├── Top-right: Minimap (optional)
  │   ├── Bottom-left: Controls hint
  │   │   └── "WASD / Arrows to move • Space to brake"
  │   └── Bottom-center: Objectives
  │       └── "Find all 4 project showcases"
  │
  └── Pause Menu (ESC)
      ├── Resume
      ├── Back to Portfolio
      ├── Controls
      └── Sound toggle
```

### Theme Integration
- **Ground/Environment**: Dark grey (`#1a1a1a`) with BRG accents
- **Buildings/Platforms**: BRG (`#004225`) with gold (`#C9A227`) highlights
- **Sky/Background**: Dark gradient (`#0A0A0A` to `#004225`)
- **Interactive Objects**: Gold glow when near
- **Player Vehicle**: White with BRG stripes
- **UI**: Glassmorphism panels, BRG accents, white text

### World Design
```
World Layout (conceptual):
├── Spawn Point (center)
├── Project Zones (4 areas)
│   ├── Streefi Plaza (food-tech themed)
│   ├── Research Lab (academic themed)
│   ├── Cloud Tower (infrastructure themed)
│   └── Payment Hub (fintech themed)
├── Skill Garden (floating skill orbs)
├── Achievement Hall (trophy displays)
└── Contact Terminal (email/phone icons)
```

### Interactive Elements
| Object | Interaction | Result |
|--------|-----------|--------|
| Project Zone | Drive into zone | Popup with project info |
| Skill Orb | Drive near | Orb highlights, name appears |
| Achievement | Drive near | Confetti + description |
| Contact Terminal | Drive into | Shows contact details |

### Performance
- Target: 60fps on mid-range devices
- Mobile: Reduce shadow quality, particle count
- LOD (Level of Detail) for distant objects
- Texture compression (KTX2/Basis)

---

## Game → Portfolio Return

### Back Navigation
1. **Button**: "Back to Portfolio" in HUD (always visible)
2. **Keyboard**: `ESC` → Pause → "Back to Portfolio"
3. **Browser Back**: Works naturally

### Transition
```
1. Fade out game canvas (opacity 1→0, 400ms)
2. Show brief loading overlay
3. Navigate to /
4. Fade in portfolio
5. Scroll to #projects or #contact (optional)
```

---

## URL Strategy

### Current (Placeholder)
```
/game → redirects to simple HTTP page or shows "Coming Soon"
```

### Future (Actual Game)
```
/game → Full game experience
  └── Sub-routes:
      /game?project=streefi → Spawn near Streefi zone
      /game?showcase=skills → Camera pans to Skill Garden
```

---

## Analytics

### Track Events
| Event | Trigger |
|-------|---------|
| `game_portal_open` | Modal opened |
| `game_launch` | "Launch Game" clicked |
| `game_back_to_portfolio` | Returned from game |
| `game_project_discovered` | Found project zone |
| `game_time_spent` | Time in game (session) |

---

## Fallback Behavior

### Game Fails to Load
```
1. Show error message: "Unable to load game"
2. Offer: "View projects instead" → scroll to #projects
3. Or: "Try again" → reload game
```

### WebGL Not Supported
```
1. Detect WebGL support on /game load
2. If unsupported:
   - Show message: "3D experience requires WebGL"
   - Offer: "View portfolio" or "Learn more"
   - Show static screenshot of game
```

### Mobile Browser Limitations
```
1. Show "Best experienced on desktop" notice (dismissible)
2. Still allow game launch
3. Auto-detect portrait → show rotate message
4. Touch controls overlay
```
