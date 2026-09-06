# Design System
## British Racing Green Edition

---

## Color Palette

### Primary Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--brg` | `#004225` | Primary brand, nav bg, CTAs, accents |
| `--brg-light` | `#0a5c36` | Hover states, gradients |
| `--brg-dark` | `#002d1a` | Deep backgrounds, shadows |
| `--brg-muted` | `#1a4d33` | Secondary surfaces |

### Neutral Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--white` | `#FAFAFA` | Primary text on dark, card bg |
| `--off-white` | `#F5F5F0` | Page background, sections |
| `--cream` | `#E8E6E1` | Subtle borders, dividers |
| `--grey-100` | `#E5E5E5` | Light borders |
| `--grey-300` | `#A3A3A3` | Secondary text, captions |
| `--grey-500` | `#737373` | Muted text |
| `--grey-700` | `#404040` | Body text on light |
| `--grey-900` | `#171717` | Primary text on light, deep bg |
| `--black` | `#0A0A0A` | True black for contrast |

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--gold` | `#C9A227` | Highlights, achievements, badges |
| `--gold-light` | `#D4B84A` | Hover gold |
| `--error` | `#DC2626` | Error states |
| `--success` | `#16A34A` | Success states |

### Gradients
```css
--gradient-hero: linear-gradient(135deg, #004225 0%, #002d1a 50%, #0A0A0A 100%);
--gradient-card: linear-gradient(180deg, rgba(0,66,37,0.05) 0%, rgba(0,66,37,0.15) 100%);
--gradient-gold: linear-gradient(135deg, #C9A227 0%, #D4B84A 50%, #C9A227 100%);
--gradient-dark: linear-gradient(180deg, #0A0A0A 0%, #171717 100%);
```

---

## Typography

### Font Families
- **Headings**: `Space Grotesk`, sans-serif — weight 300, 400, 500, 700
- **Body**: `Inter`, sans-serif — weight 300, 400, 500, 600
- **Mono/Accents**: `JetBrains Mono`, monospace — weight 400, 500

### Type Scale
| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|-------|------|-------------|--------|----------------|-------|
| `display-xl` | clamp(4rem, 10vw, 8rem) | 0.9 | 700 | -0.03em | Hero name |
| `display-lg` | clamp(2.5rem, 6vw, 4.5rem) | 1.0 | 700 | -0.02em | Section titles |
| `display-md` | clamp(1.5rem, 3vw, 2.5rem) | 1.1 | 500 | -0.01em | Sub-sections |
| `heading-lg` | 1.5rem | 1.3 | 600 | -0.01em | Card titles |
| `heading-md` | 1.25rem | 1.4 | 500 | 0 | Sub-headings |
| `body-lg` | 1.125rem | 1.7 | 400 | 0 | Lead paragraphs |
| `body` | 1rem | 1.7 | 400 | 0 | Body text |
| `body-sm` | 0.875rem | 1.6 | 400 | 0 | Descriptions |
| `caption` | 0.75rem | 1.5 | 500 | 0.05em | Labels, uppercase |
| `mono` | 0.875rem | 1.5 | 400 | 0 | Code, tech tags |

---

## Spacing System
Base unit: `4px`

| Token | Value |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |
| `space-32` | 128px |

### Section Padding
- Desktop: `py-32` (128px) vertical, `px-8` (32px) horizontal
- Tablet: `py-24` (96px) vertical, `px-6` (24px) horizontal
- Mobile: `py-16` (64px) vertical, `px-4` (16px) horizontal

---

## Border Radius
| Token | Value |
|-------|-------|
| `radius-sm` | 4px |
| `radius-md` | 8px |
| `radius-lg` | 12px |
| `radius-xl` | 16px |
| `radius-2xl` | 24px |
| `radius-full` | 9999px |

---

## Shadows & Elevation
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
--shadow-glow: 0 0 40px rgba(0,66,37,0.15);
--shadow-gold: 0 0 30px rgba(201,162,39,0.2);
```

---

## Animation & Motion

### Easing Curves
| Name | Value | Usage |
|------|-------|-------|
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Primary entrances |
| `ease-in-expo` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits |
| `ease-elastic` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful bounces |
| `ease-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` | Subtle transitions |
| `ease-dramatic` | `cubic-bezier(0.87, 0, 0.13, 1)` | Hero reveals |

### Durations
| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 150ms | Hover states |
| `duration-normal` | 300ms | Standard transitions |
| `duration-slow` | 500ms | Section reveals |
| `duration-dramatic` | 800ms | Hero animations |
| `duration-epic` | 1200ms | Page transitions |

### Standard Animations
1. **Fade Up**: opacity 0→1, translateY(40px)→0, duration-slow, ease-out-expo
2. **Scale In**: scale(0.95)→1, opacity 0→1, duration-slow
3. **Slide In Left**: translateX(-60px)→0, opacity 0→1
4. **Slide In Right**: translateX(60px)→0, opacity 0→1
5. **Stagger Children**: 100ms delay between each child element
6. **Text Reveal**: clip-path reveal from bottom, per-character or per-word
7. **Parallax**: translateY based on scroll position, factor 0.1-0.3
8. **3D Tilt**: rotateX/Y based on mouse position, max ±15deg, perspective 1000px

---

## 3D Design Principles

### Scene Setup
- **Background**: Transparent (CSS gradient behind)
- **Camera**: Perspective, fov 45, position [0, 0, 5]
- **Lighting**: Ambient (intensity 0.4) + Directional (intensity 1.2, position [5, 5, 5])
- **Fog**: None (keep it sharp)

### Materials
- Primary shapes: `MeshStandardMaterial`, color `#004225`, roughness 0.3, metalness 0.1
- Accent shapes: `MeshStandardMaterial`, color `#C9A227`, roughness 0.2, metalness 0.4
- Wireframes: `LineBasicMaterial`, color `#A3A3A3`, opacity 0.3
- Glass: `MeshPhysicalMaterial`, transmission 0.9, roughness 0.1, thickness 0.5

### Interaction
- Mouse movement subtly rotates the entire scene (max ±5deg)
- Scroll drives camera position and object animations
- Click on 3D objects triggers section scroll-to
- Hover on interactive elements: scale 1.05, emissive glow

---

## Z-Index Scale
| Layer | Z-Index |
|-------|---------|
| 3D Canvas (background) | 0 |
| Content layers | 10 |
| Cards/elevated | 20 |
| Navigation | 50 |
| Modals/Overlays | 100 |
| Game Portal overlay | 200 |
