import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

export default function App() {
  const [problems, setProblems] = useState([])
  const [problem, setProblem] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)

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
    setShowExplanation(false)
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
      setResult(await res.json())
    } catch (e) {
      setError('通信エラー: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.root}>
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
        {/* 問題文 */}
        {problem && (
          <div style={s.problemArea}>
            <h2 style={s.problemTitle}>{problem.title}</h2>
            <p style={s.problemDesc}>{problem.description}</p>
          </div>
        )}

        {/* エディタ */}
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

        {/* 提出バー */}
        <div style={s.bar}>
          <button onClick={submit} disabled={submitting} style={s.submitBtn}>
            {submitting ? '採点中…' : '提出'}
          </button>

          {error && (
            <span style={{ color: '#ef4444', fontSize: 13 }}>⚠ {error}</span>
          )}

          {result && !error && (
            <span style={{ fontWeight: 'bold', color: result.passed ? '#22c55e' : '#ef4444' }}>
              {result.passed ? '✓ 正解！' : '✗ 不正解'}
              　{result.passedTests} / {result.totalTests} テスト通過
            </span>
          )}

          {result?.passed && problem?.explanation && (
            <button onClick={() => setShowExplanation(v => !v)} style={s.explanationBtn}>
              解説を{showExplanation ? '隠す' : '見る'}
            </button>
          )}
        </div>

        {/* 解説 */}
        {showExplanation && problem?.explanation && (
          <div style={s.explanation}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{problem.explanation}</pre>
          </div>
        )}
      </main>
    </div>
  )
}

const s = {
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
  explanationBtn: { padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  explanation: { padding: '16px 24px', background: '#f0f9ff', borderTop: '1px solid #bae6fd', maxHeight: '28vh', overflowY: 'auto', fontSize: 14, lineHeight: 1.7 },
}
