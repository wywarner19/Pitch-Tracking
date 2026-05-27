import { createClient } from '@supabase/supabase-js'
import { queueOfflineSave, getOfflineQueue, clearOfflineQueue, localSaveGame } from './store'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export const isSupabaseConfigured = () => !!supabase

// ── ONLINE STATUS ─────────────────────────────────────────────────────────────
export function isOnline() {
  return navigator.onLine
}

// ── OFFLINE QUEUE SYNC ────────────────────────────────────────────────────────
// Call this when the app comes back online to flush any queued saves
export async function syncOfflineQueue() {
  if (!supabase || !isOnline()) return
  const queue = getOfflineQueue()
  if (!queue.length) return

  console.log(`Syncing ${queue.length} offline game(s) to Supabase...`)
  for (const game of queue) {
    await saveGame(game)
  }
  clearOfflineQueue()
  console.log('Offline sync complete.')
}

// Listen for coming back online and auto-sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineQueue()
  })
}

// ─── SUPABASE SCHEMA ──────────────────────────────────────────────────────────
// Run this SQL in your Supabase SQL Editor:
//
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
  if (!isOnline()) {
    // Return locally cached games while offline
    const { localLoadGames } = await import('./store')
    return { data: localLoadGames(), error: null }
  }
  const result = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })
  // Cache locally for offline use
  if (result.data) {
    result.data.forEach(g => localSaveGame(g))
  }
  return result
}

export async function saveGame(game) {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // If offline, queue it and save locally
  if (!isOnline()) {
    queueOfflineSave(game)
    return { data: game, error: null, offline: true }
  }

  try {
    let result
    if (game.id) {
      result = await supabase
        .from('games')
        .update({ ...game, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('games')
        .insert(game)
        .select()
        .single()
    }
    // Also keep local copy in sync
    if (result.data) localSaveGame(result.data)
    return result
  } catch (err) {
    // Network error — queue for later
    queueOfflineSave(game)
    return { data: game, error: null, offline: true }
  }
}

export async function deleteGame(id) {
  if (!supabase) return { error: null }
  return await supabase.from('games').delete().eq('id', id)
}
