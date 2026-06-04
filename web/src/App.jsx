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
          <span style={{ ...s.modalBadge, background: c.green }}>✓ 正解！</span>
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
          <span style={{ ...s.modalBadge, background: c.yellow }}>💡 ヒント</span>
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

// ── 対応言語（v1 は Python のみ。UI は複数言語前提） ──────────
// tileBg / tileFg = キャラセレ用モノグラムタイルの配色
const LANGUAGES = [
  { id: 'python', label: 'Python', mono: 'Py', tileBg: '#4DA6FF', tileFg: '#FFFFFF', available: true, blurb: '読みやすく初心者に最適な定番言語' },
  { id: 'javascript', label: 'JavaScript', mono: 'JS', tileBg: '#FFD93D', tileFg: '#1A1930', available: false, blurb: 'Web を動かす言語' },
  { id: 'java', label: 'Java', mono: 'Ja', tileBg: '#FF6B6B', tileFg: '#FFFFFF', available: false, blurb: '業務・Android で広く使われる' },
  { id: 'c', label: 'C', mono: 'C', tileBg: '#FF9E54', tileFg: '#1A1930', available: false, blurb: 'コンピュータの基礎を学ぶ' },
  { id: 'cpp', label: 'C++', mono: 'C++', tileBg: '#51E5FF', tileFg: '#1A1930', available: false, blurb: '高速・低レイヤーの定番' },
  { id: 'csharp', label: 'C#', mono: 'C#', tileBg: '#C77DFF', tileFg: '#FFFFFF', available: false, blurb: 'アプリ・ゲーム開発に' },
]

// ── ドット絵風の南京錠アイコン（インライン SVG） ──────────────
function PixelLock() {
  return (
    <svg className="lc-pixel" width="16" height="16" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {/* shackle（弦） */}
      <rect x="2" y="1" width="1" height="2" fill="#9D99C9" />
      <rect x="5" y="1" width="1" height="2" fill="#9D99C9" />
      <rect x="3" y="0" width="2" height="1" fill="#9D99C9" />
      {/* body（本体） */}
      <rect x="1" y="3" width="6" height="5" fill="#9D99C9" />
      {/* keyhole（鍵穴） */}
      <rect x="3" y="4" width="2" height="2" fill="#2D2B52" />
      <rect x="3" y="6" width="2" height="1" fill="#2D2B52" />
    </svg>
  )
}

