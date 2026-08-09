// Generates IMAGE_COMMISSIONING_SPEC.md from the slot registry so the spec
// can never drift from what the website actually renders.
// Run:  node scripts/generate-spec.mjs

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SLOT_LIST } from '../src/lib/images.js'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'IMAGE_COMMISSIONING_SPEC.md')

const WIDTHS = { '16 / 9': 3840, '21 / 9': 3840, '4 / 3': 3000, '4 / 5': 2400 }

const intro = `# SchemeAI — Website Image Commissioning Spec

SchemeAI is a modern Indian digital government-services platform. The public
website is currently running on **art-directed brand-gradient placeholders**
(readable at \`public/images/*.svg\`). This spec describes the photographs to
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
- Files go in \`frontend/public/images/\` and the registry entry in
  \`frontend/src/lib/images.js\` is updated (\`src\` + optional \`webp\`/\`avif\`).
  The \`SmartImage\` component already handles lazy loading, \`<picture>\`
  variant selection, aspect-ratio layout, responsive cropping, overlays and alt
  text — no markup changes needed.

## Slots

`

const body = SLOT_LIST.map((s) => {
  const w = WIDTHS[s.ratio] || 3840
  const [rw, rh] = s.ratio.split('/').map((x) => x.trim())
  const h = Math.round((w * rh) / rw)
  return `### ${s.title} — \`${s.key}\`

| | |
|---|---|
| **Page / section** | ${s.page} → ${s.section} |
| **Aspect ratio** | ${s.ratio} (master ≈ ${w} × ${h} px) |
| **object-position** | \`${s.position}\` |
| **Alt text** | ${s.alt} |

- **Scene** — ${s.scene}
- **Subjects** — ${s.subjects}
- **Environment** — ${s.environment}
- **Lighting** — ${s.lighting}
- **Composition** — ${s.composition}
- **Mood** — ${s.mood}

---
`
}).join('\n')

const outro = `## Replacing a placeholder

1. Drop the master + \`webp\`/\`avif\` files into \`frontend/public/images/\`.
2. In \`frontend/src/lib/images.js\`, update the slot's \`src\`, \`webp\` and
   \`avif\` fields (leave \`webp\`/\`avif\` \`null\` to skip a variant).
3. Regenerate placeholders/spec if the registry changes:
   \`\`\`
   node scripts/generate-images.mjs
   node scripts/generate-spec.mjs
   \`\`\`

The website reads everything from the registry — no other code changes.
`

writeFileSync(OUT, intro + body + outro, 'utf8')
console.log(`spec written to ${OUT}`)
