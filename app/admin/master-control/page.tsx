'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Student = {
  id: string
  name: string
  phone: string
  center: string
  batch: string
  ims_pin: string
  password_hash: string | null
  created_at: string
}
type BatchRow  = { id: string; name: string; created_at: string }
type CenterRow = { id: string; name: string; created_at: string }

type Tab = 'students' | 'batches' | 'centers'

export default function MasterControlPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('students')

  // ── Students ─────────────────────────────────────────
  const [students, setStudents]       = useState<Student[]>([])
  const [studLoading, setStudLoading] = useState(true)
  const [studSearch, setStudSearch]   = useState('')
  const [filterCenter, setFilterCenter] = useState('')
  const [filterBatch,  setFilterBatch]  = useState('')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', phone: '', center: '', batch: '', ims_pin: '' })
  const [studErr, setStudErr]   = useState('')
  const [studSaving, setStudSaving] = useState(false)
  const [deletingStudId, setDeletingStudId] = useState<string | null>(null)

  // ── Batches ──────────────────────────────────────────
  const [batches, setBatches]         = useState<BatchRow[]>([])
  const [batchLoading, setBatchLoading] = useState(true)
  const [newBatch, setNewBatch]       = useState('')
  const [batchErr, setBatchErr]       = useState('')
  const [batchSaving, setBatchSaving] = useState(false)
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)

  // ── Centers ──────────────────────────────────────────
  const [centers, setCenters]         = useState<CenterRow[]>([])
  const [centerLoading, setCenterLoading] = useState(true)
  const [newCenter, setNewCenter]     = useState('')
  const [centerErr, setCenterErr]     = useState('')
  const [centerSaving, setCenterSaving] = useState(false)
  const [deletingCenterId, setDeletingCenterId] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('admin')) { router.push('/admin'); return }
    fetchStudents()
    fetchBatches()
    fetchCenters()
  }, [])

  // ── Fetch ────────────────────────────────────────────
  async function fetchStudents() {
    setStudLoading(true)
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false })
    setStudents(data || [])
    setStudLoading(false)
  }
  async function fetchBatches() {
    setBatchLoading(true)
    const { data } = await supabase.from('batches').select('*').order('name')
    setBatches(data || [])
    setBatchLoading(false)
  }
  async function fetchCenters() {
    setCenterLoading(true)
    const { data } = await supabase.from('centers').select('*').order('name')
    setCenters(data || [])
    setCenterLoading(false)
  }

  // ── Students: computed lists ──────────────────────────
  const centerOptions = useMemo(() => [...new Set(students.map(s => s.center).filter(Boolean))].sort(), [students])
  const batchOptions  = useMemo(() => [...new Set(students.map(s => s.batch).filter(Boolean))].sort(), [students])

  const filteredStudents = useMemo(() => students.filter(s => {
    const q = studSearch.toLowerCase()
    const matchSearch = studSearch.length < 2 ||
      s.name?.toLowerCase().includes(q) ||
      s.phone?.includes(studSearch)
    const matchCenter = !filterCenter || s.center === filterCenter
    const matchBatch  = !filterBatch  || s.batch  === filterBatch
    return matchSearch && matchCenter && matchBatch
  }), [students, studSearch, filterCenter, filterBatch])

  // ── Students: add ────────────────────────────────────
  async function handleAddStudent() {
    setStudErr('')
    const { name, phone, center, batch, ims_pin } = newStudent
    if (!name || !phone || !center || !batch || !ims_pin) { setStudErr('All fields are required'); return }
    if (phone.length !== 10 || !/^\d+$/.test(phone))     { setStudErr('Enter a valid 10-digit phone number'); return }

    setStudSaving(true)
    const { data: existing } = await supabase.from('students').select('id').eq('phone', phone).maybeSingle()
    if (existing) { setStudErr('A student with this phone number already exists.'); setStudSaving(false); return }

    const { error } = await supabase.from('students').insert({ name, phone, center, batch, ims_pin })
    if (error) { setStudErr('Failed to add student. Try again.'); setStudSaving(false); return }

    setNewStudent({ name: '', phone: '', center: '', batch: '', ims_pin: '' })
    setShowAddStudent(false)
    setStudSaving(false)
    fetchStudents()
  }

  // ── Students: delete ─────────────────────────────────
  async function handleDeleteStudent(id: string, name: string) {
    if (!confirm(`Remove ${name} from the portal? This will also delete all their test attempts.`)) return
    setDeletingStudId(id)
    await supabase.from('students').delete().eq('id', id)
    setStudents(p => p.filter(s => s.id !== id))
    setDeletingStudId(null)
  }

  // ── Batches: add ─────────────────────────────────────
  async function handleAddBatch() {
    setBatchErr('')
    const name = newBatch.trim()
    if (!name) { setBatchErr('Batch name is required'); return }
    if (batches.some(b => b.name.toLowerCase() === name.toLowerCase())) { setBatchErr('This batch already exists'); return }

    setBatchSaving(true)
    const { error } = await supabase.from('batches').insert({ name })
    if (error) { setBatchErr('Failed to add batch.'); setBatchSaving(false); return }
    setNewBatch('')
    setBatchSaving(false)
    fetchBatches()
  }

  // ── Batches: delete ──────────────────────────────────
  async function handleDeleteBatch(id: string, name: string) {
    if (!confirm(`Remove batch "${name}"? Students assigned to this batch won't be affected.`)) return
    setDeletingBatchId(id)
    await supabase.from('batches').delete().eq('id', id)
    setBatches(p => p.filter(b => b.id !== id))
    setDeletingBatchId(null)
  }

  // ── Centers: add ─────────────────────────────────────
  async function handleAddCenter() {
    setCenterErr('')
    const name = newCenter.trim()
    if (!name) { setCenterErr('Center name is required'); return }
    if (centers.some(c => c.name.toLowerCase() === name.toLowerCase())) { setCenterErr('This center already exists'); return }

    setCenterSaving(true)
    const { error } = await supabase.from('centers').insert({ name })
    if (error) { setCenterErr('Failed to add center.'); setCenterSaving(false); return }
    setNewCenter('')
    setCenterSaving(false)
    fetchCenters()
  }

  // ── Centers: delete ──────────────────────────────────
  async function handleDeleteCenter(id: string, name: string) {
    if (!confirm(`Remove center "${name}"? Students assigned to this center won't be affected.`)) return
    setDeletingCenterId(id)
    await supabase.from('centers').delete().eq('id', id)
    setCenters(p => p.filter(c => c.id !== id))
    setDeletingCenterId(null)
  }

  // ── Shared styles ────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
    background: 'var(--bg-secondary)', whiteSpace: 'nowrap'
  }
  const tdStyle: React.CSSProperties = {
    padding: '12px 14px', fontSize: '14px', color: 'var(--text)',
    borderTop: '1px solid var(--border)'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>

      {/* ── Header ── */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin/dashboard')} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '18px' }}>←</button>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Master Control</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage students, batches & centers</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', gap: '0', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '4px', marginBottom: '24px', width: 'fit-content' }}>
          {(['students', 'batches', 'centers'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 22px', borderRadius: '8px', border: 'none', fontSize: '14px',
                fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
                background: tab === t ? 'var(--primary)' : 'transparent',
                color:      tab === t ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s'
              }}
            >
              {t === 'students' ? `Students${students.length ? ` (${students.length})` : ''}` :
               t === 'batches'  ? `Batches${batches.length  ? ` (${batches.length})`  : ''}` :
                                  `Centers${centers.length  ? ` (${centers.length})`  : ''}`}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            STUDENTS TAB
        ════════════════════════════════════════════════ */}
        {tab === 'students' && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                placeholder="🔍  Search by name or phone…"
                value={studSearch}
                onChange={e => setStudSearch(e.target.value)}
                style={{ width: '240px' }}
              />
              <select className="input" value={filterCenter} onChange={e => setFilterCenter(e.target.value)} style={{ width: '160px' }}>
                <option value="">All Centers</option>
                {centerOptions.map(c => <option key={c}>{c}</option>)}
              </select>
              <select className="input" value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ width: '150px' }}>
                <option value="">All Batches</option>
                {batchOptions.map(b => <option key={b}>{b}</option>)}
              </select>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => { setShowAddStudent(p => !p); setStudErr('') }}
                className="btn-primary"
                style={{ marginLeft: 'auto', padding: '10px 18px' }}
              >
                {showAddStudent ? '✕ Cancel' : '+ Add Student'}
              </button>
            </div>

            {/* Add Student form */}
            {showAddStudent && (
              <div className="card" style={{ marginBottom: '16px', background: 'var(--primary-light)', border: '1.5px solid var(--primary)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--primary)' }}>New Student Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  {[
                    { key: 'name',    label: 'Full Name',    placeholder: 'Full name' },
                    { key: 'phone',   label: 'Phone',        placeholder: '10-digit number' },
                    { key: 'ims_pin', label: 'IMS Pin',      placeholder: 'Enrollment pin' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input
                        className="input"
                        placeholder={f.placeholder}
                        maxLength={f.key === 'phone' ? 10 : undefined}
                        value={(newStudent as any)[f.key]}
                        onChange={e => setNewStudent(p => ({ ...p, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="label">Center</label>
                    <select className="input" value={newStudent.center} onChange={e => setNewStudent(p => ({ ...p, center: e.target.value }))}>
                      <option value="">Select center</option>
                      {centers.map(c => <option key={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Batch</label>
                    <select className="input" value={newStudent.batch} onChange={e => setNewStudent(p => ({ ...p, batch: e.target.value }))}>
                      <option value="">Select batch</option>
                      {batches.map(b => <option key={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                {studErr && <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px' }}>{studErr}</p>}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleAddStudent} disabled={studSaving} className="btn-primary">
                    {studSaving ? 'Adding…' : 'Add Student'}
                  </button>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    Student sets their own password via signup.
                  </p>
                </div>
              </div>
            )}

            {/* Students table */}
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              {studLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading students…</div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  {studSearch || filterCenter || filterBatch ? 'No students match your filters.' : 'No students yet. Add one above.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'Name', 'Phone', 'Center', 'Batch', 'IMS Pin', 'Password', 'Joined', 'Action'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...tdStyle, color: 'var(--text-muted)', width: '40px' }}>{i + 1}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '13px' }}>{s.phone}</td>
                        <td style={tdStyle}>{s.center || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={tdStyle}>{s.batch  || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '13px' }}>{s.ims_pin || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={tdStyle}>
                          {s.password_hash
                            ? <span className="badge-green">Set ✓</span>
                            : <span className="badge-yellow">Pending</span>}
                        </td>
                        <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => handleDeleteStudent(s.id, s.name)}
                            disabled={deletingStudId === s.id}
                            style={{
                              background: 'var(--danger-light)', color: 'var(--danger)',
                              border: 'none', borderRadius: '6px', padding: '5px 12px',
                              fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            {deletingStudId === s.id ? '…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            BATCHES TAB
        ════════════════════════════════════════════════ */}
        {tab === 'batches' && (
          <div style={{ maxWidth: '560px' }}>
            {/* Add batch */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>Add New Batch</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="input"
                  placeholder="e.g. CAT 2026, IPMAT 2025…"
                  value={newBatch}
                  onChange={e => setNewBatch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddBatch()}
                  style={{ flex: 1 }}
                />
                <button onClick={handleAddBatch} disabled={batchSaving} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  {batchSaving ? 'Adding…' : '+ Add'}
                </button>
              </div>
              {batchErr && <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: '8px', marginTop: '10px' }}>{batchErr}</p>}
            </div>

            {/* Batches list */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {batches.length} Batch{batches.length !== 1 ? 'es' : ''}
                </span>
              </div>
              {batchLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
              ) : batches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No batches yet. Add one above.</div>
              ) : (
                batches.map((b, i) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{b.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Added {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBatch(b.id, b.name)}
                      disabled={deletingBatchId === b.id}
                      style={{
                        background: 'var(--danger-light)', color: 'var(--danger)',
                        border: 'none', borderRadius: '6px', padding: '6px 14px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {deletingBatchId === b.id ? '…' : 'Remove'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            CENTERS TAB
        ════════════════════════════════════════════════ */}
        {tab === 'centers' && (
          <div style={{ maxWidth: '560px' }}>
            {/* Add center */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>Add New Center</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="input"
                  placeholder="e.g. IMS Surat, IMS Ahmedabad…"
                  value={newCenter}
                  onChange={e => setNewCenter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCenter()}
                  style={{ flex: 1 }}
                />
                <button onClick={handleAddCenter} disabled={centerSaving} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  {centerSaving ? 'Adding…' : '+ Add'}
                </button>
              </div>
              {centerErr && <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: '8px', marginTop: '10px' }}>{centerErr}</p>}
            </div>

            {/* Centers list */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {centers.length} Center{centers.length !== 1 ? 's' : ''}
                </span>
              </div>
              {centerLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
              ) : centers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No centers yet. Add one above.</div>
              ) : (
                centers.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Added {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCenter(c.id, c.name)}
                      disabled={deletingCenterId === c.id}
                      style={{
                        background: 'var(--danger-light)', color: 'var(--danger)',
                        border: 'none', borderRadius: '6px', padding: '6px 14px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {deletingCenterId === c.id ? '…' : 'Remove'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}