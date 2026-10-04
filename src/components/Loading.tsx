
/**
 * Loading dùng chung cho cả app. Chỉ có hình chạy, không chữ.
 *
 *   <Loading/>          — chèn tại chỗ, giữ nguyên khung trang xung quanh.
 *   <Loading overlay/>  — phủ lên nội dung đang có, KHÔNG thay thế nó.
 *
 * ponytail: trước đây mỗi trang tự `if (!data) return <Loader/>` — trả về THAY
 * cho cả trang, nên lúc tải thì nav và khung biến mất rồi nhảy vào lại. Overlay
 * giữ khung đứng yên, mắt không phải định vị lại sau mỗi lần tải.
 *
 * Hình: bốn trụ nâng lên hạ xuống theo sóng chạy từ trái sang phải.
 */
export default function Loading({overlay, size}: {overlay?: boolean; size?: number}) {
    // aria-busy + role=status + aria-label: không còn chữ trên màn hình thì
    // trình đọc màn hình phải lấy nhãn từ đây, nếu không nó im lặng hoàn toàn.
    return <div className={'tk-load' + (overlay ? ' tk-load-overlay' : '')}
                role='status' aria-busy='true' aria-label='Đang tải'>
        {/* viewBox 44x24: sóng chạy ngang nên khung rộng hơn cao. Chiều cao
            suy ra từ size để gọi <Loading size={72}/> không méo hình. */}
        <svg className='tk-load-svg' viewBox='0 0 44 24' aria-hidden='true'
             width={size || 64} height={(size || 64) * 24 / 44}>
            {/* 4 trụ rộng 8, cách đều 11 đơn vị. Lệch pha .1s mỗi trụ ->
                sóng chạy từ trái sang phải chứ không nhấp đồng loạt. */}
            <rect x='2'  y='2' width='8' height='20' rx='3'/>
            <rect x='13' y='2' width='8' height='20' rx='3'/>
            <rect x='24' y='2' width='8' height='20' rx='3'/>
            <rect x='35' y='2' width='8' height='20' rx='3'/>
        </svg>
    </div>;
}
