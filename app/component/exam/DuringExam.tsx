'use client'
import { useRef, useCallback, useEffect } from 'react'
import { Question, Passage, Section, Test, getEffSid } from './PreExam'

type Student = { id: string; name: string; center: string; batch: string }

type Props = {
  test: Test
  questions: Question[]
  passages: Record<string, Passage>
  sections: Section[]
  student: Student
  sectionOrder: string[]
  current: number
  answers: Record<string, string>
  marked: Set<string>
  visited: Set<string>
  tabSwitches: number
  showTabWarning: boolean
  isFullscreen: boolean
  sidebarOpen: boolean
  showSubmitPopup: boolean
  passageSplit: number
  zoomedImage: string | null
  currentSectionIdx: number
  lockedSections: Set<string>
  sectionTimeLeft: Record<string, number>
  setSidebarOpen: (v: boolean) => void
  setPassageSplit: (v: number) => void
  setZoomedImage: (v: string | null) => void
  setShowSubmitPopup: (v: boolean) => void
  goTo: (i: number) => void
  selectAnswer: (qid: string, opt: string) => void
  toggleMark: (qid: string) => void
  clearAnswer: () => void
  moveToNextSection: () => void
  showMoveNextPopup: boolean
  setShowMoveNextPopup: (v: boolean) => void
  confirmMoveToNextSection: () => void
  confirmSubmit: () => void
}

