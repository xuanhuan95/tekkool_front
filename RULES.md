# Quy tắc code — tekkool_front

Áp dụng cho **mọi file viết mới từ hôm nay**. Code cũ không bắt buộc viết lại
một lượt — xem mục [Di trú](#di-trú) ở cuối.

---

## 1. TypeScript: `.ts` / `.tsx`, không còn `.js` / `.jsx`

File mới luôn là `.ts` (logic thuần) hoặc `.tsx` (có JSX). Không tạo thêm file
`.js`/`.jsx` nào nữa, kể cả file nhỏ.

```
✅ src/pages/exam/DoExam.tsx
✅ src/services/api.ts
❌ src/pages/exam/DoExam.jsx
```

**Quy ước kiểu**

- Dữ liệu từ BE phải có `type` khai báo ở `src/types/`, đặt tên theo model BE
  (`Exam`, `Submission`, `Attempt`, `GradedAnswer`...). BE trả gì thì tả đúng
  cái đó, kể cả field có thể vắng:

  ```ts
  // Bài nộp trước khi có section_name thì không có `phan` -> optional thật,
  // không phải `phan: Phan[]` rồi để FE tự đoán.
  export type Submission = {
      score: number;
      max_score: number;
      pending_count: number;
      duration_sec?: number;
      phan?: Phan[];
  };
  ```

- **Không dùng `any`.** Chưa biết kiểu thì `unknown` rồi thu hẹp bằng kiểm tra.
  `any` tắt luôn trình kiểm tra — đổi tên field ở BE là FE im lặng hỏng,
  đúng loại lỗi mà TypeScript sinh ra để chặn.
- Props của component khai báo bằng `type`, không `interface`, trừ khi cần
  `extends`/declaration merging. Một lối là đủ.
- Không `enum` — dùng union literal (`type Status = 'GRADING' | 'GRADED'`).
  Nhẹ hơn, không sinh runtime code.
- `strict: true` trong `tsconfig.json`. Bật `strict` sau khó gấp nhiều lần
  bật từ đầu.

---

## 2. State dùng zustand

Bỏ `connectGlobalState` trong [`src/stateUtils.jsx`](src/stateUtils.jsx) cho
code mới. HOC đó kế thừa class nên **không chạy với function component** —
giữ nó là giữ luôn ràng buộc phải viết class.

Mỗi store một file `src/stores/<tên>.ts`:

```ts
import {create} from 'zustand';

type UserStore = {
    user: User | null;
    setUser: (u: User | null) => void;
};

export const useUserStore = create<UserStore>(set => ({
    user: null,
    setUser: user => set({user}),
}));
```

**Quy tắc**

- Chọn từng field, không lấy cả store — lấy cả store là mọi thay đổi đều
  re-render:

  ```ts
  const user = useUserStore(s => s.user);        // ✅
  const {user} = useUserStore();                 // ❌ re-render thừa
  ```

- **Store chỉ giữ state của client**: user đang đăng nhập, token, cờ UI
  (modal đang mở, tab đang chọn). **Dữ liệu từ server không vào store** —
  đó là việc của react-query (mục 3). Để cả hai nơi cùng giữ một dữ liệu là
  tự tạo ra hai nguồn sự thật lệch nhau.
- Logic đặt trong store dưới dạng action, component chỉ gọi. Component không
  tự `set` nhiều field rời rạc.
- Chỉ tạo store khi state thực sự **dùng chung nhiều nơi**. Dùng trong một
  component thì `useState` là đủ — thêm store là thêm thứ phải nuôi.

---

## 3. Gọi API bằng react-query

Không `fetch`/`Api.get` trực tiếp trong component, không `useEffect` + `setState`
để tải dữ liệu. Giữ `src/services/api.ts` làm lớp transport (nó đã xử lý token
và lỗi 500 trả HTML — đừng viết lại), react-query lo cache/loading/lỗi/retry.

```ts
// src/queries/exam.ts
export const examKeys = {
    all: ['exam'] as const,
    detail: (id: string) => [...examKeys.all, id] as const,
};

export function useExam(id: string) {
    return useQuery({
        queryKey: examKeys.detail(id),
        queryFn: () => Api.get<Exam>(`exam/info/${id}`),
    });
}
```

**Quy tắc**

- `queryKey` khai báo tập trung trong `queries/<miền>.ts` (kiểu `examKeys` ở
  trên), không rải chuỗi khắp nơi. Gõ sai một ký tự trong key là cache trượt
  mà không ai báo lỗi.
- Đổi dữ liệu dùng `useMutation` + `invalidateQueries`, không tự `setState`
  lại cho khớp. Tự đồng bộ bằng tay là nguồn gốc của màn hình "đã lưu rồi mà
  vẫn hiện số cũ".
- Hook query/mutation đặt trong `src/queries/`, component chỉ gọi hook.
- Đặt `staleTime` theo thực tế từng dữ liệu. Đề thi gần như bất biến →
  `staleTime` dài; danh sách bài chờ chấm → ngắn. Mặc định `0` làm app gọi
  lại API mỗi lần focus cửa sổ.
- **Hành động có tác dụng phụ không dùng query.** `GET exam/during_test` trừ
  một lượt trong ví học sinh — react-query có thể retry hoặc refetch khi
  focus, retry một lần là mất thêm một lượt. Những endpoint như vậy gọi thẳng
  qua `Api`, hoặc nếu bọc thì phải `retry: false` + `refetchOnWindowFocus: false`.

---

## 4. Function component, viết để tái sử dụng

Mọi component mới là **function component + hooks**. Không `class ... extends
React.Component`, không HOC mới.

```tsx
type BangDiemProps = {phan: Phan[]};

export function BangDiem({phan}: BangDiemProps) { ... }
```

**Tái sử dụng — nhưng đúng lúc**

- Tách component khi **đã dùng lại thật** (từ lần thứ 2 trở đi), hoặc khi một
  khối đủ lớn và đủ độc lập để đọc riêng ra dễ hơn. Tách sẵn "để sau này dùng"
  là tự tạo ra lớp trừu tượng cho một chỗ gọi duy nhất.
- Trước khi viết component mới: **tìm trong `src/components/` xem đã có chưa.**
  `Loading`, `SafeHtml`, `Passage`, `AnswerLabel`, `HetLuotModal`, `Editor`
  đã có sẵn.
- Component tái sử dụng được thì **không tự gọi API, không tự đọc store** —
  nhận dữ liệu qua props. Component đã cắm vào một query cụ thể chỉ dùng lại
  được ở đúng màn hình đó.
- Logic lặp lại tách thành hook `use*` trong `src/hooks/`, đừng tách thành
  component chỉ để chia sẻ logic.
- Một component một việc. Dài quá ~150 dòng thường là đang gánh nhiều việc.

---

---

## 5. Định danh viết bằng tiếng Anh

**Mọi thứ máy đọc đều là tiếng Anh**: tên file, component, biến, hàm, hằng,
field database, key JSON, query key, tên route, tên branch, tên bảng.

**Mọi thứ người dùng đọc vẫn là tiếng Việt đủ dấu**: chữ trên màn hình, nội
dung mail, thông báo lỗi hiện cho học sinh.

```tsx
// ✅ định danh tiếng Anh, text tiếng Việt
function ScoreTable({sections}: ScoreTableProps) {
    return <div>Phần trắc nghiệm:</div>;
}

// ❌
function BangDiem({phan}) { ... }
```

### Quy đổi các tên đang dùng

Dùng đúng bảng này khi đụng vào code cũ, đừng tự nghĩ từ khác — mỗi người
dịch một kiểu thì còn khó tra hơn để nguyên tiếng Việt.

| Đang dùng | Đổi thành |
|---|---|
| `luot` | `attempt` |
| `da_mua` / `da_dung` / `con_lai` | `purchasedTurns` / `usedTurns` / `remainingTurns` |
| `_mo_luot` | `openAttempt` |
| `_bai_vua_nop` | `findRecentSubmission` |
| `_rut_de` | `buildExamPaper` |
| `dang_lam` | `inProgress` |
| `dong()` | `close()` |
| `phan` (nhóm điểm) | `sections` |
| `diem` / `tong` / `tongMax` | `score` / `total` / `maxTotal` |
| `may` / `nguoi` (máy chấm / giáo viên chấm) | `autoGraded` / `manualGraded` |
| `BangDiem` | `ScoreTable` |
| `HetLuotModal` | `OutOfTurnsModal` |
| `cau` | `question` |
| `bai` / `bai_nop` | `submission` |
| `de` | `exam` |
| `khoi` | `block` |
| `hoc_sinh` / `giao_vien` | `student` / `teacher` |

### Quy ước đặt tên

- Component: `PascalCase`, tên file trùng tên component (`ScoreTable.tsx`).
- Hook: `useXxx` (`useExam`, `useRemainingTurns`).
- Biến/hàm: `camelCase` ở FE, `snake_case` ở BE (Python giữ PEP 8).
- Hằng: `UPPER_SNAKE_CASE` (`RECENT_SUBMIT_WINDOW_SEC`).
- Boolean mang tiền tố `is` / `has` / `can` (`isSubmitted`, `hasPendingQuestions`).
- Hàm là động từ (`openAttempt`, `calculateScore`), biến là danh từ (`attempt`,
  `remainingTurns`).
- Không viết tắt tự chế: `submission` chứ không `sub`, `question` chứ không
  `q`. Trừ các viết tắt đã phổ dụng: `id`, `url`, `api`, `html`.

### Database

Field đã gần như toàn tiếng Anh rồi (`max_score`, `status`, `amount`,
`turns`, `submitted_at`). Giữ nguyên, **field mới cũng theo lối đó**:
`snake_case`, tiếng Anh, tên model là danh từ số ít (`Attempt`, `Submission`).

### Đổi tên field đã lên production — làm cẩn thận

Field của model là **dữ liệu đã nằm trong Mongo**, không phải chỉ là chữ trong
code. Đổi tên field là mọi bản ghi cũ mất field đó.

- Field **chưa ra khỏi BE** (chỉ dùng nội bộ): đổi thẳng.
- Field **đã trả qua API** (ví dụ `phan` trong `Submission.to_dict`): đổi tên
  là FE cũ đang mở trên máy học sinh hỏng ngay. Phải trả **cả hai tên** một
  thời gian, FE chuyển sang tên mới, rồi mới bỏ tên cũ.
- Field **đã có trong Mongo**: cần script migrate, và theo quy tắc dự án thì
  lệnh ghi production do bạn tự chạy sau khi xem trước số liệu.

### Khi nào đổi

Giống mục [Di trú](#di-trú): **không đổi tên hàng loạt.** Code mới viết đúng
từ đầu; code cũ đổi tên khi đã phải sửa file đó vì lý do khác. Một PR chỉ
đổi tên thì không ai review được phần nào là đổi tên, phần nào là đổi hành vi.

## Chung

- **Không thêm dependency** cho việc vài dòng code giải quyết được. Ưu tiên
  thứ đã có trong `package.json`.
- Comment giải thích **tại sao**, không mô tả lại code. Chỗ nào cố ý làm đơn
  giản thì ghi `ponytail:` kèm trần của nó.
- Logic không tầm thường (nhánh điều kiện, vòng lặp, tính điểm, tính tiền)
  phải để lại **một** bài test chạy được. Không framework, không fixture.

## Di trú

Không đổi hết `.jsx` sang `.tsx` trong một lần — PR hàng chục file không ai
review nổi, mà app đang chạy tiền thật.

1. Thêm `typescript` + `tsconfig.json` (`allowJs: true`). Vite chạy song song
   `.jsx` và `.tsx` sẵn, không cần cấu hình thêm.
2. File mới viết luôn bằng TS.
3. File cũ chỉ chuyển khi đã phải sửa nó vì lý do khác — chuyển kèm, không
   chuyển suông.
4. `connectGlobalState` và `stateUtils.jsx` xoá khi file cuối cùng dùng nó
   đã chuyển xong.
