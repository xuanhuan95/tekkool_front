/** Người dùng BE trả về ở `session/init`, `session/login`, `user/register`. */
export type User = {
    id: string;
    name: string;
    email: string;
    group: UserGroup;
    /** Số lượt thi còn lại. Chỉ có ở học sinh. */
    turns?: number;
};

/** `visitor` là phiên ẩn danh BE tự cấp — chưa đăng nhập nhưng vẫn có token. */
export type UserGroup = 'visitor' | 'student' | 'teacher';

/**
 * Phiên đăng nhập. `id` chính là TOKEN, không phải id người dùng —
 * tên field do BE đặt (`session/init` trả `{id, user}`), FE giữ nguyên
 * để khỏi phải dịch ở mọi chỗ đọc.
 */
export type Auth = {
    id: string;
    user: User | null;
};
