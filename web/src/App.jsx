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

// ── 正解演出（STAGE CLEAR! ＋ コドにゃんが喜ぶ） ──────────────
function ClearOverlay({ result, skin, clearInfo, onContinue }) {
  useEffect(() => {
    sfx.clear()
    if (clearInfo?.leveledUp) {
      const t = setTimeout(() => sfx.levelUp(), 480)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <div style={s.clearOverlay} role="dialog" aria-label="ステージクリア">
      <ClearStyles />
      <div className="lc-clear-box">
        <span className="lc-star lc-star1">★</span>
        <span className="lc-star lc-star2">✦</span>
        <span className="lc-star lc-star3">★</span>
        <span className="lc-star lc-star4">✦</span>

        <div className="lc-clear-title">STAGE CLEAR!</div>
        <PixelCat size={104} happy color={skin?.color} belly={skin?.belly} className="lc-clear-cat" />
        <div className="lc-clear-sub">
          ぜんぶ正解！{result ? ` ${result.passedTests}/${result.totalTests} テスト通過` : ''}
        </div>

        {clearInfo && (
          clearInfo.gained > 0
            ? <div className="lc-clear-xp">＋{clearInfo.gained} XP</div>
            : <div className="lc-clear-xp lc-clear-xp-dim">クリア済み（XPなし）</div>
        )}
        {clearInfo?.leveledUp && (
          <div className="lc-clear-levelup">LEVEL UP！ LV.{clearInfo.level} {clearInfo.rank}</div>
        )}

        <button type="button" className="lc-clear-btn" onClick={onContinue} autoFocus>
          ▶ つづける
        </button>
      </div>
    </div>
  )
}

function ClearStyles() {
  return (
    <style>{`
      .lc-clear-box {
        position:relative; display:flex; flex-direction:column; align-items:center;
        gap:16px; padding:36px 44px; text-align:center; background:#2D2B52;
        border-top:4px solid #46447A; border-left:4px solid #46447A;
        border-right:4px solid #1A1930; border-bottom:4px solid #1A1930;
        animation:lc-pop .28s ease-out both;
      }
      .lc-clear-title {
        font-family:'Press Start 2P', monospace; font-size:clamp(20px, 5vw, 34px);
        color:#5DF15D; letter-spacing:2px;
      }
      .lc-clear-cat { width:104px; height:104px; image-rendering:pixelated;
        animation:lc-jump .6s ease-in-out infinite; }
      .lc-clear-sub {
        font-family:'DotGothic16', sans-serif; font-size:clamp(14px, 2.6vw, 18px);
        color:#FFD93D; letter-spacing:1px;
      }
      .lc-clear-xp {
        font-family:'Press Start 2P', monospace; font-size:14px; color:#51E5FF; letter-spacing:1px;
      }
      .lc-clear-xp-dim { color:#9D99C9; font-size:11px; }
      .lc-clear-levelup {
        font-family:'Press Start 2P', monospace; font-size:13px; color:#1A1930; letter-spacing:1px;
        background:#FFD93D; padding:8px 14px;
        border-top:3px solid #FFE98A; border-left:3px solid #FFE98A;
        border-right:3px solid #B8950F; border-bottom:3px solid #B8950F;
        animation:lc-pop .3s ease-out both;
      }
      .lc-clear-btn {
        margin-top:4px; font-family:'Press Start 2P', monospace; font-size:12px;
        color:#1A1930; background:#5DF15D; padding:11px 22px; cursor:pointer; letter-spacing:1px;
        border-top:3px solid #9CFF9C; border-left:3px solid #9CFF9C;
        border-right:3px solid #2FA02F; border-bottom:3px solid #2FA02F;
      }
      .lc-clear-btn:focus-visible { outline:3px dashed #51E5FF; outline-offset:4px; }

      .lc-star { position:absolute; font-size:22px; animation:lc-spark 1s steps(2) infinite; }
      .lc-star1 { top:-14px; left:18px; color:#FFD93D; }
      .lc-star2 { top:-10px; right:24px; color:#51E5FF; animation-delay:.15s; }
      .lc-star3 { bottom:46px; left:-12px; color:#FF5C8A; animation-delay:.3s; }
      .lc-star4 { bottom:60px; right:-12px; color:#5DF15D; animation-delay:.45s; }

      @keyframes lc-pop {
        0% { transform:scale(.6); opacity:0; }
        60% { transform:scale(1.08); }
        100% { transform:scale(1); opacity:1; }
      }
      @keyframes lc-jump {
        0%,100% { transform:translateY(0); }
        30% { transform:translateY(-12px); }
        60% { transform:translateY(0); }
      }
      @keyframes lc-spark {
        0% { transform:scale(.4); opacity:.3; }
        50% { transform:scale(1.2); opacity:1; }
        100% { transform:scale(.6); opacity:.4; }
      }
      @media (prefers-reduced-motion: reduce) {
        .lc-clear-box, .lc-clear-cat, .lc-star { animation:none; }
        .lc-clear-box { opacity:1; transform:none; }
      }
    `}</style>
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

// ── コドにゃんの着せ替えスキン（色違い）。unlockLevel で解放 ──
const CAT_SKINS = [
  { id: 'orange', label: 'きほん', color: '#FFC06A', belly: '#FFE6C2', unlockLevel: 1 },
  { id: 'gray', label: 'グレー', color: '#A9A6C9', belly: '#E6E4F5', unlockLevel: 1 },
  { id: 'kuro', label: 'くろ', color: '#4A4866', belly: '#9D99C9', unlockLevel: 2 },
  { id: 'shiro', label: 'しろ', color: '#EDEBFF', belly: '#FFFFFF', unlockLevel: 3 },
  { id: 'mizu', label: 'みず', color: '#51E5FF', belly: '#BEF6FF', unlockLevel: 4 },
  { id: 'momo', label: 'もも', color: '#FF8AAE', belly: '#FFD6E4', unlockLevel: 5 },
  { id: 'midori', label: 'みどり', color: '#5DF15D', belly: '#BEF9BE', unlockLevel: 7 },
  { id: 'kin', label: 'きん', color: '#FFD93D', belly: '#FFF1B0', unlockLevel: 10 },
]
const SKIN_KEY = 'lc-cat-skin'

// ── XP / レベル（初心者→玄人）。今はローカル保存（後で DB 化可） ──
const XP_KEY = 'lc-cleared'        // 初クリア済み問題ID（XP付与は1回だけ）
const MUTE_KEY = 'lc-muted'        // 効果音ミュート設定
const XP_PER_CLEAR = 50
const XP_PER_LEVEL = 100
const RANKS = [
  { lv: 1, name: '初心者' },
  { lv: 3, name: '見習いコーダー' },
  { lv: 5, name: 'コーダー' },
  { lv: 7, name: '中級プログラマ' },
  { lv: 9, name: '上級プログラマ' },
  { lv: 11, name: '達人' },
  { lv: 13, name: '玄人' },
]
function rankFromLevel(level) {
  let name = RANKS[0].name
  for (const r of RANKS) if (level >= r.lv) name = r.name
  return name
}
function xpInfo(totalXp) {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const into = totalXp % XP_PER_LEVEL
  return { totalXp, level, rank: rankFromLevel(level), into, need: XP_PER_LEVEL, progress: into / XP_PER_LEVEL }
}

// ── 8bit 効果音（Web Audio で生成・音源ファイル不要） ─────────
const sfx = (() => {
  let actx = null
  let enabled = true
  function ctx() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) { try { actx = new AC() } catch { actx = null } }
    }
    if (actx && actx.state === 'suspended') actx.resume()
    return actx
  }
  // 矩形波（ファミコン風）1音
  function blip(freq, start, dur, vol = 0.14) {
    const ac = ctx(); if (!ac) return
    const o = ac.createOscillator(); const g = ac.createGain()
    o.type = 'square'; o.frequency.value = freq
    o.connect(g); g.connect(ac.destination)
    const t0 = ac.currentTime + start
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.start(t0); o.stop(t0 + dur + 0.02)
  }
  function arp(notes, step, dur, vol) {
    if (!enabled) return
    notes.forEach((f, i) => blip(f, i * step, dur, vol))
  }
  return {
    setEnabled(b) { enabled = b },
    resume() { ctx() },
    clear() { arp([523.25, 659.25, 783.99, 1046.5], 0.09, 0.12, 0.14) },      // ド ミ ソ ド↑
    levelUp() { arp([659.25, 783.99, 987.77, 1318.51], 0.08, 0.15, 0.17) },   // 上昇ファンファーレ
  }
})()

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

// ── マスコット「コドにゃん」（ドット絵ネコ・インライン SVG） ──
// color / belly を差し替えるとコスメ（色違いアバター）になる土台。
const CAT_PIXELS = [
  // 耳（とがった三角・内耳ピンク）
  [3, 1, 1, 1, 'o'], [3, 2, 2, 1, 'o'], [3, 3, 3, 1, 'o'],     // 左耳
  [12, 1, 1, 1, 'o'], [11, 2, 2, 1, 'o'], [10, 3, 3, 1, 'o'],  // 右耳
  [4, 3, 1, 1, 'i'], [11, 3, 1, 1, 'i'],                       // 内耳
  // 頭（四隅を削って丸く）
  [4, 3, 8, 1, 'o'],
  [3, 4, 10, 1, 'o'],
  [2, 5, 12, 5, 'o'],
  [3, 10, 10, 1, 'o'],
  [4, 11, 8, 1, 'o'],
  // 口まわりの明るいパッチ
  [6, 9, 4, 2, 'f'],
  // ヒゲ（長め・上下に広げる）
  [0, 8, 3, 1, 'wh'], [1, 10, 2, 1, 'wh'],
  [13, 8, 3, 1, 'wh'], [13, 10, 2, 1, 'wh'],
  // ほっぺ（チーク）
  [3, 9, 2, 1, 'b'], [11, 9, 2, 1, 'b'],
  // 鼻・小さな口
  [7, 9, 2, 1, 'n'], [7, 10, 2, 1, 'p'],
  // 体（小さめ）・お腹・足
  [5, 12, 6, 2, 'o'], [6, 12, 3, 1, 'f'],
  [5, 14, 2, 1, 'o'], [9, 14, 2, 1, 'o'],
  // しっぽ（右にピンと立ててカール）
  [11, 13, 1, 1, 'o'], [12, 13, 1, 1, 'o'], [13, 13, 1, 1, 'o'],
  [13, 12, 1, 1, 'o'], [13, 11, 1, 1, 'o'], [13, 10, 1, 1, 'o'], [12, 10, 1, 1, 'o'],
]

// 目（通常＝大きい目＋キャッチライト / happy＝閉じた ^^ ）
const CAT_EYES_NORMAL = [
  [4, 6, 2, 3, 'p'], [10, 6, 2, 3, 'p'],
  [4, 6, 1, 1, 'w'], [10, 6, 1, 1, 'w'],
]
const CAT_EYES_HAPPY = [
  [4, 7, 1, 1, 'p'], [5, 6, 1, 1, 'p'], [6, 7, 1, 1, 'p'],   // 左 ^
  [9, 7, 1, 1, 'p'], [10, 6, 1, 1, 'p'], [11, 7, 1, 1, 'p'], // 右 ^
]

function PixelCat({ size = 64, color = '#FFC06A', belly = '#FFE6C2', happy = false, className, title = 'コドにゃん（LearnCode のマスコット）' }) {
  const fill = { o: color, i: '#FF8AAE', p: '#2B2A45', w: '#FFFFFF', n: '#FF6FA0', b: '#FF9EC4', f: belly, wh: '#F0DDB0' }
  const pixels = [...CAT_PIXELS, ...(happy ? CAT_EYES_HAPPY : CAT_EYES_NORMAL)]
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
      role="img"
      aria-label={title}
    >
      {pixels.map(([x, y, w, h, k], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill[k]} />
      ))}
    </svg>
  )
}

