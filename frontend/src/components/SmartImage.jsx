import { useState } from 'react'
import { SLOTS } from '../lib/images'

const OVERLAYS = {
  left: 'bg-gradient-to-r from-ink/70 via-ink/35 to-transparent',
  right: 'bg-gradient-to-l from-ink/70 via-ink/35 to-transparent',
  bottom: 'bg-gradient-to-t from-ink/70 via-ink/30 to-transparent',
  top: 'bg-gradient-to-b from-ink/70 via-ink/30 to-transparent',
  center: 'bg-ink/30',
}

/**
 * SmartImage — renders a registered image slot with web-optimised behaviour:
 * lazy loading, <picture> AVIF/WebP variants, intrinsic aspect-ratio (no
 * layout shift), responsive object-position cropping, optional readability
 * overlay, and a fade-in that never blocks first paint.
 *
 * Props:
 *   slot       registry key in src/lib/images.js (required unless `src` given)
 *   src        direct path override (when `slot` is not used)
 *   alt        meaningful alternative text (falls back to slot alt; always
 *              provided by the registry for registered slots)
 *   ratio      aspect-ratio override, e.g. "16 / 9"
 *   position   object-position override, e.g. "right"
 *   overlay    'left' | 'right' | 'bottom' | 'top' | 'center' | null
 *   eager      render with loading="eager" (use for the LCP image only)
 *   fill       fill parent instead of applying aspect-ratio (split-screen)
 *   className  extra classes on the outer element
 */
export default function SmartImage({
  slot,
  src,
  alt,
  ratio,
  position,
  overlay,
  eager = false,
  fill = false,
  className = '',
  sizes = '100vw',
}) {
  const meta = slot ? SLOTS[slot] : null
  const finalSrc = src || meta?.src
  const finalAlt = alt || meta?.alt || 'SchemeAI'
  const finalRatio = ratio || meta?.ratio
  const finalPosition = position || meta?.position || 'center'
  const overlayCls = overlay === undefined ? meta?.overlay : overlay
  const [loaded, setLoaded] = useState(false)

  const style = {}
  if (finalRatio && !fill) style.aspectRatio = finalRatio

  return (
    <div
      className={`relative overflow-hidden bg-brand-50 ${className} ${fill ? 'absolute inset-0' : ''}`}
      style={style}
    >
      {finalSrc && (
        <picture>
          {meta?.avif && <source srcSet={meta.avif} type="image/avif" />}
          {meta?.webp && <source srcSet={meta.webp} type="image/webp" />}
          <img
            src={finalSrc}
            alt={finalAlt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            sizes={sizes}
            style={{ objectPosition: finalPosition }}
            className={`h-full w-full object-cover transition-opacity duration-500 ${
              loaded ? 'opacity-100' : 'opacity-0'
            } ${fill ? 'absolute inset-0' : ''}`}
            onLoad={() => setLoaded(true)}
          />
        </picture>
      )}
      {overlayCls && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 ${OVERLAYS[overlayCls] || ''}`}
        />
      )}
    </div>
  )
}
