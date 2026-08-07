# Open Office Ai

An advanced, AI-native office suite for macOS and Windows featuring a word processor, spreadsheet, presentations, and PDF viewer. 

Open Office Ai is an independent fork of **GenOffice**, created and published by Dr. Ing. Benetti Mauro A. under the Apache License 2.0. It builds on GenOffice's substantial foundation—including its byte-preserving OOXML engines, rendering fidelity, and document editors—and introduces a comprehensive set of powerful new features, custom configurations, and a refined look and feel.

---
![Screenshot](./ing/Screenshot.png)

## Downloads

Get the latest version of Open Office Ai for your platform:

* 🍏 **macOS (Apple Silicon):** [Download DMG](https://github.com/mbenetti/Open-Office-Ai/releases/download/v1.0.0/Open.Office.Ai-1.0.0-arm64.dmg)
* 🪟 **Windows (x64):** [Download Installer](https://github.com/mbenetti/Open-Office-Ai/releases/download/v1.0.0/Open.Office.Ai.Setup.1.0.0.exe)
* 🐧 **Linux (AppImage):** [Download AppImage](https://github.com/mbenetti/Open-Office-Ai/releases/download/v1.0.0/Open.Office.Ai-1.0.0-arm64.AppImage)
* 🐧 **Linux (Debian/Ubuntu):** [Download DEB](https://github.com/mbenetti/Open-Office-Ai/releases/download/v1.0.0/Open.Office.Ai-1.0.0-arm64.deb)


## Key Features & Enhancements

### 1. LLM-Assisted Multi-Location Editing
* **Multi-Selection Context**: When selecting multiple cells in Sheets, multiple paragraphs in Word, or multiple elements in PowerPoint/PDF, the entire selection is packaged and sent to the LLM. This allows the AI to answer questions across multiple contexts simultaneously (e.g., answering a question in one cell based on the content of another).
* **Byte-Preserving Round Trip**: Manual and AI edits are applied as surgical patches. Only dirty paragraphs or cells are modified, keeping the rest of the original file byte-for-byte identical. Opening, editing, and saving never breaks original layouts, tracked changes, comments, styles, or equations.

### 2. Knowledge Base & Collection Management
* **Collection Workspace**: Create, rename, delete, and organize knowledge bases (collections) directly from the unified Upload Document tab.
* **SQLite Storage**: All knowledge base metadata, collection structures, document indices, and chat histories are persisted locally in a robust SQLite database.
* **Navigation Tree**: Navigate your knowledge bases and documents using an intuitive left-panel tree structure.
* **Document Preview & TOC**: Preview complete documents or individual chunks. Document previews feature an interactive, clickable Table of Contents (TOC) on the left panel for rapid navigation.

![Screenshot](./ing/Screenshot2.png)

### 3. Domain-Specific RAG (Retrieval-Augmented Generation)
* **Local Embeddings & Vector Search**: Document chunks are vectorized using your configured embedding provider (e.g., OpenAI or local Ollama `nomic-embed-text`) and stored locally for high-performance semantic vector search.
* **Multi-Collection Selection (One or More KBs)**: Filter RAG queries by selecting one, multiple specific collections, or searching across all collections simultaneously. The chatbot UI allows users to toggle specific collections on demand, feeding only relevant, highly-targeted chunks to the LLM.
* **Semantic Workbench**: A dedicated tab ("Semantic workbench") allows you to run semantic retrieval queries, inspect chunks, and analyze vector storage results.

### 4. Reusable AI Skills (Slash Commands)
* **Skills Library**: Create, modify, and delete reusable AI skills in a dedicated tab.
* **Slash Autocomplete**: Recall skills on demand in the chatbot using the `/` command. Autocomplete lists available skills as you type (e.g., typing `/R` filters down to `/RFx_Analyzer`), preventing typing mistakes.

### 5. LLM & Embedding Configuration Providers
* **Custom Endpoints**: Configure custom OpenAI-compatible endpoints, local Ollama instances, and API keys for both LLM reasoning and embedding models.
* **Ollama & vLLM Integration**: First-class, dedicated providers for local Ollama and vLLM endpoints with dynamic placeholders, automatic default base URLs, and key-free execution support across all editors (Docs, Sheets, Slides, PDF).
* **Disable Thinking**: A robust, multi-level "Disable Thinking" option configurable directly from the LLM Endpoint settings panel. It sends the official `"think": false` parameter to Ollama, `"chat_template_kwargs"` / `"extra_body"` to vLLM, prepends special no-thinking tokens (such as `<no_thinking>`, `<not_think>`) to Qwen models, and uses a stateful stream filter to strip `<think>...</think>` blocks on the fly.
* **Privacy & Control**: Run fully local models or connect to your preferred cloud providers.

![Screenshot](./ing/Screenshot3.png)

### 6. Refined Look and Feel
* **Open Office Ai Branding**: Complete custom branding, including the Open Office Ai logo and accent palettes.
* **Welcome Page Theme**: Toggle between Dark and Light modes for the welcome/home screen. Document editors maintain their clean, white document interfaces.
* **Collapsible Ribbon**: Double-click any ribbon tab to collapse or expand the toolbar, maximizing your vertical screen space.
* **Chat Font Zoom**: Increase or decrease the chat font size using `+A` and `-A` buttons in the header. The `-A` button is styled smaller than `+A` as an intuitive visual clue.
* **Dropdown Gating**: The previous-chats dropdown is anchored to the panel header and clamped to the panel width, ensuring it remains fully visible and never overflows the app window.
* **Unified RAG UI**: The PDF viewer's chatbox has been updated to use the modern database cylinder SVG icon and Segmented Control button group, aligning its look and feel perfectly with Docs and Sheets.

![Screenshot](./ing/Screenshot4.png)

### 7. Fidelity & State Preservation
* **Zoom Preservation**: Captures and restores per-sheet zoom levels across save and auto-save reopens, preventing the view from resetting to 100% when the sidecar session reloads.
* **Font Inheritance**: AI-written cells automatically inherit the document's font (scanning the column above and row left, down to row 0 and column 0), respecting the document's manual formatting.
* **Parser Fidelity**: Fixed PDF parser line-break bugs to prevent empty lines from being inserted between sentences during chunking.

---

## Apps

| App | Product | What it is |
| --- | --- | --- |
| `apps/docs` | **Open Office Ai Docs** | `.docx` word processor. Byte-preserving paragraph patching, paginated layout metrics, tracked changes, comments, styles, equations, and ink. |
| `apps/sheets` | **Open Office Ai Sheets** | `.xlsx` spreadsheet. Built on [Univer](https://github.com/dream-num/univer) core (Apache-2.0) with custom extensions. Import/export runs through an in-house Rust sidecar (`calamine` + `IronCalc`), custom Konva charts, pivot tables, slicers, conditional formatting, and formula tracing. |
| `apps/slides` | **Open Office Ai Slides** | `.pptx` presentations. In-house parse/render/edit engine with masters, charts, cropping, ink, and HarfBuzz text metrics. |
| `apps/pdf` | **Open Office Ai PDF** | PDF viewer/editor on pdf.js + pdf-lib: annotations, forms, outlines, stamps, signatures, page operations, and print. |
| `apps/shell` | **Open Office Ai** | The suite shell: welcome home screen, tabbed hosting of the four editors, settings, and auto-update. |

---

## Engine Packages

All pure TypeScript, no Electron dependency, fully unit-tested:

* `packages/docx-engine` — docx parsing → block tree (with `docxIndex` anchors), OOXML fragment generation, byte-level paragraph patching.
* `packages/pptx-engine` / `packages/pptx-render` — pptx model and rendering.
* `packages/file-parse` — text extraction for AI attachments (office formats, PDF, markdown).
* `packages/agent-core` — the AI agent loop and skill composition shared by every app.
* `packages/ai-provider` — provider abstraction and streaming for the model backends.
* `packages/ai-search` — auth + web/image search tools.
* `packages/project-store` — recent-files store, chat-history database, and project-timeline aggregator.
* `packages/ui` — shared React UI kit (AI composer, typing indicators, icons, formatters).
* `packages/electron-utils` — shared main-process helpers, context menus, and external-link gating.

---

## Development & Building

### Prerequisites
* **Node.js**: `>= 20`
* **Rust Toolchain**: `cargo` on PATH (required for the Sheets xlsx sidecar)
* **MinGW-w64**: Required on macOS for cross-compiling the Windows sidecar (`brew install mingw-w64`)

### Commands
```bash
# Install dependencies
npm install

# Generate test .docx fixtures
npm run fixtures

# Run engine + app unit tests
npm test

# Run type checking across all workspaces
npm run typecheck

# Run all four editors + shell in development mode
npm run dev

# Package macOS DMG (unsigned/un-notarized by default)
npm run dist:mac

# Package Windows NSIS Installer (cross-compiled from macOS)
npm run dist:win
```

---

## Acknowledgments

Open Office Ai is an independent fork of GenOffice under the Apache License 2.0.

We are grateful to GenOffice contributors for opening the substantial foundation this fork builds on: the document, spreadsheet, presentation, and PDF applications; the OOXML engines; the rendering and round-trip fidelity work; and the original AI integration.

---

## License

Open Office Ai is licensed under the [Apache License 2.0](LICENSE). The GenOffice and Genspark names and logos are trademarks of Mainfunc, Inc. This fork uses its own custom branding and logos.
