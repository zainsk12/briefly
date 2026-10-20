import os
import json
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pypdf import PdfReader
from transformers import pipeline
from starlette.concurrency import run_in_threadpool

MODEL_NAME = os.getenv("SUMMARIZATION_MODEL", "sshleifer/distilbart-cnn-6-6")

app = FastAPI(
    title="Abstractive Summarization API",
    description="CPU-compatible abstractive text summarization for an Information Retrieval mini-project.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=80, max_length=30000)
    length: Literal["short", "medium", "long"] = "medium"


class SummarizeResponse(BaseModel):
    summary: str
    original_word_count: int
    summary_word_count: int
    compression_percent: float
    model: str


def length_settings(length: str) -> dict[str, float | int]:
    return {
        "short": {"max_length": 70, "min_length": 8, "min_ratio": 0.08},
        "medium": {"max_length": 130, "min_length": 16, "min_ratio": 0.16},
        "long": {"max_length": 200, "min_length": 24, "min_ratio": 0.28},
    }[length]


def summarize_chunk(chunk: str, tokenizer, summarizer, settings) -> str:
    input_tokens = len(tokenizer.encode(chunk, add_special_tokens=True))
    if input_tokens < 35:
        return chunk

    requested_min = max(
        settings["min_length"],
        int(input_tokens * settings["min_ratio"]),
    )
    min_length = min(
        requested_min,
        settings["max_length"] - 5,
        max(5, input_tokens - 5),
    )
    result = summarizer(
        chunk,
        max_length=settings["max_length"],
        min_length=min_length,
        do_sample=False,
        truncation=True,
    )
    return result[0]["summary_text"].strip()


def make_summary_response(text: str, partial_summaries: list[str]) -> SummarizeResponse:
    summary = " ".join(partial_summaries).strip()
    original_words = len(text.split())
    summary_words = len(summary.split())
    compression = round(max(0.0, (1 - summary_words / max(original_words, 1)) * 100), 2)
    return SummarizeResponse(
        summary=summary,
        original_word_count=original_words,
        summary_word_count=summary_words,
        compression_percent=compression,
        model=MODEL_NAME,
    )


def stream_event(event: dict) -> str:
    return json.dumps(event, ensure_ascii=False) + "\n"


@lru_cache(maxsize=1)
def get_summarizer():
    # Device -1 explicitly selects CPU; no CUDA/GPU is required.
    return pipeline("summarization", model=MODEL_NAME, device=-1)


def split_text(text: str, tokenizer, max_tokens: int = 850) -> list[str]:
    """Tokenize bounded text windows, then form model-safe chunks.

    Encoding the entire document in one call makes some tokenizers emit a
    maximum-sequence-length warning even though inference below is chunked.
    Small character windows avoid that warning while preserving the token
    sequence for chunk construction.
    """
    token_ids = []
    window_size = 256
    for start in range(0, len(text), window_size):
        window = text[start:start + window_size]
        token_ids.extend(tokenizer.encode(window, add_special_tokens=False))
    if not token_ids:
        return []
    chunks = []
    for start in range(0, len(token_ids), max_tokens):
        chunk_ids = token_ids[start:start + max_tokens]
        chunks.append(tokenizer.decode(chunk_ids, skip_special_tokens=True))
    return chunks


@app.get("/api/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "model_loaded": get_summarizer.cache_info().currsize > 0}


@app.post("/api/summarize", response_model=SummarizeResponse)
def summarize(payload: SummarizeRequest):
    text = payload.text.strip()
    if len(text.split()) < 25:
        raise HTTPException(status_code=422, detail="Please provide at least 25 words for a useful summary.")

    try:
        summarizer = get_summarizer()
        tokenizer = summarizer.tokenizer
        chunks = split_text(text, tokenizer)
        if not chunks:
            raise HTTPException(status_code=422, detail="No readable text was provided.")

        settings = length_settings(payload.length)
        partial_summaries = []
        for chunk in chunks:
            partial_summaries.append(summarize_chunk(chunk, tokenizer, summarizer, settings))
        return make_summary_response(text, partial_summaries)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Summarization failed. Check model download/network access and backend logs. ({type(exc).__name__})",
        ) from exc


@app.post("/api/summarize/stream")
async def summarize_stream(payload: SummarizeRequest, request: Request):
    text = payload.text.strip()
    if len(text.split()) < 25:
        raise HTTPException(status_code=422, detail="Please provide at least 25 words for a useful summary.")

    async def events():
        try:
            yield stream_event({"type": "status", "message": "Loading the local summarizer..."})
            summarizer = await run_in_threadpool(get_summarizer)
            tokenizer = summarizer.tokenizer
            chunks = await run_in_threadpool(split_text, text, tokenizer)
            if not chunks:
                yield stream_event({"type": "error", "detail": "No readable text was provided."})
                return

            total = len(chunks)
            yield stream_event({
                "type": "progress",
                "completed": 0,
                "total": total,
                "message": f"Document split into {total} section{'s' if total != 1 else ''}.",
            })
            settings = length_settings(payload.length)
            partial_summaries = []
            for index, chunk in enumerate(chunks, start=1):
                if await request.is_disconnected():
                    return
                yield stream_event({
                    "type": "progress",
                    "completed": index - 1,
                    "total": total,
                    "message": f"Summarizing section {index} of {total}...",
                })
                partial = await run_in_threadpool(
                    summarize_chunk, chunk, tokenizer, summarizer, settings
                )
                partial_summaries.append(partial)
                yield stream_event({
                    "type": "progress",
                    "completed": index,
                    "total": total,
                    "message": f"Finished section {index} of {total}.",
                })

            if await request.is_disconnected():
                return
            response = make_summary_response(text, partial_summaries)
            yield stream_event({"type": "result", **response.model_dump()})
        except Exception as exc:
            yield stream_event({
                "type": "error",
                "detail": f"Summarization failed. Check model download/network access and backend logs. ({type(exc).__name__})",
            })

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from .txt or text-based .pdf files."""
    filename = (file.filename or "").lower()
    if not filename.endswith((".txt", ".pdf")):
        raise HTTPException(status_code=415, detail="Only .txt and text-based .pdf files are supported.")

    # Read at most one byte beyond the cap so oversized uploads are rejected
    # without buffering an unbounded request body in memory.
    raw = await file.read(10 * 1024 * 1024 + 1)
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Please upload a file smaller than 10 MB.")

    try:
        if filename.endswith(".txt"):
            extracted = raw.decode("utf-8-sig", errors="replace")
        elif filename.endswith(".pdf"):
            reader = PdfReader(BytesIO(raw))
            extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            raise HTTPException(status_code=415, detail="Only .txt and text-based .pdf files are supported.")

        extracted = extracted.strip()
        if not extracted:
            raise HTTPException(status_code=422, detail="No selectable text was found. Scanned PDFs need OCR, which is not included yet.")
        if len(extracted) > 30000:
            raise HTTPException(status_code=413, detail="This file contains more than 30,000 characters. Please use a shorter document.")
        return {"filename": Path(filename).name, "text": extracted, "word_count": len(extracted.split())}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this file. Try another text-based PDF or UTF-8 text file.") from exc
