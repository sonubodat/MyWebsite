// Single source of truth for / and /resume. Facts from resume.html + index.html; add nothing unverified.

export const SITE_URL = "https://sonubodat.dpdns.org";

export const profile = {
  name: "Sonu Bodat",
  title: "Full-Stack & Mobile Software Engineer",
  role: "Product Engineer",
  heroTitle: "Product Engineer · Co-Founder, Streefi",
  tagline: "Full-stack and mobile engineer. I ship React Native, Next.js and Node.js products from idea to production.",
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
    "Full-Stack & Mobile Software Engineer with production experience shipping web and React Native applications, including the Streefi food-tech platform. Skilled across frontend, backend APIs, cloud infrastructure, payments, authentication, analytics, deep linking, and third-party integrations, with a strong background in Next.js, React, React Native, Node.js, AWS, DynamoDB, and Supabase — and a track record of taking products from development through production.",
  about: [
    "What I do: frontend, backend APIs, cloud, payments and authentication.",
    "Core stack: React Native, Next.js, TypeScript, Node.js, AWS, DynamoDB, Supabase, Redis.",
  ],
  statement: "I build products from interface to infrastructure.",
  domains: ["Mobile", "Web", "Backend", "Cloud", "Product systems"],
  aboutLede: "Full-stack and mobile engineer shipping production web and React Native apps.",
  stats: [
    { value: "2+", label: "Years experience" },
    { value: "4", label: "Platforms shipped" },
    { value: "2", label: "Research papers" },
    { value: "10+", label: "Cloud services" },
  ],
  contactBlurb: "Open to full-stack, product engineering and mobile engineering roles, and to select projects.",
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
  highlights: string[]; brief: string[]; details: string[]; tags: string[];
};

/** "Feb 2025 — Present" or "" when no dates are on record (Triviq / freelance: none invented). */
export const span = (x: { start?: string; end?: string }, sep = " — ") => [x.start, x.end].filter(Boolean).join(sep);

export const experience: Role[] = [
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
    brief: [
      "Own the product end to end: customer app, vendor app, web and admin.",
      "Built payments (Razorpay), auth, OTP, QR/deep linking and WhatsApp messaging.",
      "Set up the cloud: AWS, Supabase, Redis, Vercel, Cloudflare.",
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
    role: "Junior Mobile App Developer",
    location: "Ahmedabad, Gujarat",
    start: "Nov 2024",
    end: "Apr 2025",
    type: "Internship",
    highlights: [
      "Built Happy Happenings, a wedding planner mobile app in JavaScript, as an internship project.",
      "Worked on API integrations and authentication, and fixed device-specific issues.",
    ],
    brief: [
      "Built Happy Happenings, a wedding planner mobile app in JavaScript.",
      "Handled API integration, authentication and device-specific bug fixes.",
    ],
    details: [
      "Built Happy Happenings, a wedding planner mobile app in JavaScript, as an internship project.",
      "Worked on API integrations and authentication, and fixed device-specific issues.",
    ],
    tags: ["JavaScript", "REST APIs", "Auth"],
  },
  {
    company: "Triviq · Independent / Freelance",
    role: "Independent Product Engineer",
    location: "",
    type: "Studio and independent",
    highlights: [
      "Triviq is an independent product and engineering studio building web, mobile, SaaS and custom software for clients while developing products internally.",
      "Services: web and platforms, mobile apps, SaaS products, AI and automation, business software, games and interactive experiences.",
      "Delivered work includes the Streefi platform and an anonymised QR referral and lead-attribution platform.",
      "Also available for selected product builds, mobile applications, SaaS, custom business systems and interactive web experiences, directly or through Triviq.",
    ],
    brief: [
      "Independent studio: web, mobile and SaaS builds for clients and for our own products.",
      "Delivered the Streefi platform and a QR referral platform (client anonymised).",
    ],
    details: [
      "Triviq is an independent product and engineering studio building web, mobile, SaaS and custom software for clients while developing products internally.",
      "Services: web and platforms, mobile apps, SaaS products, AI and automation, business software, games and interactive experiences.",
      "Delivered work includes the Streefi platform and an anonymised QR referral and lead-attribution platform.",
      "Also takes on selected freelance work (product builds, mobile applications, SaaS, custom business systems and interactive web experiences), directly or through Triviq.",
    ],
    tags: ["Next.js", "Flutter", "React Native", "FastAPI", "Supabase"],
  },
];

