import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Settings() {
  const [copied, setCopied] = useState(false)

  const sqlSchema = `-- Run this in your Supabase SQL Editor
create table games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date text not null,
  my_team text not null,
  opponent text not null,
  pitcher_name text not null,
  pitcher_throws text not null,
  pitcher_number text,
  notes text,
  pitches jsonb default '[]'::jsonb
);

alter table games enable row level security;
create policy "public access" on games for all using (true);`

  function copy(text) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Settings</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' }}>Configure Supabase for cloud sync across devices.</p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Cloud sync status</div>
          <span className={`tag ${isSupabaseConfigured() ? 'tag-green' : 'tag-red'}`}>
            {isSupabaseConfigured() ? '✓ Connected' : '✗ Local only'}
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
          {isSupabaseConfigured()
            ? 'Supabase is connected. Your data syncs across all devices automatically.'
            : 'Currently using localStorage. Your data is only on this device. Follow the steps below to enable cloud sync.'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-label">How to connect Supabase (free)</div>
        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          {[
            <>Go to <a href="https://supabase.com" target="_blank" style={{ color: 'var(--accent)' }}>supabase.com</a> and create a free account and project.</>,
            <>In your project, go to <strong style={{ color: 'var(--text)' }}>SQL Editor</strong> and run the schema SQL below.</>,
            <>Go to <strong style={{ color: 'var(--text)' }}>Project Settings → API</strong> and copy your <strong style={{ color: 'var(--text)' }}>Project URL</strong> and <strong style={{ color: 'var(--text)' }}>anon public key</strong>.</>,
            <>In your code repo, create a <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>.env</code> file at the root with:<br />
              <code style={{ display: 'block', background: 'var(--bg3)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginTop: 6, lineHeight: 1.8 }}>
                VITE_SUPABASE_URL=https://your-project.supabase.co<br />
                VITE_SUPABASE_ANON_KEY=your-anon-key-here
              </code>
            </>,
            <>Run <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>npm run build</code> and redeploy. Done!</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Supabase SQL schema</div>
          <button className="btn btn-sm" onClick={() => copy(sqlSchema)}>
            {copied ? '✓ Copied' : 'Copy SQL'}
          </button>
        </div>
        <pre style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: 8, fontSize: 12, lineHeight: 1.7, overflow: 'auto', color: 'var(--text2)' }}>
          {sqlSchema}
        </pre>
      </div>

      <div className="card">
        <div className="section-label">GitHub Pages deployment</div>
        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {[
            <>Push your code to a GitHub repository.</>,
            <>Go to your repo → <strong style={{ color: 'var(--text)' }}>Settings → Pages</strong> → set source to <strong style={{ color: 'var(--text)' }}>GitHub Actions</strong>.</>,
            <>Create the file <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>.github/workflows/deploy.yml</code> — the content is in your downloaded zip.</>,
            <>Add your Supabase keys as <strong style={{ color: 'var(--text)' }}>Repository Secrets</strong> (Settings → Secrets → Actions): <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>VITE_SUPABASE_URL</code> and <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>VITE_SUPABASE_ANON_KEY</code>.</>,
            <>Push to main — GitHub Actions will build and deploy automatically.</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
