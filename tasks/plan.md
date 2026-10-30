# Implementation Plan: E-Book to Print & Signature Imposer

## Overview
A lightweight, zero-server, client-side web application that transforms digital e-books (PDF and EPUB) into physically printable, signature-bound book formats. It handles DRM detection, typography/margin preparation, page removal, booklet signature calculation (2-up imposition), and generates front/back sheets ready for duplex or manual-feed home printing.

---

## Architecture Decisions
- **Client-Side Processing (Browser-Only)**: Zero server upload. Keeps user files private, eliminates server hosting/bandwidth costs, and works completely offline.
- **PDF Manipulation Engine (`pdf-lib`)**: Pure JavaScript PDF manipulation running in-memory. Fast, dependency-free, handles 2-up imposition, page extraction, and custom slug line labels directly on canvas coordinates without native binary dependencies.
- **EPUB Parser (`jszip` + DOMParser)**: Standard web APIs parse EPUB XHTML files directly. Extracts content and injects print-optimized CSS (Paginating margins, inner gutter space, configurable fonts and line-height).
- **Direct PDF Path vs EPUB Path**:
  - *EPUB*: Format reflowable text with print CSS (margins, font, gutter) -> Render to paginated vector PDF -> Impose.
  - *PDF*: Keep native vector fidelity, bypass lossy conversion -> Delete unwanted pages -> Impose into signatures.
- **Ponytail Ladder Choice**: YAGNI on server infrastructure, complex DeDRM reverse-engineering, or heavy native LaTeX/WeasyPrint engines. Standard browser APIs + `pdf-lib` cover the entire pipeline in under 150kB of runtime code.

---

## Task List

### Phase 1: Foundation & Imposition Engine

#### Task 1: Project Scaffold & Test Setup
- **Description:** Initialize client-side React + Vite project in `book-imposer` with Vitest for automated testing and minimalist modern styling.
- **Acceptance criteria:**
  - Project builds without errors (`npm run build`).
  - Vitest test runner is configured and running (`npm test`).
  - Responsive single-page layout shell with clean UI states (Upload, Config, Preview, Export).
- **Verification:**
  - Tests pass: `npm test`
  - Build succeeds: `npm run build`
  - Manual check: Dev server boots and renders application header and layout.
- **Dependencies:** None
- **Files likely touched:**
  - `book-imposer/package.json`
  - `book-imposer/vite.config.ts`
  - `book-imposer/src/App.tsx`
  - `book-imposer/src/index.css`
- **Estimated scope:** Small (3-4 files)

#### Task 2: Core Signature Imposition Math Engine
- **Description:** Implement pure JavaScript math module calculating signature page mappings (2-up booklet imposition), sheet counts, and blank page padding.
- **Acceptance criteria:**
  - Supports configurable sheets per signature (e.g., 2 sheets = 8 pages, 4 sheets = 16 pages, 5 sheets = 20 pages).
  - Automatically calculates required blank padding pages at the end of the book.
  - Generates exact page pairs for each sheet:
    - Sheet Front (Recto): `[LeftPage, RightPage]`
    - Sheet Back (Verso): `[LeftPage, RightPage]`
  - Unit tests verify signature formulas for various page counts and edge cases (1 page, odd pages, large page count).
- **Verification:**
  - Tests pass: `npm test src/utils/imposition.test.ts`
- **Dependencies:** Task 1
- **Files likely touched:**
  - `book-imposer/src/utils/imposition.ts`
  - `book-imposer/src/utils/imposition.test.ts`
- **Estimated scope:** Small (2 files)

