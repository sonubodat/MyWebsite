# Responsive Design Specification
## Breakpoints, Layouts & Adaptive Behavior

---

## Breakpoint System

| Name | Width | Tailwind Prefix | Primary Target |
|------|-------|-----------------|----------------|
| Mobile | < 640px | `default` | Phones |
| Tablet | 640px - 1024px | `sm:` / `md:` | Tablets, large phones |
| Desktop | 1024px - 1280px | `lg:` | Laptops |
| Wide | > 1280px | `xl:` / `2xl:` | Desktops, large monitors |

### Exact Values
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

---

## Hero Section Responsive

### Desktop (≥1024px)
- 3D canvas: Full viewport, all objects rendered
- Text: Left-aligned, max-width 60%
- Name: `clamp(4rem, 10vw, 8rem)`
- Subtitle: `clamp(1.25rem, 2vw, 1.5rem)`
- CTAs: Horizontal row, 2 buttons
- Scroll indicator: Visible

### Tablet (768px - 1023px)
- 3D canvas: Reduced particle count (500), simplified shapes
- Text: Center-aligned
- Name: `clamp(3rem, 8vw, 5rem)`
- CTAs: Horizontal row, smaller buttons

### Mobile (< 768px)
- 3D canvas: Minimal (200 particles, 1-2 shapes), or replace with CSS gradient animation
- Text: Center-aligned, full width
- Name: `clamp(2.5rem, 12vw, 4rem)`
- Subtitle: `1rem`
- CTAs: Stacked vertically, full width
- Scroll indicator: Smaller, less prominent

### Performance Notes
- Use `dpr={[1, 1.5]}` on mobile (reduce pixel ratio)
- Disable mouse spotlight on touch devices
- Reduce particle count based on device capability
- Consider `prefers-reduced-motion` override

---

## Navigation Responsive

### Desktop
- Horizontal nav links centered
- Contact icons on right
- Logo on left
- Height: 80px

### Tablet
- Same as desktop, links may collapse to icon-only
- Height: 72px

### Mobile
- Hamburger menu button (right)
- Full-screen overlay menu
- BRG background (`#004225`)
- Links stacked vertically, centered
- Large text (`2rem`)
- Staggered entrance animation (100ms per link)
- Close: X button or swipe down gesture

### Mobile Menu Animation
```
Open:
  - Backdrop fades in (opacity 0→1, 300ms)
  - Menu slides from right (translateX(100%)→0, 400ms, spring)
  - Links stagger in (opacity 0→1, translateY(20px)→0, 50ms stagger)

Close:
  - Links fade out
  - Menu slides right
  - Backdrop fades out
```

---

## About Section Responsive

### Desktop
- Two columns: 60/40 split
- Left: Body text
- Right: 2x2 stats grid
- Stats: Large numbers with labels

### Tablet
- Two columns: 50/50
- Stats: 2x2 grid, smaller numbers

### Mobile
- Single column, stacked
- Stats: Horizontal scroll or 2x2 grid with smaller text
- Body text: Full width, larger line height for readability

---

## Experience Timeline Responsive

### Desktop
- Vertical center line
- Alternating left/right cards
- Cards: 45% width each side
- Connector dots on center line

### Tablet
- Same alternating layout
- Cards: 42% width
- Smaller padding

### Mobile
- Single column, left-aligned
- Center line moves to left (20px from edge)
- Cards: Full width, left of line
- Connector dots on left
- Date badges above cards
- No alternating — all cards same side

---

## Achievements Grid Responsive

### Desktop
- Masonry-style or CSS Grid
- Card 1 (Streefi): Spans 2 columns
- Cards 2-4: Single column each
- Card 5 (Growth): Spans 2 columns
- 3 columns total

### Tablet
- 2 columns
- Card 1 spans 2 columns
- Others single column

### Mobile
- Single column stack
- All cards full width
- Reduced padding inside cards

---

## Projects Grid Responsive

### Desktop
- 2 columns
- Cards: Aspect-video thumbnails
- Full tech tag visibility

### Tablet
- 2 columns, smaller gaps
- Cards: Slightly compact

### Mobile
- Single column
- Cards: Full width
- Thumbnails: Taller aspect ratio (4:3)
- Tech tags: Horizontal scroll
- Feature bullets: Collapsed, expand on tap

---

## Skills Section Responsive

### Desktop
- Orbital cloud visualization
- Skills as floating bubbles
- Interactive hover

