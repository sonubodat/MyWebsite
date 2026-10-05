// Single source of truth for / and /resume. Facts from resume.html + index.html; add nothing unverified.

export const SITE_URL = "https://sonubodat.dpdns.org";

export const profile = {
  name: "Sonu Bodat",
  title: "Full-Stack & Mobile Software Engineer",
  role: "Founder & Product Engineer",
  heroTitle: "Founder, Triviq · Product Engineer",
  tagline:
    "I build production software across mobile, web and backend systems — through Triviq, my own products and selected freelance work.",
  heroCorners: [
    { n: "01", label: "Projects", note: "selected builds", href: "#projects" },
    { n: "02", label: "Experience", note: "streefi · brainybeams", href: "#experience" },
    { n: "03", label: "About", note: "profile", href: "#about" },
    { n: "04", label: "Contact", note: "say hello", href: "#contact" },
  ],
  heroStrip: ["Triviq", "Mobile", "Web", "SaaS", "Systems"],
  heroLocation: "Gandhinagar, India",
  heroStatus: "Available for select projects",
  summary:
    "Founder of Triviq, an independent product and engineering studio. Full-Stack & Mobile Software Engineer with production experience shipping web and React Native applications, including the Streefi food-tech platform. Skilled across frontend, backend APIs, cloud infrastructure, payments, authentication, analytics, deep linking, and third-party integrations, with a strong background in Next.js, React, React Native, Node.js, AWS, DynamoDB, and Supabase — and a track record of taking products from development through production.",
  about: [
    "I work across frontend, backend APIs, cloud infrastructure, payments, authentication, analytics, and third-party integrations.",
    "Core stack: React Native, Next.js, TypeScript, Node.js, AWS, DynamoDB, Supabase, Redis, and Vercel.",
  ],
  statement: "I build products from interface to infrastructure.",
  domains: ["Mobile", "Web", "Backend", "Cloud", "Product systems"],
  aboutLede:
    "Full-Stack & Mobile Software Engineer building and shipping production web and React Native products.",
  stats: [
    { value: "2+", label: "Years experience" },
    { value: "4", label: "Platforms shipped" },
    { value: "2", label: "Research papers" },
    { value: "10+", label: "Cloud services" },
  ],
  contactBlurb:
    "Open to product engineering, full-stack development, and technical co-founder roles. Whether it is a startup idea or a scaling challenge, I like conversations that turn the ambiguous part into a first clear move.",
};

export const contact = {
  email: "sonubodat77@gmail.com",
  linkedin: { label: "sonu-bodat", href: "https://www.linkedin.com/in/sonu-bodat" },
  github: { label: "sonubodat", href: "https://github.com/sonubodat" },
  portfolio: SITE_URL,
  resumePdf: "/sonu-bodat-resume.pdf",
};

export type Role = {
  company: string; role: string; location: string; start?: string; end?: string; type: string;
  highlights: string[]; details: string[]; tags: string[];
};

/** "Feb 2025 — Present" or "" when no dates are on record (Triviq / freelance: none invented). */
export const span = (x: { start?: string; end?: string }, sep = " — ") => [x.start, x.end].filter(Boolean).join(sep);

