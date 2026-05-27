import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import GameDetail from './pages/GameDetail'
import NewGame from './pages/NewGame'
import PitcherTendencies from './pages/PitcherTendencies'
import Settings from './pages/Settings'
import Nav from './components/Nav'
import { hasOfflineQueue } from './lib/store'
import { syncOfflineQueue } from './lib/supabase'

export default function App() {
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setOnline(true)
      // Sync any offline queue when coming back online
      if (hasOfflineQueue()) {
        setSyncing(true)
        syncOfflineQueue().then(() => {
          setSyncing(false)
          setJustSynced(true)
          setTimeout(() => setJustSynced(false), 3000)
        })
      }
    }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />

      {/* Offline banner */}
      {!online && (
        <div style={{
          background: 'rgba(224,82,82,0.15)',
          borderBottom: '1px solid rgba(224,82,82,0.3)',
          padding: '8px 1.5rem',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#e05252',
        }}>
          <span>⚡</span>
          <strong>You're offline</strong> — pitches will save locally and sync to the cloud when you reconnect.
        </div>
      )}

      {/* Syncing banner */}
      {syncing && (
        <div style={{
          background: 'rgba(212,168,67,0.15)',
          borderBottom: '1px solid rgba(212,168,67,0.3)',
          padding: '8px 1.5rem',
          fontSize: 13, color: 'var(--accent)',
        }}>
          ↑ Syncing offline data to cloud…
        </div>
      )}

      {/* Just synced confirmation */}
      {justSynced && (
        <div style={{
          background: 'rgba(76,175,125,0.15)',
          borderBottom: '1px solid rgba(76,175,125,0.3)',
          padding: '8px 1.5rem',
          fontSize: 13, color: 'var(--green)',
        }}>
          ✓ Offline data synced to cloud successfully.
        </div>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new-game" element={<NewGame />} />
        <Route path="/game/:id" element={<GameDetail />} />
        <Route path="/tendencies" element={<PitcherTendencies />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}
