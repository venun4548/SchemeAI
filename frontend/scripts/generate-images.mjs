// SchemeAI image placeholder generator.
//
// Produces elegant brand-gradient placeholders for every public image slot.
// These are NOT final artwork — they are art-directed, composition-aware
// placeholders (figures/motif placement matches where the commissioned
// photograph's subjects will sit, leaving the negative space the copy uses).
//
// Palette matches tailwind.config.js brand tokens:
//   ivory #F8F7F2 · sand #E7DCC3 · forest #0F4C3A · forest-deep #062820
//   forest-mid #17654A · forest-light #44A378 · saffron #C79A2D
//   saffron-light #EFD9A0 · copper #A96A3B
//
// Run:  node scripts/generate-images.mjs
// Outputs SVGs into public/images/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'public', 'images')

const C = {
  ivory: '#F8F7F2',
  ivoryDeep: '#F1EEE4',
  sand: '#E7DCC3',
  sandDeep: '#D8C9A8',
  green: '#0F4C3A',
  greenDeep: '#062820',
  greenMid: '#17654A',
  greenLight: '#44A378',
  greenSoft: '#BFDCCB',
  saffron: '#C79A2D',
  saffronLight: '#EFD9A0',
  copper: '#A96A3B',
  copperLight: '#C99A6A',
  inkSoft: '#2E4A3F',
}

// ---------------------------------------------------------------------------
// Drawing helpers (SVG fragment builders)
// ---------------------------------------------------------------------------

