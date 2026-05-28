import { useState, useEffect } from 'react'
import { loadGames, isSupabaseConfigured } from '../lib/supabase'
import { localLoadGames } from '../lib/store'

const BUILTIN_PITCH_TYPES = [
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

function ptColor(id, customPitches) {
  const b = BUILTIN_PITCH_TYPES.find(p => p.id === id)
  if (b) return b.color
  return (customPitches || []).find(p => p.id === id)?.color || '#8a91a8'
}
function ptLabel(id, customPitches) {
  const b = BUILTIN_PITCH_TYPES.find(p => p.id === id)
  if (b) return b.label
  return (customPitches || []).find(p => p.id === id)?.label || id
}

const SITUATIONS = [
  '1st time through order','2nd time through order','3rd time through order',
  'Runners on','RISP','Bases loaded',
  'Up 1–2 runs','Up 3+ runs','Down 1–2 runs','Down 3+ runs','Tie game',
  'Late innings (7+)','Lead-off AB','2 outs',
]

export default function PitcherTendencies() {
  const [games, setGames] = useState([])
  const [selected, setSelected] = useState(null) // { pitcherName, gameId, pitcherId }
  const [fHand, setFHand] = useState('All')
  const [fCount, setFCount] = useState('All')
  const [fSit, setFSit] = useState('All')
  const [sortBy, setSortBy] = useState('pitches')
  const [teamFilter, setTeamFilter] = useState('All')
  const [modeFilter, setModeFilter] = useState('All')

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
    }
    fetch()
  }, [])

  // Build pitcher entries — one entry per pitcher per game appearance
  // Each entry: { key, name, throws, number, gameId, gameDate, opponent, mode, pitches, customPitches }
  const pitcherEntries = []
  games.forEach(game => {
    const customPitches = game.custom_pitches || []
    const pitchers = game.pitchers || []
    if (pitchers.length === 0) {
      // Legacy game without pitchers array
      pitcherEntries.push({
        key: `${game.id}-legacy`,
        name: game.pitcher_name,
        throws: game.pitcher_throws,
        number: game.pitcher_number,
        gameId: game.id,
        gameDate: game.date,
        opponent: game.opponent,
        myTeam: game.my_team,
        mode: game.mode || 'scouting',
        pitches: game.pitches || [],
        customPitches,
      })
    } else {
      pitchers.forEach((pitcher, idx) => {
        const nextPitcher = pitchers[idx + 1]
        const myPitches = (game.pitches || []).filter(p => {
          if (p.pitcherId) return p.pitcherId === pitcher.id
          // Fallback: use startPitchIndex ranges
          const start = pitcher.startPitchIndex || 0
          const end = nextPitcher?.startPitchIndex ?? (game.pitches || []).length
          const pIdx = (game.pitches || []).indexOf(p)
          return pIdx >= start && pIdx < end
        })
        pitcherEntries.push({
          key: `${game.id}-${pitcher.id}`,
          name: pitcher.name,
          throws: pitcher.throws,
          number: pitcher.number,
          gameId: game.id,
          gameDate: game.date,
          opponent: game.opponent,
          myTeam: game.my_team,
          mode: game.mode || 'scouting',
          isStarter: idx === 0,
          pitches: myPitches,
          customPitches,
        })
      })
    }
  })

  // Aggregate by pitcher name across games
  const pitcherMap = {}
  pitcherEntries.forEach(entry => {
    const key = entry.name
    if (!pitcherMap[key]) pitcherMap[key] = { name: key, throws: entry.throws, entries: [], totalPitches: 0, opponents: new Set(), mode: entry.mode }
    pitcherMap[key].entries.push(entry)
    pitcherMap[key].totalPitches += entry.pitches.length
    pitcherMap[key].opponents.add(entry.opponent)
  })

  const allTeams = ['All', ...Array.from(new Set(games.map(g => g.opponent))).sort()]

  let pitchers = Object.values(pitcherMap)
  if (teamFilter !== 'All') pitchers = pitchers.filter(p => p.opponents.has(teamFilter))
  if (modeFilter !== 'All') pitchers = pitchers.filter(p => p.mode === modeFilter || p.entries.some(e => e.mode === modeFilter))
  pitchers = pitchers.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'team') return [...a.opponents][0]?.localeCompare([...b.opponents][0] || '') || 0
    return b.totalPitches - a.totalPitches
  })

  // Get selected pitcher data
  const selectedPitcher = selected ? pitcherMap[selected] : null
  const allCustomPitches = selectedPitcher ? selectedPitcher.entries.flatMap(e => e.customPitches || []) : []

  const pitches = selectedPitcher ? selectedPitcher.entries.flatMap(e => e.pitches).filter(p => {
    if (fHand !== 'All' && p.hand !== fHand) return false
    if (fCount !== 'All' && p.count !== fCount) return false
    if (fSit !== 'All' && !p.sits?.includes(fSit)) return false
    return true
  }) : []

  const total = pitches.length
  const strikes = pitches.filter(p => ['Called strike','Swinging strike','Foul'].includes(p.result)).length
  const whiffs = pitches.filter(p => p.result === 'Swinging strike').length
  const swings = pitches.filter(p => ['Swinging strike','Foul','In play — out','In play — hit','In play — FC','In play — error'].includes(p.result)).length

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
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>Cross-game tendencies by pitcher — each pitcher appearance tracked separately</p>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Sort + Filter */}
          <div className="card" style={{ padding: '0.75rem', marginBottom: 4 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Sort & Filter</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Sort by</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['pitches','Pitches'],['name','Name'],['team','Team']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setSortBy(val)} style={{ flex: 1, padding: '4px 3px', fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 600, border: `1px solid ${sortBy === val ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 4, background: sortBy === val ? 'rgba(212,168,67,0.15)' : 'transparent', color: sortBy === val ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mode</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['All','All'],['scouting','Scout'],['our_pitcher','Ours']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setModeFilter(val)} style={{ flex: 1, padding: '4px 3px', fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 600, border: `1px solid ${modeFilter === val ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 4, background: modeFilter === val ? 'rgba(212,168,67,0.15)' : 'transparent', color: modeFilter === val ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Opponent</div>
              <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ fontSize: 12 }}>
                {allTeams.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="section-label">{pitchers.length} pitcher{pitchers.length !== 1 ? 's' : ''}</div>

          {pitchers.map(p => (
            <button key={p.name} onClick={() => setSelected(p.name)} style={{ padding: '10px 12px', textAlign: 'left', border: `1px solid ${selected === p.name ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: selected === p.name ? 'rgba(212,168,67,0.1)' : 'var(--bg2)', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: selected === p.name ? 'var(--accent)' : 'var(--text)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {p.throws}HP · {[...p.opponents].join(', ')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {p.entries.length} game{p.entries.length !== 1 ? 's' : ''} · {p.totalPitches} pitches
              </div>
            </button>
          ))}
        </div>

        {selectedPitcher && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>{selectedPitcher.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {selectedPitcher.throws}HP · {selectedPitcher.entries.length} game appearance{selectedPitcher.entries.length !== 1 ? 's' : ''}
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

            {/* Game appearances */}
            <div className="card">
              <div className="section-label">Game appearances</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedPitcher.entries.map(e => (
                  <div key={e.key} style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg3)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>{e.opponent}</span>
                    <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{e.gameDate}</span>
                    <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{e.pitches.length}p</span>
                    {!e.isStarter && <span style={{ color: 'var(--text3)', marginLeft: 6, fontSize: 10 }}>RP</span>}
                  </div>
                ))}
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
                <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pitch mix */}
            <div className="card">
              <div className="section-label">Pitch mix</div>
              {total === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>No pitches match.</div> : (() => {
                const counts = {}
                pitches.filter(p=>p.pitch).forEach(p => counts[p.pitch]=(counts[p.pitch]||0)+1)
                const trackedTotal = Object.values(counts).reduce((a,b)=>a+b,0)
                return Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).map(pt => {
                  const n=counts[pt], pct=Math.round(n/trackedTotal*100)
                  const c=ptColor(pt,allCustomPitches)
                  return (
                    <div key={pt} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:8,height:8,borderRadius:'50%',background:c }} />
                      <div style={{ minWidth:75,fontFamily:'Barlow Condensed',fontWeight:600,fontSize:13 }}>{ptLabel(pt,allCustomPitches)}</div>
                      <div style={{ flex:1,height:5,background:'var(--bg3)',borderRadius:3,overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`,height:'100%',background:c,borderRadius:3 }} />
                      </div>
                      <span style={{ fontSize:12,fontWeight:600,color:c,minWidth:36,textAlign:'right' }}>{pct}%</span>
                      <span style={{ fontSize:11,color:'var(--text3)',minWidth:20 }}>{n}x</span>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Count breakdown */}
            <div className="card">
              <div className="section-label">By count</div>
              {(() => {
                const cmap = {}
                pitches.filter(p=>p.pitch).forEach(p => { if(!cmap[p.count])cmap[p.count]={}; cmap[p.count][p.pitch]=(cmap[p.count][p.pitch]||0)+1 })
                const counted = Object.keys(cmap).sort()
                if(!counted.length) return <div style={{color:'var(--text3)',fontSize:13}}>No data.</div>
                return counted.map(c => {
                  const t=Object.values(cmap[c]).reduce((a,b)=>a+b,0)
                  return (
                    <div key={c} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ fontFamily:'Barlow Condensed',fontWeight:700,fontSize:16,minWidth:36,color:'var(--text2)' }}>{c}</div>
                      <div style={{ flex:1,display:'flex',gap:4,flexWrap:'wrap' }}>
                        {Object.keys(cmap[c]).sort((a,b)=>cmap[c][b]-cmap[c][a]).map(pt=>(
                          <span key={pt} style={{ fontSize:11,padding:'2px 6px',borderRadius:3,background:ptColor(pt,allCustomPitches)+'20',color:ptColor(pt,allCustomPitches),fontFamily:'Barlow Condensed',fontWeight:600 }}>
                            {ptLabel(pt,allCustomPitches)} {Math.round(cmap[c][pt]/t*100)}%
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize:11,color:'var(--text3)' }}>{t}p</span>
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
                pitches.filter(p=>p.pitch).forEach(p=>p.sits?.forEach(s=>{if(!smap[s])smap[s]={};smap[s][p.pitch]=(smap[s][p.pitch]||0)+1}))
                const situations = Object.keys(smap)
                if(!situations.length) return <div style={{color:'var(--text3)',fontSize:13}}>No data.</div>
                return situations.map(s => {
                  const t=Object.values(smap[s]).reduce((a,b)=>a+b,0)
                  return (
                    <div key={s} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11,color:'var(--text3)',marginBottom:4 }}>{s}</div>
                      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                        {Object.keys(smap[s]).sort((a,b)=>smap[s][b]-smap[s][a]).map(pt=>(
                          <span key={pt} style={{ fontSize:11,padding:'2px 6px',borderRadius:3,background:ptColor(pt,allCustomPitches)+'20',color:ptColor(pt,allCustomPitches),fontFamily:'Barlow Condensed',fontWeight:600 }}>
                            {ptLabel(pt,allCustomPitches)} {Math.round(smap[s][pt]/t*100)}%
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

        {!selectedPitcher && pitchers.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:14 }}>
            ← Select a pitcher to view tendencies
          </div>
        )}
      </div>
    </div>
  )
}
