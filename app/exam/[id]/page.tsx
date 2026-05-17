'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; sequence_order: number; passage_id: string | null; section_id: string | null }
type Passage = { id: string; passage_text: string; title: string | null; section_id: string | null }
type Section = { id: string; title: string; sequence_order: number; duration_minutes: number; mode: string }
type Test = { id: string; title: string; duration_minutes: number; mode: string; marking_correct: number; marking_wrong: number }
type Student = { id: string; name: string; center: string; batch: string }

export default function ExamPage() {
  const router = useRouter()
  const { id } = useParams()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [passages, setPassages] = useState<Record<string, Passage>>({})
  const [sections, setSections] = useState<Section[]>([])
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const fontSize =15
  const [showSubmitPopup, setShowSubmitPopup] = useState(false)
  const [passageSplit, setPassageSplit] = useState(50)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // Refs to avoid stale closures in timers
  const questionStartTime = useRef<number>(Date.now())
  const timeSpent = useRef<Record<string, number>>({})
  const tabSwitchRef = useRef(0)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const questionsRef = useRef<Question[]>([])
  const submittedRef = useRef(false)
  const answersRef = useRef<Record<string, string>>({})
  const markedRef = useRef<Set<string>>(new Set())
  const attemptIdRef = useRef<string | null>(null)
  const testRef = useRef<Test | null>(null)

  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { submittedRef.current = submitted }, [submitted])
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { markedRef.current = marked }, [marked])
  useEffect(() => { attemptIdRef.current = attemptId }, [attemptId])
  useEffect(() => { testRef.current = test }, [test])

  const getEffSid = (q: Question, pMap: Record<string, Passage>): string | null => {
    if (q.passage_id && pMap[q.passage_id]?.section_id) return pMap[q.passage_id].section_id
    return q.section_id
  }

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
    const { data: s } = await supabase.from('sections').select('*').eq('test_id', id).order('sequence_order')
    setTest(t); setQuestions(q || [])
    const pm: Record<string, Passage> = {}
    ;(p || []).forEach((pass: Passage) => { pm[pass.id] = pass })
    setPassages(pm); setSections(s || [])
    if (t) setTimeLeft(t.duration_minutes * 60)
  }

  useEffect(() => {
    if (!started || submitted) return
    const handle = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1
        setTabSwitches(tabSwitchRef.current)
        setShowTabWarning(true)
        setTimeout(() => setShowTabWarning(false), 3000)
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [started, submitted])

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true); setShowSubmitPopup(false)
    try { document.exitFullscreen() } catch {}
    const qs = questionsRef.current, ans = answersRef.current, mrk = markedRef.current
    const t = testRef.current, aId = attemptIdRef.current
    let score = 0, correct = 0, wrong = 0, unattempted = 0
    const rows = qs.map(q => {
      const sel = ans[q.id] || null, ok = sel === q.correct_option
      if (!sel) unattempted++; else if (ok) { correct++; score += t?.marking_correct || 3 } else { wrong++; score += t?.marking_wrong || -1 }
      return { attempt_id: aId, question_id: q.id, selected_option: sel, is_correct: sel ? ok : null, time_spent_seconds: timeSpent.current[q.id] || 0, is_marked_for_review: mrk.has(q.id) }
    })
    await supabase.from('answers').upsert(rows, { onConflict: 'attempt_id,question_id' })
    await supabase.from('attempts').update({ submitted_at: new Date().toISOString(), score, total_correct: correct, total_wrong: wrong, total_unattempted: unattempted, is_completed: true, tab_switches: tabSwitchRef.current }).eq('id', aId)
    router.push(`/result/${id}?attempt=${aId}`)
  }, [id, router])

  const startExam = async () => {
    if (!student || !test) return
    try { await document.documentElement.requestFullscreen() } catch {}
    const { data } = await supabase.from('attempts').insert([{ student_id: student.id, test_id: id, started_at: new Date().toISOString(), tab_switches: 0 }]).select().single()
    setAttemptId(data.id); setStarted(true)
    questionStartTime.current = Date.now()
    if (questions[0]) setVisited(new Set([questions[0].id]))
  }

  // Main timer + section timers (single interval, ref-based)
  useEffect(() => {
    if (!started || submitted) return
    const interval = setInterval(() => {
      if (submittedRef.current) return
      const t = testRef.current
      if (t?.mode === 'timer') {
        setTimeLeft(prev => { if (prev <= 1) { doSubmit(); return 0 } return prev - 1 })
      } else { setElapsed(e => e + 1) }
    }, 1000)
    return () => clearInterval(interval)
  }, [started, submitted, doSubmit])

  // Auto-save every 60s
  useEffect(() => {
    if (!started || submitted) return
    const interval = setInterval(async () => {
      const aId = attemptIdRef.current; if (!aId) return
      const ans = answersRef.current, mrk = markedRef.current, qs = questionsRef.current
      const rows = Object.entries(ans).map(([qid, opt]) => {
        const q = qs.find(x => x.id === qid)
        return { attempt_id: aId, question_id: qid, selected_option: opt, is_correct: q ? opt === q.correct_option : false, time_spent_seconds: timeSpent.current[qid] || 0, is_marked_for_review: mrk.has(qid) }
      })
      if (rows.length > 0) await supabase.from('answers').upsert(rows, { onConflict: 'attempt_id,question_id' })
    }, 60000)
    return () => clearInterval(interval)
  }, [started, submitted])

  const recordTime = (qid: string) => {
    const spent = Math.floor((Date.now() - questionStartTime.current) / 1000)
    timeSpent.current[qid] = (timeSpent.current[qid] || 0) + spent
    questionStartTime.current = Date.now()
  }

  const goTo = (index: number) => {
    const targetQ = questions[index]
    if (!targetQ) return
    if (questions[current]) recordTime(questions[current].id)
    setCurrent(index)
    setVisited(prev => new Set([...prev, questions[index].id]))
  }

  const selectAnswer = (qid: string, opt: string) => {
    const q = questions.find(x => x.id === qid)
    setAnswers(prev => ({ ...prev, [qid]: opt }))
  }

  const toggleMark = (qid: string) => setMarked(prev => { const n = new Set(prev); n.has(qid) ? n.delete(qid) : n.add(qid); return n })

  // Draggable passage divider
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setPassageSplit(Math.min(75, Math.max(25, ((e.clientX - rect.left) / rect.width) * 100)))
  }, [])
  const handleDragEnd = useCallback(() => { isDragging.current = false }, [])
  useEffect(() => {
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
    return () => { window.removeEventListener('mousemove', handleDragMove); window.removeEventListener('mouseup', handleDragEnd) }
  }, [handleDragMove, handleDragEnd])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const getPaletteStyle = (q: Question): React.CSSProperties => {
    const hasAns = !!answers[q.id], isMrk = marked.has(q.id), isVis = visited.has(q.id)
    if (hasAns && isMrk) return { background: '#7c3aed', color: '#fff', outline: '2.5px solid #16a34a', outlineOffset: '1px' }
    if (hasAns) return { background: '#16a34a', color: '#fff' }
    if (isMrk) return { background: '#7c3aed', color: '#fff' }
    if (isVis) return { background: '#dc2626', color: '#fff' }
    return { background: '#9ca3af', color: '#fff' }
  }

  const q = questions[current]
  const currentPassage = q?.passage_id ? passages[q.passage_id] : null
  const answeredCount = Object.keys(answers).length
  const unansweredCount = questions.length - answeredCount
  const markedUnanswered = [...marked].filter(qid => !answers[qid]).length
  const markedAnswered = [...marked].filter(qid => !!answers[qid]).length
  const mainTimerValue = test?.mode === 'timer' ? timeLeft : elapsed
  const mainTimerIsRed = test?.mode === 'timer' && timeLeft < 60
  const mainTimerLabel = test?.mode === 'timer' ? 'Time Remaining' : 'Time Elapsed'

  // ── PRE-EXAM ──
  if (!started) return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '560px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', background: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>IMS</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>{test?.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>Read all instructions before starting</p>

        {sections.length > 0 && (
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>Section Breakdown</p>
            {sections.map((s, i) => {
              const cnt = questions.filter(q2 => getEffSid(q2, passages) === s.id).length
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '22px', height: '22px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>{cnt} Qs</span><span>{s.duration_minutes} min</span>
                  </div>
                </div>
              )
            })}
            
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
          {[{ v: questions.length, l: 'Total Questions' }, { v: `${test?.duration_minutes}`, l: 'Minutes' }, { v: `+${test?.marking_correct}/${test?.marking_wrong}`, l: 'Marking' }].map(k => (
            <div key={k.l} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
              <p style={{ fontWeight: 700, fontSize: '22px', color: 'var(--primary)' }}>{k.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{k.l}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Question Palette Legend</p>
          {[
            { st: { background: '#9ca3af', color: '#fff' },                                                     label: 'Not Visited' },
            { st: { background: '#dc2626', color: '#fff' },                                                     label: 'Visited, Not Answered' },
            { st: { background: '#16a34a', color: '#fff' },                                                     label: 'Answered' },
            { st: { background: '#7c3aed', color: '#fff' },                                                     label: 'Marked for Review' },
            { st: { background: '#7c3aed', color: '#fff', outline: '2.5px solid #16a34a', outlineOffset: '1px' }, label: 'Answered + Marked' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, ...l.st }}>1</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{l.label}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px', marginBottom: '20px', textAlign: 'left' }}>
          <p style={{ fontSize: '13px', color: '#92400e' }}>⚠️ Fullscreen mode. Tab switches are recorded.</p>
        </div>
        <button onClick={startExam} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>▶ Begin Test</button>
      </div>
    </main>
  )

  if (!q) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-secondary)' }}>

      {/* Tab warning */}
      {showTabWarning && (
        <div style={{ position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', padding: '12px 24px', borderRadius: '10px', zIndex: 1000, fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          ⚠️ Tab switch detected! ({tabSwitches} total)
        </div>
      )}

      {/* Image zoom */}
      {zoomedImage && (
        <div onClick={() => setZoomedImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={zoomedImage} alt="zoomed" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: '8px' }} />
          <button style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}>✕ Close</button>
        </div>
      )}

      {/* Submit popup */}
      {showSubmitPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: '420px', width: '90%' }}>
            <h2 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '16px' }}>Submit Test?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {[
                { v: answeredCount,    l: 'Answered',           c: 'var(--success)' },
                { v: unansweredCount,  l: 'Not Answered',       c: 'var(--danger)'  },
                { v: markedAnswered,   l: 'Answered + Marked',  c: '#7c3aed'        },
                { v: markedUnanswered, l: 'Marked, Unanswered', c: '#f59e0b'        },
              ].map(s => (
                <div key={s.l} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 700, fontSize: '26px', color: s.c }}>{s.v}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{s.l}</p>
                </div>
              ))}
            </div>
            {unansweredCount > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                ⚠️ {unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''} will be skipped.
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSubmitPopup(false)} className="btn-ghost" style={{ flex: 1, padding: '12px' }}>Go Back</button>
              <button onClick={doSubmit} style={{ flex: 1, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Confirm Submit ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* Header — no name/batch */}
      <header style={{ background: 'var(--primary)', color: '#fff', padding: '0 20px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '3px 10px', fontWeight: 800, fontSize: '13px' }}>IMS</div>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{test?.title}</span>
          {tabSwitches > 0 && <span style={{ background: 'rgba(255,0,0,0.35)', padding: '2px 8px', borderRadius: '99px', fontSize: '11px' }}>⚠️ {tabSwitches} switch{tabSwitches > 1 ? 'es' : ''}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        
          {!isFullscreen && (
            <button onClick={() => document.documentElement.requestFullscreen().catch(() => {})} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>⛶ Fullscreen</button>
          )}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '10px', opacity: 0.8, marginBottom: '1px' }}>{mainTimerLabel}</p>
            <p style={{ fontWeight: 700, fontSize: '20px', fontFamily: 'monospace', color: mainTimerIsRed ? '#fca5a5' : '#fff', lineHeight: 1 }}>{fmt(mainTimerValue)}</p>
          </div>
        </div>
      </header>

      {/* Info bar — sections left, marking right */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
            {sections.map(s => {
              const isActive = s.id === getEffSid(q, passages)
              return (
                <span key={s.id} style={{
                fontSize: '13px', padding: '3px 12px', borderRadius: '99px',
                fontWeight: 600,
                background: isActive ? 'var(--primary)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                transition: 'all 0.2s'
              }}>
                {s.title}
             </span>
            )
          })}
</div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)', marginLeft: 'auto', flexShrink: 0 }}>
          <span>Correct: <strong style={{ color: 'var(--success)' }}>+{test?.marking_correct}</strong></span>
          <span>Wrong: <strong style={{ color: 'var(--danger)' }}>{test?.marking_wrong}</strong></span>
          <span>Total: <strong>{questions.length}</strong></span>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Question area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {currentPassage ? (
              // Passage split layout
              <div style={{ display: 'flex', flex: 1, padding: '12px', gap: 0, overflow: 'hidden' }}>
                {/* Passage panel */}
                <div style={{ width: `${passageSplit}%`, background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '16px', overflow: 'auto', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
                  {currentPassage.title && <p style={{ fontWeight: 700, marginBottom: '10px', color: 'var(--primary)', fontSize: '14px' }}>{currentPassage.title}</p>}
                  <p style={{ fontSize: `${fontSize}px`, lineHeight: '1.9', color: 'var(--text)', whiteSpace: 'pre-wrap' }}
                    onClick={e => { const img = (e.target as HTMLElement).closest('img') as HTMLImageElement | null; if (img?.src) setZoomedImage(img.src) }}>
                    {currentPassage.passage_text}
                  </p>
                </div>
                {/* Drag handle */}
                <div onMouseDown={() => { isDragging.current = true }}
                  style={{ width: '9px', cursor: 'col-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', background: 'var(--bg-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}>
                  <div style={{ width: '3px', height: '28px', borderRadius: '2px', background: 'var(--border-strong)' }} />
                </div>
                {/* Question panel */}
                <div style={{ flex: 1, overflow: 'auto', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {renderQuestion()}
                </div>
              </div>
            ) : (
              // Full layout
              <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {renderQuestion()}
              </div>
            )}
          </div>

          {/* Fixed footer buttons */}
          <div style={{ background: '#fff', borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setAnswers(p => { const n = { ...p }; delete n[q.id]; return n })} className="btn-ghost" style={{ fontSize: '14px', padding: '8px 14px' }}>✕ Clear</button>
            <button onClick={() => { toggleMark(q.id); if (current < questions.length - 1) goTo(current + 1) }}
              style={{ background: '#7c3aed', color: '#fff', border: marked.has(q.id) ? '2px solid #4c1d95' : '2px solid transparent', borderRadius: 'var(--radius)', padding: '8px 14px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
              {marked.has(q.id) ? '⚑ Unmark & Next' : '⚑ Mark & Next'}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {current > 0 && <button onClick={() => goTo(current - 1)} className="btn-ghost" style={{ fontSize: '14px', padding: '8px 14px' }}>← Back</button>}
              {current < questions.length - 1
                ? <button onClick={() => goTo(current + 1)} className="btn-primary" style={{ fontSize: '14px', padding: '8px 16px' }}>Save & Next →</button>
                : <button onClick={() => setShowSubmitPopup(true)} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Submit ✓</button>
              }
            </div>
          </div>
        </div>

        {/* Sidebar toggle arrow */}
        <div onClick={() => setSidebarOpen(o => !o)}
          style={{ width: '15px', background: 'var(--primary-light)', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
          <span style={{ fontSize: '18px', color: 'var(--primary)', display: 'inline-block', transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}>❯</span>
        </div>

        {/* Right sidebar */}
        {sidebarOpen && (
          <div style={{ width: '234px', background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

            {/* Student info */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '14px' }}>{student?.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{student?.batch}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{student?.center}</p>
            </div>

            {/* Legend — no label */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {[
                { st: { background: '#16a34a', color: '#fff' },                                                       cnt: Object.keys(answers).length,                  label: 'Answered' },
                { st: { background: '#dc2626', color: '#fff' },                                                       cnt: [...visited].filter(v => !answers[v]).length, label: 'Not Answered' },
                { st: { background: '#9ca3af', color: '#fff' },                                                       cnt: questions.length - visited.size,              label: 'Not Visited' },
                { st: { background: '#7c3aed', color: '#fff' },                                                       cnt: [...marked].filter(v => !answers[v]).length,  label: 'Marked for Review' },
                { st: { background: '#7c3aed', color: '#fff', outline: '2.5px solid #16a34a', outlineOffset: '1px' }, cnt: [...marked].filter(v => answers[v]).length,   label: 'Answered & Marked for Review' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ width: '35px', height: '35px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, ...l.st }}>{l.cnt}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Palette */}
            <div style={{ padding: '10px 14px', flex: 1, overflow: 'auto' }}>
                {sections.length > 0 ? (
  sections.map(s => {
    const sQs = questions.map((qx, i) => ({ q: qx, i })).filter(({ q: qx }) => getEffSid(qx, passages) === s.id)
    return (
      <div key={s.id} style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{s.title}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
          {sQs.map(({ q: sq, i }) => (
            <button key={sq.id} onClick={() => goTo(i)}
              style={{ width: '35px', height: '35px', borderRadius: '50%', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: i === current ? '3px solid #1e3a8a' : 'none', transition: 'all 0.1s', ...getPaletteStyle(sq) }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    )
  })
) : (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
    {questions.map((qx, i) => (
      <button key={qx.id} onClick={() => goTo(i)}
        style={{ width: '35px', height: '35px', borderRadius: '50%', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: i === current ? '3px solid #1e3a8a' : 'none', transition: 'all 0.1s', ...getPaletteStyle(qx) }}>
        {i + 1}
      </button>
    ))}
  </div>
)}
            </div>

            {/* Submit */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button onClick={() => setShowSubmitPopup(true)}
                style={{ width: '100%', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '11px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                Submit Test ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  function renderQuestion() {
    return (
      <>
        <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '3px 12px', borderRadius: '99px' }}>Q{current + 1}</span>
          </div>
          <p style={{ fontSize: `${fontSize}px`, lineHeight: '1.85', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{q.question_text}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(['a', 'b', 'c', 'd'] as const).map((opt, idx) => {
            const selected = answers[q.id] === opt
            return (
              <div key={opt} onClick={() => selectAnswer(q.id, opt)}
                style={{ background: selected ? 'var(--primary-light)' : '#fff', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '11px 16px', cursor:  'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'all 0.1s' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: selected ? 'var(--primary)' : 'var(--bg-secondary)', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border-strong)'}`, color: selected ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <p style={{ fontSize: `${fontSize}px`, lineHeight: '1.6', marginTop: '2px', color: 'var(--text)' }}>{q[`option_${opt}` as keyof Question]}</p>
              </div>
            )
          })}
        </div>
      </>
    )
  }
}