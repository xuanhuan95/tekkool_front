# Component giao diện (design D)

Tất cả nằm ở `src/components/ui/`, import từ một chỗ:

```tsx
import {Button, Card, Table, QuestionBlock} from '../../components/ui';
```

Style nạp cùng module (`ui.css`, `layout/layout.css`, `exam/exam.css`), token ở `src/styles/tokens.css`.
Xem trực tiếp: **`/dev/ui`** (mọi component), `/dev/ui/hs` (layout HS, đổi cỡ 390 ↔ 1280), `/dev/ui/admin`, `/dev/ui/lam-bai` (phòng thi mẫu). Trang này chỉ có khi chạy dev.

Nguyên tắc: component **không tự gọi API, không đọc store** — nhận dữ liệu qua props. Thiếu component thì thêm vào đây (kèm test trong `ui.test.tsx` / `exam/exam.test.tsx`), không viết lại ở từng màn.

## Cơ bản

| Component | Props chính | Dùng khi |
|---|---|---|
| `Button` | `variant` primary · secondary · ghost · danger, `size` sm · md · lg, `block`, `iconOnly`, `loading`, `loadingText`, `icon` | Mọi nút. `loading` = quay + chặn bấm (chống bấm 2 lần). |
| `buttonClass(opts)` | cùng tuỳ chọn như `Button` | Cho `<Link>` trông như nút: `<Link className={buttonClass({variant: 'primary'})}>` |
| `Card`, `CardTitle`, `PageTitle` | `size` lg · md, `tone` error, `flush` (không padding), `as` | Khối nội dung; tiêu đề thẻ / trang (Patrick Hand) |
| `Badge`, `StatusBadge`, `STATUS_BADGE` | `tone` ok · sun · sun-strong · err · draft · title · popular; `status` graded · pending · inProgress · paid · failed… | Nhãn trạng thái. Dùng `StatusBadge` khi trạng thái có sẵn trong bảng chữ. |
| `TitleChip`, `TITLE_TONE` | `title` {key, name}, `icon` | Danh hiệu học sinh (SPT-64): newbie xám, diligent xanh, warrior vàng, conqueror tím. Key lạ → kiểu newbie. |
| `FilterChip` | `selected`, `onChange(selected)` | Chip lọc (môn, loại lệch) |
| `StatPill` | `kind` title · star · turns · grading, `size`, `to`, `label` | Ô thống kê trên header |
| `Avatar`, `Medal`, `initialsOf` | `name` / `initials`, `size` 36 · 40, `to`; `Medal rank` 1–3 | Avatar chữ cái; huy chương hạng |
| `ProgressBar` | `value`, `max`, `label` (bắt buộc, cho trình đọc màn hình), `caption`, `showCount` | Thanh tiến độ vàng |
| `Switch` | `checked`, `onChange`, `label` | Công tắc (ẩn tên bảng xếp hạng) |
| `Tabs` / `SegmentedControl` | `items`, `value`, `onChange`, `aria-label`, `idPrefix` (Tabs) | Tabs = có panel (`role=tabpanel` do màn tự vẽ); SegmentedControl = chọn một giá trị lọc |
| `WaveLine` | `variant` mobile · web | Đường gợn dưới header |

## Ô nhập

| Component | Props chính | Ghi chú |
|---|---|---|
| `TextField`, `TextArea`, `Select` | `label` (bắt buộc), `hint`, `error`, `size` lg (TextField) ; `options`, `placeholder` (Select) | Tự nối `aria-describedby` / `aria-invalid` |
| `PasswordField` | như `TextField` | Có nút mắt "Hiện/Ẩn mật khẩu" 44×44 |
| `DateField` | `value` / `onChange` theo **ISO `YYYY-MM-DD`**, `min`, `max` | Hiển thị và gõ **dd/mm/yyyy** bất kể ngôn ngữ trình duyệt (ô date gốc của Chrome hiện mm/dd/yyyy). Tự chèn `/`; ngày sai hoặc ngoài khoảng → báo lỗi khi rời ô, không gọi `onChange`. Hàm phụ `parseDmy`, `isoToDmy`, `maskDmy`. |

```tsx
<DateField label='Từ ngày' value={from} max={to || undefined} onChange={v => setFrom(v)}/>
```

## Bảng, hộp thoại, trạng thái

