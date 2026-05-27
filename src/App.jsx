import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameDetail from './pages/GameDetail'
import NewGame from './pages/NewGame'
import PitcherTendencies from './pages/PitcherTendencies'
import Settings from './pages/Settings'
import Nav from './components/Nav'

export default function App() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />
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
