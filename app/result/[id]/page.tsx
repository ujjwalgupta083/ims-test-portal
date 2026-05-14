'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

type Answer = {
  id: string; question_id: string; selected_option: string | null;
  is_correct: boolean | null; time_spent_seconds: number;
  questions: { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string }
}
type Attempt = { score: number; total_correct: number; total_wrong: number; total_unattempted: number; started_at: string; submitted_at: string }

export default function ResultPage() {
  const router = useRouter()
  const { id } = useParams()
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attempt')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [testTitle, setTestTitle] = useState('')
  const [showReview, setShowReview] = useState(false)

  useEffect(() => { if (attemptId) fetchResult() }, [attemptId])

  const fetchResult = async () => {
    const { data: a } = await supabase.from('attempts').select('*').eq('id', attemptId).single()
    const { data: ans } = await supabase.from('answers').select('*, questions(question_text, option_a, option_b, option_c, option_d, correct_option)').eq('attempt_id', attemptId)
    const { data: t } = await supabase.from('tests').select('title').eq('id', id).single()
    setAttempt(a); setAnswers(ans || []); setTestTitle(t?.title || '')
  }

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const totalTime = attempt ? Math.floor((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000) : 0
  const maxScore = answers.length * 3
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

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '12px' }}>IMS</span>
          </div>
          <span style={{ fontWeight: 700 }}>Test Portal</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="btn-ghost" style={{ fontSize: '13px' }}>← Back to Dashboard</button>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>{testTitle}</p>
          <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '4px' }}>Test Submitted ✅</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total time: {fmt(totalTime)}</p>
        </div>

        {/* Score Card */}
        <div style={{ background: 'var(--primary)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', marginBottom: '20px', color: '#fff' }}>
          <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '8px' }}>Your Score</p>
          <p style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1 }}>{attempt.score}</p>
          <p style={{ fontSize: '16px', opacity: 0.8, marginTop: '8px' }}>out of {maxScore} marks</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { v: attempt.total_correct,    l: 'Correct',   c: 'var(--success)' },
            { v: attempt.total_wrong,      l: 'Wrong',     c: 'var(--danger)'  },
            { v: attempt.total_unattempted,l: 'Skipped',   c: 'var(--text-muted)' },
            { v: `${accuracy}%`,           l: 'Accuracy',  c: 'var(--primary)' },
          ].map(s => (
            <div key={s.l} className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
              <p style={{ fontSize: '28px', fontWeight: 700, color: s.c }}>{s.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Time Per Question */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>⏱ Time Spent Per Question</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {answers.map((a, i) => {
              const max = Math.max(...answers.map(x => x.time_spent_seconds), 1)
              const pct = Math.round((a.time_spent_seconds / max) * 100)
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '24px', flexShrink: 0 }}>Q{i + 1}</span>
                  <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '99px', height: '8px' }}>
                    <div style={{ height: '8px', borderRadius: '99px', width: `${pct}%`, background: a.is_correct ? 'var(--success)' : a.selected_option ? 'var(--danger)' : 'var(--border-strong)' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '36px', textAlign: 'right' }}>{fmt(a.time_spent_seconds)}</span>
                  <span style={{ fontSize: '14px' }}>{a.is_correct ? '✅' : a.selected_option ? '❌' : '⬜'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Review Toggle */}
        <button onClick={() => setShowReview(!showReview)}
          className="btn-outline" style={{ width: '100%', padding: '13px', marginBottom: '16px' }}>
          {showReview ? '▲ Hide' : '▼ Show'} Question-wise Review
        </button>

        {showReview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {answers.map((a, i) => (
              <div key={a.id} className="card" style={{ borderLeft: `4px solid ${a.is_correct ? 'var(--success)' : a.selected_option ? 'var(--danger)' : 'var(--border-strong)'}`, padding: '20px' }}>
                <p style={{ fontWeight: 600, marginBottom: '14px', lineHeight: '1.6' }}>Q{i + 1}. {a.questions?.question_text}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['a', 'b', 'c', 'd'].map(opt => {
                    const isCorrect = a.questions?.correct_option === opt
                    const isSelected = a.selected_option === opt
                    return (
                      <div key={opt} style={{
                        padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                        background: isCorrect ? 'var(--success-light)' : isSelected && !isCorrect ? 'var(--danger-light)' : 'var(--bg-secondary)',
                        border: `1.5px solid ${isCorrect ? 'var(--success)' : isSelected && !isCorrect ? 'var(--danger)' : 'var(--border)'}`,
                        color: isCorrect ? 'var(--success)' : isSelected && !isCorrect ? 'var(--danger)' : 'var(--text-secondary)'
                      }}>
                        <strong>{opt.toUpperCase()}.</strong>
                        <span style={{ flex: 1 }}>{a.questions?.[`option_${opt}` as keyof typeof a.questions]}</span>
                        {isCorrect && <span>✅</span>}
                        {isSelected && !isCorrect && <span>❌</span>}
                      </div>
                    )
                  })}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '10px' }}>Time: {fmt(a.time_spent_seconds)}</p>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
          Back to Dashboard →
        </button>
      </div>
    </main>
  )
}