import { useRef, useState } from 'react'
import { FileText, Sparkles, Upload, Copy, Download, LoaderCircle, RotateCcw, CheckCircle2, X } from 'lucide-react'

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
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileRef = useRef(null)
  const controllerRef = useRef(null)

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
    setProgress({ completed: 0, total: 0, message: 'Connecting to the local summarizer...' })
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const response = await fetch(`${API}/summarize/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, length }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Could not generate a summary.')
      }
      if (!response.body) throw new Error('This browser could not read the progress stream.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let receivedResult = false
      const handleLine = (line) => {
        if (!line.trim()) return
        const event = JSON.parse(line)
        if (event.type === 'status') {
          setProgress({ completed: 0, total: 0, message: event.message })
        } else if (event.type === 'progress') {
          setProgress(event)
        } else if (event.type === 'result') {
          setSummary(event.summary)
          setStats(event)
          receivedResult = true
        } else if (event.type === 'error') {
          throw new Error(event.detail || 'Could not generate a summary.')
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        lines.forEach(handleLine)
        if (done) break
      }
      if (buffer.trim()) handleLine(buffer)
      if (!receivedResult && !controller.signal.aborted) {
        throw new Error('The backend ended the progress stream before returning a summary.')
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setNotice('Summary cancelled. The current model operation may finish before CPU processing stops.')
      } else {
        setError(e.message || 'Unable to connect to the backend. Make sure FastAPI is running on port 8000.')
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      setBusy(false)
      setProgress(null)
    }
  }

  function cancelSummary() {
    controllerRef.current?.abort()
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
              <button className="text-button" disabled={busy} onClick={() => { setText(sampleText); setSummary(''); setStats(null); setError(''); setNotice('Sample text loaded.') }}>Try sample</button>
              <button className="text-button" disabled={busy} onClick={reset}><RotateCcw size={13} /> Clear</button>
            </div>
          </div>
          <textarea
            className="source-input"
            value={text}
            disabled={busy}
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
          <button className="upload-button" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16} /> Upload a TXT or PDF</button>

          <div className="settings-row">
            <label htmlFor="summary-length">SUMMARY LENGTH</label>
            <select id="summary-length" value={length} disabled={busy} onChange={(e) => setLength(e.target.value)}>
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

          {busy && (
            <div className="loading-state">
              <LoaderCircle className="spin" size={30} />
              <h3>{progress?.total ? progress.message : 'Preparing your summary...'}</h3>
              <p>{progress?.total
                ? `${progress.completed} of ${progress.total} sections complete. CPU inference can take time for each section.`
                : progress?.message || 'The model may take longer to load on the first request.'}</p>
              <div className="progress-wrap">
                <div
                  className={`progress-track${progress?.total ? '' : ' progress-track-indeterminate'}`}
                  role="progressbar"
                  aria-label="Summarization progress"
                  aria-valuemin="0"
                  aria-valuemax={progress?.total || 100}
                  aria-valuenow={progress?.total ? progress.completed : undefined}
                >
                  <div
                    className="progress-fill"
                    style={{ width: progress?.total ? `${(progress.completed / progress.total) * 100}%` : undefined }}
                  />
                </div>
                {progress?.total > 0 && <span>{Math.round((progress.completed / progress.total) * 100)}%</span>}
              </div>
              <button className="cancel-button" onClick={cancelSummary}><X size={14} /> Cancel summary</button>
            </div>
          )}

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
