'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; difficulty: string; sequence_order: number; passage_id: string | null }
type Passage = { id: string; passage_text: string; title: string; sequence_order: number }
type Test = { id: string; title: string; mode: string; duration_minutes: number; marking_correct: number; marking_wrong: number }

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
  const [activeSection, setActiveSection] = useState<'standalone' | 'passage'>('standalone')

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

        {/* Section Toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {(['standalone', 'passage'] as const).map(s => (
            <button key={s} onClick={() => { setActiveSection(s); setForm(emptyQ); setEditingQ(null) }}
              className={activeSection === s ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '8px 20px', fontSize: '13px' }}>
              {s === 'standalone' ? '+ Standalone Question' : '+ Passage-based (RC)'}
            </button>
          ))}
        </div>

        {/* Question Form */}
        <div className="card" style={{ marginBottom: '24px', borderTop: `3px solid var(--primary)` }}>
          <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '18px' }}>
            {editingQ ? '✎ Edit Question' : activeSection === 'passage' ? 'Add Passage-based Question' : 'Add Standalone Question'}
            {editingQ && <button onClick={() => { setEditingQ(null); setForm(emptyQ) }} style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel edit</button>}
          </h2>

          {/* Passage selector (for passage mode) */}
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
                placeholder="Enter question..." rows={3}
                className="input" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {['a', 'b', 'c', 'd'].map(opt => (
                <div key={opt}>
                  <label className="label">Option {opt.toUpperCase()}</label>
                  <input value={form[`option_${opt}` as keyof typeof form] as string} onChange={e => setForm({ ...form, [`option_${opt}`]: e.target.value })} placeholder={`Option ${opt.toUpperCase()}`} className="input" />
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

        {/* New Passage Form */}
        {showPassageForm && (
          <div className="card" style={{ marginBottom: '24px', border: '2px solid #7c3aed' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', color: '#7c3aed' }}>Create New Passage</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label">Passage Title (optional)</label>
                <input value={passageForm.title} onChange={e => setPassageForm({ ...passageForm, title: e.target.value })} placeholder="e.g. The Digital Economy" className="input" />
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

        {/* Passages + their Questions */}
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
                {passageQs(p.id).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 16px' }}>No questions added to this passage yet. Select this passage above and add questions.</p>}
              </div>
            ))}
          </div>
        )}

        {/* Standalone Questions */}
        {standaloneQs.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', color: 'var(--text-secondary)' }}>📝 Standalone Questions</h3>
            {standaloneQs.map((q, i) => (
              <QuestionCard key={q.id} q={q} index={i} onEdit={handleEditQ} onDelete={handleDeleteQ} />
            ))}
          </div>
        )}

        {questions.length === 0 && passages.length === 0 && (
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