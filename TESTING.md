# Test — luồng giáo viên → học sinh

Định nghĩa **những gì phải được bảo vệ bằng test**, theo đúng đường đi thật
của một đề thi: giáo viên soạn → học sinh mua lượt → làm bài → nộp → chấm →
xem điểm.

Nguyên tắc chọn test: **ưu tiên chỗ hỏng thì mất tiền hoặc mất điểm của học
sinh.** Không test getter/setter, không test "component render không lỗi".

Chạy: `npm test` (FE) · `python3 test_submission.py test_attempt.py test_payment.py` (BE)

**Test chỉ có giá trị nếu nó đỏ khi bug quay lại.** Mỗi ca thêm vào đây đều
đã được kiểm chứng bằng cách đặt lại bug cũ rồi xem test đỏ. Cách này đã bắt
được hai test giả tự tin nhầm (xem `banked` ở ImportExam và `da_nop` ở DoExam).

---

## Bản đồ luồng

```
GIÁO VIÊN                          HỌC SINH
─────────                          ────────
T1 soạn đề / nhập .docx
T2 đặt trọng số điểm
T3 lưu vào ngân hàng
T4 giao đề                 ──────►  S1 mua gói lượt
                                    S2 mở đề (TRỪ LƯỢT)
                                    S3 làm bài
                                    S4 nộp bài (chấm máy)
T5 chấm tự luận            ◄──────  S5 xem kết quả
                           ──────►  S6 xem điểm cuối
```

**4 điểm chết** — hỏng là người dùng mất tiền hoặc mất điểm:
`S2` trừ lượt · `S4` chấm máy · `T2`→`S4` tính điểm · `T5` vào điểm tay.

---

## T — Phía giáo viên

### T1. Soạn đề, nhập từ .docx
| # | Ca | Phải đúng |
|---|---|---|
| T1.1 | Nhập .docx có 5 loại câu | Nhận đủ 5, không nuốt loại nào |
| T1.2 | Câu trắc nghiệm nhiều phương án | Giữ đúng `correctAnswerId` |
| T1.3 | Ngữ liệu dùng chung cho 3 câu | In **một lần** ở câu đầu nhóm (đã có `Passage.test.js`) |
| T1.4 | Đề rỗng | Không cho lưu, báo rõ |

### T2. Trọng số điểm — **điểm chết**
| # | Ca | Phải đúng |
|---|---|---|
| T2.1 | Đọc hiểu 30%, 10 câu | Mỗi câu 0.3, **tổng đúng 3.0** không phải 2.9999999999999996 |
| T2.2 | Hai khối cùng ăn chung 30% | Đếm cả đề một lần rồi chia; chia theo từng khối là tổng vượt 10 |
| T2.3 | Tổng các phần | Đúng bằng thang điểm đề, không lệch |

> Đã có bên BE (`test_submission.py`): làm tròn tổng. **Còn thiếu**: T2.2 ở
> mức `diem_tung_cau`, và bản FE của `round`.

### T3. Ngân hàng đề
| # | Ca | Phải đúng |
|---|---|---|
| T3.1 | Rút đề từ ngân hàng | Trộn theo **nhóm ngữ liệu**, không tách câu khỏi văn bản đọc hiểu |
| T3.2 | Ngân hàng không đủ câu | Báo thiếu, không trả đề thiếu câu trong im lặng |
| T3.3 | Kiểm tra trùng | Phát hiện câu trùng trước khi lưu |

### T5. Chấm tự luận — **điểm chết**
| # | Ca | Phải đúng |
|---|---|---|
| T5.1 | Nhập 1.5 / 2.0 | Giữ 1.5 ✅ *(đã có)* |
| T5.2 | Nhập 5 khi tối đa 2.0 | Kéo về 2.0 ✅ *(đã có)* |
| T5.3 | Nhập số âm | Về 0 ✅ *(đã có)* |
| T5.4 | Xoá trắng ô điểm | Trả về "chưa chấm", **không** `float('')` → 500 ✅ *(đã có)* |
| T5.5 | Cho 0 điểm | Là 0 điểm thật, không nhầm thành "chưa chấm" ✅ *(đã có)* |
| T5.6 | Chấm xong câu cuối | Bài chuyển `GRADING` → `GRADED` ✅ *(đã có)* |

---

## S — Phía học sinh

### S1. Mua lượt
| # | Ca | Phải đúng |
|---|---|---|
| S1.1 | Thanh toán thành công (IPN) | Cộng đúng số lượt của gói |
| S1.2 | IPN gọi lại lần 2 cùng hoá đơn | **Không** cộng lượt hai lần (chống replay) |
| S1.3 | IPN sai `X-Secret-Key` | 401, không cộng gì |
| S1.4 | Số tiền lệch với đơn | Không mở khoá, ghi log |
| S1.5 | Mua 2 gói | `purchasedTurns` = tổng cả hai |

### S2. Mở đề — **điểm chết, đã hỏng thật 4 lần**
| # | Ca | Phải đúng |
|---|---|---|
| S2.1 | Mở đề lần đầu, còn lượt | Trừ đúng **1** lượt |
| S2.2 | F5 giữa lúc đang làm | Dùng lại lượt đang mở, **không** trừ thêm |
| S2.3 | **F5 ngay sau khi nộp** | Trả bài đã nộp, **không** trừ lượt ✅ *(đã có: cửa sổ 15 phút)* |
| S2.4 | Vào lại sau 15 phút | Mới tính là thi lại, lúc đó mới trừ lượt ✅ *(đã có)* |
| S2.5 | Hết lượt | 402 + popup mua gói, **không** tạo `Attempt` |
| S2.6 | Giáo viên mở đề của chính mình | Không trừ lượt |
| S2.7 | Đề miễn phí | Không trừ lượt |
| S2.8 | Hết giờ rồi mới vào lại | Lượt cũ đóng `auto`, không mở lượt mới âm thầm |