| Component | Props chính | Ghi chú |
|---|---|---|
| `Table`, `Column` | `columns` (`key`, `header`, `render`, `align`, `emphasis`, **`sticky`**), `rows`, `rowKey`, `caption` (bắt buộc), `minWidth`, `isHighlighted`, `empty`, **`toolbar`**, **`bare`** | Bảng rộng cuộn ngang trong thẻ, có bóng mép báo còn cột. `sticky` ghim cột (Thao tác) bên phải — tự bỏ ghim nếu cột rộng hơn 45% khung. `toolbar` = tiêu đề/bộ lọc trong thẻ; `bare` khi màn đã tự bọc thẻ (`<Card flush className='vt-table-card'>`). |
| `Modal` | `open`, `onClose` (bỏ = không đóng được), `title`, `footer`, `size`, `placement` center · sheet, `showClose`, `initialFocus` | Khoá focus trong hộp, Esc đóng, khoá cuộn trang |
| `ConfirmDialog` | `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `tone` danger, `loading`, `onConfirm`, `onCancel` | Focus vào nút an toàn (huỷ) |
| `notify.success / .error`, `ToastCard` | `(title, description?)` | Toast design D trên `<Toaster position='bottom-right'/>` của react-hot-toast (góc dưới để không che thanh menu editor) |
| `EmptyState` | `title`, `description`, `icon`, `action`, `bare` | Trạng thái rỗng |
| `ErrorState` | `title`, `description`, `onRetry`, `retrying` | Lỗi + "Thử lại" |
| `Skeleton`, `SkeletonCard` | `width`, `height`, `shape`; `label` | Đang tải — không dùng spinner giữa trang |

```tsx
const columns: Column<Pkg>[] = [
    {key: 'name', header: 'Tên gói', emphasis: 'strong'},
    {key: 'actions', header: 'Thao tác', sticky: true, render: p => <Button size='sm' variant='ghost'>Sửa</Button>},
];
<Table caption='Danh sách gói' columns={columns} rows={list} rowKey={p => p.id} minWidth={760}/>
```

## Layout (`layout/`)

| Component | Props chính | Dùng khi |
|---|---|---|
| `StudentLayout` | `name`, `turns`, `stars`, `title`, `navMobile`, `navWeb`, `accountTo` | Khung mọi màn HS (đã dùng trong `pages/student/StudentShell.tsx`): header dính + bottom nav (điện thoại) / menu trên (web) |
| `AdminLayout` | `name`, `nav` | Khung `/manage/*`; menu: Giáo viên · Người dùng · Môn học · Gói thi · Doanh thu · Giao dịch; header có nút **Đăng xuất** (gọi `useAuthStore.signOut`), xuống dòng dưới menu ở 390px |
| `WebLayout` | `nav`, `navLabel`, `right` | Khung web chung |
| `HeaderSticky`, `StudentStats`, `BottomNav` | `variant`, `nav`, `right` ; `turns`, `stars`, `title` ; `items` | Thành phần của các layout trên |
| `PageColumns` | `main`, `side` | Bố cục 2 cột web (cột phụ ≤ 380px), xuống 1 cột trên điện thoại |
| `STUDENT_NAV_MOBILE`, `STUDENT_NAV_WEB`, `ADMIN_NAV`, `isNavActive` | `NavItem` {to, label, end, **also**} | Menu. `also` = các đường dẫn con cũng tô mục này (Kết quả/Xem lại/Lịch sử → "Đề thi"; Gói → "Tôi"). |

## Màn làm bài (`exam/`)

| Component | Props chính | Ghi chú |
|---|---|---|
| `ExamLayout` | `header`, `children` (cả đề), `aside` (web) | Trang trắng, header dính, cột phải dính ở web |
| `ExamHeader` | `title`, `secondsLeft` (**null = không giới hạn**), `answered`, `total`, `onExit`, `onSubmit`, `submitting`, `strip` | Đồng hồ đỏ khi ≤ 5 phút. Màn chỉ đưa số giây — tự tính từ hạn của server. |
| `ExamBanner` | `tone` error · warn, `children` | Dải dưới header: "Còn dưới 5 phút…", "Mất kết nối…" |
| `ExamSection` | `id`, `title`, `note` | Một phần (I–IV) |
| `QuestionBlock` | `kind` choice · truefalse · short · essay, `number`, `prompt`, `value`, `onChange`, `flagged`, `onToggleFlag`, `disabled`; choice: `options`; truefalse: `statements`; essay: `editor` | Chỉ hiển thị — màn giữ đáp án, tự lưu, nộp. Đ/S: bấm lại ý đã chọn = xoá lựa chọn; trắc nghiệm không bỏ chọn được. |
| `QuestionNumberStrip`, `QuestionGrid` | `questions` (QuestionStatus), `current`, `onJump`, `onOpenAll`; `parts`, `showHeading`, `footer` | Dải số câu (điện thoại) và lưới "Đi tới câu" (sheet / cột phải web; thân lưới tự cuộn, `footer` luôn thấy) |
| `ExamEnd`, `AutosaveNote` | `answered`, `total`, `flagged`, `savedAt`, `saving`, `offline`, `saveError`, `onSubmit`, `disabled` | Khối "Hết đề" + dòng "Đã lưu tự động lúc…" / "Đang lưu…" / "Mất kết nối" |
| Hàm: `formatClock`, `countTrueFalse`, `countWords`, `WARN_SECONDS` | | |

Cách các component này được nối với API: [lam-bai.md](lam-bai.md).

## Thành phần dùng chung cũ (`src/components/`)

| File | Dùng khi |
|---|---|
| `SafeHtml.tsx` (`renderHTML(html)`) | Mọi nội dung đề do giáo viên nhập: lọc XSS (DOMPurify) + vẽ công thức `<span data-latex>` bằng KaTeX; hình lỗi tải → khung xám "Không tải được hình…" (`.vt-img-broken`) |
| `Passage.tsx` | Đoạn văn dùng chung cho một nhóm câu (in một lần ở câu đầu nhóm, theo `data.passageId`) |
| `Editor.tsx` | TipTap — ô tự luận của học sinh, editor soạn đề của giáo viên |
| `OutOfTurnsModal.tsx` | Hộp "Bạn đã hết lượt thi" (HS-HetLuot) khi API trả 402 |

## Khung và logic màn giáo viên (SPT-57)

| Thành phần | Ghi chú |
|---|---|
| `TeacherLayout`, `TEACHER_NAV` (`ui/layout`) | Khung giáo viên, menu 3 mục (Môn & đề · Ngân hàng câu hỏi · Chấm bài): menu trên (web) / dưới (điện thoại), badge số bài chờ chấm (`usePendingCount`), nút **Đăng xuất** ở cả header điện thoại và web (`useAuthStore.signOut`) |
| `queries/questionBank.ts` | `useBanks`, `useBankSubjects`, `useCreateBank`, `useRemoveBank`, `useBankCapacity`, `useBankStock`, `useCreateFromBank`, `useDrawInfo`, `useDrawExam`; khoá cache `bankKeys` |
| `ImportExam` (lời giải) | Câu có `data.explanation` (SPT-62) hiện khối "Lời giải" gập được, qua `SafeHtml`; `max_score`/`explanation` giữ nguyên khi đổi loại câu, `block_type` bị bỏ |
| `exam-creation/importRules.ts` | Luật thuần của màn nhập đề, có test: `toUnits` (gộp các ý Đúng/Sai cùng `passageId` thành một câu), `isMissingKey` (Q12), `isBadTrueFalse` (Q13, dùng lại được cho editor), `saveBlocker`, `examStats`, `fileProblem`, `importErrorText`, và các hàm sửa payload (`setType`, `setPassage`, `setAnswer`, `removeQuestions`…) |
| `CreateFromBank.suggestedMinutes` | Gợi ý số phút theo môn (Toán/Ngữ văn 90, môn khác 60); giáo viên vẫn sửa được |
| `Dashboard.tsx` → `TeacherHome` / `SubjectCard` / `ExamList` (SPT-67) | Màn Môn & đề của giáo viên: `useFolderExams`, bộ lọc trạng thái (`FilterChip`), `Table` ≥768px / thẻ ở 390px, `ConfirmDialog` cho Xoá và Chuyển về nháp |
| `exam-creation/ScoreField.tsx` | Ô điểm từng câu: mặc định theo `defaultScore`, nhãn "đã chỉnh", "↺ mặc định", cảnh báo tự luận chưa có điểm |
| `examRules.ts` (SPT-67) | `publishProblems` (chặn Xuất bản/In = `examProblems` + tự luận thiếu điểm), `reviewHints` ("Nên xem lại"), `defaultScore`, `unitScore`, `scoreData`, `withDefaultScores`, `examTotal` |
