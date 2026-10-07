// export const API_URL = 'http://0.0.0.0:5000/api/';
// ponytail: the fallback is the production domain, so a build without the env
// still produces the old behavior. Local/docker set VITE_API_URL to point at their own BE.
// Note: api.ts concatenates raw strings so the trailing / is REQUIRED.
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.tekkool.com/api/';
