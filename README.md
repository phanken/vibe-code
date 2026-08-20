# Groq Vibe Web — Chat + Build

Web vibe-coding dùng **Groq API** ở backend Python/FastAPI, chạy được trên Render. Một ô chat duy nhất: AI tự chọn lúc nào chỉ trò chuyện và lúc nào cần sửa project.

## Model mặc định

- `openai/gpt-oss-120b` cho Chat + Build.
- Fallback: `openai/gpt-oss-20b`.
- Cả hai hỗ trợ Groq Structured Outputs strict JSON, giúp kết quả tạo/sửa file ổn định hơn.

## Có gì

- Tạo/xóa nhiều project.
- Chat bình thường không đụng file.
- Yêu cầu tạo/sửa/thêm/xóa/fix -> AI cập nhật file.
- Giữ lịch sử hội thoại gần đây.
- Preview `index.html` và asset tương đối đúng đường dẫn.
- Xem source từng file.
- Tải project thành ZIP.
- Workspace sandbox: không cho AI sửa `.env`, `.git`, `node_modules`, `.vibe-meta.json` hoặc thoát bằng `../`.
- Retry rate-limit/lỗi tạm thời và fallback model.

## Deploy Render

1. Upload toàn bộ file trong thư mục này lên GitHub.
2. Render -> **New -> Blueprint** (dùng `render.yaml`) hoặc Web Service.
3. Thêm Environment Variable:

```text
GROQ_API_KEY=gsk_xxxxxxxxx
```

4. Deploy.

Nếu tạo Web Service thủ công:

```text
Build Command: pip install -r requirements.txt
Start Command: uvicorn app:app --host 0.0.0.0 --port $PORT
```

## Environment tùy chọn

```text
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODELS=openai/gpt-oss-20b
GROQ_RETRIES_PER_MODEL=2
GROQ_MAX_OUTPUT_TOKENS=32768
AGENT_TIMEOUT=180
MAX_PROJECT_CONTEXT=220000
```

## Chạy local

Windows CMD:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set GROQ_API_KEY=YOUR_KEY_HERE
uvicorn app:app --reload --port 8000
```

Mở `http://127.0.0.1:8000`.

## Lưu ý Render Free

Workspace nằm trên filesystem local của service nên có thể mất sau restart/redeploy. Hãy dùng nút **Tải ZIP** để sao lưu. Muốn lưu lâu dài cần thêm GitHub/MongoDB/object storage.
