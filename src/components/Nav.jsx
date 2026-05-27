import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const { pathname } = useLocation()
  const links = [
    { to: '/', label: 'Games' },
    { to: '/tendencies', label: 'Tendencies' },
    { to: '/settings', label: 'Settings' },
  ]

  return (
    <nav style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30,
          background: 'var(--accent)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: '#0f1117'
        }}>PS</div>
        <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, letterSpacing: '0.04em' }}>
          PITCH TRACKING
        </span>
      </Link>
      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(l => (
          <Link key={l.to} to={l.to} style={{
            padding: '6px 14px',
            borderRadius: 6,
            fontFamily: 'Barlow Condensed',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: pathname === l.to ? 'var(--accent)' : 'var(--text2)',
            background: pathname === l.to ? 'rgba(212,168,67,0.1)' : 'transparent',
            transition: 'all 0.15s',
          }}>{l.label}</Link>
        ))}
      </div>
    </nav>
  )
}
