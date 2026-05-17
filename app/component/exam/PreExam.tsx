'use client'
import { useState } from 'react'

export type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; sequence_order: number; passage_id: string | null; section_id: string | null }
export type Passage  = { id: string; passage_text: string; title: string | null; section_id: string | null }
export type Section  = { id: string; title: string; sequence_order: number; duration_minutes: number; mode: string }
export type Test     = { id: string; title: string; duration_minutes: number; mode: string; marking_correct: number; marking_wrong: number }

export function getEffSid(q: Question, pMap: Record<string, Passage>): string | null {
  if (q.passage_id && pMap[q.passage_id]?.section_id) return pMap[q.passage_id].section_id
  return q.section_id
}

type Props = {
  test: Test
  questions: Question[]
  passages: Record<string, Passage>
  sections: Section[]
  onStart: (sectionOrder: string[]) => void
}

const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`

export default function PreExam({ test, questions, passages, sections, onStart }: Props) {
  const [positionMap, setPositionMap] = useState<Record<string, number>>({})

  // ── Orphan check ─────────────────────────────────────
  const orphanCount = questions.filter(q => !getEffSid(q, passages)).length
  const hasOrphans  = orphanCount > 0
  const allAssigned = !hasOrphans && Object.keys(positionMap).length === sections.length

  // ── Section order selection ───────────────────────────
  function handlePositionClick(sectionId: string, position: number) {
    setPositionMap(prev => {
      const updated = { ...prev }
      // Unassign any section that already holds this position
      Object.keys(updated).forEach(sid => { if (updated[sid] === position) delete updated[sid] })
      // Clicking same position again on same section → unassign it (toggle off)
      if (prev[sectionId] === position) { delete updated[sectionId]; return updated }
      updated[sectionId] = position
      return updated
    })
  }

  function handleStart() {
    if (!allAssigned) return
    const orderedIds = [...sections]
      .sort((a, b) => positionMap[a.id] - positionMap[b.id])
      .map(s => s.id)
    onStart(orderedIds)
  }

  const totalDuration  = sections.reduce((sum, s) => sum + s.duration_minutes, 0)
  const orderedPreview = allAssigned
    ? [...sections].sort((a, b) => positionMap[a.id] - positionMap[b.id]).map(s => s.title).join(' → ')
    : null

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ maxWidth: '580px', width: '100%' }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>IMS</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>{test.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Read all instructions carefully before starting</p>
        </div>

        {/* ── Orphan warning — blocks start ── */}
        {hasOrphans && (
          <div style={{ background: 'var(--danger-light)', border: '1.5px solid var(--danger)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
            <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>⛔ Test Cannot Be Started</p>
            <p style={{ color: 'var(--danger)', fontSize: '13px' }}>
              {orphanCount} question{orphanCount > 1 ? 's are' : ' is'} not assigned to any section.
              Please contact your admin to fix this before attempting the test.
            </p>
          </div>
        )}

        {/* ── Test info grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { v: questions.length,                                    l: 'Total Questions' },
            { v: `${totalDuration} min`,                              l: 'Total Duration'  },
            { v: `+${test.marking_correct} / ${test.marking_wrong}`,  l: 'Marking'         },
          ].map(k => (
            <div key={k.l} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: '20px', color: 'var(--primary)' }}>{k.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{k.l}</p>
            </div>
          ))}
        </div>

        {/* ── Section order selection ── */}
        {!hasOrphans && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>Choose Your Section Order</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Select the order in which you want to attempt each section. Once a section ends you cannot return to it.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map(s => {
                const qCount = questions.filter(q => getEffSid(q, passages) === s.id).length
                const chosen  = positionMap[s.id]
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: chosen ? 'var(--primary-light)' : 'var(--bg-secondary)',
                    border: `1.5px solid ${chosen ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: '10px', transition: 'all 0.15s'
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: chosen ? 'var(--primary)' : 'var(--text)' }}>
                        {chosen ? `${ordinal(chosen)} — ` : ''}{s.title}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {qCount} Qs · {s.duration_minutes} min
                      </p>
                    </div>

                    {/* Position buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {sections.map((_, i) => {
                        const pos      = i + 1
                        const isChosen = positionMap[s.id] === pos
                        const isTaken  = !isChosen && Object.values(positionMap).includes(pos)
                        return (
                          <button
                            key={pos}
                            onClick={() => handlePositionClick(s.id, pos)}
                            disabled={isTaken}
                            style={{
                              padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
                              fontWeight: 700, border: 'none', transition: 'all 0.15s',
                              cursor: isTaken ? 'not-allowed' : 'pointer',
                              opacity: isTaken ? 0.3 : 1,
                              background: isChosen ? 'var(--primary)' : 'var(--bg-tertiary)',
                              color: isChosen ? '#fff' : 'var(--text-muted)',
                            }}
                          >
                            {ordinal(pos)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Order preview */}
            {orderedPreview && (
              <div style={{ marginTop: '12px', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '8px', padding: '10px 14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600 }}>
                  ✓ Your order: {orderedPreview}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Palette legend ── */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Question Palette Legend</p>
          {[
            { st: { background: '#9ca3af', color: '#fff' },                                                       label: 'Not Visited'           },
            { st: { background: '#dc2626', color: '#fff' },                                                       label: 'Visited, Not Answered'  },
            { st: { background: '#16a34a', color: '#fff' },                                                       label: 'Answered'              },
            { st: { background: '#7c3aed', color: '#fff' },                                                       label: 'Marked for Review'     },
            { st: { background: '#7c3aed', color: '#fff', outline: '2.5px solid #16a34a', outlineOffset: '1px' }, label: 'Answered + Marked'     },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, ...l.st }}>1</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Warnings ── */}
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', color: '#92400e' }}>⚠️ Fullscreen mode will be enabled. Tab switches are recorded.</p>
          <p style={{ fontSize: '13px', color: '#92400e', marginTop: '6px' }}>⚠️ Sections are sequential. Once you move to the next section, you cannot return.</p>
        </div>

        {/* ── Begin Test button ── */}
        <button
          onClick={handleStart}
          disabled={hasOrphans || !allAssigned}
          className="btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '16px' }}
        >
          {hasOrphans
            ? '⛔ Cannot Start — Fix Unassigned Questions'
            : !allAssigned
            ? 'Set Section Order to Begin'
            : '▶ Begin Test'}
        </button>

      </div>
    </main>
  )
}