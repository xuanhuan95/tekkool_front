# Bản đồ route

Chọn view ở `src/pages/App.tsx`:

| Trạng thái | View | File |
|---|---|---|
| Chưa đăng nhập | `AnonymousView` — `/` đăng nhập, `/register` đăng ký, còn lại → đăng nhập | `pages/AnonymousView.tsx` |
| Nhóm `visitor` | `VisitorView` (đề, kết quả, thanh toán, lịch sử) | `pages/VisitorView.tsx` |
| Đã đăng nhập (HS, GV, Admin) | `AuthenticateView` | `pages/AuthenticateView.tsx` |
| Mọi người (không cần đăng nhập) | `/design-system` (token cũ), `/dev/ui*` (chỉ dev) | `pages/DesignSystem.tsx`, `pages/dev/` |

Trong `AuthenticateView`:
- Admin, hoặc đường dẫn bắt đầu `/manage` → `pages/manage/ManageApp.tsx` (chunk riêng, `AdminLayout`). Người không phải Admin vào `/manage/*` thấy màn 403.
- `/do-exam/*` và `/payment/*` là **toàn màn hình**, tự có header design D (ExamHeader / thanh "Thanh toán") — không bọc khung HS, không có TopToolbar cũ.
- Học sinh: mọi route khác nằm trong `StudentShell` (`StudentLayout`: header + bottom nav / menu web).
- Giáo viên: layout cũ `TopToolbar` + Semantic UI.

## Học sinh

Artboard design: `design/screens/<Tên>.dc.html` (mobile 390px; `HS-Web-*` là bản web).

| Route | Màn | File | Artboard | API |
|---|---|---|---|---|
| `/` | Trang chủ | `pages/student/StudentHome.tsx` (qua `pages/dashboard/Dashboard.tsx`, HS → StudentHome) | HS-TrangChu, HS-Web-TrangChu | `payment/wallet`, `exam/in_progress`, `folder/subjects`, `ranking/week?limit=3`, `exam/my_submissions`, `me/profile` (danh hiệu) |
| `/exams` (`?mon=<id>`) | Đề thi theo môn | `pages/hs/ExamsPage.tsx` | HS-DeThi | `folder/subjects`, `folder/children`, `exam/browse?folder=` (kèm `best_score/best_max`), `exam/in_progress` |
| `/exams/:examId` | Chi tiết đề, bắt đầu / làm tiếp | `pages/hs/ExamDetailPage.tsx` | HS-ChiTietDe, HS-HetLuot | `exam/fetch/<id>` (`parts` = cấu trúc đề), `payment/wallet`, `exam/in_progress` |
| `/do-exam/:examId` (`?lam_lai=1`) | Phòng thi cả đề | `pages/exam/TakeExam.tsx`, `ExamRoom.tsx` | HS-LamBai*, HS-DanhSachCau, HS-XacNhanNop, HS-Web-LamBai | `exam/during_test/<id>`, `exam/save_answer/<qid>`, `exam/submit/<id>` — xem [lam-bai.md](lam-bai.md) |
| `/result/:id` | Kết quả | `pages/exam/ResultPage.tsx` | HS-KetQua | `exam/submission/<id>` (không cache; `ranking_contribution`) |
| `/review/:id` | Xem lại bài & lời giải. Câu tự luận có ảnh: bấm ảnh mở trình xem có dấu chấm của giáo viên (chỉ xem), ghi chú liệt kê dưới ảnh (SPT-84, [cham-tren-anh.md](cham-tren-anh.md)) | `pages/exam/ReviewPage.tsx` | HS-XemLai, CA-Web-HS-XemLai, CA-Mobile-HS-XemLai, CA-Mobile-HS-XemAnh | `exam/submission/<id>` |
| `/history` | Lịch sử làm bài (lọc chờ chấm, môn) | `pages/exam/HistoryPage.tsx` | HS-LichSu | `exam/my_submissions` |
| `/ranking` | Xếp hạng tuần / thành tích | `pages/hs/RankingPage.tsx` | HS-XepHang | `ranking/week`, `ranking/achievements` (mỗi dòng có `title`), `folder/subjects`, `me/profile` |
| `/me` | Tài khoản | `pages/hs/AccountPage.tsx` | HS-TaiKhoan | `me/profile` (`title`, `title_next`), `me/ranking_privacy`, `me/update`, `me/change_password`, `payment/wallet` |
| `/packages` | Gói thi | `pages/pay/Packages.tsx` | HS-Goi | `package/list`, `payment/wallet` |
| `/payment/:packageId` | Xác nhận thanh toán → chuyển SePay | `pages/payment/Payment.tsx` | HS-ThanhToan | `package/list`, `payment/checkout` (form POST sang SePay theo đúng thứ tự trường BE trả) |
| `/payment/result?inv=[&result=cancel\|error]` | Chờ xác nhận / thành công / thất bại / đã huỷ / không tìm thấy đơn (403, 404: đơn người khác hoặc không tồn tại, SPT-61) | `pages/payment/PaymentResult.tsx` | HS-ThanhToanCho, HS-ThanhToanXong | `payment/status/<inv>` (hỏi lại định kỳ), `payment/cancel/<inv>` (khi có `result`), `payment/wallet` |
| `/billing` | Lịch sử mua gói (CANCELLED = nhãn xám "Đã huỷ") | `pages/pay/PurchaseHistory.tsx` | HS-LichSuMua | `payment/history` |
| `/my-exams`, `/my-exams/:id` | Đường dẫn cũ | — | — | HS được chuyển sang `/history`, `/result/:id` |