export const experience: Role[] = [
  {
    company: "Triviq",
    role: "Founder & Product Engineer",
    location: "",
    type: "Studio",
    highlights: [
      "Independent product and engineering studio building web, mobile, SaaS and custom software for clients while developing products internally.",
      "Services: web and platforms, mobile apps, SaaS products, AI and automation, business software, games and interactive experiences.",
      "Delivered work includes the Streefi platform and an anonymised QR referral and lead-attribution platform.",
    ],
    details: [
      "Independent product and engineering studio building web, mobile, SaaS and custom software for clients while developing products internally.",
      "Services: web and platforms, mobile apps, SaaS products, AI and automation, business software, games and interactive experiences.",
      "Delivered work includes the Streefi platform and an anonymised QR referral and lead-attribution platform.",
    ],
    tags: ["Next.js", "Flutter", "React Native", "FastAPI", "Supabase"],
  },
  {
    company: "Streefi Private Limited",
    role: "Co-Founder & Product Engineer",
    location: "Gandhinagar, Gujarat",
    start: "Feb 2025",
    end: "Present",
    type: "Full-time",
    highlights: [
      "Architected a multi-platform food-tech ecosystem across React Native, Next.js, vendor, and admin products.",
      "Built payment, OTP, social auth, QR/deep linking, analytics, attribution, and WhatsApp systems.",
      "Designed production infrastructure across AWS, Vercel, Cloudflare, Supabase, and Redis.",
    ],
    details: [
      "Architected and built Streefi across React Native, Next.js, and backend APIs, spanning the customer app, web platform, vendor application, and admin systems.",
      "Built production integrations for Razorpay payments, UPI app detection, authentication, QR/deep linking, OTP, Google/Facebook login, analytics, and marketing attribution.",
      "Designed cloud infrastructure using AWS (DynamoDB, S3, CloudFront, Lambda, Amplify, Secrets Manager, EC2), alongside Vercel, Cloudflare, Supabase, and Redis.",
      "Implemented Meta Developer and WhatsApp Cloud API systems, including automated messaging workflows, campaign tooling, and Meta Conversions API tracking.",
      "Developed growth infrastructure covering Google Analytics, Mixpanel, Microsoft Clarity, app-install attribution, campaign/source tracking, SEO, and search indexing.",
      "Built and maintained the Streefi website with Next.js, React, and TypeScript, including 3D/interactive experiences, CDN-backed assets, and production deployment.",
    ],
    tags: ["React Native", "Next.js", "AWS", "Razorpay"],
  },
  {
    company: "BrainyBeams Technology",
    role: "Native App Developer",
    location: "Ahmedabad, Gujarat",
    start: "Nov 2024",
    end: "Apr 2025",
    type: "Full-time",
    highlights: [
      "Developed mobile application features with API integrations, application state, authentication, and production debugging.",
      "Implemented reusable interfaces and resolved device-specific issues across API-connected workflows.",
    ],
    details: [
      "Developed and maintained native/mobile application features, working with API integrations, application state, authentication, and production debugging.",
      "Implemented reusable mobile interfaces and integrated backend services while troubleshooting device-specific and production issues.",
      "Worked across application development and API-connected workflows, contributing to feature implementation and maintenance.",
    ],
    tags: ["React Native", "REST APIs", "Auth"],
  },
  {
    company: "Independent / Freelance",
    role: "Selected client work",
    location: "",
    type: "Independent",
    highlights: [
      "Selected product builds, mobile applications, SaaS, custom business systems and interactive web experiences.",
      "Direct engagements or through Triviq.",
    ],
    details: [
      "Selected product builds, mobile applications, SaaS, custom business systems and interactive web experiences. Direct engagements or through Triviq.",
    ],
    tags: [],
  },
];

export const achievements = [
  {
    title: "Co-Founded and Engineered Streefi",
    text: "Built and shipped a multi-platform food discovery product spanning React Native, Next.js, vendor systems, admin infrastructure, and backend APIs, taken from architecture through production deployment.",
  },
  {
    title: "Published IEEE Research Paper",
    text: "Sole author of “AES-Driven Image Encryption: Overcoming Security and Transmission Challenges,” published in the proceedings of the 2024 IEEE Delhi Section Flagship Conference (DELCON).",
  },
  {
    title: "Built Production Payment Infrastructure",
    text: "Implemented Razorpay custom UI, UPI intent/app detection, payment verification, dynamic QR flows, and payment-related analytics, including device-specific payment behavior handling.",
  },
  {
    title: "Engineered End-to-End Cloud Infrastructure",
    text: "Designed and deployed production services across AWS, Vercel, Supabase, and Cloudflare, using DynamoDB, S3, CloudFront, Lambda, Amplify, EC2, and Secrets Manager for storage, compute, deployment, and asset delivery.",
  },
  {
    title: "Built Growth, Attribution, and Communication Infrastructure",
    text: "Implemented Meta App Install and Conversion tracking, Conversions API, Google Analytics, Clarity, campaign attribution, deep linking, QR-based acquisition tracking, WhatsApp Cloud API, and automated email/authentication integrations.",
  },
];

type Media = { src: string; alt: string; w: number; h: number };
const none: Media[] = [];
type Link = { label: string; href: string };

