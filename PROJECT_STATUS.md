# Project Status

Updated: 2026-10-21

## Current state

The project contains a React/Vite interface and FastAPI backend with abstractive text summarization, TXT/PDF text extraction, summary statistics, and copy/download interactions. The selected product name is **Briefly**; the GitHub repository is `https://github.com/zainsk12/briefly`. Git is initialized on `main`. Frontend dependencies are installed locally. The user created `backend/.venv` with Python 3.10 and installed the backend requirements; the six API tests passed earlier under global Python 3.10, but have not yet been rerun inside this virtual environment. Chunk-level progress has been manually confirmed by the user. Cancellation is implemented but has not yet been manually confirmed.

## Completed and verified this session

- Inspected all project source, package configuration, README, and `.gitignore`.
- Fixed `frontend/package.json`: `npm run build` now runs `vite build` instead of launching the development server.
- Hardened `/api/extract-text` to reject unsupported extensions before parsing, read no more than 10 MB plus one byte, and reject extracted text above the API's 30,000-character limit.
- Added five model-mocked API tests in `backend/tests/test_api.py`.
- Rewrote `README.md` with architecture, accurate IR scope, setup commands, API details, limitations, and test/build instructions.
- Added this progress record.
- `python -c "from app.main import app; print(app.title)"` from `backend`: passed.
- `python -m unittest discover -s tests -v` from `backend`: 5 tests passed.
- `npm run build` from `frontend`: production build passed (Vite 6.4.4).
- Started FastAPI with `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`; `/api/health` returned `{"status":"ok","model":"sshleifer/distilbart-cnn-6-6","model_loaded":false}` and `/openapi.json` returned HTTP 200. Server was stopped after verification.
- Started Vite with `npm run dev -- --host 127.0.0.1`; it reported ready at `http://127.0.0.1:5173/`. Server was stopped after verification.
- First sandbox attempts to run Vite failed with `spawn EPERM`; the approved escalated build and development-server runs succeeded.
- Latest PDF summarization investigation: the 4,030-token warning came from tokenizing the full document before chunking, not from sending a 4,030-token sequence to the model. Updated `split_text` to tokenize bounded 256-character windows before packing 850-token inference chunks; updated the UI loading message to set expectations for long CPU runs.
- `python -m unittest discover -s tests -v` after this change: 6 tests passed.
- `npm run build` after this change: passed.
- The user reports that the model download completed and text summarization works. The first model download and CPU inference took a long time; do not treat CPU latency as a regression without measuring it.
- Created the GitHub repository `zainsk12/briefly`, committed the project, and pushed `main` to `origin`. On 2026-10-21, `git status --short --branch` showed `main...origin/main` with no pending changes.
- The user chose to keep the product name Briefly; no product rename is planned.
- The user reports that choosing Balanced and Detailed produced identical summaries. The backend was updated to use distinct generation ceilings and enforced minimum output lengths for Short, Balanced, and Detailed. This code change has not yet been runtime-verified with the downloaded model.
- Added a streaming summarization endpoint that emits section progress and the final result as newline-delimited JSON. The React UI displays section progress and offers cancellation. The user confirmed progress appears during summarization; cancellation still needs a browser check.
- The user confirmed with real model output that Short, Balanced, and Detailed produce different summaries and word counts.
- `backend/.venv/Scripts/python.exe -m py_compile app/main.py`: passed after the streaming endpoint change.
- `npm run build` from `frontend` after the streaming UI change: passed (Vite 6.4.4).

## Files changed

- `frontend/package.json` — corrected production build script.
- `backend/app/main.py` — bounded upload read and extracted-text limit.
- `backend/tests/test_api.py` — mock-based endpoint tests.
- `frontend/src/App.jsx` — clearer long-document CPU inference message.
- `frontend/src/App.jsx` and `frontend/src/styles.css` — streaming progress display and cancel control.
- `backend/app/main.py` — streaming summary endpoint and shared per-chunk generation helpers.
- `README.md` — setup, architecture, API, IR relevance, and limitations.
- `PROJECT_STATUS.md` — this recovery record.

## Not verified / known limitations

- The user has reported a successful real summarization after the initial model download. This was not independently rerun during the 2026-10-21 repository update. CPU inference can be slow, especially for long documents.
- The test suite mocks the model and does not establish output quality. It covers health, insufficient input, response/statistics, unsupported upload extension, and empty upload.
- Different output-length controls for Short, Balanced, and Detailed need a real inference comparison; longer settings can take more CPU time.
- Evaluation is not implemented: no dataset, ROUGE script, or measured results exist.
- Chunk summaries can lose cross-chunk context. OCR, search, ranking, and an inverted index are not implemented.
- No frontend interaction automation or live UI browser check was run; only Vite startup and production compilation were verified.

## Decisions

- Kept the existing DistilBART model and CPU flow; switching model without measured evidence or hardware constraints would be premature.
- Kept model loading lazy so a health check does not trigger a model download.
- Set the extracted text limit to the same 30,000 characters accepted by the summarize endpoint, avoiding successful uploads that the UI/API cannot submit.
- Used Python's built-in `unittest` plus FastAPI's installed test client to avoid adding a test dependency.

## Remaining work, in priority order

1. Run the API checks in `backend/.venv` and manually verify streaming section progress, cancellation, and all three length settings with the downloaded model.
2. Add tests for malformed PDFs, file-size boundaries, model failure, and CORS preflight. Scanned PDF OCR is a separate feature and is not currently supported.
3. Add an independently reproducible ROUGE evaluation workflow with an appropriate manageable labelled dataset and measured aggregate results.
4. Improve chunk aggregation/context handling and add upload progress for large files.
5. Capture final application screenshots and prepare submission/report materials after UI review.

## Resume commands (Windows PowerShell)

From the project root, backend setup:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m unittest discover -s tests -v
python -m uvicorn app.main:app --reload
```

In another terminal from the project root:

```powershell
cd frontend
npm install
npm run build
npm run dev
```

Open `http://localhost:5173`. The first real summarization may download model weights.