**Không đổi** `/payment/result`: đây là return URL đã cấu hình ở SePay.

Huỷ thanh toán (SPT-58): SePay trả về `…&result=cancel` (học sinh bấm Huỷ) hoặc `…&result=error`. Trang gọi
`POST payment/cancel/<inv>` **một lần** (`usePaymentStatus(inv, cancel)`), rồi hiển thị theo `status` server trả về,
không tin URL (`paymentView` trong `pages/pay/order.ts`): `CANCELLED` → "Đã huỷ thanh toán" (`result=error`:
"Thanh toán không thành công") + nút "Chọn gói khác" về `/packages` (mua lại = đơn mới), không hỏi lại;
`PAID` → màn thành công (SePay đã nhận tiền thì BE không huỷ). Không có `result` → hỏi lại `payment/status` 90 giây
như cũ; đơn `CANCELLED` dừng hỏi ngay. Admin: trạng thái hiển thị `cancelled` ("Đã huỷ", xám) ở Giao dịch
(lọc `?status=cancelled`), Doanh thu, và `order_counts.cancelled` ở chi tiết Người dùng.

## Giáo viên

Các màn giáo viên đã reskin theo design D (SPT-57), chạy trong `TeacherShell` (menu 3 mục: Môn & đề · Ngân hàng câu hỏi · Chấm bài; không còn màn Tổng quan, vào thẳng Môn & đề — SPT-67). Import đề (`/import-exam`) và Tạo đề từ ngân hàng (`/create-from-bank`) dùng được trên điện thoại (SPT-72): dưới 1024px một cột, hai tab "Đã đọc" / "Bản gốc" (bản gốc là PDF của file, SPT-70; điện thoại có thêm nút mở toàn màn hình), thanh nút lưu nằm trên thanh menu dưới. Các màn còn lại vẫn giao diện cũ (Semantic UI), reskin sprint sau. `AuthenticateView` nhận ra màn mới bằng `TEACHER_D`.

