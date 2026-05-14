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
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [showReview, setShowReview] = useState(false)
  const [testTitle, setTestTitle] = useState('')

  useEffect(() => {
    if (!attemptId) return
    fetchResult()
  }, [attemptId])

  const fetchResult = async () => {
    const { data: a } = await supabase.from('attempts').select('*').eq('id', attemptId).single()
    const { data: ans } = await supabase.from('answers').select('*, questions(question_text, option_a, option_b, option_c, option_d, correct_option)').eq('attempt_id', attemptId)
    const { data: t } = await supabase.from('tests').select('title').eq('id', id).single()

    setAttempt(a)
    setAnswers(ans || [])
    setTotalQuestions(ans?.length || 0)
    setTestTitle(t?.title || '')
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  const getTotalTime = () => {
    if (!attempt) return '—'
    const diff = Math.floor((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000)
    return formatTime(diff)
  }

  const accuracy = attempt && (attempt.total_correct + attempt.total_wrong) > 0
    ? Math.round((attempt.total_correct / (attempt.total_correct + attempt.total_wrong)) * 100)
    : 0

  const maxScore = totalQuestions * 3

  if (!attempt) return (
    <main className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <p className="text-gray-400">Loading result...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#1a1a2e] p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-gray-400 text-sm mb-1">{testTitle}</p>
          <h1 className="text-3xl font-bold text-white mb-1">Test Submitted ✅</h1>
          <p className="text-gray-400 text-sm">Total time: {getTotalTime()}</p>
        </div>

        {/* Score Card */}
        <div className="bg-[#16213e] rounded-2xl p-6 mb-6 text-center border border-orange-500">
          <p className="text-gray-400 text-sm mb-1">Your Score</p>
          <p className="text-6xl font-bold text-orange-400 mb-1">{attempt.score}</p>
          <p className="text-gray-400 text-sm">out of {maxScore} marks</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#16213e] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{attempt.total_correct}</p>
            <p className="text-gray-400 text-xs mt-1">Correct</p>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{attempt.total_wrong}</p>
            <p className="text-gray-400 text-xs mt-1">Wrong</p>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{attempt.total_unattempted}</p>
            <p className="text-gray-400 text-xs mt-1">Skipped</p>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{accuracy}%</p>
            <p className="text-gray-400 text-xs mt-1">Accuracy</p>
          </div>
        </div>

        {/* Time Per Question */}
        <div className="bg-[#16213e] rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">⏱ Time Spent Per Question</h2>
          <div className="space-y-2">
            {answers.map((a, i) => {
              const maxTime = Math.max(...answers.map(x => x.time_spent_seconds), 1)
              const pct = Math.round((a.time_spent_seconds / maxTime) * 100)
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs w-6">Q{i + 1}</span>
                  <div className="flex-1 bg-[#0f3460] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${a.is_correct ? 'bg-green-500' : a.selected_option ? 'bg-red-500' : 'bg-gray-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs w-10 text-right">{formatTime(a.time_spent_seconds)}</span>
                  <span className="text-xs">
                    {a.is_correct ? '✅' : a.selected_option ? '❌' : '⬜'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Question Review Toggle */}
        <button
          onClick={() => setShowReview(!showReview)}
          className="w-full bg-[#16213e] hover:bg-[#1a2a50] text-white py-3 rounded-xl font-semibold mb-4 border border-gray-700"
        >
          {showReview ? 'Hide' : 'Show'} Question-wise Review ▾
        </button>

        {showReview && (
          <div className="space-y-4 mb-6">
            {answers.map((a, i) => (
              <div key={a.id} className={`bg-[#16213e] rounded-xl p-5 border-l-4 ${a.is_correct ? 'border-green-500' : a.selected_option ? 'border-red-500' : 'border-gray-600'}`}>
                <p className="text-white font-medium mb-3">Q{i + 1}. {a.questions?.question_text}</p>
                <div className="grid grid-cols-2 gap-2">
                  {['a', 'b', 'c', 'd'].map(opt => {
                    const isCorrect = a.questions?.correct_option === opt
                    const isSelected = a.selected_option === opt
                    return (
                      <div key={opt} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2
                        ${isCorrect ? 'bg-green-500/20 border border-green-500 text-green-300' :
                          isSelected && !isCorrect ? 'bg-red-500/20 border border-red-500 text-red-300' :
                          'bg-[#0f3460] text-gray-400'}`}>
                        <span className="font-bold">{opt.toUpperCase()}.</span>
                        {a.questions?.[`option_${opt}` as keyof typeof a.questions]}
                        {isCorrect && <span className="ml-auto">✅</span>}
                        {isSelected && !isCorrect && <span className="ml-auto">❌</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-gray-400 text-xs mt-2">Time spent: {formatTime(a.time_spent_seconds)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold"
        >
          Back to Dashboard
        </button>

      </div>
    </main>
  )
}