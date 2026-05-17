'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import PreExam, { Question, Passage, Section, Test, getEffSid } from '../../component/exam/PreExam'
import DuringExam from '../../component/exam/DuringExam'

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

  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sectionOrder, setSectionOrder] = useState<string[]>([])

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [visited, setVisited] = useState<Set<string>>(new Set())

  const [sectionTimeLeft, setSectionTimeLeft] = useState<Record<string, number>>({})
  const [lockedSections, setLockedSections] = useState<Set<string>>(new Set())
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)

  const [tabSwitches, setTabSwitches] = useState(0)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showSubmitPopup, setShowSubmitPopup] = useState(false)
  const [passageSplit, setPassageSplit] = useState(50)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // Refs for stale-closure-safe callbacks
  const questionStartTime = useRef<number>(Date.now())
  const timeSpent = useRef<Record<string, number>>({})
  const tabSwitchRef = useRef(0)
  const submittedRef = useRef(false)
  const answersRef = useRef<Record<string, string>>({})
  const markedRef = useRef<Set<string>>(new Set())
  const attemptIdRef = useRef<string | null>(null)
  const testRef = useRef<Test | null>(null)
  const questionsRef = useRef<Question[]>([])
  const sectionOrderRef = useRef<string[]>([])
  const currentSectionIdxRef = useRef(0)
  const lockedSectionsRef = useRef<Set<string>>(new Set())
  const sectionsRef = useRef<Section[]>([])
  const passagesRef = useRef<Record<string, Passage>>({})
  const [showMoveNextPopup, setShowMoveNextPopup] = useState(false)

  useEffect(() => { submittedRef.current = submitted }, [submitted])
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { markedRef.current = marked }, [marked])
  useEffect(() => { attemptIdRef.current = attemptId }, [attemptId])
  useEffect(() => { testRef.current = test }, [test])
  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { sectionOrderRef.current = sectionOrder }, [sectionOrder])
  useEffect(() => { currentSectionIdxRef.current = currentSectionIdx }, [currentSectionIdx])
  useEffect(() => { lockedSectionsRef.current = lockedSections }, [lockedSections])
  useEffect(() => { sectionsRef.current = sections }, [sections])
  useEffect(() => { passagesRef.current = passages }, [passages])

  useEffect(() => {
    const onFS = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFS)
    return () => document.removeEventListener('fullscreenchange', onFS)
  }, [])

  useEffect(() => {
    const s = localStorage.getItem('student')
    if (!s) { router.push('/login'); return }
    setStudent(JSON.parse(s))
    fetchExam()
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
      if (!sel) unattempted++
      else if (ok) { correct++; score += t?.marking_correct || 3 }
      else { wrong++; score += t?.marking_wrong || -1 }
      return { attempt_id: aId, question_id: q.id, selected_option: sel, is_correct: sel ? ok : null, time_spent_seconds: timeSpent.current[q.id] || 0, is_marked_for_review: mrk.has(q.id) }
    })
    await supabase.from('answers').upsert(rows, { onConflict: 'attempt_id,question_id' })
    await supabase.from('attempts').update({ submitted_at: new Date().toISOString(), score, total_correct: correct, total_wrong: wrong, total_unattempted: unattempted, is_completed: true, tab_switches: tabSwitchRef.current }).eq('id', aId)
    router.push(`/result/${id}?attempt=${aId}`)
  }, [id, router])

  // Section timer
  useEffect(() => {
    if (!started || submitted) return
    const interval = setInterval(() => {
      if (submittedRef.current) return
      const order = sectionOrderRef.current
      const secs = sectionsRef.current
      const idx = currentSectionIdxRef.current
      const activeSid = order[idx]
      const activeSec = secs.find(s => s.id === activeSid)
      if (!activeSec || lockedSectionsRef.current.has(activeSid)) return

      setSectionTimeLeft(prev => {
        const curr = prev[activeSid] ?? 0
        if (curr <= 1) {
          // Lock this section, move to next
          const newLocked = new Set([...lockedSectionsRef.current, activeSid])
          lockedSectionsRef.current = newLocked
          setLockedSections(newLocked)
          const newIdx = idx + 1
          currentSectionIdxRef.current = newIdx
          setCurrentSectionIdx(newIdx)
          if (newIdx >= order.length) {
            // All sections done — submit
            doSubmit()
          } else {
            // Jump to first question of next section
            const nextSid = order[newIdx]
            const qs = questionsRef.current, pm = passagesRef.current
            const nextQ = qs.find(q => getEffSid(q, pm) === nextSid)
            if (nextQ) {
              const ni = qs.indexOf(nextQ)
              setCurrent(ni)
              setVisited(pv => new Set([...pv, qs[ni].id]))
            }
          }
          return { ...prev, [activeSid]: 0 }
        }
        return { ...prev, [activeSid]: curr - 1 }
      })
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

  const handleStart = async (orderedSectionIds: string[]) => {
    if (!student || !test) return
    try { await document.documentElement.requestFullscreen() } catch {}
    const { data } = await supabase.from('attempts').insert([{
      student_id: student.id, test_id: id, started_at: new Date().toISOString(), tab_switches: 0
    }]).select().single()
    setAttemptId(data.id)

    // Init section timers
    const stl: Record<string, number> = {}
    sections.forEach(s => { stl[s.id] = s.duration_minutes * 60 })
    setSectionTimeLeft(stl)
    setSectionOrder(orderedSectionIds)

    // Jump to first question of first section
    const firstSid = orderedSectionIds[0]
    const firstQ = questions.find(q => getEffSid(q, passages) === firstSid)
    if (firstQ) {
      const fi = questions.indexOf(firstQ)
      setCurrent(fi)
      setVisited(new Set([firstQ.id]))
    }
    setStarted(true)
    questionStartTime.current = Date.now()
  }

  const recordTime = (qid: string) => {
    const spent = Math.floor((Date.now() - questionStartTime.current) / 1000)
    timeSpent.current[qid] = (timeSpent.current[qid] || 0) + spent
    questionStartTime.current = Date.now()
  }

  const goTo = (index: number) => {
    if (!questions[index]) return
    if (questions[current]) recordTime(questions[current].id)
    setCurrent(index)
    setVisited(prev => new Set([...prev, questions[index].id]))
  }

  const selectAnswer = (qid: string, opt: string) => {
    setAnswers(prev => ({ ...prev, [qid]: opt }))
  }

  const toggleMark = (qid: string) => {
    setMarked(prev => { const n = new Set(prev); n.has(qid) ? n.delete(qid) : n.add(qid); return n })
  }

  const clearAnswer = () => {
    if (!questions[current]) return
    setAnswers(prev => { const n = { ...prev }; delete n[questions[current].id]; return n })
  }

  const moveToNextSection = () => {
  setShowMoveNextPopup(true)
  }

  const confirmMoveToNextSection = () => {
  setShowMoveNextPopup(false)
  const activeSid = sectionOrder[currentSectionIdx]
  const newLocked = new Set([...lockedSections, activeSid])
  setLockedSections(newLocked)
  lockedSectionsRef.current = newLocked
  const newIdx = currentSectionIdx + 1
  setCurrentSectionIdx(newIdx)
  currentSectionIdxRef.current = newIdx
  if (newIdx >= sectionOrder.length) { doSubmit(); return }
  const nextSid = sectionOrder[newIdx]
  const nextQ = questions.find(q => getEffSid(q, passages) === nextSid)
  if (nextQ) {
    const ni = questions.indexOf(nextQ)
    setCurrent(ni)
    setVisited(prev => new Set([...prev, questions[ni].id]))
  }
  }

  if (!test || !student) return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
    </main>
  )

  if (!started) return (
    <PreExam
      test={test}
      questions={questions}
      passages={passages}
      sections={sections}
      onStart={handleStart}
    />
  )

  return (
    <DuringExam
      test={test}
      questions={questions}
      passages={passages}
      sections={sections}
      student={student}
      sectionOrder={sectionOrder}
      current={current}
      answers={answers}
      marked={marked}
      visited={visited}
      tabSwitches={tabSwitches}
      showTabWarning={showTabWarning}
      isFullscreen={isFullscreen}
      sidebarOpen={sidebarOpen}
      showSubmitPopup={showSubmitPopup}
      passageSplit={passageSplit}
      zoomedImage={zoomedImage}
      currentSectionIdx={currentSectionIdx}
      lockedSections={lockedSections}
      sectionTimeLeft={sectionTimeLeft}
      setSidebarOpen={setSidebarOpen}
      setPassageSplit={setPassageSplit}
      setZoomedImage={setZoomedImage}
      setShowSubmitPopup={setShowSubmitPopup}
      goTo={goTo}
      selectAnswer={selectAnswer}
      toggleMark={toggleMark}
      clearAnswer={clearAnswer}
      moveToNextSection={moveToNextSection}
      showMoveNextPopup={showMoveNextPopup}
      setShowMoveNextPopup={setShowMoveNextPopup}
      confirmMoveToNextSection={confirmMoveToNextSection}
      confirmSubmit={doSubmit}
    />
  )
}