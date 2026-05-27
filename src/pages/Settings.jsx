import { useState, useRef } from 'react'
import { isSupabaseConfigured, loadGames, saveGame } from '../lib/supabase'
import { localLoadGames, localSaveGame } from '../lib/store'

export default function Settings() {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null) // { success, count, error }
  const fileInputRef = useRef(null)

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

  // ── EXPORT ──────────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true)
    try {
      let games
      if (isSupabaseConfigured()) {
        const { data } = await loadGames()
        games = data || []
      } else {
        games = localLoadGames()
      }

      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        app: 'Pitch Tracking',
        game_count: games.length,
        games,
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `pitch-tracking-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
    setExporting(false)
  }

  // ── IMPORT ──────────────────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      // Validate it looks like our backup format
      if (!backup.games || !Array.isArray(backup.games)) {
        throw new Error('Invalid backup file — not a Pitch Tracking backup.')
      }

      const games = backup.games
      let imported = 0
      let skipped = 0

      for (const game of games) {
        if (!game.pitcher_name || !game.date) { skipped++; continue }

        if (isSupabaseConfigured()) {
          // Check if game already exists to avoid duplicates
          const { data: existing } = await loadGames()
          const exists = (existing || []).some(g => g.id === game.id)
          if (!exists) {
            await saveGame({ ...game, id: undefined }) // insert as new
            imported++
          } else {
            skipped++
          }
        } else {
          const existing = localLoadGames()
          const exists = existing.some(g => g.id === game.id)
          if (!exists) {
            localSaveGame({ ...game, id: undefined })
            imported++
          } else {
            skipped++
          }
        }
      }

      setImportResult({ success: true, count: imported, skipped })
    } catch (err) {
      setImportResult({ success: false, error: err.message })
    }

    setImporting(false)
    // Reset file input so same file can be re-imported if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Settings</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' }}>Manage your data and configure cloud sync.</p>

      {/* ── BACKUP & RESTORE ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-label" style={{ marginBottom: '1rem' }}>Backup & Restore</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          Export all your games as a JSON backup file. Save it to iCloud, Google Drive, or your computer.
          At the end of each season, export a backup to keep a permanent record.
        </p>

        {/* Export */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg3)', borderRadius: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>Export all games</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Downloads a .json backup file of every game and pitch
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : '↓ Export Backup'}
          </button>
        </div>

        {/* Import */}
        <div style={{ padding: '1rem', background: 'var(--bg3)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: importResult ? 10 : 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>Restore from backup</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Import a previously exported .json backup file
              </div>
            </div>
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing…' : '↑ Import Backup'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>

          {/* Import result */}
          {importResult && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 6,
              background: importResult.success ? 'rgba(76,175,125,0.15)' : 'rgba(224,82,82,0.15)',
              color: importResult.success ? 'var(--green)' : 'var(--red)',
              fontSize: 13,
            }}>
              {importResult.success
                ? `✓ Imported ${importResult.count} game${importResult.count !== 1 ? 's' : ''} successfully.${importResult.skipped ? ` (${importResult.skipped} skipped — already existed)` : ''}`
                : `✗ Import failed: ${importResult.error}`
              }
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          💡 <strong style={{ color: 'var(--text2)' }}>Tip:</strong> Export at the end of each season and save to iCloud or Google Drive. 
          Importing skips any games that already exist so you won't get duplicates.
        </div>
      </div>

      {/* ── CLOUD SYNC STATUS ── */}
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

      {/* ── SUPABASE SETUP ── */}
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

      {/* ── SQL SCHEMA ── */}
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

      {/* ── GITHUB PAGES ── */}
      <div className="card">
        <div className="section-label">GitHub Pages deployment</div>
        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {[
            <>Push your code to a GitHub repository.</>,
            <>Go to your repo → <strong style={{ color: 'var(--text)' }}>Settings → Pages</strong> → set source to <strong style={{ color: 'var(--text)' }}>GitHub Actions</strong>.</>,
            <>Add your Supabase keys as <strong style={{ color: 'var(--text)' }}>Repository Secrets</strong>: <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>VITE_SUPABASE_URL</code> and <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>VITE_SUPABASE_ANON_KEY</code>.</>,
            <>Push to main — GitHub Actions builds and deploys automatically.</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
