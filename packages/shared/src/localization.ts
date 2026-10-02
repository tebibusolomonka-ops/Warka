import { z } from 'zod'

export const supportedLocales = ['en', 'am', 'om'] as const

export type SupportedLocale = (typeof supportedLocales)[number]
export type TranslationCatalog = Readonly<Record<string, string>>
export type TranslationValues = Readonly<Record<string, string | number>>

export const defaultLocale: SupportedLocale = 'en'

export const LanguagePreferenceSchema = z.enum(supportedLocales)
export const LanguagePreferenceResponseSchema = z.strictObject({
  preferredLocale: LanguagePreferenceSchema,
})

const englishCatalog = {
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.save': 'Save',
  'common.loading': 'Loading',
  'common.greeting': 'Hello, {name}',
  'locale.english': 'English',
  'locale.amharic': 'Amharic',
  'locale.oromo': 'Oromo',
  'navigation.label': 'Application navigation',
  'navigation.skip': 'Skip to main content',
  'navigation.signIn': 'Sign in',
  'navigation.signOut': 'Sign out',
  'navigation.account': 'Account',
  'navigation.security': 'Security',
  'navigation.notifications': 'Notifications',
  'navigation.search': 'Search',
  'navigation.students': 'Students',
  'navigation.academics': 'Academics',
  'navigation.documents': 'Documents',
  'navigation.reporting': 'Reporting',
  'navigation.operations': 'Operations',
  'navigation.support': 'Support',
  'navigation.settings': 'Settings',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signingIn': 'Signing in',
  'auth.productEyebrow': 'Education operations platform',
  'auth.productDescription':
    'Secure school records and services for education communities.',
  'auth.productHighlights': 'Warka capabilities',
  'auth.highlightRecords': 'Connected school and academic records',
  'auth.highlightFamilies': 'Student and family services',
  'auth.highlightReporting': 'Responsible reporting and operations',
  'auth.loginTitle': 'Welcome back',
  'auth.loginDescription': 'Sign in to continue to your Warka workspace.',
  'auth.loginValidation': 'Enter a valid email and password.',
  'auth.invalidCredentials': 'Invalid email or password.',
  'auth.loginUnavailable': 'Could not sign in. Please try again.',
  'auth.showPassword': 'Show password',
  'auth.hidePassword': 'Hide password',
  'auth.forgotPassword': 'Forgot your password?',
  'auth.authorizedUse': 'Use your authorized school or organization account.',
  'auth.serviceNotice': 'Service notice',
  'auth.forgotTitle': 'Recover your account',
  'auth.forgotDescription':
    'Enter your account email and we will send recovery instructions when the account is eligible.',
  'auth.backToLogin': 'Back to sign in',
  'auth.sendingRecovery': 'Sending request',
  'auth.checkEmailTitle': 'Check your email',
  'auth.checkEmailDescription':
    'Follow the link in the message to choose a new password. The link may take a few minutes to arrive.',
  'auth.recoveryUnavailable':
    'Could not submit the recovery request. Please try again.',
  'auth.resetTitle': 'Choose a new password',
  'auth.resetDescription': 'Create a strong password for your Warka account.',
  'auth.passwordRequirements':
    'Use at least 12 characters. A longer, unique passphrase is recommended.',
  'auth.passwordTooShort': 'Use at least 12 characters for your new password.',
  'auth.passwordMismatch': 'The passwords do not match.',
  'auth.resettingPassword': 'Resetting password',
  'auth.missingTokenTitle': 'Recovery link required',
  'auth.missingTokenDescription':
    'Open the complete recovery link from your email to reset your password.',
  'auth.requestNewLink': 'Request a new recovery link',
  'auth.resetCompleteTitle': 'Password reset complete',
  'auth.signInWithNewPassword': 'Sign in with your new password',
  'auth.notFoundTitle': 'Page not found',
  'auth.notFoundDescription':
    'The authentication page you requested is not available.',
  'auth.notFoundHelp': 'Check the address or return to the sign-in page.',
  'auth.changePassword': 'Change password',
  'auth.changePasswordHeading': 'Change your password',
  'auth.changePasswordPrompt': 'Choose a new password to continue.',
  'auth.currentPassword': 'Current password',
  'auth.newPassword': 'New password',
  'auth.confirmPassword': 'Confirm new password',
  'auth.changingPassword': 'Changing password',
  'auth.passwordValidation':
    'Use at least 12 characters and confirm the new password.',
  'auth.currentPasswordIncorrect': 'Current password is incorrect.',
  'auth.passwordChangeFailed': 'Could not change password. Try again.',
  'auth.accountRecovery': 'Account recovery',
  'auth.recoveryEmail': 'Recovery email',
  'auth.requestRecovery': 'Request recovery',
  'auth.recoveryToken': 'Recovery token',
  'auth.recoveryPassword': 'New recovery password',
  'auth.resetPassword': 'Reset password',
  'auth.recoveryNeutral':
    'If the account exists, recovery instructions will be sent.',
  'auth.recoveryRequestFailed': 'Could not submit recovery request',
  'auth.recoveryReset': 'Password reset. Sign in with your new password.',
  'auth.recoveryTokenInvalid': 'Invalid or expired recovery token',
  'auth.accountSecurity': 'Account security',
  'auth.activeSessions': 'Active sessions',
  'auth.created': 'Created',
  'auth.expires': 'Expires',
  'auth.currentSession': 'Current session',
  'auth.revokeSession': 'Revoke session',
  'auth.revokeOthers': 'Revoke all other sessions',
  'auth.passwordChanged': 'Password changed',
  'auth.sessionsLoadFailed': 'Could not load sessions',
  'auth.sessionRevokeFailed': 'Could not revoke session',
  'portal.student': 'Student portal',
  'portal.parent': 'Parent portal',
  'portal.sections': 'Portal sections',
  'portal.overview': 'Overview',
  'portal.results': 'Results',
  'portal.materials': 'Materials',
  'portal.announcements': 'Announcements',
  'portal.documents': 'Documents',
  'portal.attendance': 'Attendance',
  'portal.coursework': 'Coursework',
  'portal.events': 'Events',
  'portal.meetings': 'Meetings',
  'portal.messages': 'Messages',
  'portal.child': 'Child',
  'portal.school': 'School',
  'portal.academicYear': 'Academic year',
  'portal.grade': 'Grade',
  'portal.class': 'Class',
  'portal.relationship': 'Relationship',
  'portal.publishedResults': 'Published results',
  'workflow.navigation': 'School workflow navigation',
  'workflow.registration': 'Student registration',
  'workflow.attendance': 'Attendance capture',
  'workflow.coursework': 'Coursework management',
  'workflow.gradebook': 'Gradebook',
  'workflow.documents': 'School documents',
  'workflow.timetable': 'Timetable',
  'workflow.assessments': 'Assessment administration',
  'workflow.dataQuality': 'Data quality',
  'workflow.reporting': 'Regional reporting',
  'status.pending': 'Pending',
  'status.approved': 'Approved',
  'status.draft': 'Draft',
  'status.published': 'Published',
  'status.finalized': 'Finalized',
  'status.absent': 'Absent',
  'status.present': 'Present',
  'settings.localization': 'Language and calendar',
  'settings.language': 'Language',
  'settings.calendar': 'Calendar',
  'settings.gregorian': 'Gregorian',
  'settings.ethiopian': 'Ethiopian',
} as const satisfies TranslationCatalog

