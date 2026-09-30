import { createTranslator } from '@warka/shared'

const workflows = [
  ['workflow.registration', 'students-heading'],
  ['workflow.attendance', 'teacher-attendance-heading'],
  ['workflow.coursework', 'teacher-coursework-heading'],
  ['workflow.gradebook', 'gradebook-heading'],
  ['workflow.documents', 'school-documents-heading'],
  ['workflow.timetable', 'timetable-heading'],
  ['workflow.assessments', 'assessment-calendar-heading'],
  ['workflow.dataQuality', 'data-quality-heading'],
  ['workflow.reporting', 'school-reporting-heading'],
] as const

export function StaffWorkflowNavigation({
  locale,
}: {
  locale?: string | undefined
}) {
  const t = createTranslator({ locale: locale ?? 'en' })
  return (
    <nav aria-label={t('workflow.navigation')} className="workspace-nav">
      {workflows.map(([key, target]) => (
        <a href={`#${target}`} key={target}>
          {t(key)}
        </a>
      ))}
    </nav>
  )
}
