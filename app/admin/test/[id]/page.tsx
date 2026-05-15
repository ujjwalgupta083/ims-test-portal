'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; difficulty: string; sequence_order: number; passage_id: string | null }
type Passage = { id: string; passage_text: string; title: string; sequence_order: number }
type Test = { id: string; title: string; mode: string; duration_minutes: number; marking_correct: number; marking_wrong: number }
type CsvRow = { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; difficulty: string; error?: string }

const emptyQ = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', difficulty: 'medium', passage_id: null as string | null }

export default function TestQuestions() {
  const router = useRouter()
  const { id } = useParams()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [passages, setPassages] = useState<Passage[]>([])
  const [form, setForm] = useState(emptyQ)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingQ, setEditingQ] = useState<string | null>(null)
  const [passageForm, setPassageForm] = useState({ title: '', passage_text: '' })
  const [showPassageForm, setShowPassageForm] = useState(false)
  const [activeSection, setActiveSection] = useState<'standalone' | 'passage' | 'csv'>('standalone')

  // CSV state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvParsed, setCsvParsed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [csvFileName, setFileName] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: t } = await supabase.from('tests').select('*').eq('id', id).single()
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')
    const { data: p } = await supabase.from('passages').select('*').eq('test_id', id).order('sequence_order')
    setTest(t); setQuestions(q || []); setPassages(p || [])
  }

  const handleSaveQ = async () => {
    if (!form.question_text || !form.option_a || !form.option_b || !form.option_c || !form.option_d) return
    setSaving(true)
    if (editingQ) {
      await supabase.from('questions').update({ ...form }).eq('id', editingQ)
      setEditingQ(null)
    } else {
      await supabase.from('questions').insert([{ ...form, test_id: id, sequence_order: questions.length + 1 }])
    }
    setSaving(false); setSaved(true); setForm(emptyQ)
    setTimeout(() => setSaved(false), 2000)
    fetchData()
  }

  const handleDeleteQ = async (qid: string) => {
    if (!confirm('Delete this question?')) return
    await supabase.from('questions').delete().eq('id', qid)
    fetchData()
  }

  const handleEditQ = (q: Question) => {
    setForm({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, difficulty: q.difficulty, passage_id: q.passage_id })
    setEditingQ(q.id)
    setActiveSection('standalone')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSavePassage = async () => {
    if (!passageForm.passage_text) return
    setSaving(true)
    await supabase.from('passages').insert([{ ...passageForm, test_id: id, sequence_order: passages.length + 1 }])
    setSaving(false); setShowPassageForm(false); setPassageForm({ title: '', passage_text: '' })
    fetchData()
  }

  const handleDeletePassage = async (pid: string) => {
    if (!confirm('Delete this passage and all its questions?')) return
    await supabase.from('questions').delete().eq('passage_id', pid)
    await supabase.from('passages').delete().eq('id', pid)
    fetchData()
  }

  // ── CSV FUNCTIONS ──
  const downloadTemplate = () => {
    const headers = 'question_text,option_a,option_b,option_c,option_d,correct_option,difficulty'
    const example1 = '"Which of the following best describes opportunity cost?","The monetary cost of a product","The next best alternative foregone","The total cost of production","The sunk cost of a decision",b,medium'
    const example2 = '"2 + 2 = ?","3","4","5","6",b,easy'
    const example3 = '"Which article of Indian Constitution deals with equality before law?","Article 12","Article 14","Article 19","Article 21",b,hard'
    const csv = [headers, example1, example2, example3].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'question_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    // Skip header row
    const dataLines = lines.slice(1)
    const rows: CsvRow[] = []

    for (const line of dataLines) {
      if (!line.trim()) continue

      // Handle quoted fields (fields wrapped in "...")
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
        else { current += ch }
      }
      fields.push(current.trim())

      const [question_text, option_a, option_b, option_c, option_d, correct_option, difficulty] = fields

      const row: CsvRow = {
        question_text: question_text || '',
        option_a: option_a || '',
        option_b: option_b || '',
        option_c: option_c || '',
        option_d: option_d || '',
        correct_option: (correct_option || '').toLowerCase().trim(),
        difficulty: (difficulty || 'medium').toLowerCase().trim(),
      }

      // Validate
      if (!row.question_text) row.error = 'Missing question text'
      else if (!row.option_a || !row.option_b || !row.option_c || !row.option_d) row.error = 'Missing one or more options'
      else if (!['a', 'b', 'c', 'd'].includes(row.correct_option)) row.error = `Invalid correct_option "${row.correct_option}" — must be a, b, c, or d`
      else if (!['easy', 'medium', 'hard'].includes(row.difficulty)) row.difficulty = 'medium'

      rows.push(row)
    }
    return rows
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setFileName(file.name)
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setCsvRows(rows)
      setCsvParsed(true)
      setImportDone(false)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    const validRows = csvRows.filter(r => !r.error)
    if (validRows.length === 0) return
    setImporting(true)
    const insertData = validRows.map((row, i) => ({
      test_id: id,
      question_text: row.question_text,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_option: row.correct_option,
      difficulty: row.difficulty,
      sequence_order: questions.length + i + 1,
      passage_id: null,
    }))
    await supabase.from('questions').insert(insertData)
    setImporting(false)
    setImportDone(true)
    setCsvRows([]); setCsvParsed(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    fetchData()
  }

  const handleClearCsv = () => {
    setCsvRows([]); setCsvParsed(false); setImportDone(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validCount = csvRows.filter(r => !r.error).length
  const errorCount = csvRows.filter(r => r.error).length

  const standaloneQs = questions.filter(q => !q.passage_id)
  const passageQs = (pid: string) => questions.filter(q => q.passage_id === pid)

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{test?.title}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{test?.duration_minutes}m · {test?.mode} · +{test?.marking_correct}/{test?.marking_wrong}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>
            {questions.length} Questions
          </span>
          <button onClick={() => router.push(`/admin/results/${id}`)}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            📊 View Results
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Section Toggle — 3 tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {([
            { key: 'standalone', label: '+ Standalone Question' },
            { key: 'passage',    label: '+ Passage-based (RC)' },
            { key: 'csv',        label: '📥 Bulk CSV Upload' },
          ] as const).map(s => (
            <button key={s.key}
              onClick={() => { setActiveSection(s.key); setForm(emptyQ); setEditingQ(null) }}
              className={activeSection === s.key ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '8px 20px', fontSize: '13px' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── STANDALONE / PASSAGE QUESTION FORM ── */}
        {(activeSection === 'standalone' || activeSection === 'passage') && (
          <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid var(--primary)' }}>
            <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '18px' }}>
              {editingQ ? '✎ Edit Question' : activeSection === 'passage' ? 'Add Passage-based Question' : 'Add Standalone Question'}
              {editingQ && (
                <button onClick={() => { setEditingQ(null); setForm(emptyQ) }}
                  style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Cancel edit
                </button>
              )}
            </h2>

            {activeSection === 'passage' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Link to Passage</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={form.passage_id || ''} onChange={e => setForm({ ...form, passage_id: e.target.value || null })} className="input" style={{ flex: 1 }}>
                    <option value="">Select a passage</option>
                    {passages.map(p => <option key={p.id} value={p.id}>{p.title || `Passage ${p.sequence_order}`}</option>)}
                  </select>
                  <button onClick={() => setShowPassageForm(true)} className="btn-outline" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>+ New Passage</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Question Text</label>
                <textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })}
                  placeholder="Enter question..." rows={3} className="input" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {['a', 'b', 'c', 'd'].map(opt => (
                  <div key={opt}>
                    <label className="label">Option {opt.toUpperCase()}</label>
                    <input value={form[`option_${opt}` as keyof typeof form] as string}
                      onChange={e => setForm({ ...form, [`option_${opt}`]: e.target.value })}
                      placeholder={`Option ${opt.toUpperCase()}`} className="input" />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Correct Answer</label>
                  <select value={form.correct_option} onChange={e => setForm({ ...form, correct_option: e.target.value })} className="input">
                    {['a', 'b', 'c', 'd'].map(o => <option key={o} value={o}>Option {o.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className="input">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <button onClick={handleSaveQ} disabled={saving} className="btn-primary" style={{ padding: '12px', fontSize: '14px' }}>
                {saved ? '✅ Saved!' : saving ? 'Saving...' : editingQ ? 'Update Question' : 'Save & Add Next →'}
              </button>
            </div>
          </div>
        )}

        {/* New Passage Form */}
        {showPassageForm && (
          <div className="card" style={{ marginBottom: '24px', border: '2px solid #7c3aed' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', color: '#7c3aed' }}>Create New Passage</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label">Passage Title (optional)</label>
                <input value={passageForm.title} onChange={e => setPassageForm({ ...passageForm, title: e.target.value })}
                  placeholder="e.g. The Digital Economy" className="input" />
              </div>
              <div>
                <label className="label">Passage Text</label>
                <textarea value={passageForm.passage_text} onChange={e => setPassageForm({ ...passageForm, passage_text: e.target.value })}
                  placeholder="Paste the RC passage here..." rows={8} className="input" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSavePassage} disabled={saving} className="btn-primary" style={{ padding: '10px 20px' }}>Save Passage</button>
                <button onClick={() => setShowPassageForm(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── CSV UPLOAD TAB ── */}
        {activeSection === 'csv' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Instructions card */}
            <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>Bulk Upload via CSV</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '18px' }}>
                Download the template, fill in your questions, and upload. All valid questions will be imported at once.
              </p>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>1</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: '6px' }}>Download the template</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '10px' }}>
                    Open in Excel or Google Sheets. Fill one question per row. Do not change the column headers.
                  </p>
                  <button onClick={downloadTemplate} className="btn-outline" style={{ fontSize: '13px' }}>
                    ⬇ Download Template CSV
                  </button>
                </div>
              </div>

              {/* Column guide */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginBottom: '20px', fontSize: '13px' }}>
                <p style={{ fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)' }}>Column Guide</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px 16px' }}>
                  {[
                    ['question_text', 'Full question text (wrap in quotes if it contains commas)'],
                    ['option_a', 'Text for Option A'],
                    ['option_b', 'Text for Option B'],
                    ['option_c', 'Text for Option C'],
                    ['option_d', 'Text for Option D'],
                    ['correct_option', 'Must be exactly: a, b, c, or d'],
                    ['difficulty', 'Must be: easy, medium, or hard (defaults to medium)'],
                  ].map(([col, desc]) => (
                    <>
                      <span key={col} style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{col}</span>
                      <span key={desc} style={{ color: 'var(--text-muted)' }}>{desc}</span>
                    </>
                  ))}
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>2</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: '6px' }}>Upload your filled CSV</p>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload}
                   style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} className="btn-outline" style={{ fontSize: '13px' }}>📂 Choose CSV File
                  </button>
                  {csvFileName && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>📄 {csvFileName}</p>}
                </div>
              </div>
            </div>

            {/* Import success message */}
            {importDone && (
              <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '10px', padding: '16px', color: 'var(--success)', fontWeight: 600, fontSize: '14px' }}>
                ✅ Questions imported successfully! They are now visible below.
              </div>
            )}

            {/* Preview */}
            {csvParsed && csvRows.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '15px' }}>Preview — {csvRows.length} rows found</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{validCount} valid</span>
                      {errorCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {errorCount} with errors (will be skipped)</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleClearCsv} className="btn-ghost" style={{ fontSize: '13px' }}>✕ Clear</button>
                    <button onClick={handleImport} disabled={importing || validCount === 0} className="btn-primary" style={{ fontSize: '13px', padding: '9px 20px' }}>
                      {importing ? 'Importing...' : `Import ${validCount} Question${validCount !== 1 ? 's' : ''} →`}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {csvRows.map((row, i) => (
                    <div key={i} style={{
                      border: `1px solid ${row.error ? 'var(--danger)' : 'var(--border)'}`,
                      background: row.error ? 'var(--danger-light)' : 'var(--bg-secondary)',
                      borderRadius: '8px', padding: '12px 14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: row.error ? 'var(--danger)' : 'var(--text)' }}>
                            {i + 1}. {row.question_text || '(empty)'}
                          </p>
                          {!row.error && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {['a', 'b', 'c', 'd'].map(opt => (
                                <span key={opt} style={{
                                  fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                  background: row.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)',
                                  color: row.correct_option === opt ? 'var(--success)' : 'var(--text-muted)',
                                  fontWeight: row.correct_option === opt ? 700 : 400
                                }}>
                                  {opt.toUpperCase()}: {(row[`option_${opt}` as keyof CsvRow] as string || '').slice(0, 30)}
                                </span>
                              ))}
                              <span className={row.difficulty === 'easy' ? 'badge-green' : row.difficulty === 'hard' ? 'badge-red' : 'badge-yellow'}>
                                {row.difficulty}
                              </span>
                            </div>
                          )}
                          {row.error && <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>⚠ {row.error}</p>}
                        </div>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: row.error ? 'var(--danger)' : 'var(--success)', color: '#fff', fontWeight: 600, flexShrink: 0 }}>
                          {row.error ? 'Skip' : 'Import'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {csvParsed && csvRows.length === 0 && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '10px', padding: '16px', color: 'var(--danger)', fontSize: '14px' }}>
                ⚠ No rows found in the CSV. Make sure you have data rows below the header.
              </div>
            )}
          </div>
        )}

        {/* ── PASSAGES + QUESTIONS LIST ── */}
        {passages.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', color: 'var(--text-secondary)' }}>📖 Passages & RC Questions</h3>
            {passages.map((p, pi) => (
              <div key={p.id} style={{ marginBottom: '16px' }}>
                <div style={{ background: '#f5f3ff', border: '1.5px solid #7c3aed', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, color: '#7c3aed' }}>Passage {pi + 1}{p.title ? ` — ${p.title}` : ''}</span>
                    <button onClick={() => handleDeletePassage(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px' }}>Delete Passage</button>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.passage_text}</p>
                </div>
                {passageQs(p.id).map((q, qi) => (
                  <QuestionCard key={q.id} q={q} index={qi} onEdit={handleEditQ} onDelete={handleDeleteQ} isPassage />
                ))}
                {passageQs(p.id).length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 16px' }}>No questions added to this passage yet.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {standaloneQs.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', color: 'var(--text-secondary)' }}>📝 Standalone Questions</h3>
            {standaloneQs.map((q, i) => (
              <QuestionCard key={q.id} q={q} index={i} onEdit={handleEditQ} onDelete={handleDeleteQ} />
            ))}
          </div>
        )}

        {questions.length === 0 && passages.length === 0 && activeSection !== 'csv' && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            No questions yet. Add your first question above.
          </div>
        )}
      </div>
    </main>
  )
}

function QuestionCard({ q, index, onEdit, onDelete, isPassage }: { q: Question; index: number; onEdit: (q: Question) => void; onDelete: (id: string) => void; isPassage?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '8px', marginLeft: isPassage ? '16px' : '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>Q{index + 1}. {q.question_text.slice(0, 120)}{q.question_text.length > 120 ? '...' : ''}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['a', 'b', 'c', 'd'].map(opt => (
              <span key={opt} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: q.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)', color: q.correct_option === opt ? 'var(--success)' : 'var(--text-muted)', fontWeight: q.correct_option === opt ? 700 : 400 }}>
                {opt.toUpperCase()}: {(q[`option_${opt}` as keyof Question] as string).slice(0, 30)}
              </span>
            ))}
            <span className={q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'hard' ? 'badge-red' : 'badge-yellow'}>{q.difficulty}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => onEdit(q)} style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
          <button onClick={() => onDelete(q.id)} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>
  )
}