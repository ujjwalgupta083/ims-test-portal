'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Student = { id: string; name: string; center: string; batch: string }
type Attempt = { id: string; student_id: string; score: number; total_correct: number; total_wrong: number; total_unattempted: number; started_at: string; submitted_at: string; tab_switches: number; students: Student }
type Answer = { attempt_id: string; question_id: string; selected_option: string | null; is_correct: boolean | null; time_spent_seconds: number }
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
    const { data: att } = await supabase.from('attempts').select('*, students(id, name, center, batch)').eq('test_id', id).eq('is_completed', true)
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')
    const attemptIds = (att || []).map((a: Attempt) => a.id)
    let ans: Answer[] = []
    if (attemptIds.length > 0) {
      const { data: a } = await supabase.from('answers').select('*').in('attempt_id', attemptIds)
      ans = a || []
    }
    setTest(t); setAttempts(att || []); setQuestions(q || []); setAnswers(ans)
  }

  const centers = ['All', ...Array.from(new Set(attempts.map(a => a.students?.center).filter(Boolean)))]
  const batches = ['All', ...Array.from(new Set(attempts.map(a => a.students?.batch).filter(Boolean)))]
  const filtered = attempts.filter(a => (centerFilter === 'All' || a.students?.center === centerFilter) && (batchFilter === 'All' || a.students?.batch === batchFilter))
  const filteredIds = new Set(filtered.map(a => a.id))
  const filteredAnswers = answers.filter(a => filteredIds.has(a.attempt_id))
  const ranked = [...filtered].sort((a, b) => b.score - a.score).map((a, i) => ({ ...a, rank: i + 1 }))

  const maxScore = questions.length * (test?.marking_correct || 3)
  const totalAttempts = filtered.length
  const avgScore = totalAttempts ? Math.round(filtered.reduce((s, a) => s + a.score, 0) / totalAttempts) : 0
  const avgAccuracy = totalAttempts ? Math.round(filtered.reduce((s, a) => { const att = a.total_correct + a.total_wrong; return s + (att > 0 ? (a.total_correct / att) * 100 : 0) }, 0) / totalAttempts) : 0
  const avgTimeSecs = totalAttempts ? Math.round(filtered.reduce((s, a) => s + (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000, 0) / totalAttempts) : 0
  const fmtT = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const acc = (a: Attempt) => { const att = a.total_correct + a.total_wrong; return att > 0 ? Math.round((a.total_correct / att) * 100) : 0 }
  const totalT = (a: Attempt) => Math.floor((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)

  const qStats = questions.map(q => {
    const qAns = filteredAnswers.filter(a => a.question_id === q.id)
    const attempted = qAns.filter(a => a.selected_option !== null)
    const correct = qAns.filter(a => a.is_correct === true)
    const times = qAns.map(a => a.time_spent_seconds).filter(t => t > 0)
    const avgTime = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0
    const accuracy = attempted.length ? Math.round((correct.length / attempted.length) * 100) : 0
    return { ...q, attempted: attempted.length, correct: correct.length, avgTime, fastestTime: times.length ? Math.min(...times) : 0, accuracy, skipRate: totalAttempts ? Math.round(((totalAttempts - attempted.length) / totalAttempts) * 100) : 0 }
  })

  const kpiCards = [
    { v: totalAttempts,        l: 'Attempted',      c: 'var(--text)'    },
    { v: `${avgScore}/${maxScore}`, l: 'Avg Score', c: 'var(--primary)' },
    { v: `${avgAccuracy}%`,    l: 'Avg Accuracy',   c: 'var(--success)' },
    { v: fmtT(avgTimeSecs),    l: 'Avg Time',       c: '#7c3aed'        },
    { v: filtered.length ? Math.max(...filtered.map(a => a.score)) : 0, l: 'Top Score', c: '#f59e0b' },
    { v: filtered.length ? Math.min(...filtered.map(a => a.score)) : 0, l: 'Low Score',  c: 'var(--danger)' },
    { v: filtered.filter(a => a.score === maxScore).length, l: 'Full Marks', c: 'var(--success)' },
    { v: filtered.reduce((s, a) => s + (a.tab_switches || 0), 0), l: 'Total Tab Switches', c: 'var(--danger)' },
  ]

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ fontWeight: 700 }}>{test?.title} — Results</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{totalAttempts} student{totalAttempts !== 1 ? 's' : ''} attempted</p>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label className="label">Center</label>
            <select value={centerFilter} onChange={e => setCenterFilter(e.target.value)} className="input" style={{ width: '160px' }}>
              {centers.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Batch</label>
            <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="input" style={{ width: '160px' }}>
              {batches.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          {(centerFilter !== 'All' || batchFilter !== 'All') && (
            <button onClick={() => { setCenterFilter('All'); setBatchFilter('All') }} className="btn-ghost" style={{ fontSize: '13px' }}>✕ Clear</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>Showing {filtered.length} of {attempts.length} students</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['overview', 'students', 'questions'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '8px 20px', fontSize: '13px', textTransform: 'capitalize' }}>
              {tab === 'overview' ? '📊 Overview' : tab === 'students' ? '👥 Students' : '❓ Questions'}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
              {kpiCards.map(k => (
                <div key={k.l} className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: k.c }}>{k.v}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{k.l}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Score Distribution</h3>
              {ranked.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '120px', truncate: 'true', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.students?.name}</span>
                  <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '99px', height: '20px', position: 'relative' }}>
                    <div style={{ height: '20px', borderRadius: '99px', background: 'var(--primary)', width: `${maxScore > 0 ? (a.score / maxScore) * 100 : 0}%`, transition: 'width 0.5s' }} />
                    <span style={{ position: 'absolute', right: '8px', top: '0', fontSize: '11px', color: '#fff', lineHeight: '20px', fontWeight: 600 }}>{a.score}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '20px' }}>#{a.rank}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STUDENTS */}
        {activeTab === 'students' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  {['Rank', 'Student', 'Center', 'Batch', 'Score', '✓', '✗', 'Skip', 'Accuracy', 'Time', 'Tab Switches'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.length === 0 && <tr><td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No attempts yet</td></tr>}
                {ranked.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => router.push(`/admin/student/${a.students?.id}`)}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: a.rank === 1 ? '#f59e0b' : a.rank === 2 ? '#94a3b8' : a.rank === 3 ? '#f97316' : 'var(--text-muted)' }}>
                      {a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : `#${a.rank}`}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--primary)' }}>{a.students?.name}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{a.students?.center}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{a.students?.batch}</td>
                    <td style={{ padding: '12px 14px' }}><strong style={{ color: 'var(--primary)' }}>{a.score}</strong><span style={{ color: 'var(--text-muted)' }}>/{maxScore}</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--success)', fontWeight: 600 }}>{a.total_correct}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--danger)', fontWeight: 600 }}>{a.total_wrong}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{a.total_unattempted}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ fontWeight: 600, color: acc(a) >= 70 ? 'var(--success)' : acc(a) >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{acc(a)}%</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{fmtT(totalT(a))}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ color: (a.tab_switches || 0) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{a.tab_switches || 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* QUESTIONS */}
        {activeTab === 'questions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {qStats.map((q, i) => (
              <div key={q.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Q{i + 1} · <span style={{ color: q.difficulty === 'easy' ? 'var(--success)' : q.difficulty === 'hard' ? 'var(--danger)' : 'var(--warning)' }}>{q.difficulty}</span></p>
                    <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.5' }}>{q.question_text.length > 130 ? q.question_text.slice(0, 130) + '...' : q.question_text}</p>
                  </div>
                  <span style={{ background: q.accuracy >= 70 ? 'var(--success-light)' : q.accuracy >= 40 ? 'var(--warning-light)' : 'var(--danger-light)', color: q.accuracy >= 70 ? 'var(--success)' : q.accuracy >= 40 ? 'var(--warning)' : 'var(--danger)', fontWeight: 700, fontSize: '14px', padding: '6px 14px', borderRadius: '99px', flexShrink: 0 }}>
                    {q.accuracy}% accuracy
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px' }}>
                  {[
                    { v: `${q.attempted}/${q.totalStudents}`, l: 'Attempted',  c: 'var(--text)' },
                    { v: q.correct,                           l: 'Correct',    c: 'var(--success)' },
                    { v: fmtT(q.avgTime),                    l: 'Avg Time',   c: 'var(--primary)' },
                    { v: fmtT(q.fastestTime),                l: 'Fastest',    c: '#7c3aed' },
                    { v: `${q.skipRate}%`,                   l: 'Skip Rate',  c: 'var(--danger)' },
                  ].map(s => (
                    <div key={s.l} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, fontSize: '18px', color: s.c }}>{s.v}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{s.l}</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: '99px', height: '6px' }}>
                    <div style={{ height: '6px', borderRadius: '99px', background: q.accuracy >= 70 ? 'var(--success)' : q.accuracy >= 40 ? 'var(--warning)' : 'var(--danger)', width: `${q.accuracy}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}