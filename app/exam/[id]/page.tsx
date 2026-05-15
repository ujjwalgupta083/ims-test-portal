'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; difficulty: string; sequence_order: number; passage_id: string | null }
type Passage = { id: string; passage_text: string; title: string | null }
type Test = { id: string; title: string; duration_minutes: number; mode: string; marking_correct: number; marking_wrong: number }
type Student = { id: string; name: string; center: string; batch: string }

export default function ExamPage() {
  const router = useRouter()
  const { id } = useParams()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [passages, setPassages] = useState<Record<string, Passage>>({})
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
  const [tabSwitches, setTabSwitches] = useState(0)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const questionStartTime = useRef<number>(Date.now())
  const timeSpent = useRef<Record<string, number>>({})
  const tabSwitchRef = useRef(0)
  
  useEffect(() => {
  const onFSChange = () => setIsFullscreen(!!document.fullscreenElement)
  document.addEventListener('fullscreenchange', onFSChange)
  return () => document.removeEventListener('fullscreenchange', onFSChange)
}, [])

  useEffect(() => {
    const s = localStorage.getItem('student')
    if (!s) { router.push('/login'); return }
    setStudent(JSON.parse(s)); fetchExam()
  }, [])

  const fetchExam = async () => {
    const { data: t } = await supabase.from('tests').select('*').eq('id', id).single()
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')
    const { data: p } = await supabase.from('passages').select('*').eq('test_id', id)
    setTest(t); setQuestions(q || [])
    const passageMap: Record<string, Passage> = {}
    ;(p || []).forEach((pass: Passage) => { passageMap[pass.id] = pass })
    setPassages(passageMap)
    if (t) setTimeLeft(t.duration_minutes * 60)
  }

  // Anti-cheat: tab switch detection
  useEffect(() => {
    if (!started || submitted) return
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1
        setTabSwitches(tabSwitchRef.current)
        setShowTabWarning(true)
        setTimeout(() => setShowTabWarning(false), 3000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [started, submitted])

  const startExam = async () => {
    if (!student || !test) return
    // Request fullscreen
    try { await document.documentElement.requestFullscreen() } catch {}
    const { data } = await supabase.from('attempts').insert([{
      student_id: student.id, test_id: id, started_at: new Date().toISOString(), tab_switches: 0
    }]).select().single()
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

  const handleSubmit = useCallback(async () => {
    if (submitted) return
    if (questions[current]) recordTime(questions[current].id)
    setSubmitted(true)
    try { document.exitFullscreen() } catch {}

    let score = 0, correct = 0, wrong = 0, unattempted = 0
    const rows = questions.map(q => {
      const sel = answers[q.id] || null
      const ok = sel === q.correct_option
      if (!sel) unattempted++; else if (ok) { correct++; score += test?.marking_correct || 3 } else { wrong++; score += test?.marking_wrong || -1 }
      return { attempt_id: attemptId, question_id: q.id, selected_option: sel, is_correct: sel ? ok : null, time_spent_seconds: timeSpent.current[q.id] || 0, is_marked_for_review: marked.has(q.id) }
    })
    await supabase.from('answers').insert(rows)
    await supabase.from('attempts').update({ submitted_at: new Date().toISOString(), score, total_correct: correct, total_wrong: wrong, total_unattempted: unattempted, is_completed: true, tab_switches: tabSwitchRef.current }).eq('id', attemptId)
    router.push(`/result/${id}?attempt=${attemptId}`)
  }, [submitted, questions, current, answers, marked, attemptId, test, id])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const getPaletteClass = (q: Question) => {
    const hasAns = !!answers[q.id], isMrk = marked.has(q.id), isVis = visited.has(q.id)
    if (hasAns && isMrk) return 'nta-answered-marked'
    if (hasAns) return 'nta-answered'
    if (isMrk) return 'nta-marked'
    if (isVis) return 'nta-not-answered'
    return 'nta-not-visited'
  }

  const q = questions[current]
  const currentPassage = q?.passage_id ? passages[q.passage_id] : null

  // Pre-exam screen
  if (!started) return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', background: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>IMS</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>{test?.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Read all instructions before starting</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
          {[{ v: questions.length, l: 'Questions' }, { v: `${test?.duration_minutes}`, l: 'Minutes' }, { v: `+${test?.marking_correct}/${test?.marking_wrong}`, l: 'Marking' }].map(k => (
            <div key={k.l} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
              <p style={{ fontWeight: 700, fontSize: '22px', color: 'var(--primary)' }}>{k.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{k.l}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '16px', textAlign: 'left' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>Question Palette Legend</p>
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

        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px', marginBottom: '20px', textAlign: 'left' }}>
          <p style={{ fontSize: '13px', color: '#92400e' }}>⚠️ This exam will go fullscreen. Switching tabs will be recorded and shown to faculty.</p>
        </div>

        <button onClick={startExam} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>▶ Begin Test</button>
      </div>
    </main>
  )

  if (!q) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-secondary)' }}>

      {/* Tab switch warning */}
      {showTabWarning && (
        <div style={{ position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', padding: '12px 24px', borderRadius: '10px', zIndex: 1000, fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          ⚠️ Tab switch detected! ({tabSwitches} total) — This is recorded.
        </div>
      )}

      {/* Top Bar */}
      <header style={{ background: 'var(--primary)', color: '#fff', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '4px 10px', fontWeight: 800, fontSize: '14px' }}>IMS</div>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{test?.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {tabSwitches > 0 && <span style={{ background: 'rgba(255,0,0,0.3)', padding: '3px 10px', borderRadius: '99px', fontSize: '12px' }}>⚠️ {tabSwitches} tab switch{tabSwitches > 1 ? 'es' : ''}</span>}
          {!isFullscreen && (
            <button onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
              ⛶ Fullscreen
            </button>
          )}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '11px', opacity: 0.8 }}>{test?.mode === 'timer' ? 'Time Remaining' : 'Time Elapsed'}</p>
            <p style={{ fontWeight: 700, fontSize: '20px', fontFamily: 'monospace', color: test?.mode === 'timer' && timeLeft < 300 ? '#fca5a5' : '#fff' }}>
              {test?.mode === 'timer' ? fmt(timeLeft) : fmt(elapsed)}
            </p>
          </div>
          <div style={{ fontSize: '13px', textAlign: 'right' }}>
            <p style={{ fontWeight: 600 }}>{student?.name}</p>
            <p style={{ opacity: 0.75 }}>{student?.batch}</p>
          </div>
        </div>
      </header>

      {/* Marking bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '6px 20px', display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
        <span>Correct: <strong style={{ color: 'var(--success)' }}>+{test?.marking_correct}</strong></span>
        <span>Wrong: <strong style={{ color: 'var(--danger)' }}>{test?.marking_wrong}</strong></span>
        <span>Total: <strong>{questions.length}</strong></span>
        <span style={{ marginLeft: 'auto' }}>Q {current + 1} / {questions.length}</span>
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Question Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', gap: '16px' }}>

          {/* Passage (if exists) */}
          {currentPassage && (
            <div style={{ flex: 1, background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', overflow: 'auto', boxShadow: 'var(--shadow-sm)' }}>
              {currentPassage.title && <p style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--primary)', fontSize: '14px' }}>{currentPassage.title}</p>}
              <p style={{ fontSize: '14px', lineHeight: '1.9', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{currentPassage.passage_text}</p>
            </div>
          )}

          {/* Question + Options */}
          <div style={{ flex: currentPassage ? '0 0 45%' : 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '99px' }}>Q{current + 1}</span>
                <span className={q.difficulty === 'easy' ? 'badge-green' : q.difficulty === 'hard' ? 'badge-red' : 'badge-yellow'}>{q.difficulty}</span>
              </div>
              <p style={{ fontSize: '15px', lineHeight: '1.8', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{q.question_text}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['a', 'b', 'c', 'd'] as const).map((opt, idx) => {
                const selected = answers[q.id] === opt
                return (
                  <div key={opt} onClick={() => selectAnswer(q.id, opt)}
                    style={{ background: selected ? 'var(--primary-light)' : '#fff', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'all 0.1s' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, background: selected ? 'var(--primary)' : 'var(--bg-secondary)', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border-strong)'}`, color: selected ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '2px', color: 'var(--text)' }}>{q[`option_${opt}` as keyof Question]}</p>
                  </div>
                )
              })}
            </div>

            {/* Nav buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => { setAnswers(p => { const n = {...p}; delete n[q.id]; return n }) }} className="btn-ghost" style={{ fontSize: '12px', padding: '8px 14px' }}>✕ Clear</button>
              <button onClick={() => { toggleMark(q.id); if (current < questions.length - 1) goTo(current + 1) }}
                style={{ background: '#7c3aed', color: '#fff', border: marked.has(q.id) ? '2px solid #4c1d95' : '2px solid transparent', borderRadius: 'var(--radius)', padding: '8px 14px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                {marked.has(q.id) ? '⚑ Marked — Unmark & Next' : '⚑ Mark for Review & Next'}
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {current > 0 && <button onClick={() => goTo(current - 1)} className="btn-ghost" style={{ fontSize: '12px', padding: '8px 14px' }}>← Back</button>}
                {current < questions.length - 1
                  ? <button onClick={() => goTo(current + 1)} className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>Save & Next →</button>
                  : <button onClick={() => { if (confirm('Submit the test?')) handleSubmit() }}
                      style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '8px 18px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Submit ✓</button>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div style={{ width: '240px', background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <p style={{ fontWeight: 600, fontSize: '14px' }}>{student?.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{student?.center}</p>
          </div>

          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Legend</p>
            {[
              { cls: 'nta-answered',        count: Object.keys(answers).length,                        label: 'Answered' },
              { cls: 'nta-marked',          count: [...marked].filter(v => !answers[v]).length,         label: 'Marked for Review' },
              { cls: 'nta-answered-marked', count: [...marked].filter(v => answers[v]).length,          label: 'Ans + Marked' },
              { cls: 'nta-not-visited',     count: questions.length - visited.size,                     label: 'Not Visited' },
              { cls: 'nta-not-answered',    count: [...visited].filter(v => !answers[v]).length,        label: 'Not Answered' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className={l.cls} style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                  {(l as { cls: string; count: number; label: string }).count}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 14px', flex: 1, overflow: 'auto' }}>
            <p style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Questions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => goTo(i)} className={getPaletteClass(q)}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: i === current ? '3px solid #1e3a8a' : 'none', transition: 'all 0.1s' }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { if (confirm('Submit the test? This cannot be undone.')) handleSubmit() }}
              style={{ width: '100%', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
              Submit Test ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}