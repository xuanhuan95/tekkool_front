/** User returned by BE at `session/init`, `session/login`, `user/register`. */
export type User = {
    id: string;
    name: string;
    email: string;
    group: UserGroup;
    /** Remaining exam turns. Only present for students. */
    turns?: number;
};

/** `visitor` is an anonymous session BE issues itself — not logged in but still has a token. */
export type UserGroup = 'visitor' | 'student' | 'teacher';

/**
 * Login session. `id` is the TOKEN, not the user id —
 * the field name is set by BE (`session/init` returns `{id, user}`), FE keeps it
 * as-is to avoid translating at every read site.
 */
export type Auth = {
    id: string;
    user: User | null;
};