export type TranslationKey = keyof typeof englishCatalog

const amharicCatalog: Partial<Record<TranslationKey, string>> = {
  'common.cancel': 'ይቅር',
  'common.continue': 'ቀጥል',
  'common.save': 'አስቀምጥ',
  'common.loading': 'በመጫን ላይ',
  'common.greeting': 'ሰላም፣ {name}',
  'locale.english': 'እንግሊዝኛ',
  'locale.amharic': 'አማርኛ',
  'locale.oromo': 'ኦሮምኛ',
  'navigation.label': 'የመተግበሪያ አሰሳ',
  'navigation.skip': 'ወደ ዋናው ይዘት ዝለል',
  'navigation.signIn': 'ግባ',
  'navigation.signOut': 'ውጣ',
  'navigation.account': 'መለያ',
  'navigation.security': 'ደህንነት',
  'navigation.notifications': 'ማሳወቂያዎች',
  'navigation.search': 'ፍለጋ',
  'navigation.students': 'ተማሪዎች',
  'navigation.academics': 'ትምህርት',
  'navigation.documents': 'ሰነዶች',
  'navigation.reporting': 'ሪፖርት',
  'navigation.operations': 'ክዋኔዎች',
  'navigation.support': 'ድጋፍ',
  'navigation.settings': 'ቅንብሮች',
  'auth.email': 'ኢሜይል',
  'auth.password': 'የይለፍ ቃል',
  'auth.signingIn': 'በመግባት ላይ',
  'auth.changePassword': 'የይለፍ ቃል ቀይር',
  'auth.changePasswordHeading': 'የይለፍ ቃልዎን ይቀይሩ',
  'auth.changePasswordPrompt': 'ለመቀጠል አዲስ የይለፍ ቃል ይምረጡ።',
  'auth.currentPassword': 'የአሁኑ የይለፍ ቃል',
  'auth.newPassword': 'አዲስ የይለፍ ቃል',
  'auth.confirmPassword': 'አዲሱን የይለፍ ቃል ያረጋግጡ',
  'auth.changingPassword': 'የይለፍ ቃል በመቀየር ላይ',
  'auth.passwordValidation': 'ቢያንስ 12 ፊደላትን ይጠቀሙ እና አዲሱን የይለፍ ቃል ያረጋግጡ።',
  'auth.currentPasswordIncorrect': 'የአሁኑ የይለፍ ቃል ትክክል አይደለም።',
  'auth.passwordChangeFailed': 'የይለፍ ቃል መቀየር አልተቻለም። እንደገና ይሞክሩ።',
  'auth.accountRecovery': 'የመለያ መልሶ ማግኛ',
  'auth.recoveryEmail': 'የመልሶ ማግኛ ኢሜይል',
  'auth.requestRecovery': 'መልሶ ማግኛ ጠይቅ',
  'auth.recoveryToken': 'የመልሶ ማግኛ ቶከን',
  'auth.recoveryPassword': 'አዲስ የመልሶ ማግኛ የይለፍ ቃል',
  'auth.resetPassword': 'የይለፍ ቃል ዳግም አስጀምር',
  'auth.recoveryNeutral': 'መለያው ካለ፣ የመልሶ ማግኛ መመሪያዎች ይላካሉ።',
  'auth.recoveryRequestFailed': 'የመልሶ ማግኛ ጥያቄውን ማስገባት አልተቻለም',
  'auth.recoveryReset': 'የይለፍ ቃሉ ዳግም ተጀምሯል። በአዲሱ የይለፍ ቃል ይግቡ።',
  'auth.recoveryTokenInvalid': 'የመልሶ ማግኛ ቶከኑ ልክ አይደለም ወይም ጊዜው አልፏል',
  'auth.accountSecurity': 'የመለያ ደህንነት',
  'auth.activeSessions': 'ንቁ ክፍለ ጊዜዎች',
  'auth.created': 'የተፈጠረ',
  'auth.expires': 'የሚያበቃው',
  'auth.currentSession': 'የአሁኑ ክፍለ ጊዜ',
  'auth.revokeSession': 'ክፍለ ጊዜ ሻር',
  'auth.revokeOthers': 'ሌሎች ክፍለ ጊዜዎችን ሁሉ ሻር',
  'auth.passwordChanged': 'የይለፍ ቃሉ ተቀይሯል',
  'auth.sessionsLoadFailed': 'ክፍለ ጊዜዎችን መጫን አልተቻለም',
  'auth.sessionRevokeFailed': 'ክፍለ ጊዜውን መሻር አልተቻለም',
  'portal.student': 'የተማሪ መግቢያ',
  'portal.parent': 'የወላጅ መግቢያ',
  'portal.sections': 'የመግቢያ ክፍሎች',
  'portal.overview': 'አጠቃላይ እይታ',
  'portal.results': 'ውጤቶች',
  'portal.materials': 'የመማሪያ ቁሳቁሶች',
  'portal.announcements': 'ማስታወቂያዎች',
  'portal.documents': 'ሰነዶች',
  'portal.attendance': 'መገኘት',
  'portal.coursework': 'የክፍል ሥራ',
  'portal.events': 'ዝግጅቶች',
  'portal.meetings': 'ስብሰባዎች',
  'portal.messages': 'መልዕክቶች',
  'portal.child': 'ልጅ',
  'portal.school': 'ትምህርት ቤት',
  'portal.academicYear': 'የትምህርት ዘመን',
  'portal.grade': 'የክፍል ደረጃ',
  'portal.class': 'ክፍል',
  'portal.relationship': 'ዝምድና',
  'portal.publishedResults': 'የታተሙ ውጤቶች',
  'workflow.navigation': 'የትምህርት ቤት ሂደት አሰሳ',
  'workflow.registration': 'የተማሪ ምዝገባ',
  'workflow.attendance': 'የመገኘት ምዝገባ',
  'workflow.coursework': 'የክፍል ሥራ አስተዳደር',
  'workflow.gradebook': 'የውጤት መዝገብ',
  'workflow.documents': 'የትምህርት ቤት ሰነዶች',
  'workflow.timetable': 'የጊዜ ሰሌዳ',
  'workflow.assessments': 'የፈተና አስተዳደር',
  'workflow.dataQuality': 'የውሂብ ጥራት',
  'workflow.reporting': 'ክልላዊ ሪፖርት',
  'status.pending': 'በመጠባበቅ ላይ',
  'status.approved': 'ጸድቋል',
  'status.draft': 'ረቂቅ',
  'status.published': 'ታትሟል',
  'status.finalized': 'ተጠናቋል',
  'status.absent': 'አልተገኘም',
  'status.present': 'ተገኝቷል',
  'settings.localization': 'ቋንቋ እና የቀን መቁጠሪያ',
  'settings.language': 'ቋንቋ',
  'settings.calendar': 'የቀን መቁጠሪያ',
  'settings.gregorian': 'ጎርጎርዮሳዊ',
  'settings.ethiopian': 'ኢትዮጵያዊ',
}

