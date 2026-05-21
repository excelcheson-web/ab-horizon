/* Optima Credit Union — brand mark */

export default function TDLogo({ size = 48, className = '', style }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: '#0d1b4b',
        boxShadow: '0 4px 20px rgba(201,162,58,0.32), 0 1px 0 rgba(255,255,255,0.08) inset',
        border: '1px solid rgba(201,162,58,0.22)',
        flexShrink: 0,
        ...style,
      }}
      className={className}
      aria-label="Optima Credit Union"
    >
      {/*
        Mark: circle ring (white, 270°) + gold arc (top-right 90°)
              + gold tail curl + white checkmark inside
        viewBox adds right-side room for the gold tail extension
      */}
      <svg
        width={Math.round(size * 0.70)}
        height={Math.round(size * 0.66)}
        viewBox="-1 -1 45 41"
        fill="none"
        aria-hidden="true"
      >
        {/* White ring — 270° clockwise from 3-o'clock down-around to 12-o'clock */}
        <path
          d="M 34 20 A 14 14 0 1 1 20 6"
          stroke="rgba(255,255,255,0.90)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Gold arc — top-right 90° from 12-o'clock to 3-o'clock */}
        <path
          d="M 20 6 A 14 14 0 0 1 34 20"
          stroke="#e5c96e"
          strokeWidth="4.4"
          strokeLinecap="round"
        />
        {/* Gold tail — curves outward from 3-o'clock toward upper-right */}
        <path
          d="M 34 20 C 39 16, 38 8, 30 6"
          stroke="#e5c96e"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        {/* White checkmark inside the ring */}
        <polyline
          points="11,22 18,30 31,14"
          stroke="rgba(255,255,255,0.90)"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
