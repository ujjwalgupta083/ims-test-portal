'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; sequence_order: number; passage_id: string | null; section_id: string | null }
type Passage = { id: string; passage_text: string; title: string; sequence_order: number }
type Section = { id: string; title: string; sequence_order: number; duration_minutes: number; mode: string }
type Test = { id: string; title: string; mode: string; duration_minutes: number; marking_correct: number; marking_wrong: number }
type CsvRow = { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; error?: string }

const emptyQ = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', passage_id: null as string | null, section_id: null as string | null }

export default function TestQuestions() {
  const router = useRouter()
  const { id } = useParams()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [passages, setPassages] = useState<Passage[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [form, setForm] = useState(emptyQ)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingQ, setEditingQ] = useState<string | null>(null)
  const [passageForm, setPassageForm] = useState({ title: '', passage_text: '' })
  const [showPassageForm, setShowPassageForm] = useState(false)
  const [sectionForm, setSectionForm] = useState({ title: '', duration_minutes: '0', mode: 'timer' })
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'standalone' | 'passage' | 'csv' | 'sections'>('standalone')

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
    const { data: s } = await supabase.from('sections').select('*').eq('test_id', id).order('sequence_order')
    setTest(t); setQuestions(q || []); setPassages(p || []); setSections(s || [])
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
    setForm({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, passage_id: q.passage_id, section_id: q.section_id })
    setEditingQ(q.id)
    setActiveTab(q.passage_id ? 'passage' : 'standalone')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSavePassage = async () => {
    if (!passageForm.passage_text) return
    setSaving(true)
    const { data: newP } = await supabase.from('passages').insert([{ ...passageForm, test_id: id, sequence_order: passages.length + 1 }]).select().single()
    setSaving(false); setShowPassageForm(false); setPassageForm({ title: '', passage_text: '' })
    if (newP) setForm(prev => ({ ...prev, passage_id: newP.id }))
    fetchData()
  }

  const handleDeletePassage = async (pid: string) => {
    if (!confirm('Delete this passage and all its questions?')) return
    await supabase.from('questions').delete().eq('passage_id', pid)
    await supabase.from('passages').delete().eq('id', pid)
    fetchData()
  }

  const handleSaveSection = async () => {
    if (!sectionForm.title.trim()) return
    setSaving(true)
    await supabase.from('sections').insert([{
      test_id: id, title: sectionForm.title.trim(),
      duration_minutes: parseInt(sectionForm.duration_minutes) || 0,
      mode: sectionForm.mode, sequence_order: sections.length + 1
    }])
    setSaving(false); setShowSectionForm(false)
    setSectionForm({ title: '', duration_minutes: '0', mode: 'timer' })
    fetchData()
  }

  const handleDeleteSection = async (sid: string) => {
    if (!confirm('Delete this section? Questions in it will become unassigned.')) return
    await supabase.from('questions').update({ section_id: null }).eq('section_id', sid)
    await supabase.from('sections').delete().eq('id', sid)
    fetchData()
  }

  const downloadTemplate = () => {
    const headers = 'question_text,option_a,option_b,option_c,option_d,correct_option'
    const ex1 = '"Which of the following best describes opportunity cost?","The monetary cost of a product","The next best alternative foregone","The total cost of production","The sunk cost of a decision",b'
    const ex2 = '"2 + 2 = ?","3","4","5","6",b'
    const csv = [headers, ex1, ex2].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'question_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const fields: string[] = []
      let current = '', inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
        else { current += ch }
      }
      fields.push(current.trim())
      const [question_text, option_a, option_b, option_c, option_d, correct_option] = fields
      const row: CsvRow = { question_text: question_text || '', option_a: option_a || '', option_b: option_b || '', option_c: option_c || '', option_d: option_d || '', correct_option: (correct_option || '').toLowerCase().trim() }
      if (!row.question_text) row.error = 'Missing question text'
      else if (!row.option_a || !row.option_b || !row.option_c || !row.option_d) row.error = 'Missing one or more options'
      else if (!['a', 'b', 'c', 'd'].includes(row.correct_option)) row.error = `Invalid correct_option "${row.correct_option}"`
      return row
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setFileName(file.name)
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const rows = parseCSV(ev.target?.result as string); setCsvRows(rows); setCsvParsed(true); setImportDone(false) }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    const validRows = csvRows.filter(r => !r.error)
    if (!validRows.length) return
    setImporting(true)
    await supabase.from('questions').insert(validRows.map((row, i) => ({ test_id: id, ...row, sequence_order: questions.length + i + 1, passage_id: null, section_id: null })))
    setImporting(false); setImportDone(true); setCsvRows([]); setCsvParsed(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    fetchData()
  }

  const handleClearCsv = () => { setCsvRows([]); setCsvParsed(false); setImportDone(false); if (fileInputRef.current) fileInputRef.current.value = '' }

  const validCount = csvRows.filter(r => !r.error).length
  const errorCount = csvRows.filter(r => r.error).length
  const standaloneQs = questions.filter(q => !q.passage_id)
  const passageQs = (pid: string) => questions.filter(q => q.passage_id === pid)

  // Shared question form — called as function, not component, to avoid remount
  const renderQuestionForm = () => (
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
      <div style={{ display: 'grid', gridTemplateColumns: sections.length > 0 ? '1fr 1fr' : '1fr', gap: '12px' }}>
        <div>
          <label className="label">Correct Answer</label>
          <select value={form.correct_option} onChange={e => setForm({ ...form, correct_option: e.target.value })} className="input">
            {['a', 'b', 'c', 'd'].map(o => <option key={o} value={o}>Option {o.toUpperCase()}</option>)}
          </select>
        </div>
        {sections.length > 0 && (
          <div>
            <label className="label">Section (optional)</label>
            <select value={form.section_id || ''} onChange={e => setForm({ ...form, section_id: e.target.value || null })} className="input">
              <option value="">No section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        )}
      </div>
      <button onClick={handleSaveQ} disabled={saving} className="btn-primary" style={{ padding: '12px', fontSize: '14px' }}>
        {saved ? '✅ Saved!' : saving ? 'Saving...' : editingQ ? 'Update Question' : 'Save & Add Next →'}
      </button>
    </div>
  )

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
          {sections.length > 0 && (
            <span style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>
              {sections.length} Sections
            </span>
          )}
          <button onClick={() => router.push(`/admin/results/${id}`)}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            📊 View Results
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {([
            { key: 'standalone', label: '+ Standalone Question' },
            { key: 'passage',    label: '+ Passage/Set Based Questions' },
            { key: 'csv',        label: '📥 Bulk CSV Upload' },
            { key: 'sections',   label: `🗂 Sections${sections.length > 0 ? ` (${sections.length})` : ''}` },
          ] as const).map(tab => (
            <button key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setForm(emptyQ); setEditingQ(null)
                if (tab.key !== 'passage') setShowPassageForm(false)
              }}
              className={activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '8px 20px', fontSize: '13px' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── STANDALONE TAB ── */}
        {activeTab === 'standalone' && (
          <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid var(--primary)' }}>
            <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '18px' }}>
              {editingQ ? '✎ Edit Question' : 'Add Standalone Question'}
              {editingQ && (
                <button onClick={() => { setEditingQ(null); setForm(emptyQ) }}
                  style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Cancel edit
                </button>
              )}
            </h2>
            {renderQuestionForm()}
          </div>
        )}

        {/* ── PASSAGE/SET TAB — Two Column Layout ── */}
        {activeTab === 'passage' && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>

            {/* Left: Passage Panel */}
            <div style={{ width: '290px', flexShrink: 0 }}>
              {showPassageForm ? (
                <div className="card" style={{ border: '2px solid #7c3aed' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '14px', color: '#7c3aed', fontSize: '14px' }}>New Passage / Set</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label className="label">Title (optional)</label>
                      <input value={passageForm.title} onChange={e => setPassageForm({ ...passageForm, title: e.target.value })}
                        placeholder="e.g. The Digital Economy" className="input" />
                    </div>
                    <div>
                      <label className="label">Passage / Set Text</label>
                      <textarea value={passageForm.passage_text} onChange={e => setPassageForm({ ...passageForm, passage_text: e.target.value })}
                        placeholder="Paste passage or set context here..." rows={10} className="input" style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={handleSavePassage} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => { setShowPassageForm(false); setPassageForm({ title: '', passage_text: '' }) }} className="btn-ghost" style={{ fontSize: '13px' }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#7c3aed' }}>Passages / Sets</h3>
                    <button onClick={() => setShowPassageForm(true)} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>+ New</button>
                  </div>
                  {passages.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>
                      No passages yet. Create one, then add questions linked to it.
                    </p>
                  ) : passages.map((p, pi) => (
                    <div key={p.id}
                      onClick={() => setForm(prev => ({ ...prev, passage_id: p.id }))}
                      style={{
                        padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.15s',
                        border: `2px solid ${form.passage_id === p.id ? '#7c3aed' : 'var(--border)'}`,
                        background: form.passage_id === p.id ? '#f5f3ff' : 'var(--bg-secondary)'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: form.passage_id === p.id ? '#7c3aed' : 'var(--text)' }}>
                          {p.title || `Passage ${pi + 1}`}
                        </span>
                        <button onClick={e => { e.stopPropagation(); handleDeletePassage(p.id) }}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>
                          Delete
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4',
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                        {p.passage_text}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        {passageQs(p.id).length} question{passageQs(p.id).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Question Form */}
            <div style={{ flex: 1 }}>
              <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
                <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '14px' }}>
                  {editingQ ? '✎ Edit Question' : 'Add Passage/Set Question'}
                  {editingQ && (
                    <button onClick={() => { setEditingQ(null); setForm(emptyQ) }}
                      style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Cancel edit
                    </button>
                  )}
                </h2>

                {/* Linked Passage Indicator */}
                <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${form.passage_id ? '#7c3aed' : 'var(--border)'}`, background: form.passage_id ? '#f5f3ff' : 'var(--bg-secondary)' }}>
                  {form.passage_id ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>
                        📎 Linked: {passages.find(p => p.id === form.passage_id)?.title || 'Untitled Passage'}
                      </p>
                      <button onClick={() => setForm(prev => ({ ...prev, passage_id: null }))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>← Select a passage from the left panel to link</p>
                  )}
                </div>

                {renderQuestionForm()}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTIONS TAB ── */}
        {activeTab === 'sections' && (
          <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid #7c3aed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '16px' }}>Test Sections</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', maxWidth: '480px' }}>
                  Optional. Divide this test into sections like VARC, DILR, QA. Each section can have its own timer.
                  Once sections exist, questions can be tagged to a section in the question form.
                </p>
              </div>
              <button onClick={() => setShowSectionForm(true)} className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px', flexShrink: 0, marginLeft: '16px' }}>
                + Add Section
              </button>
            </div>

            {showSectionForm && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid #7c3aed', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="label">Section Name</label>
                    <input value={sectionForm.title} onChange={e => setSectionForm({ ...sectionForm, title: e.target.value })}
                      placeholder="e.g. VARC, DILR, QA" className="input" />
                  </div>
                  <div>
                    <label className="label">Duration (min)</label>
                    <input type="number" value={sectionForm.duration_minutes} onChange={e => setSectionForm({ ...sectionForm, duration_minutes: e.target.value })}
                      placeholder="0 = test timer" className="input" />
                  </div>
                  <div>
                    <label className="label">Mode</label>
                    <select value={sectionForm.mode} onChange={e => setSectionForm({ ...sectionForm, mode: e.target.value })} className="input">
                      <option value="timer">⏱ Timer</option>
                      <option value="stopwatch">⏱ Stopwatch</option>
                    </select>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Duration 0 = section uses the overall test timer with no separate countdown.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSaveSection} disabled={saving} className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                    {saving ? 'Saving...' : 'Add Section'}
                  </button>
                  <button onClick={() => { setShowSectionForm(false); setSectionForm({ title: '', duration_minutes: '0', mode: 'timer' }) }} className="btn-ghost" style={{ fontSize: '13px' }}>Cancel</button>
                </div>
              </div>
            )}

            {sections.length === 0 && !showSectionForm && (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                <p style={{ fontSize: '14px', marginBottom: '4px' }}>No sections created</p>
                <p style={{ fontSize: '13px' }}>All questions will be in one pool with the test-level timer.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{i + 1}. {s.title}</span>
                    <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {s.duration_minutes > 0 ? `${s.duration_minutes} min · ${s.mode}` : 'Uses test-level timer'}
                      {' · '}
                      {questions.filter(q => q.section_id === s.id).length} question{questions.filter(q => q.section_id === s.id).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteSection(s.id)}
                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CSV TAB ── */}
        {activeTab === 'csv' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
              <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>Bulk Upload via CSV</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '18px' }}>
                Download the template, fill in your questions, and upload.
              </p>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>1</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: '6px' }}>Download the template</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '10px' }}>Open in Excel or Google Sheets. One question per row. Do not rename headers.</p>
                  <button onClick={downloadTemplate} className="btn-outline" style={{ fontSize: '13px' }}>⬇ Download Template CSV</button>
                </div>
              </div>

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
                  ].map(([col, desc]) => (
                    <>
                      <span key={col} style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{col}</span>
                      <span key={desc} style={{ color: 'var(--text-muted)' }}>{desc}</span>
                    </>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>2</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: '6px' }}>Upload your filled CSV</p>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} className="btn-outline" style={{ fontSize: '13px' }}>📂 Choose CSV File</button>
                  {csvFileName && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>📄 {csvFileName}</p>}
                </div>
              </div>
            </div>

            {importDone && (
              <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '10px', padding: '16px', color: 'var(--success)', fontWeight: 600, fontSize: '14px' }}>
                ✅ Questions imported successfully!
              </div>
            )}

            {csvParsed && csvRows.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '15px' }}>Preview — {csvRows.length} rows</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{validCount} valid</span>
                      {errorCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {errorCount} errors (will be skipped)</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleClearCsv} className="btn-ghost" style={{ fontSize: '13px' }}>✕ Clear</button>
                    <button onClick={handleImport} disabled={importing || validCount === 0} className="btn-primary" style={{ fontSize: '13px', padding: '9px 20px' }}>
                      {importing ? 'Importing...' : `Import ${validCount} →`}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {csvRows.map((row, i) => (
                    <div key={i} style={{ border: `1px solid ${row.error ? 'var(--danger)' : 'var(--border)'}`, background: row.error ? 'var(--danger-light)' : 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: row.error ? 'var(--danger)' : 'var(--text)' }}>
                            {i + 1}. {row.question_text || '(empty)'}
                          </p>
                          {!row.error && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {['a', 'b', 'c', 'd'].map(opt => (
                                <span key={opt} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: row.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)', color: row.correct_option === opt ? 'var(--success)' : 'var(--text-muted)', fontWeight: row.correct_option === opt ? 700 : 400 }}>
                                  {opt.toUpperCase()}: {(row[`option_${opt}` as keyof CsvRow] as string || '').slice(0, 30)}
                                </span>
                              ))}
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
                ⚠ No rows found in the CSV.
              </div>
            )}
          </div>
        )}

        {/* ── PASSAGES + QUESTIONS LIST (all tabs except sections) ── */}
        {activeTab !== 'sections' && (
          <>
            {passages.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', color: 'var(--text-secondary)' }}>📖 Passages / Sets & Questions</h3>
                {passages.map((p, pi) => (
                  <div key={p.id} style={{ marginBottom: '16px' }}>
                    <div style={{ background: '#f5f3ff', border: '1.5px solid #7c3aed', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 700, color: '#7c3aed' }}>Passage {pi + 1}{p.title ? ` — ${p.title}` : ''}</span>
                        <button onClick={() => handleDeletePassage(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.passage_text}</p>
                    </div>
                    {passageQs(p.id).map((q, qi) => (
                      <QuestionCard key={q.id} q={q} index={qi} sections={sections} onEdit={handleEditQ} onDelete={handleDeleteQ} isPassage />
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
                  <QuestionCard key={q.id} q={q} index={i} sections={sections} onEdit={handleEditQ} onDelete={handleDeleteQ} />
                ))}
              </div>
            )}

            {questions.length === 0 && passages.length === 0 && activeTab !== 'csv' && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                No questions yet. Add your first question above.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function QuestionCard({ q, index, sections, onEdit, onDelete, isPassage }: {
  q: Question; index: number; sections: Section[]
  onEdit: (q: Question) => void; onDelete: (id: string) => void; isPassage?: boolean
}) {
  const section = sections.find(s => s.id === q.section_id)
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '8px', marginLeft: isPassage ? '16px' : '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>
            Q{index + 1}. {q.question_text.slice(0, 120)}{q.question_text.length > 120 ? '...' : ''}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['a', 'b', 'c', 'd'].map(opt => (
              <span key={opt} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: q.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)', color: q.correct_option === opt ? 'var(--success)' : 'var(--text-muted)', fontWeight: q.correct_option === opt ? 700 : 400 }}>
                {opt.toUpperCase()}: {(q[`option_${opt}` as keyof Question] as string).slice(0, 30)}
              </span>
            ))}
            {section && (
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>
                {section.title}
              </span>
            )}
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