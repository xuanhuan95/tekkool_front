/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

/** Build id injected by vite.config.js; same value as dist/version.json (SPT-124). */
declare const __APP_VERSION__: string;
