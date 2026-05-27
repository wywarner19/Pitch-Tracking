import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { saveGame, loadGames, isSupabaseConfigured } from '../lib/supabase'
import { localLoadGames, localSaveGame } from '../lib/store'
import { exportPDF, exportExcel } from '../lib/exportUtils'
import PitcherAutocomplete from '../components/PitcherAutocomplete'

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

const RESULTS = [
  { id: 'Called strike', label: 'Called ✓', type: 'strike' },
  { id: 'Swinging strike', label: 'Swing ✗', type: 'whiff' },
  { id: 'Foul', label: 'Foul', type: 'strike' },
  { id: 'Ball', label: 'Ball', type: 'ball' },
  { id: 'In play — out', label: 'In play (out)', type: 'out' },
  { id: 'In play — hit', label: 'In play (hit)', type: 'hit' },
  { id: 'HBP', label: 'HBP', type: 'hbp' },
]

const AB_ENDING_RESULTS = ['In play — out', 'In play — hit', 'HBP']
const STRIKEOUT_RESULTS = ['Called strike', 'Swinging strike']

const SITUATIONS = [
  '1st time through order', '2nd time through order', '3rd time through order',
  'Runners on', 'RISP', 'Bases loaded',
  'Up 1–2 runs', 'Up 3+ runs', 'Down 1–2 runs', 'Down 3+ runs', 'Tie game',
  'Late innings (7+)', 'Lead-off AB', '2 outs',
]

const AUTO_SITS = [
  '1st time through order', '2nd time through order', '3rd time through order',
  'Up 1–2 runs', 'Up 3+ runs', 'Down 1–2 runs', 'Down 3+ runs', 'Tie game',
  'Late innings (7+)', 'Runners on', 'RISP', 'Bases loaded',
]

function ptColor(id) { return PITCH_TYPES.find(p => p.id === id)?.color || '#888' }
function ptLabel(id) { return PITCH_TYPES.find(p => p.id === id)?.label || id }

