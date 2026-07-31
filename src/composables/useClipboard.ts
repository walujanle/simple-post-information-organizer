export function useClipboard() {
  async function copyText(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
    } catch {}
  }

  return { copyText }
}
