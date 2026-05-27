const STORAGE_KEY = 'pitcher_scout_games'

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
