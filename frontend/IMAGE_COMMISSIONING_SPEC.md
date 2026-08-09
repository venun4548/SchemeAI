# SchemeAI — Website Image Commissioning Spec

SchemeAI is a modern Indian digital government-services platform. The public
website is currently running on **art-directed brand-gradient placeholders**
(readable at `public/images/*.svg`). This spec describes the photographs to
commission in their place.

## Global visual identity — applies to every image

> Premium Indian government annual-report documentary photography.
> Photorealistic, authentic Indian citizens, natural skin tones, natural
> expressions, realistic Indian clothing and environments, professional
> editorial photography, subtle cinematic depth, natural lighting, trustworthy
> public-service atmosphere.
>
> Palette: warm ivory, deep forest green, muted saffron, copper, natural earthy
> tones. No excessive saturation, no artificial HDR, no unrealistic skin, no
> overly perfect models — people should look like real citizens.

### Never
Generic AI startup visuals · robots · holograms · purple/blue AI imagery ·
Western stock photography · politicians · political symbols · fake government
logos or seals · random readable text · watermarks. Every image must have a
**unique scene** — never just swap people over the same background.

## Delivery requirements

- All images share the same camera realism, lens style, colour grading and
  documentary realism.
- **Hero images:** 16:9. **Section images:** 4:3 or 16:9. **Login/Signup:** 4:5.
  **Footer:** very wide 16:9 (rendered ~21:9).
- Deliver lossless masters at the sizes below plus web-optimised **WebP** and
  **AVIF** versions.
- Files go in `frontend/public/images/` and the registry entry in
  `frontend/src/lib/images.js` is updated (`src` + optional `webp`/`avif`).
  The `SmartImage` component already handles lazy loading, `<picture>`
  variant selection, aspect-ratio layout, responsive cropping, overlays and alt
  text — no markup changes needed.

## Slots

### Home hero — `home-hero`

| | |
|---|---|
| **Page / section** | Home → Hero |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `right` |
| **Alt text** | Indian citizens — a farmer, a young woman, a college student, an elderly citizen and a small business owner — using digital government services at a modern citizen service centre |

- **Scene** — Wide cinematic 16:9 photograph. A diverse group of ordinary Indian citizens using a modern digital citizen-service centre: a farmer, a young woman, a college student, an elderly citizen and a small business owner, naturally interacting with digital government services.
- **Subjects** — Farmer · young woman · college student · elderly citizen · small business owner
- **Environment** — Modern Indian public-service centre with subtle civic architecture, clean service counters, computers and natural daylight.
- **Lighting** — Natural daylight, documentary realism
- **Composition** — People toward the RIGHT. Large clean negative space on the LEFT for headline, description and CTAs.
- **Mood** — Trust, accessibility, empowerment, public service

---

### About — hero — `about-hero`

| | |
|---|---|
| **Page / section** | About → Hero |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `center` |
| **Alt text** | Modern Indian public administration building with a landscaped entrance, citizens entering in early morning sunlight |

- **Scene** — Sophisticated 16:9 photograph of a modern Indian public administration building, clean geometric structure, landscaped entrance, ordinary citizens naturally entering.
- **Subjects** — Government institutional architecture · citizens entering
- **Environment** — Contemporary Indian government institutional architecture, landscaped entrance.
- **Lighting** — Early morning sunlight, symmetrical professional architectural photography
- **Composition** — Symmetrical. Warm ivory, forest green and subtle muted saffron grading.
- **Mood** — Stability, transparency, trust, public service

---

### About — our purpose — `about-purpose`

| | |
|---|---|
| **Page / section** | About → Our purpose |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `left` |
| **Alt text** | A family receiving assistance from a public-service facilitator who explains government welfare information on a laptop at a community service centre |

- **Scene** — Realistic documentary photograph. Parents, a young adult and an elderly family member sit with a service facilitator who explains government welfare information using a laptop/tablet.
- **Subjects** — Parents · young adult · elderly family member · service facilitator
- **Environment** — Authentic Indian community service centre, natural human interaction.
- **Lighting** — Natural interior light, documentary realism
- **Composition** — People slightly toward the LEFT. Clean negative space toward the RIGHT for text.
- **Mood** — Inclusion, accessibility, trust, human-centred government service

---

### Discover — `about-does-discover`

| | |
|---|---|
| **Page / section** | About → What SchemeAI does · Discover |
| **Aspect ratio** | 4 / 3 (master ≈ 3000 × 2250 px) |
| **object-position** | `center` |
| **Alt text** | Young Indian citizen discovering government scheme information on a smartphone |

- **Scene** — Young Indian citizen discovering government scheme information using a smartphone.
- **Subjects** — Young Indian citizen
- **Environment** — Public service centre / everyday Indian setting.
- **Lighting** — Same documentary style as the rest of the five-scene set
- **Composition** — One of five scenes photographed by the same professional government photographer — same lighting, lens style, colour grading and documentary realism.
- **Mood** — Discovery, opportunity

---

### Understand — `about-does-understand`

