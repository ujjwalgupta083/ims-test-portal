'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; sequence_order: number; passage_id: string | null; section_id: string | null }
type Passage = { id: string; passage_text: string; title: string; sequence_order: number; section_id: string | null }
type Section = { id: string; title: string; sequence_order: number; duration_minutes: number; mode: string }
type Test = { id: string; title: string; mode: string; duration_minutes: number; marking_correct: number; marking_wrong: number }
type CsvRow = { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; section: string; error?: string }
type PassageCsvRow = { passage_title: string; passage_text: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; section: string; error?: string }

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

  const [passageForm, setPassageForm] = useState({ title: '', passage_text: '', section_id: '' })
  const [showPassageForm, setShowPassageForm] = useState(false)
  const [editingPassageId, setEditingPassageId] = useState<string | null>(null)

  const [sectionForm, setSectionForm] = useState({ title: '', duration_minutes: '0', mode: 'timer' })
  const [showSectionForm, setShowSectionForm] = useState(false)

  const [activeTab, setActiveTab] = useState<'standalone' | 'passage' | 'csv' | 'sections'>('standalone')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedQs, setExpandedQs] = useState<Set<string>>(new Set())
  const [selectedQs, setSelectedQs] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const standaloneFileRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvParsed, setCsvParsed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [csvFileName, setCsvFileName] = useState('')

  const passageFileRef = useRef<HTMLInputElement>(null)
  const [passageCsvRows, setPassageCsvRows] = useState<PassageCsvRow[]>([])
  const [passageCsvParsed, setPassageCsvParsed] = useState(false)
  const [passageImporting, setPassageImporting] = useState(false)
  const [passageImportDone, setPassageImportDone] = useState(false)
  const [passageCsvFileName, setPassageCsvFileName] = useState('')

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
    const payload = { ...form }
    if (payload.passage_id) payload.section_id = null
    if (editingQ) {
      await supabase.from('questions').update(payload).eq('id', editingQ)
      setEditingQ(null)
    } else {
      await supabase.from('questions').insert([{ ...payload, test_id: id, sequence_order: questions.length + 1 }])
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

  const handleDuplicateQ = async (q: Question) => {
    await supabase.from('questions').insert([{
      test_id: id, question_text: q.question_text + ' (copy)',
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_option: q.correct_option, passage_id: q.passage_id, section_id: q.section_id,
      sequence_order: questions.length + 1
    }])
    fetchData()
  }

  const handleReorder = async (q: Question, direction: 'up' | 'down') => {
    const list = questions.filter(x => x.passage_id === q.passage_id)
    const idx = list.findIndex(x => x.id === q.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    const swap = list[swapIdx]
    await supabase.from('questions').update({ sequence_order: swap.sequence_order }).eq('id', q.id)
    await supabase.from('questions').update({ sequence_order: q.sequence_order }).eq('id', swap.id)
    fetchData()
  }

  const handleBulkDelete = async () => {
    if (!selectedQs.size || !confirm(`Delete ${selectedQs.size} selected question(s)?`)) return
    setBulkDeleting(true)
    await supabase.from('questions').delete().in('id', Array.from(selectedQs))
    setSelectedQs(new Set()); setBulkDeleting(false); fetchData()
  }

  const handleExportCSV = () => {
    const headers = ['#', 'Type', 'Passage', 'Section', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct']
    const rows = questions.map((q, i) => {
      const passage = passages.find(p => p.id === q.passage_id)
      const section = sections.find(s => s.id === (q.passage_id ? passage?.section_id : q.section_id))
      return [i + 1, q.passage_id ? 'Passage' : 'Standalone', passage?.title || '', section?.title || '', q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option.toUpperCase()]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${test?.title}_questions.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleSavePassage = async () => {
    if (!passageForm.passage_text) return
    setSaving(true)
    const payload = { title: passageForm.title, passage_text: passageForm.passage_text, section_id: passageForm.section_id || null }
    if (editingPassageId) {
      await supabase.from('passages').update(payload).eq('id', editingPassageId)
      setEditingPassageId(null)
    } else {
      const { data: newP } = await supabase.from('passages').insert([{ ...payload, test_id: id, sequence_order: passages.length + 1 }]).select().single()
      if (newP) setForm(prev => ({ ...prev, passage_id: newP.id }))
    }
    setSaving(false); setShowPassageForm(false)
    setPassageForm({ title: '', passage_text: '', section_id: '' })
    fetchData()
  }

  const handleEditPassage = (p: Passage) => {
    setPassageForm({ title: p.title || '', passage_text: p.passage_text, section_id: p.section_id || '' })
    setEditingPassageId(p.id); setShowPassageForm(true)
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
    await supabase.from('sections').insert([{ test_id: id, title: sectionForm.title.trim(), duration_minutes: parseInt(sectionForm.duration_minutes) || 0, mode: sectionForm.mode, sequence_order: sections.length + 1 }])
    setSaving(false); setShowSectionForm(false)
    setSectionForm({ title: '', duration_minutes: '0', mode: 'timer' }); fetchData()
  }

  const handleDeleteSection = async (sid: string) => {
    if (!confirm('Delete this section? Questions and passages will become unassigned.')) return
    await supabase.from('questions').update({ section_id: null }).eq('section_id', sid)
    await supabase.from('passages').update({ section_id: null }).eq('section_id', sid)
    await supabase.from('sections').delete().eq('id', sid)
    fetchData()
  }

  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = []; let current = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
    fields.push(current.trim()); return fields
  }

  const downloadStandaloneTemplate = () => {
    const headers = 'question_text,option_a,option_b,option_c,option_d,correct_option,section'
    const ex1 = '"Which best describes opportunity cost?","Monetary cost","Next best alternative foregone","Total cost","Sunk cost",b,QA'
    const ex2 = '"Identify error: He go to school.","go","to","school","everyday",a,VARC'
    const ex3 = '"2 + 2 = ?","3","4","5","6",b,'
    const csv = [headers, ex1, ex2, ex3].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'standalone_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseStandaloneCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const [question_text, option_a, option_b, option_c, option_d, correct_option, section] = parseCSVLine(line)
      const row: CsvRow = { question_text: question_text || '', option_a: option_a || '', option_b: option_b || '', option_c: option_c || '', option_d: option_d || '', correct_option: (correct_option || '').toLowerCase().trim(), section: (section || '').trim() }
      if (!row.question_text) row.error = 'Missing question text'
      else if (!row.option_a || !row.option_b || !row.option_c || !row.option_d) row.error = 'Missing options'
      else if (!['a', 'b', 'c', 'd'].includes(row.correct_option)) row.error = `Invalid correct_option "${row.correct_option}"`
      return row
    })
  }

  const handleStandaloneFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => { setCsvRows(parseStandaloneCSV(ev.target?.result as string)); setCsvParsed(true); setImportDone(false) }
    reader.readAsText(file)
  }

  const handleStandaloneImport = async () => {
    const validRows = csvRows.filter(r => !r.error); if (!validRows.length) return
    setImporting(true)
    const sectionNames = [...new Set(validRows.map(r => r.section).filter(Boolean))]
    const sectionMap: Record<string, string> = {}
    for (const name of sectionNames) {
      const existing = sections.find(s => s.title.toLowerCase() === name.toLowerCase())
      if (existing) { sectionMap[name] = existing.id } else {
        const { data: newS } = await supabase.from('sections').insert([{ test_id: id, title: name, duration_minutes: 0, mode: 'timer', sequence_order: sections.length + Object.keys(sectionMap).length + 1 }]).select().single()
        if (newS) sectionMap[name] = newS.id
      }
    }
    await supabase.from('questions').insert(validRows.map((row, i) => ({ test_id: id, question_text: row.question_text, option_a: row.option_a, option_b: row.option_b, option_c: row.option_c, option_d: row.option_d, correct_option: row.correct_option, section_id: row.section ? (sectionMap[row.section] || null) : null, passage_id: null, sequence_order: questions.length + i + 1 })))
    setImporting(false); setImportDone(true); setCsvRows([]); setCsvParsed(false)
    if (standaloneFileRef.current) standaloneFileRef.current.value = ''
    fetchData()
  }

  const downloadPassageTemplate = () => {
    const headers = 'passage_title,passage_text,question_text,option_a,option_b,option_c,option_d,correct_option,section'
    const ex1 = '"The Digital Economy","Technology has transformed commerce globally. E-commerce platforms have disrupted traditional retail.","What is the primary impact of e-commerce?","Reduced global trade","Disrupted traditional retail","Eliminated technology","Increased manufacturing",b,VARC'
    const ex2 = '"The Digital Economy","","Which sector is mentioned as disrupted?","Agriculture","Finance","Retail","Healthcare",c,VARC'
    const csv = [headers, ex1, ex2].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'passage_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parsePassageCSV = (text: string): PassageCsvRow[] => {
    const lines = text.trim().split('\n'); if (lines.length < 2) return []
    let lastPassageText = ''
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const [passage_title, passage_text, question_text, option_a, option_b, option_c, option_d, correct_option, section] = parseCSVLine(line)
      const resolvedPassageText = passage_text?.trim() || lastPassageText
      if (passage_text?.trim()) lastPassageText = passage_text.trim()
      const row: PassageCsvRow = { passage_title: (passage_title || '').trim(), passage_text: resolvedPassageText, question_text: (question_text || '').trim(), option_a: option_a || '', option_b: option_b || '', option_c: option_c || '', option_d: option_d || '', correct_option: (correct_option || '').toLowerCase().trim(), section: (section || '').trim() }
      if (!row.passage_title) row.error = 'Missing passage_title'
      else if (!row.passage_text) row.error = 'Missing passage_text'
      else if (!row.question_text) row.error = 'Missing question_text'
      else if (!row.option_a || !row.option_b || !row.option_c || !row.option_d) row.error = 'Missing options'
      else if (!['a', 'b', 'c', 'd'].includes(row.correct_option)) row.error = `Invalid correct_option "${row.correct_option}"`
      return row
    })
  }

  const handlePassageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPassageCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => { setPassageCsvRows(parsePassageCSV(ev.target?.result as string)); setPassageCsvParsed(true); setPassageImportDone(false) }
    reader.readAsText(file)
  }

  const handlePassageImport = async () => {
    const validRows = passageCsvRows.filter(r => !r.error); if (!validRows.length) return
    setPassageImporting(true)
    const sectionNames = [...new Set(validRows.map(r => r.section).filter(Boolean))]
    const sectionMap: Record<string, string> = {}
    let sectionOffset = 0
    for (const name of sectionNames) {
      const existing = sections.find(s => s.title.toLowerCase() === name.toLowerCase())
      if (existing) { sectionMap[name] = existing.id } else {
        const { data: newS } = await supabase.from('sections').insert([{ test_id: id, title: name, duration_minutes: 0, mode: 'timer', sequence_order: sections.length + sectionOffset + 1 }]).select().single()
        if (newS) { sectionMap[name] = newS.id; sectionOffset++ }
      }
    }
    const passageGroups: Record<string, PassageCsvRow[]> = {}
    for (const row of validRows) {
      if (!passageGroups[row.passage_title]) passageGroups[row.passage_title] = []
      passageGroups[row.passage_title].push(row)
    }
    let qOffset = 0
    for (const [title, rows] of Object.entries(passageGroups)) {
      const firstRow = rows[0]
      const sectionId = firstRow.section ? (sectionMap[firstRow.section] || null) : null
      const { data: newP } = await supabase.from('passages').insert([{ test_id: id, title, passage_text: firstRow.passage_text, section_id: sectionId, sequence_order: passages.length + qOffset + 1 }]).select().single()
      if (newP) {
        await supabase.from('questions').insert(rows.map((row, i) => ({ test_id: id, question_text: row.question_text, option_a: row.option_a, option_b: row.option_b, option_c: row.option_c, option_d: row.option_d, correct_option: row.correct_option, passage_id: newP.id, section_id: null, sequence_order: questions.length + qOffset + i + 1 })))
        qOffset += rows.length
      }
    }
    setPassageImporting(false); setPassageImportDone(true); setPassageCsvRows([]); setPassageCsvParsed(false)
    if (passageFileRef.current) passageFileRef.current.value = ''
    fetchData()
  }

  const validCount = csvRows.filter(r => !r.error).length
  const errorCount = csvRows.filter(r => r.error).length
  const passageValidCount = passageCsvRows.filter(r => !r.error).length
  const passageErrorCount = passageCsvRows.filter(r => r.error).length
  const standaloneQs = questions.filter(q => !q.passage_id)
  const passageQs = (pid: string) => questions.filter(q => q.passage_id === pid)

  const filteredStandalone = standaloneQs.filter(q => !searchQuery || q.question_text.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredPassages = passages.filter(p => !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || passageQs(p.id).some(q => q.question_text.toLowerCase().includes(searchQuery.toLowerCase())))

  const renderQuestionForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label className="label">Question Text</label>
        <textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} placeholder="Enter question..." rows={3} className="input" style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {['a', 'b', 'c', 'd'].map(opt => (
          <div key={opt}>
            <label className="label">Option {opt.toUpperCase()}</label>
            <input value={form[`option_${opt}` as keyof typeof form] as string} onChange={e => setForm({ ...form, [`option_${opt}`]: e.target.value })} placeholder={`Option ${opt.toUpperCase()}`} className="input" />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: !form.passage_id && sections.length > 0 ? '1fr 1fr' : '1fr', gap: '12px' }}>
        <div>
          <label className="label">Correct Answer</label>
          <select value={form.correct_option} onChange={e => setForm({ ...form, correct_option: e.target.value })} className="input">
            {['a', 'b', 'c', 'd'].map(o => <option key={o} value={o}>Option {o.toUpperCase()}</option>)}
          </select>
        </div>
        {!form.passage_id && sections.length > 0 && (
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

  const passageFormPanel = (
    <div className="card" style={{ border: '2px solid #7c3aed' }}>
      <h3 style={{ fontWeight: 700, marginBottom: '14px', color: '#7c3aed', fontSize: '14px' }}>
        {editingPassageId ? '✎ Edit Passage/Set' : 'New Passage / Set'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label className="label">Title (optional)</label>
          <input value={passageForm.title} onChange={e => setPassageForm({ ...passageForm, title: e.target.value })} placeholder="e.g. The Digital Economy" className="input" />
        </div>
        {sections.length > 0 && (
          <div>
            <label className="label">Section (optional)</label>
            <select value={passageForm.section_id} onChange={e => setPassageForm({ ...passageForm, section_id: e.target.value })} className="input">
              <option value="">No section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>All questions in this set inherit this section.</p>
          </div>
        )}
        <div>
          <label className="label">Passage / Set Text</label>
          <textarea value={passageForm.passage_text} onChange={e => setPassageForm({ ...passageForm, passage_text: e.target.value })} placeholder="Paste passage or set context here..." rows={10} className="input" style={{ resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSavePassage} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            {saving ? 'Saving...' : editingPassageId ? 'Update' : 'Save'}
          </button>
          <button onClick={() => { setShowPassageForm(false); setEditingPassageId(null); setPassageForm({ title: '', passage_text: '', section_id: '' }) }} className="btn-ghost" style={{ fontSize: '13px' }}>Cancel</button>
        </div>
      </div>
    </div>
  )

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{test?.title}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{test?.duration_minutes}m · {test?.mode} · +{test?.marking_correct}/{test?.marking_wrong}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>{questions.length} Qs</span>
          {sections.length > 0 && <span style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>{sections.length} Sections</span>}
          {questions.length > 0 && <button onClick={handleExportCSV} className="btn-outline" style={{ fontSize: '13px', padding: '6px 12px' }}>⬇ Export</button>}
          <button onClick={() => window.open(`/exam/${id}`, '_blank')} className="btn-ghost" style={{ fontSize: '13px', padding: '6px 12px' }}>👁 Preview</button>
          <button onClick={() => router.push(`/admin/results/${id}`)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>📊 Results</button>
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
              onClick={() => { setActiveTab(tab.key); if (tab.key !== activeTab) { setForm(emptyQ); setEditingQ(null) }; if (tab.key !== 'passage') setShowPassageForm(false) }}
              className={activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '8px 20px', fontSize: '13px' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* STANDALONE TAB */}
        {activeTab === 'standalone' && (
          <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid var(--primary)' }}>
            <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '18px' }}>
              {editingQ ? '✎ Edit Question' : 'Add Standalone Question'}
              {editingQ && <button onClick={() => { setEditingQ(null); setForm(emptyQ) }} style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel edit</button>}
            </h2>
            {renderQuestionForm()}
          </div>
        )}

        {/* PASSAGE TAB */}
        {activeTab === 'passage' && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
            {/* Left Panel */}
            <div style={{ width: '290px', flexShrink: 0 }}>
              {showPassageForm ? passageFormPanel : (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#7c3aed' }}>Passages / Sets</h3>
                    <button onClick={() => { setShowPassageForm(true); setEditingPassageId(null); setPassageForm({ title: '', passage_text: '', section_id: '' }) }} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>+ New</button>
                  </div>
                  {passages.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>No passages yet. Create one, then add questions linked to it.</p>
                  ) : passages.map((p, pi) => {
                    const pSection = sections.find(s => s.id === p.section_id)
                    return (
                      <div key={p.id} onClick={() => setForm(prev => ({ ...prev, passage_id: p.id }))}
                        style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.15s', border: `2px solid ${form.passage_id === p.id ? '#7c3aed' : 'var(--border)'}`, background: form.passage_id === p.id ? '#f5f3ff' : 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: form.passage_id === p.id ? '#7c3aed' : 'var(--text)', flex: 1 }}>{p.title || `Passage ${pi + 1}`}</span>
                          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleEditPassage(p)} style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                            <button onClick={() => handleDeletePassage(p.id)} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Del</button>
                          </div>
                        </div>
                        {pSection && <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '99px', background: '#ede9fe', color: '#7c3aed', fontWeight: 600, display: 'inline-block', marginBottom: '4px' }}>{pSection.title}</span>}
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{p.passage_text}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{passageQs(p.id).length} question{passageQs(p.id).length !== 1 ? 's' : ''}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Question Form */}
            <div style={{ flex: 1 }}>
              <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
                <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '14px' }}>
                  {editingQ ? '✎ Edit Question' : 'Add Passage/Set Question'}
                  {editingQ && <button onClick={() => { setEditingQ(null); setForm(emptyQ) }} style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel edit</button>}
                </h2>
                <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${form.passage_id ? '#7c3aed' : 'var(--border)'}`, background: form.passage_id ? '#f5f3ff' : 'var(--bg-secondary)' }}>
                  {form.passage_id ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>📎 {passages.find(p => p.id === form.passage_id)?.title || 'Untitled'}</p>
                        {(() => { const p = passages.find(x => x.id === form.passage_id); const sec = sections.find(s => s.id === p?.section_id); return sec ? <p style={{ fontSize: '11px', color: '#7c3aed', marginTop: '2px' }}>Section: {sec.title}</p> : null })()}
                      </div>
                      <button onClick={() => setForm(prev => ({ ...prev, passage_id: null }))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ) : <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>← Select a passage from the left panel to link</p>}
                </div>
                {renderQuestionForm()}
              </div>
            </div>
          </div>
        )}

        {/* SECTIONS TAB */}
        {activeTab === 'sections' && (
          <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid #7c3aed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '16px' }}>Test Sections</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', maxWidth: '480px' }}>Optional. Divide this test into sections like VARC, DILR, QA with individual timers.</p>
              </div>
              <button onClick={() => setShowSectionForm(true)} className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px', flexShrink: 0, marginLeft: '16px' }}>+ Add Section</button>
            </div>
            {showSectionForm && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid #7c3aed', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="label">Section Name</label>
                    <input value={sectionForm.title} onChange={e => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="e.g. VARC, DILR, QA" className="input" />
                  </div>
                  <div>
                    <label className="label">Duration (min)</label>
                    <input type="number" value={sectionForm.duration_minutes} onChange={e => setSectionForm({ ...sectionForm, duration_minutes: e.target.value })} placeholder="0 = test timer" className="input" />
                  </div>
                  <div>
                    <label className="label">Mode</label>
                    <select value={sectionForm.mode} onChange={e => setSectionForm({ ...sectionForm, mode: e.target.value })} className="input">
                      <option value="timer">⏱ Timer</option>
                      <option value="stopwatch">⏱ Stopwatch</option>
                    </select>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Duration 0 = uses overall test timer.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSaveSection} disabled={saving} className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>{saving ? 'Saving...' : 'Add Section'}</button>
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
              {sections.map((s, i) => {
                const count = questions.filter(q => {
                  if (q.section_id === s.id) return true
                  const p = passages.find(p => p.id === q.passage_id)
                  return p?.section_id === s.id
                }).length
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{i + 1}. {s.title}</span>
                      <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {s.duration_minutes > 0 ? `${s.duration_minutes} min · ${s.mode}` : 'Uses test-level timer'} · {count} question{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteSection(s.id)} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CSV TAB — Two column */}
        {activeTab === 'csv' && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

            {/* LEFT: Standalone */}
            <div style={{ flex: 1 }}>
              <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
                <h2 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>📝 Standalone Questions</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>Columns: <code style={{ fontSize: '11px', color: 'var(--primary)' }}>question_text, option_a–d, correct_option, section</code></p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Leave <code>section</code> blank for no section, or write "VARC" to auto-create and assign.</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button onClick={downloadStandaloneTemplate} className="btn-outline" style={{ fontSize: '13px', flex: 1 }}>⬇ Template</button>
                  <button onClick={() => standaloneFileRef.current?.click()} className="btn-outline" style={{ fontSize: '13px', flex: 1 }}>📂 Upload</button>
                  <input ref={standaloneFileRef} type="file" accept=".csv" onChange={handleStandaloneFileUpload} style={{ display: 'none' }} />
                </div>
                {csvFileName && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>📄 {csvFileName}</p>}
                {importDone && <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '8px', padding: '10px', color: 'var(--success)', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>✅ Imported!</div>}
                {csvParsed && csvRows.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ fontSize: '13px' }}><span style={{ color: 'var(--success)', fontWeight: 600 }}>{validCount} valid</span>{errorCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {errorCount} errors</span>}</p>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => { setCsvRows([]); setCsvParsed(false); if (standaloneFileRef.current) standaloneFileRef.current.value = '' }} className="btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }}>✕</button>
                        <button onClick={handleStandaloneImport} disabled={importing || validCount === 0} className="btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }}>{importing ? '...' : `Import ${validCount}`}</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '320px', overflow: 'auto' }}>
                      {csvRows.map((row, i) => (
                        <div key={i} style={{ border: `1px solid ${row.error ? 'var(--danger)' : 'var(--border)'}`, background: row.error ? 'var(--danger-light)' : 'var(--bg-secondary)', borderRadius: '6px', padding: '8px 10px' }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: row.error ? 'var(--danger)' : 'var(--text)', marginBottom: '4px' }}>{i + 1}. {row.question_text.slice(0, 70) || '(empty)'}</p>
                          {!row.error && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {['a','b','c','d'].map(opt => <span key={opt} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: row.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)', color: row.correct_option === opt ? 'var(--success)' : 'var(--text-muted)', fontWeight: row.correct_option === opt ? 700 : 400 }}>{opt.toUpperCase()}: {(row[`option_${opt}` as keyof CsvRow] as string || '').slice(0, 18)}</span>)}
                              {row.section && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>{row.section}</span>}
                            </div>
                          )}
                          {row.error && <p style={{ fontSize: '11px', color: 'var(--danger)' }}>⚠ {row.error}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }} />

            {/* RIGHT: Passage/Set */}
            <div style={{ flex: 1 }}>
              <div className="card" style={{ borderTop: '3px solid #7c3aed' }}>
                <h2 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>📖 Passage/Set Questions</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>Columns: <code style={{ fontSize: '11px', color: '#7c3aed' }}>passage_title, passage_text, question_text, option_a–d, correct_option, section</code></p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Rows with same <code>passage_title</code> auto-group. <code>passage_text</code> only needed on first row of each group.</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button onClick={downloadPassageTemplate} className="btn-outline" style={{ fontSize: '13px', flex: 1 }}>⬇ Template</button>
                  <button onClick={() => passageFileRef.current?.click()} className="btn-outline" style={{ fontSize: '13px', flex: 1 }}>📂 Upload</button>
                  <input ref={passageFileRef} type="file" accept=".csv" onChange={handlePassageFileUpload} style={{ display: 'none' }} />
                </div>
                {passageCsvFileName && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>📄 {passageCsvFileName}</p>}
                {passageImportDone && <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '8px', padding: '10px', color: 'var(--success)', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>✅ Passages & questions imported!</div>}
                {passageCsvParsed && passageCsvRows.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ fontSize: '13px' }}><span style={{ color: 'var(--success)', fontWeight: 600 }}>{passageValidCount} valid</span>{passageErrorCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {passageErrorCount} errors</span>}</p>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => { setPassageCsvRows([]); setPassageCsvParsed(false); if (passageFileRef.current) passageFileRef.current.value = '' }} className="btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }}>✕</button>
                        <button onClick={handlePassageImport} disabled={passageImporting || passageValidCount === 0} className="btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }}>{passageImporting ? '...' : `Import ${passageValidCount}`}</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '320px', overflow: 'auto' }}>
                      {passageCsvRows.map((row, i) => (
                        <div key={i} style={{ border: `1px solid ${row.error ? 'var(--danger)' : 'var(--border)'}`, background: row.error ? 'var(--danger-light)' : 'var(--bg-secondary)', borderRadius: '6px', padding: '8px 10px' }}>
                          <p style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 700, marginBottom: '2px' }}>{row.passage_title}</p>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: row.error ? 'var(--danger)' : 'var(--text)', marginBottom: '4px' }}>{i + 1}. {row.question_text.slice(0, 70) || '(empty)'}</p>
                          {!row.error && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {['a','b','c','d'].map(opt => <span key={opt} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: row.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)', color: row.correct_option === opt ? 'var(--success)' : 'var(--text-muted)', fontWeight: row.correct_option === opt ? 700 : 400 }}>{opt.toUpperCase()}: {(row[`option_${opt}` as keyof PassageCsvRow] as string || '').slice(0, 18)}</span>)}
                              {row.section && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>{row.section}</span>}
                            </div>
                          )}
                          {row.error && <p style={{ fontSize: '11px', color: 'var(--danger)' }}>⚠ {row.error}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* QUESTION LIST */}
        {activeTab !== 'sections' && activeTab !== 'csv' && (questions.length > 0 || passages.length > 0) && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search questions..." className="input" style={{ flex: 1, fontSize: '13px' }} />
              {selectedQs.size > 0 && (
                <>
                  <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {bulkDeleting ? 'Deleting...' : `🗑 Delete ${selectedQs.size}`}
                  </button>
                  <button onClick={() => setSelectedQs(new Set())} className="btn-ghost" style={{ fontSize: '13px' }}>✕</button>
                </>
              )}
            </div>

            {filteredPassages.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', color: 'var(--text-secondary)' }}>📖 Passages / Sets</h3>
                {filteredPassages.map((p, pi) => {
                  const pqs = passageQs(p.id).filter(q => !searchQuery || q.question_text.toLowerCase().includes(searchQuery.toLowerCase()))
                  const pSection = sections.find(s => s.id === p.section_id)
                  return (
                    <div key={p.id} style={{ marginBottom: '16px' }}>
                      <div style={{ background: '#f5f3ff', border: '1.5px solid #7c3aed', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#7c3aed' }}>Passage {pi + 1}{p.title ? ` — ${p.title}` : ''}</span>
                            {pSection && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: '#ede9fe', color: '#7c3aed', fontWeight: 600 }}>{pSection.title}</span>}
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{passageQs(p.id).length} questions</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => { handleEditPassage(p); setActiveTab('passage') }} style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>✎ Edit</button>
                            <button onClick={() => handleDeletePassage(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                          </div>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.passage_text}</p>
                      </div>
                      {pqs.map((q, qi) => (
                        <QuestionCard key={q.id} q={q} index={qi} sections={sections} passages={passages}
                          onEdit={handleEditQ} onDelete={handleDeleteQ} onDuplicate={handleDuplicateQ}
                          onReorder={handleReorder} isFirst={qi === 0} isLast={qi === pqs.length - 1}
                          isSelected={selectedQs.has(q.id)} onSelect={id => setSelectedQs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                          isExpanded={expandedQs.has(q.id)} onExpand={id => setExpandedQs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                          isPassage />
                      ))}
                      {passageQs(p.id).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 16px' }}>No questions added yet.</p>}
                    </div>
                  )
                })}
              </div>
            )}

            {filteredStandalone.length > 0 && (
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', color: 'var(--text-secondary)' }}>📝 Standalone Questions</h3>
                {filteredStandalone.map((q, i) => (
                  <QuestionCard key={q.id} q={q} index={i} sections={sections} passages={passages}
                    onEdit={handleEditQ} onDelete={handleDeleteQ} onDuplicate={handleDuplicateQ}
                    onReorder={handleReorder} isFirst={i === 0} isLast={i === filteredStandalone.length - 1}
                    isSelected={selectedQs.has(q.id)} onSelect={id => setSelectedQs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    isExpanded={expandedQs.has(q.id)} onExpand={id => setExpandedQs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })} />
                ))}
              </div>
            )}

            {searchQuery && filteredStandalone.length === 0 && filteredPassages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No questions match "{searchQuery}"</div>
            )}
          </div>
        )}

        {questions.length === 0 && passages.length === 0 && activeTab !== 'csv' && activeTab !== 'sections' && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            No questions yet. Add your first question above.
          </div>
        )}
      </div>
    </main>
  )
}

function QuestionCard({ q, index, sections, passages, onEdit, onDelete, onDuplicate, onReorder, isFirst, isLast, isSelected, onSelect, isExpanded, onExpand, isPassage }: {
  q: Question; index: number; sections: Section[]; passages: Passage[]
  onEdit: (q: Question) => void; onDelete: (id: string) => void
  onDuplicate: (q: Question) => void; onReorder: (q: Question, dir: 'up' | 'down') => void
  isFirst: boolean; isLast: boolean
  isSelected: boolean; onSelect: (id: string) => void
  isExpanded: boolean; onExpand: (id: string) => void
  isPassage?: boolean
}) {
  const passage = passages.find(p => p.id === q.passage_id)
  const section = sections.find(s => s.id === (q.passage_id ? passage?.section_id : q.section_id))
  return (
    <div style={{ background: isSelected ? '#eff6ff' : '#fff', border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '8px', marginLeft: isPassage ? '16px' : '0', transition: 'all 0.1s' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>

        {/* Checkbox + reorder */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(q.id)} style={{ width: '15px', height: '15px', cursor: 'pointer', marginBottom: '4px' }} />
          <button onClick={() => onReorder(q, 'up')} disabled={isFirst} style={{ background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? 'var(--border)' : 'var(--text-muted)', fontSize: '11px', padding: '1px 3px', lineHeight: 1 }}>▲</button>
          <button onClick={() => onReorder(q, 'down')} disabled={isLast} style={{ background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', color: isLast ? 'var(--border)' : 'var(--text-muted)', fontSize: '11px', padding: '1px 3px', lineHeight: 1 }}>▼</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px', lineHeight: '1.5' }}>
            Q{index + 1}. {isExpanded ? q.question_text : q.question_text.slice(0, 120) + (q.question_text.length > 120 ? '...' : '')}
          </p>
          {isExpanded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              {['a','b','c','d'].map(opt => (
                <div key={opt} style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '13px', background: q.correct_option === opt ? 'var(--success-light)' : 'var(--bg-secondary)', color: q.correct_option === opt ? 'var(--success)' : 'var(--text)', fontWeight: q.correct_option === opt ? 600 : 400, border: `1px solid ${q.correct_option === opt ? 'var(--success)' : 'var(--border)'}` }}>
                  {opt.toUpperCase()}: {q[`option_${opt}` as keyof Question] as string}{q.correct_option === opt ? ' ✓' : ''}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '4px' }}>
              {['a','b','c','d'].map(opt => (
                <span key={opt} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '5px', background: q.correct_option === opt ? 'var(--success-light)' : 'var(--bg-tertiary)', color: q.correct_option === opt ? 'var(--success)' : 'var(--text-muted)', fontWeight: q.correct_option === opt ? 700 : 400 }}>
                  {opt.toUpperCase()}: {(q[`option_${opt}` as keyof Question] as string).slice(0, 25)}
                </span>
              ))}
              {section && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>{section.title}</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={() => onExpand(q.id)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>{isExpanded ? '↑' : '↓'}</button>
          <button onClick={() => onDuplicate(q)} style={{ background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Copy</button>
          <button onClick={() => onEdit(q)} style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
          <button onClick={() => onDelete(q.id)} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Del</button>
        </div>
      </div>
    </div>
  )
}