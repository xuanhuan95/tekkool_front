/** Gói lượt thi đang bán. */
export type Package = {
    id: string;
    name: string;
    turns: number;
    price: number;
    description?: string;
};

/** BE trả về để FE dựng form POST sang SePay. */
export type CheckoutForm = {
    action_url: string;
    /** Mảng [key, value] chứ KHÔNG phải object: thứ tự field quyết định chữ ký. */
    fields: Array<[string, string]>;
};

/** Số lượt còn lại. BE tính `remaining = bought - used` mỗi lần hỏi — không có bảng số dư. */
export type Wallet = {
    bought: number;
    used: number;
    remaining: number;
};

/** Đơn hàng. PENDING = chờ IPN từ ngân hàng về, chưa cộng lượt. */
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type Payment = {
    invoice_number: string;
    status: PaymentStatus;
    amount?: number;
    created_at?: string;
    items?: Array<{name?: string; quantity?: number}>;
};
