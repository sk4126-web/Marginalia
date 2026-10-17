# Marginalia — Universal Document Q&A

An intelligent document exploration and chat application with exact passage citations, inspired by Marginalia and built to support all document formats.

---

## Supported Formats

Marginalia parses, splits with LangChain, and answers questions from:
* **PDFs (`.pdf`)**: Page-by-page extraction with `pypdf`.
* **Word Documents (`.docx`, `.doc`)**: Structured paragraph extraction with `docx2txt`.
* **Excel Spreadsheets (`.xlsx`, `.xlsm`, `.xls`)**: Multi-sheet parsing, column headers, and tabular markdown structure with `openpyxl`.
* **Spreadsheets & Data (`.csv`, `.tsv`, `.json`)**: Structured table and field parsing.
* **Text & Markdown (`.txt`, `.md`, `.html`)**: Native multi-encoding text decoding.

---

## Getting Started

### 1. Launch Marginalia

Run the launcher script from PowerShell or command prompt:

```powershell
cd "C:\Users\admin\.gemini\antigravity\scratch\marginalia"
python run.py
```
*(Or simply double-click `run.bat`)*

Your browser will automatically open to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## Key Features

1. **Dual-Pane Aesthetic Layout**: Styled with Google Fonts *Fraunces* (editorial serif) and *Instrument Sans*.
2. **Universal Dropzone**: Drag and drop any document or browse files directly.
3. **LangChain Chunking**: Splits large documents into coherent semantic passages (with overlap) while preserving page and sheet context.
4. **Citation Tracking**: Every answer references exact source locations (e.g. `[Page 2]`, `[Sheet: Financial Overview]`) with clickable citation chips.
5. **Flexible AI Engine**:
   - **Local Semantic Extractor (Default)**: 100% free, works offline, requires no API keys.
   - **Google Gemini & OpenAI**: Optional support for Gemini 2.5 Flash and GPT-4o mini via the settings panel.
