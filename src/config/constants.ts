import { version } from '../../package.json'

export const APP_VERSION: string = version

export const DEFAULT_SQLITE_PATH = './data/presets.sqlite'

export const CACHE_TTL_SECONDS = 300
export const SESSION_TTL_SECONDS = 60 * 60 * 4
export const MEMORY_CACHE_MAX_ENTRIES = 2_000

export const RATE_LIMIT_MAX_ENTRIES = 10_000
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000

export const PRESET_BODY_LIMIT_BYTES = 1_048_576
export const IMPORT_BODY_LIMIT_BYTES = 10_485_760

export const BCRYPT_COST = 10

// Compared against when a username is not found, so login costs the same
// whether or not the account exists (CWE-203). Not a usable credential.
export const DUMMY_PASSWORD_HASH = '$2b$10$.lUajHv/0cDGSGpeqMqTfOul3XcmWZPqD5ZJI1yiCsc1xi71c2sIK'

export const MIN_SESSION_SECRET_LENGTH = 32
export const MIN_PASSWORD_LENGTH = 6
export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 64

export const REQUEST_TIMEOUT_MS = 15_000
export const CLOUD_REQUEST_TIMEOUT_MS = 30_000

export const MAX_BODY_CHARS = 100_000
export const PREVIEW_DEBOUNCE_MS = 120
