'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Test = { id: string; title: string; schedule_time: string; mode: string; sequence_order: number; duration_minutes: number }

const empty = { title: '', schedule_time: '', duration_minutes: '', mode: 'timer', marking_correct: '3', marking_wrong: '-1' }

export default function AdminDashboard() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchTests()
  }, [])

  const fetchTests = async () => {
    const { data } = await supabase.from('tests').select('*').order('sequence_order', { ascending: true })
    setTests(data || [])
  }

  const handleCreate = async () => {
    if (!form.title || !form.schedule_time || !form.duration_minutes) return
    setSaving(true)
    const { data } = await supabase.from('tests').insert([{
      title: form.title, schedule_time: form.schedule_time,
      duration_minutes: parseInt(form.duration_minutes), mode: form.mode,
      marking_correct: parseInt(form.marking_correct), marking_wrong: parseInt(form.marking_wrong),
      sequence_order: tests.length + 1
    }]).select().single()
    setSaving(false); setShowForm(false); setForm(empty)
    if (data) router.push(`/admin/test/${data.id}`)
  }

  const formatDt = (t: string) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>

      {/* Nav */}
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
          <button onClick={() => setShowForm(true)} className="btn-primary">+ New Test</button>
          <button onClick={() => { localStorage.removeItem('admin'); router.push('/admin') }} className="btn-ghost">Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>All Tests</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>{tests.length} test{tests.length !== 1 ? 's' : ''} created</p>

        {/* Create Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid var(--primary)' }}>
            <h2 style={{ fontWeight: 700, fontSize: '17px', marginBottom: '20px' }}>Create New Test</h2>
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
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>
                {saving ? 'Creating...' : 'Create & Add Questions →'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {/* Test List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tests.length === 0 && !showForm && (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              No tests yet. Click "+ New Test" to create one.
            </div>
          )}
          {tests.map((test, i) => (
            <div key={test.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
              onClick={() => router.push(`/admin/test/${test.id}`)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '99px', flexShrink: 0 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.title}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {formatDt(test.schedule_time)} · {test.duration_minutes} min · {test.mode}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); router.push(`/admin/results/${test.id}`) }}
                  style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  📊 Results
                </button>
                <button style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  ✎ Questions →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}