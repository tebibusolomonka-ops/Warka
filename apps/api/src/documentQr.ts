import { z } from 'zod'
import QRCode from 'qrcode'

const baseUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    ['http:', 'https:'].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  )
})

export function documentVerificationUrl(
  reference: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const base = baseUrlSchema.parse(env.PUBLIC_BASE_URL)
  if (!/^WRK-[A-F0-9]{32}$/.test(reference))
    throw new Error('Invalid verification reference')
  return new URL(
    `verify/documents/${reference}`,
    base.endsWith('/') ? base : `${base}/`,
  ).toString()
}

export async function documentVerificationQr(
  reference: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  return QRCode.toDataURL(documentVerificationUrl(reference, env), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 160,
  })
}