// ── レベル表示（LV＋称号＋XPバー） ───────────────────────────
function LevelBadge({ info, width = 150 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontFamily: FONT_PX, fontSize: 11, color: c.yellow }}>★LV.{info.level}</span>
        <span style={{ fontFamily: FONT_DOT, fontSize: 13, fontWeight: 'bold', color: c.ink }}>{info.rank}</span>
      </div>
      <div style={{ width, height: 10, background: c.bevD, ...bevelIn(2) }}>
        <div style={{ width: `${Math.round(info.progress * 100)}%`, height: '100%', background: c.green, transition: 'width .45s steps(8)' }} />
      </div>
    </div>
  )
}

// ── トップページ（8bit アーケード風タイトル画面） ─────────────
function Home({ onSelect, onOpenCloset, skin, xp, muted, onToggleMute }) {
  const start = () => onSelect('python')

  return (
    <div className="lc-root">
      <HomeStyles />

      {/* 上部 HUD バー */}
      <div className="lc-hud">
        <span className="lc-hud-left">■ LEARNCODE.EXE</span>
        <span className="lc-hud-right">
          <button type="button" className="lc-hud-btn" onClick={onToggleMute} aria-label={muted ? '効果音をオンにする' : '効果音をオフにする'}>
            {muted ? 'SE ✕' : 'SE ♪'}
          </button>
          <button type="button" className="lc-hud-btn" onClick={onOpenCloset}>きせかえ</button>
          <LevelBadge info={xp} width={120} />
        </span>
      </div>

      <div className="lc-screen">
        {/* 大タイトル＋マスコット */}
        <div className="lc-titlewrap">
          <PixelCat className="lc-mascot" color={skin.color} belly={skin.belly} />
          <h1 className="lc-title">
            <span className="lc-title-learn">LEARN</span>
            <span className="lc-title-code">CODE</span>
          </h1>
        </div>

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
      .lc-hud-right { display:flex; align-items:center; gap:14px; }
      .lc-hud-lv { color:var(--yellow); }
      .lc-hud-btn {
        font-family:'DotGothic16', sans-serif; font-size:13px; font-weight:bold; letter-spacing:1px;
        color:var(--cyan); background:var(--bev-l); cursor:pointer; padding:6px 12px; border-radius:0;
        border-top:2px solid var(--muted); border-left:2px solid var(--muted);
        border-right:2px solid var(--bev-d); border-bottom:2px solid var(--bev-d);
      }
      .lc-hud-btn:hover { color:var(--white); background:#54528c; }
      .lc-hud-btn:focus-visible { outline:2px dashed var(--cyan); outline-offset:2px; }

      /* 画面本体 */
      .lc-screen {
        flex:1; display:flex; flex-direction:column; align-items:center;
        justify-content:center; gap:clamp(8px, 1.8vh, 18px);
        padding:clamp(12px, 2.5vh, 28px) 20px; text-align:center;
      }

      /* タイトル＋マスコット */
      .lc-titlewrap {
        display:flex; align-items:center; justify-content:center;
        gap:clamp(10px, 2vw, 22px); flex-wrap:wrap;
      }
      .lc-mascot {
        width:clamp(48px, 9vw, 76px); height:auto; image-rendering:pixelated;
        animation:lc-bob 1.4s ease-in-out infinite;
      }
      @keyframes lc-bob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
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

      /* 動きを減らす設定では点滅・バウンドを止める */
      @media (prefers-reduced-motion: reduce) {
        .lc-pushstart, .lc-mascot { animation:none; }
      }
    `}</style>
  )
}

// ── ルート：home / closet / course を切替 ─────────────────────
export default function App() {
  const [language, setLanguage] = useState(null)
  const [screen, setScreen] = useState('home') // 'home' | 'closet'
  const [skinId, setSkinId] = useState(() => {
    try { return localStorage.getItem(SKIN_KEY) || 'orange' } catch { return 'orange' }
  })
  const [clearedIds, setClearedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(XP_KEY) || '[]') } catch { return [] }
  })
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
  })
  const skin = CAT_SKINS.find(sk => sk.id === skinId) ?? CAT_SKINS[0]
  const xp = xpInfo(clearedIds.length * XP_PER_CLEAR)

  useEffect(() => { sfx.setEnabled(!muted) }, [muted])

  function chooseSkin(id) {
    setSkinId(id)
    try { localStorage.setItem(SKIN_KEY, id) } catch { /* ignore */ }
  }
  function recordClear(id) {
    setClearedIds(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      try { localStorage.setItem(XP_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  function toggleMute() {
    setMuted(m => {
      const next = !m
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      if (!next) sfx.resume()
      return next
    })
  }

  if (language) return (
    <Course
      language={language} skin={skin} xp={xp} clearedIds={clearedIds}
      muted={muted} onToggleMute={toggleMute}
      onClear={recordClear} onBack={() => setLanguage(null)}
    />
  )
  if (screen === 'closet') return <Closet skin={skin} xp={xp} onSelect={chooseSkin} onBack={() => setScreen('home')} />
  return (
    <Home
      skin={skin} xp={xp} muted={muted} onToggleMute={toggleMute}
      onSelect={setLanguage} onOpenCloset={() => setScreen('closet')}
    />
  )
}

// ── 着せ替え画面（クローゼット） ──────────────────────────────
function Closet({ skin, xp, onSelect, onBack }) {
  return (
    <div style={s.closetRoot}>
      <ClosetStyles />

      {/* HUD */}
      <div style={s.closetHud}>
        <button type="button" onClick={onBack} style={s.closetBack} aria-label="トップへもどる">← もどる</button>
        <span style={s.closetTitle}>きせかえ</span>
        <span style={{ ...s.closetTitle, color: c.ink, fontSize: 10 }}>LV.{xp.level}</span>
      </div>

      <div style={s.closetBody}>
        {/* プレビュー */}
        <div className="lc-cl-stage">
          <PixelCat size={160} color={skin.color} belly={skin.belly} />
          <div className="lc-cl-name">コドにゃん（{skin.label}）</div>
        </div>

        {/* カラー選択 */}
        <p style={s.closetGuide}>▼ カラーをえらぶ（レベルで解放）</p>
        <div className="lc-cl-grid">
          {CAT_SKINS.map(sk => {
            const locked = xp.level < sk.unlockLevel
            return (
              <button
                key={sk.id}
                type="button"
                disabled={locked}
                onClick={() => !locked && onSelect(sk.id)}
                aria-label={locked ? `${sk.label}（LV.${sk.unlockLevel} で解放）` : `${sk.label} にする`}
                aria-pressed={sk.id === skin.id}
                className={`lc-cl-card${sk.id === skin.id ? ' lc-cl-sel' : ''}${locked ? ' lc-cl-locked' : ''}`}
              >
                <PixelCat size={56} color={sk.color} belly={sk.belly} />
                <span className="lc-cl-card-name">{sk.label}</span>
                {locked && (
                  <span className="lc-cl-locktag"><PixelLock /> LV.{sk.unlockLevel}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ClosetStyles() {
  return (
    <style>{`
      .lc-cl-stage {
        display:flex; flex-direction:column; align-items:center; gap:14px;
        padding:28px 48px; background:#2D2B52;
        border-top:4px solid #46447A; border-left:4px solid #46447A;
        border-right:4px solid #1A1930; border-bottom:4px solid #1A1930;
      }
      .lc-cl-stage svg { image-rendering:pixelated; }
      .lc-cl-name { font-family:'DotGothic16', sans-serif; font-size:18px; color:#FFD93D; letter-spacing:1px; }

      .lc-cl-grid {
        display:grid; grid-template-columns:repeat(4, 92px); gap:14px; justify-content:center;
      }
      .lc-cl-card {
        display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 8px;
        background:#2D2B52; border:0; border-radius:0; cursor:pointer; font:inherit;
        border-top:3px solid #46447A; border-left:3px solid #46447A;
        border-right:3px solid #1A1930; border-bottom:3px solid #1A1930;
      }
      .lc-cl-card svg { image-rendering:pixelated; }
      .lc-cl-card-name { font-family:'DotGothic16', sans-serif; font-size:13px; color:#EDEBFF; }
      .lc-cl-card:hover { background:#363468; }
      .lc-cl-sel { outline:4px solid #5DF15D; outline-offset:3px; }
      .lc-cl-card:focus-visible { outline:3px dashed #51E5FF; outline-offset:3px; }
      .lc-cl-locked { opacity:0.5; cursor:not-allowed; }
      .lc-cl-locked:hover { background:#2D2B52; }
      .lc-cl-locktag {
        display:flex; align-items:center; gap:4px;
        font-family:'Press Start 2P', monospace; font-size:8px; color:#9D99C9; letter-spacing:1px;
      }

      @media (max-width:520px) { .lc-cl-grid { grid-template-columns:repeat(3, 92px); } }
      @media (max-width:392px) { .lc-cl-grid { grid-template-columns:repeat(2, 92px); } }
    `}</style>
  )
}

// ── 学習画面（言語ごと） ──────────────────────────────────────
function Course({ language, skin, xp, clearedIds, muted, onToggleMute, onClear, onBack }) {
  const [problems, setProblems] = useState([])
  const [problem, setProblem] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showClear, setShowClear] = useState(false)
  const [clearInfo, setClearInfo] = useState(null)

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
    setShowClear(false)
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
      if (data.passed) {
        const first = !clearedIds.includes(problem.id)
        const gained = first ? XP_PER_CLEAR : 0
        const after = xpInfo(xp.totalXp + gained)
        const leveledUp = first && after.level > xp.level
        setClearInfo({ gained, leveledUp, level: after.level, rank: after.rank })
        if (first) onClear(problem.id)
        setShowClear(true)
      }
    } catch (e) {
      setError('通信エラー: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.root}>
      {/* 正解演出（STAGE CLEAR!） */}
      {showClear && (
        <ClearOverlay
          result={result}
          skin={skin}
          clearInfo={clearInfo}
          onContinue={() => { setShowClear(false); setShowModal(true) }}
        />
      )}

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
        <div style={{ marginBottom: 14 }}><LevelBadge info={xp} width={200} /></div>
        <button onClick={onToggleMute} style={{ ...s.backToHome, marginBottom: 14 }}>
          {muted ? 'SE: OFF ✕' : 'SE: ON ♪'}
        </button>
        <div style={s.sidebarTitle}>{langLabel} の問題</div>
        {problems.map(p => {
          const cleared = clearedIds.includes(p.id)
          const active = problem?.id === p.id
          return (
            <div
              key={p.id}
              onClick={() => select(p)}
              style={{ ...s.sidebarItem, ...(active ? s.sidebarItemActive : {}), display: 'flex', justifyContent: 'space-between', gap: 6 }}
            >
              <span>{p.order}. {p.title}</span>
              {cleared && <span style={{ color: active ? c.bevD : c.green, fontWeight: 'bold' }}>✓</span>}
            </div>
          )
        })}
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

  // 着せ替え（クローゼット）
  closetRoot: { minHeight: '100vh', background: c.bg, color: c.ink, fontFamily: FONT_DOT, display: 'flex', flexDirection: 'column', imageRendering: 'pixelated' },
  closetHud: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `4px solid ${c.bevL}` },
  closetBack: { ...pxBtn(c.bevL, c.green, c.muted, c.bevD), fontSize: 9 },
  closetTitle: { fontFamily: FONT_PX, fontSize: 14, color: c.yellow, letterSpacing: 1 },
  closetBody: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '28px 20px', overflowY: 'auto' },
  closetGuide: { fontFamily: FONT_DOT, fontSize: 15, color: c.yellow, letterSpacing: 1 },

  // 正解演出
  clearOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,9,24,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },

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
