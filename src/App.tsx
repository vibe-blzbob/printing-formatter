import { PDFDocument } from 'pdf-lib'
import { useRef, useState } from 'react'
import { computeCoverGeometry, LEAF_PRESETS, type CoverSpec, type CoverType } from './coverGeometry'
import { generateCoverPdf } from './coverPdf'
import { enhanceImageForPrint } from './imageEnhance'
import { blankCount, impose, type Sheet } from './imposition'
import { PAPER, imposePdf, type ImposeOptions } from './pdfImposer'
import { renderThumbs } from './thumbs'

export default function App() {
  const [tab, setTab] = useState<'signatures' | 'cover'>('signatures')

  // --- Signature Imposition State ---
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [opts, setOpts] = useState<ImposeOptions>({ sheetsPerSignature: 4, paper: 'A4', gutterMm: 8, marginMm: 8, labels: true })
  const [sheetIdx, setSheetIdx] = useState(0)
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const loadId = useRef(0)

  // --- Cover Formatter State ---
  const [coverType, setCoverType] = useState<CoverType>('hardcover')
  const [imageMode, setImageMode] = useState<'front' | 'wrap'>('front')
  const [rawCoverFile, setRawCoverFile] = useState<File | null>(null)
  const [coverImage, setCoverImage] = useState<{ file: File; dataUrl: string; bytes: Uint8Array } | null>(null)
  const [autoEnhance, setAutoEnhance] = useState(true)
  const [enhancing, setEnhancing] = useState(false)
  const [spineOverride, setSpineOverride] = useState<string>('')
  const [coverBgColor, setCoverBgColor] = useState('#22201e')
  const [manualPages, setManualPages] = useState<number>(160)
  const [coverBusy, setCoverBusy] = useState(false)

  const set = <K extends keyof ImposeOptions>(k: K, v: ImposeOptions[K]) => setOpts(o => ({ ...o, [k]: v }))
  const keep = [...Array(pageCount).keys()].filter(i => !removed.has(i))

  const toggle = (i: number) => setRemoved(r => {
    const n = new Set(r)
    if (!n.delete(i)) n.add(i)
    return n
  })

  async function pick(f: File | undefined) {
    const id = ++loadId.current
    setError(''); setFile(null); setPageCount(0); setThumbs([]); setRemoved(new Set()); setSheetIdx(0)
    if (!f) return
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return setError('Please choose a PDF file.')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer())
      setFile(f); setPageCount(doc.getPageCount())
    } catch (e) {
      return setError(/encrypt/i.test(String(e)) ? 'This PDF is encrypted/DRM-protected and cannot be processed.' : `Could not read PDF: ${(e as Error).message}`)
    }
    try {
      for await (const url of renderThumbs(await f.arrayBuffer())) {
        if (id !== loadId.current) break
        setThumbs(t => [...t, url])
      }
    } catch (e) {
      if (id === loadId.current) setError(`Previews failed (you can still impose): ${(e as Error).message}`)
    }
  }

  async function processCoverFile(f: File, shouldEnhance: boolean) {
    setError('')
    if (shouldEnhance) {
      setEnhancing(true)
      try {
        const { dataUrl, bytes } = await enhanceImageForPrint(f)
        setCoverImage({ file: f, dataUrl, bytes })
      } catch {
        const bytes = new Uint8Array(await f.arrayBuffer())
        const dataUrl = URL.createObjectURL(f)
        setCoverImage({ file: f, dataUrl, bytes })
      } finally {
        setEnhancing(false)
      }
    } else {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const dataUrl = URL.createObjectURL(f)
      setCoverImage({ file: f, dataUrl, bytes })
    }
  }

  async function pickCover(f: File | undefined) {
    if (!f) return
    setRawCoverFile(f)
    await processCoverFile(f, autoEnhance)
  }

  async function toggleEnhance(checked: boolean) {
    setAutoEnhance(checked)
    if (rawCoverFile) {
      await processCoverFile(rawCoverFile, checked)
    }
  }

  async function run(mode: 'duplex' | 'fronts' | 'backs' = 'duplex') {
    if (!file) return
    setBusy(true); setError('')
    try {
      const bytes = await imposePdf(await file.arrayBuffer(), { ...opts, keep, mode })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      const suffix = mode === 'duplex' ? '-imposed' : `-${mode}`
      a.download = file.name.replace(/\.pdf$/i, '') + `${suffix}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Cover calculations
  const effectivePages = keep.length > 0 ? keep.length : manualPages
  const leafPreset = opts.paper === 'A4' ? LEAF_PRESETS.A5 : LEAF_PRESETS.HalfLetter
  const coverSpec: CoverSpec = {
    coverType,
    leafWidthMm: leafPreset.widthMm,
    leafHeightMm: leafPreset.heightMm,
    pageCount: effectivePages,
    spineOverrideMm: spineOverride ? parseFloat(spineOverride) || undefined : undefined,
  }
  const coverGeo = computeCoverGeometry(coverSpec)

  async function downloadCoverPdf(splitTwoSheets = false) {
    setCoverBusy(true); setError('')
    try {
      const bytes = await generateCoverPdf({
        spec: coverSpec,
        imageBytes: coverImage?.bytes ?? null,
        imageMode,
        paperName: splitTwoSheets ? opts.paper : (coverGeo.bestPaperFit?.name || 'A3'),
        splitTwoSheets,
        bgColorHex: coverBgColor,
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      const suffix = splitTwoSheets ? '-cover-split-2page' : '-cover'
      a.download = (file ? file.name.replace(/\.pdf$/i, '') : 'book') + `${suffix}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCoverBusy(false)
    }
  }

  const sheetsList = keep.length ? impose(keep.length, opts.sheetsPerSignature) : []
  const activeSheetIdx = Math.min(sheetIdx, Math.max(0, sheetsList.length - 1))
  const currentSheet = sheetsList[activeSheetIdx]
  const sideData = currentSheet ? currentSheet[previewSide] : null

  // Pre-flight notices
  const warnings: string[] = []
  if (opts.gutterMm < 5) warnings.push('Gutter (<5mm) is tight: thread or glue binding may obscure text in the fold.')
  if (opts.gutterMm > 25) warnings.push('Gutter (>25mm) is very wide: check that printable text is not cramped.')
  if (opts.marginMm < 5) warnings.push('Outer margin (<5mm) may clip on printers without borderless support.')

  const sheets = Math.ceil(keep.length / 4)
  const signatures = Math.ceil(sheets / opts.sheetsPerSignature)

  return (
    <main>
      <header>
        <h1>Printing Formatter</h1>
        <p>Turn an e-book into folded, sewable signatures and physical book covers. 100% in-browser.</p>
      </header>

      <nav className="tab-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'signatures'}
          className={`tab-btn ${tab === 'signatures' ? 'active' : ''}`}
          onClick={() => setTab('signatures')}
        >
          1. Book Signatures
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cover'}
          className={`tab-btn ${tab === 'cover' ? 'active' : ''}`}
          onClick={() => setTab('cover')}
        >
          2. Book Cover Formatter
        </button>
      </nav>

      {tab === 'signatures' ? (
        <>
          <label className="drop" htmlFor="file" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}>
            <input id="file" type="file" accept="application/pdf" onChange={e => pick(e.target.files?.[0])} />
            {file ? <><strong>{file.name}</strong><span>{pageCount} pages · click or drop to replace</span></> : <><strong>Choose a PDF</strong><span>click to browse or drop it here</span></>}
          </label>

          <section className="grid">
            <label>Sheets per signature
              <input id="sheets" type="number" min={1} max={12} value={opts.sheetsPerSignature} onChange={e => set('sheetsPerSignature', Math.max(1, +e.target.value || 1))} />
            </label>
            <label>Paper (Text Block)
              <select id="paper" value={opts.paper} onChange={e => set('paper', e.target.value as ImposeOptions['paper'])}>
                {Object.keys(PAPER).map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label>Gutter (mm)
              <input id="gutter" type="number" min={0} max={40} value={opts.gutterMm} onChange={e => set('gutterMm', +e.target.value)} />
            </label>
            <label>Outer margin (mm)
              <input id="margin" type="number" min={0} max={40} value={opts.marginMm} onChange={e => set('marginMm', +e.target.value)} />
            </label>
            <label className="check">
              <input id="labels" type="checkbox" checked={opts.labels} onChange={e => set('labels', e.target.checked)} /> Front/back labels &amp; fold marks
            </label>
          </section>

          {pageCount > 0 && (
            <p className="stats">
              <b>{keep.length}</b> pages · <b>{signatures}</b> signatures · <b>{sheets}</b> sheets · <b>{sheets * 2}</b> printed sides · <b>{keep.length ? blankCount(keep.length) : 0}</b> blank pages added
            </p>
          )}

          {pageCount > 0 && (
            <section aria-label="Pages">
              <div className="pages-head">
                <h2>Pages <span>click to remove / restore</span></h2>
                {removed.size > 0 && <button id="restore" className="ghost" onClick={() => setRemoved(new Set())}>Restore all ({removed.size})</button>}
              </div>
              <div className="pages">
                {[...Array(pageCount).keys()].map(i => (
                  <button key={i} id={`page-${i + 1}`} className="page" aria-pressed={removed.has(i)} aria-label={`Page ${i + 1}${removed.has(i) ? ' (removed)' : ''}`} onClick={() => toggle(i)}>
                    {thumbs[i] ? <img src={thumbs[i]} alt="" /> : <span className="ph" />}
                    <small>{i + 1}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {warnings.length > 0 && pageCount > 0 && (
            <div className="warnings" role="status">
              <strong>Pre-flight notes:</strong>
              <ul>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {currentSheet && sideData && (
            <section className="sheet-inspector" aria-label="Sheet Preview">
              <div className="sheet-head">
                <h2>Sheet Preview <span>verify folding order</span></h2>
                <div className="sheet-controls">
                  <button
                    type="button"
                    className="ghost"
                    disabled={activeSheetIdx === 0}
                    onClick={() => setSheetIdx(i => Math.max(0, i - 1))}
                    aria-label="Previous sheet"
                  >
                    ◀ Prev
                  </button>
                  <span className="sheet-title">
                    Sig {currentSheet.signature} · Sheet {currentSheet.sheet} of {sheetsList.filter((s: Sheet) => s.signature === currentSheet.signature).length}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={activeSheetIdx >= sheetsList.length - 1}
                    onClick={() => setSheetIdx(i => Math.min(sheetsList.length - 1, i + 1))}
                    aria-label="Next sheet"
                  >
                    Next ▶
                  </button>
                  <div className="side-toggle" role="radiogroup" aria-label="Sheet Side">
                    <button
                      type="button"
                      className={previewSide === 'front' ? 'active' : ''}
                      onClick={() => setPreviewSide('front')}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      className={previewSide === 'back' ? 'active' : ''}
                      onClick={() => setPreviewSide('back')}
                    >
                      Back
                    </button>
                  </div>
                </div>
              </div>

              <div className="sheet-canvas">
                <div className="sheet-leaf">
                  {sideData[0] !== null ? (
                    <>
                      {thumbs[keep[sideData[0]]] ? (
                        <img src={thumbs[keep[sideData[0]]]} alt={`Page ${keep[sideData[0]] + 1}`} />
                      ) : (
                        <span className="ph" />
                      )}
                      <span className="leaf-label">Page {keep[sideData[0]] + 1}</span>
                    </>
                  ) : (
                    <div className="blank-leaf">Blank (Padding)</div>
                  )}
                </div>

                <div className="fold-line" title="Center Fold">
                  <span>FOLD</span>
                </div>

                <div className="sheet-leaf">
                  {sideData[1] !== null ? (
                    <>
                      {thumbs[keep[sideData[1]]] ? (
                        <img src={thumbs[keep[sideData[1]]]} alt={`Page ${keep[sideData[1]] + 1}`} />
                      ) : (
                        <span className="ph" />
                      )}
                      <span className="leaf-label">Page {keep[sideData[1]] + 1}</span>
                    </>
                  ) : (
                    <div className="blank-leaf">Blank (Padding)</div>
                  )}
                </div>
              </div>
              <p className="sheet-meta">
                Signature {currentSheet.signature} · Sheet {currentSheet.sheet} · {previewSide.toUpperCase()}
              </p>
            </section>
          )}

          {error && <p className="error" role="alert">{error}</p>}

          <div className="export-actions">
            <button id="impose-duplex" disabled={!file || busy || keep.length === 0} onClick={() => run('duplex')}>
              {busy ? 'Imposing…' : 'Download Duplex PDF'}
            </button>
            <div className="split-btns">
              <button id="impose-fronts" className="secondary" disabled={!file || busy || keep.length === 0} onClick={() => run('fronts')}>
                Download Fronts (Manual Feed)
              </button>
              <button id="impose-backs" className="secondary" disabled={!file || busy || keep.length === 0} onClick={() => run('backs')}>
                Download Backs (Manual Feed)
              </button>
            </div>
          </div>
          <p className="hint">
            <b>Auto Duplex:</b> Print double-sided, flip on short edge, 100% scale.<br />
            <b>Manual Feed:</b> Print <i>Fronts</i> first, re-insert paper into feed tray, then print <i>Backs</i>.
          </p>
        </>
      ) : (
        /* --- Cover Formatter Section --- */
        <section className="cover-module" aria-label="Book Cover Formatter">
          <label className="drop" htmlFor="coverFile" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickCover(e.dataTransfer.files[0]) }}>
            <input id="coverFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => pickCover(e.target.files?.[0])} />
            {coverImage ? (
              <>
                <strong>{coverImage.file.name}</strong>
                <span>Image loaded · click or drop to replace</span>
              </>
            ) : (
              <>
                <strong>Choose a Cover Picture</strong>
                <span>JPG, PNG, or WebP (Front cover or Full wrap artwork)</span>
              </>
            )}
          </label>

          <section className="grid">
            <div className="options-pair">
              <label>Cover Style
                <select id="coverType" value={coverType} onChange={e => setCoverType(e.target.value as CoverType)}>
                  <option value="hardcover">Hardcover (Case Binding with 20mm Wrap &amp; Squares)</option>
                  <option value="paperback">Paperback (Softcover with 5mm Hinge Creases)</option>
                </select>
              </label>

              <label>Image Placement
                <select id="imageMode" value={imageMode} onChange={e => setImageMode(e.target.value as 'front' | 'wrap')}>
                  <option value="front">Front Cover Only (Auto-fill spine &amp; back)</option>
                  <option value="wrap">Full Wrap-around Artwork</option>
                </select>
              </label>
            </div>

            <label>Page Count {keep.length > 0 && <span className="tag">From PDF</span>}
              <input
                id="coverPages"
                type="number"
                min={4}
                max={2000}
                value={effectivePages}
                disabled={keep.length > 0}
                onChange={e => setManualPages(Math.max(4, +e.target.value || 4))}
              />
            </label>

            <label>Spine Width (mm)
              <input
                id="spineWidth"
                type="number"
                step="0.5"
                min={2}
                max={100}
                placeholder={`Auto: ${coverGeo.spineWidthMm}mm`}
                value={spineOverride}
                onChange={e => setSpineOverride(e.target.value)}
              />
            </label>

            <label>Background Fill Tone
              <input
                id="coverBg"
                type="color"
                value={coverBgColor}
                onChange={e => setCoverBgColor(e.target.value)}
              />
            </label>

            <label className="Leaf Size">
              <span>Leaf Size</span>
              <select value={opts.paper} onChange={e => set('paper', e.target.value as ImposeOptions['paper'])}>
                <option value="A4">A5 Book (from folded A4)</option>
                <option value="Letter">Half-Letter Book (from folded Letter)</option>
              </select>
            </label>

            <label className="check" style={{ gridColumn: '1 / -1' }}>
              <input
                id="autoEnhance"
                type="checkbox"
                checked={autoEnhance}
                onChange={e => toggleEnhance(e.target.checked)}
              />
              Auto-enhance for print (Sharpen fine details &amp; boost ink contrast)
              {enhancing && <span className="tag">Sharpening…</span>}
            </label>
          </section>

          {/* Paper Checker Status Banner */}
          <div className="paper-status">
            <div className="status-row">
              <span>Total Wrap Size:</span>
              <strong>{coverGeo.totalWidthMm} mm × {coverGeo.totalHeightMm} mm</strong>
            </div>
            <div className="status-row">
              <span>Best Single-Sheet Paper:</span>
              <strong className="badge-fit">
                {coverGeo.bestPaperFit ? `${coverGeo.bestPaperFit.name} (100% scale)` : 'Custom / Large Format'}
              </strong>
            </div>
            {coverType === 'hardcover' && (
              <small className="status-note">
                Includes 20mm turnover wrap margin on all edges, 3mm board overhang squares, and 8mm hinge grooves.
              </small>
            )}
            {coverType === 'paperback' && (
              <small className="status-note">
                Includes 3mm outer bleed and 5mm spine opening score creases.
              </small>
            )}
          </div>

          {/* Live Cover Wrap Preview */}
          <div className="cover-preview-box">
            <div className="cover-canvas-wrap" style={{ backgroundColor: coverBgColor }}>
              {/* Turnover guide indicator for hardcover */}
              {coverType === 'hardcover' && <div className="turnover-overlay" title="20mm Turnover Wrap Margin" />}

              {/* Back Cover Leaf */}
              <div className="cover-leaf back-leaf">
                <span>BACK</span>
              </div>

              {/* Spine Area */}
              <div className="cover-spine" style={{ width: `${Math.max(28, coverGeo.spineWidthMm * 3)}px` }}>
                <span className="spine-title">{coverGeo.spineWidthMm}mm</span>
              </div>

              {/* Front Cover Leaf */}
              <div className="cover-leaf front-leaf">
                {coverImage ? (
                  <div className="preview-img-container">
                    <img src={coverImage.dataUrl} alt="Cover Preview" />
                    {autoEnhance && <span className="enhanced-pill">✨ Print-Sharpened</span>}
                  </div>
                ) : (
                  <div className="cover-ph">FRONT ARTWORK</div>
                )}
              </div>
            </div>
            <p className="cover-canvas-meta">
              Flat Cover Wrap Diagram · {coverType.toUpperCase()} ({coverGeo.totalWidthMm} × {coverGeo.totalHeightMm} mm)
            </p>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <div className="export-actions">
            <button
              id="download-full-cover"
              disabled={coverBusy}
              onClick={() => downloadCoverPdf(false)}
            >
              {coverBusy ? 'Generating…' : `Download Full Cover PDF (${coverGeo.bestPaperFit?.name || 'A3'})`}
            </button>

            <div className="split-btns">
              <button
                id="download-split-cover"
                className="secondary"
                disabled={coverBusy}
                onClick={() => downloadCoverPdf(true)}
              >
                Download 2-Piece Split Cover PDF ({opts.paper} Home Printer)
              </button>
            </div>
          </div>
          <p className="hint">
            <b>Single Sheet:</b> Prints full wrap flat on {coverGeo.bestPaperFit?.name || 'A3'} with trim and fold guidelines.<br />
            <b>2-Piece Split:</b> Prints Sheet 1 (Back + 15mm Glue Flap) and Sheet 2 (Spine + Front) on standard {opts.paper} paper.
          </p>
        </section>
      )}
    </main>
  )
}
