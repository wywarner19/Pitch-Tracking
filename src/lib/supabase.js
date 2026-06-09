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

// ── SYNC STATUS STORE ─────────────────────────────────────────────────────────
// Tracks sync status for each game so UI can show it
const syncStatus = {}
const statusListeners = new Set()

export function getSyncStatus(gameId) {
  return syncStatus[gameId] || 'unknown'
}

export function onSyncStatusChange(listener) {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

function setSyncStatus(gameId, status) {
  syncStatus[gameId] = status
  statusListeners.forEach(fn => fn(gameId, status))
}

// ── SCHEMA COLUMNS ────────────────────────────────────────────────────────────
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

// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
const LOCAL_KEY = 'pitch_tracking_games'
const PENDING_KEY = 'pitch_tracking_pending_sync'

export function localLoadGames() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function localSaveGame(game) {
  try {
    const games = localLoadGames()
    const idx = games.findIndex(g => g.id === game.id)
    if (idx > -1) games[idx] = game
    else games.unshift(game)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games))
  } catch (e) { console.warn('localStorage save failed:', e) }
}

export function localDeleteGame(id) {
  try {
    const games = localLoadGames().filter(g => g.id !== id)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games))
  } catch (e) { console.warn('localStorage delete failed:', e) }
}

// Pending sync queue — games that need to reach Supabase
function getPendingQueue() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function addToPendingQueue(game) {
  try {
    const queue = getPendingQueue()
    queue[game.id] = game
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue))
    setSyncStatus(game.id, 'pending')
  } catch (e) { console.warn('Queue save failed:', e) }
}

function removeFromPendingQueue(gameId) {
  try {
    const queue = getPendingQueue()
    delete queue[gameId]
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue))
  } catch (e) { console.warn('Queue remove failed:', e) }
}

// ── SUPABASE WRITE ────────────────────────────────────────────────────────────
async function writeToSupabase(game) {
  if (!supabase || !isOnline()) return false

  const cleaned = cleanForSupabase(game)

  try {
    const { data, error } = await supabase
      .from('games')
      .upsert(cleaned, { onConflict: 'id' })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase write error:', JSON.stringify(error))
      setSyncStatus(game.id, 'error:' + error.message)
      return false
    }

    console.log('Supabase write success:', game.id)
    setSyncStatus(game.id, 'synced')
    removeFromPendingQueue(game.id)
    return true

  } catch (err) {
    console.error('Supabase write exception:', err.message)
    setSyncStatus(game.id, 'error:' + err.message)
    return false
  }
}

// ── FLUSH PENDING QUEUE ───────────────────────────────────────────────────────
export async function flushPendingQueue() {
  if (!supabase || !isOnline()) return
  const queue = getPendingQueue()
  const ids = Object.keys(queue)
  if (!ids.length) return
  console.log(`Flushing ${ids.length} pending game(s) to Supabase...`)
  for (const id of ids) {
    await writeToSupabase(queue[id])
  }
}

// ── LOAD GAMES ────────────────────────────────────────────────────────────────
export async function loadGames() {
  const local = localLoadGames()

  // Flush any pending games first
  await flushPendingQueue()

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

    // Mark all loaded games as synced
    ;(data || []).forEach(g => setSyncStatus(g.id, 'synced'))

    // Find local-only games not in Supabase
    const supabaseIds = new Set((data || []).map(g => g.id))
    const localOnly = local.filter(g => g.id && !supabaseIds.has(g.id))

    if (localOnly.length > 0) {
      console.log(`Found ${localOnly.length} local-only games, syncing...`)
      for (const game of localOnly) {
        addToPendingQueue(game)
        await writeToSupabase(game)
      }
    }

    // Update local cache
    if (data && data.length > 0) {
      data.forEach(g => localSaveGame(g))
    }

    const merged = [
      ...(data || []),
      ...localOnly.filter(g => getSyncStatus(g.id) !== 'synced')
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    return { data: merged, error: null }

  } catch (err) {
    console.error('loadGames exception:', err)
    return { data: local, error: null }
  }
}

// ── SAVE GAME ─────────────────────────────────────────────────────────────────
export async function saveGame(game) {
  // Ensure ID exists
  if (!game.id) {
    game = { ...game, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  }

  // Save locally first
  localSaveGame(game)
  setSyncStatus(game.id, 'pending')

  // Add to pending queue immediately so it survives app switching
  addToPendingQueue(game)

  if (!supabase || !isOnline()) {
    return { data: game, error: null, offline: true }
  }

  // Try to write to Supabase
  const success = await writeToSupabase(game)

  if (success) {
    // Successfully synced — remove from pending queue
    removeFromPendingQueue(game.id)
  }

  return { data: game, error: null }
}

// ── DELETE GAME ───────────────────────────────────────────────────────────────
export async function deleteGame(id) {
  localDeleteGame(id)
  removeFromPendingQueue(id)
  delete syncStatus[id]

  if (!supabase || !isOnline()) return { error: null }

  try {
    return await supabase.from('games').delete().eq('id', id)
  } catch (err) {
    console.error('deleteGame exception:', err)
    return { error: null }
  }
}

// ── AUTO SYNC ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('Back online — flushing pending queue...')
    flushPendingQueue()
  })

  // Sync when app becomes visible again (returning from another app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('App visible — flushing pending queue...')
      flushPendingQueue()
    }
  })

  // Sync before app goes to background
  window.addEventListener('pagehide', () => {
    console.log('Page hiding — attempting sync...')
    flushPendingQueue()
  })
}
