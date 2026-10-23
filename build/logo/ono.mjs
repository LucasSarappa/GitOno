// Genera el logo de GitOno: la cara de Ono, el caniche toy del autor.
// Los rulos del pelo se distribuyen de forma procedural (con semilla fija, así el resultado
// es siempre el mismo); los ojos, el hocico y la nariz están dibujados a mano.
//
// Uso: node build/logo/ono.mjs   → escribe build/logo/ono.svg y build/logo/ono-mark.svg

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Generador pseudoaleatorio con semilla (mulberry32): mismo logo en cada corrida. */
function random(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n) => Math.round(n * 10) / 10

// Paleta tomada de las fotos de Ono.
const C = {
  cream: '#F7EDE0',
  creamDeep: '#ECD9C1',
  apricotLight: '#E9C79F',
  apricot: '#DDAA78',
  caramel: '#C98F5E',
  shadow: '#A8734C',
  eye: '#1E120D',
  eyeRim: '#4B2B1D',
  nose: '#8F5D53',
  noseLight: '#B48478',
  noseDark: '#5C3731'
}

const inEllipse = (x, y, cx, cy, rx, ry, rot = 0) => {
  const a = (-rot * Math.PI) / 180
  const dx = x - cx
  const dy = y - cy
  const u = dx * Math.cos(a) - dy * Math.sin(a)
  const v = dx * Math.sin(a) + dy * Math.cos(a)
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1
}

/** Punto del borde de una elipse rotada, para el contorno con rulos. */
const ellipsePoint = (t, cx, cy, rx, ry, rot = 0) => {
  const a = (rot * Math.PI) / 180
  const x = rx * Math.cos(t)
  const y = ry * Math.sin(t)
  return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]
}

const HEAD = { dome: [256, 186, 150, 122], cheeks: [256, 304, 128, 134] }
const EARS = [
  { cx: 140, cy: 338, rx: 60, ry: 122, rot: 13 },
  { cx: 372, cy: 338, rx: 60, ry: 122, rot: -13 }
]
const EYES = [
  [190, 250],
  [322, 250]
]
const inHead = (x, y) => inEllipse(x, y, ...HEAD.dome) || inEllipse(x, y, ...HEAD.cheeks)
const inFace = (x, y) => inEllipse(x, y, 256, 318, 104, 104)

/** Un rulo: un arco de casi una vuelta, con sombra abajo y brillo arriba. */
function curl(rand, x, y, r, light, dark, width) {
  const start = rand() * Math.PI * 2
  const sweep = Math.PI * (1.45 + rand() * 0.35)
  const x0 = x + r * Math.cos(start)
  const y0 = y + r * Math.sin(start)
  const x1 = x + r * Math.cos(start + sweep)
  const y1 = y + r * Math.sin(start + sweep)
  const d = `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 1 1 ${f(x1)} ${f(y1)}`
  return (
    `<path d="${d}" transform="translate(0.9 1.2)" stroke="${dark}" stroke-width="${width}" opacity="0.28"/>` +
    `<path d="${d}" stroke="${light}" stroke-width="${width}" opacity="0.75"/>`
  )
}

/** Contorno esponjoso: círculos sobre el borde de una elipse, rellenos con el mismo degradé. */
function fluffyEdge(rand, [cx, cy, rx, ry], fill, count, rMin, rMax, rot = 0, from = 0, to = Math.PI * 2) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * (i + rand() * 0.6)) / count
    const [x, y] = ellipsePoint(t, cx, cy, rx - rMin * 0.4, ry - rMin * 0.4, rot)
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rMin + rand() * (rMax - rMin))}" fill="${fill}"/>`
  }
  return out
}

