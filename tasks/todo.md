# Tasks: E-Book to Print & Signature Imposer

> Project lives in `printing-formatter/` (flat `src/`: `imposition.ts`, `pdfImposer.ts`, `App.tsx`).

## Phase 1: Foundation & Imposition Engine
- [x] **Task 1: Project Scaffold & Test Setup**
  - Initialize React + Vite in `book-imposer`
  - Setup Vitest test runner
  - Basic application shell and layout
  - *Verify*: `npm test` and `npm run build` succeeds
- [x] **Task 2: Core Signature Imposition Math Engine**
  - Implement signature calculation math (`imposition.ts`)
  - Configurable sheets per signature (e.g. 4 sheets = 16 pages)
  - Blank padding calculation
  - Front / Back sheet pairing logic
  - *Verify*: `npm test src/utils/imposition.test.ts`
- [x] **Task 3: PDF Imposition & Sheet Labeling Engine**
  - Load source pages via `pdf-lib`
  - 2-up sheet placement (A4 or US Letter target)
  - Margin & gutter adjustments
  - Sheet margin slug lines ("Signature 1 - Sheet 1 - FRONT")
  - *Verify*: `npm test src/services/pdfImposer.test.ts`

### Checkpoint: Foundation
- [x] Imposition math tests pass (incl. every-page-exactly-once invariant)
- [ ] Synthetic sample PDF generates a valid, fold-verified 2-up booklet PDF

---

## Phase 2: Ingestion, Formatting & Page Management
- [x] **Task 4: PDF Ingestion & Interactive Page Deletion**
  - Drag-and-drop PDF dropzone
  - Render page thumbnails with index tags
  - Toggle page selection / deletion
  - Live page & signature count updates
  - Password / encryption alert
  - *Verify*: Exclude pages and check resulting page count

### Checkpoint: Ingestion & Formatting
- [x] Page exclusion updates signature allocation in real-time

---

## Phase 3: Verification, Pre-Flight & Multi-Mode Export
- [x] **Task 6: Pre-Flight Error Checker & Sheet Inspector** (`App.tsx` + `index.css`)
  - Automated pre-flight checklist (gutter width, blank padding count, margins)
  - Interactive 2-up sheet flip viewer (front/back verification with source page numbers)
  - Visual binding fold line and padding leaves
  - *Verify*: Warnings trigger on narrow gutters, viewer displays live sheet mappings
- [x] **Task 7: Multi-Mode Print Export (Duplex, Split Front/Back)** (`pdfImposer.ts` + `App.tsx`)
  - Combined Duplex PDF export (`-imposed.pdf`)
  - Split Front/Back PDFs (`-fronts.pdf` & `-backs.pdf`) for manual turnover
  - In-browser instant download
  - *Verify*: `npm test` checks duplex, fronts, and backs page counts

### Checkpoint: Imposition Complete
- [x] All active tasks implemented and all unit tests pass (9/9)
- [ ] End-to-end user workflow validated from file upload to printed signature test

---

## Phase 4: Book Cover Formatter Module
- [x] **Task 8: Cover Geometry & Dimensions Math Engine** (`src/coverGeometry.ts`)
  - Auto-calculate spine thickness from page count + paper caliper
  - Geometry for Paperback (flush, 5mm opening hinge crease, 3mm bleed)
  - Geometry for Hardcover (3mm board squares, 8mm hinge gap, 20mm turnover wrap)
  - Paper size matcher (finds best standard paper size A4/Letter/A3/Tabloid) and 2-piece split math
  - *Verify*: `npm test src/coverGeometry.test.ts`
- [x] **Task 9: Cover PDF Generator** (`src/coverPdf.ts`)
  - Render full wrap or front-only image placement with `pdf-lib`
  - Draw precision guidelines (cut lines, spine fold creases, board margins, corner trim guides)
  - Support single full-sheet PDF or 2-piece split PDF for standard home printers
  - *Verify*: `npm test src/coverPdf.test.ts`
- [x] **Task 10: Cover Formatter UI & Visual Preview** (`src/App.tsx` + `src/index.css`)
  - Top tab switcher: Signatures Imposer vs Cover Formatter
  - Upload image dropzone (supports front cover or full wrap)
  - Controls: Paperback / Hardcover toggle, spine width auto/override, paper selector
  - Real-time interactive canvas/CSS preview of the wrap with guidelines
  - Direct download buttons: "Download Cover PDF" & "Download 2-Piece Cover (A4/Letter)"
  - *Verify*: All 15 unit tests pass and production build succeeds
