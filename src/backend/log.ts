const PREFIX = '[pio]'

export const logWarn = (message: string, err?: unknown) => console.warn(`${PREFIX} ${message}`, err)
export const logError = (message: string, err?: unknown) =>
  console.error(`${PREFIX} ${message}`, err)