// Facts: Untold + Tap & Tap from their repos; QR + Streefi from Triviq's content.ts; Streefi Web from the resume.
export const projects = [
  {
    slug: "untold",
    kicker: "Own Product",
    category: "product",
    title: "Untold",
    summary: "A safe space to talk, freely and anonymously: mental-health support for iOS and Android.",
    role: "Product engineering",
    bullets: [
      "Flutter app for iOS and Android: mood check-ins, journaling, premium tier",
      "FastAPI backend with Supabase data under row-level security",
      "Optional Firebase sign-in (Google, Apple) that only buys sync",
      "RevenueCat subscriptions with remote-config keys",
    ],
    stack: "Flutter · FastAPI · Supabase · Firebase · RevenueCat",
    note: "In development",
    link: undefined as Link | undefined,
    diagram: undefined as "qr-flow" | undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: [
      { src: "/projects/untold-home.webp", alt: "Untold app: home screen with mood check-in", w: 554, h: 1174 },
      { src: "/projects/untold-journal.webp", alt: "Untold app: journal screen with new entry prompt", w: 554, h: 1174 },
      { src: "/projects/untold-profile.webp", alt: "Untold app: profile screen with premium and therapy sections", w: 554, h: 1174 },
    ] as Media[],
  },
  {
    slug: "streefi-platform",
    kicker: "Full-Stack Product",
    category: "product",
    title: "Streefi Platform",
    summary:
      "Co-built the food-tech platform end to end, from customer discovery to vendor operations, across four production surfaces.",
    role: "Co-Founder & Product Engineer",
    bullets: [
      "Multi-platform React Native customer & vendor apps",
      "Payments, UPI intent detection, QR & deep linking",
      "Node.js backend and AWS infrastructure",
      "Admin analytics, attribution & WhatsApp automation",
    ],
    stack: "React Native · Next.js · Node.js · AWS · Razorpay",
    note: "Private build",
    link: undefined,
    diagram: undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: [
      { src: "/projects/streefi-explore.webp", alt: "Streefi app: explore screen with categories and night-cravings vendors", w: 720, h: 1565 },
      { src: "/projects/streefi-map.webp", alt: "Streefi app: live map of street-food vendors around Gandhinagar", w: 720, h: 1565 },
      { src: "/projects/streefi-deals.webp", alt: "Streefi app: eat-out deals screen with featured vendor offer", w: 720, h: 1565 },
    ] as Media[],
  },
  {
    slug: "qr-referral-platform",
    kicker: "Client Work · Anonymised",
    category: "product",
    title: "QR Referral & Lead-Attribution Platform",
    summary:
      "Vendor referral tracking for an energy business: every physical QR scan and referral traced to the right vendor and lead at the moment it happens.",
    role: "Product engineering",
    bullets: [
      "Controlled QR inventory with assignment history",
      "Vendor self-registration with sales-assisted verification",
      "Public enquiry form behind each QR link, with scan and lead attribution",
      "Repeat-referral detection and admin-managed payout status",
    ],
    stack: "React · Node.js · Prisma · Postgres",
    note: "Client unnamed",
    link: undefined,
    diagram: "qr-flow" as "qr-flow" | undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: none,
  },
  {
    slug: "streefi-web",
    kicker: "Web",
    category: "product",
    title: "Streefi Web",
    summary:
      "The Streefi website: a Next.js marketing and discovery site with 3D and interactive experiences and CDN-backed assets.",
    role: "Co-Founder & Product Engineer",
    bullets: [
      "Next.js, React and TypeScript",
      "3D / interactive experiences",
      "Headless CMS content",
      "CDN-backed assets and production deployment",
    ],
    stack: "Next.js · React · TypeScript · Three.js",
    note: "Live",
    link: { label: "streefi.in ↗", href: "https://streefi.in" } as Link | undefined,
    diagram: undefined,
    mediaKind: "wide" as "phones" | "wide",
    media: [
      { src: "/projects/streefi-web-hero.webp", alt: "Streefi website: hero with the headline \"Find any street food stall near you\" and app download buttons", w: 1280, h: 800 },
      { src: "/projects/streefi-web-story.webp", alt: "Streefi website: \"Never miss your favorite stall again\" section", w: 1280, h: 800 },
      { src: "/projects/streefi-web-steps.webp", alt: "Streefi website: three-step \"Easy as 1-2-3\" section", w: 1280, h: 800 },
    ] as Media[],
  },
  {
    slug: "tap-and-tap",
    kicker: "Realtime Game",
    category: "product",
    title: "Tap & Tap",
    summary: "A 10-second competitive arcade where anyone can challenge anyone.",
    role: "Product engineering",
    bullets: [
      "Flutter client (Flame, Riverpod) with live 1v1 tap battles, reconnection and rematch",
      "Node.js + Fastify backend with REST and WebSocket",
      "PostgreSQL (Supabase) via Prisma; Redis for matchmaking, rate limits and leaderboards",
      "Timing-based anti-cheat scoring (detection only)",
    ],
    stack: "Flutter · Flame · Node.js · Fastify · Prisma · PostgreSQL · Redis",
    note: "Core prototype",
    link: undefined,
    diagram: undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: [{ src: "/projects/tapntap-home.webp", alt: "Tap & Tap app: home screen with 1v1 tap battle card", w: 720, h: 1565 }] as Media[],
  },
  {
    slug: "triviq-site",
    kicker: "Studio Site",
    category: "product",
    title: "Triviq Studio Site",
    summary: "The site for Triviq: static-first and performance-minded, with a WebGL hero that loads only where it can run well.",
    role: "Founder & Product Engineer",
    bullets: [
      "Next.js 16 App Router and Tailwind v4",
      "Static SVG hero first; WebGL scene lazy-loaded on capable tablet and desktop browsers",
      "Content-driven sections and a validated contact API (honeypot, rate limit)",
      "GSAP and React Three Fiber",
    ],
    stack: "Next.js · Tailwind · GSAP · Three.js",
    note: "In development",
    link: undefined,
    diagram: undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: none,
  },
  {
    slug: "aes-image-encryption",
    kicker: "Research / Security",
    category: "research",
    title: "AES-Driven Image Encryption",
    summary:
      "An AES-based image encryption technique addressing security and transmission efficiency in digital image communication.",
    role: "Sole author",
    bullets: ["Security analysis against common attacks", "Transmission efficiency optimization", "Comparative performance evaluation"],
    stack: "Python · OpenCV · MATLAB",
    note: undefined,
    diagram: undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: none,
    link: { label: "IEEE DOI ↗", href: "https://doi.org/10.1109/DELCON64804.2024.10866928" } as Link | undefined,
  },
  {
    slug: "image-flare",
    kicker: "EdTech / Research",
    category: "research",
    title: "Image Flare",
    summary:
      "An interactive image-processing learning platform with real-time filters, restoration, histograms, and comparative visualization.",
    role: "Co-author",
    bullets: ["Interactive image processing workflows", "Behavioral study integration", "Clear visual feedback for learning"],
    stack: "Python · NumPy · Matplotlib",
    note: undefined,
    diagram: undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: none,
    link: { label: "Springer DOI ↗", href: "https://doi.org/10.1007/s11042-026-21469-2" } as Link | undefined,
  },
];

