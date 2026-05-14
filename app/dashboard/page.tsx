'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Student = { id: string; name: string; center: string; batch: string }
type Test = {
  id: string; title: string; schedule_time: string;
  duration_minutes: number; mode: string; sequence_order: number
}

export default function Dashboard() {
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const stored = localStorage.getItem('student')
    if (!stored) { router.push('/login'); return }
    const s = JSON.parse(stored)
    setStudent(s)
    fetchTests(s.id)

    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchTests = async (studentId: string) => {
    const { data: testsData } = await supabase
      .from('tests')
      .select('*')
      .order('sequence_order', { ascending: true })

    const { data: attemptsData } = await supabase
      .from('attempts')
      .select('test_id')
      .eq('student_id', studentId)
      .eq('is_completed', true)

    setTests(testsData || [])
    setCompletedIds((attemptsData || []).map((a: { test_id: string }) => a.test_id))
  }

  const getStatus = (test: Test, index: number) => {
    const scheduleTime = new Date(test.schedule_time)
    const isCompleted = completedIds.includes(test.id)
    const isLive = now >= scheduleTime
    const prevCompleted = index === 0 || completedIds.includes(tests[index - 1]?.id)

    if (isCompleted) return 'completed'
    if (!isLive) return 'upcoming'
    if (!prevCompleted) return 'locked'
    return 'live'
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500 text-white'
      case 'completed': return 'bg-blue-500 text-white'
      case 'upcoming': return 'bg-yellow-500 text-black'
      case 'locked': return 'bg-gray-600 text-gray-300'
      default: return ''
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live': return '🟢 Live — Start Now'
      case 'completed': return '✅ Completed'
      case 'upcoming': return '🕐 Upcoming'
      case 'locked': return '🔒 Locked'
      default: return ''
    }
  }

  const handleTestClick = (test: Test, status: string) => {
    if (status === 'live') router.push(`/exam/${test.id}`)
    if (status === 'completed') router.push(`/result/${test.id}`)
  }

  const formatTime = (t: string) => new Date(t).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  return (
    <main className="min-h-screen bg-[#1a1a2e] p-6">

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome, {student?.name} 👋</h1>
          <p className="text-gray-400 text-sm mt-1">{student?.center} · {student?.batch}</p>
        </div>
        <button
          onClick={() => { localStorage.removeItem('student'); router.push('/login') }}
          className="text-gray-400 hover:text-white text-sm border border-gray-600 px-4 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Test List */}
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-gray-400 text-sm uppercase tracking-wider mb-4">Available Tests</h2>

        {tests.length === 0 && (
          <div className="bg-[#16213e] rounded-xl p-8 text-center text-gray-500">
            No tests scheduled yet. Check back soon.
          </div>
        )}

        {tests.map((test, index) => {
          const status = getStatus(test, index)
          return (
            <div
              key={test.id}
              onClick={() => handleTestClick(test, status)}
              className={`bg-[#16213e] rounded-xl p-6 flex justify-between items-center
                ${status === 'live' ? 'cursor-pointer hover:bg-[#1a2a50] border border-green-500' : ''}
                ${status === 'completed' ? 'cursor-pointer hover:bg-[#1a2a50]' : ''}
                ${status === 'locked' || status === 'upcoming' ? 'opacity-60' : ''}
              `}
            >
              <div>
                <h3 className="text-white font-semibold text-lg">{test.title}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {test.duration_minutes} min · {test.mode === 'timer' ? '⏱ Timer' : '⏱ Stopwatch'} · Scheduled: {formatTime(test.schedule_time)}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusStyle(status)}`}>
                {getStatusLabel(status)}
              </span>
            </div>
          )
        })}
      </div>

    </main>
  )
}