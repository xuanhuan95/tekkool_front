
/**
 * Shared Loading for the whole app. Animation only, no text.
 *
 *   <Loading/>          — inserted in place, keeping the surrounding page frame.
 *   <Loading overlay/>  — covers the existing content, does NOT replace it.
 *
 * ponytail: previously every page did its own `if (!data) return <Loader/>` —
 * returned INSTEAD of the whole page, so the nav and frame vanished while
 * loading and then jumped back in. The overlay keeps the frame still, so the
 * eye does not have to re-locate after every load.
 *
 * Shape: four pillars rising and falling in a wave running left to right.
 */
export default function Loading({overlay, size}: {overlay?: boolean; size?: number}) {
    // aria-busy + role=status + aria-label: with no text on screen, screen
    // readers must take the label from here, otherwise they stay completely silent.
    return <div className={'tk-load' + (overlay ? ' tk-load-overlay' : '')}
                role='status' aria-busy='true' aria-label='Đang tải'>
        {/* viewBox 44x24: the wave runs horizontally so the frame is wider than tall.
            Height is derived from size so <Loading size={72}/> is not distorted. */}
        <svg className='tk-load-svg' viewBox='0 0 44 24' aria-hidden='true'
             width={size || 64} height={(size || 64) * 24 / 44}>
            {/* 4 pillars 8 wide, spaced 11 units apart. Each is .1s out of phase ->
                a wave running left to right instead of all pulsing together. */}
            <rect x='2'  y='2' width='8' height='20' rx='3'/>
            <rect x='13' y='2' width='8' height='20' rx='3'/>
            <rect x='24' y='2' width='8' height='20' rx='3'/>
            <rect x='35' y='2' width='8' height='20' rx='3'/>
        </svg>
    </div>;
}