const oromoCatalog: Partial<Record<TranslationKey, string>> = {
  'common.cancel': 'Dhiisi',
  'common.continue': 'Itti fufi',
  'common.save': 'Olkaa’i',
  'common.loading': 'Fe’amaa jira',
  'common.greeting': 'Akkam, {name}',
  'locale.english': 'Afaan Ingilizii',
  'locale.amharic': 'Afaan Amaaraa',
  'locale.oromo': 'Afaan Oromoo',
  'navigation.label': 'Qajeelcha appii',
  'navigation.skip': 'Gara qabiyyee ijoo darbi',
  'navigation.signIn': 'Seeni',
  'navigation.signOut': 'Ba’i',
  'navigation.account': 'Herrega',
  'navigation.security': 'Nageenya',
  'navigation.notifications': 'Beeksisawwan',
  'navigation.search': 'Barbaadi',
  'navigation.students': 'Barattoota',
  'navigation.academics': 'Barnoota',
  'navigation.documents': 'Sanadoota',
  'navigation.reporting': 'Gabaasa',
  'navigation.operations': 'Hojiiwwan',
  'navigation.support': 'Deeggarsa',
  'navigation.settings': 'Qindaa’ina',
  'auth.email': 'Imeelii',
  'auth.password': 'Jecha iccitii',
  'auth.signingIn': 'Seenaa jira',
  'auth.changePassword': 'Jecha iccitii jijjiiri',
  'auth.changePasswordHeading': 'Jecha iccitii kee jijjiiri',
  'auth.changePasswordPrompt': 'Itti fufuuf jecha iccitii haaraa filadhu.',
  'auth.currentPassword': 'Jecha iccitii ammaa',
  'auth.newPassword': 'Jecha iccitii haaraa',
  'auth.confirmPassword': 'Jecha iccitii haaraa mirkaneessi',
  'auth.changingPassword': 'Jecha iccitii jijjiiraa jira',
  'auth.passwordValidation':
    'Qubee 12 yoo xiqqaate fayyadami; jecha iccitii haaraa mirkaneessi.',
  'auth.currentPasswordIncorrect': 'Jechi iccitii ammaa sirrii miti.',
  'auth.passwordChangeFailed':
    'Jecha iccitii jijjiiruun hin danda’amne. Irra deebi’ii yaali.',
  'auth.accountRecovery': 'Herrega deebisanii argachuu',
  'auth.recoveryEmail': 'Imeelii deebisanii argachuu',
  'auth.requestRecovery': 'Deebisanii argachuu gaafadhu',
  'auth.recoveryToken': 'Mallattoo deebisanii argachuu',
  'auth.recoveryPassword': 'Jecha iccitii deebisanii argachuu haaraa',
  'auth.resetPassword': 'Jecha iccitii haaromsi',
  'auth.recoveryNeutral':
    'Herregichi yoo jiraate, qajeelfamni deebisanii argachuu ni ergama.',
  'auth.recoveryRequestFailed':
    'Gaaffii deebisanii argachuu galmeessuun hin danda’amne',
  'auth.recoveryReset':
    'Jechi iccitii haaromfame. Jecha iccitii haaraan seeni.',
  'auth.recoveryTokenInvalid':
    'Mallattoon deebisanii argachuu sirrii miti ykn yeroon isaa darbeera',
  'auth.accountSecurity': 'Nageenya herregaa',
  'auth.activeSessions': 'Yeroo hojii irra jiran',
  'auth.created': 'Uumame',
  'auth.expires': 'Kan xumuramu',
  'auth.currentSession': 'Yeroo ammaa',
  'auth.revokeSession': 'Yeroo hojii dhaabi',
  'auth.revokeOthers': 'Yeroo hojii kan biroo hunda dhaabi',
  'auth.passwordChanged': 'Jechi iccitii jijjiirame',
  'auth.sessionsLoadFailed': 'Yeroo hojii fe’uun hin danda’amne',
  'auth.sessionRevokeFailed': 'Yeroo hojii dhaabuun hin danda’amne',
  'portal.student': 'Karra barataa',
  'portal.parent': 'Karra maatii',
  'portal.sections': 'Kutaa karraa',
  'portal.overview': 'Ilaalcha waliigalaa',
  'portal.results': 'Bu’aawwan',
  'portal.materials': 'Meeshaalee barnootaa',
  'portal.announcements': 'Beeksisawwan',
  'portal.documents': 'Sanadoota',
  'portal.attendance': 'Argama',
  'portal.coursework': 'Hojii barnootaa',
  'portal.events': 'Sagantaalee',
  'portal.meetings': 'Walga’iiwwan',
  'portal.messages': 'Ergaawwan',
  'portal.child': 'Mucaa',
  'portal.school': 'Mana barumsaa',
  'portal.academicYear': 'Bara barnootaa',
  'portal.grade': 'Kutaa',
  'portal.class': 'Daree',
  'portal.relationship': 'Hariiroo',
  'portal.publishedResults': 'Bu’aawwan maxxanfaman',
  'workflow.navigation': 'Qajeelcha hojii mana barumsaa',
  'workflow.registration': 'Galmee barataa',
  'workflow.attendance': 'Galmee argamaa',
  'workflow.coursework': 'Bulchiinsa hojii barnootaa',
  'workflow.gradebook': 'Galmee qabxii',
  'workflow.documents': 'Sanadoota mana barumsaa',
  'workflow.timetable': 'Sagantaa yeroo',
  'workflow.assessments': 'Bulchiinsa madaallii',
  'workflow.dataQuality': 'Qulqullina deetaa',
  'workflow.reporting': 'Gabaasa naannoo',
  'status.pending': 'Eeggachaa jira',
  'status.approved': 'Mirkanaa’eera',
  'status.draft': 'Wixinee',
  'status.published': 'Maxxanfameera',
  'status.finalized': 'Xumurameera',
  'status.absent': 'Hin argamne',
  'status.present': 'Argameera',
  'settings.localization': 'Afaanii fi lakkoofsa baraa',
  'settings.language': 'Afaan',
  'settings.calendar': 'Lakkoofsa baraa',
  'settings.gregorian': 'Giriigooriyaanii',
  'settings.ethiopian': 'Itoophiyaa',
}

