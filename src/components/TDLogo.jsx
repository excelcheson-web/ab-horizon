import optimaLogo from '../assets/optima-logo.png'

/**
 * TDLogo — Optima Credit Union brand mark
 *
 * full={false} (default): square white badge, object-cover left → shows the O mark only
 * full={true}:            full landscape logo in a white pill, height=size
 */
export default function TDLogo({ size = 48, full = false, className = '', style }) {
  if (full) {
    /* ── Full landscape logo ─────────────────────────────── */
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: size,
          width: 'auto',
          borderRadius: Math.round(size * 0.18),
          background: '#ffffff',
          padding: `${Math.round(size * 0.08)}px ${Math.round(size * 0.14)}px`,
          flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          ...style,
        }}
        className={className}
      >
        <img
          src={optimaLogo}
          alt="Optima Credit Union"
          style={{ height: Math.round(size * 0.84), width: 'auto', display: 'block' }}
          draggable="false"
        />
      </div>
    )
  }

  /* ── Square badge — crops to the O mark ─────────────────── */
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: '#ffffff',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        ...style,
      }}
      className={className}
    >
      <img
        src={optimaLogo}
        alt="Optima Credit Union"
        style={{
          height: '100%',
          width: 'auto',
          objectFit: 'cover',
          objectPosition: 'left center',
          display: 'block',
        }}
        draggable="false"
      />
    </div>
  )
}
