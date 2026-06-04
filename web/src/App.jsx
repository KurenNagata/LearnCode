import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

// ── 簡易 Markdown レンダラー ──────────────────────────────────
function renderInline(text) {
  const parts = text.split(/`([^`]+)`/)
  return parts.map((part, i) =>
    i % 2 === 0
      ? part
      : <code key={i} style={s.inlineCode}>{part}</code>
  )
}

function renderMd(raw) {
  if (!raw) return null
  const blocks = raw.split(/```(\w*)\n?([\s\S]*?)```/g)
  // blocks: [text, lang, code, text, lang, code, ...]
  const out = []
  blocks.forEach((chunk, i) => {
    const kind = i % 3
    if (kind === 1) return // language identifier
    if (kind === 2) {
      out.push(
        <pre key={i} style={s.codeBlock}><code>{chunk.trimEnd()}</code></pre>
      )
      return
    }
    // plain text block
    const lines = chunk.split('\n')
    let tableRows = []
    lines.forEach((line, j) => {
      const isTableRow = line.trim().startsWith('|')
      if (isTableRow) {
        tableRows.push(line)
        return
      }
      if (tableRows.length) {
        out.push(renderTable(tableRows, `${i}-tbl-${j}`))
        tableRows = []
      }
      if (line.startsWith('## ')) {
        out.push(<h2 key={`${i}-${j}`} style={s.mdH2}>{renderInline(line.slice(3))}</h2>)
      } else if (line.startsWith('# ')) {
        out.push(<h1 key={`${i}-${j}`} style={s.mdH1}>{renderInline(line.slice(2))}</h1>)
      } else if (line.trim() === '') {
        out.push(<div key={`${i}-${j}`} style={{ height: 8 }} />)
      } else {
        out.push(<p key={`${i}-${j}`} style={s.mdP}>{renderInline(line)}</p>)
      }
    })
    if (tableRows.length) out.push(renderTable(tableRows, `${i}-tbl-end`))
  })
  return out
}

function renderTable(rows, key) {
  const parsed = rows.map(r =>
    r.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  ).filter(r => !r.every(c => /^[-:]+$/.test(c)))
  if (!parsed.length) return null
  const [head, ...body] = parsed
  return (
    <table key={key} style={s.table}>
      <thead>
        <tr>{head.map((c, i) => <th key={i} style={s.th}>{renderInline(c)}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((row, ri) => (
          <tr key={ri}>{row.map((c, ci) => <td key={ci} style={s.td}>{renderInline(c)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

// ── モーダル共通 ─────────────────────────────────────────────
function Modal({ header, children, footer }) {
  return (
    <div style={s.modalOverlay}>
      <div style={s.modalBox}>
        <div style={s.modalHeader}>{header}</div>
        <div style={s.modalBody}>{children}</div>
        <div style={s.modalFooter}>{footer}</div>
      </div>
    </div>
  )
}

// ── 解説モーダル ──────────────────────────────────────────────
function ExplanationModal({ problem, onClose, onNext, hasNext }) {
  return (
    <Modal
      header={
        <>
          <span style={{ ...s.modalBadge, background: '#16a34a' }}>✓ 正解！</span>
          <h2 style={s.modalTitle}>{problem.title} — 解説</h2>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </>
      }
      footer={
        <>
          <button onClick={onClose} style={s.backBtn}>← コードに戻る</button>
          {hasNext && <button onClick={onNext} style={s.nextBtn}>次の問題へ →</button>}
        </>
      }
    >
      {renderMd(problem.explanation)}
    </Modal>
  )
}

// ── ヒントモーダル ────────────────────────────────────────────
function HintModal({ problem, onClose }) {
  return (
    <Modal
      header={
        <>
          <span style={{ ...s.modalBadge, background: '#d97706' }}>💡 ヒント</span>
          <h2 style={s.modalTitle}>{problem.title}</h2>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </>
      }
      footer={
        <button onClick={onClose} style={s.backBtn}>← コードに戻る</button>
      }
    >
      {renderMd(problem.hint)}
    </Modal>
  )
}

// ── メインコンポーネント ──────────────────────────────────────
export default function App() {
  const [problems, setProblems] = useState([])
  const [problem, setProblem] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    fetch('/api/problems?language=python')
      .then(r => r.json())
      .then(data => {
        setProblems(data.problems)
        if (data.problems.length > 0) select(data.problems[0])
      })
      .catch(e => setError('API サーバーに接続できません: ' + e.message))
  }, [])

  function select(p) {
    setProblem(p)
    setCode(p.starterCode ?? '')
    setResult(null)
    setError(null)
    setShowModal(false)
    setShowHint(false)
  }

  const currentIdx = problems.findIndex(p => p.id === problem?.id)
  const nextProblem = currentIdx >= 0 && currentIdx < problems.length - 1 ? problems[currentIdx + 1] : null

  function goNext() {
    if (nextProblem) select(nextProblem)
  }

  async function submit() {
    if (!problem || submitting) return
    setSubmitting(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`/api/problems/${problem.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code }),
      })
      if (!res.ok) {
        const text = await res.text()
        setError(`サーバーエラー (${res.status}): ${text}`)
        return
      }
      const data = await res.json()
      setResult(data)
      if (data.passed) setShowModal(true)
    } catch (e) {
      setError('通信エラー: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.root}>
      {/* 解説モーダル */}
      {showModal && problem && (
        <ExplanationModal
          problem={problem}
          onClose={() => setShowModal(false)}
          onNext={goNext}
          hasNext={!!nextProblem}
        />
      )}

      {/* ヒントモーダル */}
      {showHint && problem && (
        <HintModal problem={problem} onClose={() => setShowHint(false)} />
      )}

      {/* サイドバー */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTitle}>問題一覧</div>
        {problems.map(p => (
          <div
            key={p.id}
            onClick={() => select(p)}
            style={{ ...s.sidebarItem, ...(problem?.id === p.id ? s.sidebarItemActive : {}) }}
          >
            {p.order}. {p.title}
          </div>
        ))}
      </aside>

      {/* メイン */}
      <main style={s.main}>
        {problem && (
          <div style={s.problemArea}>
            <h2 style={s.problemTitle}>{problem.title}</h2>
            <p style={s.problemDesc}>{problem.description}</p>
          </div>
        )}

        <div style={s.editorArea}>
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={v => setCode(v ?? '')}
            theme="vs-dark"
            options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false }}
          />
        </div>

        <div style={s.bar}>
          <button onClick={submit} disabled={submitting} style={s.submitBtn}>
            {submitting ? '採点中…' : '提出'}
          </button>

          {problem?.hint && (
            <button onClick={() => setShowHint(true)} style={s.hintBtn}>
              💡 ヒント
            </button>
          )}

          {error && (
            <span style={{ color: '#ef4444', fontSize: 13 }}>⚠ {error}</span>
          )}

          {result && !error && (
            <span style={{ fontWeight: 'bold', color: result.passed ? '#22c55e' : '#ef4444' }}>
              {result.passed ? '✓ 正解！' : '✗ 不正解'}
              　{result.passedTests} / {result.totalTests} テスト通過
            </span>
          )}

          {result?.passed && (
            <button onClick={() => setShowModal(true)} style={s.explanationBtn}>
              解説を見る
            </button>
          )}

          {result?.passed && nextProblem && (
            <button onClick={goNext} style={s.nextBtn}>
              次の問題へ →
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

const s = {
  // layout
  root: { display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: 220, background: '#1e1e1e', color: '#ccc', padding: 12, overflowY: 'auto', flexShrink: 0 },
  sidebarTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 12, fontSize: 14 },
  sidebarItem: { padding: '8px 10px', marginBottom: 4, borderRadius: 4, cursor: 'pointer', background: '#2d2d2d', color: '#ccc', fontSize: 13 },
  sidebarItemActive: { background: '#0078d4', color: '#fff' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  problemArea: { padding: '16px 24px', borderBottom: '1px solid #e5e7eb', maxHeight: '28vh', overflowY: 'auto', background: '#fafafa' },
  problemTitle: { fontSize: 18, marginBottom: 8 },
  problemDesc: { fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  editorArea: { flex: 1, overflow: 'hidden', minHeight: 0 },
  bar: { padding: '10px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16, background: '#fff', flexShrink: 0 },
  submitBtn: { padding: '8px 28px', background: '#0078d4', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' },
  hintBtn: { padding: '6px 16px', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' },
  explanationBtn: { padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: '#fff' },
  nextBtn: { padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' },

  // modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalBox: { background: '#fff', borderRadius: 10, width: '80vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 28px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  modalBadge: { background: '#16a34a', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 13, fontWeight: 'bold', flexShrink: 0 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', flex: 1, margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: '4px 8px', lineHeight: 1 },
  modalBody: { flex: 1, overflowY: 'auto', padding: '24px 36px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 28px', borderTop: '1px solid #e5e7eb', flexShrink: 0 },
  backBtn: { padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 15, background: '#fff' },

  // markdown
  mdH1: { fontSize: 24, fontWeight: 'bold', margin: '20px 0 10px' },
  mdH2: { fontSize: 20, fontWeight: 'bold', margin: '20px 0 8px', paddingBottom: 4, borderBottom: '2px solid #e5e7eb' },
  mdP: { fontSize: 16, lineHeight: 1.9, margin: '6px 0', color: '#374151' },
  inlineCode: { background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.9em', color: '#be185d' },
  codeBlock: { background: '#1e1e1e', color: '#d4d4d4', padding: '16px 20px', borderRadius: 8, overflowX: 'auto', fontSize: 15, lineHeight: 1.7, margin: '12px 0', fontFamily: 'monospace' },
  table: { borderCollapse: 'collapse', width: '100%', margin: '12px 0', fontSize: 15 },
  th: { background: '#f3f4f6', padding: '8px 14px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 'bold' },
  td: { padding: '8px 14px', border: '1px solid #e5e7eb' },
}
