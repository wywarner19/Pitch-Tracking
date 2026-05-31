// Local storage helpers — re-exported from here for components that import directly
// The source of truth functions live in supabase.js

const LOCAL_KEY = 'pitch_tracking_games'

export function localLoadGames() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function localSaveGame(game) {
  try {
    const games = localLoadGames()
    if (game.id) {
      const idx = games.findIndex(g => g.id === game.id)
      if (idx > -1) games[idx] = game
      else games.unshift(game)
    } else {
      game.id = crypto.randomUUID()
      game.created_at = new Date().toISOString()
      games.unshift(game)
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games))
    return game
  } catch (e) {
    console.warn('localStorage save failed:', e)
    return game
  }
}

export function localDeleteGame(id) {
  try {
    const games = localLoadGames().filter(g => g.id !== id)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games))
  } catch (e) {
    console.warn('localStorage delete failed:', e)
  }
}

// Legacy exports — no longer used but kept to avoid import errors
export function queueOfflineSave() {}
export function getOfflineQueue() { return [] }
export function clearOfflineQueue() {}
export function hasOfflineQueue() { return false }
export function syncOfflineQueue() { return Promise.resolve() }