> **Cảnh báo cho react-query** (RULES.md mục 3): `GET exam/during_test` trừ
> lượt. Bọc nó bằng `useQuery` mà quên `retry: false` là một lần retry = một
> lượt của học sinh. Test S2.1 phải khẳng định **gọi đúng một lần**.

### S3. Làm bài
| # | Ca | Phải đúng |
|---|---|---|
| S3.1 | Đồng hồ đếm ngược | Theo `remaining_sec` của **server**, không theo giờ máy học sinh |
| S3.2 | Hết giờ | Tự nộp, **không** hỏi confirm ✅ *(đã có)* |
| S3.3 | Giáo viên sửa thời lượng giữa chừng | Lượt đang chạy **không** bị kéo dài/cắt ngắn |
| S3.4 | Mất mạng rồi vào lại | Bài làm còn nguyên; lưu hỏng phải **báo**, không nuốt ✅ *(đã có)* |

### S4. Nộp bài — **điểm chết**
| # | Ca | Phải đúng |
|---|---|---|
| S4.1 | Trắc nghiệm đúng | Được điểm ✅ *(đã có)* |
| S4.2 | Bỏ trống | 0 điểm, **không** phải "chưa chấm" ✅ *(đã có)* |
| S4.3 | Chọn "Sai" mà đáp án là Sai | Được điểm — `False` là falsy, `or ''` nuốt mất ✅ *(đã có)* |
| S4.4 | Đáp án nhiều cách viết `a\|b` | Viết cách nào cũng đúng ✅ *(đã có)* |
| S4.5 | Khác hoa thường, thừa khoảng trắng, **NFC/NFD** | Vẫn đúng ✅ *(đã có)* |
| S4.6 | Câu tự luận | Trả `None` → đẩy sang giáo viên ✅ *(đã có)* |
| S4.7 | **Nộp hai lần cùng một lượt** | Trả lại bài cũ, **không** nhân đôi điểm |
| S4.8 | Bấm Nộp đúng lúc hết giờ | Một `Submission` duy nhất |
| S4.9 | Đáp án đề đã xoá phương án | Không vỡ, trả về id ✅ *(đã có)* |
| S4.10 | Chụp đáp án đúng | Lưu **nội dung** chữ, không lưu `"a2"` ✅ *(đã có)* |

### S5–S6. Xem điểm
| # | Ca | Phải đúng |
|---|---|---|
| S5.1 | Còn câu chờ chấm | Hiện "chờ chấm", **không** hiện điểm tạm như điểm cuối |
| S5.2 | Mẫu số khi chưa chấm xong | Là `graded_max_score`, không phải `max_score` cả bài |
| S5.3 | Bảng điểm từng phần | Hai khối cùng tên gộp làm **một** ✅ *(đã có)* |
| S5.4 | Thứ tự các phần | Giữ thứ tự trong bài, không tự sắp lại theo số La Mã ✅ *(đã có)* |
| S5.5 | Bài cũ không có `section_name` | Rơi về dòng tổng, **không** hiện bảng rỗng ✅ *(đã có)* |
| S5.6 | Thời gian làm bài sau F5 | Lấy `duration_sec`, không hiện "0 phút" |
| S5.7 | Giờ hiển thị | BE trả UTC thiếu `Z` → vẫn ra giờ VN ✅ *(đã có)* |

---

## Hiện trạng

| Nhóm | Số ca | Phủ |
|---|---|---|
| BE `test_attempt.py` | 40 | S2 trừ lượt, S4.7/4.8 nộp hai lần |
| BE `test_submission.py` | 32 | S4 chấm máy, T5 vào điểm tay, S5 bảng điểm |
| BE `test_payment.py` | 51 | S1 toàn bộ: sai khoá, replay, lệch tiền, cộng lượt |
| BE `core_question_bank.py` (self-check) | — | T2 trọng số, T3 rút đề |
| BE `core_grading.py` (self-check) | — | S4.4/4.5 nhiều cách viết, hoa thường, Unicode NFC/NFD |
| FE `npm test` | 128 | 12 file, gồm DoExam (S2/S3) và DrawExam/ImportExam (T3) |

**Thứ tự bổ sung** — theo mức thiệt hại nếu hỏng:

1. ~~`S2` trừ lượt~~ ✅
2. ~~`S4.7/4.8` nộp hai lần~~ ✅
3. ~~`S1` thanh toán~~ ✅
4. ~~`T2` trọng số~~ ✅ *(self-check sẵn có, đã kiểm chứng bắt được bug)*
5. ~~`S3.2/3.4` hết giờ và mất mạng~~ ✅
6. ~~`S4.4/4.5` nhiều cách viết đáp án~~ ✅ *(tìm ra bug Unicode NFC/NFD)*
7. Còn lại: `T1` nhập .docx

## Quy ước viết test

- Tên ca ghi **hậu quả**, không ghi hành vi: `'F5 sau khi nộp không được trừ lượt'`,
  không phải `'test during_test'`.
- Mỗi ca một điều khẳng định. Hỏng thì đọc tên là biết hỏng gì.
- Logic thuần test thẳng. Cần Mongo thì tách hàm thuần ra như `core_grading.py`
  đã làm — đừng dựng DB để test một phép cộng.
- Sửa bug thì **thêm ca tái hiện bug đó trước**, rồi mới sửa.
