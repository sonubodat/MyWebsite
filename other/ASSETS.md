# Asset Specification
## Images, Icons, 3D Models & Resources

---

## Image Assets

### 1. OG Image (Social Share)
**File**: `/public/og-image.jpg`
**Size**: 1200x630px
**Format**: JPG (high quality)
**Content**: 
- Background: BRG gradient
- Large text: "Sonu Bodat"
- Subtitle: "Full-Stack & Mobile Software Engineer"
- Small: "Portfolio & 3D Game"
- Style: Clean, minimal, professional

### 2. Profile Photo (Optional)
**File**: `/public/profile.jpg`
**Size**: 800x800px (square)
**Format**: WebP with JPG fallback
**Style**: Professional headshot or stylized avatar
**Usage**: About section, contact section
**Treatment**: If used, subtle border-radius (16px) or circular

### 3. Project Thumbnails

#### Streefi Platform
**File**: `/public/projects/streefi-platform.jpg`
**Size**: 1200x675px (16:9)
**Format**: WebP
**Content**: Screenshot of Streefi app/web or abstract food-tech visualization
**Colors**: BRG, white, food-related accents

#### Streefi 3D Website
**File**: `/public/projects/streefi-website.jpg`
**Size**: 1200x675px
**Format**: WebP
**Content**: Screenshot of 3D website hero or abstract geometric design
**Colors**: BRG, gold, dark

#### AES Encryption Research
**File**: `/public/projects/aes-encryption.jpg`
**Size**: 1200x675px
**Format**: WebP
**Content**: Abstract security/crypto visualization (lock, key, encrypted data pattern)
**Colors**: Dark, green matrix-style, gold highlights

#### Image Flare
**File**: `/public/projects/image-flare.jpg`
**Size**: 1200x675px
**Format**: WebP
**Content**: Abstract image processing visualization (filters, histograms, color channels)
**Colors**: Colorful but muted, academic feel

### 4. Achievement Icons
**Style**: Custom SVG or Lucide icons
**Color**: Gold (`#C9A227`) on BRG or dark background

| Achievement | Icon |
|-------------|------|
| Co-founded Streefi | Rocket |
| IEEE Paper | FileText |
| Payment Infrastructure | CreditCard |
| Cloud Infrastructure | Cloud |
| Growth Infrastructure | TrendingUp |

### 5. Education Logos (Optional)
**File**: `/public/education/pdeu-logo.png`
**Size**: 200x200px
**Format**: PNG with transparency
**Usage**: Education cards
**Alternative**: Use institution initials in stylized text instead

---

## SVG Assets

### 1. Logo/Monogram
**File**: `/public/logo.svg`
**Content**: "SB" monogram or "Sonu" wordmark
**Style**: Minimal, geometric, Space Grotesk font
**Colors**: BRG primary, gold accent
**Variants**: 
- Light version (for dark backgrounds)
- Dark version (for light backgrounds)
- Icon only (for favicon)

### 2. Decorative Shapes
**File**: `/public/shapes/`
**Content**:
- `circle-grid.svg` — Pattern for backgrounds
- `wave-divider.svg` — Section dividers
- `dot-pattern.svg` — Subtle texture
- `corner-accent.svg` — Card corner decorations

