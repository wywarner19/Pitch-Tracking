import { useState, useEffect } from 'react'
import { loadGames, isSupabaseConfigured } from '../lib/supabase'
import { localLoadGames } from '../lib/store'

const PITCH_TYPES = [
  { id: 'FB', label: 'Fastball', color: '#4a8fe8' },
  { id: 'CT', label: 'Cutter', color: '#4caf7d' },
  { id: 'SI', label: 'Sinker', color: '#7cb87a' },
  { id: 'CB', label: 'Curveball', color: '#d4a843' },
  { id: 'SL', label: 'Slider', color: '#e08a43' },
  { id: 'SW', label: 'Sweeper', color: '#c97043' },
  { id: 'CH', label: 'Changeup', color: '#a855f7' },
  { id: 'SP', label: 'Splitter', color: '#e05252' },
  { id: 'OT', label: 'Other', color: '#8a91a8' },
]
const ptColor = id => PITCH_TYPES.find(p => p.id === id)?.color || '#888'
const ptLabel = id => PITCH_TYPES.find(p => p.id === id)?.label || id

const SITUATIONS = [
  '1st time through order','2nd time through order','3rd time through order',
  'Runners on','RISP','Bases loaded',
  'Up 1–2 runs','Up 3+ runs','Down 1–2 runs','Down 3+ runs','Tie game',
  'Late innings (7+)','Lead-off AB','2 outs',
]

