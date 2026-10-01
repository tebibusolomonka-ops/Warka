export type UploadProgress = {
  sessionId: string
  uploadedChunks: number
  totalChunks: number
  state: 'uploading' | 'paused' | 'completed' | 'cancelled'
}
export async function uploadResumably(
  file: File,
  sessionId: string,
  confirmedChunks: number,
  send: (index: number, bytes: Blob) => Promise<void>,
  chunkSize = 1024 * 1024,
): Promise<UploadProgress> {
  const totalChunks = Math.ceil(file.size / chunkSize)
  for (let index = confirmedChunks; index < totalChunks; index += 1)
    await send(
      index,
      file.slice(
        index * chunkSize,
        Math.min(file.size, (index + 1) * chunkSize),
      ),
    )
  return {
    sessionId,
    uploadedChunks: totalChunks,
    totalChunks,
    state: 'completed',
  }
}
export function resumableMetadata(file: File) {
  return { name: file.name, size: file.size, type: file.type }
}
