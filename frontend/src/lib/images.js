// SchemeAI public image slot registry.
//
// Single source of truth for every image on the public website.
// Current `src` points at art-directed brand-gradient placeholders. To ship a
// commissioned photograph for a slot: drop the file into public/images/ and
// update `src` (+ `webp`/`avif` if you generate optimised variants). Nothing
// else needs to change — SmartImage reads everything from here.
//
// Fields:
//   src        served image path
//   webp/avif  optional optimised variants (rendered via <picture>)
//   ratio      intrinsic aspect ratio (CSS aspect-ratio value)
//   position   object-position for responsive cropping
//   overlay    readability overlay: 'left' | 'bottom' | null
//   alt        exact accessibility text (also reused by the spec sheet)
//   commission commissioning brief: scene, mood, subjects, environment, lighting

export const SLOTS = {
  'home-hero': {
    src: '/images/home-hero.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'right',
    overlay: null,
    alt: 'Indian citizens — a farmer, a young woman, a college student, an elderly citizen and a small business owner — using digital government services at a modern citizen service centre',
    commission: {
      page: 'Home',
      section: 'Hero',
      title: 'Home hero',
      scene:
        'Wide cinematic 16:9 photograph. A diverse group of ordinary Indian citizens using a modern digital citizen-service centre: a farmer, a young woman, a college student, an elderly citizen and a small business owner, naturally interacting with digital government services.',
      mood: 'Trust, accessibility, empowerment, public service',
      subjects: 'Farmer · young woman · college student · elderly citizen · small business owner',
      environment:
        'Modern Indian public-service centre with subtle civic architecture, clean service counters, computers and natural daylight.',
      lighting: 'Natural daylight, documentary realism',
      composition: 'People toward the RIGHT. Large clean negative space on the LEFT for headline, description and CTAs.',
    },
  },

  'about-hero': {
    src: '/images/about-hero.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'center',
    overlay: 'bottom',
    alt: 'Modern Indian public administration building with a landscaped entrance, citizens entering in early morning sunlight',
    commission: {
      page: 'About',
      section: 'Hero',
      title: 'About — hero',
      scene:
        'Sophisticated 16:9 photograph of a modern Indian public administration building, clean geometric structure, landscaped entrance, ordinary citizens naturally entering.',
      mood: 'Stability, transparency, trust, public service',
      subjects: 'Government institutional architecture · citizens entering',
      environment: 'Contemporary Indian government institutional architecture, landscaped entrance.',
      lighting: 'Early morning sunlight, symmetrical professional architectural photography',
      composition: 'Symmetrical. Warm ivory, forest green and subtle muted saffron grading.',
    },
  },

  'about-purpose': {
    src: '/images/about-purpose.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'left',
    overlay: null,
    alt: 'A family receiving assistance from a public-service facilitator who explains government welfare information on a laptop at a community service centre',
    commission: {
      page: 'About',
      section: 'Our purpose',
      title: 'About — our purpose',
      scene:
        'Realistic documentary photograph. Parents, a young adult and an elderly family member sit with a service facilitator who explains government welfare information using a laptop/tablet.',
      mood: 'Inclusion, accessibility, trust, human-centred government service',
      subjects: 'Parents · young adult · elderly family member · service facilitator',
      environment: 'Authentic Indian community service centre, natural human interaction.',
      lighting: 'Natural interior light, documentary realism',
      composition: 'People slightly toward the LEFT. Clean negative space toward the RIGHT for text.',
    },
  },

  'about-does-discover': {
    src: '/images/about-does-discover.png',
    webp: null,
    avif: null,
    ratio: '4 / 3',
    position: 'center',
    overlay: null,
    alt: 'Young Indian citizen discovering government scheme information on a smartphone',
    commission: {
      page: 'About',
      section: 'What SchemeAI does · Discover',
      title: 'Discover',
      scene:
        'Young Indian citizen discovering government scheme information using a smartphone.',
      mood: 'Discovery, opportunity',
      subjects: 'Young Indian citizen',
      environment: 'Public service centre / everyday Indian setting.',
      lighting: 'Same documentary style as the rest of the five-scene set',
      composition: 'One of five scenes photographed by the same professional government photographer — same lighting, lens style, colour grading and documentary realism.',
    },
  },

  'about-does-understand': {
    src: '/images/about-does-understand.png',
    webp: null,
    avif: null,
    ratio: '4 / 3',
    position: 'center',
    overlay: null,
    alt: 'Government service facilitator explaining eligibility requirements to an elderly citizen using a tablet',
    commission: {
      page: 'About',
      section: 'What SchemeAI does · Understand',
      title: 'Understand',
      scene:
        'Government service facilitator explaining eligibility requirements to an elderly citizen using a tablet.',
      mood: 'Clarity, patience',
      subjects: 'Service facilitator · elderly citizen',
      environment: 'Public service centre.',
      lighting: 'Same documentary style as the set',
      composition: 'Scene 2 of 5 — identical photography style across the set.',
    },
  },

  'about-does-prepare': {
    src: '/images/about-does-prepare.png',
    webp: null,
    avif: null,
    ratio: '4 / 3',
    position: 'center',
    overlay: null,
    alt: 'Indian citizen organising documents for a government application at a table',
    commission: {
      page: 'About',
      section: 'What SchemeAI does · Prepare',
      title: 'Prepare',
      scene: 'Indian citizen organising documents for a government application.',
      mood: 'Readiness, care',
      subjects: 'Indian citizen',
      environment: 'Home or service centre, documents on a table.',
      lighting: 'Same documentary style as the set',
      composition: 'Scene 3 of 5 — identical photography style across the set.',
    },
  },

  'about-does-navigate': {
    src: '/images/about-does-navigate.png',
    webp: null,
    avif: null,
    ratio: '4 / 3',
    position: 'center',
    overlay: null,
    alt: 'Citizen receiving assistance while completing an official digital government application on a computer',
    commission: {
      page: 'About',
      section: 'What SchemeAI does · Navigate',
      title: 'Navigate',
      scene:
        'Citizen receiving assistance while completing an official digital application on a computer.',
      mood: 'Guidance, confidence',
      subjects: 'Citizen · assisting facilitator',
      environment: 'Digital citizen-service centre.',
      lighting: 'Same documentary style as the set',
      composition: 'Scene 4 of 5 — identical photography style across the set.',
    },
  },

  'about-does-track': {
    src: '/images/about-does-track.png',
    webp: null,
    avif: null,
    ratio: '4 / 3',
    position: 'center',
    overlay: null,
    alt: 'Citizen checking the status of a government application on a smartphone',
    commission: {
      page: 'About',
      section: 'What SchemeAI does · Track',
      title: 'Track',
      scene: 'Citizen checking application status on a smartphone.',
      mood: 'Reassurance, control',
      subjects: 'Indian citizen',
      environment: 'Everyday Indian setting.',
      lighting: 'Same documentary style as the set',
      composition: 'Scene 5 of 5 — identical photography style across the set.',
    },
  },

  'schemes-hero': {
    src: '/images/schemes-hero.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'center',
    overlay: 'bottom',
    alt: 'Diverse Indian citizens — a farmer, a student, a woman entrepreneur, an elderly citizen and a working professional — in a modern public service environment',
    commission: {
      page: 'Schemes',
      section: 'Hero',
      title: 'Schemes — hero',
      scene:
        '16:9 photograph of diverse Indian citizens representing different government welfare categories: a farmer (agriculture), a student (education), a woman entrepreneur (employment), an elderly citizen (social welfare) and a working professional (healthcare).',
      mood: 'Diversity, opportunity, public service',
      subjects: 'Farmer · student · woman entrepreneur · elderly citizen · working professional',
      environment: 'Modern Indian public-service environment.',
      lighting: 'Documentary, balanced natural light',
      composition: 'Balanced composition. Leave negative space for the page title.',
    },
  },

  'schemes-agriculture': {
    src: '/images/schemes-agriculture.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'center',
    overlay: null,
    alt: 'Indian farmer standing in a healthy crop field while checking government agricultural information on a smartphone',
    commission: {
      page: 'Schemes',
      section: 'Category · Agriculture',
      title: 'Agriculture',
      scene:
        'Authentic rural South Indian documentary photograph. An Indian farmer stands in a healthy crop field checking government agricultural information on a smartphone.',
      mood: 'Empowerment, trust, rural accessibility',
      subjects: 'Indian farmer',
      environment: 'Realistic crops, natural soil, subtle farming equipment.',
      lighting: 'Early morning sunlight, no commercial-model posing',
      composition: '16:9 landscape.',
    },
  },

  'schemes-education': {
    src: '/images/schemes-education.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'center',
    overlay: null,
    alt: 'Diverse Indian college students studying together with books, laptops and tablets in a modern public educational institution',
    commission: {
      page: 'Schemes',
      section: 'Category · Education',
      title: 'Education',
      scene:
        'Photorealistic Indian education documentary photograph. Diverse Indian college students studying with books, laptops and tablets in a modern public educational institution.',
      mood: 'Opportunity, education, progress, accessibility',
      subjects: 'Indian college students',
      environment: 'Realistic Indian college environment, natural collaborative interaction.',
      lighting: 'Natural daylight',
      composition: '16:9 landscape.',
    },
  },

  'schemes-healthcare': {
    src: '/images/schemes-healthcare.png',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'center',
    overlay: null,
    alt: 'Indian family meeting a doctor in a clean government community health centre while he explains government health benefits',
    commission: {
      page: 'Schemes',
      section: 'Category · Healthcare',
      title: 'Healthcare',
      scene:
        'Photorealistic Indian public healthcare documentary photograph. An Indian family meets a doctor inside a clean government community health centre while the doctor explains government health benefits.',
      mood: 'Care, trust, dignity, accessibility',
      subjects: 'Indian family · doctor / healthcare worker',
      environment: 'Modern but realistic government healthcare environment. No emergency scenes, no blood.',
      lighting: 'Calm natural light',
      composition: '16:9 landscape.',
    },
  },

  'howitworks-journey': {
    src: '/images/howitworks-journey.png',
    webp: null,
    avif: null,
    ratio: '21 / 9',
    position: 'center',
    overlay: 'bottom',
    alt: 'A connected citizen journey across one service centre — discovering information on a smartphone, discussing eligibility, reviewing documents, completing an official application and leaving confidently',
    commission: {
      page: 'How it works',
      section: 'Citizen journey',
      title: 'How it works — citizen journey',
      scene:
        'ONE cinematic panoramic 16:9 photograph representing a complete citizen journey, progressing naturally left to right: discover (smartphone), discuss eligibility (facilitator), review documents, complete official application on a computer, then leave confidently.',
      mood: 'Progress, empowerment, public service',
      subjects: 'One citizen progressing through five stages; service facilitator',
      environment: 'One connected real service-centre environment, not a collage.',
      lighting: 'Professional Indian government campaign photography',
      composition: 'LEFT→RIGHT progression across the frame.',
    },
  },

  'help-support': {
    src: '/images/help-support.svg',
    webp: null,
    avif: null,
    ratio: '16 / 9',
    position: 'center',
    overlay: 'bottom',
    alt: 'Friendly Indian public-service representative helping an elderly citizen and a young woman resolve a government service issue at a service desk',
    commission: {
      page: 'Help',
      section: 'Hero',
      title: 'Help — support centre',
      scene:
        'Photorealistic Indian citizen-support centre. A friendly Indian public-service representative helps an elderly citizen and a young woman resolve a government service issue at a computer workstation.',
      mood: 'Helpful, patient, trustworthy, accessible',
      subjects: 'Service representative · elderly citizen · young woman',
      environment: 'Clean modern government support centre, organised service desk, computer workstation.',
      lighting: 'Natural expressions, calm interior light',
      composition: '16:9 landscape.',
    },
  },

  'login-side': {
    src: '/images/auth-hero-v2.jpg',
    webp: null,
    avif: null,
    ratio: '4 / 5',
    position: 'right',
    overlay: null,
    alt: 'Young Indian citizen securely accessing a government digital service on a laptop in a calm public-service environment',
    commission: {
      page: 'Login',
      section: 'Split-screen aside',
      title: 'Login — secure access',
      scene:
        'Quiet, secure photograph. A young Indian citizen securely accesses a government digital service on a laptop in a modern, calm public-service environment.',
      mood: 'Trust, privacy, security, digital accessibility',
      subjects: 'Young Indian citizen',
      environment: 'Modern but calm public-service environment. NO hacker, padlock or cyberpunk imagery.',
      lighting: 'Soft, calm light',
      composition: 'Vertical 4:5. Subject toward the RIGHT. Calm negative space on the LEFT for the login form.',
    },
  },

  'signup-side': {
    src: '/images/auth-hero-v2.jpg',
    webp: null,
    avif: null,
    ratio: '4 / 5',
    position: 'right',
    overlay: null,
    alt: 'Indian family — a parent, a young adult and an elderly member — creating a digital profile for government services using a smartphone and laptop at home',
    commission: {
      page: 'Sign up',
      section: 'Split-screen aside',
      title: 'Sign up — family profile',
      scene:
        'Warm photograph of an Indian family (parent, young adult, elderly member) creating a digital profile for government services using a smartphone and a laptop.',
      mood: 'Welcoming, inclusive, hopeful, trustworthy',
      subjects: 'Parent · young adult · elderly family member',
      environment: 'Authentic middle-class Indian home with subtle South Indian visual character.',
      lighting: 'Warm natural window light',
      composition: 'Vertical 4:5.',
    },
  },

  'footer-band': {
    src: '/images/footer-band.svg',
    webp: null,
    avif: null,
    ratio: '21 / 9',
    position: 'center',
    overlay: 'bottom',
    alt: 'Indian citizen-service centre in the early evening, citizens entering and leaving under warm architectural lighting with subtle greenery',
    commission: {
      page: 'Footer',
      section: 'Public service band',
      title: 'Footer — public service',
      scene:
        'Wide cinematic photograph of an Indian citizen-service centre during early evening, citizens naturally entering and leaving, warm architectural lighting, subtle greenery.',
      mood: 'Accessible, reliable, continuous public service',
      subjects: 'Citizens entering and leaving',
      environment: 'Citizen-service centre exterior, subtle greenery.',
      lighting: 'Warm early-evening architectural lighting',
      composition: 'Very wide 16:9. Leave negative space for footer content.',
    },
  },
}

export const SLOT_LIST = Object.entries(SLOTS).map(([key, s]) => ({
  key,
  ...s,
  ...s.commission,
}))
