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
    my_team: '',
    opponent: '',
    pitcher_name: '',
    pitcher_throws: 'R',
    pitcher_number: '',
    notes: '',
    pitches: [],
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.my_team || !form.opponent || !form.pitcher_name) {
      alert('Please fill in your team, opponent, and pitcher name.')
      return
    }
    setSaving(true)
    let saved
    if (isSupabaseConfigured()) {
      const { data, error } = await saveGame(form)
      if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
      saved = data
    } else {
      saved = localSaveGame(form)
    }
    navigate(`/game/${saved.id}`)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: '1.25rem' }}>← Back</button>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>New Scouting Game</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.75rem' }}>Set up the game info, then you'll log pitches inside the game.</p>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label">Game info</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Your team</label>
                <input type="text" placeholder="e.g. Northside HS" value={form.my_team} onChange={e => set('my_team', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Opponent</label>
                <input type="text" placeholder="e.g. Westfield HS" value={form.opponent} onChange={e => set('opponent', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label">Pitcher info</div>
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

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-label">Notes (optional)</div>
          <textarea
            rows={3}
            placeholder="Pre-game notes, pitch tendencies from film, etc."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={saving}>
          {saving ? 'Saving…' : 'Create Game & Start Scouting →'}
        </button>
      </form>
    </div>
  )
}