function build({ detail }) {
  const rand = random(20251021)
  const curlCount = detail ? 1 : 0.32
  const parts = []

  // --- Orejas (detrás de la cabeza) ---
  for (const [i, ear] of EARS.entries()) {
    const id = `ear${i}`
    parts.push(
      `<g>` +
        fluffyEdge(rand, [ear.cx, ear.cy, ear.rx, ear.ry], `url(#${id})`, detail ? 34 : 18, 13, 21, ear.rot) +
        `<ellipse cx="${ear.cx}" cy="${ear.cy}" rx="${ear.rx}" ry="${ear.ry}" transform="rotate(${ear.rot} ${ear.cx} ${ear.cy})" fill="url(#${id})"/>`
    )
    let curls = ''
    for (let k = 0; k < 190 * curlCount; k++) {
      const x = ear.cx + (rand() - 0.5) * ear.rx * 2
      const y = ear.cy + (rand() - 0.5) * ear.ry * 2
      if (!inEllipse(x, y, ear.cx, ear.cy, ear.rx - 6, ear.ry - 6, ear.rot)) continue
      curls += curl(rand, x, y, 3.6 + rand() * 3.6, C.apricotLight, C.shadow, detail ? 2.1 : 4)
    }
    parts.push(`<g fill="none" stroke-linecap="round">${curls}</g></g>`)
  }

  // --- Cabeza: copete y mejillas con borde de rulos ---
  parts.push(
    `<g>` +
      fluffyEdge(rand, HEAD.dome, 'url(#fur)', detail ? 46 : 24, 15, 24, 0, Math.PI * 0.92, Math.PI * 2.08) +
      fluffyEdge(rand, HEAD.cheeks, 'url(#fur)', detail ? 26 : 14, 12, 18, 0, -0.15, Math.PI + 0.15) +
      `<ellipse cx="${HEAD.dome[0]}" cy="${HEAD.dome[1]}" rx="${HEAD.dome[2]}" ry="${HEAD.dome[3]}" fill="url(#fur)"/>` +
      `<ellipse cx="${HEAD.cheeks[0]}" cy="${HEAD.cheeks[1]}" rx="${HEAD.cheeks[2]}" ry="${HEAD.cheeks[3]}" fill="url(#fur)"/>` +
      `</g>`
  )

  // Tono damasco alrededor de los ojos y el hocico (como en las fotos).
  parts.push(
    `<ellipse cx="256" cy="322" rx="116" ry="108" fill="url(#faceTint)"/>`,
    ...EYES.map(([x, y]) => `<ellipse cx="${x}" cy="${y + 26}" rx="30" ry="34" fill="url(#tear)"/>`)
  )

  // Rulos de la cabeza: más chicos y escasos en la cara, donde el pelo es corto.
  // Volumen: manchas suaves un tono más oscuro entre los rulos.
  let volume = ''
  for (let k = 0; k < 140 * curlCount; k++) {
    const x = 100 + rand() * 312
    const y = 60 + rand() * 340
    if (!inHead(x, y) || inFace(x, y)) continue
    volume += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(9 + rand() * 9)}" fill="${C.apricotLight}" opacity="${f(0.12 + rand() * 0.12)}"/>`
  }
  parts.push(`<g>${volume}</g>`)

  let headCurls = ''
  for (let k = 0; k < 950 * curlCount; k++) {
    const x = 100 + rand() * 312
    const y = 44 + rand() * 360
    if (!inHead(x, y)) continue
    const face = inFace(x, y)
    if (face && rand() < 0.82) continue
    if (EYES.some(([ex, ey]) => Math.hypot(x - ex, y - ey) < 40)) continue
    const top = y < 200
    headCurls += curl(
      rand,
      x,
      y,
      face ? 2.6 + rand() * 2 : 3.6 + rand() * 3.4,
      top ? C.cream : C.creamDeep,
      face ? C.caramel : C.shadow,
      detail ? (face ? 1.5 : 2.1) : 4
    )
  }
  parts.push(`<g fill="none" stroke-linecap="round">${headCurls}</g>`)

  // --- Hocico ---
  let muzzleFur = ''
  if (detail) {
    for (let k = 0; k < 70; k++) {
      const side = k % 2 ? 1 : -1
      const a = (rand() * 0.9 + 0.05) * Math.PI * 0.5
      const x0 = 256 + side * (18 + rand() * 30)
      const y0 = 330 + rand() * 26
      const len = 5 + rand() * 7
      muzzleFur += `<path d="M${f(x0)} ${f(y0)}q${f(side * len * 0.5)} ${f(len * 0.2)} ${f(side * len * Math.cos(a))} ${f(len * Math.sin(a) + 3)}" stroke="${rand() < 0.5 ? C.caramel : C.apricotLight}" stroke-width="1.3" opacity="0.45"/>`
    }
  }
  parts.push(
    '<g transform="translate(0 32)">',
    `<ellipse cx="256" cy="340" rx="82" ry="66" fill="url(#muzzle)"/>`,
    `<g fill="none" stroke-linecap="round">${muzzleFur}</g>`,
    // Barbita
    `<path d="M210 382c14 26 30 36 46 36s32-10 46-36c-12 10-28 15-46 15s-34-5-46-15z" fill="${C.apricotLight}" opacity="0.85"/>`,
    `<path d="M256 352v18" stroke="${C.noseDark}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>`,
    `<path d="M240 376c6 5 11 6 16 6s10-1 16-6" fill="none" stroke="${C.noseDark}" stroke-width="2.4" stroke-linecap="round" opacity="0.35"/>`,
    '</g>'
  )

  // --- Ojos grandes, marrón oscuro, con brillo ---
  for (const [x, y] of EYES) {
    parts.push(
      // Sombra del párpado de arriba: da la mirada dulce un poco caída.
      `<ellipse cx="${x}" cy="${y - 9}" rx="35" ry="22" fill="${C.shadow}" opacity="0.22"/>`,
      `<circle cx="${x}" cy="${y}" r="27.5" fill="${C.eyeRim}"/>`,
      `<circle cx="${x}" cy="${y}" r="25" fill="url(#eye)"/>`,
      `<ellipse cx="${x - 8.5}" cy="${y - 9}" rx="8" ry="6.5" fill="#FFFFFF" opacity="0.92"/>`,
      `<circle cx="${x + 9}" cy="${y + 9}" r="3" fill="#FFFFFF" opacity="0.55"/>`,
      `<path d="M${x - 27} ${y + 4}a27 27 0 0 0 54 0" fill="none" stroke="${C.cream}" stroke-width="2.5" opacity="0.5"/>`
    )
  }

  // --- Nariz marrón rosada (baja con el hocico) ---
  parts.push(
    '<g transform="translate(0 32)">',
    `<path d="M256 349c-17 0-31-8-34-20-3-13 7-25 34-25s37 12 34 25c-3 12-17 20-34 20z" fill="url(#nose)"/>`,
    `<ellipse cx="243" cy="333" rx="6" ry="3.6" transform="rotate(-28 243 333)" fill="${C.noseDark}" opacity="0.8"/>`,
    `<ellipse cx="269" cy="333" rx="6" ry="3.6" transform="rotate(28 269 333)" fill="${C.noseDark}" opacity="0.8"/>`,
    `<ellipse cx="250" cy="314" rx="11" ry="5" fill="${C.noseLight}" opacity="0.8"/>`,
    '</g>'
  )

  const defs = `
  <defs>
    <radialGradient id="fur" gradientUnits="userSpaceOnUse" cx="210" cy="120" r="330">
      <stop offset="0" stop-color="${C.cream}"/>
      <stop offset="0.6" stop-color="${C.creamDeep}"/>
      <stop offset="1" stop-color="${C.apricotLight}"/>
    </radialGradient>
    <linearGradient id="ear0" gradientUnits="userSpaceOnUse" x1="140" y1="216" x2="140" y2="460">
      <stop offset="0" stop-color="${C.caramel}"/>
      <stop offset="0.55" stop-color="${C.apricot}"/>
      <stop offset="1" stop-color="${C.apricotLight}"/>
    </linearGradient>
    <linearGradient id="ear1" gradientUnits="userSpaceOnUse" x1="372" y1="216" x2="372" y2="460">
      <stop offset="0" stop-color="${C.caramel}"/>
      <stop offset="0.55" stop-color="${C.apricot}"/>
      <stop offset="1" stop-color="${C.apricotLight}"/>
    </linearGradient>
    <radialGradient id="faceTint" cx="0.5" cy="0.6" r="0.55">
      <stop offset="0" stop-color="${C.apricot}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${C.apricot}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="tear" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0" stop-color="${C.caramel}" stop-opacity="0.62"/>
      <stop offset="1" stop-color="${C.caramel}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="muzzle" cx="0.5" cy="0.35" r="0.65">
      <stop offset="0" stop-color="${C.apricotLight}"/>
      <stop offset="0.7" stop-color="${C.apricot}"/>
      <stop offset="1" stop-color="${C.apricot}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="eye" cx="0.38" cy="0.35" r="0.75">
      <stop offset="0" stop-color="#6A3B24"/>
      <stop offset="0.45" stop-color="#2E1A12"/>
      <stop offset="1" stop-color="${C.eye}"/>
    </radialGradient>
    <radialGradient id="nose" cx="0.4" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${C.noseLight}"/>
      <stop offset="0.55" stop-color="${C.nose}"/>
      <stop offset="1" stop-color="${C.noseDark}"/>
    </radialGradient>
  </defs>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>Ono</title>${defs}
  ${parts.join('\n  ')}
</svg>
`
}

writeFileSync(join(here, 'ono.svg'), build({ detail: true }))
writeFileSync(join(here, 'ono-mark.svg'), build({ detail: false }))
console.log('ono.svg y ono-mark.svg generados')
