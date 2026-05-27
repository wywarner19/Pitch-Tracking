import { useState, useEffect, useRef } from 'react'
import { loadGames, isSupabaseConfigured } from '../lib/supabase'
import { localLoadGames } from '../lib/store'

// Fetches all previously used pitcher names across all games
export function usePitcherHistory() {
  const [pitchers, setPitchers] = useState([])

  useEffect(() => {
    async function fetch() {
      let games
      if (isSupabaseConfigured()) {
        const { data } = await loadGames()
        games = data || []
      } else {
        games = localLoadGames()
      }
      // Build unique pitcher list with their details from most recent game
      const map = {}
      games.forEach(g => {
        if (!map[g.pitcher_name]) {
          map[g.pitcher_name] = {
            name: g.pitcher_name,
            number: g.pitcher_number || '',
            throws: g.pitcher_throws || 'R',
          }
        }
      })
      setPitchers(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)))
    }
    fetch()
  }, [])

  return pitchers
}

// Autocomplete input for pitcher name
// Props: value, onChange(name), onSelect({ name, number, throws }), placeholder
export default function PitcherAutocomplete({ value, onChange, onSelect, placeholder = 'e.g. Jake Thompson' }) {
  const [open, setOpen] = useState(false)
  const pitchers = usePitcherHistory()
  const ref = useRef(null)

  const filtered = value.trim().length > 0
    ? pitchers.filter(p => p.name.toLowerCase().includes(value.toLowerCase()))
    : pitchers

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 8, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(p => (
            <button key={p.name} onMouseDown={e => {
              e.preventDefault()
              onSelect(p)
              setOpen(false)
            }} style={{
              width: '100%', padding: '10px 14px', textAlign: 'left',
              background: 'transparent', border: 'none',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {p.name}
                </span>
                {p.number && <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>#{p.number}</span>}
              </div>
              <span style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 4,
                background: p.throws === 'L' ? 'rgba(74,143,232,0.15)' : 'rgba(212,168,67,0.12)',
                color: p.throws === 'L' ? 'var(--blue)' : 'var(--accent)',
                fontFamily: 'Barlow Condensed', fontWeight: 600,
              }}>{p.throws}HP</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
