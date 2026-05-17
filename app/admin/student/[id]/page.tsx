'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

type Student = { id: string; name: string; phone: string; center: string; batch: string; created_at: string }
type Attempt = { id: string; test_id: string; score: number; total_correct: number; total_wrong: number; total_unattempted: number; started_at: string; submitted_at: string; tab_switches: number; tests: { title: string; marking_correct: number; duration_minutes: number } }

export default function StudentProfile() {
  const router = useRouter()
  const { id } = useParams()
  const searchParams = useSearchParams()
  const fromTest = searchParams.get('fromTest')
  const [student, setStudent] = useState<Student | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: s } = await supabase.from('students').select('*').eq('id', id).single()
    const { data: a } = await supabase.from('attempts').select('*, tests(title, marking_correct, duration_minutes)').eq('student_id', id).eq('is_completed', true).order('submitted_at', { ascending: false })
    setStudent(s); setAttempts(a || [])
  }

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const totalTime = (a: Attempt) => Math.floor((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)
  const accuracy = (a: Attempt) => {
    const att = a.total_correct + a.total_wrong
    return att > 0 ? Math.round((a.total_correct / att) * 100) : 0
  }
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0
  const avgAcc = attempts.length ? Math.round(attempts.reduce((s, a) => s + accuracy(a), 0) / attempts.length) : 0

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push(fromTest ? `/admin/results/${fromTest}` : '/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
        <span style={{ color: 'var(--border-strong)' }}>|</span>
        <span style={{ fontWeight: 700 }}>Student Profile</span>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Student Info */}
        <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '52px', height: '52px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '20px' }}>
              {student?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '18px' }}>{student?.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{student?.center} · {student?.batch}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>📱 {student?.phone}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Joined {new Date(student?.created_at || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { v: attempts.length, l: 'Tests Completed', c: 'var(--primary)' },
            { v: `${avgScore}`, l: 'Avg Score', c: 'var(--success)' },
            { v: `${avgAcc}%`, l: 'Avg Accuracy', c: 'var(--warning)' },
          ].map(k => (
            <div key={k.l} className="card" style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ fontSize: '28px', fontWeight: 700, color: k.c }}>{k.v}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{k.l}</p>
            </div>
          ))}
        </div>

        {/* Test History */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 700, fontSize: '15px' }}>Test History</h3>
          </div>
          {attempts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No tests completed yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['Test', 'Score', 'Correct', 'Wrong', 'Accuracy', 'Time', 'Tab Switches', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attempts.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => router.push(`/result/${a.test_id}?attempt=${a.id}&from=admin&sid=${id}`)}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{a.tests?.title}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ color: 'var(--primary)', fontWeight: 700 }}>{a.score}</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--success)' }}>{a.total_correct}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--danger)' }}>{a.total_wrong}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontWeight: 600, color: accuracy(a) >= 70 ? 'var(--success)' : accuracy(a) >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{accuracy(a)}%</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{fmt(totalTime(a))}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: a.tab_switches > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{a.tab_switches || 0}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}