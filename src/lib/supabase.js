import { createClient } from '@supabase/supabase-js'
import { queueOfflineSave, getOfflineQueue, clearOfflineQueue, localSaveGame, localLoadGames } from './store'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export const isSupabaseConfigured = () => !!supabase

export function isOnline() {
  return navigator.onLine
}

// ── OFFLINE QUEUE SYNC ────────────────────────────────────────────────────────
export async function syncOfflineQueue() {
  if (!supabase || !isOnline()) return
  const queue = getOfflineQueue()
  if (!queue.length) return
  for (const game of queue) {
    await saveGame(game)
  }
  clearOfflineQueue()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncOfflineQueue())
}

// ─── SUPABASE SCHEMA ──────────────────────────────────────────────────────────
// create table games (
//   id uuid primary key default gen_random_uuid(),
//   created_at timestamptz default now(),
//   date text not null,
//   my_team text not null,
//   opponent text not null,
//   pitcher_name text not null,
//   pitcher_throws text not null,
//   pitcher_number text,
//   notes text,
//   pitches jsonb default '[]'::jsonb
// );
// alter table games enable row level security;
// create policy "public access" on games for all using (true);
// ─────────────────────────────────────────────────────────────────────────────

export async function loadGames() {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // Offline — return local cache
  if (!isOnline()) {
    return { data: localLoadGames(), error: null }
  }

  const result = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })

  // Only cache locally if Supabase actually returned data
  // Never overwrite local cache with an empty result
  if (result.data && result.data.length > 0) {
    result.data.forEach(g => localSaveGame(g))
  }

  return result
}

export async function saveGame(game) {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // Offline — queue and save locally
  if (!isOnline()) {
    queueOfflineSave(game)
    return { data: game, error: null, offline: true }
  }

  try {
    let result

    if (game.id) {
      // Try update first
      const updateResult = await supabase
        .from('games')
        .update({ ...game, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .select()
        .single()

      // If update returned no data the row doesn't exist yet — insert instead
      if (!updateResult.data || updateResult.error) {
        const { id, ...gameWithoutId } = game
        result = await supabase
          .from('games')
          .insert({ ...gameWithoutId, id })
          .select()
          .single()
      } else {
        result = updateResult
      }
    } else {
      result = await supabase
        .from('games')
        .insert(game)
        .select()
        .single()
    }

    // Keep local copy in sync
    if (result.data) localSaveGame(result.data)
    return result
  } catch (err) {
    // Network error — queue for later, save locally
    queueOfflineSave(game)
    localSaveGame(game)
    return { data: game, error: null, offline: true }
  }
}

export async function deleteGame(id) {
  if (!supabase) return { error: null }
  return await supabase.from('games').delete().eq('id', id)
}
