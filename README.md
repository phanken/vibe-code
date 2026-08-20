# Gemini Vibe Web

Web MVP kiểu Lovable/Replit dùng **Google Gemini API** ở backend Python. Bản này được thiết kế để chạy trên **Render Free** mà không cần đăng nhập Antigravity trên server.

## Chức năng

- Tạo nhiều project riêng.
- Chat tiếng Việt để Gemini tạo/sửa code.
- Preview `index.html` ngay bên phải.
- Danh sách file + xem nội dung file.
- Nút **Tải ZIP** để tải code project đã tạo.
- Gemini chỉ trả về nội dung file; backend kiểm tra đường dẫn trước khi ghi. AI không được quyền chạy shell trên server.
- Mặc định dùng `gemini-3.7-flash` và có thể đổi bằng biến `GEMINI_MODEL`.

## 1. Lấy Gemini API key miễn phí

Tạo API key trong Google AI Studio:

https://aistudio.google.com/apikey

Không đưa API key vào file code hoặc GitHub.

## 2. Chạy local

Yêu cầu Python 3.11+ (khuyến nghị Python 3.12).

```bash
python -m venv .venv
```

Windows:

```bat
.venv\Scripts\activate
pip install -r requirements.txt
set GEMINI_API_KEY=YOUR_KEY_HERE
uvicorn app:app --reload --port 8000
```

PowerShell:

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:GEMINI_API_KEY="YOUR_KEY_HERE"
uvicorn app:app --reload --port 8000
```

Mở: `http://127.0.0.1:8000`

## 3. Deploy Render Free

### Cách dễ nhất: GitHub + Render

1. Giải nén project này.
2. Tạo repository GitHub mới.
3. Upload toàn bộ file trong project lên repository.
4. Vào Render -> New -> Blueprint hoặc Web Service.
5. Kết nối repository.
6. Nếu dùng `render.yaml`, Render sẽ nhận sẵn build/start command.
7. Trong **Environment**, thêm:

```text
GEMINI_API_KEY=API_KEY_CUA_BAN
```

8. Deploy.

Build command:

```text
pip install -r requirements.txt
```

Start command:

```text
uvicorn app:app --host 0.0.0.0 --port $PORT
```

Sau khi deploy xong, góc trái giao diện phải hiện kiểu:

```text
gemini-3.7-flash • API OK
```

Nếu hiện `Thiếu GEMINI_API_KEY`, vào Render -> Environment kiểm tra lại key rồi redeploy.

## Biến môi trường

- `GEMINI_API_KEY`: bắt buộc.
- `GEMINI_MODEL`: mặc định `gemini-3.7-flash`.
- `AGENT_TIMEOUT`: mặc định 180 giây.
- `MAX_PROJECT_CONTEXT`: lượng source code tối đa gửi vào model, mặc định 240000 ký tự.
- `WORKSPACES_DIR`: nơi lưu project.

## Lưu ý Render Free

Filesystem của Render Free không phải nơi lưu project lâu dài. Restart/redeploy có thể làm mất project đã tạo. Bản MVP có nút **Tải ZIP** để tải code về máy.

Nếu muốn lưu project vĩnh viễn, bước sau nên thêm MongoDB/S3/GitHub storage hoặc persistent disk.

## Cách AI sửa code

Backend đọc các file text hiện có trong project, gửi context + yêu cầu của bạn cho Gemini, sau đó yêu cầu model trả JSON dạng:

```json
{
  "summary": "Đã làm lại giao diện trang chủ",
  "files": [
    {"path": "index.html", "content": "..."},
    {"path": "style.css", "content": "..."}
  ],
  "delete_files": []
}
```

Backend chỉ cho ghi file bên trong workspace và chặn `.env`, `.git`, `node_modules`, `../`.

## Ghi chú

Preview hiện ưu tiên web tĩnh HTML/CSS/JS để xem ngay. Các project cần Node.js build, database hoặc server riêng sẽ cần thêm một lớp sandbox/build runner ở phiên bản sau.
