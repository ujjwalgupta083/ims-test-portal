'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

type AnswerWithQ = {
  id: string
  question_id: string
  selected_option: string | null
  is_correct: boolean | null
  time_spent_seconds: number
  is_marked_for_review: boolean
  questions: {
    question_text: string
    option_a: string; option_b: string; option_c: string; option_d: string
    correct_option: string
    difficulty: string
    passage_id: string | null
    sequence_order: number
  }
}
type Attempt = { score: number; total_correct: number; total_wrong: number; total_unattempted: number; started_at: string; submitted_at: string }
type Passage = { id: string; passage_text: string; title: string | null }

export default function ResultPage() {
  const router = useRouter()
  const { id } = useParams()
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attempt')
  const fromAdmin = searchParams.get('from') === 'admin'
  const adminSid = searchParams.get('sid')

  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<AnswerWithQ[]>([])
  const [passages, setPassages] = useState<Record<string, Passage>>({})
  const [testTitle, setTestTitle] = useState('')
  const [reviewMode, setReviewMode] = useState(false)
  const [currentReview, setCurrentReview] = useState(0)
  const [markingCorrect, setMarkingCorrect] = useState(3)

  useEffect(() => { if (attemptId) fetchResult() }, [attemptId])

  const fetchResult = async () => {
    const { data: a } = await supabase.from('attempts').select('*').eq('id', attemptId).single()
    const { data: ans } = await supabase
      .from('answers')
      .select('*, questions(question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, passage_id, sequence_order)')
      .eq('attempt_id', attemptId)
    const { data: t } = await supabase.from('tests').select('title, marking_correct').eq('id', id).single()
    const { data: p } = await supabase.from('passages').select('*').eq('test_id', id)

    setAttempt(a)
    const sorted = (ans || []).sort((x: AnswerWithQ, y: AnswerWithQ) =>
      (x.questions?.sequence_order || 0) - (y.questions?.sequence_order || 0))
    setAnswers(sorted)
    setTestTitle(t?.title || '')
    setMarkingCorrect(t?.marking_correct || 3)
    const pm: Record<string, Passage> = {}
    ;(p || []).forEach((pass: Passage) => { pm[pass.id] = pass })
    setPassages(pm)
  }

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const totalTime = attempt ? Math.floor((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000) : 0
  const maxScore = answers.length * markingCorrect
  const accuracy = attempt && (attempt.total_correct + attempt.total_wrong) > 0
    ? Math.round((attempt.total_correct / (attempt.total_correct + attempt.total_wrong)) * 100) : 0

  if (!attempt) return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading result...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )

  // ── REVIEW MODE ──
  if (reviewMode && answers[currentReview]) {
    const ans = answers[currentReview]
    const q = ans.questions
    const currentPassage = q.passage_id ? passages[q.passage_id] : null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-secondary)' }}>

        {/* Header */}
        <header style={{ background: 'var(--primary)', color: '#fff', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '4px 10px', fontWeight: 800, fontSize: '14px' }}>IMS</div>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>{testTitle} — Review</span>
          </div>
          <button onClick={() => setReviewMode(false)}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '6px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            ← Back to Summary
          </button>
        </header>

        {/* Info bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '6px 20px', display: 'flex', gap: '20px', fontSize: '12px', flexShrink: 0 }}>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ {attempt.total_correct} Correct</span>
          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗ {attempt.total_wrong} Wrong</span>
          <span style={{ color: 'var(--text-muted)' }}>⬜ {attempt.total_unattempted} Skipped</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Score: {attempt.score}/{maxScore}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>Q {currentReview + 1} / {answers.length}</span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Question area */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', gap: '16px' }}>

            {/* Passage */}
            {currentPassage && (
              <div style={{ flex: 1, background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', overflow: 'auto', boxShadow: 'var(--shadow-sm)' }}>
                {currentPassage.title && <p style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--primary)', fontSize: '14px' }}>{currentPassage.title}</p>}
                <p style={{ fontSize: '14px', lineHeight: '1.9', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{currentPassage.passage_text}</p>
              </div>
            )}

            {/* Question + Options */}
            <div style={{ flex: currentPassage ? '0 0 45%' : 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>Q{currentReview + 1}</span>
                    {ans.is_marked_for_review && (
                      <span style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 600 }}>⚑ Marked for Review</span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '15px', lineHeight: '1.8', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{q.question_text}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(['a', 'b', 'c', 'd'] as const).map((opt, idx) => {
                  const isCorrect = q.correct_option === opt
                  const isSelected = ans.selected_option === opt
                  const isWrong = isSelected && !isCorrect
                  return (
                    <div key={opt} style={{
                      background: isCorrect ? 'var(--success-light)' : isWrong ? 'var(--danger-light)' : '#fff',
                      border: `2px solid ${isCorrect ? 'var(--success)' : isWrong ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px'
                    }}>
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: isCorrect ? 'var(--success)' : isWrong ? 'var(--danger)' : 'var(--bg-secondary)',
                        border: `2px solid ${isCorrect ? 'var(--success)' : isWrong ? 'var(--danger)' : 'var(--border-strong)'}`,
                        color: (isCorrect || isWrong) ? '#fff' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px'
                      }}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <p style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '2px', color: 'var(--text)', flex: 1 }}>
                        {q[`option_${opt}` as keyof typeof q] as string}
                      </p>
                      {isCorrect && <span>✅</span>}
                      {isWrong && <span>❌</span>}
                    </div>
                  )
                })}
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                ⏱ Time spent: <strong>{fmt(ans.time_spent_seconds)}</strong>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setCurrentReview(Math.max(0, currentReview - 1))} disabled={currentReview === 0}
                  className="btn-ghost" style={{ flex: 1, padding: '10px', fontSize: '13px' }}>← Prev</button>
                <button onClick={() => setCurrentReview(Math.min(answers.length - 1, currentReview + 1))} disabled={currentReview === answers.length - 1}
                  className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '13px' }}>Next →</button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width: '240px', background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

            {/* Score */}
            <div style={{ padding: '16px', background: 'var(--primary)', color: '#fff', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '11px', opacity: 0.8, marginBottom: '2px' }}>Final Score</p>
              <p style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>{attempt.score}</p>
              <p style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>out of {maxScore} · {accuracy}% accuracy</p>
            </div>

            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around' }}>
              {[
                { v: attempt.total_correct,     l: 'Correct', c: 'var(--success)' },
                { v: attempt.total_wrong,       l: 'Wrong',   c: 'var(--danger)'  },
                { v: attempt.total_unattempted, l: 'Skipped', c: 'var(--text-muted)' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 700, fontSize: '18px', color: s.c }}>{s.v}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.l}</p>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Legend</p>
              {[
                { bg: 'var(--success)', label: 'Correct' },
                { bg: 'var(--danger)',  label: 'Wrong' },
                { bg: '#999999',        label: 'Skipped' },
                { bg: '#7c3aed',        label: 'Marked for Review', border: true },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: l.bg, flexShrink: 0, border: l.border ? '2px solid #4c1d95' : 'none' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Palette */}
            <div style={{ padding: '10px 14px', flex: 1, overflow: 'auto' }}>
              <p style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Questions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                {answers.map((a, i) => {
                  const bg = a.is_correct === true ? 'var(--success)' : a.selected_option ? 'var(--danger)' : '#999999'
                  const border = i === currentReview
                    ? '3px solid #1e3a8a'
                    : a.is_marked_for_review ? '3px solid #7c3aed' : 'none'
                  return (
                    <button key={a.question_id} onClick={() => setCurrentReview(i)}
                      style={{ width: '34px', height: '34px', borderRadius: '50%', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: bg, color: '#fff', border, transition: 'all 0.1s' }}>
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => router.push(fromAdmin && adminSid ? `/admin/student/${adminSid}` : '/dashboard')}
                style={{ width: '100%', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── SUMMARY MODE ──
  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '12px' }}>IMS</span>
          </div>
          <span style={{ fontWeight: 700 }}>Test Portal</span>
        </div>
        <button onClick={() => router.push(fromAdmin && adminSid ? `/admin/student/${adminSid}` : '/dashboard')} className="btn-ghost" style={{ fontSize: '13px' }}>← Back to Dashboard</button>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>{testTitle}</p>
          <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '4px' }}>Test Submitted ✅</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total time: {fmt(totalTime)}</p>
        </div>

        <div style={{ background: 'var(--primary)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', marginBottom: '20px', color: '#fff' }}>
          <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '8px' }}>Your Score</p>
          <p style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1 }}>{attempt.score}</p>
          <p style={{ fontSize: '16px', opacity: 0.8, marginTop: '8px' }}>out of {maxScore} marks</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { v: attempt.total_correct,     l: 'Correct',  c: 'var(--success)' },
            { v: attempt.total_wrong,       l: 'Wrong',    c: 'var(--danger)'  },
            { v: attempt.total_unattempted, l: 'Skipped',  c: 'var(--text-muted)' },
            { v: `${accuracy}%`,            l: 'Accuracy', c: 'var(--primary)' },
          ].map(s => (
            <div key={s.l} className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
              <p style={{ fontSize: '28px', fontWeight: 700, color: s.c }}>{s.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.l}</p>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>⏱ Time Spent Per Question</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {answers.map((a, i) => {
              const max = Math.max(...answers.map(x => x.time_spent_seconds), 1)
              const pct = Math.round((a.time_spent_seconds / max) * 100)
              return (
                <div key={a.question_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '24px', flexShrink: 0 }}>Q{i + 1}</span>
                  <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '99px', height: '8px' }}>
                    <div style={{ height: '8px', borderRadius: '99px', width: `${pct}%`, background: a.is_correct ? 'var(--success)' : a.selected_option ? 'var(--danger)' : 'var(--border-strong)' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '36px', textAlign: 'right' }}>{fmt(a.time_spent_seconds)}</span>
                  <span>{a.is_correct ? '✅' : a.selected_option ? '❌' : '⬜'}</span>
                </div>
              )
            })}
          </div>
        </div>

        <button onClick={() => { setCurrentReview(0); setReviewMode(true) }}
          className="btn-outline" style={{ width: '100%', padding: '13px', marginBottom: '12px', fontSize: '15px' }}>
          🔍 Review All Questions (Exam Style)
        </button>

        <button onClick={() => router.push(fromAdmin && adminSid ? `/admin/student/${adminSid}` : '/dashboard')} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
          Back to Dashboard →
        </button>
      </div>
    </main>
  )
}