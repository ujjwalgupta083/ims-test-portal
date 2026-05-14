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
    setTests(t || []); setCompletedIds((a || []).map((x: { test_id: string }) => x.test_id))
  }

  const getStatus = (test: Test, index: number) => {
    if (completedIds.includes(test.id)) return 'completed'
    if (now < new Date(test.schedule_time)) return 'upcoming'
    if (index > 0 && !completedIds.includes(tests[index - 1]?.id)) return 'locked'
    return 'live'
  }

  const formatTime = (t: string) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>

      {/* Top Nav */}
      <nav style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '13px' }}>IMS</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Test Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 600, fontSize: '14px' }}>{student?.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{student?.center} · {student?.batch}</p>
          </div>
          <button onClick={() => { localStorage.removeItem('student'); router.push('/login') }} className="btn-ghost" style={{ fontSize: '13px' }}>Logout</button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>My Tests</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Complete tests in order. Next test unlocks after you submit the previous one.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tests.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              No tests scheduled yet. Check back soon.
            </div>
          )}

          {tests.map((test, i) => {
            const status = getStatus(test, i)
            const statusConfig: Record<string, { label: string; badge: string; clickable: boolean }> = {
              live:      { label: '● Live — Start Now', badge: 'badge-green', clickable: true },
              completed: { label: '✓ Completed',        badge: 'badge-blue',  clickable: true },
              upcoming:  { label: '◷ Upcoming',          badge: 'badge-yellow', clickable: false },
              locked:    { label: '🔒 Locked',            badge: 'badge-red',   clickable: false },
            }
            const cfg = statusConfig[status]

            return (
              <div key={test.id}
                onClick={() => cfg.clickable && (status === 'live' ? router.push(`/exam/${test.id}`) : router.push(`/result/${test.id}`))}
                style={{
                  background: 'var(--bg)',
                  border: `1px solid ${status === 'live' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: cfg.clickable ? 'pointer' : 'default',
                  opacity: status === 'locked' ? 0.5 : 1,
                  boxShadow: status === 'live' ? '0 0 0 3px var(--primary-light)' : 'var(--shadow-sm)',
                  transition: 'all 0.15s'
                }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{test.title}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>#{i + 1}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {test.duration_minutes} min · {test.mode === 'timer' ? '⏱ Timer' : '⏱ Stopwatch'} · {formatTime(test.schedule_time)}
                  </p>
                </div>
                <span className={cfg.badge} style={{ whiteSpace: 'nowrap' }}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}