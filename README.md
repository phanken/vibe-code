# Gemini Vibe Web — Chat + Build

Web vibe-coding dùng **Google Gemini API** ở backend Python, thiết kế để chạy trên Render. Bản này có **một ô chat duy nhất**: Gemini tự quyết định lúc nào chỉ trò chuyện và lúc nào cần sửa file project.

## Chức năng

- Tạo nhiều project riêng.
- **Chat bình thường**: hỏi đáp, giải thích code, xin ý tưởng, tìm nguyên nhân lỗi — không tự ý sửa file.
- **Build tự động**: khi bạn yêu cầu tạo/sửa/thêm/xóa/đổi/fix, Gemini cập nhật file project.
- Giữ lịch sử hội thoại để hiểu câu nối tiếp như: `sửa luôn đi`, `đổi nút đó thành màu xanh`.
- Preview `index.html` ngay bên phải; chỉ refresh tự động khi AI thực sự sửa project.
- Danh sách file + xem nội dung file.
- Nút **Tải ZIP** project.
- Nếu Gemini gặp 429/500/503/504, backend retry rồi tự đổi model dự phòng.
- AI không được chạy shell. Backend kiểm tra đường dẫn trước khi ghi file và chặn `.env`, `.git`, `node_modules`, `../`.

## Cách dùng

Ví dụ chỉ trò chuyện:

- `Bạn đang dùng model gì?`
- `Giải thích file app.js cho tôi`
- `Theo bạn trang này nên thêm chức năng gì?`
- `Lỗi này có thể do đâu?`

Các câu sẽ sửa project:

- `Tạo landing page xem phim kiểu Netflix`
- `Thêm menu mobile`
- `Sửa lỗi nút đăng nhập không bấm được`
- `Đổi nền thành tối`
- Sau một gợi ý: `ok sửa luôn đi`

Nếu yêu cầu chưa rõ là muốn áp dụng thay đổi hay chỉ hỏi, AI được hướng dẫn **ưu tiên trả lời, không sửa file**.

## Deploy Render

1. Upload toàn bộ project lên GitHub.
2. Render -> **New -> Blueprint** hoặc **Web Service**.
3. Kết nối repository.
4. Trong Environment thêm:

```text
GEMINI_API_KEY=API_KEY_CUA_BAN
```

`render.yaml` đã có sẵn build/start command.

### Environment mặc định

```text
GEMINI_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_MODELS=gemini-3.7-flash,gemini-3.5-flash,gemini-3.5-flash-lite
GEMINI_RETRIES_PER_MODEL=3
AGENT_TIMEOUT=180
MAX_PROJECT_CONTEXT=240000
```

Nếu Render của bạn đã có biến `GEMINI_MODEL` từ bản cũ, giá trị trong Environment của Render sẽ ghi đè file `render.yaml`; có thể sửa trực tiếp ở Render.

## Chạy local

Python 3.11+:

```bash
python -m venv .venv
```

Windows CMD:

```bat
.venv\Scripts\activate
pip install -r requirements.txt
set GEMINI_API_KEY=YOUR_KEY_HERE
uvicorn app:app --reload --port 8000
```

Mở `http://127.0.0.1:8000`.

## Cách phân biệt Chat / Build

Gemini trả JSON theo schema có trường `action`:

```json
{
  "action": "chat",
  "answer": "...",
  "files": [],
  "delete_files": []
}
```

hoặc:

```json
{
  "action": "build",
  "answer": "Đã thêm menu mobile.",
  "files": [
    {"path": "index.html", "content": "..."}
  ],
  "delete_files": []
}
```

Quan trọng: nếu `action=chat`, backend **bỏ qua mọi file** mà model lỡ trả về, nên một câu hỏi bình thường không thể vô tình ghi đè project.

## Lưu ý Render Free

Filesystem của Render Free có thể mất dữ liệu sau restart/redeploy. Hãy dùng **Tải ZIP** để lưu project. Nếu cần lưu vĩnh viễn, có thể bổ sung MongoDB/S3/GitHub storage sau.
