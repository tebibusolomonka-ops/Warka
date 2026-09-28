import { useEffect, useState } from 'react'
import {
  getCommunicationPreferences,
  putCommunicationPreference,
  type CommunicationPreference,
} from './communicationPreferencesApi'

const labels: Record<CommunicationPreference['category'], string> = {
  accountSecurity: 'Account security',
  academicResults: 'Academic results',
  schoolAnnouncements: 'School announcements',
  learningMaterials: 'Learning materials',
  documents: 'Documents',
  familyCommunication: 'Family communication',
  support: 'Support',
  privacy: 'Privacy',
}

const digestCategories = new Set<CommunicationPreference['category']>([
  'academicResults',
  'schoolAnnouncements',
  'learningMaterials',
])

export function CommunicationPreferencesWorkspace({
  baseUrl,
}: {
  baseUrl: string
}) {
  const [preferences, setPreferences] = useState<CommunicationPreference[]>([])
  const [busy, setBusy] = useState<CommunicationPreference['category'] | null>(
    null,
  )
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getCommunicationPreferences(baseUrl)
      .then((values) => {
        if (active) setPreferences(values)
      })
      .catch(() => {
        if (active) setError('Could not load communication preferences.')
      })
    return () => {
      active = false
    }
  }, [baseUrl])

  async function update(value: CommunicationPreference) {
    const previous = preferences
    setPreferences((current) =>
      current.map((item) => (item.category === value.category ? value : item)),
    )
    setBusy(value.category)
    setError('')
    try {
      setPreferences(await putCommunicationPreference(baseUrl, value))
    } catch {
      setPreferences(previous)
      setError('Could not save communication preferences.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      id="communication-preferences"
      aria-label="Communication preferences"
    >
      <h2>Communication preferences</h2>
      <p>
        Account security notices always appear in Warka. Email is optional.
        Digests collect eligible non-urgent updates.
      </p>
      {error && <p role="alert">{error}</p>}
      <table>
        <thead>
          <tr>
            <th scope="col">Updates</th>
            <th scope="col">In-app</th>
            <th scope="col">Email</th>
            <th scope="col">Digest</th>
          </tr>
        </thead>
        <tbody>
          {preferences.map((item) => {
            const label = labels[item.category]
            return (
              <tr key={item.category}>
                <th scope="row">{label}</th>
                <td>
                  {item.category === 'accountSecurity' ? (
                    'Always on'
                  ) : (
                    <input
                      type="checkbox"
                      aria-label={`${label} in-app`}
                      checked={item.inAppEnabled}
                      disabled={busy === item.category}
                      onChange={(event) =>
                        void update({
                          ...item,
                          inAppEnabled: event.target.checked,
                        })
                      }
                    />
                  )}
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${label} email`}
                    checked={item.emailEnabled}
                    disabled={busy === item.category}
                    onChange={(event) =>
                      void update({
                        ...item,
                        emailEnabled: event.target.checked,
                        digestCadence: event.target.checked
                          ? item.digestCadence
                          : 'off',
                      })
                    }
                  />
                </td>
                <td>
                  {digestCategories.has(item.category) ? (
                    <select
                      aria-label={`${label} digest`}
                      value={item.digestCadence}
                      disabled={!item.emailEnabled || busy === item.category}
                      onChange={(event) =>
                        void update({
                          ...item,
                          digestCadence: event.target.value as
                            'off' | 'daily' | 'weekly',
                        })
                      }
                    >
                      <option value="off">Off</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  ) : (
                    'Not available'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
