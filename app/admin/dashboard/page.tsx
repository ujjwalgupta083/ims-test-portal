'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Test = { id: string; title: string; schedule_time: string; mode: string; sequence_order: number }

export default function AdminDashboard() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', schedule_time: '', duration_minutes: '',
    mode: 'timer', marking_correct: '3', marking_wrong: '-1'
  })
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
      title: form.title,
      schedule_time: form.schedule_time,
      duration_minutes: parseInt(form.duration_minutes),
      mode: form.mode,
      marking_correct: parseInt(form.marking_correct),
      marking_wrong: parseInt(form.marking_wrong),
      sequence_order: tests.length + 1
    }]).select().single()

    setSaving(false)
    setShowForm(false)
    setForm({ title: '', schedule_time: '', duration_minutes: '', mode: 'timer', marking_correct: '3', marking_wrong: '-1' })
    if (data) router.push(`/admin/test/${data.id}`)
  }

  return (
    <main className="min-h-screen bg-[#1a1a2e] p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Manage tests and questions</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-semibold">
              + New Test
            </button>
            <button onClick={() => { localStorage.removeItem('admin'); router.push('/admin') }}
              className="text-gray-400 border border-gray-600 px-4 py-2 rounded-lg text-sm">
              Logout
            </button>
          </div>
        </div>

        {/* Create Test Form */}
        {showForm && (
          <div className="bg-[#16213e] rounded-xl p-6 mb-6 border border-orange-500">
            <h2 className="text-white font-semibold text-lg mb-4">Create New Test</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-gray-400 text-sm mb-1 block">Test Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. RC Practice Test 01"
                  className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Schedule Date & Time</label>
                <input type="datetime-local" value={form.schedule_time}
                  onChange={e => setForm({ ...form, schedule_time: e.target.value })}
                  className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Duration (minutes)</label>
                <input type="number" value={form.duration_minutes}
                  onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                  placeholder="e.g. 40"
                  className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Mode</label>
                <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}
                  className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="timer">⏱ Timer (countdown)</option>
                  <option value="stopwatch">⏱ Stopwatch (count up)</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Marking: Correct / Wrong</label>
                <div className="flex gap-2">
                  <input type="number" value={form.marking_correct}
                    onChange={e => setForm({ ...form, marking_correct: e.target.value })}
                    placeholder="+3"
                    className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                  <input type="number" value={form.marking_wrong}
                    onChange={e => setForm({ ...form, marking_wrong: e.target.value })}
                    placeholder="-1"
                    className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50">
                {saving ? 'Creating...' : 'Create & Add Questions →'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="text-gray-400 border border-gray-600 px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Test List */}
        <div className="space-y-3">
          {tests.length === 0 && !showForm && (
            <div className="bg-[#16213e] rounded-xl p-8 text-center text-gray-500">
              No tests yet. Click "+ New Test" to create one.
            </div>
          )}
          {tests.map(test => (
            <div key={test.id}
              onClick={() => router.push(`/admin/test/${test.id}`)}
              className="bg-[#16213e] rounded-xl p-5 flex justify-between items-center cursor-pointer hover:bg-[#1a2a50]">
              <div>
                <h3 className="text-white font-semibold">{test.title}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {new Date(test.schedule_time).toLocaleString('en-IN')} · {test.mode}
                </p>
              </div>
              <span className="text-orange-400 text-sm">Manage Questions →</span>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}