import {Skeleton, SkeletonCard} from './ui';

/**
 * Whole-page loading: grey #EFEFEC blocks (rule 10), never a spinner. Used while the app boots,
 * for lazy chunks and by the old teacher screens that fetch before they render.
 */
export default function Loading() {
    return <div className='vt-loading-page' role='status' aria-busy='true' aria-label='Đang tải'>
        <Skeleton width='40%' height={32}/>
        <SkeletonCard/>
        <SkeletonCard/>
    </div>;
}