export default function GameDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState(null)
  const [tab, setTab] = useState('log')
  const [saving, setSaving] = useState(false)

  // Log state
  const [balls, setBalls] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [hand, setHand] = useState('R')
  const [pitch, setPitch] = useState(null)
  const [result, setResult] = useState(null)
  const [loc, setLoc] = useState(null)
  const [sits, setSits] = useState(['1st time through order', 'Tie game'])
  const [batterNum, setBatterNum] = useState(1)
  const [inning, setInning] = useState(1)
  const [inningHalf, setInningHalf] = useState('top')
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [bases, setBases] = useState([false, false, false])
  const [outs, setOuts] = useState(0)
  const [showPitcherSwitch, setShowPitcherSwitch] = useState(false)
  const [switchForm, setSwitchForm] = useState({ name: '', number: '', throws: 'R' })
  const [showEditPitcher, setShowEditPitcher] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', number: '', throws: 'R' })
  const [selectedPitches, setSelectedPitches] = useState(new Set())
  const [showReassign, setShowReassign] = useState(false)
  const [reassignName, setReassignName] = useState('')

  // Filter state
  const [fHand, setFHand] = useState('All')
  const [fCount, setFCount] = useState('All')
  const [fSit, setFSit] = useState('All')
  const [fPitch, setFPitch] = useState('All')
  const [fResult, setFResult] = useState('All')
  const [hmPitch, setHmPitch] = useState('All')
  const [hmCount, setHmCount] = useState('All')
  const [hmHand, setHmHand] = useState('All')
  const [hmResult, setHmResult] = useState('All')

  const zoneRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    async function fetch() {
      let g
      if (isSupabaseConfigured()) {
        const { data } = await loadGames()
        g = (data || []).find(x => x.id === id)
      } else {
        g = localLoadGames().find(x => x.id === id)
      }
      if (!g) { navigate('/'); return }
      setGame(g)
    }
    fetch()
  }, [id])

  const debouncedSave = useCallback((updatedGame) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      if (isSupabaseConfigured()) await saveGame(updatedGame)
      else localSaveGame(updatedGame)
      setSaving(false)
    }, 800)
  }, [])

  // Immediate save — used for one-shot changes like editing pitcher info
  async function immediateSave(updatedGame) {
    setSaving(true)
    clearTimeout(saveTimer.current) // cancel any pending debounced save
    if (isSupabaseConfigured()) await saveGame(updatedGame)
    else localSaveGame(updatedGame)
    setSaving(false)
  }

  function getTimeThrough(num) {
    if (num <= 9) return '1st time through order'
    if (num <= 18) return '2nd time through order'
    return '3rd time through order'
  }

  function getScoreSit(my, opp) {
    const diff = my - opp
    if (diff === 0) return 'Tie game'
    if (diff >= 1 && diff <= 2) return 'Up 1–2 runs'
    if (diff > 2) return 'Up 3+ runs'
    if (diff <= -1 && diff >= -2) return 'Down 1–2 runs'
    return 'Down 3+ runs'
  }

  function isLateInning(inn) { return inn >= 5 }

  function buildAutoSits(batNum, inn, my, opp, manualSits, currentBases) {
    const manual = manualSits.filter(s => !AUTO_SITS.includes(s))
    const auto = [getTimeThrough(batNum), getScoreSit(my, opp)]
    if (isLateInning(inn)) auto.push('Late innings (7+)')
    const b = currentBases || [false, false, false]
    const anyOn = b[0] || b[1] || b[2]
    const risp = b[1] || b[2]
    const loaded = b[0] && b[1] && b[2]
    if (loaded) auto.push('Bases loaded')
    else if (risp) auto.push('RISP')
    else if (anyOn) auto.push('Runners on')
    return [...auto, ...manual]
  }

  function incrementBatter(newBases) {
    const next = batterNum + 1
    setBatterNum(next)
    const b = newBases !== undefined ? newBases : bases
    setSits(prev => buildAutoSits(next, inning, myScore, oppScore, prev, b))
    setBalls(0)
    setStrikes(0)
  }

  function decrementBatter() {
    const next = Math.max(1, batterNum - 1)
    setBatterNum(next)
    setSits(prev => buildAutoSits(next, inning, myScore, oppScore, prev, bases))
  }

  function updateInning(val) {
    const inn = Math.max(1, Math.min(9, val))
    setInning(inn)
    setSits(prev => buildAutoSits(batterNum, inn, myScore, oppScore, prev, bases))
  }

  function updateScore(my, opp) {
    setMyScore(my)
    setOppScore(opp)
    setSits(prev => buildAutoSits(batterNum, inning, my, opp, prev, bases))
  }

  function advanceBases(res, currentBases, currentOuts) {
    let newBases = [...currentBases]
    let newOuts = currentOuts
    if (res === 'In play — out' || res === 'strikeout') {
      newOuts += 1
    } else if (res === 'In play — hit') {
      newBases[2] = newBases[1]
      newBases[1] = newBases[0]
      newBases[0] = true
    } else if (res === 'HBP' || res === 'walk') {
      if (newBases[0]) {
        if (newBases[1]) { newBases[2] = true }
        newBases[1] = newBases[0]
      }
      newBases[0] = true
    }
    if (newOuts >= 3) {
      return { newBases: [false, false, false], newOuts: 0, inningOver: true }
    }
    return { newBases, newOuts, inningOver: false }
  }

  function addPitch() {
    if (!pitch || !result || !loc) return
    const p = {
      id: Date.now(),
      count: `${balls}-${strikes}`,
      hand, pitch, result,
      loc: { x: loc.x, y: loc.y },
      sits: [...sits],
      batterNum, inning, inningHalf,
      score: { my: myScore, opp: oppScore },
      bases: [...bases],
      outs,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    const updated = { ...game, pitches: [...(game.pitches || []), p] }
    setGame(updated)
    debouncedSave(updated)

    let abEnded = false
    let abResult = null

    if (AB_ENDING_RESULTS.includes(result)) {
      abEnded = true
      abResult = result
    } else if (result === 'Ball' && balls === 3) {
      abEnded = true
      abResult = 'walk'
    } else if (STRIKEOUT_RESULTS.includes(result) && strikes === 2) {
      abEnded = true
      abResult = 'strikeout'
    }

    if (abEnded) {
      const { newBases, newOuts, inningOver } = advanceBases(abResult, bases, outs)
      setBases(newBases)
      setOuts(newOuts)
      if (inningOver) {
        const nextInn = inningHalf === 'bot' ? inning + 1 : inning
        const nextHalf = inningHalf === 'top' ? 'bot' : 'top'
        setInning(nextInn)
        setInningHalf(nextHalf)
        const clearedBases = [false, false, false]
        const nextBatter = batterNum + 1
        setBatterNum(nextBatter)
        setBalls(0)
        setStrikes(0)
        setSits(prev => buildAutoSits(nextBatter, nextInn, myScore, oppScore, prev, clearedBases))
      } else {
        const nextBatter = batterNum + 1
        setBatterNum(nextBatter)
        setBalls(0)
        setStrikes(0)
        setSits(prev => buildAutoSits(nextBatter, inning, myScore, oppScore, prev, newBases))
      }
    } else {
      advanceCount(result)
    }

    setLoc(null)
    setPitch(null)
    setResult(null)
  }

  function deletePitch(pid) {
    const updated = { ...game, pitches: (game.pitches || []).filter(p => p.id !== pid) }
    setGame(updated)
    debouncedSave(updated)
  }

  function advanceCount(res) {
    if (['Called strike', 'Swinging strike'].includes(res)) {
      if (strikes < 2) setStrikes(s => s + 1)
    } else if (res === 'Ball') {
      if (balls < 3) setBalls(b => b + 1)
    } else if (res === 'Foul') {
      if (strikes < 2) setStrikes(s => s + 1)
    }
  }

  function toggleSit(s) {
    if (AUTO_SITS.includes(s)) return
    setSits(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function handleZoneClick(e) {
    const rect = zoneRef.current.getBoundingClientRect()
    setLoc({
      x: parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(1)),
      y: parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(1)),
    })
  }

  function getFiltered() {
    return (game?.pitches || []).filter(p => {
      if (fHand !== 'All' && p.hand !== fHand) return false
      if (fCount !== 'All' && p.count !== fCount) return false
      if (fSit !== 'All' && !p.sits.includes(fSit)) return false
      return true
    })
  }

  function getHmFiltered() {
    return (game?.pitches || []).filter(p => {
      if (hmHand !== 'All' && p.hand !== hmHand) return false
      if (hmPitch !== 'All' && p.pitch !== hmPitch) return false
      if (hmCount !== 'All' && p.count !== hmCount) return false
      if (hmResult !== 'All' && p.result !== hmResult) return false
      return true
    })
  }

  function getFeedFiltered() {
    return (game?.pitches || []).filter(p => {
      if (fPitch !== 'All' && p.pitch !== fPitch) return false
      if (fResult !== 'All' && p.result !== fResult) return false
      return true
    }).slice().reverse()
  }

  function handleExportPDF() { if (game) exportPDF(game) }
  function handleExportExcel() { if (game) exportExcel(game) }

  function switchPitcher() {
    if (!switchForm.name.trim()) return
    const updated = {
      ...game,
      pitcher_name: switchForm.name.trim(),
      pitcher_number: switchForm.number,
      pitcher_throws: switchForm.throws,
    }
    setGame(updated)
    immediateSave(updated)
    setBalls(0); setStrikes(0)
    setBatterNum(1)
    setBases([false, false, false])
    setOuts(0)
    setSits(buildAutoSits(1, inning, myScore, oppScore, [], [false, false, false]))
    setShowPitcherSwitch(false)
    setSwitchForm({ name: '', number: '', throws: 'R' })
  }

  function openEditPitcher() {
    setEditForm({
      name: game.pitcher_name || '',
      number: game.pitcher_number || '',
      throws: game.pitcher_throws || 'R',
    })
    setShowEditPitcher(true)
  }

  function saveEditPitcher() {
    if (!editForm.name.trim()) return
    const updated = {
      ...game,
      pitcher_name: editForm.name.trim(),
      pitcher_number: editForm.number,
      pitcher_throws: editForm.throws,
    }
    setGame(updated)
    immediateSave(updated)
    setShowEditPitcher(false)
  }

  function togglePitchSelect(pid) {
    setSelectedPitches(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  function reassignPitches() {
    if (!reassignName.trim() || selectedPitches.size === 0) return
    const updated = {
      ...game,
      pitches: (game.pitches || []).map(p =>
        selectedPitches.has(p.id)
          ? { ...p, pitcherName: reassignName.trim() }
          : p
      ),
    }
    setGame(updated)
    immediateSave(updated)
    setSelectedPitches(new Set())
    setReassignName('')
    setShowReassign(false)
  }

  if (!game) return <div style={{ padding: '3rem', color: 'var(--text2)' }}>Loading…</div>

  const allPitches = game.pitches || []
  const fp = getFiltered()
  const total = fp.length
  const strikeCount = fp.filter(p => ['Called strike','Swinging strike','Foul'].includes(p.result)).length
  const whiffs = fp.filter(p => p.result === 'Swinging strike').length
  const swings = fp.filter(p => ['Swinging strike','Foul','In play — out','In play — hit'].includes(p.result)).length
  const tabs = ['log','tendencies','heatmap','feed']
  const inningLabel = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][inning-1] || `${inning}th`

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>← All games</Link>
          <button className="btn btn-sm btn-primary" onClick={async () => {
            if (game) {
              setSaving(true)
              clearTimeout(saveTimer.current)
              if (isSupabaseConfigured()) await saveGame(game)
              else localSaveGame(game)
              setSaving(false)
            }
            navigate('/')
          }}>
            ✓ Save & Exit
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700 }}>{game.pitcher_name}</h1>
              {game.pitcher_number && <span className="tag tag-gray">#{game.pitcher_number}</span>}
              <span className={`tag ${game.pitcher_throws === 'L' ? 'tag-blue' : 'tag-gold'}`}>{game.pitcher_throws}HP</span>
              <button onClick={openEditPitcher} title="Edit pitcher info" style={{
                border: '1px solid var(--border2)', borderRadius: 6,
                background: 'transparent', color: 'var(--text3)',
                padding: '3px 8px', fontSize: 12, cursor: 'pointer',
              }}>✏ Edit</button>
              {saving && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Saving…</span>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>
              {game.my_team} <span style={{ color: 'var(--text3)' }}>vs</span> {game.opponent} · {game.date}
            </div>
            {game.notes && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{game.notes}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={() => setShowPitcherSwitch(true)}>⇄ Switch Pitcher</button>
            <button className="btn btn-sm" onClick={handleExportPDF}>↓ PDF</button>
            <button className="btn btn-sm" onClick={handleExportExcel}>↓ Excel</button>
            <span className="tag tag-gold" style={{ alignSelf: 'center' }}>{allPitches.length} pitches</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px',
            fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            border: 'none',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text2)',
            transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* ── LOG TAB ── */}
      {tab === 'log' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Count */}
            <div className="card">
              <div className="section-label">Count</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Balls</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2,3].map(n => (
                    <button key={n} onClick={() => setBalls(n)} style={{
                      flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600,
                      border: `1px solid ${balls === n ? 'var(--green)' : 'var(--border2)'}`,
                      borderRadius: 6, background: balls === n ? 'rgba(76,175,125,0.15)' : 'transparent',
                      color: balls === n ? 'var(--green)' : 'var(--text2)',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Strikes</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2].map(n => (
                    <button key={n} onClick={() => setStrikes(n)} style={{
                      flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600,
                      border: `1px solid ${strikes === n ? 'var(--red)' : 'var(--border2)'}`,
                      borderRadius: 6, background: strikes === n ? 'rgba(224,82,82,0.15)' : 'transparent',
                      color: strikes === n ? 'var(--red)' : 'var(--text2)',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 10, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {balls}-{strikes}
              </div>
            </div>

            {/* Batter handedness */}
            <div className="card">
              <div className="section-label">Batter</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['R','L'].map(h => (
                  <button key={h} onClick={() => setHand(h)} style={{
                    flex: 1, padding: '8px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
                    border: `1px solid ${hand === h ? 'var(--accent)' : 'var(--border2)'}`,
                    borderRadius: 6, background: hand === h ? 'rgba(212,168,67,0.15)' : 'transparent',
                    color: hand === h ? 'var(--accent)' : 'var(--text2)',
                  }}>{h}HH</button>
                ))}
              </div>
            </div>

            {/* Game state card */}
            <div className="card">
              <div className="section-label">Game state</div>

              {/* Score */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Score</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3, textAlign: 'center' }}>{game.my_team || 'Us'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => updateScore(Math.max(0, myScore - 1), oppScore)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>−</button>
                      <div style={{ flex: 1, textAlign: 'center', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 26, color: myScore > oppScore ? 'var(--green)' : myScore < oppScore ? 'var(--red)' : 'var(--text)' }}>{myScore}</div>
                      <button onClick={() => updateScore(myScore + 1, oppScore)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--text3)' }}>–</div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3, textAlign: 'center' }}>{game.opponent || 'Them'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => updateScore(myScore, Math.max(0, oppScore - 1))} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>−</button>
                      <div style={{ flex: 1, textAlign: 'center', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 26, color: oppScore > myScore ? 'var(--green)' : oppScore < myScore ? 'var(--red)' : 'var(--text)' }}>{oppScore}</div>
                      <button onClick={() => updateScore(myScore, oppScore + 1)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, textAlign: 'center', padding: '4px 8px', borderRadius: 5, background: myScore > oppScore ? 'rgba(76,175,125,0.15)' : myScore < oppScore ? 'rgba(224,82,82,0.15)' : 'rgba(138,145,168,0.15)', color: myScore > oppScore ? 'var(--green)' : myScore < oppScore ? 'var(--red)' : 'var(--text2)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13 }}>
                  {getScoreSit(myScore, oppScore)}
                </div>
              </div>

              {/* Inning */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Inning</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateInning(inning - 1)} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 22, color: isLateInning(inning) ? 'var(--accent)' : 'var(--text)' }}>{inning}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>{inningLabel}</span>
                  </div>
                  <button onClick={() => updateInning(inning + 1)} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 16, cursor: 'pointer' }}>+</button>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['top','bot'].map(h => (
                      <button key={h} onClick={() => setInningHalf(h)} style={{ padding: '5px 8px', fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 600, border: `1px solid ${inningHalf === h ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 5, background: inningHalf === h ? 'rgba(212,168,67,0.15)' : 'transparent', color: inningHalf === h ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>{h.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                {isLateInning(inning) && (
                  <div style={{ marginTop: 6, textAlign: 'center', fontSize: 11, color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>⚠ LATE INNING</div>
                )}
              </div>

              {/* Baserunners */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Runners</div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Outs:</span>
                    {[0,1,2].map(n => (
                      <div key={n} onClick={() => setOuts(n)} style={{ width: 14, height: 14, borderRadius: '50%', cursor: 'pointer', border: `1.5px solid ${n < outs ? 'var(--accent)' : 'var(--border2)'}`, background: n < outs ? 'var(--accent)' : 'transparent' }} />
                    ))}
                  </div>
                </div>
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
                  {[
                    { label: '2B', style: { top: 0, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }, idx: 1 },
                    { label: '3B', style: { top: '50%', left: 0, transform: 'translateY(-50%) rotate(45deg)' }, idx: 2 },
                    { label: '1B', style: { top: '50%', right: 0, transform: 'translateY(-50%) rotate(45deg)' }, idx: 0 },
                    { label: 'HP', style: { bottom: 0, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }, idx: -1 },
                  ].map(b => (
                    <div key={b.label} onClick={() => {
                      if (b.idx < 0) return
                      const nb = [...bases]
                      nb[b.idx] = !nb[b.idx]
                      setBases(nb)
                      setSits(prev => buildAutoSits(batterNum, inning, myScore, oppScore, prev, nb))
                    }} style={{
                      position: 'absolute', width: 20, height: 20,
                      ...b.style,
                      background: b.idx >= 0 && bases[b.idx] ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${b.idx >= 0 && bases[b.idx] ? 'var(--accent)' : 'var(--border2)'}`,
                      cursor: b.idx >= 0 ? 'pointer' : 'default',
                      borderRadius: 2,
                    }} />
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  {bases[0] || bases[1] || bases[2]
                    ? [bases[2] && '3rd', bases[1] && '2nd', bases[0] && '1st'].filter(Boolean).join(', ')
                    : 'Bases empty'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 2 }}>tap base to adjust</div>
              </div>

              {/* Batter # */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Batter faced</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button onClick={decrementBatter} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <div style={{ flex: 1, textAlign: 'center', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 24, color: 'var(--text)', lineHeight: 1 }}>{batterNum}</div>
                  <button onClick={incrementBatter} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ textAlign: 'center', padding: '5px 8px', borderRadius: 5, background: batterNum <= 9 ? 'rgba(76,175,125,0.15)' : batterNum <= 18 ? 'rgba(212,168,67,0.15)' : 'rgba(224,82,82,0.15)', color: batterNum <= 9 ? 'var(--green)' : batterNum <= 18 ? 'var(--accent)' : 'var(--red)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13 }}>
                  {getTimeThrough(batterNum)}
                  <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 6, opacity: 0.7 }}>
                    {batterNum <= 9 ? `(${10 - batterNum} left)` : batterNum <= 18 ? `(${19 - batterNum} left)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Situation */}
            <div className="card">
              <div className="section-label">Situation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SITUATIONS.map(s => {
                  const isAuto = AUTO_SITS.includes(s)
                  const isActive = sits.includes(s)
                  return (
                    <button key={s} onClick={() => toggleSit(s)} style={{
                      padding: '5px 8px', textAlign: 'left', fontSize: 12,
                      border: `1px solid ${isActive ? 'var(--blue)' : 'var(--border)'}`,
                      borderRadius: 5,
                      background: isActive ? 'rgba(74,143,232,0.12)' : 'transparent',
                      color: isActive ? 'var(--blue)' : 'var(--text2)',
                      opacity: isAuto ? 0.5 : 1,
                      cursor: isAuto ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      {s}
                      {isAuto && <span style={{ fontSize: 10, color: 'var(--text3)' }}>auto</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Pitch type */}
            <div className="card">
              <div className="section-label">Pitch type</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {PITCH_TYPES.map(pt => (
                  <button key={pt.id} onClick={() => setPitch(pt.id)} style={{
                    padding: '8px 6px', fontSize: 13, fontFamily: 'Barlow Condensed', fontWeight: 600,
                    border: `1px solid ${pitch === pt.id ? pt.color : 'var(--border2)'}`,
                    borderRadius: 6,
                    background: pitch === pt.id ? pt.color + '28' : 'transparent',
                    color: pitch === pt.id ? pt.color : 'var(--text2)',
                  }}>{pt.label}</button>
                ))}
              </div>
            </div>

            {/* Strike zone */}
            <div className="card">
              <div className="section-label">Location — click to place</div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div ref={zoneRef} onClick={handleZoneClick} style={{ width: 200, height: 200, border: '2px solid var(--border2)', borderRadius: 6, position: 'relative', cursor: 'crosshair', background: 'var(--bg3)', flexShrink: 0 }}>
                  {[33, 66].map(p => (
                    <div key={p} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, borderTop: '1px dashed var(--border2)' }} />
                  ))}
                  {[33, 66].map(p => (
                    <div key={p} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, borderLeft: '1px dashed var(--border2)' }} />
                  ))}
                  <div style={{ position: 'absolute', left: '20%', top: '15%', width: '60%', height: '70%', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 3, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 3, left: 4, fontSize: 9, color: 'var(--text3)' }}>In</div>
                  <div style={{ position: 'absolute', top: 3, right: 4, fontSize: 9, color: 'var(--text3)' }}>Out</div>
                  <div style={{ position: 'absolute', bottom: 3, left: 4, fontSize: 9, color: 'var(--text3)' }}>Low</div>
                  {allPitches.slice(-20).map(p => (
                    <div key={p.id} style={{ position: 'absolute', width: 9, height: 9, borderRadius: '50%', background: ptColor(p.pitch), opacity: 0.5, left: `${p.loc.x}%`, top: `${p.loc.y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
                  ))}
                  {loc && (
                    <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', border: `2px solid ${pitch ? ptColor(pitch) : 'var(--accent)'}`, background: (pitch ? ptColor(pitch) : 'var(--accent)') + '40', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Recent pitches</div>
                  {allPitches.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>None yet</div>}
                  {allPitches.slice(-8).reverse().map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ptColor(p.pitch), flexShrink: 0 }} />
                      <span style={{ color: ptColor(p.pitch) }}>{ptLabel(p.pitch)}</span>
                      <span style={{ color: 'var(--text3)' }}>{p.count}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 'auto' }}>{i === 0 ? 'latest' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="card">
              <div className="section-label">Result</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {RESULTS.map(r => {
                  const colors = { strike: 'var(--red)', whiff: '#e05252', ball: 'var(--green)', out: 'var(--accent)', hit: 'var(--blue)', hbp: '#a855f7' }
                  const c = colors[r.type] || 'var(--text2)'
                  return (
                    <button key={r.id} onClick={() => setResult(r.id)} style={{
                      padding: '8px 6px', fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 600,
                      border: `1px solid ${result === r.id ? c : 'var(--border2)'}`,
                      borderRadius: 6,
                      background: result === r.id ? c + '20' : 'transparent',
                      color: result === r.id ? c : 'var(--text2)',
                    }}>{r.label}</button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addPitch} disabled={!pitch || !result || !loc} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px', opacity: (!pitch || !result || !loc) ? 0.45 : 1 }}>
                + Log Pitch
              </button>
              <button className="btn" onClick={() => { setPitch(null); setResult(null); setLoc(null); setSits(buildAutoSits(batterNum, inning, myScore, oppScore, [], bases)) }}>Clear</button>
            </div>
            {(!pitch || !result || !loc) && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {!pitch && '· Select pitch type  '}{!loc && '· Click the zone  '}{!result && '· Select result'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TENDENCIES TAB ── */}
      {tab === 'tendencies' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="section-label">Filter</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Batter</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['All','R','L'].map(h => (
                    <button key={h} onClick={() => setFHand(h)} style={{ flex: 1, padding: '6px 4px', fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 600, border: `1px solid ${fHand === h ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 5, background: fHand === h ? 'rgba(212,168,67,0.15)' : 'transparent', color: fHand === h ? 'var(--accent)' : 'var(--text2)' }}>{h}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Count</div>
                <select value={fCount} onChange={e => setFCount(e.target.value)} style={{ fontSize: 13 }}>
                  <option value="All">All counts</option>
                  {['0-0','0-1','0-2','1-0','1-1','1-2','2-0','2-1','2-2','3-0','3-1','3-2'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Situation</div>
                <select value={fSit} onChange={e => setFSit(e.target.value)} style={{ fontSize: 13 }}>
                  <option value="All">All situations</option>
                  {SITUATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'Total pitches', value: total },
                { label: 'Strike %', value: total ? Math.round(strikeCount/total*100)+'%' : '—' },
                { label: 'Whiff %', value: swings ? Math.round(whiffs/swings*100)+'%' : '—' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="section-label">Pitch mix</div>
              {total === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>No pitches match this filter.</div> : (() => {
                const counts = {}
                fp.forEach(p => counts[p.pitch] = (counts[p.pitch] || 0) + 1)
                return Object.keys(counts).sort((a,b) => counts[b]-counts[a]).map(pt => {
                  const n = counts[pt], pct = Math.round(n/total*100)
                  const sk = fp.filter(p => p.pitch===pt && ['Called strike','Swinging strike','Foul'].includes(p.result)).length
                  const wh = fp.filter(p => p.pitch===pt && p.result==='Swinging strike').length
                  const sw = fp.filter(p => p.pitch===pt && ['Swinging strike','Foul','In play — out','In play — hit'].includes(p.result)).length
                  const c = ptColor(pt)
                  return (
                    <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <div style={{ minWidth: 80, fontSize: 14, fontFamily: 'Barlow Condensed', fontWeight: 600 }}>{ptLabel(pt)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, color: c }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', minWidth: 90, textAlign: 'right' }}>
                        K%: {Math.round(sk/n*100)}% · Whiff%: {sw ? Math.round(wh/sw*100) : 0}%
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
            <div className="card">
              <div className="section-label">By count</div>
              {(() => {
                const cmap = {}
                fp.forEach(p => { if (!cmap[p.count]) cmap[p.count] = {}; cmap[p.count][p.pitch] = (cmap[p.count][p.pitch] || 0) + 1 })
                const counted = Object.keys(cmap).sort()
                if (!counted.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No data yet.</div>
                return counted.map(c => {
                  const t = Object.values(cmap[c]).reduce((a,b) => a+b, 0)
                  return (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, minWidth: 40, color: 'var(--text2)' }}>{c}</div>
                      <div style={{ flex: 1, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {Object.keys(cmap[c]).sort((a,b) => cmap[c][b]-cmap[c][a]).map(pt => (
                          <span key={pt} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, background: ptColor(pt)+'20', color: ptColor(pt), fontFamily: 'Barlow Condensed', fontWeight: 600 }}>
                            {ptLabel(pt)} {Math.round(cmap[c][pt]/t*100)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
            <div className="card">
              <div className="section-label">By situation</div>
              {(() => {
                const smap = {}
                fp.forEach(p => p.sits.forEach(s => { if (!smap[s]) smap[s] = {}; smap[s][p.pitch] = (smap[s][p.pitch] || 0) + 1 }))
                const situations = Object.keys(smap)
                if (!situations.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No situation data yet.</div>
                return situations.map(s => {
                  const t = Object.values(smap[s]).reduce((a,b) => a+b, 0)
                  return (
                    <div key={s} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>{s}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {Object.keys(smap[s]).sort((a,b) => smap[s][b]-smap[s][a]).map(pt => (
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
        </div>
      )}

      {/* ── HEATMAP TAB ── */}
      {tab === 'heatmap' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="section-label">Filter</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Pitch type', value: hmPitch, set: setHmPitch, opts: ['All',...PITCH_TYPES.map(p=>p.id)], labels: {'All':'All',...Object.fromEntries(PITCH_TYPES.map(p=>[p.id,p.label]))} },
                { label: 'Count', value: hmCount, set: setHmCount, opts: ['All','0-0','0-1','0-2','1-0','1-1','1-2','2-0','2-1','2-2','3-0','3-1','3-2'] },
                { label: 'Result', value: hmResult, set: setHmResult, opts: ['All',...RESULTS.map(r=>r.id)] },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>{f.label}</div>
                  <select value={f.value} onChange={e => f.set(e.target.value)} style={{ fontSize: 13 }}>
                    {f.opts.map(o => <option key={o} value={o}>{f.labels?.[o] || o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Batter</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['All','R','L'].map(h => (
                    <button key={h} onClick={() => setHmHand(h)} style={{ flex: 1, padding: '6px 4px', fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 600, border: `1px solid ${hmHand === h ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 5, background: hmHand === h ? 'rgba(212,168,67,0.15)' : 'transparent', color: hmHand === h ? 'var(--accent)' : 'var(--text2)' }}>{h}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="section-label" style={{ marginBottom: 14 }}>Pitch location heat map · {getHmFiltered().length} pitches</div>
            {(() => {
              const hfp = getHmFiltered()
              const cols = 6, rows = 6, sz = 100/cols
              const grid = new Array(rows*cols).fill(0)
              hfp.forEach(p => {
                const cx = Math.min(Math.floor(p.loc.x/sz), cols-1)
                const cy = Math.min(Math.floor(p.loc.y/sz), rows-1)
                grid[cy*cols+cx]++
              })
              const mx = Math.max(...grid) || 1
              return (
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                  <div style={{ position: 'relative', width: 240, height: 240, flexShrink: 0, border: '1.5px solid var(--border2)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg3)' }}>
                    {grid.map((v, i) => {
                      const c = Math.floor(i % cols), r = Math.floor(i / cols)
                      const pct = v / mx
                      const alpha = pct * 0.9
                      const red = Math.round(55+pct*167), green = Math.round(138-pct*95), blue = Math.round(221-pct*175)
                      return (
                        <div key={i} style={{ position: 'absolute', left: `${c*sz}%`, top: `${r*sz}%`, width: `${sz}%`, height: `${sz}%`, background: v ? `rgba(${red},${green},${blue},${alpha.toFixed(2)})` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: pct > 0.5 ? '#fff' : 'var(--text2)' }}>{v > 0 ? v : ''}</div>
                      )
                    })}
                    <div style={{ position: 'absolute', left: '20%', top: '15%', width: '60%', height: '70%', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 3, pointerEvents: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Zone legend</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <div style={{ width: 100, height: 8, background: 'linear-gradient(to right,rgba(55,138,221,0.2),rgba(222,43,46,0.9))', borderRadius: 4 }} />
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Low → High freq</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Pitch breakdown</div>
                    {(() => {
                      const counts = {}
                      hfp.forEach(p => counts[p.pitch] = (counts[p.pitch]||0)+1)
                      return Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).map(pt => (
                        <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ptColor(pt) }} />
                          <span style={{ fontSize: 12, color: ptColor(pt), fontFamily: 'Barlow Condensed', fontWeight: 600 }}>{ptLabel(pt)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{counts[pt]} ({Math.round(counts[pt]/hfp.length*100)}%)</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── FEED TAB ── */}
      {tab === 'feed' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="section-label">Filter</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Pitch type</div>
                <select value={fPitch} onChange={e => setFPitch(e.target.value)} style={{ fontSize: 13 }}>
                  <option value="All">All</option>
                  {PITCH_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Result</div>
                <select value={fResult} onChange={e => setFResult(e.target.value)} style={{ fontSize: 13 }}>
                  <option value="All">All</option>
                  {RESULTS.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                </select>
              </div>
              {selectedPitches.size > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8, fontWeight: 500 }}>
                    {selectedPitches.size} pitch{selectedPitches.size !== 1 ? 'es' : ''} selected
                  </div>
                  <button className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }} onClick={() => setShowReassign(true)}>
                    Reassign Pitcher
                  </button>
                  <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedPitches(new Set())}>
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>{getFeedFiltered().length} pitches</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tap pitch to select for reassignment</div>
            </div>
            {getFeedFiltered().length === 0
              ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>No pitches yet.</div>
              : getFeedFiltered().map((p) => {
                  const rColor = ['Called strike','Swinging strike','In play — out'].includes(p.result) ? 'var(--green)'
                    : p.result === 'Ball' ? 'var(--red)'
                    : p.result === 'In play — hit' ? 'var(--blue)'
                    : p.result === 'HBP' ? '#a855f7'
                    : 'var(--text3)'
                  const isSelected = selectedPitches.has(p.id)
                  return (
                    <div key={p.id} onClick={() => togglePitchSelect(p.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 6, marginBottom: 2,
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                      background: isSelected ? 'rgba(212,168,67,0.08)' : 'transparent',
                      cursor: 'pointer', flexWrap: 'wrap',
                    }}>
                      {/* Selection checkbox */}
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border2)'}`,
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <span style={{ fontSize: 10, color: '#0f1117', fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 28 }}>#{allPitches.length - allPitches.findIndex(x => x.id === p.id)}</span>
                      {p.pitcherName && p.pitcherName !== game.pitcher_name && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(212,168,67,0.15)', color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>{p.pitcherName}</span>
                      )}
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: ptColor(p.pitch)+'20', color: ptColor(p.pitch), fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 600 }}>{ptLabel(p.pitch)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'Barlow Condensed', fontWeight: 600 }}>{p.count}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.hand}HH</span>
                      <span style={{ fontSize: 12, color: rColor }}>{p.result}</span>
                      {p.inning && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Inn {p.inning}</span>}
                      {p.sits && p.sits.slice(0,2).map(s => <span key={s} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(74,143,232,0.1)', color: 'var(--blue)' }}>{s}</span>)}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{p.ts}</span>
                      <button onClick={e => { e.stopPropagation(); deletePitch(p.id) }} style={{ border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>
                    </div>
                  )
                })
            }
          </div>
        </div>
      )}

      {/* ── PITCHER SWITCH MODAL ── */}
      {showPitcherSwitch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '1.75rem', width: 360, maxWidth: '90vw' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Switch Pitcher</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem' }}>
              Current: <strong style={{ color: 'var(--accent)' }}>{game.pitcher_name}</strong> — pitch history is preserved. Batter count resets for new pitcher.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>New pitcher name</div>
                <PitcherAutocomplete
                  value={switchForm.name}
                  onChange={v => setSwitchForm(f => ({ ...f, name: v }))}
                  onSelect={p => setSwitchForm({ name: p.name, number: p.number, throws: p.throws })}
                  placeholder="Search or type pitcher name"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Jersey #</div>
                  <input type="text" placeholder="#" value={switchForm.number} onChange={e => setSwitchForm(f => ({ ...f, number: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Throws</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['R','L'].map(h => (
                      <button key={h} onClick={() => setSwitchForm(f => ({ ...f, throws: h }))} style={{ flex: 1, padding: '8px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, border: `1px solid ${switchForm.throws === h ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 6, background: switchForm.throws === h ? 'rgba(212,168,67,0.15)' : 'transparent', color: switchForm.throws === h ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>{h}HP</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={switchPitcher} disabled={!switchForm.name.trim()}>Switch Pitcher</button>
              <button className="btn" onClick={() => setShowPitcherSwitch(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PITCHER MODAL ── */}
      {showEditPitcher && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '1.75rem', width: 360, maxWidth: '90vw' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Edit Pitcher</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem' }}>
              Fix a spelling mistake or update pitcher details. All pitches stay unchanged.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Pitcher name</div>
                <PitcherAutocomplete
                  value={editForm.name}
                  onChange={v => setEditForm(f => ({ ...f, name: v }))}
                  onSelect={p => setEditForm({ name: p.name, number: p.number, throws: p.throws })}
                  placeholder="Pitcher name"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Jersey #</div>
                  <input type="text" placeholder="#" value={editForm.number} onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Throws</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['R','L'].map(h => (
                      <button key={h} onClick={() => setEditForm(f => ({ ...f, throws: h }))} style={{ flex: 1, padding: '8px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, border: `1px solid ${editForm.throws === h ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 6, background: editForm.throws === h ? 'rgba(212,168,67,0.15)' : 'transparent', color: editForm.throws === h ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}>{h}HP</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveEditPitcher} disabled={!editForm.name.trim()}>Save Changes</button>
              <button className="btn" onClick={() => setShowEditPitcher(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REASSIGN PITCHES MODAL ── */}
      {showReassign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '1.75rem', width: 360, maxWidth: '90vw' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reassign Pitches</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem' }}>
              Reassigning <strong style={{ color: 'var(--accent)' }}>{selectedPitches.size} pitch{selectedPitches.size !== 1 ? 'es' : ''}</strong> to a different pitcher.
            </p>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>Assign to pitcher</div>
              <PitcherAutocomplete
                value={reassignName}
                onChange={v => setReassignName(v)}
                onSelect={p => setReassignName(p.name)}
                placeholder="Search or type pitcher name"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={reassignPitches} disabled={!reassignName.trim()}>Reassign</button>
              <button className="btn" onClick={() => setShowReassign(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
