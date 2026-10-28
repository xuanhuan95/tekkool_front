# Luồng màn làm bài (`/do-exam/:examId`)

File: `src/pages/exam/` — `TakeExam.tsx` (mở đề, lỗi), `ExamRoom.tsx` (phòng thi), `paper.ts` (dựng đề, ánh xạ đáp án), `answerSaver.ts` (tự lưu), `useCountdown.ts`, `QuestionView.tsx`, `SubmitDialog.tsx`, `stripLabel.ts`. Gọi API: `src/queries/examSession.ts`. Component hiển thị: `src/components/ui/exam/` ([components.md](components.md)).

Nguyên tắc: **cả đề trên một trang** (không có câu trước/câu sau), đồng hồ theo **server**, **không mất bài** khi mất mạng hay F5, **không nộp hai lần**, **không trừ lượt oan**.

## 1. Mở đề

```
TakeExam ──GET exam/during_test/<id>[?lam_lai=1]──► BE
```

- Gọi **đúng một lần** mỗi lần vào trang, gọi thẳng qua `Api`, **không** qua react-query (RULES.md §3): mở đề có thể mở lượt mới và **trừ 1 lượt**, nên không được tự thử lại hay refetch. Lỗi mạng → thẻ lỗi + nút "Thử lại" do học sinh bấm.
- `?lam_lai=1`: học sinh **chủ động** bấm "Bắt đầu làm bài" ở chi tiết đề → BE được phép mở lượt mới. Phải là `?` (api.ts tự nối `&token=`). Mở được lượt rồi thì FE **xoá `lam_lai` khỏi URL**, để F5 sau đó là tiếp tục lượt đang mở chứ không xin lượt mới.
- Không có `lam_lai` mà BE thấy học sinh vừa nộp đề này (trong 15 phút) → BE trả **bài vừa nộp** (`da_nop: true`) thay vì đề → FE chuyển sang `/result/<id>`. Đây là đường F5 ngay sau khi nộp — không trừ lượt.
- Lỗi khi mở:

| Mã | Ý nghĩa | FE |
|---|---|---|
| 402 | Hết lượt | Hộp "Bạn đã hết lượt thi" (`OutOfTurnsModal`): "Xem gói thi" → `/packages?het-luot=1`, "Để sau" → `/exams/<id>`. BE từ chối **trước** khi trừ lượt. |
| 409 | Ngân hàng không đủ khối / nhiều yêu cầu vào thi cùng lúc | Hiện nguyên câu của BE + "Thử lại" |
| khác / mất mạng | | Thẻ lỗi + "Thử lại" + "Về trang chủ" |

## 2. Dựng đề (`paper.ts` → `buildPaper`)

- 4 dạng SPT theo `Question.type`: `MultipleChoice`, `ErrorIdentify` → trắc nghiệm; `TrueFalse` → Đúng/Sai; `ShortAnswer`, `FillBlank` → trả lời ngắn; `FreeAnswer` → tự luận. Câu có `data` rỗng bị bỏ (như màn cũ).
- **Gom Đúng/Sai:** trong DB mỗi **ý** là một Question `TrueFalse`; các ý **liền nhau cùng `data.passageId`** là **một câu** (a, b, c, d), thân câu = `data.passage`. Đúng luật chấm của BE (`core_grading.grade_items`). Ý lẻ không có passage = câu một ý.
- Đánh số câu liên tục qua các phần (Câu 1…23). Mỗi section = một phần: tiêu đề "Phần I · <tên>" (giữ nguyên nếu giáo viên đã viết "Phần …"), ghi chú "Câu 1–12 · 0,25 điểm/câu · …" (điểm chỉ hiện khi đề ghi `max_score`).
- **Đoạn văn dùng chung** (Đọc hiểu): `Passage` in một lần trước câu đầu nhóm cùng `passageId`.
- **Nhãn của đề import:** nội dung từ Word thường có sẵn "Câu 1." ở đầu thân câu và "a)" ở đầu ý → `stripLabel.ts` cắt **chỉ ở đầu đoạn đầu tiên** (không cắt nếu đầu là ảnh/công thức, ý chỉ cắt đúng chữ cái của nó, không cắt nếu cắt xong rỗng). Áp dụng cả ở màn xem lại.
- Nội dung đề luôn qua `renderHTML` (lọc XSS + KaTeX + ảnh).

## 3. Đáp án và tự lưu

- State đáp án giữ theo **id câu thô** (cái `exam/save_answer/<qid>` lưu và `markedAnswer` trả lại): trắc nghiệm lưu **nội dung** phương án (`value`, như màn cũ — chấm điểm và màn GV đọc theo đó; đọc lại chấp nhận cả id); Đ/S lưu từng ý `'true'` / `'false'`, bấm lại ý đang chọn = `''` (xoá); trả lời ngắn = chuỗi; tự luận = HTML của TipTap.
- **`AnswerSaver` (`answerSaver.ts`)**:
  - Bấm chọn → gửi ngay; gõ chữ → chờ 0,8 s ngừng gõ (tự luận thêm 0,5 s của Editor).
  - Mỗi câu chỉ **một request đang bay**; giá trị mới hơn đợi request cũ xong rồi mới gửi → đáp án cũ không bao giờ đè đáp án mới.
  - Mất mạng / lỗi 5xx: giữ đáp án, trạng thái **"Mất kết nối"**, thử lại giãn dần 1 s → 15 s, và thử ngay khi trình duyệt báo có mạng (`online`).
  - Đáp án chưa lưu được ghi vào `localStorage` (`vt-exam-pending:<examId>`, kèm hạn nộp). F5 lúc mất mạng: lấy lại và gửi tiếp. Bản ghi của lượt đã quá hạn bị bỏ.
  - `409` từ save_answer = **server báo hết giờ** → khoá bài, tự nộp. `403` = không còn lượt mở (đã nộp ở tab khác) → nộp để lấy kết quả. `400` (quá dài) → báo lỗi, không thử lại.
