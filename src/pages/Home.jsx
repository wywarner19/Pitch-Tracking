import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadGames, deleteGame, isSupabaseConfigured } from '../lib/supabase'
import { localLoadGames, localDeleteGame } from '../lib/store'

export default function Home() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchGames() }, [])

  async function fetchGames() {
    setLoading(true)
    if (isSupabaseConfigured()) {
      const { data } = await loadGames()
      setGames(data || [])
    } else {
      setGames(localLoadGames())
    }
    setLoading(false)
  }

  async function handleDelete(e, id) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this game?')) return
    if (isSupabaseConfigured()) await deleteGame(id)
    else localDeleteGame(id)
    fetchGames()
  }

  const filtered = games.filter(g =>
    [g.pitcher_name, g.opponent, g.my_team, g.date].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, g) => {
    const key = g.date?.slice(0, 7) || 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(g)
    return acc
  }, {})

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function formatDate(d) {
    if (!d) return ''
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function formatMonth(key) {
    if (!key || key === 'Unknown') return 'Unknown'
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '0.02em' }}>Scouting Games</h1>
          <p style={{ color: 'var(--text2)', marginTop: 4, fontSize: 14 }}>
            {games.length} game{games.length !== 1 ? 's' : ''} logged
            {!isSupabaseConfigured() && <span style={{ marginLeft: 10, color: 'var(--accent)', fontSize: 12 }}>⚡ Local storage — add Supabase in Settings for cloud sync</span>}
          </p>
        </div>
        <Link to="/new-game" className="btn btn-primary">+ New Game</Link>
      </div>

      <input
        type="text"
        placeholder="Search by pitcher, team, or opponent…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '1.5rem', maxWidth: 400 }}
      />

      {loading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}

      {!loading && games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text2)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚾</div>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>No games yet</h2>
          <p style={{ marginBottom: 24 }}>Start scouting by creating your first game.</p>
          <Link to="/new-game" className="btn btn-primary">+ New Game</Link>
        </div>
      )}

      {months.map(month => (
        <div key={month} style={{ marginBottom: '2rem' }}>
          <div className="section-label" style={{ marginBottom: 12 }}>{formatMonth(month)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grouped[month].map(game => (
              <Link key={game.id} to={`/game/${game.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  transition: 'border-color 0.15s, transform 0.1s',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>

                  <div style={{
                    width: 46, height: 46, borderRadius: 10,
                    background: game.pitcher_throws === 'L' ? 'rgba(74,143,232,0.15)' : 'rgba(212,168,67,0.12)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: game.pitcher_throws === 'L' ? 'var(--blue)' : 'var(--accent)' }}>
                      {game.pitcher_throws}HP
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>
                      {game.pitcher_name}
                      {game.pitcher_number && <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>#{game.pitcher_number}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                      {game.my_team} <span style={{ color: 'var(--text3)' }}>vs</span> {game.opponent}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="tag tag-gray">{formatDate(game.date)}</span>
                    <span className="tag tag-gold">{(game.pitches || []).length} pitches</span>
                    {(game.pitches || []).length > 0 && (() => {
                      const total = game.pitches.length
                      const strikes = game.pitches.filter(p => ['Called strike','Swinging strike','Foul'].includes(p.result)).length
                      return <span className="tag tag-green">{Math.round(strikes/total*100)}% K</span>
                    })()}
                  </div>

                  <button
                    className="btn btn-sm btn-danger"
                    onClick={e => handleDelete(e, game.id)}
                    style={{ marginLeft: 'auto' }}
                  >✕</button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
