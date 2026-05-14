'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Student = { id: string; name: string; center: string; batch: string }
type Attempt = {
  id: string; student_id: string; score: number; total_correct: number;
  total_wrong: number; total_unattempted: number; started_at: string; submitted_at: string
  students: Student
}
type Answer = {
  attempt_id: string; question_id: string; selected_option: string | null;
  is_correct: boolean | null; time_spent_seconds: number
}
type Question = { id: string; question_text: string; correct_option: string; difficulty: string; sequence_order: number }
type Test = { id: string; title: string; marking_correct: number; marking_wrong: number; duration_minutes: number }

export default function AdminResults() {
  const router = useRouter()
  const { id } = useParams()

  const [test, setTest] = useState<Test | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [centerFilter, setCenterFilter] = useState('All')
  const [batchFilter, setBatchFilter] = useState('All')
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'questions'>('overview')

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const { data: t } = await supabase.from('tests').select('*').eq('id', id).single()
    const { data: att } = await supabase.from('attempts')
      .select('*, students(id, name, center, batch)')
      .eq('test_id', id).eq('is_completed', true)
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')

    const attemptIds = (att || []).map((a: Attempt) => a.id)
    let ans: Answer[] = []
    if (attemptIds.length > 0) {
      const { data: a } = await supabase.from('answers').select('*').in('attempt_id', attemptIds)
      ans = a || []
    }

    setTest(t)
    setAttempts(att || [])
    setQuestions(q || [])
    setAnswers(ans)
  }

  // Filter logic
  const centers = ['All', ...Array.from(new Set(attempts.map(a => a.students?.center).filter(Boolean)))]
  const batches = ['All', ...Array.from(new Set(attempts.map(a => a.students?.batch).filter(Boolean)))]

  const filtered = attempts.filter(a => {
    const cOk = centerFilter === 'All' || a.students?.center === centerFilter
    const bOk = batchFilter === 'All' || a.students?.batch === batchFilter
    return cOk && bOk
  })

  const filteredIds = new Set(filtered.map(a => a.id))
  const filteredAnswers = answers.filter(a => filteredIds.has(a.attempt_id))

  // Ranked students
  const ranked = [...filtered].sort((a, b) => b.score - a.score).map((a, i) => ({ ...a, rank: i + 1 }))

  // Overview KPIs
  const totalAttempts = filtered.length
  const avgScore = totalAttempts ? Math.round(filtered.reduce((s, a) => s + a.score, 0) / totalAttempts) : 0
  const avgAccuracy = totalAttempts ? Math.round(filtered.reduce((s, a) => {
    const attempted = a.total_correct + a.total_wrong
    return s + (attempted > 0 ? (a.total_correct / attempted) * 100 : 0)
  }, 0) / totalAttempts) : 0
  const maxScore = questions.length * (test?.marking_correct || 3)
  const avgTimeSecs = totalAttempts ? Math.round(filtered.reduce((s, a) => {
    return s + (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000
  }, 0) / totalAttempts) : 0
  const topScore = filtered.length ? Math.max(...filtered.map(a => a.score)) : 0
  const lowestScore = filtered.length ? Math.min(...filtered.map(a => a.score)) : 0
  const fullMarks = filtered.filter(a => a.score === maxScore).length
  const perfectAccuracy = filtered.filter(a => a.total_wrong === 0 && a.total_correct > 0).length

  // Question-wise analytics
  const qStats = questions.map(q => {
    const qAnswers = filteredAnswers.filter(a => a.question_id === q.id)
    const attempted = qAnswers.filter(a => a.selected_option !== null)
    const correct = qAnswers.filter(a => a.is_correct === true)
    const times = qAnswers.map(a => a.time_spent_seconds).filter(t => t > 0)
    const avgTime = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0
    const fastestTime = times.length ? Math.min(...times) : 0
    const slowestTime = times.length ? Math.max(...times) : 0
    const accuracy = attempted.length ? Math.round((correct.length / attempted.length) * 100) : 0
    const skipRate = totalAttempts ? Math.round(((totalAttempts - attempted.length) / totalAttempts) * 100) : 0

    return { ...q, attempted: attempted.length, correct: correct.length, avgTime, fastestTime, slowestTime, accuracy, skipRate, totalStudents: totalAttempts }
  })

  const formatTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const formatTotalTime = (a: Attempt) => {
    const s = Math.floor((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)
    return formatTime(s)
  }

  const tabs = ['overview', 'students', 'questions'] as const

  return (
    <main className="min-h-screen bg-[#1a1a2e] p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <button onClick={() => router.push('/admin/dashboard')} className="text-gray-400 text-sm hover:text-white mb-1 block">← Back</button>
            <h1 className="text-2xl font-bold text-white">{test?.title} — Results</h1>
            <p className="text-gray-400 text-sm">{totalAttempts} student{totalAttempts !== 1 ? 's' : ''} attempted</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#16213e] rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
          <p className="text-gray-400 text-sm font-medium">Filter by:</p>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Center</label>
            <select value={centerFilter} onChange={e => setCenterFilter(e.target.value)}
              className="bg-[#0f3460] text-white px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500">
              {centers.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Batch</label>
            <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
              className="bg-[#0f3460] text-white px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500">
              {batches.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          {(centerFilter !== 'All' || batchFilter !== 'All') && (
            <button onClick={() => { setCenterFilter('All'); setBatchFilter('All') }}
              className="text-orange-400 text-sm hover:text-orange-300 mt-4">✕ Clear filters</button>
          )}
          <p className="ml-auto text-gray-400 text-sm">Showing {filtered.length} of {attempts.length} students</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all
                ${activeTab === tab ? 'bg-orange-500 text-white' : 'bg-[#16213e] text-gray-400 hover:text-white'}`}>
              {tab === 'overview' ? '📊 Overview' : tab === 'students' ? '👥 Students' : '❓ Questions'}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Attempted', value: totalAttempts, color: 'text-white' },
                { label: 'Average Score', value: `${avgScore} / ${maxScore}`, color: 'text-orange-400' },
                { label: 'Average Accuracy', value: `${avgAccuracy}%`, color: 'text-blue-400' },
                { label: 'Avg Time Taken', value: formatTime(avgTimeSecs), color: 'text-purple-400' },
                { label: 'Highest Score', value: topScore, color: 'text-green-400' },
                { label: 'Lowest Score', value: lowestScore, color: 'text-red-400' },
                { label: 'Perfect Score', value: fullMarks, color: 'text-yellow-400' },
                { label: '100% Accuracy', value: perfectAccuracy, color: 'text-teal-400' },
              ].map(k => (
                <div key={k.label} className="bg-[#16213e] rounded-xl p-4 text-center">
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Score Distribution */}
            <div className="bg-[#16213e] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Score Distribution</h2>
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {ranked.map(a => {
                    const pct = maxScore > 0 ? Math.round((a.score / maxScore) * 100) : 0
                    return (
                      <div key={a.id} className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs w-24 truncate">{a.students?.name}</span>
                        <div className="flex-1 bg-[#0f3460] rounded-full h-5 relative">
                          <div className="h-5 rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                          <span className="absolute right-2 top-0 text-xs text-white leading-5">{a.score}</span>
                        </div>
                        <span className="text-gray-400 text-xs w-8">#{a.rank}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Accuracy Distribution */}
            <div className="bg-[#16213e] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Accuracy by Student</h2>
              <div className="space-y-2">
                {ranked.map(a => {
                  const attempted = a.total_correct + a.total_wrong
                  const acc = attempted > 0 ? Math.round((a.total_correct / attempted) * 100) : 0
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs w-24 truncate">{a.students?.name}</span>
                      <div className="flex-1 bg-[#0f3460] rounded-full h-5 relative">
                        <div className={`h-5 rounded-full transition-all ${acc >= 80 ? 'bg-green-500' : acc >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${acc}%` }} />
                        <span className="absolute right-2 top-0 text-xs text-white leading-5">{acc}%</span>
                      </div>
                      <span className="text-gray-400 text-xs w-20">{a.total_correct}C {a.total_wrong}W {a.total_unattempted}S</span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (
          <div className="bg-[#16213e] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Center</th>
                  <th className="px-4 py-3 text-left">Batch</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">Correct</th>
                  <th className="px-4 py-3 text-center">Wrong</th>
                  <th className="px-4 py-3 text-center">Skipped</th>
                  <th className="px-4 py-3 text-center">Accuracy</th>
                  <th className="px-4 py-3 text-center">Time</th>
                </tr>
              </thead>
              <tbody>
                {ranked.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No attempts yet</td></tr>
                )}
                {ranked.map((a, i) => {
                  const attempted = a.total_correct + a.total_wrong
                  const acc = attempted > 0 ? Math.round((a.total_correct / attempted) * 100) : 0
                  return (
                    <tr key={a.id} className={`border-b border-gray-800 hover:bg-[#1a2a50] ${i === 0 ? 'bg-yellow-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${a.rank === 1 ? 'text-yellow-400' : a.rank === 2 ? 'text-gray-300' : a.rank === 3 ? 'text-orange-400' : 'text-gray-500'}`}>
                          {a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : `#${a.rank}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{a.students?.name}</td>
                      <td className="px-4 py-3 text-gray-400">{a.students?.center}</td>
                      <td className="px-4 py-3 text-gray-400">{a.students?.batch}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-400 font-bold">{a.score}</span>
                        <span className="text-gray-600">/{maxScore}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-green-400">{a.total_correct}</td>
                      <td className="px-4 py-3 text-center text-red-400">{a.total_wrong}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{a.total_unattempted}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${acc >= 80 ? 'text-green-400' : acc >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{acc}%</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">{formatTotalTime(a)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── QUESTIONS TAB ── */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {qStats.map((q, i) => (
              <div key={q.id} className="bg-[#16213e] rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <p className="text-gray-400 text-xs mb-1">Q{i + 1} · <span className={`${q.difficulty === 'easy' ? 'text-green-400' : q.difficulty === 'hard' ? 'text-red-400' : 'text-yellow-400'}`}>{q.difficulty}</span></p>
                    <p className="text-white text-sm">{q.question_text.length > 120 ? q.question_text.slice(0, 120) + '...' : q.question_text}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold shrink-0 ${q.accuracy >= 70 ? 'bg-green-500/20 text-green-400' : q.accuracy >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                    {q.accuracy}% accuracy
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-[#0f3460] rounded-lg p-3 text-center">
                    <p className="text-white font-bold">{q.attempted}<span className="text-gray-500 text-xs">/{q.totalStudents}</span></p>
                    <p className="text-gray-400 text-xs mt-0.5">Attempted</p>
                  </div>
                  <div className="bg-[#0f3460] rounded-lg p-3 text-center">
                    <p className="text-green-400 font-bold">{q.correct}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Got Correct</p>
                  </div>
                  <div className="bg-[#0f3460] rounded-lg p-3 text-center">
                    <p className="text-orange-400 font-bold">{formatTime(q.avgTime)}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Avg Time</p>
                  </div>
                  <div className="bg-[#0f3460] rounded-lg p-3 text-center">
                    <p className="text-green-400 font-bold">{formatTime(q.fastestTime)}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Fastest</p>
                  </div>
                  <div className="bg-[#0f3460] rounded-lg p-3 text-center">
                    <p className="text-red-400 font-bold">{q.skipRate}%</p>
                    <p className="text-gray-400 text-xs mt-0.5">Skip Rate</p>
                  </div>
                </div>

                {/* Accuracy bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Accuracy among attempted</span>
                    <span>{q.correct} correct of {q.attempted} attempted</span>
                  </div>
                  <div className="bg-[#0f3460] rounded-full h-2">
                    <div className={`h-2 rounded-full ${q.accuracy >= 70 ? 'bg-green-500' : q.accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${q.accuracy}%` }} />
                  </div>
                </div>
              </div>
            ))}

            {qStats.length === 0 && (
              <div className="bg-[#16213e] rounded-xl p-8 text-center text-gray-500">No questions found</div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}