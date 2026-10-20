import { useRef, useState } from 'react'
import { FileText, Sparkles, Upload, Copy, Download, LoaderCircle, RotateCcw, CheckCircle2 } from 'lucide-react'

const API = 'http://127.0.0.1:8000/api'
const sampleText = `Information retrieval is the process of finding relevant information from a large collection of documents in response to a user's query. Modern information retrieval systems use techniques such as document indexing, tokenization, ranking, and relevance scoring to organize and retrieve useful information. Natural language processing has expanded these systems by enabling applications to analyze and generate human language. Text summarization is one such application. Extractive summarization selects important sentences from the source document, while abstractive summarization generates a shorter version using newly constructed sentences. Transformer-based neural networks have significantly improved abstractive summarization because they can model relationships between words and longer passages. However, generated summaries can omit important facts or produce unsupported statements, so their quality should be evaluated and important details checked against the source.`

function words(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export default function App() {
  const [text, setText] = useState('')
  const [length, setLength] = useState('medium')
  const [summary, setSummary] = useState('')
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileRef = useRef(null)

  async function generateSummary() {
    setError('')
    setNotice('')
    setSummary('')
    setStats(null)
    if (words(text) < 25) {
      setError('Please enter at least 25 words before generating a summary.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`${API}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, length }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not generate a summary.')
      setSummary(data.summary)
      setStats(data)
    } catch (e) {
      setError(e.message || 'Unable to connect to the backend. Make sure FastAPI is running on port 8000.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadFile(file) {
    if (!file) return
    setError('')
    setNotice('')
    const form = new FormData()
    form.append('file', file)
    try {
      const response = await fetch(`${API}/extract-text`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not read this file.')
      setText(data.text)
      setSummary('')
      setStats(null)
      setNotice(`Loaded ${file.name} (${data.word_count.toLocaleString()} words).`)
    } catch (e) {
      setError(e.message || 'File upload failed. Check that the backend is running.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary)
      setNotice('Summary copied to clipboard.')
    } catch {
      setError('Clipboard access was blocked by the browser. You can select and copy the summary manually.')
    }
  }

  function downloadSummary() {
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'summary.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setText('')
    setSummary('')
    setStats(null)
    setError('')
    setNotice('')
  }

  const compression = stats?.compression_percent ?? 0

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Briefly AI home">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <span>briefly<span className="brand-ai">.ai</span></span>
        </a>
        <span className="topbar-tag"><span className="status-dot" /> AI SUMMARIZATION</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> YOUR IDEAS, DISTILLED</div>
        <h1>Less reading.<br /><span>More understanding.</span></h1>
        <p className="hero-copy">Turn lengthy documents into clear, concise summaries while keeping the ideas that matter.</p>
      </section>

      <section className="workspace">
        <div className="panel input-panel">
          <div className="panel-heading">
            <div className="heading-icon"><FileText size={18} /></div>
            <div><h2>Your document</h2><p>Paste text or upload a file to get started.</p></div>
          </div>

          <div className="input-toolbar">
            <span className="field-label">SOURCE TEXT</span>
            <div className="toolbar-actions">
              <button className="text-button" onClick={() => { setText(sampleText); setSummary(''); setStats(null); setError(''); setNotice('Sample text loaded.') }}>Try sample</button>
              <button className="text-button" onClick={reset}><RotateCcw size={13} /> Clear</button>
            </div>
          </div>
          <textarea
            className="source-input"
            value={text}
            onChange={(e) => { setText(e.target.value); setSummary(''); setStats(null) }}
            placeholder="Paste your article, research paper, report, or notes here..."
            maxLength={30000}
            aria-label="Source text"
          />
          <div className="input-footer">
            <span>{words(text).toLocaleString()} words</span>
            <span>{text.length.toLocaleString()} / 30,000 characters</span>
          </div>

          <input ref={fileRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" hidden onChange={(e) => uploadFile(e.target.files?.[0])} />
          <button className="upload-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Upload a TXT or PDF</button>

          <div className="settings-row">
            <label htmlFor="summary-length">SUMMARY LENGTH</label>
            <select id="summary-length" value={length} onChange={(e) => setLength(e.target.value)}>
              <option value="short">Short & concise</option>
              <option value="medium">Balanced</option>
              <option value="long">More detailed</option>
            </select>
          </div>

          <button className="generate-button" onClick={generateSummary} disabled={busy}>
            {busy ? <><LoaderCircle className="spin" size={18} /> Generating summary...</> : <><Sparkles size={17} /> Generate summary <span>→</span></>}
          </button>
          <p className="privacy-note">Runs through your local backend. First use may take longer while the AI model downloads.</p>
        </div>

        <div className="panel output-panel">
          <div className="panel-heading">
            <div className="heading-icon output-icon"><Sparkles size={18} /></div>
            <div><h2>Your summary</h2><p>A clearer version, generated by AI.</p></div>
            {summary && <span className="ready-pill"><CheckCircle2 size={12} /> READY</span>}
          </div>

          {error && <div className="alert error-alert" role="alert">{error}</div>}
          {notice && !error && <div className="alert notice-alert">{notice}</div>}

          {!summary && !busy && (
            <div className="empty-state">
              <div className="empty-art"><div className="art-sheet sheet-back" /><div className="art-sheet sheet-front"><span /><span /><span /><i /></div><div className="art-sparkle"><Sparkles size={20} /></div></div>
              <h3>Your summary will appear here</h3>
              <p>Add a document on the left, choose a length, and let Briefly do the heavy lifting.</p>
              <div className="empty-tip"><Sparkles size={14} /> Tip: start with a few paragraphs for your first test.</div>
            </div>
          )}

          {busy && <div className="loading-state"><LoaderCircle className="spin" size={30} /><h3>Finding the main ideas...</h3><p>Long documents are processed in chunks. CPU summarization may take several minutes; keep this page open.</p></div>}

          {summary && !busy && (
            <div className="result-content">
              <div className="result-label"><span className="result-dot" /> GENERATED SUMMARY</div>
              <p className="summary-text">{summary}</p>
              <div className="result-actions">
                <button className="secondary-button" onClick={copySummary}><Copy size={15} /> Copy</button>
                <button className="secondary-button" onClick={downloadSummary}><Download size={15} /> Download .txt</button>
              </div>
              <div className="stats-grid">
                <div className="stat-card"><span>ORIGINAL WORDS</span><strong>{stats?.original_word_count?.toLocaleString()}</strong></div>
                <div className="stat-card"><span>SUMMARY WORDS</span><strong>{stats?.summary_word_count?.toLocaleString()}</strong></div>
                <div className="stat-card"><span>REDUCTION</span><strong>{compression}%</strong></div>
              </div>
              <div className="quality-note"><span>ⓘ</span><p>AI summaries can omit details or contain errors. Check important facts against the original document.</p></div>
            </div>
          )}
        </div>
      </section>

      <section className="how-section">
        <div className="section-title"><span>THE PROCESS</span><h2>From long-form to just-right.</h2></div>
        <div className="process-grid">
          <article><div className="step-number">01</div><h3>Provide your text</h3><p>Paste content or upload a text-based PDF or TXT file.</p></article>
          <article><div className="step-number">02</div><h3>AI understands context</h3><p>A pretrained transformer processes the input and identifies key ideas.</p></article>
          <article><div className="step-number">03</div><h3>Get your summary</h3><p>Receive a shorter, newly generated version you can copy or save.</p></article>
        </div>
      </section>

      <footer className="footer"><span className="footer-brand">briefly.ai</span><span>Built for learning · Information Retrieval mini-project</span><span>AI-generated content · Verify important facts</span></footer>
    </main>
  )
}
