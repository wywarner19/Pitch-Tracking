import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export const isSupabaseConfigured = () => !!supabase

export function isOnline() {
  return navigator.onLine
}

// ── SCHEMA COLUMNS ────────────────────────────────────────────────────────────
// Only include fields that exist in the Supabase table
const ALLOWED_COLUMNS = [
  'id', 'created_at', 'date', 'my_team', 'opponent',
  'pitcher_name', 'pitcher_throws', 'pitcher_number',
  'notes', 'pitches', 'updated_at', 'game_state',
  'pitchers', 'mode', 'home_away', 'custom_pitches',
]

function cleanForSupabase(game) {
  const cleaned = {}
  ALLOWED_COLUMNS.forEach(col => {
    if (game[col] !== undefined) cleaned[col] = game[col]
  })
  cleaned.updated_at = new Date().toISOString()
  return cleaned
}

// ── LOCAL STORAGE BACKUP ──────────────────────────────────────────────────────
const LOCAL_KEY = 'pitch_tracking_games'

function localSaveGame(game) {
  try {
    const games = localLoadGames()
    const idx = games.findIndex(g => g.id === game.id)
    if (idx > -1) games[idx] = game
    else games.unshift(game)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games))
  } catch (e) {
    console.warn('localStorage save failed:', e)
  }
}

export function localLoadGames() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function localDeleteGame(id) {
  try {
    const games = localLoadGames().filter(g => g.id !== id)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games))
  } catch (e) {
    console.warn('localStorage delete failed:', e)
  }
}

// ── LOAD GAMES ────────────────────────────────────────────────────────────────
export async function loadGames() {
  // Always load from local first as immediate fallback
  const local = localLoadGames()

  if (!supabase || !isOnline()) {
    return { data: local, error: null }
  }

  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('Supabase loadGames error:', error)
      return { data: local, error: null }
    }

    // Merge: Supabase is source of truth, but keep any local-only games
    // that haven't made it to Supabase yet
    const supabaseIds = new Set((data || []).map(g => g.id))
    const localOnly = local.filter(g => g.id && !supabaseIds.has(g.id))

    if (localOnly.length > 0) {
      console.log(`Found ${localOnly.length} local-only games, syncing to Supabase...`)
      for (const game of localOnly) {
        await saveGame(game)
      }
    }

    // Update local cache with Supabase data
    if (data && data.length > 0) {
      data.forEach(g => localSaveGame(g))
    }

    // Return merged list: Supabase data + any local-only games not yet synced
    const merged = [...(data || []), ...localOnly].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    )

    return { data: merged, error: null }
  } catch (err) {
    console.error('loadGames exception:', err)
    return { data: local, error: null }
  }
}

// ── SAVE GAME ─────────────────────────────────────────────────────────────────
export async function saveGame(game) {
  // Ensure game has an ID before saving anywhere
  if (!game.id) {
    game = { ...game, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  }

  // Always save locally first — this is the safety net
  localSaveGame(game)

  if (!supabase) {
    return { data: game, error: null }
  }

  if (!isOnline()) {
    console.log('Offline — saved locally only, id:', game.id)
    return { data: game, error: null, offline: true }
  }

  const cleaned = cleanForSupabase(game)

  try {
    const result = await supabase
      .from('games')
      .upsert(cleaned, { onConflict: 'id' })
      .select()
      .single()

    if (result.error) {
      console.error('Supabase saveGame error:', result.error)
      // Return locally saved game so navigation works
      return { data: game, error: null }
    }

    if (result.data) localSaveGame(result.data)
    return result

  } catch (err) {
    console.error('saveGame exception:', err)
    return { data: game, error: null }
  }
}

// ── DELETE GAME ───────────────────────────────────────────────────────────────
export async function deleteGame(id) {
  // Delete locally first
  localDeleteGame(id)

  if (!supabase || !isOnline()) {
    return { error: null }
  }

  try {
    return await supabase.from('games').delete().eq('id', id)
  } catch (err) {
    console.error('deleteGame exception:', err)
    return { error: null }
  }
}

// ── AUTO SYNC ON RECONNECT ────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('Back online — syncing local games to Supabase...')
    await loadGames() // this handles the merge automatically
  })
}
