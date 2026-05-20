/* Generic bank logo placeholder — no real bank assets */

export default function TDLogo({ size = 48, className = '', style }) {
  const iconSize = Math.round(size * 0.55)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(135deg, #1a56db 0%, #0a2540 100%)',
        boxShadow: '0 4px 20px rgba(26,86,219,0.35), 0 1px 0 rgba(255,255,255,0.12) inset',
        flexShrink: 0,
        ...style,
      }}
      className={className}
      aria-label="Bank logo placeholder"
    >
      {/* Bank building icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Roof / pediment */}
        <polygon
          points="12,3 22,8 2,8"
          fill="rgba(255,255,255,0.95)"
        />
        {/* Columns */}
        <rect x="4"  y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)" />
        <rect x="9"  y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)" />
        <rect x="14" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)" />
        <rect x="19" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)" />
        {/* Base platform */}
        <rect x="2" y="18" width="20" height="2.5" rx="0.5" fill="rgba(255,255,255,0.95)" />
      </svg>
    </div>
  )
}