const rect = (x, y, w, h, fill, rx = 0, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`

const circle = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`

const ellipse = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`

const ring = (cx, cy, r, sw, stroke, extra = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`

const line = (x1, y1, x2, y2, sw, stroke, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ${extra}/>`

const beam = (pts, fill, opacity) =>
  `<polygon points="${pts.join(',')}" fill="${fill}" opacity="${opacity}"/>`

const radialDef = (id, stops) =>
  `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`

const linearDef = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`

// Concave "floor/ceiling" band curves
const archSteps = (x, y, w, steps, sw, stroke) => {
  const n = steps
  const step = w / n
  const d = [`M ${x} ${y + step * n}`]
  for (let i = 0; i < n; i++) {
    d.push(`L ${x + i * step} ${y + step * i}`)
    d.push(`L ${x + (i + 1) * step} ${y + step * i}`)
  }
  d.push(`L ${x + w} ${y + step * n}`)
  return `<path d="${d.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`
}

const vignette = (w, h) =>
  `<radialGradient id="vg" cx="50%" cy="45%" r="85%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#062820" stop-opacity="0.18"/></radialGradient>${rect(0, 0, w, h, 'url(#vg)')}`

const grain = (w, h, id) => {
  // soft grain via tiny diagonal streaks, very low opacity
  const streaks = []
  for (let i = 0; i < 14; i++) {
    const x = (i * 97) % w
    const y = (i * 61) % h
    streaks.push(`<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y - 14}" stroke="#0F4C3A" stroke-width="1" opacity="0.03"/>`)
  }
  return streaks.join('')
}

// ---------------------------------------------------------------------------
// Slot definitions
// ---------------------------------------------------------------------------

const slots = [
  {
    key: 'home-hero', w: 1280, h: 720,
    base: ['homeLight', [[0, C.ivory], [100, C.sand]]],
    glows: [['saffronGlow', 0.35], ['greenGlow', 0.3]],
    motif: 'arcs',
    motifPos: { gx: 620, gy: 200, scale: 1.05 },
    beams: { x: 940, y: 20, count: 3 },
    note: 'figures right · negative space left',
  },
  {
    key: 'about-hero', w: 1280, h: 720,
    base: ['aboutBase', [[0, C.sand], [55, C.ivory], [100, C.sandDeep]]],
    glows: [['morningGlow', 0.4], ['greenGlow', 0.22]],
    motif: 'arch',
    motifPos: { gx: 640, gy: 80, scale: 1 },
    beams: { x: 120, y: 30, count: 2 },
    note: 'symmetrical building · morning light',
  },
  {
    key: 'about-purpose', w: 1280, h: 720,
    base: ['interiorBase', [[0, C.sand], [60, C.ivory], [100, C.ivoryDeep]]],
    glows: [['saffronGlow', 0.28], ['copperGlow', 0.3]],
    motif: 'arcs',
    motifPos: { gx: 190, gy: 230, scale: 0.85 },
    beams: { x: 300, y: 40, count: 2 },
    note: 'family LEFT · negative space right',
  },
  { key: 'about-does-discover', w: 1024, h: 768, base: ['ivoryBase', [[0, C.ivory], [100, C.ivoryDeep]]], glows: [['greenGlow', 0.28]], motif: 'card', motifPos: { gx: 300, gy: 170, scale: 1 }, note: 'DISCOVER · citizen + smartphone' },
  { key: 'about-does-understand', w: 1024, h: 768, base: ['ivoryBase', [[0, C.ivory], [100, C.ivoryDeep]]], glows: [['saffronGlow', 0.26]], motif: 'tablet', motifPos: { gx: 250, gy: 250, scale: 1 }, note: 'UNDERSTAND · facilitator + tablet' },
  { key: 'about-does-prepare', w: 1024, h: 768, base: ['ivoryBase', [[0, C.ivory], [100, C.ivoryDeep]]], glows: [['copperGlow', 0.28]], motif: 'papers', motifPos: { gx: 260, gy: 200, scale: 1 }, note: 'PREPARE · organising documents' },
  { key: 'about-does-navigate', w: 1024, h: 768, base: ['ivoryBase', [[0, C.ivory], [100, C.ivoryDeep]]], glows: [['greenGlow', 0.3]], motif: 'form', motifPos: { gx: 280, gy: 190, scale: 1 }, note: 'NAVIGATE · official digital application' },
  { key: 'about-does-track', w: 1024, h: 768, base: ['ivoryBase', [[0, C.ivory], [100, C.ivoryDeep]]], glows: [['saffronGlow', 0.3]], motif: 'rings', motifPos: { gx: 512, gy: 384, scale: 1 }, note: 'TRACK · status on smartphone' },
  {
    key: 'schemes-hero', w: 1280, h: 720,
    base: ['homeLight', [[0, C.sand], [100, C.ivory]]],
    glows: [['greenGlow', 0.32], ['saffronGlow', 0.22]],
    motif: 'bands',
    motifPos: { gx: 640, gy: 360, scale: 1.1 },
    note: 'balanced · all welfare categories',
  },
  {
    key: 'schemes-agriculture', w: 1280, h: 720,
    base: ['agriBase', [[0, C.saffronLight], [40, C.sand], [100, C.greenLight]]],
    glows: [['morningGlow', 0.45]],
    motif: 'sunArcs',
    motifPos: { gx: 880, gy: 240, scale: 1 },
    beams: { x: 860, y: 30, count: 3 },
    note: 'farmer + field · early morning',
  },
  {
    key: 'schemes-education', w: 1280, h: 720,
    base: ['eduBase', [[0, C.ivory], [100, C.greenSoft]]],
    glows: [['greenGlow', 0.3]],
    motif: 'arch',
    motifPos: { gx: 360, gy: 120, scale: 0.9 },
    note: 'college students · bright daylight',
  },
  {
    key: 'schemes-healthcare', w: 1280, h: 720,
    base: ['careBase', [[0, C.greenSoft], [60, C.ivory], [100, C.sand]]],
    glows: [['greenGlow', 0.35], ['copperGlow', 0.2]],
    motif: 'arcs',
    motifPos: { gx: 640, gy: 300, scale: 0.9 },
    note: 'family + doctor · calm health centre',
  },
  {
    key: 'howitworks-journey', w: 1280, h: 547,
    base: ['journeyBase', [[0, C.sand], [50, C.ivory], [100, C.sand]]],
    glows: [['morningGlow', 0.35], ['greenGlow', 0.25]],
    motif: 'journey',
    motifPos: { gx: 640, gy: 273, scale: 1 },
    beams: { x: 140, y: 20, count: 4 },
    note: 'left→right five-stage journey',
  },
  {
    key: 'help-support', w: 1280, h: 720,
    base: ['interiorBase', [[0, C.sandDeep], [45, C.ivory], [100, C.sand]]],
    glows: [['saffronGlow', 0.3], ['copperGlow', 0.25]],
    motif: 'counter',
    motifPos: { gx: 640, gy: 500, scale: 1 },
    beams: { x: 420, y: 30, count: 2 },
    note: 'service desk · helping citizen resolve issue',
  },
  {
    key: 'login-side', w: 800, h: 1000,
    base: ['authBase', [[0, C.greenDeep], [70, C.green], [100, C.inkSoft]]],
    glows: [['saffronGlow', 0.3]],
    motif: 'arcs',
    motifPos: { gx: 560, gy: 480, scale: 0.95 },
    note: 'secure access · subject RIGHT · calm negative space',
  },
  {
    key: 'signup-side', w: 800, h: 1000,
    base: ['signupBase', [[0, C.ivory], [100, C.sand]]],
    glows: [['saffronGlow', 0.4], ['copperGlow', 0.3]],
    motif: 'arch',
    motifPos: { gx: 200, gy: 180, scale: 0.95 },
    beams: { x: 180, y: 0, count: 3 },
    note: 'family home · warm window light',
  },
  {
    key: 'footer-band', w: 1280, h: 547,
    base: ['footerBase', [[0, C.greenDeep], [100, C.green]]],
    glows: [['saffronGlow', 0.35], ['greenGlow', 0.3]],
    motif: 'skyline',
    motifPos: { gx: 640, gy: 547, scale: 1 },
    note: 'evening centre · warm architecture lights',
  },
]

// ---------------------------------------------------------------------------
// Motif renderers
// ---------------------------------------------------------------------------

const motifs = {
  // Concentric open arcs — an abstract "wheel of services" motif.
  arcs: (p) => {
    const { gx, gy } = p
    const cols = [C.green, C.greenMid, C.saffron, C.copper, C.greenLight]
    let out = ''
    const spacing = 46
    cols.forEach((c, i) => {
      out += ring(gx, gy, 90 + i * spacing, 10, c, `opacity="${0.22 - i * 0.02}"`)
    })
    out += `<path d="M ${gx - 40} ${gy - 90} A ${46} ${46} 0 0 1 ${gx + 40} ${gy - 90}" fill="none" stroke="${C.saffron}" stroke-width="7" opacity="0.7"/>`
    out += circle(gx, gy, 26, C.saffron, 'opacity="0.5"')
    return out
  },
  // Symmetrical stepped arch — abstract institutional building silhouette.
  arch: (p) => {
    const { gx, gy } = p
    const a = gx - 150, b = gx + 150, baseY = gy + 260, topY = gy
    let out = ''
    // two columns
    out += line(a, baseY, a, topY, 26, C.green, 'opacity="0.32"')
    out += line(b, baseY, b, topY, 26, C.green, 'opacity="0.32"')
    // stepped crown
    out += archSteps(a - 40, topY - 60, 380, 7, 18, C.saffron)
    // lintel
    out += line(a - 40, topY + 70, b + 40, topY + 70, 14, C.green, 'opacity="0.4"')
    return out
  },
  // Horizontal flowing bands — abstract landscape/crowd.
  bands: (p) => {
    const { gx, gy } = p
    let out = ''
    for (let i = 0; i < 5; i++) {
      const y = gy + i * 40 - 80
      out += `<path d="M ${gx - 320} ${y} Q ${gx} ${y + 34} ${gx + 320} ${y}" fill="none" stroke="${i % 2 ? C.saffron : C.green}" stroke-width="${14 - i}" opacity="${0.3 - i * 0.045}"/>`
    }
    return out
  },
  // Sun + field arcs.
  sunArcs: (p) => {
    const { gx, gy } = p
    let out = ''
    out += circle(gx, gy, 110, C.saffronLight, 'opacity="0.55"')
    out += circle(gx, gy, 74, C.saffron, 'opacity="0.4"')
    out += ring(gx, gy, 150, 8, C.saffron, 'opacity="0.4"')
    out += ring(gx, gy, 210, 6, C.green, 'opacity="0.3"')
    // field furrows
    for (let i = 0; i < 7; i++) {
      const y = 480 + i * 30
      out += `<path d="M 120 ${y} Q 640 ${y + 26} 1160 ${y}" fill="none" stroke="${C.greenMid}" stroke-width="7" opacity="0.22"/>`
    }
    return out
  },
  // Rounded card outline — abstract smartphone.
  card: (p) => {
    const { gx, gy } = p
    return rect(gx - 60, gy - 110, 120, 220, 'none', 26, `stroke="${C.green}" stroke-width="10" opacity="0.35"`) +
      rect(gx - 60, gy - 110, 120, 220, 'none', 26, `stroke="${C.saffron}" stroke-width="3" opacity="0.5"`)
  },
  // Wide tablet outline.
  tablet: (p) => {
    const { gx, gy } = p
    return rect(gx - 140, gy - 90, 280, 180, 'none', 22, `stroke="${C.green}" stroke-width="10" opacity="0.3"`) +
      line(gx - 50, gy - 90, gx + 50, gy - 90, 8, C.saffron, 'opacity="0.6"')
  },
  // Stacked paper outlines.
  papers: (p) => {
    const { gx, gy } = p
    let out = ''
    for (let i = 0; i < 3; i++) {
      const dy = i * 46
      out += rect(gx - 100, gy - 60 + dy, 200, 130, 'none', 8, `stroke="${i % 2 ? C.saffron : C.green}" stroke-width="9" opacity="${0.5 - i * 0.1}"`)
    }
    return out
  },
  // Form outline with rule lines.
  form: (p) => {
    const { gx, gy } = p
    let out = rect(gx - 110, gy - 130, 220, 260, 'none', 12, `stroke="${C.green}" stroke-width="10" opacity="0.32"`)
    for (let i = 0; i < 4; i++) {
      out += line(gx - 80, gy - 60 + i * 44, gx + 80, gy - 60 + i * 44, 8, C.saffron, 'opacity="0.55"')
    }
    return out
  },
  // Concentric status rings.
  rings: (p) => {
    const { gx, gy } = p
    return ring(gx, gy, 150, 12, C.green, 'opacity="0.3"') +
      ring(gx, gy, 100, 12, C.saffron, 'opacity="0.45"') +
      ring(gx, gy, 50, 10, C.greenLight, 'opacity="0.5"') +
      circle(gx, gy, 16, C.saffron, 'opacity="0.7"')
  },
  // Journey: left arcs → centre bands → right arch.
  journey: (p) => {
    const { gx, gy } = p
    let out = ''
    for (let i = 0; i < 4; i++) {
      out += ring(gx - 420, gy, 90 + i * 42, 9, i % 2 ? C.saffron : C.green, `opacity="${0.3 - i * 0.03}"`)
    }
    for (let i = 0; i < 5; i++) {
      out += `<path d="M ${gx - 140} ${gy + i * 46 - 92} Q ${gx} ${gy + i * 46 - 62} ${gx + 150} ${gy + i * 46 - 92}" fill="none" stroke="${i % 2 ? C.saffron : C.green}" stroke-width="10" opacity="${0.34 - i * 0.05}"/>`
    }
    out += line(gx + 290, gy + 150, gx + 290, gy - 60, 20, C.green, 'opacity="0.3"')
    out += archSteps(gx + 190, gy - 60, 200, 5, 14, C.saffron)
    return out
  },
  // Service counter — horizon line with two glows (people either side).
  counter: (p) => {
    const { gx, gy } = p
    let out = line(120, gy, 1160, gy, 16, C.green, 'opacity="0.28"')
    out += line(120, gy - 46, 1160, gy - 46, 7, C.saffron, 'opacity="0.35"')
    out += circle(gx - 240, gy - 120, 70, C.copper, 'opacity="0.22"')
    out += circle(gx + 220, gy - 120, 70, C.green, 'opacity="0.24"')
    return out
  },
  // Evening skyline — abstract low blocks with lit windows.
  skyline: (p) => {
    const { gx, gy } = p
    let out = ''
    const blocks = [220, 300, 260, 340, 280, 380, 250, 320]
    let x = gx - 480
    blocks.forEach((w, i) => {
      const h = 60 + (i % 3) * 46 + (i % 2) * 24
      const bx = x, by = gy - h
      out += rect(bx, by, w, h, C.inkSoft, 6, `opacity="${0.5}"`)
      // lit windows
      for (let wy = by + 14; wy < gy - 14; wy += 26) {
        for (let wx = bx + 12; wx < bx + w - 12; wx += 34) {
          if ((wx + wy) % 7 < 3) out += rect(wx, wy, 12, 14, C.saffronLight, 2, 'opacity="0.5"')
        }
      }
      x += w + 26
    })
    return out
  },
}

// ---------------------------------------------------------------------------
// Base gradients
// ---------------------------------------------------------------------------

const bases = {
  homeLight: (w, h) => linearDef('base', 0, 0, w, h, [[0, C.ivory, 1], [100, C.sand, 1]]),
  aboutBase: (w, h) => linearDef('base', 0, 0, 0, h, [[0, C.sand, 1], [55, C.ivory, 1], [100, C.sandDeep, 1]]),
  interiorBase: (w, h) => linearDef('base', 0, 0, 0, h, [[0, C.sand, 1], [60, C.ivory, 1], [100, C.ivoryDeep, 1]]),
  ivoryBase: (w, h) => linearDef('base', 0, 0, w, h, [[0, C.ivory, 1], [100, C.ivoryDeep, 1]]),
  agriBase: (w, h) => linearDef('base', 0, 0, 0, h, [[0, C.saffronLight, 1], [40, C.sand, 1], [100, C.greenLight, 1]]),
  eduBase: (w, h) => linearDef('base', 0, 0, 0, h, [[0, C.ivory, 1], [100, C.greenSoft, 1]]),
  careBase: (w, h) => linearDef('base', 0, 0, w, h, [[0, C.greenSoft, 1], [60, C.ivory, 1], [100, C.sand, 1]]),
  journeyBase: (w, h) => linearDef('base', 0, 0, w, h, [[0, C.sand, 1], [50, C.ivory, 1], [100, C.sand, 1]]),
  authBase: (w, h) => linearDef('base', 0, 0, w, h, [[0, C.greenDeep, 1], [70, C.green, 1], [100, C.inkSoft, 1]]),
  signupBase: (w, h) => linearDef('base', 0, 0, w, h, [[0, C.ivory, 1], [100, C.sand, 1]]),
  footerBase: (w, h) => linearDef('base', 0, 0, 0, h, [[0, C.greenDeep, 1], [100, C.green, 1]]),
}

// Glow stops (radial), by name
const glows = {
  saffronGlow: radialDef('glowS', [[0, C.saffron, 1], [100, C.saffron, 0]]),
  greenGlow: radialDef('glowG', [[0, C.greenLight, 1], [100, C.greenLight, 0]]),
  copperGlow: radialDef('glowC', [[0, C.copper, 1], [100, C.copper, 0]]),
  morningGlow: radialDef('glowM', [[0, C.saffronLight, 1], [100, C.saffronLight, 0]]),
}

const glowXY = {
  saffronGlow: [0.78, 0.26],
  greenGlow: [0.22, 0.78],
  copperGlow: [0.5, 0.7],
  morningGlow: [0.82, 0.2],
}

// ---------------------------------------------------------------------------
// Render one slot
// ---------------------------------------------------------------------------

function render(slot) {
  const { key, w, h, base, glows: gList, motif, motifPos, beams, note } = slot
  const [baseFn, stops] = base
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Placeholder for ${key}">`)
  parts.push(`<title>SchemeAI ${key} image slot</title>`)
  parts.push(bases[baseFn](w, h, stops))
  // glows
  gList.forEach(([name, scale]) => {
    const [cx, cy] = glowXY[name] || [0.5, 0.5]
    const r = Math.max(w, h) * (0.45 + scale)
    parts.push(glows[name])
    parts.push(circle(w * cx, h * cy, r, `url(#${name === 'morningGlow' ? 'glowM' : name === 'saffronGlow' ? 'glowS' : name === 'greenGlow' ? 'glowG' : 'glowC'})`, `opacity="${scale}"`))
  })
  // light beams
  if (beams) {
    const { x, y, count } = beams
    for (let i = 0; i < count; i++) {
      const px = x + i * 70
      const bw = 150
      const p1 = [`${px},${y}`, `${px + bw},${y}`, `${px + bw + 40},${y + h}`, `${px - 40},${y + h}`]
      parts.push(beam(p1, C.ivory, 0.06))
    }
  }
  // floor band for photographic feel on landscape slots
  if (motif !== 'skyline') {
    parts.push(`<path d="M 0 ${h} L 0 ${h * 0.86} Q ${w * 0.5} ${h * 0.78} ${w} ${h * 0.86} L ${w} ${h} Z" fill="${C.greenDeep}" opacity="0.05"/>`)
  }
  // motif
  if (motif) {
    const draw = motifs[motif]
    parts.push(`<g transform="translate(${motifPos.gx} ${motifPos.gy}) scale(${motifPos.scale}) translate(${-motifPos.gx} ${-motifPos.gy})">`)
    parts.push(draw(motifPos))
    parts.push('</g>')
  }
  parts.push(grain(w, h))
  parts.push(vignette(w, h))
  parts.push('</svg>')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })
const manifest = {}
for (const slot of slots) {
  const name = `${slot.key}.svg`
  const svg = render(slot)
  writeFileSync(join(OUT, name), svg, 'utf8')
  manifest[slot.key] = {
    file: `/images/${name}`,
    width: slot.w,
    height: slot.h,
    ratio: `${slot.w}/${slot.h}`,
    composition: slot.note,
  }
  console.log(`generated ${name}  (${slot.w}x${slot.h} · ${slot.note})`)
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
console.log(`\n${slots.length} placeholders + manifest written to ${OUT}`)
