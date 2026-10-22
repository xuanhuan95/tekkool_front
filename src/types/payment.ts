/** Exam-turn package on sale. */
export type Package = {
    id: string;
    name: string;
    turns: number;
    price: number;
    description?: string;
    /** false = hidden from the sales page. Only `package/list?all=1` (teacher) returns hidden packages. */
    active?: boolean;
    /** Display order on the sales page. BE sorts by `[order, price]`. */
    order?: number;
    /** "Phổ biến" label on the sales page. */
    featured?: boolean;
    /** Admin + `?all=1` only: number of PAID orders of this package. */
    sold?: number;
    created_at?: string | null;
};

/** BE returns this so FE can build the POST form to SePay. */
export type CheckoutForm = {
    invoice_number?: string;
    action_url: string;
    /** Array of [key, value], NOT an object: field order determines the signature. */
    fields: Array<[string, string]>;
};

/** Turns remaining. BE computes `remaining = bought - used` on every query — there is no balance table. */
export type Wallet = {
    bought: number;
    used: number;
    remaining: number;
};

/** Order. PENDING = waiting for the IPN from the bank, turns not yet added. */
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type Payment = {
    invoice_number: string;
    status: PaymentStatus;
    amount?: number;
    created_at?: string;
    items?: OrderItem[];
};

/** One line of an order. name/price/turns are SNAPSHOTS taken at checkout (SPT-21). */
export type OrderItem = {
    target_id?: string | null;
    target_type?: string | null;
    name?: string;
    price?: number;
    quantity?: number;
    /** Turns of ONE unit at purchase time; null on orders older than SPT-21. */
    turns?: number | null;
    subtotal?: number;
};
