import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'

export default function DeleteAccountPage() {
  return (
    <section className="page page--discovery delete-account-page">
      <PageHero
        eyebrow="Account and privacy"
        title="Delete Your Japan47 Account"
        subtitle="Japan47 provides a permanent account-deletion process from your profile settings. Review what will be removed and what the platform retains before continuing."
      />

      <div className="delete-account-layout">
        <article className="delete-account-panel">
          <section>
            <p className="eyebrow">Account settings</p>
            <h2>How to delete your account</h2>
            <ol className="delete-account-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Sign in</strong>
                  <p>Sign in to the Japan47 account you want to delete.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Open Profile</strong>
                  <p>
                    Open your Profile, choose Edit profile, and find the Delete account section.
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Press Delete account</strong>
                  <p>
                    Continue through the confirmation steps, verify your current password, and enter
                    the required final confirmation.
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <strong>Confirm deletion</strong>
                  <p>Submit the final request to permanently delete the account.</p>
                </div>
              </li>
            </ol>
            <p className="delete-account-permanent">
              <strong>Account deletion is permanent and cannot be undone.</strong>
            </p>
          </section>

          <section>
            <p className="eyebrow">Data and contributions</p>
            <h2>What happens after deletion</h2>
            <div className="delete-account-outcomes">
              <div>
                <h3>Deleted</h3>
                <p>
                  Your account, username, email address, profile, personal profile image, password,
                  verification data, and legal-consent record are deleted. User-specific
                  records—including your reviews and ratings, favourites, saved and visited places,
                  follows, collections, itineraries, helpful votes, and related travel progress—are
                  also deleted where they exist.
                </p>
              </div>
              <div>
                <h3>Retained and anonymized</h3>
                <p>
                  Places you submitted remain available, along with their main and gallery photos.
                  Direct ownership is removed, the places become platform-managed, and their
                  displayed author becomes “Japan47 Community.”
                </p>
              </div>
            </div>
            <p>
              Necessary support, security, moderation, legal, or audit records may be retained where
              justified. Direct links to the deleted account are removed where possible, and
              retained support records are anonymized, including removal of contact details and
              support screenshots.
            </p>
          </section>

          <section>
            <p className="eyebrow">Content controls</p>
            <h2>Editing places and reviews</h2>
            <p>
              While your account is active, you can edit or request deletion of places you created,
              and edit or delete reviews you created. You cannot edit or delete places or reviews
              created by another user. After account deletion, you no longer have access to edit or
              delete retained places through the deleted account.
            </p>
          </section>
        </article>

        <aside className="delete-account-help">
          <p className="eyebrow">Support</p>
          <h2>Need help?</h2>
          <p>
            If you cannot access the account you want to delete, create or sign in to a new Japan47
            account and send your request through the existing Contact Us form. Do not include your
            password.
          </p>
          <Link className="button button--primary" to="/contact">
            Contact Us
          </Link>
          <small>
            Requests are reviewed so Japan47 can verify the account and protect user data.
          </small>
        </aside>
      </div>
    </section>
  )
}
