import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import GameDetail from './pages/GameDetail'
import NewGame from './pages/NewGame'
import PitcherTendencies from './pages/PitcherTendencies'
import Settings from './pages/Settings'
import Nav from './components/Nav'

export default function App() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    function handleOnline() { setOnline(true) }
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
      {!online && (
        <div style={{ background: 'rgba(224,82,82,0.15)', borderBottom: '1px solid rgba(224,82,82,0.3)', padding: '8px 1.5rem', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e05252' }}>
          <span>⚡</span>
          <strong>You're offline</strong> — pitches save locally and sync when you reconnect.
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
