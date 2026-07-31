const PREFIX = 'pio'

export const sessionKey = (token: string) => `${PREFIX}:sess:${token}`
export const presetListKey = (userId: string) => `${PREFIX}:u:${userId}:list`
export const presetKey = (userId: string, id: string) => `${PREFIX}:u:${userId}:p:${id}`
export const rateLimitKey = (scope: string, window: number) => `rl:${scope}:${window}`
