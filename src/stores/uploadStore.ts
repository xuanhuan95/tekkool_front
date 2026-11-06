import {create} from 'zustand';

/** How many editor images are still uploading. Save buttons wait for 0 (the BE drops `data:` images, so an unfinished one would be lost). */
export const useUploadStore = create<{pending: number}>(() => ({pending: 0}));
export const addPending = (d: number) => useUploadStore.setState(s => ({pending: Math.max(0, s.pending + d)}));