/** QR platform flow (from Triviq's case study): four role-based experiences over one API. */
export const qrFlow = [
  { step: "QR inventory", note: "Controlled stock with assignment history", who: "Admin" },
  { step: "Vendor", note: "Self-registration with sales-assisted verification", who: "Vendor · Sales" },
  { step: "Customer scan", note: "Every physical QR scan is recorded", who: "Public" },
  { step: "Public enquiry", note: "The form behind each QR link", who: "Public" },
  { step: "Lead & attribution", note: "Scan and lead traced to the right vendor", who: "System" },
  { step: "Repeat detection", note: "Repeat referrals are caught", who: "System" },
  { step: "Payout status", note: "Admin-managed payout state", who: "Admin" },
];
export const qrRoles = ["Public", "Vendor", "Sales", "Admin"];

/** Motion graphics for Untold (beginner work). No tool is credited: the exports don't say which one made them. */
export const motion = [
  { slug: "status-check", title: "Quick status check", dur: "0:12" },
  { slug: "investigation", title: "My brain opened an investigation", dur: "0:12" },
  { slug: "typed-it-out", title: "I typed it out", dur: "0:12" },
  { slug: "no-need-to-say", title: "You don't need to know what to say", dur: "0:12" },
  { slug: "never-told", title: "Things I've never told anyone", dur: "0:13" },
  { slug: "rehearse", title: "Rehearsing conversations", dur: "0:13" },
  { slug: "so-much-on-your-mind", title: "So much on your mind", dur: "0:09" },
];

