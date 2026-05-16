'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'ims_salt_2025')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    if (!phone || !password) { setError('Please enter your phone number and password'); return }
    if (phone.length !== 10) { setError('Enter a valid 10-digit phone number'); return }

    setLoading(true)

    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()

    if (!student) {
      setError('Phone number not registered. Please sign up first.')
      setLoading(false); return
    }

    if (!student.password_hash) {
      setError('Account not set up yet. Please sign up to create a password.')
      setLoading(false); return
    }

    const hash = await hashPassword(password)
    if (student.password_hash !== hash) {
      setError('Incorrect password. Please try again.')
      setLoading(false); return
    }

    localStorage.setItem('student', JSON.stringify(student))
    router.push('/dashboard')
  }

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>IMS</span>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700 }}>Test Portal</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Login to access your tests</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <label className="label">Mobile Number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="input"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '10px 14px', borderRadius: '8px', margin: 0 }}>
                {error}
              </p>
            )}

            <button onClick={handleLogin} disabled={loading} className="btn-primary" style={{ padding: '13px', fontSize: '15px', marginTop: '4px' }}>
              {loading ? 'Please wait...' : 'Login →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              New student?{' '}
              <span
                onClick={() => router.push('/signup')}
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Create Account
              </span>
            </p>

          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
          <a href="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Go Back to Home Page</a>
        </p>

      </div>
    </main>
  )
}