| Route | Màn | File |
|---|---|---|
| `/`, `/subject/:subjectId` | Môn & đề: thẻ môn, danh sách đề có cột/bộ lọc **Nháp / Đã xuất bản**, Sửa · Làm thử · Bài nộp · Xuất bản / Chuyển về nháp · Nhân bản · Chuyển môn · Xoá (khoá sẵn kèm chú thích "Đề đã có bài nộp — chỉ chuyển về Nháp được" khi `exam/list` trả `has_submissions`; BE vẫn trả 409 thì hiện thông báo thân thiện). Điện thoại 390px: thẻ chỉ có Làm thử + Bài nộp. Môn bị Admin ẩn vẫn hiện kèm nhãn "Môn đang ẩn — học sinh không thấy" (BE SPT-68 trả `hidden` cho giáo viên với môn còn đề của họ). Số đề và danh sách của môn **gồm cả đề nằm trong thư mục con** (`useSubjectExams` gọi `exam/list?folder=` cho môn và từng thư mục con). Không còn "Đề ngoài thư mục" | `pages/dashboard/Dashboard.tsx` (`TeacherHome`, `teacher-home.css`; `exam/list?folder=`, `folder/list`, `exam/publish|unpublish|delete|duplicate|move_to_folder`, `exam/to_grade/<id>` để cảnh báo trước khi chuyển về nháp) |
| `/create-exam`, `/edit-exam/:examId` | Soạn đề bằng editor. Chip trạng thái "Nháp · học sinh chưa thấy" / "Đã xuất bản". Nháp: **Lưu nháp** + **Xuất bản**; đã xuất bản: **Lưu thay đổi** + **Chuyển về nháp** (có hộp cảnh báo nhẹ nếu đã có bài nộp) và không tự lưu đè. **Nháp lưu được dù còn lỗi, kể cả tự lưu 2 phút (Q15)**; chỉ **Xuất bản và In bị chặn** ở FE, không gọi API, toast "Chưa xuất bản được:" + vài dòng + "… và N lỗi nữa". Cột trái: "Phải sửa trước khi xuất bản" (đỏ) và "Nên xem lại" (vàng, không chặn). Lưu đề đã xuất bản còn lỗi → BE 400, báo "sửa lỗi hoặc chuyển về Nháp trước". **Điểm từng câu** (`ScoreField.tsx`): điền sẵn mặc định SPT (trắc nghiệm 0,25, Ngữ văn 0,3; Đúng/Sai 1 cả câu; trả lời ngắn 0,25; tự luận bắt buộc nhập), sửa được, bước 0,05, nhãn "đã chỉnh" + nút "↺ mặc định"; gửi `data.max_score` (Đúng/Sai chia đều 4 ý). Tổng điểm ≠ 10 chỉ nhắc. **Thời gian đề mới** tự gợi ý theo môn đang chọn (Toán, Ngữ văn 90 phút; môn khác 60) cho tới khi giáo viên tự gõ. Toast hiện ở góc dưới phải để không che nút thanh menu. Câu Đúng/Sai là **khối 4 ý a–d** (`TrueFalseBlock.tsx`, chung `passageId`), khối thiếu ý có nút "+ Thêm ý d)". Bỏ dạng "Tìm lỗi sai" (đề cũ vẫn mở được) | `pages/exam-creation/CreateExam.tsx` (`exam/info`, `exam/create`, `exam/publish|unpublish/<id>`, `exam/to_grade/<id>`, `exam/move_to_folder`); luật ở `examRules.ts` (`examProblems`, `publishProblems`, `reviewHints`, `defaultScore`, `withDefaultScores`) |
| `/import-exam` (`?bank=` hoặc `?folder=`) | **Nhập đề v2** (design canvas "Nhập đề v2"). Bước 1: kéo thả / chọn file, tải mẫu Word (`public/mau-de/`), 3 cách đánh dấu đáp án, 3 quy tắc, link Lỗi thường gặp. Bước 2: thanh tóm tắt (số câu đọc/ghi trong file, đáp án, điểm, cảnh báo), danh sách **cảnh báo có mã** (`issues` của `import_docx/preview`: Nặng = `level:'error'`, còn lại Nhẹ; `info` không hiện), hai cột Bản gốc PDF / đề đã đọc, câu có cảnh báo tô vàng (Nhẹ) / đỏ (Nặng) và có chip chữ, câu bị nhảy số có khung đỏ nét đứt "Thiếu Câu n". **Cảnh báo Nặng chặn Lưu ở CẢ HAI đường** (vào ngân hàng và tạo đề nháp) tới khi bấm "Đã xem, cho phép lưu" từng cái (Q15: nháp vẫn lưu được sau xác nhận); Nhẹ không chặn. "Dán đáp án nhanh" (`import_docx/answers`, gửi khung câu không kèm ảnh, xem trước từng câu rồi mới Áp dụng) và "Đánh số lại câu" (chỉ bỏ cảnh báo `NUMBER_GAP`/`NUMBER_DUPLICATE`, không đổi id). Không có `?bank=` thì **bắt buộc chọn môn** (`?folder=` hoặc ô "Môn học"); `exam/create` không nhận `folder` nên FE gọi `exam/move_to_folder` sau mỗi đề. Nhánh `?bank=` còn chặn thêm khi thiếu đáp án / Đúng/Sai ≠ 4 ý (Q12, Q13). Luật thuần ở `importRules.ts` | `pages/exam-creation/ImportExam.tsx`, `ImportUpload.tsx`, `ImportIssues.tsx`, `PasteAnswers.tsx` (`import_docx/{preview,pdf,answers}`, `image/upload`, `question_bank/{save,check_trung,capacity}`, `exam/create`, `exam/move_to_folder`) |
| `/import-exam/loi-thuong-gap` (`#mat-cau`, `#mui-ten`, `#bang`, `#latex`, `#khong-dap-an`, `#tron-cach`, `#phu-luc`, `#cau-chum`) | Lỗi thường gặp khi nhập đề: triệu chứng → nguyên nhân → cách sửa file Word. "Cách sửa" trên cảnh báo mở trang này ở **tab mới** (màn nhập đề giữ file đã đọc). Nội dung chữ và bảng mã cảnh báo → mục ở `guideContent.ts` | `pages/exam-creation/ImportGuide.tsx`, `guideContent.ts` |
| `/create-from-bank`, `/draw-exam[...]` | Tạo đề theo cấu trúc từ ngân hàng; Rút thử | `CreateFromBank.tsx`, `DrawExam.tsx` (`exam/create_from_bank`, `question_bank/draw`) |
| `/question-bank` | Ngân hàng câu hỏi | `pages/question-bank/BankList.tsx` (`question_bank/{list,subjects,create,remove,capacity}`) |
| `/question-bank/:bankId` | Nội dung một ngân hàng (SPT-73): lọc theo dạng khối, ô tìm (chờ 350ms), 20 khối/trang, hiện ngữ liệu, đáp án (đáp án đúng tô xanh), Đúng/Sai từng ý, lời giải, KaTeX và ảnh; **không** hiện đề nguồn. Nút **Xoá** mỗi khối luôn xoá cả khối: hộp xác nhận "Xoá câu này?" (1 câu) / "Xoá văn bản này và N câu đi kèm?" (N = `count`) / "Xoá câu đúng/sai này (4 ý)?"; 404 khi xoá = đã xoá, tải lại. Đề đã rút từ khối không bị ảnh hưởng (BE chỉ gỡ khỏi ngân hàng). Vào từ nút **Xem nội dung** ở thẻ ngân hàng | `pages/question-bank/BankBlocks.tsx` (`question_bank/{blocks,delete_block}`, hook `useBankBlocks`/`useDeleteBlock`) |
| `/to-grade`, `/to-grade/:examId` | Bài chờ chấm | `pages/my/ToGrade.tsx` (`exam/pending`) |
| `/my-exams/:id` | Chấm một bài. Câu tự luận có ảnh: chấm trên ảnh (✓ / ✗ / ghi chữ, zoom, xoay), danh sách dấu cạnh ô điểm; dấu lưu cùng "Lưu điểm" (SPT-84, [cham-tren-anh.md](cham-tren-anh.md)) | `pages/my/SubmissionDetail.tsx`, `pages/my/ImageMarker.tsx` (`exam/submission`, `exam/grade` kèm `marks`) |
| `/do-exam/:examId` | Giáo viên làm thử đề của mình (không tốn lượt, không có đồng hồ server) | `pages/exam/TakeExam.tsx` |

