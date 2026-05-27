// Export utilities for PDF and Excel reports

const PITCH_TYPES = [
  { id: 'FB', label: 'Fastball' },
  { id: 'CT', label: 'Cutter' },
  { id: 'SI', label: 'Sinker' },
  { id: 'CB', label: 'Curveball' },
  { id: 'SL', label: 'Slider' },
  { id: 'SW', label: 'Sweeper' },
  { id: 'CH', label: 'Changeup' },
  { id: 'SP', label: 'Splitter' },
  { id: 'OT', label: 'Other' },
]
const ptLabel = id => PITCH_TYPES.find(p => p.id === id)?.label || id

function buildReportData(game) {
  const pitches = game.pitches || []
  const pitcherLabel = `${game.pitcher_name}${game.pitcher_number ? ' #' + game.pitcher_number : ''} (${game.pitcher_throws}HP)`

  // Pitch mix
  const pitchCounts = {}
  pitches.forEach(p => pitchCounts[p.pitch] = (pitchCounts[p.pitch] || 0) + 1)
  const pitchMix = Object.keys(pitchCounts).sort((a, b) => pitchCounts[b] - pitchCounts[a]).map(pt => {
    const n = pitchCounts[pt]
    const pct = Math.round(n / pitches.length * 100)
    const sk = pitches.filter(p => p.pitch === pt && ['Called strike', 'Swinging strike', 'Foul'].includes(p.result)).length
    const wh = pitches.filter(p => p.pitch === pt && p.result === 'Swinging strike').length
    const sw = pitches.filter(p => p.pitch === pt && ['Swinging strike', 'Foul', 'In play — out', 'In play — hit'].includes(p.result)).length
    return {
      pitch: ptLabel(pt),
      count: n,
      usage: pct + '%',
      strikeP: Math.round(sk / n * 100) + '%',
      whiffP: sw ? Math.round(wh / sw * 100) + '%' : '0%',
    }
  })

  // Count breakdown
  const cmap = {}
  pitches.forEach(p => {
    if (!cmap[p.count]) cmap[p.count] = {}
    cmap[p.count][p.pitch] = (cmap[p.count][p.pitch] || 0) + 1
  })
  const countBreakdown = Object.keys(cmap).sort().map(c => {
    const t = Object.values(cmap[c]).reduce((a, b) => a + b, 0)
    const mix = Object.keys(cmap[c]).sort((a, b) => cmap[c][b] - cmap[c][a])
      .map(pt => `${ptLabel(pt)} ${Math.round(cmap[c][pt] / t * 100)}%`).join(', ')
    return { count: c, pitches: t, mix }
  })

  // Situation breakdown
  const smap = {}
  pitches.forEach(p => p.sits?.forEach(s => {
    if (!smap[s]) smap[s] = {}
    smap[s][p.pitch] = (smap[s][p.pitch] || 0) + 1
  }))
  const sitBreakdown = Object.keys(smap).map(s => {
    const t = Object.values(smap[s]).reduce((a, b) => a + b, 0)
    const mix = Object.keys(smap[s]).sort((a, b) => smap[s][b] - smap[s][a])
      .map(pt => `${ptLabel(pt)} ${Math.round(smap[s][pt] / t * 100)}%`).join(', ')
    return { situation: s, pitches: t, mix }
  })

  // Pitch log
  const pitchLog = pitches.map((p, i) => ({
    '#': i + 1,
    pitcher: p.pitcherName || game.pitcher_name,
    pitch: ptLabel(p.pitch),
    count: p.count,
    batter: p.hand + 'HH',
    result: p.result,
    inning: p.inning ? `${p.inning} ${p.inningHalf || ''}` : '',
    situation: (p.sits || []).join(', '),
    time: p.ts || '',
  }))

  const total = pitches.length
  const strikes = pitches.filter(p => ['Called strike', 'Swinging strike', 'Foul'].includes(p.result)).length
  const whiffs = pitches.filter(p => p.result === 'Swinging strike').length
  const swings = pitches.filter(p => ['Swinging strike', 'Foul', 'In play — out', 'In play — hit'].includes(p.result)).length

  return {
    pitcherLabel,
    matchup: `${game.my_team} vs ${game.opponent}`,
    date: game.date,
    total,
    strikeP: total ? Math.round(strikes / total * 100) + '%' : '—',
    whiffP: swings ? Math.round(whiffs / swings * 100) + '%' : '—',
    pitchMix,
    countBreakdown,
    sitBreakdown,
    pitchLog,
  }
}

