const STORAGE_KEY = 'pitch_tracking_games'
const OFFLINE_QUEUE_KEY = 'pitch_tracking_offline_queue'

// ── LOCAL GAME STORAGE ────────────────────────────────────────────────────────

export function localLoadGames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function localSaveGame(game) {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
  return game
}

export function localDeleteGame(id) {
  const games = localLoadGames().filter(g => g.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

// ── OFFLINE QUEUE ─────────────────────────────────────────────────────────────
// When Supabase is configured but we're offline, queue saves here
// and sync them when the connection is restored.

export function queueOfflineSave(game) {
  try {
    const queue = getOfflineQueue()
    const idx = queue.findIndex(g => g.id === game.id)
    if (idx > -1) queue[idx] = game
    else queue.push(game)
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    // Also save locally so the UI still works
    localSaveGame(game)
  } catch {
    // Ignore storage errors
  }
}

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
}

export function hasOfflineQueue() {
  return getOfflineQueue().length > 0
}