export default function PitcherTendencies() {
  const [games, setGames] = useState([])
  const [selected, setSelected] = useState(null)
  const [fHand, setFHand] = useState('All')
  const [fCount, setFCount] = useState('All')
  const [fSit, setFSit] = useState('All')
  const [sortBy, setSortBy] = useState('pitches') // 'pitches' | 'name' | 'team'
  const [teamFilter, setTeamFilter] = useState('All')

  useEffect(() => {
    async function fetch() {
      let g
      if (isSupabaseConfigured()) {
        const { data } = await loadGames()
        g = data || []
      } else {
        g = localLoadGames()
      }
      setGames(g)
      if (g.length) setSelected(g[0].pitcher_name)
    }
    fetch()
  }, [])

  // Build pitcher list with aggregated pitches
  const pitcherMap = {}
  games.forEach(g => {
    const key = g.pitcher_name
    if (!pitcherMap[key]) pitcherMap[key] = { name: key, throws: g.pitcher_throws, games: [], pitches: [], teams: new Set() }
    pitcherMap[key].games.push(g)
    pitcherMap[key].pitches.push(...(g.pitches || []))
    pitcherMap[key].teams.add(g.opponent)
  })

  // Get all unique opponent teams
  const allTeams = ['All', ...Array.from(new Set(games.map(g => g.opponent))).sort()]

  // Filter and sort pitchers
  let pitchers = Object.values(pitcherMap)
  if (teamFilter !== 'All') {
    pitchers = pitchers.filter(p => p.games.some(g => g.opponent === teamFilter))
  }
  pitchers = pitchers.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'team') return Array.from(a.teams)[0]?.localeCompare(Array.from(b.teams)[0] || '') || 0
    return b.pitches.length - a.pitches.length // default: most pitches
  })

  const pitcher = pitcherMap[selected]
  const pitches = pitcher ? pitcher.pitches.filter(p => {
    if (fHand !== 'All' && p.hand !== fHand) return false
    if (fCount !== 'All' && p.count !== fCount) return false
    if (fSit !== 'All' && !p.sits?.includes(fSit)) return false
    return true
  }) : []

  const total = pitches.length
  const strikes = pitches.filter(p => ['Called strike','Swinging strike','Foul'].includes(p.result)).length
  const whiffs = pitches.filter(p => p.result === 'Swinging strike').length
  const swings = pitches.filter(p => ['Swinging strike','Foul','In play — out','In play — hit'].includes(p.result)).length

  if (!games.length) return (
    <div style={{ maxWidth: 800, margin: '3rem auto', padding: '0 1.5rem', textAlign: 'center', color: 'var(--text2)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚾</div>
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>No games logged yet</h2>
      <p>Start by creating a game and logging pitches.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Pitcher Tendencies</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>Cross-game tendencies aggregated by pitcher</p>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>

        {/* Left: Pitcher list with sort/filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Sort + Filter controls */}
          <div className="card" style={{ padding: '0.75rem', marginBottom: 4 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Sort & Filter</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Sort by</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['pitches','# Pitches'],['name','Name'],['team','Team']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setSortBy(val)} style={{
                    flex: 1, padding: '5px 4px', fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 600,
                    border: `1px solid ${sortBy === val ? 'var(--accent)' : 'var(--border2)'}`,
                    borderRadius: 5, background: sortBy === val ? 'rgba(212,168,67,0.15)' : 'transparent',
                    color: sortBy === val ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Filter by opponent</div>
              <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ fontSize: 12 }}>
                {allTeams.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="section-label">
            {pitchers.length} pitcher{pitchers.length !== 1 ? 's' : ''}
            {teamFilter !== 'All' ? ` vs ${teamFilter}` : ''}
          </div>

          {pitchers.map(p => (
            <button key={p.name} onClick={() => setSelected(p.name)} style={{
              padding: '10px 12px', textAlign: 'left',
              border: `1px solid ${selected === p.name ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, background: selected === p.name ? 'rgba(212,168,67,0.1)' : 'var(--bg2)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: selected === p.name ? 'var(--accent)' : 'var(--text)' }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {p.throws}HP · {Array.from(p.teams).join(', ')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {p.games.length} game{p.games.length !== 1 ? 's' : ''} · {p.pitches.length} pitches
              </div>
            </button>
          ))}
        </div>

        {/* Right: Detail panel */}
        {pitcher && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>{pitcher.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {pitcher.throws}HP · Scouted vs {Array.from(pitcher.teams).join(', ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={fHand} onChange={e => setFHand(e.target.value)} style={{ fontSize: 13, width: 'auto' }}>
                  <option value="All">All batters</option>
                  <option value="R">vs RHH</option>
                  <option value="L">vs LHH</option>
                </select>
                <select value={fCount} onChange={e => setFCount(e.target.value)} style={{ fontSize: 13, width: 'auto' }}>
                  <option value="All">All counts</option>
                  {['0-0','0-1','0-2','1-0','1-1','1-2','2-0','2-1','2-2','3-0','3-1','3-2'].map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={fSit} onChange={e => setFSit(e.target.value)} style={{ fontSize: 13, width: 'auto' }}>
                  <option value="All">All situations</option>
                  {SITUATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'Pitches', value: total },
                { label: 'Strike %', value: total ? Math.round(strikes/total*100)+'%' : '—' },
                { label: 'Whiff %', value: swings ? Math.round(whiffs/swings*100)+'%' : '—' },
                { label: 'Ball %', value: total ? Math.round((total-strikes)/total*100)+'%' : '—' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 24, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pitch mix */}
            <div className="card">
              <div className="section-label">Overall pitch mix</div>
              {total === 0
                ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>No pitches match this filter.</div>
                : (() => {
                    const counts = {}
                    pitches.forEach(p => counts[p.pitch] = (counts[p.pitch]||0)+1)
                    return Object.keys(counts).sort((a,b) => counts[b]-counts[a]).map(pt => {
                      const n = counts[pt], pct = Math.round(n/total*100)
                      const c = ptColor(pt)
                      return (
                        <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                          <div style={{ minWidth: 80, fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 14 }}>{ptLabel(pt)}</div>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: c, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 30 }}>{n}x</span>
                        </div>
                      )
                    })
                  })()
              }
            </div>

            {/* Count breakdown */}
            <div className="card">
              <div className="section-label">By count</div>
              {(() => {
                const cmap = {}
                pitches.forEach(p => {
                  if (!cmap[p.count]) cmap[p.count] = {}
                  cmap[p.count][p.pitch] = (cmap[p.count][p.pitch]||0)+1
                })
                const counts = Object.keys(cmap).sort()
                if (!counts.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No data.</div>
                return counts.map(c => {
                  const t = Object.values(cmap[c]).reduce((a,b)=>a+b,0)
                  return (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, minWidth: 40, color: 'var(--text2)' }}>{c}</div>
                      <div style={{ flex: 1, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {Object.keys(cmap[c]).sort((a,b)=>cmap[c][b]-cmap[c][a]).map(pt => (
                          <span key={pt} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, background: ptColor(pt)+'20', color: ptColor(pt), fontFamily: 'Barlow Condensed', fontWeight: 600 }}>
                            {ptLabel(pt)} {Math.round(cmap[c][pt]/t*100)}%
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t} pitches</span>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Situation breakdown */}
            <div className="card">
              <div className="section-label">By situation</div>
              {(() => {
                const smap = {}
                pitches.forEach(p => p.sits?.forEach(s => {
                  if (!smap[s]) smap[s] = {}
                  smap[s][p.pitch] = (smap[s][p.pitch]||0)+1
                }))
                const situations = Object.keys(smap)
                if (!situations.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No situation data yet.</div>
                return situations.map(s => {
                  const t = Object.values(smap[s]).reduce((a,b)=>a+b,0)
                  return (
                    <div key={s} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>{s}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {Object.keys(smap[s]).sort((a,b)=>smap[s][b]-smap[s][a]).map(pt => (
                          <span key={pt} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, background: ptColor(pt)+'20', color: ptColor(pt), fontFamily: 'Barlow Condensed', fontWeight: 600 }}>
                            {ptLabel(pt)} {Math.round(smap[s][pt]/t*100)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
