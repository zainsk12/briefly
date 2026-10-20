# Project Status

Updated: 2026-10-20

## Current state

The repository contains a working React/Vite interface and FastAPI backend with text summarization, TXT/PDF text extraction, statistics, and copy/download interactions. Dependencies are present in `frontend/node_modules` and import successfully from the host Python 3.10 environment. There is no `backend/.venv`; create one before normal development. The opened folder is not a Git repository (`git rev-parse --show-toplevel` failed), so no commit or GitHub state could be verified.

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

## Files changed

- `frontend/package.json` — corrected production build script.
- `backend/app/main.py` — bounded upload read and extracted-text limit.
- `backend/tests/test_api.py` — mock-based endpoint tests.
- `frontend/src/App.jsx` — clearer long-document CPU inference message.
- `README.md` — setup, architecture, API, IR relevance, and limitations.
- `PROJECT_STATUS.md` — this recovery record.

## Not verified / known limitations

- Real transformer inference was not run. The health result confirms the model is not loaded; cache/download state and checkpoint size were not inspected. First real summary may need a large network download and CPU inference can be slow.
- The test suite mocks the model and does not establish output quality. It covers health, insufficient input, response/statistics, unsupported upload extension, and empty upload.
- The project has no virtual environment and no Git metadata in the opened directory.
- Evaluation is not implemented: no dataset, ROUGE script, or measured results exist.
- Chunk summaries can lose cross-chunk context. OCR, search, ranking, and an inverted index are not implemented.
- No frontend interaction automation or live UI browser check was run; only Vite startup and production compilation were verified.

## Decisions

- Kept the existing DistilBART model and CPU flow; switching model without measured evidence or hardware constraints would be premature.
- Kept model loading lazy so a health check does not trigger a model download.
- Set the extracted text limit to the same 30,000 characters accepted by the summarize endpoint, avoiding successful uploads that the UI/API cannot submit.
- Used Python's built-in `unittest` plus FastAPI's installed test client to avoid adding a test dependency.

## Remaining work, in priority order

1. After the in-progress model download settles, initialize Git version control, inspect staged changes, make the first commit, create a GitHub repository, and push the project. The folder currently has no `.git` metadata. Confirm GitHub CLI/authentication or use the available GitHub connection at that time; never publish secrets, model weights, `.venv`, or `node_modules`.
2. Rename the product from “Briefly AI” / `briefly.ai` to a distinctive name after choosing one with the user; the user noted the current name is already used elsewhere.
3. Create `backend/.venv`, install `backend/requirements.txt`, and rerun tests in the isolated target environment.
4. Add tests for long inputs, all summary-length settings, malformed PDFs, scanned PDFs, file-size boundaries, model failure, and CORS preflight.
5. Add an independently reproducible ROUGE evaluation workflow with an appropriate manageable labelled dataset and measured aggregate results.
6. Improve chunk aggregation/context handling and expose meaningful upload progress/errors.
7. Capture real application screenshots and finalize submission/report materials after UI review.

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
