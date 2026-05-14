'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Question = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; difficulty: string; sequence_order: number }
type Test = { id: string; title: string; duration_minutes: number; mode: string; marking_correct: number; marking_wrong: number }
type Student = { id: string; name: string }

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
  const [timeLeft, setTimeLeft] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const questionStartTime = useRef<number>(Date.now())
  const timeSpent = useRef<Record<string, number>>({})

  useEffect(() => {
    const s = localStorage.getItem('student')
    if (!s) { router.push('/login'); return }
    setStudent(JSON.parse(s))
    fetchExam()
  }, [])

  const fetchExam = async () => {
    const { data: t } = await supabase.from('tests').select('*').eq('id', id).single()
    const { data: q } = await supabase.from('questions').select('*').eq('test_id', id).order('sequence_order')
    setTest(t)
    setQuestions(q || [])
    if (t) setTimeLeft(t.duration_minutes * 60)
  }

  const startExam = async () => {
    if (!student || !test) return
    const { data } = await supabase.from('attempts').insert([{
      student_id: student.id, test_id: id, started_at: new Date().toISOString()
    }]).select().single()
    setAttemptId(data.id)
    setStarted(true)
    questionStartTime.current = Date.now()
  }

  // Timer
  useEffect(() => {
    if (!started || submitted) return
    const interval = setInterval(() => {
      if (test?.mode === 'timer') {
        setTimeLeft(t => {
          if (t <= 1) { handleSubmit(); return 0 }
          return t - 1
        })
      } else {
        setElapsed(e => e + 1)
      }
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
  }

  const selectAnswer = (qid: string, opt: string) => {
    setAnswers(prev => ({ ...prev, [qid]: opt }))
  }

  const toggleMark = (qid: string) => {
    setMarked(prev => {
      const next = new Set(prev)
      next.has(qid) ? next.delete(qid) : next.add(qid)
      return next
    })
  }

  const handleSubmit = async () => {
    if (submitted) return
    if (questions[current]) recordTime(questions[current].id)
    setSubmitted(true)

    let score = 0, correct = 0, wrong = 0, unattempted = 0
    const answerRows = questions.map(q => {
      const selected = answers[q.id] || null
      const isCorrect = selected === q.correct_option
      if (!selected) unattempted++
      else if (isCorrect) { correct++; score += test?.marking_correct || 3 }
      else { wrong++; score += test?.marking_wrong || -1 }
      return {
        attempt_id: attemptId,
        question_id: q.id,
        selected_option: selected,
        is_correct: selected ? isCorrect : null,
        time_spent_seconds: timeSpent.current[q.id] || 0,
        is_marked_for_review: marked.has(q.id)
      }
    })

    await supabase.from('answers').insert(answerRows)
    await supabase.from('attempts').update({
      submitted_at: new Date().toISOString(),
      score, total_correct: correct, total_wrong: wrong,
      total_unattempted: unattempted, is_completed: true
    }).eq('id', attemptId)

    router.push(`/result/${id}?attempt=${attemptId}`)
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const getQStatus = (q: Question) => {
    if (answers[q.id] && marked.has(q.id)) return 'answered-marked'
    if (answers[q.id]) return 'answered'
    if (marked.has(q.id)) return 'marked'
    return 'unanswered'
  }

  const qStatusStyle: Record<string, string> = {
    'answered': 'bg-green-500 text-white',
    'answered-marked': 'bg-purple-500 text-white',
    'marked': 'bg-orange-400 text-white',
    'unanswered': 'bg-[#0f3460] text-gray-300'
  }

  const q = questions[current]

  // Pre-exam screen
  if (!started) return (
    <main className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="bg-[#16213e] p-8 rounded-2xl max-w-md w-full text-center shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">{test?.title}</h1>
        <div className="grid grid-cols-3 gap-4 my-6">
          <div className="bg-[#0f3460] rounded-lg p-3">
            <p className="text-orange-400 font-bold text-xl">{questions.length}</p>
            <p className="text-gray-400 text-xs">Questions</p>
          </div>
          <div className="bg-[#0f3460] rounded-lg p-3">
            <p className="text-orange-400 font-bold text-xl">{test?.duration_minutes}</p>
            <p className="text-gray-400 text-xs">Minutes</p>
          </div>
          <div className="bg-[#0f3460] rounded-lg p-3">
            <p className="text-orange-400 font-bold text-xl">+{test?.marking_correct}/{test?.marking_wrong}</p>
            <p className="text-gray-400 text-xs">Marking</p>
          </div>
        </div>
        <div className="text-left bg-[#0f3460] rounded-lg p-4 mb-6 space-y-1 text-sm text-gray-300">
          <p>✅ Answered — Green</p>
          <p>🟣 Answered + Marked — Purple</p>
          <p>🟠 Marked for Review — Orange</p>
          <p>⬜ Not Answered — Grey</p>
        </div>
        <p className="text-gray-400 text-sm mb-4">Once you begin, the timer starts and cannot be paused.</p>
        <button onClick={startExam} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-bold text-lg">
          Begin Test ▶
        </button>
      </div>
    </main>
  )

  if (!q) return null

  return (
    <main className="min-h-screen bg-[#1a1a2e] flex flex-col">

      {/* Top Bar */}
      <div className="bg-[#16213e] px-6 py-3 flex justify-between items-center border-b border-gray-700">
        <h1 className="text-white font-bold">{test?.title}</h1>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-400">{test?.mode === 'timer' ? 'Time Left' : 'Time Elapsed'}</p>
            <p className={`font-mono font-bold text-xl ${test?.mode === 'timer' && timeLeft < 300 ? 'text-red-400' : 'text-orange-400'}`}>
              {test?.mode === 'timer' ? formatTime(timeLeft) : formatTime(elapsed)}
            </p>
          </div>
          <button onClick={() => { if (confirm('Submit the test?')) handleSubmit() }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-semibold text-sm">
            Submit Test
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Question Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">

            {/* Question */}
            <div className="bg-[#16213e] rounded-xl p-6 mb-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-orange-400 font-semibold">Question {current + 1} of {questions.length}</span>
                <span className={`text-xs px-2 py-1 rounded ${q.difficulty === 'easy' ? 'bg-green-900 text-green-300' : q.difficulty === 'hard' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                  {q.difficulty}
                </span>
              </div>
              <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {['a', 'b', 'c', 'd'].map(opt => (
                <div key={opt}
                  onClick={() => selectAnswer(q.id, opt)}
                  className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${answers[q.id] === opt ? 'border-orange-500 bg-orange-500/10' : 'border-transparent bg-[#16213e] hover:border-gray-600'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${answers[q.id] === opt ? 'bg-orange-500 text-white' : 'bg-[#0f3460] text-gray-300'}`}>
                      {opt.toUpperCase()}
                    </span>
                    <p className="text-white mt-1">{q[`option_${opt}` as keyof Question]}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button onClick={() => { setAnswers(p => { const n = { ...p }; delete n[q.id]; return n }) }}
                className="border border-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-700">
                ✕ Clear
              </button>
              <button onClick={() => toggleMark(q.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${marked.has(q.id) ? 'bg-orange-500 text-white' : 'border border-orange-500 text-orange-400'}`}>
                ⚑ {marked.has(q.id) ? 'Marked' : 'Mark for Review'}
              </button>
              <div className="flex gap-2 ml-auto">
                {current > 0 && (
                  <button onClick={() => goTo(current - 1)}
                    className="border border-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700">
                    ← Prev
                  </button>
                )}
                {current < questions.length - 1 && (
                  <button onClick={() => goTo(current + 1)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    Save & Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Question Palette */}
        <div className="w-64 bg-[#16213e] border-l border-gray-700 p-4 overflow-y-auto">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Question Palette</p>

          {/* Legend */}
          <div className="space-y-1 mb-4 text-xs">
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-green-500 inline-block"></span><span className="text-gray-400">Answered</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-purple-500 inline-block"></span><span className="text-gray-400">Answered + Marked</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-orange-400 inline-block"></span><span className="text-gray-400">Marked for Review</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-[#0f3460] inline-block"></span><span className="text-gray-400">Not Answered</span></div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => goTo(i)}
                className={`w-9 h-9 rounded text-xs font-bold transition-all ${qStatusStyle[getQStatus(q)]} ${i === current ? 'ring-2 ring-white' : ''}`}>
                {i + 1}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-4 space-y-1 text-xs text-gray-400 border-t border-gray-700 pt-3">
            <p>✅ Answered: {Object.keys(answers).length}</p>
            <p>⬜ Unanswered: {questions.length - Object.keys(answers).length}</p>
            <p>⚑ Marked: {marked.size}</p>
          </div>
        </div>

      </div>
    </main>
  )
}