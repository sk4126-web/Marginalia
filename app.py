import os
import uuid
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from parsers import parse_document
from rag_engine import DocumentStore

app = FastAPI(title="Marginalia - Document Q&A", description="Chat with any document: PDF, Word, Excel, Markdown, and text.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Multi-session store (Session ID -> DocumentStore)
sessions: Dict[str, DocumentStore] = {}
active_session_id: Optional[str] = None

def get_or_create_store(session_id: Optional[str] = None) -> tuple[str, DocumentStore]:
    global active_session_id
    if not session_id or session_id not in sessions:
        sid = session_id or str(uuid.uuid4())[:8]
        sessions[sid] = DocumentStore()
        active_session_id = sid
        return sid, sessions[sid]
    active_session_id = session_id
    return session_id, sessions[session_id]

class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    api_key: Optional[str] = None
    provider: Optional[str] = "auto"

class PasteRequest(BaseModel):
    text: str
    title: Optional[str] = "Pasted Document"
    session_id: Optional[str] = None

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    try:
        content = await file.read()
        filename = file.filename or "Uploaded Document"
        
        parsed = parse_document(content, filename)
        if not parsed["text"].strip():
            raise HTTPException(status_code=400, detail="Could not extract any readable text from this file.")
            
        sid, store = get_or_create_store(session_id)
        summary = store.load_document(filename, parsed)
        
        # Generate starter questions based on file type
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext in ["xlsx", "xlsm", "csv"]:
            suggested = [
                "Summarize the key columns and metrics in this spreadsheet",
                "What are the top numbers or totals shown here?",
                "Which sheet or table contains the primary data?"
            ]
        elif ext == "pdf":
            suggested = [
                "What is the main summary and objective of this document?",
                "List the key conclusions and takeaways",
                "What specific methodologies or findings are discussed?"
            ]
        elif ext in ["docx", "doc"]:
            suggested = [
                "Summarize this document in 3 bullet points",
                "What are the key action items or decisions?",
                "Who or what are the primary subjects mentioned?"
            ]
        else:
            suggested = [
                "Give me a concise summary of this text",
                "What are the most important points?",
                "Extract any dates, names, or numbers mentioned"
            ]

        return JSONResponse({
            "status": "success",
            "session_id": sid,
            "document": summary,
            "preview": parsed["text"][:1200] + ("..." if len(parsed["text"]) > 1200 else ""),
            "suggested_questions": suggested
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.post("/api/paste")
async def paste_document(payload: PasteRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    title = payload.title or "Pasted Text"
    parsed = {
        "text": text,
        "sections": [{"source_ref": "Pasted Document", "content": text}],
        "metadata": {
            "type": "Pasted Text",
            "char_count": len(text)
        }
    }
    sid, store = get_or_create_store(payload.session_id)
    summary = store.load_document(title, parsed)
    
    return JSONResponse({
        "status": "success",
        "session_id": sid,
        "document": summary,
        "preview": text[:1200] + ("..." if len(text) > 1200 else ""),
        "suggested_questions": [
            "Summarize the main idea of this text",
            "What are the core arguments or points?",
            "What questions does this text leave unanswered?"
        ]
    })

@app.post("/api/ask")
async def ask_question(payload: QueryRequest):
    sid = payload.session_id or active_session_id
    if not sid or sid not in sessions or not sessions[sid].chunks:
        raise HTTPException(status_code=400, detail="No document loaded in this session. Please upload or paste a document first.")
        
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    store = sessions[sid]
    result = store.answer_question(
        query=query,
        api_key=payload.api_key,
        provider=payload.provider or "auto"
    )
    result["session_id"] = sid
    return JSONResponse(result)

@app.get("/api/status")
async def get_status(session_id: Optional[str] = None):
    sid = session_id or active_session_id
    if sid and sid in sessions:
        store = sessions[sid]
        return JSONResponse({
            "session_id": sid,
            "has_document": bool(store.chunks),
            "document_name": store.doc_name,
            "total_chunks": len(store.chunks),
            "char_count": len(store.raw_text),
            "metadata": store.metadata
        })
    return JSONResponse({
        "session_id": None,
        "has_document": False,
        "document_name": "",
        "total_chunks": 0,
        "char_count": 0,
        "metadata": {}
    })

@app.get("/api/topics")
async def get_topics(session_id: Optional[str] = None):
    sid = session_id or active_session_id
    if sid and sid in sessions:
        return JSONResponse({"topics": sessions[sid].topics})
    return JSONResponse({"topics": []})

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"message": "Marginalia API is running."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    uvicorn.run("app:app", host=host, port=port, reload=False)
