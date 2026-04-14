# DEMO_SCRIPT (3-5 phút)

## 0) Setup trước demo
- Chạy toàn bộ stack bằng `scripts/dev-up.ps1`.
- Xác nhận smoke test pass bằng `scripts/smoke-test.ps1`.

## 1) Mở đầu (30s)
- Nêu problem: dữ liệu vi mô phân tán, phản ứng sự cố chậm.
- Nêu solution: Matter + FIWARE + MCP tạo vòng lặp context -> action.

## 2) Kiến trúc (45s)
- Chỉ luồng: device/emulator -> FIMAT -> Orion -> Dashboard/MCP Agent.

## 3) Live scenario (2 phút)
1. Bật tình huống mô phỏng bằng `scripts/demo-scenario.ps1`.
2. Quan sát humidity và activePower tăng bất thường.
3. Dashboard hiển thị alert/risk tăng.
4. Trigger hành động demo: bật đèn cảnh báo hoặc ngắt plug.
5. Xác nhận command ACK thành công.

## 4) Impact (30s)
- Giảm độ trễ phát hiện và phản ứng.
- Có thể scale từ 1 nhà lên nhiều zone.

## 5) Kết luận (30s)
- MVP đã chạy end-to-end.
- Có roadmap production hóa.
