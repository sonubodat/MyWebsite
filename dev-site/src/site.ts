// The one file to edit for publisher details and apps.
// The contact address comes from CONTACT_EMAIL (environment or .env file), see .env.example.
try { process.loadEnvFile(); } catch { /* no .env file */ }

export const site = {
  publisher: 'Sonu Bodat',
  email: process.env.CONTACT_EMAIL ?? '',
  country: 'India',
  // Set to the real address after the first deploy (or to your own domain later).
  url: 'https://mywebsite.sonu77bodat.workers.dev/dev',
};

// An app with `legal: true` needs a folder src/content/legal/<slug>/ (copy _template).
export const apps = [
  { slug: 'taptap', name: 'TapTap', legal: true, summary: 'Real-time 10-second tapping game for iOS and Android.' },
  { slug: 'untold', name: 'UNTOLD', legal: true, summary: 'Anonymous emotional support app: journal, AI listener, wall and peer chat.' },
  { slug: 'gymos', name: 'GymOS', legal: false, summary: 'Gym management web app. Built and handed over to its owner.' },
  { slug: 'solarium', name: 'Solarium', legal: false, summary: 'Customer, vendor, sales and admin platform for a green energy business. Handed over.' },
];
