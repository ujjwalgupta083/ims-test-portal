'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; difficulty: string; sequence_order: number }
type Test = { id: string; title: string; duration_minutes: number; mode: string; marking_correct: number; marking_wrong: number }
type Student = { id: string; name: string; center: string; batch: string }

export default function ExamPage() {
  const router = useRouter()
  const { id } = useParams()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const questionStartTime = useRef<number>(Date.now())
  const timeSpent = useRef<Record<string, number>>({})

  useEffect(() => {
    const s = localStorage.getItem('student')
    if (!s) { router.push('/login'); return }
    setStudent(JSON.parse(s)); fetchExam()
  }, [])

  const fetchExam = async () => {
    const { data: t } = await supabase.from('tests').select('*').eq('id', id).single()
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')
    setTest(t); setQuestions(q || [])
    if (t) setTimeLeft(t.duration_minutes * 60)
  }

  const startExam = async () => {
    if (!student || !test) return
    const { data } = await supabase.from('attempts').insert([{ student_id: student.id, test_id: id, started_at: new Date().toISOString() }]).select().single()
    setAttemptId(data.id); setStarted(true)
    questionStartTime.current = Date.now()
    if (questions[0]) setVisited(new Set([questions[0].id]))
  }

  useEffect(() => {
    if (!started || submitted) return
    const interval = setInterval(() => {
      if (test?.mode === 'timer') {
        setTimeLeft(t => { if (t <= 1) { handleSubmit(); return 0 } return t - 1 })
      } else setElapsed(e => e + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [started, submitted])

  const recordTime = (qid: string) => {
    const spent = Math.floor((Date.now() - questionStartTime.current) / 1000)
    timeSpent.current[qid] = (timeSpent.current[qid] || 0) + spent
    questionStartTime.current = Date.now()
  }

  const goTo = (index: number) => {
    if (questions[current]) recordTime(questions[current].id)
    setCurrent(index)
    setVisited(prev => new Set([...prev, questions[index].id]))
  }

  const selectAnswer = (qid: string, opt: string) => setAnswers(prev => ({ ...prev, [qid]: opt }))
  const toggleMark = (qid: string) => setMarked(prev => { const n = new Set(prev); n.has(qid) ? n.delete(qid) : n.add(qid); return n })

  const handleSubmit = async () => {
    if (submitted) return
    if (questions[current]) recordTime(questions[current].id)
    setSubmitted(true)
    let score = 0, correct = 0, wrong = 0, unattempted = 0
    const rows = questions.map(q => {
      const sel = answers[q.id] || null
      const ok = sel === q.correct_option
      if (!sel) unattempted++; else if (ok) { correct++; score += test?.marking_correct || 3 } else { wrong++; score += test?.marking_wrong || -1 }
      return { attempt_id: attemptId, question_id: q.id, selected_option: sel, is_correct: sel ? ok : null, time_spent_seconds: timeSpent.current[q.id] || 0, is_marked_for_review: marked.has(q.id) }
    })
    await supabase.from('answers').insert(rows)
    await supabase.from('attempts').update({ submitted_at: new Date().toISOString(), score, total_correct: correct, total_wrong: wrong, total_unattempted: unattempted, is_completed: true }).eq('id', attemptId)
    router.push(`/result/${id}?attempt=${attemptId}`)
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const getPaletteClass = (q: Question) => {
    const hasAnswer = !!answers[q.id]
    const isMarked = marked.has(q.id)
    const isVisited = visited.has(q.id)
    if (hasAnswer && isMarked) return 'nta-answered-marked'
    if (hasAnswer) return 'nta-answered'
    if (isMarked) return 'nta-marked'
    if (isVisited) return 'nta-not-answered'
    return 'nta-not-visited'
  }

  const q = questions[current]

  // Pre-exam screen
  if (!started) return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', background: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>IMS</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>{test?.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Read instructions carefully before starting</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
          {[{ v: questions.length, l: 'Questions' }, { v: `${test?.duration_minutes}`, l: 'Minutes' }, { v: `+${test?.marking_correct}/${test?.marking_wrong}`, l: 'Marking' }].map(k => (
            <div key={k.l} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 700, fontSize: '20px', color: 'var(--primary)' }}>{k.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{k.l}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '16px', marginBottom: '24px', textAlign: 'left', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Question Status Legend</p>
          {[
            { cls: 'nta-not-visited',     label: 'Not Visited' },
            { cls: 'nta-not-answered',    label: 'Visited, Not Answered' },
            { cls: 'nta-answered',        label: 'Answered' },
            { cls: 'nta-marked',          label: 'Marked for Review' },
            { cls: 'nta-answered-marked', label: 'Answered + Marked for Review' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className={l.cls} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>1</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{l.label}</span>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>Once started, the timer cannot be paused. All answers are auto-saved.</p>
        <button onClick={startExam} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>▶ Begin Test</button>
      </div>
    </main>
  )

  if (!q) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-secondary)' }}>

      {/* ── TOP BAR ── */}
      <header style={{ background: 'var(--primary)', color: '#fff', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '4px 8px', fontWeight: 800, fontSize: '14px' }}>IMS</div>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{test?.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '11px', opacity: 0.8 }}>{test?.mode === 'timer' ? 'Time Remaining' : 'Time Elapsed'}</p>
            <p style={{ fontWeight: 700, fontSize: '20px', fontFamily: 'monospace', color: test?.mode === 'timer' && timeLeft < 300 ? '#fca5a5' : '#fff' }}>
              {test?.mode === 'timer' ? formatTime(timeLeft) : formatTime(elapsed)}
            </p>
          </div>
          <div style={{ fontSize: '13px', opacity: 0.9, textAlign: 'right' }}>
            <p style={{ fontWeight: 600 }}>{student?.name}</p>
            <p style={{ opacity: 0.75 }}>{student?.batch}</p>
          </div>
        </div>
      </header>

      {/* ── MARKING SCHEME BAR ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '6px 20px', display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span>Marks for correct: <strong style={{ color: 'var(--success)' }}>+{test?.marking_correct}</strong></span>
        <span>Marks for wrong: <strong style={{ color: 'var(--danger)' }}>{test?.marking_wrong}</strong></span>
        <span>Total Questions: <strong>{questions.length}</strong></span>
        <span style={{ marginLeft: 'auto' }}>Question {current + 1} of {questions.length}</span>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: QUESTION AREA ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: '740px' }}>

            {/* Question Box */}
            <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px', marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>Q{current + 1}</span>
                <span className={q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'hard' ? 'badge-red' : 'badge-yellow'}>{q.difficulty}</span>
              </div>
              <p style={{ fontSize: '15px', lineHeight: '1.8', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{q.question_text}</p>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {(['a', 'b', 'c', 'd'] as const).map((opt, idx) => {
                const selected = answers[q.id] === opt
                return (
                  <div key={opt} onClick={() => selectAnswer(q.id, opt)}
                    style={{
                      background: selected ? 'var(--primary-light)' : '#fff',
                      border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: '14px',
                      transition: 'all 0.12s',
                    }}>
                    <span style={{
                      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                      background: selected ? 'var(--primary)' : 'var(--bg-secondary)',
                      border: `2px solid ${selected ? 'var(--primary)' : 'var(--border-strong)'}`,
                      color: selected ? '#fff' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '13px'
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <p style={{ fontSize: '15px', lineHeight: '1.6', marginTop: '2px', color: 'var(--text)' }}>
                      {q[`option_${opt}` as keyof Question]}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Nav Buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={() => { setAnswers(p => { const n = {...p}; delete n[q.id]; return n }) }} className="btn-ghost" style={{ fontSize: '13px' }}>
                ✕ Clear Response
              </button>
              <button onClick={() => { toggleMark(q.id); if (current < questions.length - 1) goTo(current + 1) }}
                style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '10px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                ⚑ Mark for Review & Next
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {current > 0 && <button onClick={() => goTo(current - 1)} className="btn-ghost" style={{ fontSize: '13px' }}>← Back</button>}
                {current < questions.length - 1
                  ? <button onClick={() => goTo(current + 1)} className="btn-primary" style={{ fontSize: '13px' }}>Save & Next →</button>
                  : <button onClick={() => { if (confirm('Submit the test? You cannot make changes after this.')) handleSubmit() }}
                      style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '10px 20px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                      Submit Test ✓
                    </button>
                }
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT: QUESTION PALETTE ── */}
        <div style={{ width: '260px', background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

          {/* Student info */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <p style={{ fontWeight: 600, fontSize: '14px' }}>{student?.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{student?.center}</p>
          </div>

          {/* Legend */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontWeight: 600, fontSize: '12px', marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Legend</p>
            {[
              { cls: 'nta-answered',        label: `Answered (${Object.keys(answers).length})` },
              { cls: 'nta-not-answered',    label: `Not Answered (${[...visited].filter(v => !answers[v]).length})` },
              { cls: 'nta-marked',          label: `Marked (${[...marked].filter(v => !answers[v]).length})` },
              { cls: 'nta-answered-marked', label: `Ans+Marked (${[...marked].filter(v => answers[v]).length})` },
              { cls: 'nta-not-visited',     label: `Not Visited (${questions.length - visited.size})` },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                <span className={l.cls} style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>1</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Question Grid */}
          <div style={{ padding: '14px 16px', flex: 1, overflow: 'auto' }}>
            <p style={{ fontWeight: 600, fontSize: '12px', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Questions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => goTo(i)}
                  className={getPaletteClass(q)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', border: i === current ? '3px solid var(--primary-dark)' : 'none',
                    outline: i === current ? '2px solid var(--primary)' : 'none',
                    transition: 'all 0.1s'
                  }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { if (confirm('Submit the test? You cannot make changes after this.')) handleSubmit() }}
              style={{ width: '100%', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
              Submit Test ✓
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}