// Only items already published in competencies / experience / projects above. No levels, no percentages.
export const capabilities = [
  {
    n: "01",
    title: "Product & Frontend",
    items: ["React.js", "Next.js", "React Native", "Flutter", "TypeScript", "JavaScript", "Tailwind CSS", "HTML5", "CSS3", "GSAP (beginner)", "Three.js (beginner)", "React Three Fiber", "Motion graphics (beginner)"],
  },
  {
    n: "02",
    title: "Backend & Systems",
    items: ["Node.js", "Fastify", "FastAPI", "REST APIs", "WebSockets", "Authentication & Authorization", "OAuth (Google & Facebook)", "Razorpay & UPI payments", "WhatsApp Cloud API", "Deep Linking"],
  },
  {
    n: "03",
    title: "Data & Cloud",
    items: ["DynamoDB", "Supabase PostgreSQL", "PostgreSQL & Prisma", "SQL", "Redis", "Firebase", "AWS Lambda", "S3", "CloudFront", "Amplify", "EC2", "Secrets Manager", "Cloudflare", "Vercel"],
  },
  {
    n: "04",
    title: "Product Engineering",
    items: ["Technical product development", "Vendor platform architecture", "Mobile app publishing", "Subscriptions (RevenueCat)", "Analytics & attribution", "Google Analytics 4", "Microsoft Clarity", "Mixpanel", "Meta Developer Platform", "SEO"],
  },
];

export const skillsIntro =
  "My work lives at the intersection of interfaces, infrastructure, product decisions, and the operational details that make software survive contact with the real world.";

export const competencies =
  "React.js · Next.js · React Native · TypeScript · JavaScript · Flutter · Three.js (beginner) · React Three Fiber · GSAP (beginner) · Motion graphics (beginner) · Tailwind CSS · HTML5 · CSS3 · Node.js · Fastify · FastAPI · WebSockets · REST APIs · Authentication & Authorization · WhatsApp Cloud API · Google Analytics 4 · Microsoft Clarity · App Attribution Tracking · Deep Linking · SEO Optimization · DynamoDB · Supabase PostgreSQL · PostgreSQL & Prisma · SQL · Redis · Firebase · RevenueCat · Technical Product Development · Mobile App Publishing · Vendor Platform Architecture · Payment Systems · Marketing Technology Integration · Meta Ads Technical Setup · Meta Developer Platform · Razorpay Integration · OAuth (Google & Facebook Login) · AWS Lambda · AWS S3 · AWS CloudFront · AWS Amplify · AWS EC2 · AWS Secrets Manager · Cloudflare · Vercel";

export const research = [
  {
    venue: "IEEE DELCON 2024 · NEW DELHI",
    resumeVenue: "IEEE Delhi Section Flagship Conference (DELCON 2024) · Sole Author · New Delhi, India · Nov. 2024",
    title: "AES-Driven Image Encryption: Overcoming Security and Transmission Challenges",
    summary:
      "Developed an AES-based image encryption technique addressing security and transmission efficiency, enhancing traditional AES for image data.",
    resumeSummary:
      "Developed an AES-based image encryption technique addressing security and transmission efficiency.",
    doi: "10.1109/DELCON64804.2024.10866928",
    projectSlug: "aes-image-encryption",
  },
  {
    venue: "MULTIMEDIA TOOLS AND APPLICATIONS · SPRINGER",
    resumeVenue: "Multimedia Tools and Applications — Springer · Co-author · Research & Software Development",
    role: "Co-author · Research & Software Development",
    title: "Image Flare: An Interactive and Dynamic Learning Platform for Intuitive Image Processing",
    summary:
      "Developed an interactive image-processing learning platform with real-time filtering, restoration, histogram analysis, and comparative visualization.",
    resumeSummary:
      "Developed an interactive image-processing learning platform with real-time filtering, restoration, histogram analysis, image enhancement, and comparative visualization, supported by a behavioral study evaluating its educational impact.",
    doi: "10.1007/s11042-026-21469-2",
    projectSlug: "image-flare",
  },
];

export const education = [
  {
    years: "2021 - 2025",
    school: "Pandit Deendayal Energy University (PDEU)",
    shortSchool: "Pandit Deendayal Energy University",
    degree: "B.Tech. in Computer Science & Engineering",
    place: "Gujarat",
    score: "CGPA: 8.01",
  },
  {
    years: "2021",
    school: "Parth Institute",
    degree: "Higher Secondary (11th-12th)",
    place: "Vadodara, Gujarat",
    score: "81.5%",
  },
  {
    years: "2019",
    school: "Alembic School",
    degree: "Secondary Education (1st-10th)",
    place: "Vadodara, Gujarat",
    score: "78%",
  },
];

export const navLinks = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "motion", label: "Motion" },
  { id: "publications", label: "Research" },
  { id: "education", label: "Education" },
];

/** "Feb 2025 - Present" → "Feb 2025 — Present" for the site; resume keeps plain hyphen. */
export const em = (s: string) => s.replace(/ - /g, " — ").replace(/-/g, "–");
