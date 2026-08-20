import io
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
WORKSPACES_DIR = Path(os.getenv("WORKSPACES_DIR", str(BASE_DIR / "workspaces"))).resolve()
WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
AGENT_TIMEOUT = int(os.getenv("AGENT_TIMEOUT", "180"))
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

app = FastAPI(title="Groq Vibe Web", version="0.4.1")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class CreateProjectBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=20000)


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\-_]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value[:36] or "project"


def project_dir(project_id: str) -> Path:
    if not re.fullmatch(r"[a-z0-9\-_]+", project_id):
        raise HTTPException(400, "Project ID không hợp lệ")
    path = (WORKSPACES_DIR / project_id).resolve()
    if WORKSPACES_DIR not in path.parents:
        raise HTTPException(400, "Đường dẫn project không hợp lệ")
    return path


def safe_project_file(project_id: str, rel_path: str) -> Path:
    base = project_dir(project_id)
    target = (base / rel_path).resolve()
    if target != base and base not in target.parents:
        raise HTTPException(400, "Không được truy cập ngoài project")
    return target


def meta_path(project_id: str) -> Path:
    return project_dir(project_id) / ".vibe-meta.json"


def load_meta(project_id: str) -> dict:
    path = meta_path(project_id)
    if path.exists():
        try:
            return json.loads(path.read_text("utf-8"))
        except Exception:
            pass
    return {"id": project_id, "name": project_id, "messages": []}


def save_meta(project_id: str, meta: dict):
    meta_path(project_id).write_text(json.dumps(meta, ensure_ascii=False, indent=2), "utf-8")


def list_files(root: Path):
    ignored = {".git", "node_modules", ".venv", "__pycache__"}
    result = []
    if not root.exists():
        return result
    for p in sorted(root.rglob("*")):
        if any(part in ignored for part in p.relative_to(root).parts):
            continue
        if p.is_file() and p.name != ".vibe-meta.json":
            rel = p.relative_to(root).as_posix()
            result.append({"path": rel, "size": p.stat().st_size})
        if len(result) >= 300:
            break
    return result


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "provider": "Groq API",
        "model": GROQ_MODEL,
        "fallback_models": os.getenv("GROQ_FALLBACK_MODELS", "openai/gpt-oss-20b"),
        "groq_configured": bool(os.getenv("GROQ_API_KEY", "").strip()),
    }


