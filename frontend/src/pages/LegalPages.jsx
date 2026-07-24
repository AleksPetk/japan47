import privacySource from '../content/privacy_policy.html?raw'
import termsSource from '../content/terms_of_use.html?raw'

function reactLegalMarkup(source) {
  return source
    .replace('class="legal-page"', 'class="legal page"')
    .replaceAll('legal-page__back', 'back')
    .replaceAll('legal-page__eyebrow', 'eyebrow')
    .replaceAll('legal-page__header', 'legal-header')
    .replaceAll('legal-page__updated', 'legal-updated')
    .replaceAll('legal-page__notice', 'legal-notice')
    .replaceAll('legal-page__content', 'prose')
}

function LegalPage({ source }) {
  // This trusted HTML is bundled from the project's reviewed, static legal source.
  return <div dangerouslySetInnerHTML={{ __html: reactLegalMarkup(source) }} />
}

export const PrivacyPage = () => <LegalPage source={privacySource} />
export const TermsPage = () => <LegalPage source={termsSource} />