## Admin — `/manage/*`

**Vì sao không dùng `/admin`:** `tekkool-deploy/nginx.conf` có `location /admin { return 404; }` để chặn Flask-Admin của backend (không có đăng nhập). Route SPA dưới `/admin/...` sẽ bị 404 khi F5, nên dùng tiền tố `/manage`.

| Route | Màn | File | Artboard | API |
|---|---|---|---|---|
| `/manage/teachers` | Giáo viên (SPT-77): bỏ cột Số đề; Thao tác là icon có tooltip (khoá/mở khoá, đặt lại mật khẩu; chưa có "Sửa" vì BE chưa có API sửa giáo viên); số liệu "Tổng · Hoạt động · Đã khoá" lấy từ 2 lời gọi `admin/teachers?limit=1` (tổng, và `status=locked`), Hoạt động = Tổng − Đã khoá. Tạo, khoá/mở, đặt lại mật khẩu | `pages/manage/Teachers.tsx` | AD-GiaoVien, AD-TaoGiaoVien | `admin/teachers`, `admin/create_teacher`, `admin/lock_teacher/<id>`, `admin/unlock_teacher/<id>`, `admin_users/reset_password/<id>` |
| `/manage/users` (`?q=&status=&page=`) | **Học sinh** (SPT-77): chỉ học sinh (`group=student`), không cột Vai trò, không lọc giáo viên; dòng có icon mũi tên → chi tiết; số liệu chỉ "Tổng N học sinh" | `pages/manage/Users.tsx` | AD-NguoiDung | `admin_users/list?group=student` |
| `/manage/users/:id` | Chi tiết học sinh (khoá/mở khoá, đặt lại mật khẩu chuyển về đây). Chưa có danh hiệu và số sao vì `admin_users/detail` chưa trả | `pages/manage/StudentDetail.tsx` | AD-HocSinhChiTiet | `admin_users/detail/<id>`, `admin_users/lock|unlock/<id>`, `admin_users/reset_password/<id>` |
| `/manage/subjects` | Môn học: tạo, đổi tên, ẩn/hiện (không xoá). Chỉ Admin; giáo viên chỉ chọn môn có sẵn | `pages/manage/AdminSubjects.tsx` | SPT-65 | `folder/subjects`, `folder/create`, `folder/update` |
| `/manage/packages` | Gói & giá, sắp xếp | `pages/manage/AdminPackages.tsx` | AD-Goi | `package/list?all=1`, `package/create`, `package/update/<id>`, `package/reorder`, `package/remove/<id>` |
| `/manage/revenue` | Doanh thu | `pages/manage/Revenue.tsx` | AD-DoanhThu | `admin_revenue/summary`, `admin_revenue/transactions` |
| `/manage/transactions` (`?tab=reconcile&inv=…`) | Giao dịch & đối soát | `pages/manage/Transactions.tsx` | AD-GiaoDich | `admin_revenue/transactions`, `admin_revenue/transaction/<inv>`, `admin_revenue/reconcile`, `POST admin_revenue/reconcile_order/<inv>` (SPT-87: nút "Đối soát lại", hiện kết quả theo `result`, 429 đếm ngược `retry_after`, ẩn khi `can_reconcile=false`) |
| `/manage/*` khác | → `/manage/teachers` | `ManageApp.tsx` | | |

Ẩn menu theo vai trò chỉ là trải nghiệm; quyền thật do backend kiểm.

SPT-77: các câu giải thích dưới tiêu đề đã bỏ ở Giáo viên, Môn học, Gói, Giao dịch (Admin) và Môn & đề, Ngân hàng, Nội dung ngân hàng, Tạo đề từ ngân hàng, Nhập đề (Giáo viên); dòng số liệu được giữ.
Mọi nút chỉ có icon trong `pages/manage/*` (xem chi tiết, khoá/mở khoá, đặt lại mật khẩu, kỳ trước/sau ở Doanh thu, đưa gói lên/xuống) dùng `IconButton` — tên hiện khi hover và focus.
