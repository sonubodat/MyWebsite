# 3D & Animation Specification
## Three.js, R3F, GSAP & Framer Motion Details

---

## 3D Scene Architecture

### Canvas Setup (`ThreeCanvas.tsx`)
```typescript
<Canvas
  camera={{ position: [0, 0, 5], fov: 45 }}
  dpr={[1, 2]} // Responsive pixel ratio
  gl={{ 
    antialias: true, 
    alpha: true,
    powerPreference: "high-performance"
  }}
  style={{ position: "absolute", top: 0, left: 0, zIndex: 0 }}
>
  <Suspense fallback={<LoadingFallback />}>
    <SceneContent />
  </Suspense>
</Canvas>
```

### Scene Content
```
<SceneContent>
  ├── Lighting
  │   ├── AmbientLight (intensity: 0.4, color: #ffffff)
  │   ├── DirectionalLight (intensity: 1.2, position: [5, 5, 5], castShadow)
  │   └── PointLight (follows mouse, intensity: 0.8, color: #C9A227)
  ├── FloatingShapes
  │   ├── TorusKnot (BRG, slow rotation)
  │   ├── Icosahedron (wireframe, gold, counter-rotation)
  │   ├── Octahedron (glass material, floating)
  │   └── Small spheres (particle-like, 20-30 instances)
  ├── ParticleField (1000 points, BRG + gold)
  └── Environment (optional, for reflections)
</SceneContent>
```

---

## 3D Objects Detail

### 1. TorusKnot (Hero Primary)
```typescript
<TorusKnot args={[1, 0.3, 128, 32]}>
  <meshStandardMaterial 
    color="#004225" 
    roughness={0.3} 
    metalness={0.1}
    emissive="#004225"
    emissiveIntensity={0.2}
  />
</TorusKnot>
```
- **Animation**: `rotation.y += 0.002`, `rotation.x += 0.001`
- **Mouse response**: Slight tilt toward cursor (max ±0.1 rad)
- **Position**: [0, 0, -2] (behind text)

### 2. Icosahedron Wireframe (Accent)
```typescript
<Icosahedron args={[1.5, 1]}>
  <meshBasicMaterial 
    color="#C9A227" 
    wireframe 
    transparent 
    opacity={0.3}
  />
</Icosahedron>
```
- **Animation**: `rotation.y -= 0.003`, pulse scale (1 → 1.02 → 1, 4s loop)
- **Position**: [3, 1, -4]

### 3. Floating Particles
```typescript
<Points limit={1000}>
  <pointsMaterial 
    size={0.02} 
    color="#004225" 
    transparent 
    opacity={0.6}
    sizeAttenuation
  />
  {/* BufferGeometry with random positions */}
</Points>
```
- **Behavior**: Slow drift upward, reset when out of bounds
- **Mouse**: Particles gently repel from cursor
- **Colors**: 70% BRG, 20% gold, 10% white

### 4. Mouse Spotlight
```typescript
const mouseLight = useRef()
useFrame(({ mouse }) => {
  mouseLight.current.position.x = mouse.x * 5
  mouseLight.current.position.y = mouse.y * 5
})

<PointLight 
  ref={mouseLight}
  color="#C9A227"
  intensity={0.8}
  distance={10}
  decay={2}
/>
```

---

## Scroll-Driven Animations (GSAP)

### ScrollTrigger Setup
```typescript
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
gsap.registerPlugin(ScrollTrigger)
```

### Hero Parallax
```typescript
gsap.to(camera.position, {
  y: -2,
  scrollTrigger: {
    trigger: "#hero",
    start: "top top",
    end: "bottom top",
    scrub: 1
  }
})
```

### Section Reveal Pattern
```typescript
// Applied to each section wrapper
gsap.fromTo(sectionRef.current, 
  { opacity: 0, y: 80 },
  {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out",
    scrollTrigger: {
      trigger: sectionRef.current,
      start: "top 85%",
      toggleActions: "play none none reverse"
    }
  }
)
```

### Timeline Draw Animation
```typescript
// SVG path animation for experience timeline
gsap.fromTo(".timeline-line",
  { strokeDasharray: 1000, strokeDashoffset: 1000 },
  {
    strokeDashoffset: 0,
    scrollTrigger: {
      trigger: "#experience",
      start: "top 60%",
      end: "bottom 80%",
      scrub: 1
    }
  }
)
```

---

## Framer Motion Patterns

### Page Entrance
```typescript
const pageVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.4 }
  }
}
```

### Stagger Children
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  }
}
```

### Text Character Animation
```typescript
const text = "Sonu Bodat"
const chars = text.split("")

{chars.map((char, i) => (
  <motion.span
    key={i}
    initial={{ opacity: 0, y: 50, rotateX: -90 }}
    animate={{ opacity: 1, y: 0, rotateX: 0 }}
    transition={{ 
      duration: 0.6, 
      delay: i * 0.03,
      ease: [0.16, 1, 0.3, 1]
    }}
    style={{ display: "inline-block" }}
  >
    {char === " " ? " " : char}
  </motion.span>
))}
```

### Card Hover (3D Tilt)
```typescript
const Card3D = ({ children }) => {
  const ref = useRef()
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setRotateY(x * 15)
    setRotateX(-y * 15)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setRotateX(0); setRotateY(0) }}
      style={{
        perspective: 1000,
        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: "transform 0.15s ease-out"
      }}
    >
      {children}
    </motion.div>
  )
}
```

---

## Special Effects

### Gradient Text
```css
.gradient-text {
  background: linear-gradient(135deg, #004225 0%, #C9A227 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Glassmorphism Card
```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
}
```

### Glow Effect
```css
.glow-brg {
  box-shadow: 0 0 40px rgba(0, 66, 37, 0.15);
}
.glow-gold {
  box-shadow: 0 0 30px rgba(201, 162, 39, 0.2);
}
```

### Noise Texture Overlay
```css
.noise-overlay::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* base64 noise */
  opacity: 0.03;
  pointer-events: none;
  z-index: 1;
}
```

---

## Animation Timing Reference

| Animation | Duration | Easing | Delay |
|-----------|----------|--------|-------|
| Hero text chars | 600ms | ease-out-expo | 30ms stagger |
| Section fade-up | 800ms | ease-out-expo | 0ms |
| Card hover tilt | 150ms | ease-out | 0ms |
| Nav show/hide | 300ms | ease-smooth | 0ms |
| Modal open | 400ms | spring (stiffness: 300) | 0ms |
| Timeline draw | Scroll-linked | linear | 0ms |
| Particle drift | Continuous | sine | random |
| Stats counter | 2000ms | ease-out-expo | 200ms |
| Button magnetic | Continuous | lerp(0.15) | 0ms |
| Page transition | 600ms | ease-smooth | 0ms |

---

## Reduced Motion
```typescript
const prefersReducedMotion = 
  typeof window !== "undefined" && 
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

// Disable 3D rotation, use simple fades
// Disable parallax
// Instant transitions instead of animated
// Static particles instead of moving
```