| | |
|---|---|
| **Page / section** | About → What SchemeAI does · Understand |
| **Aspect ratio** | 4 / 3 (master ≈ 3000 × 2250 px) |
| **object-position** | `center` |
| **Alt text** | Government service facilitator explaining eligibility requirements to an elderly citizen using a tablet |

- **Scene** — Government service facilitator explaining eligibility requirements to an elderly citizen using a tablet.
- **Subjects** — Service facilitator · elderly citizen
- **Environment** — Public service centre.
- **Lighting** — Same documentary style as the set
- **Composition** — Scene 2 of 5 — identical photography style across the set.
- **Mood** — Clarity, patience

---

### Prepare — `about-does-prepare`

| | |
|---|---|
| **Page / section** | About → What SchemeAI does · Prepare |
| **Aspect ratio** | 4 / 3 (master ≈ 3000 × 2250 px) |
| **object-position** | `center` |
| **Alt text** | Indian citizen organising documents for a government application at a table |

- **Scene** — Indian citizen organising documents for a government application.
- **Subjects** — Indian citizen
- **Environment** — Home or service centre, documents on a table.
- **Lighting** — Same documentary style as the set
- **Composition** — Scene 3 of 5 — identical photography style across the set.
- **Mood** — Readiness, care

---

### Navigate — `about-does-navigate`

| | |
|---|---|
| **Page / section** | About → What SchemeAI does · Navigate |
| **Aspect ratio** | 4 / 3 (master ≈ 3000 × 2250 px) |
| **object-position** | `center` |
| **Alt text** | Citizen receiving assistance while completing an official digital government application on a computer |

- **Scene** — Citizen receiving assistance while completing an official digital application on a computer.
- **Subjects** — Citizen · assisting facilitator
- **Environment** — Digital citizen-service centre.
- **Lighting** — Same documentary style as the set
- **Composition** — Scene 4 of 5 — identical photography style across the set.
- **Mood** — Guidance, confidence

---

### Track — `about-does-track`

| | |
|---|---|
| **Page / section** | About → What SchemeAI does · Track |
| **Aspect ratio** | 4 / 3 (master ≈ 3000 × 2250 px) |
| **object-position** | `center` |
| **Alt text** | Citizen checking the status of a government application on a smartphone |

- **Scene** — Citizen checking application status on a smartphone.
- **Subjects** — Indian citizen
- **Environment** — Everyday Indian setting.
- **Lighting** — Same documentary style as the set
- **Composition** — Scene 5 of 5 — identical photography style across the set.
- **Mood** — Reassurance, control

---

### Schemes — hero — `schemes-hero`

| | |
|---|---|
| **Page / section** | Schemes → Hero |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `center` |
| **Alt text** | Diverse Indian citizens — a farmer, a student, a woman entrepreneur, an elderly citizen and a working professional — in a modern public service environment |

- **Scene** — 16:9 photograph of diverse Indian citizens representing different government welfare categories: a farmer (agriculture), a student (education), a woman entrepreneur (employment), an elderly citizen (social welfare) and a working professional (healthcare).
- **Subjects** — Farmer · student · woman entrepreneur · elderly citizen · working professional
- **Environment** — Modern Indian public-service environment.
- **Lighting** — Documentary, balanced natural light
- **Composition** — Balanced composition. Leave negative space for the page title.
- **Mood** — Diversity, opportunity, public service

---

### Agriculture — `schemes-agriculture`

| | |
|---|---|
| **Page / section** | Schemes → Category · Agriculture |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `center` |
| **Alt text** | Indian farmer standing in a healthy crop field while checking government agricultural information on a smartphone |

- **Scene** — Authentic rural South Indian documentary photograph. An Indian farmer stands in a healthy crop field checking government agricultural information on a smartphone.
- **Subjects** — Indian farmer
- **Environment** — Realistic crops, natural soil, subtle farming equipment.
- **Lighting** — Early morning sunlight, no commercial-model posing
- **Composition** — 16:9 landscape.
- **Mood** — Empowerment, trust, rural accessibility

---

### Education — `schemes-education`

| | |
|---|---|
| **Page / section** | Schemes → Category · Education |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `center` |
| **Alt text** | Diverse Indian college students studying together with books, laptops and tablets in a modern public educational institution |

- **Scene** — Photorealistic Indian education documentary photograph. Diverse Indian college students studying with books, laptops and tablets in a modern public educational institution.
- **Subjects** — Indian college students
- **Environment** — Realistic Indian college environment, natural collaborative interaction.
- **Lighting** — Natural daylight
- **Composition** — 16:9 landscape.
- **Mood** — Opportunity, education, progress, accessibility

---

### Healthcare — `schemes-healthcare`

| | |
|---|---|
| **Page / section** | Schemes → Category · Healthcare |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `center` |
| **Alt text** | Indian family meeting a doctor in a clean government community health centre while he explains government health benefits |