export const translationCatalogs: Readonly<
  Record<SupportedLocale, TranslationCatalog>
> = {
  en: englishCatalog,
  am: amharicCatalog,
  om: oromoCatalog,
}

export function selectLocale(
  locale: string | null | undefined,
): SupportedLocale {
  if (!locale) return defaultLocale

  const normalized = locale.trim().toLowerCase().replace('_', '-').split('-')[0]
  return (
    supportedLocales.find((candidate) => candidate === normalized) ??
    defaultLocale
  )
}

function interpolate(template: string, values: TranslationValues): string {
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9_]*)\}/g,
    (placeholder, name: string) => {
      const value = values[name]
      return value === undefined ? placeholder : String(value)
    },
  )
}

export interface TranslatorOptions {
  locale?: string | null
  mode?: 'development' | 'test' | 'production'
  catalogs?: Partial<Record<SupportedLocale, TranslationCatalog>>
}

export function createTranslator(options: TranslatorOptions = {}) {
  const locale = selectLocale(options.locale)
  const catalogs = options.catalogs ?? translationCatalogs

  return (key: TranslationKey, values: TranslationValues = {}): string => {
    const localized = catalogs[locale]?.[key]
    const fallback = catalogs.en?.[key]
    const template = localized ?? fallback

    if (!template) {
      return options.mode === 'production'
        ? key
        : `[[missing:${locale}:${key}]]`
    }

    return interpolate(template, values)
  }
}

export function translate(
  locale: string | null | undefined,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  return createTranslator({ locale: locale ?? null })(key, values)
}
