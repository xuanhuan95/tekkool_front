# Chấm trên ảnh bài làm (SPT-84)

Giáo viên đặt dấu ✓ / ✗ / ghi chữ lên ảnh bài viết tay của câu tự luận; học sinh xem lại (chỉ xem) khi bài **Đã chấm**.
Design: `design/screens/spt84/CA-*.dc.html`. API: `tekkool_back/docs/api.md` (mục SPT-84).

## File

| File | Việc |
|---|---|
| `src/pages/my/imageMarks.ts` | Logic thuần, không DOM: kiểu `Mark`, quy đổi toạ độ khi xoay, `toPayload`, `markProblem`, `clusterMarks`, `marksOf` |
| `src/pages/my/ImageMarker.tsx` + `image-marker.css` | Trình xem ảnh + công cụ. Không có `onChange` = chỉ xem (học sinh) |
| `src/pages/my/SubmissionDetail.tsx` | Màn chấm của giáo viên (`/my-exams/:id`): giữ nháp dấu, gửi cùng "Lưu điểm" |
| `src/pages/exam/AnswerImages.tsx` | `AnswerImageThumbs` nhận `marks`: mở trình xem có dấu và liệt kê ghi chú dưới hàng ảnh nhỏ |
| `src/pages/exam/ReviewPage.tsx` | Học sinh xem lại: truyền `item.marks` (từ `answers[].marks`) |

## Dữ liệu

- Dấu lưu theo **% trên ảnh gốc chưa xoay** (`x`, `y` từ 0–100). Xoay, phóng to chỉ để xem: dấu vẽ lại theo `imageToDisplay`,
  chạm vào ảnh đã xoay đổi ngược bằng `displayToImage`.
- Gửi: `POST exam/grade/<id>` kèm `marks: {image_id: [{id?, type: 'check'|'cross'|'text', x, y, text?}]}`.
  Chỉ gồm **ảnh giáo viên đã sửa**; mỗi ảnh gửi lên thay toàn bộ dấu của ảnh đó (`[]` = xoá hết). Không sửa gì thì **không có khoá `marks`**.
  Dấu mới chưa có `id` (FE gán `new-N` để làm khoá, `toPayload` bỏ đi); dấu cũ gửi lại kèm `id`. ✓/✗ không mang `text`.
- Đọc: `answers[].marks` (`image_id`, `type`, `x`, `y`, `text`...). Học sinh nhận `[]` khi bài chưa Đã chấm.
- Trần BE: 200 dấu/ảnh, 500 ký tự/ghi chú. FE chặn trước khi gửi (`markProblem`), BE vẫn là nguồn chuẩn (lỗi 400 hiện đúng chữ của BE).
- Dấu **không tự tính điểm**. Ghi chú là chữ thường: hiển thị bằng text của React, không render HTML.

## Hành vi

- **Giáo viên, máy tính ≥ 1024px**: cột trái là ảnh (thanh công cụ ở trên), cột phải là ô điểm, nhận xét và danh sách dấu của ảnh đang xem.
- **Điện thoại**: thanh công cụ dưới ảnh; điểm + nhận xét + danh sách dấu nằm trong bảng kéo lên ("Điểm & nhận xét ▲"). Dấu cách nhau < 5% gom thành chấm số, chạm mở "N dấu ở vị trí này".
- Công cụ: ✓, ✗, ghi chữ (hộp nhập), "Chọn dấu" (không đặt thêm). Cầm công cụ rồi chạm ảnh = đặt; chạm dấu = đổi ✓/✗ hoặc sửa chữ, hoặc xoá. **Chưa có kéo di chuyển dấu**: muốn đổi chỗ thì xoá và đặt lại.
- Phóng to 1 → 1,5 → 2 → 3 lần (cuộn trong khung), xoay 90° từng bước (nhớ theo từng ảnh), ảnh trước/sau, ảnh nhỏ kèm số dấu, toàn màn hình (Esc để thoát; không có trong hộp thoại học sinh).
- **Trạng thái**: đang tải ("Đang tải ảnh…", công cụ khoá); ảnh lỗi ("Không tải được ảnh" + **Thử lại**, vẫn nhập điểm và nhận xét được); lưu lỗi: khung đỏ cạnh nút Lưu điểm với chữ BE trả về, dấu/điểm/nhận xét vẫn còn trên màn hình, bấm Lưu điểm lần nữa là thử lại.
- **Học sinh**: bấm ảnh nhỏ → hộp thoại trình xem (có zoom, xoay, ảnh trước/sau) không có công cụ đặt dấu; bấm ghi chú hiện "Giáo viên: “…”"; danh sách "Ghi chú của giáo viên trên ảnh" dưới hàng ảnh.
- Giáo viên chủ đề sửa dấu sau khi đã chấm như sửa điểm; BE gửi email báo học sinh (một mail mỗi lần Lưu).

## Test

`imageMarks.test.ts` (quy đổi xoay, payload, giới hạn, gom dấu), `ImageMarker.test.tsx` (đặt/sửa/xoá dấu, xoay rồi chạm, gom dấu, ảnh lỗi + thử lại, bố cục máy tính, học sinh không có công cụ và ghi chú là text thuần),
`SubmissionDetail.test.tsx` (payload `exam/grade`, lỗi BE giữ dấu, không có `marks` khi không sửa), `AnswerImages.test.tsx` (học sinh xem lại).
