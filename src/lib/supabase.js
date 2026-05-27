import { createClient } from '@supabase/supabase-js'

// Replace these with your Supabase project values from:
// https://app.supabase.com -> Project Settings -> API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export const isSupabaseConfigured = () => !!supabase

// ─── SUPABASE SCHEMA ────────────────────────────────────────────────────────
// Run this SQL in your Supabase SQL Editor to set up the database:
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
//
// alter table games enable row level security;
// create policy "public access" on games for all using (true);
//
// ────────────────────────────────────────────────────────────────────────────

export async function loadGames() {
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  return await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })
}

export async function saveGame(game) {
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  if (game.id) {
    return await supabase
      .from('games')
      .update({ ...game, updated_at: new Date().toISOString() })
      .eq('id', game.id)
      .select()
      .single()
  } else {
    return await supabase
      .from('games')
      .insert(game)
      .select()
      .single()
  }
}

export async function deleteGame(id) {
  if (!supabase) return { error: null }
  return await supabase.from('games').delete().eq('id', id)
}