@app.get("/api/projects")
def projects():
    items = []
    for p in sorted(WORKSPACES_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_dir():
            meta = load_meta(p.name)
            items.append({"id": p.name, "name": meta.get("name", p.name)})
    return {"projects": items}


@app.post("/api/projects")
def create_project(body: CreateProjectBody):
    base = slugify(body.name)
    project_id = f"{base}-{uuid.uuid4().hex[:6]}"
    path = project_dir(project_id)
    path.mkdir(parents=True, exist_ok=False)
    (path / "index.html").write_text(
        """<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>New Project</title><style>body{font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#111827;color:#fff}main{max-width:720px;padding:40px}h1{font-size:42px;margin-bottom:12px}p{color:#aeb8cc}</style></head><body><main><h1>Project mới ✨</h1><p>Hãy mô tả website bạn muốn ở khung chat bên trái.</p></main></body></html>""",
        "utf-8",
    )
    meta = {"id": project_id, "name": body.name.strip(), "messages": []}
    save_meta(project_id, meta)
    return meta


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    path = project_dir(project_id)
    if not path.exists():
        raise HTTPException(404, "Không tìm thấy project")
    shutil.rmtree(path)
    return {"ok": True}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    path = project_dir(project_id)
    if not path.exists():
        raise HTTPException(404, "Không tìm thấy project")
    meta = load_meta(project_id)
    meta["files"] = list_files(path)
    return meta


@app.get("/api/projects/{project_id}/file")
def read_file(project_id: str, path: str = Query(..., min_length=1)):
    target = safe_project_file(project_id, path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "Không tìm thấy file")
    if target.stat().st_size > 1_000_000:
        raise HTTPException(413, "File quá lớn để xem")
    try:
        text = target.read_text("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, "Chỉ xem file text")
    return {"path": path, "content": text}


@app.get("/api/projects/{project_id}/download")
def download_project(project_id: str):
    root = project_dir(project_id)
    if not root.exists():
        raise HTTPException(404, "Không tìm thấy project")
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in root.rglob("*"):
            if not p.is_file() or p.name == ".vibe-meta.json":
                continue
            if any(part in {".git", ".venv", "node_modules", "__pycache__"} for part in p.relative_to(root).parts):
                continue
            zf.write(p, p.relative_to(root).as_posix())
    memory.seek(0)
    filename = f"{project_id}.zip"
    return StreamingResponse(
        memory,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/projects/{project_id}/chat")
def chat(project_id: str, body: ChatBody):
    workspace = project_dir(project_id)
    if not workspace.exists():
        raise HTTPException(404, "Không tìm thấy project")
    if not os.getenv("GROQ_API_KEY", "").strip():
        raise HTTPException(503, "Chưa cấu hình GROQ_API_KEY trên server")

    meta = load_meta(project_id)
    history = meta.get("messages", [])[-4:]
    history_text = "\n".join(f"{m.get('role')}: {m.get('content')}" for m in history)
    prompt = body.message
    if history_text:
        prompt = f"Ngữ cảnh chat gần đây:\n{history_text}\n\nYêu cầu mới:\n{body.message}"

    cmd = [sys.executable, str(BASE_DIR / "groq_worker.py"), str(workspace), prompt]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=AGENT_TIMEOUT,
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Groq chạy quá thời gian cho phép")

    lines = [x.strip() for x in proc.stdout.splitlines() if x.strip()]
    payload = None
    for line in reversed(lines):
        try:
            payload = json.loads(line)
            break
        except Exception:
            continue

    if not payload:
        detail = (proc.stderr or proc.stdout or "Không có phản hồi từ worker")[-5000:]
        raise HTTPException(500, detail)
    if not payload.get("ok"):
        code = payload.get("status_code")
        http_status = code if isinstance(code, int) and 400 <= code <= 599 else 500
        raise HTTPException(http_status, payload.get("error", "Groq API lỗi"))

    answer = payload.get("text", "Đã xử lý xong.")
    action = payload.get("action", "chat")
    written = payload.get("written", [])
    deleted = payload.get("deleted", [])
    meta.setdefault("messages", []).extend([
        {"role": "user", "content": body.message},
        {
            "role": "assistant",
            "content": answer,
            "action": action,
            "written": written,
            "deleted": deleted,
            "model": payload.get("model", GROQ_MODEL),
        },
    ])
    meta["messages"] = meta["messages"][-40:]
    save_meta(project_id, meta)
    return {
        "ok": True,
        "answer": answer,
        "action": action,
        "model": payload.get("model", GROQ_MODEL),
        "written": written,
        "deleted": deleted,
        "files": list_files(workspace),
    }


@app.get("/preview/{project_id}")
def preview_root_redirect(project_id: str):
    # Dấu / cuối rất quan trọng: nếu không có, href="style.css" sẽ bị
    # trình duyệt resolve thành /preview/style.css thay vì file của project.
    project_dir(project_id)  # validate project id
    return RedirectResponse(url=f"/preview/{project_id}/", status_code=307)


@app.get("/preview/{project_id}/")
def preview_root(project_id: str):
    target = safe_project_file(project_id, "index.html")
    if not target.exists():
        return HTMLResponse("<h1>Chưa có index.html</h1>", status_code=404)
    return FileResponse(target)


@app.get("/preview/{project_id}/{file_path:path}")
def preview_file(project_id: str, file_path: str):
    target = safe_project_file(project_id, file_path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "Không tìm thấy file")
    return FileResponse(target)
