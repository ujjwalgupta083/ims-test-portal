'use client'
import { useState, useEffect } from 'react'
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

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', phone: '', center: '', batch: '',
    ims_pin: '', password: '', confirm_password: ''
  })
  const [centers, setCenters] = useState<string[]>([])
  const [batches, setBatches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function fetchOptions() {
      const [{ data: c }, { data: b }] = await Promise.all([
        supabase.from('centers').select('name').order('name'),
        supabase.from('batches').select('name').order('name'),
      ])
      setCenters((c || []).map((r: any) => r.name))
      setBatches((b || []).map((r: any) => r.name))
    }
    fetchOptions()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSignup = async () => {
    setError('')
    const { name, phone, center, batch, ims_pin, password, confirm_password } = form

    if (!name || !phone || !center || !batch || !ims_pin || !password || !confirm_password) {
      setError('Please fill all fields'); return
    }
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      setError('Enter a valid 10-digit phone number'); return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters'); return
    }
    if (password !== confirm_password) {
      setError('Passwords do not match'); return
    }

    setLoading(true)

    // Check if phone already registered
    const { data: existing } = await supabase
      .from('students')
      .select('id, password_hash')
      .eq('phone', phone)
      .maybeSingle()

    if (existing?.password_hash) {
      setError('This phone number is already registered. Please login.')
      setLoading(false); return
    }

    const hash = await hashPassword(password)

    if (existing) {
      // Student pre-added by admin (no password yet) — update their record
      const { error: upErr } = await supabase.from('students').update({
        name, center, batch, ims_pin, password_hash: hash
      }).eq('id', existing.id)
      if (upErr) { setError('Something went wrong. Try again.'); setLoading(false); return }
    } else {
      // Brand new student
      const { error: insErr } = await supabase.from('students').insert({
        name, phone, center, batch, ims_pin, password_hash: hash
      })
      if (insErr) { setError('Something went wrong. Try again.'); setLoading(false); return }
    }

    setLoading(false)
    setSuccess(true)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <div className="card" style={{ padding: '40px 32px' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700 }}>Password Created Successfully!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>
              You can now log in with your phone number and password.
            </p>
            <button onClick={() => router.push('/login')} className="btn-primary" style={{ padding: '12px', fontSize: '15px', width: '100%' }}>
              Go to Login →
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Signup form ─────────────────────────────────────────────────────────────
  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>IMS</span>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700 }}>Test Portal</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Create your account to get started</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div>
              <label className="label">Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" className="input" />
            </div>

            <div>
              <label className="label">Mobile Number</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile number" maxLength={10} className="input" />
            </div>

            <div>
              <label className="label">IMS Pin</label>
              <input name="ims_pin" value={form.ims_pin} onChange={handleChange} placeholder="Your IMS enrollment pin" className="input" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">IMS Center</label>
                <select name="center" value={form.center} onChange={handleChange} className="input">
                  <option value="">Select center</option>
                  {centers.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Batch</label>
                <select name="batch" value={form.batch} onChange={handleChange} className="input">
                  <option value="">Select batch</option>
                  {batches.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px' }} />

            <div>
              <label className="label">Create Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min. 6 characters)</span></label>
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Create a strong password" className="input" />
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="input"
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '10px 14px', borderRadius: '8px', margin: 0 }}>
                {error}
              </p>
            )}

            <button onClick={handleSignup} disabled={loading} className="btn-primary" style={{ padding: '13px', fontSize: '15px', marginTop: '4px' }}>
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Already have an account?{' '}
              <span
                onClick={() => router.push('/login')}
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Login
              </span>
            </p>

          </div>
        </div>

      </div>
    </main>
  )
}