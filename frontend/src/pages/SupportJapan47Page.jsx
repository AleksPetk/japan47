import PageHero from '../components/PageHero'

const KOFI_URL = 'https://ko-fi.com/japan47'

export default function SupportJapan47Page() {
  return (
    <section className="page page--discovery support-japan47-page">
      <PageHero
        eyebrow="A free community project"
        title="Support Japan47"
        subtitle="Japan47 is built as a free place to discover and share destinations across every prefecture. Supporting the project is always completely optional."
      />

      <div className="support-project-layout">
        <article className="support-project-panel">
          <p className="eyebrow">Keeping Japan47 online</p>
          <h2>What support helps cover</h2>
          <p>
            Optional contributions help with the practical costs of running and improving an
            independent community project.
          </p>
          <ul className="support-costs">
            <li>
              <strong>Hosting and servers</strong>
              <span>Keeping the website and API reliable and available.</span>
            </li>
            <li>
              <strong>Domain and infrastructure</strong>
              <span>Essential services that keep Japan47 connected and secure.</span>
            </li>
            <li>
              <strong>Maintenance and development</strong>
              <span>Fixes, updates, accessibility work, and ongoing improvements.</span>
            </li>
            <li>
              <strong>Image storage</strong>
              <span>Safely storing and serving community destination photography.</span>
            </li>
            <li>
              <strong>Future web and mobile features</strong>
              <span>Thoughtful additions to help people explore Japan more easily.</span>
            </li>
          </ul>
        </article>

        <aside className="support-project-cta">
          <p className="eyebrow">Entirely optional</p>
          <h2>Japan47 stays free for everyone.</h2>
          <p>
            Supporting does not unlock premium content, rewards, special access, or extra features.
            Everyone receives the same Japan47 experience.
          </p>
          <a
            className="button button--primary"
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Support on Ko-fi
          </a>
          <small>Ko-fi opens securely in a new tab.</small>
        </aside>
      </div>
    </section>
  )
}
