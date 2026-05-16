'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Test = { id: string; title: string; schedule_time: string; mode: string; sequence_order: number; duration_minutes: number; marking_correct: number; marking_wrong: number; tag: string }

const empty = { title: '', schedule_time: '', duration_minutes: '', mode: 'timer', marking_correct: '3', marking_wrong: '-1', tag: '' }

export default function AdminDashboard() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchTests()
  }, [])

  const fetchTests = async () => {
    const { data } = await supabase.from('tests').select('*').order('schedule_time', { ascending: false })
    setTests(data || [])
  }

  const handleCreate = async () => {
    if (!form.title || !form.schedule_time || !form.duration_minutes) return
    setSaving(true)
    const { data } = await supabase.from('tests').insert([{
      title: form.title, schedule_time: form.schedule_time,
      duration_minutes: parseInt(form.duration_minutes), mode: form.mode,
      marking_correct: parseInt(form.marking_correct), marking_wrong: parseInt(form.marking_wrong),
      sequence_order: tests.length + 1,
      tag: form.tag.trim() || 'General'
    }]).select().single()
    setSaving(false); setShowForm(false); setForm(empty)
    if (data) router.push(`/admin/test/${data.id}`)
  }

  const handleEditOpen = (test: Test) => {
    const dt = new Date(test.schedule_time)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    setForm({ title: test.title, schedule_time: local, duration_minutes: String(test.duration_minutes), mode: test.mode, marking_correct: String(test.marking_correct), marking_wrong: String(test.marking_wrong), tag: test.tag || 'General' })
    setEditingId(test.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUpdate = async () => {
    if (!form.title || !form.schedule_time || !form.duration_minutes) return
    setSaving(true)
    await supabase.from('tests').update({
      title: form.title, schedule_time: form.schedule_time,
      duration_minutes: parseInt(form.duration_minutes), mode: form.mode,
      marking_correct: parseInt(form.marking_correct), marking_wrong: parseInt(form.marking_wrong),
      tag: form.tag.trim() || 'General'
    }).eq('id', editingId)
    setSaving(false); setShowForm(false); setEditingId(null); setForm(empty)
    fetchTests()
  }

  const handleDelete = async (testId: string, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nThis will permanently delete all questions, attempts, and results for this test.`)) return
    setDeleting(testId)
    const { data: attempts } = await supabase.from('attempts').select('id').eq('test_id', testId)
    if (attempts && attempts.length > 0) {
      const ids = attempts.map((a: { id: string }) => a.id)
      await supabase.from('answers').delete().in('attempt_id', ids)
    }
    await supabase.from('attempts').delete().eq('test_id', testId)
    await supabase.from('questions').delete().eq('test_id', testId)
    await supabase.from('passages').delete().eq('test_id', testId)
    await supabase.from('tests').delete().eq('id', testId)
    setDeleting(null); fetchTests()
  }

  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm(empty) }
  const formatDt = (t: string) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // Tabs & search
  const allTags = ['All', ...Array.from(new Set(tests.map(t => t.tag || 'General').filter(Boolean)))]
  const filtered = tests
    .filter(t => activeTag === 'All' || (t.tag || 'General') === activeTag)
    .filter(t => search.length < 1 || t.title.toLowerCase().includes(search.toLowerCase()))

  // Tag color map
  const tagColor: Record<string, string> = {
    VARC: '#3b82f6', QA: '#10b981', DILR: '#8b5cf6',
    'Daily Editorials': '#f59e0b', General: '#64748b'
  }
  const getTagColor = (tag: string) => tagColor[tag] || '#1a56db'

  const existingTags = Array.from(new Set(tests.map(t => t.tag || 'General')))

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '13px' }}>IMS</span>
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Test Portal</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '99px' }}>Admin</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { setEditingId(null); setForm(empty); setShowForm(true) }} className="btn-primary">+ New Test</button>
          <button onClick={() => router.push('/admin/master-control')} className="btn-ghost">⚙️ Master Control</button>  {/* ADD THIS LINE */}
          <button onClick={() => { localStorage.removeItem('admin'); router.push('/admin') }} className="btn-ghost">Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>All Tests</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>{tests.length} test{tests.length !== 1 ? 's' : ''} · Newest first</p>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: '24px', borderTop: `3px solid ${editingId ? 'var(--warning)' : 'var(--primary)'}` }}>
            <h2 style={{ fontWeight: 700, fontSize: '17px', marginBottom: '20px' }}>
              {editingId ? '✎ Edit Test' : 'Create New Test'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label">Test Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. RC Practice Test 01" className="input" />
              </div>
              <div>
                <label className="label">Schedule Date & Time</label>
                <input type="datetime-local" value={form.schedule_time} onChange={e => setForm({ ...form, schedule_time: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} placeholder="40" className="input" />
              </div>
              <div>
                <label className="label">Mode</label>
                <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })} className="input">
                  <option value="timer">⏱ Timer (countdown)</option>
                  <option value="stopwatch">⏱ Stopwatch (count up)</option>
                </select>
              </div>
              <div>
                <label className="label">Marking (Correct / Wrong)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" value={form.marking_correct} onChange={e => setForm({ ...form, marking_correct: e.target.value })} placeholder="+3" className="input" />
                  <input type="number" value={form.marking_wrong} onChange={e => setForm({ ...form, marking_wrong: e.target.value })} placeholder="-1" className="input" />
                </div>
              </div>
              <div>
                <label className="label">Tag / Group</label>
                <input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} placeholder="e.g. VARC, QA, DILR..." className="input" />
                {existingTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {existingTags.map(tag => (
                      <button key={tag} type="button"
                        onClick={() => setForm({ ...form, tag })}
                        style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '99px', cursor: 'pointer', border: 'none',
                          background: form.tag === tag ? getTagColor(tag) : 'var(--bg-tertiary)',
                          color: form.tag === tag ? '#fff' : 'var(--text-muted)',
                          fontWeight: 600, transition: 'all 0.15s'
                        }}>{tag}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {editingId ? (
                <button onClick={handleUpdate} disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Saving...' : 'Save Changes ✓'}</button>
              ) : (
                <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Creating...' : 'Create & Add Questions →'}</button>
              )}
              <button onClick={handleCancelForm} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search tests..."
            className="input"
            style={{ width: '100%', fontSize: '14px' }}
          />
        </div>

        {/* Tag Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag)}
              style={{
                padding: '7px 18px', borderRadius: '99px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: activeTag === tag ? (tag === 'All' ? 'var(--primary)' : getTagColor(tag)) : 'var(--bg-tertiary)',
                color: activeTag === tag ? '#fff' : 'var(--text-muted)'
              }}>{tag === 'All' ? `All (${tests.length})` : `${tag} (${tests.filter(t => (t.tag || 'General') === tag).length})`}
            </button>
          ))}
        </div>

        {/* Test List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.length === 0 && !showForm && (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              {search.length >= 1 ? `No tests matching "${search}"` : 'No tests in this group yet.'}
            </div>
          )}
          {filtered.map((test, i) => {
            const tag = test.tag || 'General'
            return (
              <div key={test.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', opacity: deleting === test.id ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/admin/test/${test.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '99px', background: getTagColor(tag) + '20', color: getTagColor(tag), flexShrink: 0 }}>{tag}</span>
                    <span style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.title}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {formatDt(test.schedule_time)} · {test.duration_minutes} min · {test.mode} · +{test.marking_correct}/{test.marking_wrong}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); router.push(`/admin/results/${test.id}`) }}
                    style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    📊 Results
                  </button>
                  <button onClick={e => { e.stopPropagation(); router.push(`/admin/test/${test.id}`) }}
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    ✎ Questions
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleEditOpen(test) }}
                    style={{ background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    ✎ Edit
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(test.id, test.title) }}
                    disabled={deleting === test.id}
                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    {deleting === test.id ? '...' : '🗑 Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}