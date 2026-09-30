import React from 'react';

/**
 * Tranh minh hoạ màn đăng nhập: hai học sinh đứng hai bên tờ đề thi.
 *
 * ponytail: vẽ thẳng bằng SVG inline thay vì nhúng file ảnh — không thêm
 * request, không lo màn retina vỡ nét, đổi tông màu chỉ là sửa hằng số.
 *
 * Toạ độ chia làn rõ ràng để hình không chồng lên nhau:
 *   người trái  x  40..150
 *   tờ đề       x 180..360
 *   người phải  x 390..500
 */
const C = {
    dark:  '#3d5a98',   // tóc, giày, nét đậm
    mid:   '#7d9ad6',   // áo, mảng chính
    light: '#b9cbee',   // mảng phụ
    pale:  '#dce7f9',   // nền nhạt
    paper: '#ffffff',
    skin:  '#f0d5bf',
};

export default function AuthArt() {
    return <svg viewBox="0 0 540 420" xmlns="http://www.w3.org/2000/svg"
                role="img" aria-label="Minh hoạ hai học sinh bên tờ đề thi">
        {/* Mảng loang nền, thấp hơn đầu người để không cắt ngang mặt */}
        <ellipse cx="270" cy="260" rx="236" ry="132" fill={C.pale}/>

        {/* Bong bóng trang trí */}
        <circle cx="452" cy="86" r="12" fill={C.mid} opacity=".55"/>
        <circle cx="92"  cy="112" r="7"  fill={C.mid} opacity=".45"/>

        {/* ================= Tờ đề thi ================= */}
        <g>
            <rect x="180" y="86" width="180" height="230" rx="11" fill={C.paper}
                  stroke={C.light} strokeWidth="2"/>
            {/* Gáy đề */}
            <rect x="180" y="86" width="25" height="230" rx="11" fill={C.mid} opacity=".22"/>
            {[116, 148, 180, 212, 244, 276].map(y =>
                <circle key={y} cx="192" cy={y} r="4.5" fill={C.mid} opacity=".85"/>)}

            {/* Tiêu đề */}
            <rect x="222" y="112" width="92" height="9" rx="4.5" fill={C.dark} opacity=".8"/>
            <rect x="222" y="129" width="54" height="7" rx="3.5" fill={C.light}/>

            {/* Ba câu hỏi, mỗi câu 4 ô đáp án — ô B tô đậm là đáp án đã chọn */}
            {[160, 204, 248].map(y => <g key={y}>
                <rect x="222" y={y} width="116" height="7" rx="3.5" fill={C.light}/>
                {[0, 1, 2, 3].map(i =>
                    <circle key={i} cx={228 + i * 25} cy={y + 21} r="5.5"
                            fill={i === 1 ? C.mid : C.paper}
                            stroke={C.light} strokeWidth="1.6"/>)}
            </g>)}

            {/* Dấu tích "đã nộp", đặt lệch ra mép phải cho nổi */}
            <circle cx="352" cy="300" r="17" fill={C.mid}/>
            <path d="M344 300l6 6 11-13" fill="none" stroke={C.paper}
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </g>

        {/* ============ Học sinh nữ, làn trái ============ */}
        <g>
            {/* Thứ tự vẽ: chân -> thân -> tay -> cổ -> đầu -> tóc.
                Vẽ tóc sau đầu, và chỉ phủ nửa trên hộp sọ — phủ cả vòng
                tròn thì thành cái mũ len, không ra tóc. */}
            <rect x="80"  y="290" width="12" height="62" fill={C.dark}/>
            <rect x="102" y="290" width="12" height="62" fill={C.dark}/>
            <ellipse cx="82"  cy="354" rx="12" ry="5" fill={C.dark}/>
            <ellipse cx="112" cy="354" rx="12" ry="5" fill={C.dark}/>

            {/* Cổ, vẽ trước thân để vai đè lên chân cổ */}
            <rect x="90" y="200" width="14" height="18" fill={C.skin}/>

            {/* Thân váy loe */}
            <path d="M76 216h42l11 80H65z" fill={C.mid}/>
            <path d="M76 216h42l3 20H73z" fill={C.dark} opacity=".2"/>

            {/* Đầu */}
            <circle cx="97" cy="184" r="18" fill={C.skin}/>
            {/* Tóc bob vẽ bằng MỘT path liền: vòm trên ôm đỉnh đầu rồi xoã
                thẳng xuống hai bên má. Tách vòm và lọn thành ba path rời thì
                hai lọn trông như cặp tai nghe úp vào đầu. */}
            <path d={'M97 165c-10 0-18 8-18 19v16c0 2 4 2 4 0v-13'
                     + 'c0-6 6-9 14-9s14 3 14 9v13c0 2 4 2 4 0v-16c0-11-8-19-18-19z'}
                  fill={C.dark}/>

            {/* Bảng điểm cầm trong hai tay */}
            <rect x="66" y="258" width="62" height="46" rx="6" fill={C.paper}
                  stroke={C.light} strokeWidth="2"/>
            <rect x="78" y="284" width="9" height="12" rx="2" fill={C.light}/>
            <rect x="93" y="274" width="9" height="22" rx="2" fill={C.mid}/>
            <rect x="108" y="265" width="9" height="31" rx="2" fill={C.dark} opacity=".75"/>

            {/* Hai tay ôm bảng điểm — vẽ SAU tấm bảng nên bàn tay nằm ĐÈ lên
                mép bảng, ra dáng đang giữ chứ không phải bảng dán vào bụng. */}
            <path d="M78 226c-10 14-13 30-11 44" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M116 226c10 14 13 30 11 44" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="68"  cy="272" r="6" fill={C.skin}/>
            <circle cx="126" cy="272" r="6" fill={C.skin}/>
        </g>

        {/* ============ Học sinh nam, làn phải ============ */}
        <g>
            <rect x="430" y="292" width="12" height="60" fill={C.dark}/>
            <rect x="452" y="292" width="12" height="60" fill={C.dark}/>
            <ellipse cx="432" cy="354" rx="12" ry="5" fill={C.dark}/>
            <ellipse cx="462" cy="354" rx="12" ry="5" fill={C.dark}/>

            <rect x="440" y="204" width="14" height="18" fill={C.skin}/>

            <path d="M426 216h42l9 82h-60z" fill={C.mid}/>
            <path d="M426 216h42l3 20h-48z" fill={C.dark} opacity=".2"/>

            {/* Tay trái buông dọc thân */}
            <path d="M470 228c7 14 9 28 8 40" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Tay phải vươn sang tờ đề. Vai (424,230) -> khuỷu (400,244)
                -> cổ tay (378,258). Bút bắt đầu Ở cổ tay, không phải ở vai. */}
            <path d="M424 230c-9 4-17 9-24 14-7 5-14 9-22 14" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Bàn tay */}
            <circle cx="376" cy="260" r="6.5" fill={C.skin}/>

            {/* Bút nằm trong bàn tay, ngòi chỉ về tờ đề (bên trái). */}
            <g transform="rotate(-20 376 260)">
                <rect x="376" y="255" width="34" height="9.5" rx="2.5" fill={C.light}/>
                <rect x="396" y="255" width="14" height="9.5" rx="2.5" fill={C.mid}/>
                <path d="M376 255l-13 4.75 13 4.75z" fill={C.dark}/>
            </g>

            <circle cx="447" cy="188" r="17" fill={C.skin}/>
            {/* Tóc ngắn: chỉ vòm trên đầu */}
            <path d="M430 188a17 17 0 0 1 34 0c-3-6-9-9-17-9s-14 3-17 9z" fill={C.dark}/>
        </g>

        {/* Đường nền dưới chân */}
        <path d="M46 354h448" stroke={C.dark} strokeWidth="1.6" opacity=".3"/>
    </svg>;
}
