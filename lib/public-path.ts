/** Browser asset prefix. Empty string means the app runs at the site root. */
export const PUBLIC_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '/dashboard').replace(/\/$/, '')
