import {
  catalogEntries,
  translationCatalogs,
  validateTranslationCatalogs,
} from '../packages/shared/dist/index.js'

const errors = validateTranslationCatalogs(catalogEntries(translationCatalogs))
if (errors.length) {
  console.error('Translation catalog validation failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Translation catalogs are valid for en, am, and om.')
}