### 3. Icons (Lucide React)
**Primary Set**: Use Lucide icons throughout
**Custom Icons** (if needed):
- `gamepad.svg` — Game portal (if Lucide's Gamepad2 insufficient)
- `streefi-logo.svg` — Streefi brand mark
- `aws-icon.svg` — AWS services

---

## 3D Assets

### Hero Scene
**Method**: Procedural geometry (no external models needed)
**Objects**:
1. TorusKnot — `THREE.TorusKnotGeometry(1, 0.3, 128, 32)`
2. Icosahedron — `THREE.IcosahedronGeometry(1.5, 1)`
3. Octahedron — `THREE.OctahedronGeometry(0.8, 0)`
4. Particles — `THREE.BufferGeometry` with random positions

### Game Scene
**Method**: Procedural + simple primitives
**Objects**:
1. Ground plane — `THREE.PlaneGeometry`
2. Buildings — `THREE.BoxGeometry` with different dimensions
3. Skill orbs — `THREE.SphereGeometry`
4. Player vehicle — `THREE.Group` of primitives or loaded GLB

### Optional GLB Models
**If using external models**:
- **Player Vehicle**: Low-poly car or character (under 1MB)
- **Environment Props**: Trees, rocks, signs (low-poly)
- **Source**: Sketchfab (CC0), self-made in Blender

---

## Favicon & PWA

### Favicon Set
```
/public/
├── favicon.ico (32x32)
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png (180x180)
├── android-chrome-192x192.png
├── android-chrome-512x512.png
└── site.webmanifest
```

**Design**: "SB" monogram on BRG background, white text

### Manifest
```json
{
  "name": "Sonu Bodat — Portfolio",
  "short_name": "Sonu Bodat",
  "description": "Full-Stack & Mobile Software Engineer Portfolio",
  "theme_color": "#004225",
  "background_color": "#0A0A0A",
  "display": "standalone",
  "start_url": "/",
  "icons": [...]
}
```

---

## Font Files

### Primary Fonts (Google Fonts)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Font Loading Strategy
```typescript
// next/font/google
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap'
})

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap'
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
})
```

---

## Color Assets

### CSS Variables
```css
:root {
  /* Primary */
  --brg: #004225;
  --brg-light: #0a5c36;
  --brg-dark: #002d1a;
  --brg-muted: #1a4d33;

  /* Neutral */
  --white: #FAFAFA;
  --off-white: #F5F5F0;
  --cream: #E8E6E1;
  --grey-100: #E5E5E5;
  --grey-300: #A3A3A3;
  --grey-500: #737373;
  --grey-700: #404040;
  --grey-900: #171717;
  --black: #0A0A0A;

  /* Accent */
  --gold: #C9A227;
  --gold-light: #D4B84A;
  --error: #DC2626;
  --success: #16A34A;
}
```

### Tailwind Config Extension
```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        brg: {
          DEFAULT: '#004225',
          light: '#0a5c36',
          dark: '#002d1a',
          muted: '#1a4d33',
        },
        gold: {
          DEFAULT: '#C9A227',
          light: '#D4B84A',
        },
        offwhite: '#F5F5F0',
        cream: '#E8E6E1',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
}
```

---

## Audio Assets (Optional)

### Game Sounds
**If adding audio to game**:
- `hover.mp3` — UI hover (subtle, 0.1s)
- `click.mp3` — Button click (subtle, 0.1s)
- `collect.mp3` — Collecting item in game (0.5s)
- `bgm.mp3` — Background music (optional, ambient)

**Format**: MP3 + OGG fallback
**Size**: Keep under 500KB total
**License**: Original or CC0

---

## Asset Pipeline

### Image Optimization
```bash
# Convert to WebP/AVIF
# Resize to multiple breakpoints
# Generate blur placeholders

# Example with Sharp (Node.js)
sharp('input.jpg')
  .resize(1200, 675)
  .webp({ quality: 85 })
  .toFile('output.webp')
```

### Next.js Image Component
```typescript
import Image from 'next/image'

<Image
  src="/projects/streefi-platform.webp"
  alt="Streefi Platform"
  width={1200}
  height={675}
  priority={false}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

---

## Asset Checklist

### Required Before Launch
- [ ] OG image (1200x630)
- [ ] Favicon set (all sizes)
- [ ] Web manifest
- [ ] Project thumbnails (4)
- [ ] Logo/monogram SVG
- [ ] Fonts loaded via next/font

### Optional / Phase 2
- [ ] Profile photo
- [ ] Education logos
- [ ] Custom icons
- [ ] 3D models for game
- [ ] Audio assets
- [ ] Decorative SVG patterns

### CDN Setup
- [ ] Upload images to S3/CloudFront or Vercel Edge
- [ ] Configure cache headers
- [ ] Enable compression (Brotli/Gzip)