#### Task 3: PDF Imposition & Sheet Labeling Engine
- **Description:** Use `pdf-lib` to load source pages, allocate target sheets (A4 or US Letter), place source pages 2-up with gutter offsets, and print slug lines ("Signature 1 - Sheet 1 - FRONT").
- **Acceptance criteria:**
  - Takes source PDF bytes and imposition plan, generates imposed 2-up PDF bytes.
  - Applies gutter margin adjustment for binding sewing needle clearance.
  - Stamps readable, discreet slug lines on sheet margins (Signature #, Sheet #, FRONT / BACK).
  - Handles blank padding pages cleanly without throwing index errors.
- **Verification:**
  - Tests pass: `npm test src/services/pdfImposer.test.ts`
  - Manual check: Downloaded sample test PDF shows pages correctly ordered for folding.
- **Dependencies:** Task 2
- **Files likely touched:**
  - `book-imposer/src/services/pdfImposer.ts`
  - `book-imposer/src/services/pdfImposer.test.ts`
- **Estimated scope:** Medium (2-3 files)

### Checkpoint: Foundation
- [ ] Imposition math tests pass with 100% coverage on edge cases.
- [ ] Synthetic multi-page PDF generates a valid, fold-tested 2-up booklet PDF.

---

### Phase 2: Ingestion, Formatting & Page Management

#### Task 4: PDF Ingestion & Interactive Page Deletion
- **Description:** Add PDF file dropzone, parse pages with `pdf-lib`, render page thumbnail grid, and allow users to select and delete unwanted pages (covers, blank pages, ads).
- **Acceptance criteria:**
  - Accepts `.pdf` files via drag-and-drop or file picker.
  - Displays thumbnail previews of all pages with page indices.
  - Clicking a page marks it as included or excluded (deleted) from the final print run.
  - Page deletion updates the live active page count and required signature count immediately.
  - Checks if PDF is password-protected or encrypted, providing a clear warning.
- **Verification:**
  - Manual check: Drag a 20-page sample PDF, delete pages 1, 2, and 20, verify output PDF only includes the 17 chosen pages.
- **Dependencies:** Task 3
- **Files likely touched:**
  - `book-imposer/src/components/FileDropzone.tsx`
  - `book-imposer/src/components/PageGrid.tsx`
  - `book-imposer/src/services/pdfLoader.ts`
- **Estimated scope:** Medium (3-4 files)

#### Task 5: EPUB Ingestion, DRM Check & Typography Styler
- **Description:** Implement EPUB unpacking using `jszip`, detect DRM encryption flags, and allow customizable print typography controls (font family, size, line-spacing, margins) before rendering to paginated print layout.
- **Acceptance criteria:**
  - Detects and unpacks standard `.epub` files.
  - Checks `META-INF/encryption.xml`: if commercial DRM is present, cleanly displays a warning and guidance.
  - For DRM-free EPUBs, extracts HTML chapters and provides controls for:
    - Font Family (Serif / Georgia, Sans-serif, Monospace)
    - Font Size (9pt to 14pt)
    - Line Spacing (1.2 to 1.8)
    - Margin / Gutter width (15mm to 30mm)
  - Exports or converts formatted EPUB to normalized printable pages.
- **Verification:**
  - Tests pass: `npm test src/services/epubParser.test.ts`
  - Manual check: Load sample DRM-free EPUB, customize font and margins, observe updated print preview.
- **Dependencies:** Task 4
- **Files likely touched:**
  - `book-imposer/src/services/epubParser.ts`
  - `book-imposer/src/services/epubParser.test.ts`
  - `book-imposer/src/components/TypographyControls.tsx`
- **Estimated scope:** Medium (3-4 files)

### Checkpoint: Ingestion & Formatting
- [ ] Can load both PDF and EPUB files.
- [ ] DRM detection works for protected files.
- [ ] Page removal correctly filters pages before imposition.
- [ ] Typography adjustments render cleanly for print.

---

### Phase 3: Verification, Pre-Flight & Multi-Mode Export

#### Task 6: Pre-Flight Error Checker & Sheet Inspector
- **Description:** Implement an interactive 2-up sheet previewer with automated error checking (gutter warnings, odd page counts, aspect ratio clipping).
- **Acceptance criteria:**
  - Pre-flight checklist evaluates document and displays warnings:
    - Gutter margin check (warns if binding gutter < 10mm).
    - Signature sheet count check (indicates how many blank pages were padded).
    - Page dimension check (warns if page aspect ratio differs significantly from target sheet).
  - Interactive sheet viewer lets user flip through Signature 1 Sheet 1 Front -> Back -> Sheet 2 Front, verifying visual orientation before printing.
- **Verification:**
  - Manual check: Test file with high page count triggers warning if gutter is set too low; sheet viewer shows correct Front/Back labeling.
- **Dependencies:** Task 5
- **Files likely touched:**
  - `book-imposer/src/components/PreflightChecker.tsx`
  - `book-imposer/src/components/SheetViewer.tsx`
  - `book-imposer/src/utils/preflight.ts`
- **Estimated scope:** Medium (3 files)

#### Task 7: Multi-Mode Print Export (Duplex, Split Front/Back, ZIP)
- **Description:** Provide flexible export formats tailored for different printer types: automatic duplex printers, manual-feed single-sided printers, and individual signature files.
- **Acceptance criteria:**
  - Mode 1: **Combined Duplex PDF** (Sheet 1 Front, Sheet 1 Back, Sheet 2 Front, etc. in one file).
  - Mode 2: **Split Front / Back PDFs** (`All_Fronts.pdf` and `All_Backs.pdf` for manual-turnover printers).
  - Mode 3: **Per-Signature Package** (ZIP containing individual signature PDFs for large volume binding projects).
  - Download triggers instantly without server latency.
- **Verification:**
  - Tests pass: `npm test src/services/exportService.test.ts`
  - Manual check: Download each mode and verify page sequences match physical paper feed expectations.
- **Dependencies:** Task 6
- **Files likely touched:**
  - `book-imposer/src/services/exportService.ts`
  - `book-imposer/src/components/ExportModal.tsx`
- **Estimated scope:** Small to Medium (2-3 files)

### Checkpoint: Complete
- [ ] All 7 tasks implemented and all unit tests pass.
- [ ] End-to-end user journey: Drop EPUB/PDF -> Adjust formatting/delete pages -> Choose signature size -> Verify pre-flight -> Export ready-to-print PDFs.
- [ ] Application verified across both Duplex and Manual split print workflows.

---

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Large PDF memory consumption in browser | Medium | Process pages in streaming chunks via `pdf-lib` without keeping redundant canvas bitmaps in RAM. |
| Complex/DRM-encrypted EPUBs | High | Standard detection of `META-INF/encryption.xml`; inform user clearly that DeDRM in Calibre is required for Adobe/Amazon keys. |
| Home printer alignment drift | Medium | Add clear crop/fold guide lines and generous 15mm-25mm outer/inner margins with slug line labels outside the trim box. |
| EPUB pagination differences | Low | Use standard CSS Paged Media and HTML canvas measurement to split chapters into realistic book pages. |

---

## Open Questions
- Default paper format preference: A4 (folded to A5 book) vs US Letter (folded to Half-Letter book)? *(Default will provide a 1-click toggle between A4 and Letter)*.
- Printer slug lines: Should the "Signature X - Sheet Y - Front" text be visible on the folded book margin, or trimmed off? *(Default: Placed in the top/bottom margin trim area with an option to toggle on/off)*.

---

## Ponytail Simplifications (What was skipped, when to add it)
- **Skipped custom backend server & database**: Handled 100% in browser with `pdf-lib` and `jszip`. Add backend only if batch-processing thousands of books concurrently.
- **Skipped full proprietary DRM decryption cracker**: Standard EPUB/PDF parsing + DRM detector. Proprietary FairPlay/Kindle decryption is legally hazardous and brittle; Calibre DeDRM exists for key management.
- **Skipped heavy desktop packaging (Electron)**: Built as a progressive web app (Vite SPA). Add desktop wrapper only if native OS print-spooler hooks are explicitly requested.