- **Scene** — Photorealistic Indian public healthcare documentary photograph. An Indian family meets a doctor inside a clean government community health centre while the doctor explains government health benefits.
- **Subjects** — Indian family · doctor / healthcare worker
- **Environment** — Modern but realistic government healthcare environment. No emergency scenes, no blood.
- **Lighting** — Calm natural light
- **Composition** — 16:9 landscape.
- **Mood** — Care, trust, dignity, accessibility

---

### How it works — citizen journey — `howitworks-journey`

| | |
|---|---|
| **Page / section** | How it works → Citizen journey |
| **Aspect ratio** | 21 / 9 (master ≈ 3840 × 1646 px) |
| **object-position** | `center` |
| **Alt text** | A connected citizen journey across one service centre — discovering information on a smartphone, discussing eligibility, reviewing documents, completing an official application and leaving confidently |

- **Scene** — ONE cinematic panoramic 16:9 photograph representing a complete citizen journey, progressing naturally left to right: discover (smartphone), discuss eligibility (facilitator), review documents, complete official application on a computer, then leave confidently.
- **Subjects** — One citizen progressing through five stages; service facilitator
- **Environment** — One connected real service-centre environment, not a collage.
- **Lighting** — Professional Indian government campaign photography
- **Composition** — LEFT→RIGHT progression across the frame.
- **Mood** — Progress, empowerment, public service

---

### Help — support centre — `help-support`

| | |
|---|---|
| **Page / section** | Help → Hero |
| **Aspect ratio** | 16 / 9 (master ≈ 3840 × 2160 px) |
| **object-position** | `center` |
| **Alt text** | Friendly Indian public-service representative helping an elderly citizen and a young woman resolve a government service issue at a service desk |

- **Scene** — Photorealistic Indian citizen-support centre. A friendly Indian public-service representative helps an elderly citizen and a young woman resolve a government service issue at a computer workstation.
- **Subjects** — Service representative · elderly citizen · young woman
- **Environment** — Clean modern government support centre, organised service desk, computer workstation.
- **Lighting** — Natural expressions, calm interior light
- **Composition** — 16:9 landscape.
- **Mood** — Helpful, patient, trustworthy, accessible

---

### Login — secure access — `login-side`

| | |
|---|---|
| **Page / section** | Login → Split-screen aside |
| **Aspect ratio** | 4 / 5 (master ≈ 2400 × 3000 px) |
| **object-position** | `right` |
| **Alt text** | Young Indian citizen securely accessing a government digital service on a laptop in a calm public-service environment |

- **Scene** — Quiet, secure photograph. A young Indian citizen securely accesses a government digital service on a laptop in a modern, calm public-service environment.
- **Subjects** — Young Indian citizen
- **Environment** — Modern but calm public-service environment. NO hacker, padlock or cyberpunk imagery.
- **Lighting** — Soft, calm light
- **Composition** — Vertical 4:5. Subject toward the RIGHT. Calm negative space on the LEFT for the login form.
- **Mood** — Trust, privacy, security, digital accessibility

---

### Sign up — family profile — `signup-side`

| | |
|---|---|
| **Page / section** | Sign up → Split-screen aside |
| **Aspect ratio** | 4 / 5 (master ≈ 2400 × 3000 px) |
| **object-position** | `right` |
| **Alt text** | Indian family — a parent, a young adult and an elderly member — creating a digital profile for government services using a smartphone and laptop at home |

- **Scene** — Warm photograph of an Indian family (parent, young adult, elderly member) creating a digital profile for government services using a smartphone and a laptop.
- **Subjects** — Parent · young adult · elderly family member
- **Environment** — Authentic middle-class Indian home with subtle South Indian visual character.
- **Lighting** — Warm natural window light
- **Composition** — Vertical 4:5.
- **Mood** — Welcoming, inclusive, hopeful, trustworthy

---

### Footer — public service — `footer-band`

| | |
|---|---|
| **Page / section** | Footer → Public service band |
| **Aspect ratio** | 21 / 9 (master ≈ 3840 × 1646 px) |
| **object-position** | `center` |
| **Alt text** | Indian citizen-service centre in the early evening, citizens entering and leaving under warm architectural lighting with subtle greenery |

- **Scene** — Wide cinematic photograph of an Indian citizen-service centre during early evening, citizens naturally entering and leaving, warm architectural lighting, subtle greenery.
- **Subjects** — Citizens entering and leaving
- **Environment** — Citizen-service centre exterior, subtle greenery.
- **Lighting** — Warm early-evening architectural lighting
- **Composition** — Very wide 16:9. Leave negative space for footer content.
- **Mood** — Accessible, reliable, continuous public service

---
## Replacing a placeholder

1. Drop the master + `webp`/`avif` files into `frontend/public/images/`.
2. In `frontend/src/lib/images.js`, update the slot's `src`, `webp` and
   `avif` fields (leave `webp`/`avif` `null` to skip a variant).
3. Regenerate placeholders/spec if the registry changes:
   ```
   node scripts/generate-images.mjs
   node scripts/generate-spec.mjs
   ```

The website reads everything from the registry — no other code changes.
