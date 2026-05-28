import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveGame, isSupabaseConfigured } from '../lib/supabase'
import { localSaveGame } from '../lib/store'
import PitcherAutocomplete from '../components/PitcherAutocomplete'

export default function NewGame() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    mode: 'scouting', // 'scouting' | 'our_pitcher'
    my_team: '',
    opponent: '',
    home_away: 'away', // our team is home or away
    pitcher_name: '',
    pitcher_throws: 'R',
    pitcher_number: '',
    notes: '',
    pitches: [],
    pitchers: [], // array of pitcher entries
    game_state: {}, // persisted inning/score/batter state
    custom_pitches: [], // custom pitch types for this game
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Which team's pitcher are we tracking and which half do they pitch?
  // Scouting: tracking opponent's pitcher
  //   - If opponent is home → they pitch in bottom → we scout bottom
  //   - If opponent is away → they pitch in top → we scout top
  // Our pitcher: tracking our pitcher
  //   - If we are home → we pitch in bottom
  //   - If we are away → we pitch in top
  function getPitcherHalf() {
    if (form.mode === 'scouting') {
      // opponent pitches in: home=bottom, away=top
      // if our team is home, opponent is away → they pitch top
      return form.home_away === 'home' ? 'top' : 'bot'
    } else {
      // our pitcher: home=bottom, away=top
      return form.home_away === 'home' ? 'bot' : 'top'
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const teamLabel = form.mode === 'scouting' ? 'both teams' : 'your team and opponent'
    if (!form.my_team || !form.opponent || !form.pitcher_name) {
      alert(`Please fill in ${teamLabel} and pitcher name.`)
      return
    }
    setSaving(true)

    const pitcherEntry = {
      id: Date.now(),
      name: form.pitcher_name,
      number: form.pitcher_number,
      throws: form.pitcher_throws,
      startPitchIndex: 0,
    }

    const gameData = {
      ...form,
      pitchers: [pitcherEntry],
      pitcher_half: getPitcherHalf(),
      game_state: {
        inning: 1,
        inningHalf: getPitcherHalf(),
        myScore: 0,
        oppScore: 0,
        batterNum: 1,
        bases: [false, false, false],
        outs: 0,
        activePitcherId: pitcherEntry.id,
      },
    }

    let saved
    if (isSupabaseConfigured()) {
      const { data, error } = await saveGame(gameData)
      if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
      saved = data
    } else {
      saved = localSaveGame(gameData)
    }
    navigate(`/game/${saved.id}`)
  }

  const isScouting = form.mode === 'scouting'

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: '1.25rem' }}>← Back</button>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>New Game</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.75rem' }}>Set up the game, then log pitches inside.</p>

      <form onSubmit={handleSubmit}>

        {/* Mode */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label">What are you tracking?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: 'scouting', label: '🔭 Scouting', sub: 'Charting an opposing pitcher' },
              { val: 'our_pitcher', label: '⚾ Our Pitcher', sub: 'Tracking our own guy' },
            ].map(m => (
              <button key={m.val} type="button" onClick={() => set('mode', m.val)} style={{
                flex: 1, padding: '12px', textAlign: 'left',
                border: `1px solid ${form.mode === m.val ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 8, background: form.mode === m.val ? 'rgba(212,168,67,0.12)' : 'transparent',
                cursor: 'pointer',
              }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: form.mode === m.val ? 'var(--accent)' : 'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Game info */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label">Game info</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  {isScouting ? 'Team 1 (home)' : 'Your team'}
                </label>
                <input type="text" placeholder={isScouting ? 'e.g. Northside HS' : 'e.g. Northside HS'} value={form.my_team} onChange={e => set('my_team', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  {isScouting ? 'Team 2 (away)' : 'Opponent'}
                </label>
                <input type="text" placeholder="e.g. Westfield HS" value={form.opponent} onChange={e => set('opponent', e.target.value)} />
              </div>
            </div>

            {/* Home/Away */}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>
                {isScouting ? 'Pitcher being scouted is on which team?' : 'Your team is…'}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {isScouting ? [
                  { val: 'away', label: `Team 1 (home)`, sub: 'Pitches in bottom' },
                  { val: 'home', label: `Team 2 (away)`, sub: 'Pitches in top' },
                ] : [
                  { val: 'away', label: 'Away', sub: 'You pitch in top' },
                  { val: 'home', label: 'Home', sub: 'You pitch in bottom' },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => set('home_away', opt.val)} style={{
                    flex: 1, padding: '10px', textAlign: 'center',
                    border: `1px solid ${form.home_away === opt.val ? 'var(--accent)' : 'var(--border2)'}`,
                    borderRadius: 8, background: form.home_away === opt.val ? 'rgba(212,168,67,0.12)' : 'transparent',
                    cursor: 'pointer',
                  }}>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: form.home_away === opt.val ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pitcher info */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label">{isScouting ? 'Pitcher being scouted' : 'Our pitcher'}</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Pitcher name</label>
                <PitcherAutocomplete
                  value={form.pitcher_name}
                  onChange={v => set('pitcher_name', v)}
                  onSelect={p => setForm(f => ({ ...f, pitcher_name: p.name, pitcher_number: p.number, pitcher_throws: p.throws }))}
                  placeholder="Search or type pitcher name"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Jersey #</label>
                <input type="text" placeholder="#" value={form.pitcher_number} onChange={e => set('pitcher_number', e.target.value)} style={{ width: 72 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Throws</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['R', 'L'].map(h => (
                  <button key={h} type="button"
                    className={`btn${form.pitcher_throws === h ? ' btn-primary' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => set('pitcher_throws', h)}>
                    {h === 'R' ? 'Right-handed' : 'Left-handed'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-label">Notes (optional)</div>
          <textarea
            rows={3}
            placeholder="Pre-game notes, tendencies from film, etc."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={saving}>
          {saving ? 'Saving…' : 'Create Game & Start →'}
        </button>
      </form>
    </div>
  )
}
