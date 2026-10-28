import {API_URL} from '../../settings';

/** Handwriting photos are private: <img> carries the session token (BE: the student, the exam's teacher, Admin only). */
export const answerImageUrl = (id: string) => API_URL + 'answer_image/view/' + id + '?token=' + (window.token || '');