- Trạng thái hiện ở cuối đề / cột phải: "Đang lưu…", "Đã lưu tự động lúc 20:41", "Mất kết nối — đáp án được giữ trên máy…" (+ dải vàng dưới header).
- Rời trang khi còn đáp án chưa lưu → trình duyệt hỏi lại (`beforeunload`).
- "Xem lại sau" (cờ) chỉ ở máy: `localStorage` `vt-exam-flags:<examId>`, xoá khi nộp.

## 4. Đồng hồ (`deadlineFrom` trong `TakeExam.tsx`, `useCountdown.ts`)

- Hạn nộp lấy từ server, chốt **một lần** khi tải đề:
  1. `expires_at` (UTC, có `Z`) — hạn thật của lượt;
  2. nhưng nếu đồng hồ máy lệch quá **30 s** so với `remaining_sec` của server (điện thoại cài sai giờ) → dùng `bây giờ + remaining_sec`;
  3. không có lượt (giáo viên làm thử đề của mình) → `duration_min` / `duration`; 0 = "Không giới hạn".
- Mỗi giây tính lại từ `Date.now()` (không trừ dần), và tính lại khi tab hiện lại → tab nền bị bóp hay máy ngủ dậy vẫn đúng.
- Còn ≤ 5 phút: đồng hồ đỏ + dải "Còn dưới 5 phút — bài sẽ tự nộp khi hết giờ".
- Về 0: **khoá bài** (không sửa được) + tự nộp, **không hỏi xác nhận**. BE vẫn nhận đáp án gửi trễ ≤ 10 s sau hạn.

## 5. Nộp bài

- Nút "Nộp bài" (header, cuối đề, cột phải, sheet) → hộp **"Nộp bài?"**: đã làm x/N, chip các câu chưa làm (bấm để quay lại câu đó), số câu đánh dấu, "Sau khi nộp không sửa được bài làm".
- Chặn nộp hai lần: cờ đồng bộ trong `ExamRoom` + nút `loading`; BE cũng trả lại bài cũ nếu nộp lần hai.
- Trước khi nộp: **đẩy hết hàng đợi lưu** (`flush`, 8 s). Nộp tay mà vẫn còn câu chưa lưu (mất mạng) → không nộp, báo "Còn N câu chưa lưu được…" để học sinh không mất bài. Hết giờ thì đợi 5 s rồi nộp luôn.
- `POST exam/submit/<id>` thành công → xoá bản lưu tạm + cờ, làm mới ví/lượt/lịch sử, `navigate('/result/<id>', {replace: true})`.
- Lỗi: nộp tay → báo trong hộp, nút đổi thành "Nộp lại"; hết giờ → hộp "Hết giờ làm bài" không đóng được, tự thử lại mỗi 5 s + nút "Nộp lại".

## 6. Sau khi nộp

- `/result/<id>`: điểm thang 10 (tạm tính nếu còn tự luận chờ chấm), bảng theo phần, `+ điểm xếp hạng tuần` = `ranking_contribution` của BE (không tự tính, không cache).
- `/review/<id>`: đáp án đã chọn / đáp án đúng, Đ/S đúng-sai từng ý, lời giải (`explanation`) — BE chỉ trả các thứ này **sau khi nộp**.
- F5 ở phòng thi ngay sau khi nộp → BE trả `da_nop` → về `/result` (mục 1).

## Test

`src/pages/exam/*.test.ts(x)`: dựng đề + gom Đ/S + ánh xạ đáp án (`paper.test.ts`), hàng đợi lưu (`answerSaver.test.ts`), cắt nhãn (`stripLabel.test.ts`), màn phòng thi với API giả — một lần during_test, `lam_lai`, 402, `da_nop`, đồng hồ, mất mạng, 409, nộp một lần (`TakeExam.test.tsx`), kết quả/xem lại/lịch sử (`ResultPages.test.tsx`, `submissionView.test.ts`).

## Câu tự luận: Σ và ảnh bài làm (SPT-83)

- Ô trả lời tự luận là `Editor variant='student'`: thanh công cụ gọn + **Σ** mở bàn phím công thức (MathLive, lazy). Công thức lưu `<span data-latex>`, giáo viên và học sinh xem bằng KaTeX.
- **Ảnh bài làm** (tối đa 3 ảnh/câu, ≤ 2 MB): tải riêng, không qua autosave chữ. `exam/during_test` trả `markedImages` cho từng câu để F5 vẫn còn ảnh; sau khi nộp `exam/submission` trả `answers[].images`. Lỗi 409 (hết giờ / đủ 3 ảnh), 413 (ảnh quá lớn) hiện đúng câu tiếng Việt từ `error`.
- Chưa làm (chờ anh chốt Q17–Q23): đánh dấu ✓/✗ trên ảnh khi chấm, bỏ trống tự động 0 điểm, xoay/phóng to nâng cao.

