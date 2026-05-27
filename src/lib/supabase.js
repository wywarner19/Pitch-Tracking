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

// Strip out any fields that don't exist in the Supabase schema
function cleanGameForSupabase(game) {
  const { offline, ...clean } = game
  return {
    ...clean,
    updated_at: new Date().toISOString(),
  }
}

export async function loadGames() {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  if (!isOnline()) {
    return { data: localLoadGames(), error: null }
  }

  const result = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })

  if (result.error) {
    console.error('Supabase loadGames error:', result.error)
    // Fall back to local data if Supabase fails
    return { data: localLoadGames(), error: null }
  }

  // Only cache locally if Supabase returned actual data
  if (result.data && result.data.length > 0) {
    result.data.forEach(g => localSaveGame(g))
  }

  return result
}

export async function saveGame(game) {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // Always save locally first so data is never lost
  localSaveGame(game)

  if (!isOnline()) {
    queueOfflineSave(game)
    return { data: game, error: null, offline: true }
  }

  const cleaned = cleanGameForSupabase(game)

  try {
    let result

    if (cleaned.id) {
      // Try update
      result = await supabase
        .from('games')
        .update(cleaned)
        .eq('id', cleaned.id)
        .select()
        .single()

      // If row doesn't exist yet, insert it
      if (result.error || !result.data) {
        console.log('Update failed, trying insert:', result.error?.message)
        const { id, ...rest } = cleaned
        result = await supabase
          .from('games')
          .insert({ ...rest, id })
          .select()
          .single()
      }
    } else {
      result = await supabase
        .from('games')
        .insert(cleaned)
        .select()
        .single()
    }

    if (result.error) {
      console.error('Supabase saveGame error:', result.error)
      queueOfflineSave(game)
      return { data: game, error: result.error }
    }

    if (result.data) localSaveGame(result.data)
    return result

  } catch (err) {
    console.error('Supabase saveGame exception:', err)
    queueOfflineSave(game)
    return { data: game, error: err }
  }
}

export async function deleteGame(id) {
  if (!supabase) return { error: null }
  return await supabase.from('games').delete().eq('id', id)
}