// ── EXCEL EXPORT ──────────────────────────────────────────────────────────────
export async function exportExcel(game) {
  const XLSX = await import('xlsx')
  const d = buildReportData(game)
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = [
    ['PITCH TRACKING REPORT'],
    [],
    ['Pitcher', d.pitcherLabel],
    ['Matchup', d.matchup],
    ['Date', d.date],
    ['Total Pitches', d.total],
    ['Strike %', d.strikeP],
    ['Whiff %', d.whiffP],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  ws1['!cols'] = [{ wch: 20 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // Sheet 2: Pitch Mix
  const mixHeaders = ['Pitch', 'Count', 'Usage %', 'Strike %', 'Whiff %']
  const mixRows = d.pitchMix.map(r => [r.pitch, r.count, r.usage, r.strikeP, r.whiffP])
  const ws2 = XLSX.utils.aoa_to_sheet([mixHeaders, ...mixRows])
  ws2['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Pitch Mix')

  // Sheet 3: Count Breakdown
  const countHeaders = ['Count', 'Pitches', 'Mix']
  const countRows = d.countBreakdown.map(r => [r.count, r.pitches, r.mix])
  const ws3 = XLSX.utils.aoa_to_sheet([countHeaders, ...countRows])
  ws3['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Count Breakdown')

  // Sheet 4: Situations
  if (d.sitBreakdown.length) {
    const sitHeaders = ['Situation', 'Pitches', 'Mix']
    const sitRows = d.sitBreakdown.map(r => [r.situation, r.pitches, r.mix])
    const ws4 = XLSX.utils.aoa_to_sheet([sitHeaders, ...sitRows])
    ws4['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws4, 'Situations')
  }

  // Sheet 5: Full Pitch Log
  const logHeaders = ['#', 'Pitcher', 'Pitch', 'Count', 'Batter', 'Result', 'Inning', 'Situation', 'Time']
  const logRows = d.pitchLog.map(r => [r['#'], r.pitcher, r.pitch, r.count, r.batter, r.result, r.inning, r.situation, r.time])
  const ws5 = XLSX.utils.aoa_to_sheet([logHeaders, ...logRows])
  ws5['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 16 }, { wch: 10 }, { wch: 40 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws5, 'Pitch Log')

  const filename = `${game.pitcher_name.replace(/\s+/g, '_')}_${game.date}_report.xlsx`
  XLSX.writeFile(wb, filename)
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
export async function exportPDF(game) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const d = buildReportData(game)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const gold = [212, 168, 67]
  const dark = [15, 17, 23]
  const gray = [100, 105, 120]

  // Header bar
  doc.setFillColor(...dark)
  doc.rect(0, 0, 216, 22, 'F')
  doc.setFillColor(...gold)
  doc.rect(0, 22, 216, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('PITCH TRACKING REPORT', 14, 14)

  // Meta info
  doc.setTextColor(...dark)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(d.pitcherLabel, 14, 32)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.setFontSize(9)
  doc.text(`${d.matchup}  ·  ${d.date}`, 14, 38)

  // Stat boxes
  const stats = [
    { label: 'Total Pitches', value: String(d.total) },
    { label: 'Strike %', value: d.strikeP },
    { label: 'Whiff %', value: d.whiffP },
  ]
  stats.forEach((s, i) => {
    const x = 14 + i * 62
    doc.setFillColor(240, 241, 245)
    doc.roundedRect(x, 44, 58, 18, 2, 2, 'F')
    doc.setTextColor(...dark)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(s.value, x + 29, 55, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gray)
    doc.text(s.label, x + 29, 59, { align: 'center' })
  })

  let y = 70

  // Pitch Mix table
  doc.setTextColor(...gold)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('PITCH MIX', 14, y)
  y += 3
  autoTable(doc, {
    startY: y,
    head: [['Pitch', 'Count', 'Usage', 'Strike %', 'Whiff %']],
    body: d.pitchMix.map(r => [r.pitch, r.count, r.usage, r.strikeP, r.whiffP]),
    theme: 'striped',
    headStyles: { fillColor: dark, textColor: gold, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // Count breakdown table
  doc.setTextColor(...gold)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('BY COUNT', 14, y)
  y += 3
  autoTable(doc, {
    startY: y,
    head: [['Count', 'Pitches', 'Pitch Mix']],
    body: d.countBreakdown.map(r => [r.count, r.pitches, r.mix]),
    theme: 'striped',
    headStyles: { fillColor: dark, textColor: gold, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 18 }, 1: { cellWidth: 18 }, 2: { cellWidth: 'auto' } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  // Situations table
  if (d.sitBreakdown.length) {
    if (y > 220) { doc.addPage(); y = 20 }
    doc.setTextColor(...gold)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('BY SITUATION', 14, y)
    y += 3
    autoTable(doc, {
      startY: y,
      head: [['Situation', 'Pitches', 'Pitch Mix']],
      body: d.sitBreakdown.map(r => [r.situation, r.pitches, r.mix]),
      theme: 'striped',
      headStyles: { fillColor: dark, textColor: gold, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 18 }, 2: { cellWidth: 'auto' } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // Pitch log (new page)
  doc.addPage()
  doc.setTextColor(...gold)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('FULL PITCH LOG', 14, 20)
  autoTable(doc, {
    startY: 24,
    head: [['#', 'Pitcher', 'Pitch', 'Count', 'Batter', 'Result', 'Inning', 'Situation']],
    body: d.pitchLog.map(r => [r['#'], r.pitcher, r.pitch, r.count, r.batter, r.result, r.inning, r.situation]),
    theme: 'striped',
    headStyles: { fillColor: dark, textColor: gold, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 18 },
      3: { cellWidth: 12 }, 4: { cellWidth: 12 }, 5: { cellWidth: 22 },
      6: { cellWidth: 12 }, 7: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  })

  // Footer on all pages
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(`Pitch Tracking · ${d.pitcherLabel} · ${d.date}  |  Page ${i} of ${pageCount}`, 14, 275)
  }

  doc.save(`${game.pitcher_name.replace(/\s+/g, '_')}_${game.date}_report.pdf`)
}
