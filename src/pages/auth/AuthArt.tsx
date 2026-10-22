
/**
 * Login screen illustration: two students standing either side of an exam paper.
 *
 * ponytail: drawn directly as inline SVG rather than embedding an image file — no extra
 * request, no blurry retina screens, changing the colour tone is just editing a constant.
 *
 * Coordinates are split into clear lanes so shapes do not overlap:
 *   left person   x  40..150
 *   exam paper    x 180..360
 *   right person  x 390..500
 */
const C = {
    dark:  '#3d5a98',   // hair, shoes, bold strokes
    mid:   '#7d9ad6',   // shirt, main areas
    light: '#b9cbee',   // secondary areas
    pale:  '#dce7f9',   // pale background
    paper: '#ffffff',
    skin:  '#f0d5bf',
};

export default function AuthArt() {
    return <svg viewBox="0 0 540 420" xmlns="http://www.w3.org/2000/svg"
                role="img" aria-label="Minh hoạ hai học sinh bên tờ đề thi">
        {/* Background blob, lower than the heads so it does not cut across the faces */}
        <ellipse cx="270" cy="260" rx="236" ry="132" fill={C.pale}/>

        {/* Decorative bubbles */}
        <circle cx="452" cy="86" r="12" fill={C.mid} opacity=".55"/>
        <circle cx="92"  cy="112" r="7"  fill={C.mid} opacity=".45"/>

        {/* ================= Exam paper ================= */}
        <g>
            <rect x="180" y="86" width="180" height="230" rx="11" fill={C.paper}
                  stroke={C.light} strokeWidth="2"/>
            {/* Paper spine */}
            <rect x="180" y="86" width="25" height="230" rx="11" fill={C.mid} opacity=".22"/>
            {[116, 148, 180, 212, 244, 276].map(y =>
                <circle key={y} cx="192" cy={y} r="4.5" fill={C.mid} opacity=".85"/>)}

            {/* Title */}
            <rect x="222" y="112" width="92" height="9" rx="4.5" fill={C.dark} opacity=".8"/>
            <rect x="222" y="129" width="54" height="7" rx="3.5" fill={C.light}/>

            {/* Three questions, each with 4 answer circles — the filled B circle is the chosen answer */}
            {[160, 204, 248].map(y => <g key={y}>
                <rect x="222" y={y} width="116" height="7" rx="3.5" fill={C.light}/>
                {[0, 1, 2, 3].map(i =>
                    <circle key={i} cx={228 + i * 25} cy={y + 21} r="5.5"
                            fill={i === 1 ? C.mid : C.paper}
                            stroke={C.light} strokeWidth="1.6"/>)}
            </g>)}

            {/* "Submitted" checkmark, offset toward the right edge to stand out */}
            <circle cx="352" cy="300" r="17" fill={C.mid}/>
            <path d="M344 300l6 6 11-13" fill="none" stroke={C.paper}
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </g>

        {/* ============ Female student, left lane ============ */}
        <g>
            {/* Drawing order: legs -> body -> arms -> neck -> head -> hair.
                Hair is drawn after the head and covers only the top half of the skull — covering
                the whole circle makes it a wool hat, not hair. */}
            <rect x="80"  y="290" width="12" height="62" fill={C.dark}/>
            <rect x="102" y="290" width="12" height="62" fill={C.dark}/>
            <ellipse cx="82"  cy="354" rx="12" ry="5" fill={C.dark}/>
            <ellipse cx="112" cy="354" rx="12" ry="5" fill={C.dark}/>

            {/* Neck, drawn before the body so the shoulders overlap its base */}
            <rect x="90" y="200" width="14" height="18" fill={C.skin}/>

            {/* Flared dress body */}
            <path d="M76 216h42l11 80H65z" fill={C.mid}/>
            <path d="M76 216h42l3 20H73z" fill={C.dark} opacity=".2"/>

            {/* Head */}
            <circle cx="97" cy="184" r="18" fill={C.skin}/>
            {/* Bob hair drawn as ONE continuous path: the top arc hugs the crown then falls
                straight down both cheeks. Splitting the arc and locks into three separate paths makes
                the two locks look like headphones clamped on the head. */}
            <path d={'M97 165c-10 0-18 8-18 19v16c0 2 4 2 4 0v-13'
                     + 'c0-6 6-9 14-9s14 3 14 9v13c0 2 4 2 4 0v-16c0-11-8-19-18-19z'}
                  fill={C.dark}/>

            {/* Score sheet held in both hands */}
            <rect x="66" y="258" width="62" height="46" rx="6" fill={C.paper}
                  stroke={C.light} strokeWidth="2"/>
            <rect x="78" y="284" width="9" height="12" rx="2" fill={C.light}/>
            <rect x="93" y="274" width="9" height="22" rx="2" fill={C.mid}/>
            <rect x="108" y="265" width="9" height="31" rx="2" fill={C.dark} opacity=".75"/>

            {/* Both arms hugging the score sheet — drawn AFTER the sheet so the hands sit ON TOP
                of its edge, looking like holding it rather than the sheet pasted to the belly. */}
            <path d="M78 226c-10 14-13 30-11 44" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M116 226c10 14 13 30 11 44" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="68"  cy="272" r="6" fill={C.skin}/>
            <circle cx="126" cy="272" r="6" fill={C.skin}/>
        </g>

        {/* ============ Male student, right lane ============ */}
        <g>
            <rect x="430" y="292" width="12" height="60" fill={C.dark}/>
            <rect x="452" y="292" width="12" height="60" fill={C.dark}/>
            <ellipse cx="432" cy="354" rx="12" ry="5" fill={C.dark}/>
            <ellipse cx="462" cy="354" rx="12" ry="5" fill={C.dark}/>

            <rect x="440" y="204" width="14" height="18" fill={C.skin}/>

            <path d="M426 216h42l9 82h-60z" fill={C.mid}/>
            <path d="M426 216h42l3 20h-48z" fill={C.dark} opacity=".2"/>

            {/* Left arm hanging along the body */}
            <path d="M470 228c7 14 9 28 8 40" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Right arm reaching for the exam paper. Shoulder (424,230) -> elbow (400,244)
                -> wrist (378,258). The pen starts AT the wrist, not the shoulder. */}
            <path d="M424 230c-9 4-17 9-24 14-7 5-14 9-22 14" fill="none" stroke={C.mid}
                  strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Hand */}
            <circle cx="376" cy="260" r="6.5" fill={C.skin}/>

            {/* Pen in the hand, nib pointing toward the exam paper (left). */}
            <g transform="rotate(-20 376 260)">
                <rect x="376" y="255" width="34" height="9.5" rx="2.5" fill={C.light}/>
                <rect x="396" y="255" width="14" height="9.5" rx="2.5" fill={C.mid}/>
                <path d="M376 255l-13 4.75 13 4.75z" fill={C.dark}/>
            </g>

            <circle cx="447" cy="188" r="17" fill={C.skin}/>
            {/* Short hair: only the top arc of the head */}
            <path d="M430 188a17 17 0 0 1 34 0c-3-6-9-9-17-9s-14 3-17 9z" fill={C.dark}/>
        </g>

        {/* Ground line under the feet */}
        <path d="M46 354h448" stroke={C.dark} strokeWidth="1.6" opacity=".3"/>
    </svg>;
}
