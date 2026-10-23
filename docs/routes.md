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
| `/review/:id` | Xem lại bài & lời giải | `pages/exam/ReviewPage.tsx` | HS-XemLai | `exam/submission/<id>` |
| `/history` | Lịch sử làm bài (lọc chờ chấm, môn) | `pages/exam/HistoryPage.tsx` | HS-LichSu | `exam/my_submissions` |
| `/ranking` | Xếp hạng tuần / thành tích | `pages/hs/RankingPage.tsx` | HS-XepHang | `ranking/week`, `ranking/achievements` (mỗi dòng có `title`), `folder/subjects`, `me/profile` |
| `/me` | Tài khoản | `pages/hs/AccountPage.tsx` | HS-TaiKhoan | `me/profile` (`title`, `title_next`), `me/ranking_privacy`, `me/update`, `me/change_password`, `payment/wallet` |
| `/packages` | Gói thi | `pages/pay/Packages.tsx` | HS-Goi | `package/list`, `payment/wallet` |
| `/payment/:packageId` | Xác nhận thanh toán → chuyển SePay | `pages/payment/Payment.tsx` | HS-ThanhToan | `package/list`, `payment/checkout` (form POST sang SePay theo đúng thứ tự trường BE trả) |
| `/payment/result?inv=[&result=cancel\|error]` | Chờ xác nhận / thành công / thất bại / đã huỷ | `pages/payment/PaymentResult.tsx` | HS-ThanhToanCho, HS-ThanhToanXong | `payment/status/<inv>` (hỏi lại định kỳ), `payment/cancel/<inv>` (khi có `result`), `payment/wallet` |
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

## Giáo viên (giao diện cũ, Semantic UI — reskin sprint sau)

| Route | Màn | File |
|---|---|---|
| `/`, `/subject/:subjectId` | Môn & đề (thư mục, danh sách đề) | `pages/dashboard/Dashboard.tsx` (`exam/list`, `folder/list`) |
| `/create-exam`, `/edit-exam/:examId` | Soạn đề bằng editor | `pages/exam-creation/CreateExam.tsx` (`exam/info`, `exam/create`) |
| `/import-exam` | Nhập đề .docx | `pages/exam-creation/ImportExam.tsx` (`import_docx/preview`, `question_bank/*`) |
| `/create-from-bank`, `/draw-exam[...]` | Tạo đề theo cấu trúc từ ngân hàng | `CreateFromBank.tsx`, `DrawExam.tsx` (`exam/create_from_bank`, `question_bank/draw`) |
| `/question-bank` | Ngân hàng câu hỏi | `pages/question-bank/BankList.tsx` |
| `/to-grade`, `/to-grade/:examId` | Bài chờ chấm | `pages/my/ToGrade.tsx` (`exam/pending`) |
| `/my-exams/:id` | Chấm một bài | `pages/my/SubmissionDetail.tsx` (`exam/submission`, `exam/grade`) |
| `/do-exam/:examId` | Giáo viên làm thử đề của mình (không tốn lượt, không có đồng hồ server) | `pages/exam/TakeExam.tsx` |

## Admin — `/manage/*`

**Vì sao không dùng `/admin`:** `tekkool-deploy/nginx.conf` có `location /admin { return 404; }` để chặn Flask-Admin của backend (không có đăng nhập). Route SPA dưới `/admin/...` sẽ bị 404 khi F5, nên dùng tiền tố `/manage`.

| Route | Màn | File | Artboard | API |
|---|---|---|---|---|
| `/manage/teachers` | Giáo viên: tạo, khoá/mở, đặt lại mật khẩu | `pages/manage/Teachers.tsx` | AD-GiaoVien, AD-TaoGiaoVien | `admin/teachers`, `admin/create_teacher`, `admin/lock_teacher/<id>`, `admin/unlock_teacher/<id>`, `admin_users/reset_password/<id>` |
| `/manage/users` (`?group=&id=`) | Người dùng + chi tiết | `pages/manage/Users.tsx` | AD-NguoiDung | `admin_users/list`, `admin_users/detail/<id>`, `admin_users/lock|unlock/<id>`, `admin_users/reset_password/<id>` |
| `/manage/packages` | Gói & giá, sắp xếp | `pages/manage/AdminPackages.tsx` | AD-Goi | `package/list?all=1`, `package/create`, `package/update/<id>`, `package/reorder`, `package/remove/<id>` |
| `/manage/revenue` | Doanh thu | `pages/manage/Revenue.tsx` | AD-DoanhThu | `admin_revenue/summary`, `admin_revenue/transactions` |
| `/manage/transactions` (`?tab=reconcile&inv=…`) | Giao dịch & đối soát | `pages/manage/Transactions.tsx` | AD-GiaoDich | `admin_revenue/transactions`, `admin_revenue/transaction/<inv>`, `admin_revenue/reconcile` |
| `/manage/*` khác | → `/manage/teachers` | `ManageApp.tsx` | | |

Ẩn menu theo vai trò chỉ là trải nghiệm; quyền thật do backend kiểm.