// ── トップページ（8bit アーケード風タイトル画面） ─────────────
function Home({ onSelect }) {
  const start = () => onSelect('python')

  return (
    <div className="lc-root">
      <HomeStyles />

      {/* 上部 HUD バー */}
      <div className="lc-hud">
        <span className="lc-hud-left">■ LEARNCODE.EXE</span>
        <span className="lc-hud-right">★ LV.1</span>
      </div>

      <div className="lc-screen">
        {/* 大タイトル */}
        <h1 className="lc-title">
          <span className="lc-title-learn">LEARN</span>
          <span className="lc-title-code">CODE</span>
        </h1>

        {/* 使い方の軽い紹介 */}
        <p className="lc-tagline">
          言語をえらんで、出された問題にコードで挑戦。<br />
          クリアしながら<span className="lc-arrow">レベルアップ</span>していく学習アプリ！
        </p>

        {/* 案内 */}
        <p className="lc-guide">▼ 言語をえらんでスタート！</p>

        {/* キャラクターセレクト */}
        <div className="lc-grid">
          {LANGUAGES.map(lang => {
            const locked = !lang.available
            return (
              <button
                key={lang.id}
                type="button"
                disabled={locked}
                onClick={() => lang.available && onSelect(lang.id)}
                aria-label={
                  locked
                    ? `${lang.label}（近日公開・選択できません）`
                    : `${lang.label} ではじめる`
                }
                className={`lc-card${lang.available ? ' lc-card-active' : ' lc-card-locked'}`}
              >
                {locked && <span className="lc-badge">近日公開</span>}

                <span
                  className="lc-tile"
                  style={{ background: lang.tileBg, color: lang.tileFg }}
                  aria-hidden="true"
                >
                  {lang.mono}
                </span>

                <span className="lc-card-name">{lang.label}</span>
                <span className="lc-card-blurb">{lang.blurb}</span>

                {lang.available ? (
                  <span className="lc-start">START ▶</span>
                ) : (
                  <span className="lc-lock">
                    <PixelLock /> LOCKED
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* PUSH START */}
        <button type="button" className="lc-pushstart" onClick={start} aria-label="Python ではじめる">
          ▶ PUSH START
        </button>
      </div>
    </div>
  )
}

// ── トップページ専用スタイル（点滅・ホバー・レスポンシブ用） ──
function HomeStyles() {
  return (
    <style>{`
      .lc-root {
        --bg:#1B1A2E; --panel:#2D2B52; --bev-l:#46447A; --bev-d:#1A1930;
        --green:#5DF15D; --pink:#FF5C8A; --cyan:#51E5FF; --yellow:#FFD93D;
        --white:#FFFFFF; --ink:#EDEBFF; --muted:#9D99C9; --dim:#6E6A99;
        min-height:100vh; background:var(--bg); color:var(--white);
        display:flex; flex-direction:column; image-rendering:pixelated;
      }
      .lc-pixel { image-rendering:pixelated; }
      .lc-eng { font-family:'Press Start 2P', monospace; }

      /* HUD */
      .lc-hud {
        display:flex; justify-content:space-between; align-items:center;
        padding:14px 18px; border-bottom:4px solid var(--bev-l);
        font-family:'Press Start 2P', monospace; font-size:11px; letter-spacing:1px;
      }
      .lc-hud-left { color:var(--green); }
      .lc-hud-right { color:var(--yellow); }

      /* 画面本体 */
      .lc-screen {
        flex:1; display:flex; flex-direction:column; align-items:center;
        justify-content:center; gap:clamp(8px, 1.8vh, 18px);
        padding:clamp(12px, 2.5vh, 28px) 20px; text-align:center;
      }

      /* タイトル */
      .lc-title {
        font-family:'Press Start 2P', monospace; font-size:clamp(28px, 7vw, 64px);
        line-height:1.1; letter-spacing:2px;
      }
      .lc-title-learn { color:var(--green); }
      .lc-title-code  { color:var(--pink); }

      /* タグライン・案内 */
      .lc-tagline {
        font-family:'DotGothic16', sans-serif; font-size:clamp(14px, 2.4vw, 20px);
        color:var(--ink); letter-spacing:1px; line-height:1.9; max-width:560px;
      }
      .lc-arrow { color:var(--cyan); margin:0 4px; font-weight:bold; }
      .lc-guide {
        font-family:'DotGothic16', sans-serif; font-size:clamp(13px, 2vw, 17px);
        color:var(--yellow); letter-spacing:1px;
      }

      /* キャラクターセレクト */
      .lc-grid {
        display:grid; grid-template-columns:repeat(3, minmax(140px, 190px));
        gap:clamp(10px, 1.6vh, 16px); margin-top:2px; max-width:680px; width:100%;
        justify-content:center;
      }
      .lc-card {
        position:relative; display:flex; flex-direction:column; align-items:center;
        gap:8px; padding:12px 12px 12px; background:var(--panel); color:var(--white);
        border:0; border-radius:0; cursor:pointer; font:inherit;
        border-top:4px solid var(--bev-l); border-left:4px solid var(--bev-l);
        border-right:4px solid var(--bev-d); border-bottom:4px solid var(--bev-d);
      }
      .lc-card-locked { opacity:0.5; cursor:not-allowed; }
      .lc-card-active { outline:4px solid var(--green); outline-offset:3px; }
      .lc-card-active:hover, .lc-card-active:focus-visible {
        background:#363468; outline-color:var(--cyan);
      }
      .lc-card-active:focus-visible { outline-style:dashed; }
      .lc-card-locked:hover .lc-badge { background:var(--pink); color:var(--white); }

      /* モノグラムタイル（ベベル付き） */
      .lc-tile {
        width:58px; height:58px; display:flex; align-items:center; justify-content:center;
        font-family:'Press Start 2P', monospace; font-size:16px; border-radius:0;
        border-top:3px solid rgba(255,255,255,0.45); border-left:3px solid rgba(255,255,255,0.45);
        border-right:3px solid rgba(0,0,0,0.35); border-bottom:3px solid rgba(0,0,0,0.35);
        image-rendering:pixelated;
      }

      .lc-card-name {
        font-family:'DotGothic16', sans-serif; font-size:17px; font-weight:bold; color:var(--white);
      }
      .lc-card-blurb {
        font-family:'DotGothic16', sans-serif; font-size:12.5px; line-height:1.6;
        color:var(--ink); min-height:38px;
      }

      /* START ボタン（カード内・緑ベベル） */
      .lc-start {
        font-family:'Press Start 2P', monospace; font-size:11px; color:var(--bev-d);
        background:var(--green); padding:9px 12px; letter-spacing:1px;
        border-top:3px solid #9CFF9C; border-left:3px solid #9CFF9C;
        border-right:3px solid #2FA02F; border-bottom:3px solid #2FA02F;
      }
      /* ロック表示 */
      .lc-lock {
        display:inline-flex; align-items:center; gap:6px;
        font-family:'Press Start 2P', monospace; font-size:10px; color:var(--muted);
        padding:9px 8px; letter-spacing:1px;
      }
      /* 近日公開バッジ（square） */
      .lc-badge {
        position:absolute; top:8px; right:8px;
        font-family:'DotGothic16', sans-serif; font-size:11px; font-weight:bold;
        background:var(--dim); color:var(--white); padding:3px 7px; border-radius:0;
        border-top:2px solid var(--muted); border-left:2px solid var(--muted);
        border-right:2px solid var(--bev-d); border-bottom:2px solid var(--bev-d);
      }

      /* PUSH START（点滅） */
      .lc-pushstart {
        margin-top:2px; font-family:'Press Start 2P', monospace; font-size:14px;
        color:var(--green); background:transparent; border:0; cursor:pointer;
        letter-spacing:2px; padding:6px; animation:lc-blink 1s steps(1) infinite;
      }
      .lc-pushstart:focus-visible { outline:3px dashed var(--cyan); outline-offset:4px; }
      @keyframes lc-blink { 50% { opacity:0; } }

      /* レスポンシブ: 4列 → 2列 → 1列 */
      @media (max-width:760px) {
        .lc-grid { grid-template-columns:repeat(2, minmax(140px, 1fr)); }
      }
      @media (max-width:430px) {
        .lc-grid { grid-template-columns:1fr; }
      }

      /* 動きを減らす設定では点滅を止める */
      @media (prefers-reduced-motion: reduce) {
        .lc-pushstart { animation:none; }
      }
    `}</style>
  )
}

// ── ルート：言語未選択ならトップ、選択後は学習画面 ────────────
export default function App() {
  const [language, setLanguage] = useState(null)

  if (!language) return <Home onSelect={setLanguage} />
  return <Course language={language} onBack={() => setLanguage(null)} />
}

// ── 学習画面（言語ごと） ──────────────────────────────────────
function Course({ language, onBack }) {
  const [problems, setProblems] = useState([])
  const [problem, setProblem] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const langLabel = LANGUAGES.find(l => l.id === language)?.label ?? language

  useEffect(() => {
    fetch(`/api/problems?language=${encodeURIComponent(language)}`)
      .then(r => r.json())
      .then(data => {
        setProblems(data.problems)
        if (data.problems.length > 0) select(data.problems[0])
      })
      .catch(e => setError('API サーバーに接続できません: ' + e.message))
  }, [language])

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
        body: JSON.stringify({ language, code }),
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
        <button onClick={onBack} style={s.backToHome}>← 言語選択へ戻る</button>
        <div style={s.sidebarTitle}>{langLabel} の問題</div>
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
            language={language}
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
            <span style={{ color: c.pink, fontSize: 13, fontFamily: FONT_DOT }}>⚠ {error}</span>
          )}

          {result && !error && (
            <span style={{ fontFamily: FONT_DOT, fontWeight: 'bold', fontSize: 15, color: result.passed ? c.green : c.pink }}>
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

// ── 8bit レトロ配色（トップページと統一） ────────────────────
const c = {
  bg: '#1B1A2E', panel: '#2D2B52', bevL: '#46447A', bevD: '#1A1930',
  green: '#5DF15D', pink: '#FF5C8A', cyan: '#51E5FF', yellow: '#FFD93D',
  white: '#FFFFFF', ink: '#EDEBFF', muted: '#9D99C9', dim: '#6E6A99',
}
const FONT_PX = "'Press Start 2P', monospace"   // 短い英字・ボタン・ラベル
const FONT_DOT = "'DotGothic16', sans-serif"    // 日本語・本文

// 立体ベベル枠（上左=明 / 右下=暗）
const bevel = (w = 4) => ({
  borderTop: `${w}px solid ${c.bevL}`, borderLeft: `${w}px solid ${c.bevL}`,
  borderRight: `${w}px solid ${c.bevD}`, borderBottom: `${w}px solid ${c.bevD}`,
})
// 押し込みベベル（凹）
const bevelIn = (w = 3) => ({
  borderTop: `${w}px solid ${c.bevD}`, borderLeft: `${w}px solid ${c.bevD}`,
  borderRight: `${w}px solid ${c.bevL}`, borderBottom: `${w}px solid ${c.bevL}`,
})
// 色付きベベルボタン
const pxBtn = (bg, fg, light, dark) => ({
  fontFamily: FONT_PX, fontSize: 11, letterSpacing: 1, color: fg, background: bg,
  padding: '10px 16px', borderRadius: 0, cursor: 'pointer',
  borderTop: `3px solid ${light}`, borderLeft: `3px solid ${light}`,
  borderRight: `3px solid ${dark}`, borderBottom: `3px solid ${dark}`,
})

const s = {
  // layout
  root: { display: 'flex', height: '100vh', fontFamily: FONT_DOT, background: c.bg, color: c.ink, imageRendering: 'pixelated' },
  sidebar: { width: 232, background: c.panel, color: c.ink, padding: 12, overflowY: 'auto', flexShrink: 0, borderRight: `4px solid ${c.bevD}` },
  backToHome: { width: '100%', ...pxBtn(c.bevL, c.green, c.muted, c.bevD), fontSize: 9, textAlign: 'left', marginBottom: 14 },
  sidebarTitle: { fontFamily: FONT_DOT, color: c.yellow, fontWeight: 'bold', marginBottom: 12, fontSize: 15, letterSpacing: 1 },
  sidebarItem: { padding: '9px 10px', marginBottom: 6, borderRadius: 0, cursor: 'pointer', background: '#252346', color: c.ink, fontSize: 14, ...bevel(2) },
  sidebarItemActive: { background: c.green, color: c.bevD, fontWeight: 'bold' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  problemArea: { padding: '16px 24px', borderBottom: `4px solid ${c.bevD}`, maxHeight: '30vh', overflowY: 'auto', background: c.panel },
  problemTitle: { fontFamily: FONT_DOT, fontSize: 19, marginBottom: 10, color: c.white, letterSpacing: 1 },
  problemDesc: { fontFamily: FONT_DOT, fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: c.ink },
  editorArea: { flex: 1, overflow: 'hidden', minHeight: 0, borderTop: `2px solid ${c.bevL}` },
  bar: { padding: '12px 24px', borderTop: `4px solid ${c.bevL}`, display: 'flex', alignItems: 'center', gap: 16, background: c.panel, flexShrink: 0, flexWrap: 'wrap' },
  submitBtn: { ...pxBtn(c.green, c.bevD, '#9CFF9C', '#2FA02F'), fontSize: 12, padding: '11px 26px' },
  hintBtn: { ...pxBtn(c.yellow, c.bevD, '#FFE98A', '#B8950F'), fontSize: 10 },
  explanationBtn: { ...pxBtn(c.cyan, c.bevD, '#A6F2FF', '#1F9DB5'), fontSize: 10 },
  nextBtn: { ...pxBtn(c.pink, c.white, '#FF9CBC', '#C72E5C'), fontSize: 10 },

  // modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,9,24,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modalBox: { background: c.panel, borderRadius: 0, width: '80vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', ...bevel(4) },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: `4px solid ${c.bevD}`, flexShrink: 0 },
  modalBadge: { fontFamily: FONT_PX, fontSize: 10, color: c.bevD, padding: '6px 10px', borderRadius: 0, fontWeight: 'bold', flexShrink: 0, ...bevelIn(2) },
  modalTitle: { fontFamily: FONT_DOT, fontSize: 20, fontWeight: 'bold', flex: 1, margin: 0, color: c.white },
  modalClose: { ...pxBtn(c.bevL, c.ink, c.muted, c.bevD), fontSize: 11, padding: '8px 10px', lineHeight: 1 },
  modalBody: { flex: 1, overflowY: 'auto', padding: '24px 32px', color: c.ink },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: `4px solid ${c.bevD}`, flexShrink: 0 },
  backBtn: { ...pxBtn(c.bevL, c.ink, c.muted, c.bevD), fontSize: 11 },

  // markdown（ダークレトロ）
  mdH1: { fontFamily: FONT_DOT, fontSize: 23, fontWeight: 'bold', margin: '20px 0 10px', color: c.white },
  mdH2: { fontFamily: FONT_DOT, fontSize: 19, fontWeight: 'bold', margin: '20px 0 8px', paddingBottom: 6, borderBottom: `3px solid ${c.cyan}`, color: c.cyan },
  mdP: { fontFamily: FONT_DOT, fontSize: 16, lineHeight: 1.95, margin: '6px 0', color: c.ink },
  inlineCode: { background: c.bevD, padding: '2px 6px', borderRadius: 0, fontFamily: 'monospace', fontSize: '0.9em', color: c.green },
  codeBlock: { background: '#14132A', color: '#D4D4D4', padding: '16px 20px', borderRadius: 0, overflowX: 'auto', fontSize: 15, lineHeight: 1.7, margin: '12px 0', fontFamily: 'monospace', ...bevelIn(3) },
  table: { borderCollapse: 'collapse', width: '100%', margin: '12px 0', fontSize: 15, fontFamily: FONT_DOT },
  th: { background: c.bevL, color: c.white, padding: '8px 14px', textAlign: 'left', border: `2px solid ${c.bevD}`, fontWeight: 'bold' },
  td: { padding: '8px 14px', border: `2px solid ${c.bevL}`, color: c.ink },
}
