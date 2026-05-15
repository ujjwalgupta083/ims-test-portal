'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Student = { id: string; name: string; center: string; batch: string }
type Test = { id: string; title: string; schedule_time: string; duration_minutes: number; mode: string; sequence_order: number }

export default function Dashboard() {
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [now, setNow] = useState(new Date())
  const [navigating, setNavigating] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('student')
    if (!stored) { router.push('/login'); return }
    const s = JSON.parse(stored); setStudent(s); fetchTests(s.id)
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchTests = async (studentId: string) => {
    const { data: t } = await supabase.from('tests').select('*').order('sequence_order', { ascending: true })
    const { data: a } = await supabase.from('attempts').select('test_id').eq('student_id', studentId).eq('is_completed', true)
    setTests(t || [])
    setCompletedIds((a || []).map((x: { test_id: string }) => x.test_id))
  }

  // No sequential lock — just live/upcoming/completed
  const getStatus = (test: Test) => {
    if (completedIds.includes(test.id)) return 'completed'
    if (now >= new Date(test.schedule_time)) return 'live'
    return 'upcoming'
  }

  const handleClick = async (test: Test, status: string) => {
    if (status === 'upcoming') return
    setNavigating(test.id)

    if (status === 'live') {
      router.push(`/exam/${test.id}`)
      return
    }

    if (status === 'completed') {
      // Fetch attempt ID first then navigate to result
      const { data: attempt } = await supabase
        .from('attempts')
        .select('id')
        .eq('student_id', student?.id)
        .eq('test_id', test.id)
        .eq('is_completed', true)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()

      if (attempt) router.push(`/result/${test.id}?attempt=${attempt.id}`)
      else setNavigating(null)
    }
  }

  const formatTime = (t: string) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const statusConfig: Record<string, { label: string; badge: string; border: string; clickable: boolean }> = {
    live:      { label: '● Live — Start Now', badge: 'badge-green',  border: 'var(--primary)',  clickable: true  },
    completed: { label: '✓ Completed',         badge: 'badge-blue',   border: 'var(--border)',   clickable: true  },
    upcoming:  { label: '◷ Upcoming',           badge: 'badge-yellow', border: 'var(--border)',   clickable: false },
  }

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '14px' }}>IMS</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Test Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 600, fontSize: '14px' }}>{student?.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{student?.center} · {student?.batch}</p>
          </div>
          <button onClick={() => { localStorage.removeItem('student'); router.push('/') }} className="btn-ghost" style={{ fontSize: '13px' }}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>My Tests</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Tests go live at their scheduled time. Completed tests can be reviewed anytime.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tests.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No tests scheduled yet. Check back soon.</div>
          )}

          {tests.map((test) => {
            const status = getStatus(test)
            const cfg = statusConfig[status]
            const isLoading = navigating === test.id

            return (
              <div key={test.id}
                onClick={() => !isLoading && handleClick(test, status)}
                style={{
                  background: '#fff', border: `1.5px solid ${status === 'live' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '20px 24px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: cfg.clickable ? 'pointer' : 'default',
                  opacity: status === 'upcoming' ? 0.65 : 1,
                  boxShadow: status === 'live' ? '0 0 0 3px var(--primary-light)' : 'var(--shadow-sm)',
                  transition: 'all 0.15s'
                }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '5px' }}>{test.title}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {test.duration_minutes} min · {test.mode === 'timer' ? '⏱ Timer' : '⏱ Stopwatch'} · {formatTime(test.schedule_time)}
                  </p>
                </div>
                <span className={cfg.badge} style={{ whiteSpace: 'nowrap', marginLeft: '16px' }}>
                  {isLoading ? 'Loading...' : cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}