export const achievements = [
  {
    title: "Co-Founded and Engineered Streefi",
    text: "Built and shipped a multi-platform food discovery product spanning React Native, Next.js, vendor systems, admin infrastructure, and backend APIs, taken from architecture through production deployment.",
  },
  {
    title: "Published IEEE Research Paper",
    text: "Co-author of “AES-Driven Image Encryption: Overcoming Security and Transmission Challenges,” published in the proceedings of the 2024 IEEE Delhi Section Flagship Conference (DELCON).",
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
    summary: "Anonymous mental-health support app for iOS and Android.",
    role: "Product engineering",
    bullets: [
      "Flutter app: mood check-ins, journaling, premium tier",
      "FastAPI backend with Supabase (row-level security)",
      "RevenueCat subscriptions",
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
    summary: "Street-food discovery platform: customer app, vendor app, web and admin.",
    role: "Co-Founder & Product Engineer",
    bullets: [
      "React Native customer and vendor apps",
      "Razorpay payments, UPI intent, QR and deep linking",
      "Node.js backend on AWS",
      "Admin analytics and WhatsApp automation",
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
    summary: "Traces every QR scan and referral to the right vendor and lead, for an energy business.",
    role: "Product engineering",
    bullets: [
      "QR inventory with assignment history",
      "Vendor sign-up with sales verification",
      "Scan and lead attribution, repeat-referral detection, payout status",
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
    summary: "Streefi's Next.js website with 3D and interactive sections.",
    role: "Co-Founder & Product Engineer",
    bullets: [
      "Next.js, React, TypeScript",
      "3D / interactive sections, CDN-backed assets",
      "Headless CMS content",
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
    summary: "Realtime 1v1 tap-battle game with 10-second matches.",
    role: "Product engineering",
    bullets: [
      "Flutter client: live 1v1 battles, reconnect, rematch, daily quests, coin shop",
      "Node.js + Fastify backend (REST, WebSocket)",
      "Redis matchmaking and leaderboards; Postgres via Prisma",
      "Anti-cheat timing checks (detection only)",
    ],
    stack: "Flutter · Flame · Node.js · Fastify · Prisma · PostgreSQL · Redis",
    note: "Core prototype",
    link: undefined,
    diagram: undefined,
    mediaKind: "phones" as "phones" | "wide",
    media: [
      { src: "/projects/tapntap-app-home.webp", alt: "Tap & Tap app: home screen with 1v1 play, practice, 2P local and ranks", w: 720, h: 1559 },
      { src: "/projects/tapntap-app-ranks.webp", alt: "Tap & Tap app: Top Tappers leaderboard", w: 720, h: 1559 },
      { src: "/projects/tapntap-app-shop.webp", alt: "Tap & Tap app: coin shop with power-ups", w: 720, h: 1559 },
    ] as Media[],
  },
  {
    slug: "triviq-site",
    kicker: "Studio Site",
    category: "product",
    title: "Triviq Studio Site",
    summary: "Studio site with a WebGL hero that loads only where it runs well.",
    role: "Product Engineer",
    bullets: [
      "Next.js 16 App Router, Tailwind v4",
      "Static SVG hero first; WebGL lazy-loaded on capable devices",
      "Validated contact API (honeypot, rate limit)",
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
    summary: "AES-based image encryption for secure, efficient image transmission.",
    role: "Co-author",
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
    summary: "Interactive image-processing learning platform: real-time filters, restoration, histograms.",
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
  { slug: "okay-investigation", title: "One “okay.”", dur: "0:12" },
];

// Only items already published in competencies / experience / projects above. No levels, no percentages.
export const capabilities = [
  {
    n: "01",
    title: "Frontend & Mobile",
    items: ["React.js", "Next.js", "React Native", "Flutter", "TypeScript", "JavaScript", "Tailwind CSS", "HTML5 · CSS3", "GSAP · Three.js (beginner)"],
  },
  {
    n: "02",
    title: "Backend",
    items: ["Node.js", "FastAPI", "REST APIs", "WebSockets", "Auth & OAuth", "Razorpay & UPI", "WhatsApp Cloud API"],
  },
  {
    n: "03",
    title: "Data & Cloud",
    items: ["PostgreSQL · Prisma", "Supabase", "DynamoDB", "Redis", "Firebase", "AWS (Lambda, S3, CloudFront, EC2)", "Cloudflare", "Vercel"],
  },
  {
    n: "04",
    title: "Product",
    items: ["Product development", "Mobile app publishing", "Subscriptions (RevenueCat)", "Analytics & attribution", "SEO"],
  },
];

export const skillsIntro = "Tools I use in production.";

export const competencies =
  "React.js · Next.js · React Native · TypeScript · JavaScript · Flutter · Three.js (beginner) · React Three Fiber · GSAP (beginner) · Motion graphics (beginner) · Tailwind CSS · HTML5 · CSS3 · Node.js · Fastify · FastAPI · WebSockets · REST APIs · Authentication & Authorization · WhatsApp Cloud API · Google Analytics 4 · Microsoft Clarity · App Attribution Tracking · Deep Linking · SEO Optimization · DynamoDB · Supabase PostgreSQL · PostgreSQL & Prisma · SQL · Redis · Firebase · RevenueCat · Technical Product Development · Mobile App Publishing · Vendor Platform Architecture · Payment Systems · Marketing Technology Integration · Meta Ads Technical Setup · Meta Developer Platform · Razorpay Integration · OAuth (Google & Facebook Login) · AWS Lambda · AWS S3 · AWS CloudFront · AWS Amplify · AWS EC2 · AWS Secrets Manager · Cloudflare · Vercel";

// Unlisted role resumes (/resume-1..4). Order is code-only: 1 full-stack, 2 React Native, 3 frontend, 4 backend.
// Every skill and bullet below is a subset or reordering of facts already in this file; nothing new is claimed.
const skill = {
  Languages: ["JavaScript", "TypeScript", "SQL"],
  Frontend: ["React.js", "Next.js", "HTML5", "CSS3", "Tailwind CSS"],
  Mobile: ["React Native"],
  Backend: ["Node.js", "REST APIs", "Authentication & Authorization"],
  "Databases & Cloud": ["PostgreSQL", "Supabase", "DynamoDB", "Redis", "AWS"],
  Integrations: ["Razorpay", "WhatsApp Cloud API", "OAuth", "QR & Deep Linking"],
};
const skills = (...order: (keyof typeof skill)[]) => order.map((label) => ({ label, items: skill[label] }));

export const variantStreefiRole = "Product Engineer";

export const resumeVariants: { summary: string; skills: { label: string; items: string[] }[]; streefi: string[] }[] = [
  {
    summary:
      "Full-Stack & Mobile Software Engineer with production experience shipping web and React Native applications, including the Streefi food-tech platform. Works across frontend, backend APIs, cloud infrastructure, payments, and authentication with React, Next.js, React Native, Node.js, AWS, and Supabase, taking products from development through production.",
    skills: skills("Languages", "Frontend", "Mobile", "Backend", "Databases & Cloud", "Integrations"),
    streefi: [
      "Architected a multi-platform food-tech ecosystem across React Native, Next.js, vendor, and admin products.",
      "Built payment, OTP, social auth, QR/deep linking, and WhatsApp systems.",
      "Designed and maintained cloud infrastructure and database integrations supporting the deployment and operation of customer, vendor, and admin applications.",
    ],
  },
  {
    summary:
      "Software Engineer shipping production React Native applications, including the customer app for the Streefi food-tech platform. Experienced with authentication, payments, deep linking, and API integration, and with debugging device-specific issues in production.",
    skills: skills("Mobile", "Languages", "Backend", "Integrations", "Databases & Cloud", "Frontend"),
    streefi: [
      "Architected and built the Streefi customer app in React Native, alongside the Next.js web platform, vendor application, and admin systems.",
      "Built Razorpay payments with UPI app detection, authentication, OTP, Google/Facebook login, and QR/deep linking.",
      "Handled payment verification and device-specific payment behavior in production.",
    ],
  },
  {
    summary:
      "Software Engineer building production interfaces in React, Next.js, and TypeScript, including the Streefi web platform and customer applications. Comfortable integrating backend APIs, authentication, and payments into user interfaces.",
    skills: skills("Frontend", "Languages", "Mobile", "Backend", "Integrations", "Databases & Cloud"),
    streefi: [
      "Architected and built the Streefi customer app, web platform, vendor application, and admin systems across React Native and Next.js.",
      "Built and maintained the Streefi website with Next.js, React, and TypeScript, including interactive experiences and CDN-backed assets.",
      "Integrated payments, OTP, social login, and QR/deep linking into the product's user flows.",
    ],
  },
  {
    summary:
      "Software Engineer building production backend systems and APIs in Node.js on AWS, DynamoDB, Supabase, and Redis, including the Streefi food-tech platform. Experienced with authentication, payment and third-party integrations, and cloud infrastructure.",
    skills: skills("Backend", "Databases & Cloud", "Integrations", "Languages", "Frontend", "Mobile"),
    streefi: [
      "Designed and maintained cloud infrastructure and database integrations supporting the deployment and operation of customer, vendor, and admin applications.",
      "Built production integrations for Razorpay payments, authentication, OTP, Google/Facebook login, QR/deep linking, and WhatsApp Cloud API.",
      "Built backend APIs behind the Streefi customer app, web platform, vendor application, and admin systems.",
    ],
  },
];

export const research = [
  {
    venue: "IEEE DELCON 2024 · NEW DELHI",
    resumeVenue: "IEEE Delhi Section Flagship Conference (DELCON 2024) · Co-author · Nov. 2024",
    title: "AES-Driven Image Encryption: Overcoming Security and Transmission Challenges",
    summary: "AES-based image encryption for secure, efficient image transmission.",
    resumeSummary:
      "Developed an AES-based image encryption technique addressing security and transmission efficiency.",
    doi: "10.1109/DELCON64804.2024.10866928",
    projectSlug: "aes-image-encryption",
  },
  {
    venue: "MULTIMEDIA TOOLS AND APPLICATIONS · SPRINGER",
    resumeVenue: "Multimedia Tools and Applications — Springer · Co-author",
    role: "Co-author · Research & Software Development",
    title: "Image Flare: An Interactive and Dynamic Learning Platform for Intuitive Image Processing",
    summary: "Interactive image-processing learning platform with real-time filters, restoration and histograms.",
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
