import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '18px' }}>IMS</span>
          </div>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Test Portal</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Trusted for Success</p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Welcome</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Sign in to access your tests and performance dashboard</p>
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
            Student Login →
          </button>
        </Link>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '24px' }}>IMS Learning Resources · Surat</p>
    </main>
  )
}