import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { messageAPI } from '../api'
import { useAuth } from '../context/AuthContext'

function timeAgo(dt) {
  const s = Math.floor((Date.now() - new Date(dt)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(dt).toLocaleDateString()
}

function ThreadList({ threads, activeId, onSelect }) {
  return (
    <div style={{ borderRight: '1.5px solid var(--border)', overflowY: 'auto', height: '100%' }}>
      {threads.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: '0.88rem' }}>No conversations yet</div>
      ) : threads.map(t => (
        <div
          key={t.partner_id}
          onClick={() => onSelect(t.partner_id, t.partner_username)}
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            background: t.partner_id === activeId ? 'rgba(224,61,0,0.06)' : '#fff',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (t.partner_id !== activeId) e.currentTarget.style.background = 'var(--bg)' }}
          onMouseLeave={e => { if (t.partner_id !== activeId) e.currentTarget.style.background = '#fff' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{t.partner_username}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.unread > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.unread}</span>
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{timeAgo(t.last_message.created_at)}</span>
            </div>
          </div>
          {t.last_message.listing_title && (
            <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginBottom: 2 }}>re: {t.last_message.listing_title}</div>
          )}
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.last_message.body}
          </div>
        </div>
      ))}
    </div>
  )
}

function MessagePane({ partnerId, partnerUsername }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const [msgError, setMsgError] = useState('')
  const load = () => messageAPI.thread(partnerId).then(r => { setMessages(r.data); setMsgError('') }).catch(() => setMsgError('Could not load messages.'))

  useEffect(() => {
    if (!partnerId) return
    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [partnerId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      const res = await messageAPI.send(partnerId, { body })
      setMessages(prev => [...prev, res.data])
      setBody('')
    } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1.5px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {partnerUsername}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgError && <div className="alert alert-error">{msgError}</div>}
        {messages.map(m => {
          const mine = m.sender === user.id
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%',
                background: mine ? 'var(--accent)' : 'var(--bg3)',
                color: mine ? '#fff' : 'var(--text)',
                borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
                fontSize: '0.88rem',
                lineHeight: 1.5,
              }}>
                {m.listing_title && (
                  <div style={{ fontSize: '0.7rem', opacity: 0.75, marginBottom: 4 }}>re: {m.listing_title}</div>
                )}
                {m.body}
                <div style={{ fontSize: '0.65rem', opacity: 0.65, marginTop: 4, textAlign: 'right' }}>{timeAgo(m.created_at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} style={{ padding: '12px 20px', borderTop: '1.5px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !body.trim()}>Send</button>
      </form>
    </div>
  )
}

export default function Inbox() {
  const { partnerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(partnerId ? parseInt(partnerId) : null)
  const [activeUsername, setActiveUsername] = useState('')

  // Redirect away if someone tries to open a conversation with themselves
  useEffect(() => {
    if (partnerId && user && parseInt(partnerId) === user.id) {
      navigate('/inbox', { replace: true })
    }
  }, [partnerId, user])

  useEffect(() => {
    messageAPI.threads().then(r => {
      setThreads(r.data)
      if (partnerId && user && parseInt(partnerId) !== user.id) {
        const t = r.data.find(t => t.partner_id === parseInt(partnerId))
        if (t) setActiveUsername(t.partner_username)
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleSelect = (id, username) => {
    setActiveId(id)
    setActiveUsername(username)
    navigate(`/inbox/${id}`)
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="container" style={{ maxWidth: 900, paddingTop: 36 }}>
        <h1 style={{ marginBottom: 24 }}>Inbox</h1>
        <div className="card inbox-grid">
          <ThreadList threads={threads} activeId={activeId} onSelect={handleSelect} />
          {activeId ? (
            <MessagePane partnerId={activeId} partnerUsername={activeUsername} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '0.9rem' }}>
              Select a conversation to read messages
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
