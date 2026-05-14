'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = {
  id: string; question_text: string; option_a: string; option_b: string;
  option_c: string; option_d: string; correct_option: string; difficulty: string; sequence_order: number
}
type Test = { id: string; title: string; mode: string; duration_minutes: number; marking_correct: number; marking_wrong: number }

const empty = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', difficulty: 'medium' }

export default function TestQuestions() {
  const router = useRouter()
  const { id } = useParams()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: t } = await supabase.from('tests').select('*').eq('id', id).single()
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')
    setTest(t)
    setQuestions(q || [])
  }

  const handleSave = async () => {
    if (!form.question_text || !form.option_a || !form.option_b || !form.option_c || !form.option_d) return
    setSaving(true)
    await supabase.from('questions').insert([{
      ...form,
      test_id: id,
      sequence_order: questions.length + 1
    }])
    setSaving(false)
    setSaved(true)
    setForm(empty)
    setTimeout(() => setSaved(false), 2000)
    fetchData()
  }

  const handleDelete = async (qid: string) => {
    await supabase.from('questions').delete().eq('id', qid)
    fetchData()
  }

  const optionLabel: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' }

  return (
    <main className="min-h-screen bg-[#1a1a2e] p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button onClick={() => router.push('/admin/dashboard')} className="text-gray-400 text-sm mb-1 hover:text-white">← Back to Dashboard</button>
            <h1 className="text-2xl font-bold text-white">{test?.title}</h1>
            <p className="text-gray-400 text-sm">{test?.duration_minutes} min · {test?.mode} · +{test?.marking_correct}/{test?.marking_wrong}</p>
          </div>
          <div className="bg-[#16213e] px-4 py-2 rounded-lg text-center">
            <p className="text-2xl font-bold text-orange-400">{questions.length}</p>
            <p className="text-gray-400 text-xs">Questions</p>
          </div>
        </div>

        {/* Add Question Form */}
        <div className="bg-[#16213e] rounded-xl p-6 mb-6 border border-orange-500">
          <h2 className="text-white font-semibold mb-4">Add Question {questions.length + 1}</h2>

          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Question Text</label>
              <textarea
                value={form.question_text}
                onChange={e => setForm({ ...form, question_text: e.target.value })}
                placeholder="Enter your question here..."
                rows={3}
                className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {['a', 'b', 'c', 'd'].map(opt => (
                <div key={opt}>
                  <label className="text-gray-400 text-sm mb-1 block">Option {opt.toUpperCase()}</label>
                  <input
                    value={form[`option_${opt}` as keyof typeof form]}
                    onChange={e => setForm({ ...form, [`option_${opt}`]: e.target.value })}
                    placeholder={`Option ${opt.toUpperCase()}`}
                    className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Correct Answer</label>
                <select
                  value={form.correct_option}
                  onChange={e => setForm({ ...form, correct_option: e.target.value })}
                  className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="a">Option A</option>
                  <option value="b">Option B</option>
                  <option value="c">Option C</option>
                  <option value="d">Option D</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={e => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {saved ? '✅ Saved! Add Next Question' : saving ? 'Saving...' : 'Save & Add Next Question →'}
            </button>
          </div>
        </div>

        {/* Questions List */}
        {questions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-gray-400 text-sm uppercase tracking-wider">Added Questions</h2>
            {questions.map((q, i) => (
              <div key={q.id} className="bg-[#16213e] rounded-xl p-4 flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Q{i + 1}. {q.question_text}</p>
                  <div className="flex gap-4 mt-2">
                    {['a', 'b', 'c', 'd'].map(opt => (
                      <span key={opt}
                        className={`text-xs px-2 py-1 rounded ${q.correct_option === opt ? 'bg-green-500 text-white' : 'bg-[#0f3460] text-gray-300'}`}>
                        {opt.toUpperCase()}: {q[`option_${opt}` as keyof Question]}
                      </span>
                    ))}
                  </div>
                  <span className={`text-xs mt-2 inline-block px-2 py-0.5 rounded ${q.difficulty === 'easy' ? 'bg-green-900 text-green-300' : q.difficulty === 'hard' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {q.difficulty}
                  </span>
                </div>
                <button onClick={() => handleDelete(q.id)} className="text-red-400 hover:text-red-300 text-sm ml-4">Delete</button>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}