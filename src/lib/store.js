// Re-exports from supabase.js for backwards compatibility
export { localLoadGames, localSaveGame, localDeleteGame } from './supabase'

export function localLoadGamesStandalone() {
  try {
    const raw = localStorage.getItem('pitch_tracking_games')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// Legacy no-ops kept to avoid import errors in any remaining references
export function queueOfflineSave() {}
export function getOfflineQueue() { return [] }
export function clearOfflineQueue() {}
export function hasOfflineQueue() { return false }
export function syncOfflineQueue() { return Promise.resolve() }