### Tablet
- Same orbital cloud, fewer bubbles
- Or simplified to category grid

### Mobile
- Replace orbital with category accordion
- Each category expandable
- Skills as tag pills
- No 3D — use flat design

### SkillOrb → SkillTag Transition
```
Desktop: Floating 3D-like bubbles with hover effects
Tablet: Smaller bubbles, less animation
Mobile: Static tag pills in accordion
```

---

## Publications Responsive

### Desktop
- Cards side by side (2 columns)
- Full abstract visible

### Tablet
- Stacked or 2 columns with compact text

### Mobile
- Single column
- Abstract collapsed ("Read Abstract" toggle)
- DOI link with copy button

---

## Education Responsive

### Desktop
- 3 cards in row
- Equal width

### Tablet
- 3 cards, smaller
- Or first card full width, other two side by side

### Mobile
- Vertical stack
- Cards: Full width, horizontal layout (icon left, text right)
- Or keep vertical with reduced padding

---

## Contact Section Responsive

### Desktop
- Two columns: 50/50
- Left: Contact details list
- Right: Large CTA buttons

### Tablet
- Same two columns
- Buttons: Full width of column

### Mobile
- Single column
- Contact details: Icon + text rows
- CTAs: Stacked, full width
- "Play a Game" button: Prominent, gold accent

---

## Game Portal Responsive

### Desktop
- Modal centered, max-width 600px
- 3D preview canvas inside modal
- Side-by-side layout (preview left, text right)

### Tablet
- Modal: 80% width
- Stacked layout

### Mobile
- Full-screen modal
- No 3D preview (static image or CSS animation)
- Large tap targets (min 48px)
- "Launch Game" button: Full width, prominent

---

## Game Page Responsive

### Desktop
- Full 3D experience
- Keyboard controls (WASD/Arrow keys)
- HUD overlay

### Tablet
- Touch controls (virtual joystick)
- Simplified graphics

### Mobile
- Touch controls
- Reduced render quality
- Simplified physics
- Portrait: Show rotate device message
- Landscape: Full game

---

## Typography Responsive

### Fluid Type Scale
```css
/* Using clamp() for fluid sizing */
--text-hero: clamp(2.5rem, 10vw, 8rem);
--text-section: clamp(2rem, 5vw, 4.5rem);
--text-subsection: clamp(1.25rem, 3vw, 2.5rem);
--text-body: clamp(0.875rem, 1.5vw, 1.125rem);
```

### Mobile Adjustments
- Line height increases (1.7 → 1.8) for readability
- Letter spacing slightly increased on small text
- Minimum font size: 14px (never smaller)

---

## Touch & Interaction

### Touch Targets
- All buttons: min 48x48px
- Nav links: min 44px height
- Cards: Full width tap area

### Gestures
- Horizontal swipe: Mobile menu close
- Pull down: Refresh (optional)
- Long press: Copy contact info

### Hover States (Desktop Only)
```css
@media (hover: hover) {
  .card:hover { transform: translateY(-8px); }
  .button:hover { background: var(--brg-light); }
}

@media (hover: none) {
  .card:active { transform: scale(0.98); }
}
```

---

## Container Widths

| Breakpoint | Max Width | Padding |
|------------|-----------|---------|
| Mobile | 100% | 16px (px-4) |
| Tablet | 100% | 24px (px-6) |
| Desktop | 1280px | 32px (px-8) |
| Wide | 1440px | 48px (px-12) |

---

## Image Responsive

### Project Thumbnails
```html
<picture>
  <source srcset="project.avif" type="image/avif">
  <source srcset="project.webp" type="image/webp">
  <img 
    src="project.jpg" 
    alt="..."
    loading="lazy"
    class="w-full h-auto"
  >
</picture>
```

### Sizes
- Mobile: 400w
- Tablet: 800w
- Desktop: 1200w

---

## Testing Checklist

### Devices to Test
- [ ] iPhone SE (375px)
- [ ] iPhone 14 Pro (393px)
- [ ] iPad Mini (768px)
- [ ] iPad Pro (1024px)
- [ ] MacBook Air (1280px)
- [ ] Desktop 1440px+
- [ ] Desktop 1920px+

### Browsers
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Chrome Mobile
- [ ] Safari Mobile

### Accessibility
- [ ] Screen reader navigation
- [ ] Keyboard-only usage
- [ ] Color contrast check
- [ ] Reduced motion preference
- [ ] Font size 200% zoom
