import { useEffect, useMemo, useRef, useState } from 'react'

const ANGLE_CLASSES = {
  ADD: 'angle-add',
  'PUSH BACK': 'angle-pushback',
  EXTEND: 'angle-extend',
  RELATE: 'angle-relate',
  RIFF: 'angle-riff',
}

function CommentRow({ comment, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.text)
  const [copied, setCopied] = useState(false)

  const startEdit = () => {
    setDraft(comment.text)
    setEditing(true)
  }

  const save = () => {
    setEditing(false)
    if (draft.trim() !== comment.text) onSave(draft.trim())
  }

  const copy = async () => {
    await navigator.clipboard.writeText(comment.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="comment">
      <span className={`angle-badge ${ANGLE_CLASSES[comment.angle] || ''}`}>
        {comment.angle}
      </span>
      {editing ? (
        <div className="comment-edit">
          <textarea
            autoFocus
            value={draft}
            rows={Math.max(2, Math.ceil(draft.length / 80))}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <div className="edit-actions">
            <button className="btn btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <span className="hint">⌘↵ save · esc cancel</span>
          </div>
        </div>
      ) : (
        <>
          <p className="comment-text" onClick={startEdit} title="Click to edit">
            {comment.text}
          </p>
          <div className="comment-actions">
            <button className="icon-btn" onClick={copy} title="Copy comment">
              {copied ? '✓' : '⧉'}
            </button>
            <button className="icon-btn" onClick={startEdit} title="Edit comment">
              ✎
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PostCard({ post, onSaveComment }) {
  return (
    <article className="post-card">
      <header className="post-header">
        <div>
          <span className="post-id">#{post.id}</span>
          <span className="author">{post.author_name}</span>
        </div>
        <a
          className="post-link"
          href={post.post_url}
          target="_blank"
          rel="noreferrer"
        >
          View on LinkedIn ↗
        </a>
      </header>
      <p className="summary">{post.summary}</p>
      <div className="comments">
        {post.comments.map((c, i) => (
          <CommentRow
            key={i}
            comment={c}
            onSave={(text) => onSaveComment(post.id, i, text)}
          />
        ))}
      </div>
    </article>
  )
}

const STORAGE_KEY = 'feed-runner-comments'

export default function App() {
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  // true when the dev-server API is available (local dev); false on static
  // hosting (e.g. Vercel), where edits live in memory and Download exports them
  const [canPersist, setCanPersist] = useState(true)
  const [filter, setFilter] = useState('')
  const [angleFilter, setAngleFilter] = useState('ALL')
  const fileInputRef = useRef(null)

  const validatePosts = (data) => {
    if (!Array.isArray(data)) return 'Expected a JSON array of posts.'
    for (const p of data) {
      if (typeof p.id === 'undefined' || !Array.isArray(p.comments))
        return 'Each post needs an "id" and a "comments" array.'
      for (const c of p.comments)
        if (typeof c.text !== 'string')
          return 'Each comment needs a "text" string.'
    }
    return null
  }

  const onUpload = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-uploading the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(reader.result)
      } catch {
        alert(`${file.name} is not valid JSON.`)
        return
      }
      const problem = validatePosts(data)
      if (problem) {
        alert(`${file.name}: ${problem}`)
        return
      }
      const warning = canPersist
        ? `Load ${data.length} posts from ${file.name}? This overwrites comments.json.`
        : `Load ${data.length} posts from ${file.name}? This replaces the data saved in this browser.`
      if (!window.confirm(warning)) return
      setError(null)
      setAngleFilter('ALL')
      persist(data)
    }
    reader.readAsText(file)
  }

  const onDownload = () => {
    const blob = new Blob([JSON.stringify(posts, null, 2) + '\n'], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'comments.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/comments')
        const type = r.headers.get('content-type') || ''
        // Static hosts answer unknown paths with index.html (200 + text/html),
        // so require a JSON response before trusting the API
        if (r.ok && type.includes('json')) {
          setPosts(await r.json())
          return
        }
        throw new Error('no api')
      } catch {
        setCanPersist(false)
      }
      // Static hosting: a previous session may have uploaded/edited data,
      // stored in localStorage since there is no API to write to
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          setPosts(JSON.parse(stored))
          return
        }
      } catch {
        // ignore corrupt/unavailable storage, fall back to bundled data
      }
      try {
        const r = await fetch('/comments.json')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setPosts(await r.json())
      } catch (e) {
        setError(`Could not load comments data: ${e}`)
      }
    }
    load()
  }, [])

  const persist = async (next) => {
    setPosts(next)
    if (!canPersist) {
      // static hosting: keep edits across refreshes via localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (e) {
        setError(`Could not store data in this browser: ${e}`)
      }
      return
    }
    setSaveState('saving')
    try {
      const res = await fetch('/api/comments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch (e) {
      setSaveState('error')
      setError(`Save failed: ${e}`)
    }
  }

  const onSaveComment = (postId, commentIndex, text) => {
    const next = posts.map((p) =>
      p.id === postId
        ? {
            ...p,
            comments: p.comments.map((c, i) =>
              i === commentIndex ? { ...c, text } : c
            ),
          }
        : p
    )
    persist(next)
  }

  const angles = useMemo(() => {
    if (!posts) return []
    const set = new Set()
    posts.forEach((p) => p.comments.forEach((c) => set.add(c.angle)))
    return ['ALL', ...set]
  }, [posts])

  const visible = useMemo(() => {
    if (!posts) return []
    const q = filter.toLowerCase()
    return posts
      .filter(
        (p) =>
          !q ||
          p.author_name.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.comments.some((c) => c.text.toLowerCase().includes(q))
      )
      .map((p) =>
        angleFilter === 'ALL'
          ? p
          : { ...p, comments: p.comments.filter((c) => c.angle === angleFilter) }
      )
  }, [posts, filter, angleFilter])

  if (error && !posts) return <div className="status error">{error}</div>
  if (!posts) return <div className="status">Loading…</div>

  return (
    <div className="app">
      <header className="topbar">
        <h1>Feed Runner</h1>
        <span className="count">{posts.length} posts</span>
        <input
          className="search"
          placeholder="Search author, summary, comments…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="angle-filters">
          {angles.map((a) => (
            <button
              key={a}
              className={`chip ${angleFilter === a ? 'chip-active' : ''}`}
              onClick={() => setAngleFilter(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="file-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onUpload}
          />
          <button
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            title="Load posts from a JSON file (overwrites comments.json)"
          >
            ⤒ Upload JSON
          </button>
          <button
            className="btn"
            onClick={onDownload}
            title="Download the current data as JSON"
          >
            ⤓ Download
          </button>
        </div>
        <span className={`save-indicator save-${saveState}`}>
          {!canPersist && <span title="Static hosting: data is saved in this browser only. Use Download to export.">local only</span>}
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved ✓'}
          {saveState === 'error' && 'Save failed'}
        </span>
      </header>
      <main className="feed">
        {visible.map((p) => (
          <PostCard key={p.id} post={p} onSaveComment={onSaveComment} />
        ))}
        {visible.length === 0 && (
          <div className="status">No posts match the filter.</div>
        )}
      </main>
    </div>
  )
}
