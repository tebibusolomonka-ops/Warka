import { readFile } from 'node:fs/promises'
import { DocumentSnapshotSchema, type IssuedDocument } from '@warka/database'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'

const fontFile = new URL('../assets/NotoSansEthiopic.ttf', import.meta.url)

export function reportCardContent(document: IssuedDocument) {
  const snapshot = DocumentSnapshotSchema.parse(document.snapshot)
  if (
    snapshot.documentType !== 'reportCard' ||
    document.documentType !== 'reportCard'
  ) {
    throw new Error('Report card document required')
  }
  return { snapshot, verificationReference: document.verificationReference }
}

export async function renderReportCard(
  document: IssuedDocument,
): Promise<Uint8Array> {
  const { snapshot, verificationReference } = reportCardContent(document)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(fontFile), { subset: true })
  const page = pdf.addPage([595.28, 841.89])
  const left = 48
  const right = 547
  let y = 792
  const write = (value: string, x: number, size = 10) => {
    page.drawText(value, { x, y, size, font, color: rgb(0.12, 0.18, 0.26) })
  }
  const line = () => {
    page.drawLine({
      start: { x: left, y },
      end: { x: right, y },
      thickness: 0.6,
      color: rgb(0.72, 0.77, 0.82),
    })
  }
  const row = (label: string, value: string) => {
    write(label, left, 9)
    write(value, 183, 9)
    y -= 20
  }
  write('Warka', left, 23)
  y -= 34
  write(snapshot.issuingSchool, left, 15)
  y -= 24
  const contact = snapshot.schoolContact
  for (const value of [
    contact?.addressLine,
    [contact?.city, contact?.region].filter(Boolean).join(', '),
    contact?.phone,
    contact?.email,
    contact?.website,
  ]) {
    if (value) {
      write(value, left, 8)
      y -= 13
    }
  }
  y -= 17
  line()
  y -= 29
  write('Official Report Card', left, 17)
  y -= 31
  row('Student', snapshot.student.displayName)
  row('Warka reference', snapshot.student.studentReference)
  row('Academic year', snapshot.academicYear)
  row('Issued', snapshot.issuedAt.slice(0, 10))
  y -= 10
  line()
  y -= 22
  write('Subject', left, 9)
  write('Grading period', 254, 9)
  write('Result', 412, 9)
  write('Grade', 477, 9)
  y -= 14
  line()
  y -= 20
  for (const subject of snapshot.subjects) {
    if (y < 105) throw new Error('Report card exceeds one page')
    write(subject.subject, left, 9)
    write(subject.gradingPeriod, 254, 9)
    write(`${subject.percentage}%`, 412, 9)
    write(subject.gradeLabel, 477, 9)
    y -= 23
  }
  y -= 10
  line()
  y -= 20
  write(`Verification reference: ${verificationReference}`, left, 9)
  if (contact?.documentFooter) {
    y -= 22
    write(contact.documentFooter, left, 8)
  }
  return pdf.save({ useObjectStreams: false })
}