export default function DuringExam({
  test, questions, passages, sections, student, sectionOrder,
  current, answers, marked, visited,
  tabSwitches, showTabWarning, isFullscreen, sidebarOpen,
  showSubmitPopup, passageSplit, zoomedImage,
  currentSectionIdx, lockedSections, sectionTimeLeft,
  setSidebarOpen, setPassageSplit, setZoomedImage, setShowSubmitPopup,
  goTo, selectAnswer, toggleMark, clearAnswer, moveToNextSection, confirmSubmit, 
  showMoveNextPopup, setShowMoveNextPopup, confirmMoveToNextSection
}: Props) {

  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeSection = sectionOrder[currentSectionIdx]
    ? sections.find(s => s.id === sectionOrder[currentSectionIdx]) || null
    : null

  const currentSectionQs = questions.filter(q => getEffSid(q, passages) === activeSection?.id)
  const q = questions[current]
  const currentPassage = q?.passage_id ? passages[q.passage_id] : null
  const isLastSection = currentSectionIdx >= sectionOrder.length - 1

  const answeredCount = Object.keys(answers).length
  const unansweredCount = questions.length - answeredCount
  const markedAnswered = [...marked].filter(id => !!answers[id]).length
  const markedUnanswered = [...marked].filter(id => !answers[id]).length

  const secTimeLeft = activeSection ? (sectionTimeLeft[activeSection.id] ?? 0) : 0
  const timerIsRed = secTimeLeft < 60
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const getPaletteStyle = (qx: Question): React.CSSProperties => {
    const hasAns = !!answers[qx.id], isMrk = marked.has(qx.id), isVis = visited.has(qx.id)
    if (hasAns && isMrk) return { background: '#7c3aed', color: '#fff', outline: '2.5px solid #16a34a', outlineOffset: '1px' }
    if (hasAns) return { background: '#16a34a', color: '#fff' }
    if (isMrk) return { background: '#7c3aed', color: '#fff' }
    if (isVis) return { background: '#dc2626', color: '#fff' }
    return { background: '#9ca3af', color: '#fff' }
  }

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setPassageSplit(Math.min(75, Math.max(25, ((e.clientX - rect.left) / rect.width) * 100)))
  }, [setPassageSplit])

  const handleDragEnd = useCallback(() => { isDragging.current = false }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  const fontSize = 15

  function renderQuestion() {
    if (!q) return null
    return (
      <>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', padding: '3px 12px', borderRadius: '99px' }}>
              Q{currentSectionQs.findIndex(x => x.id === q.id) + 1} of {currentSectionQs.length}
            </span>
          </div>
          <p style={{ fontSize: `${fontSize}px`, lineHeight: '1.85', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{q.question_text}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(['a','b','c','d'] as const).map((opt, idx) => {
            const selected = answers[q.id] === opt
            return (
              <div key={opt} onClick={() => selectAnswer(q.id, opt)}
                style={{ background: selected ? 'var(--primary-light)' : '#fff', border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', padding: '11px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'all 0.1s' }}>
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
            <h2 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '16px' }}>Submit Entire Test?</h2>
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
              <button onClick={confirmSubmit} style={{ flex: 1, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Confirm Submit ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* {move to next section block} */}
    {showMoveNextPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
                <h2 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '10px' }}>Move to Next Section?</h2>
                <p style={{ fontSize: '14px', color: 'black', marginBottom: '20px', lineHeight: '1.6' }}>
                You <strong>cannot return</strong> to this section once you proceed. Make sure you have reviewed all your answers.
                </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowMoveNextPopup(false)} className="btn-ghost" style={{ flex: 1, padding: '12px' }}>Go Back</button>
                <button onClick={confirmMoveToNextSection} style={{ flex: 1, background: '#4506d9', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                Confirm → Next Section
                </button>
            </div>
            </div>
        </div>
        )}
      {/* Header */}
      <header style={{ background: 'var(--primary)', color: '#fff', padding: '0 20px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '3px 10px', fontWeight: 800, fontSize: '13px' }}>IMS</div>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{test.title}</span>
          {tabSwitches > 0 && <span style={{ background: 'rgba(255,0,0,0.35)', padding: '2px 8px', borderRadius: '99px', fontSize: '11px' }}>⚠️ {tabSwitches} switch{tabSwitches > 1 ? 'es' : ''}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!isFullscreen && (
            <button onClick={() => document.documentElement.requestFullscreen().catch(() => {})} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>⛶ Fullscreen</button>
          )}
          {activeSection && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', opacity: 0.8, marginBottom: '1px' }}>{activeSection.title} — {activeSection.mode === 'timer' ? 'Remaining' : 'Elapsed'}</p>
              <p style={{ fontWeight: 700, fontSize: '22px', fontFamily: 'monospace', color: timerIsRed ? '#fca5a5' : '#fff', lineHeight: 1 }}>{fmt(secTimeLeft)}</p>
            </div>
          )}
        </div>
      </header>

      {/* Info bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
          {sectionOrder.map((sid, idx) => {
            const s = sections.find(x => x.id === sid)
            if (!s) return null
            const isActive = sid === activeSection?.id
            const isDone = lockedSections.has(sid)
            return (
              <span key={sid} style={{ fontSize: '13px', padding: '3px 12px', borderRadius: '99px', fontWeight: 600, transition: 'all 0.2s', background: isDone ? 'var(--success-light)' : isActive ? 'var(--primary)' : 'var(--bg-secondary)', color: isDone ? 'var(--success)' : isActive ? '#fff' : 'var(--text-muted)', border: `1px solid ${isDone ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--border)'}` }}>
                {isDone ? '✓ ' : ''}{idx + 1}. {s.title}
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)', marginLeft: 'auto', flexShrink: 0 }}>
          <span>Correct: <strong style={{ color: 'var(--success)' }}>+{test.marking_correct}</strong></span>
          <span>Wrong: <strong style={{ color: 'var(--danger)' }}>{test.marking_wrong}</strong></span>
          <span>Total: <strong>{currentSectionQs.length}</strong></span>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Question area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {currentPassage ? (
              <div style={{ display: 'flex', flex: 1, padding: '12px', gap: 0, overflow: 'hidden' }}>
                {/* Passage */}
                <div style={{ width: `${passageSplit}%`, background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px', overflow: 'auto', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
                  {currentPassage.title && <p style={{ fontWeight: 700, marginBottom: '10px', color: 'var(--primary)', fontSize: '14px' }}>{currentPassage.title}</p>}
                  <p style={{ fontSize: `${fontSize}px`, lineHeight: '1.9', color: 'var(--text)', whiteSpace: 'pre-wrap' }}
                    onClick={e => { const img = (e.target as HTMLElement).closest('img') as HTMLImageElement | null; if (img?.src) setZoomedImage(img.src) }}>
                    {currentPassage.passage_text}
                  </p>
                </div>
                {/* Drag handle */}
                <div onMouseDown={() => { isDragging.current = true }}
                  style={{ width: '9px', cursor: 'col-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', background: 'var(--bg-secondary)', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}>
                  <div style={{ width: '3px', height: '28px', borderRadius: '2px', background: 'var(--border-strong)' }} />
                </div>
                {/* Question */}
                <div style={{ flex: 1, overflow: 'auto', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {renderQuestion()}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {renderQuestion()}
              </div>
            )}
          </div>

          {/* Fixed footer */}
          <div style={{ background: '#fff', borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={clearAnswer} className="btn-ghost" style={{ fontSize: '14px', padding: '9px 16px' }}>✕ Clear</button>
            <button onClick={() => { if (q) { toggleMark(q.id); const idx = questions.indexOf(q); if (idx < questions.length - 1) goTo(idx + 1) } }}
              style={{ background: q && marked.has(q.id) ? '#4c1d95' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
              {q && marked.has(q.id) ? '⚑ Unmark & Next' : '⚑ Mark & Next'}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {(() => {
                const idx = questions.indexOf(q)
                const prevInSection = currentSectionQs.find((_, i) => currentSectionQs[i + 1]?.id === q?.id)
                const hasPrev = !!prevInSection
                return hasPrev && <button onClick={() => { const prevIdx = questions.indexOf(prevInSection); if (prevIdx >= 0) goTo(prevIdx) }} className="btn-ghost" style={{ fontSize: '14px', padding: '9px 16px' }}>← Back</button>
              })()}
              {(() => {
                const qIdx = currentSectionQs.findIndex(x => x.id === q?.id)
                const isLastQ = qIdx === currentSectionQs.length - 1
                if (!isLastQ) {
                  const nextQ = currentSectionQs[qIdx + 1]
                  const nextIdx = questions.indexOf(nextQ)
                  return <button onClick={() => goTo(nextIdx)} className="btn-primary" style={{ fontSize: '14px', padding: '9px 18px' }}>Save & Next →</button>
                }
                return null
              })()}
            </div>
          </div>
        </div>

        {/* Sidebar arrow */}
        <div onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ width: '28px', background: 'var(--primary-light)', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
          <span style={{ fontSize: '16px', color: 'var(--primary)', fontWeight: 700, display: 'inline-block', transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}>❯</span>
        </div>

        {/* Right sidebar */}
        {sidebarOpen && (
          <div style={{ width: '234px', background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

            {/* Student info */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '14px' }}>{student.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{student.batch}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{student.center}</p>
            </div>

            {/* Legend */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {[
                { st: { background: '#16a34a', color: '#fff' }, cnt: Object.keys(answers).length, label: 'Answered' },
                { st: { background: '#7c3aed', color: '#fff' }, cnt: [...marked].filter(v => !answers[v]).length, label: 'Marked for Review' },
                { st: { background: '#7c3aed', color: '#fff', outline: '2.5px solid #16a34a', outlineOffset: '1px' }, cnt: [...marked].filter(v => answers[v]).length, label: 'Ans + Marked' },
                { st: { background: '#9ca3af', color: '#fff' }, cnt: questions.length - visited.size, label: 'Not Visited' },
                { st: { background: '#dc2626', color: '#fff' }, cnt: [...visited].filter(v => !answers[v]).length, label: 'Not Answered' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0, ...l.st }}>{l.cnt}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Palette — current section only */}
            <div style={{ padding: '10px 14px', flex: 1, overflow: 'auto' }}>
              {activeSection && (
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>{activeSection.title}</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                {currentSectionQs.map(sq => {
                  const globalIdx = questions.indexOf(sq)
                  const sectionIdx = currentSectionQs.indexOf(sq)
                  return (
                    <button key={sq.id} onClick={() => goTo(globalIdx)}
                      style={{ width: '38px', height: '38px', borderRadius: '50%', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: globalIdx === current ? '3px solid #1e3a8a' : 'none', transition: 'all 0.1s', ...getPaletteStyle(sq) }}>
                      {sectionIdx + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Move to Next Section + Submit */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!isLastSection && (
                <button
                  onClick={moveToNextSection}
                  style={{ width: '100%', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                  Move to Next Section →
                </button>
              )}
              {isLastSection && (
                <button onClick={() => setShowSubmitPopup(true)}
                  style={{ width: '100%', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                  Submit Test ✓
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}