/**
 * An agent is driving the app (ADR-0019).
 *
 * A strip along the bottom, like the sync and storage notices: it says who
 * is moving the app and what they said they were doing, warns that a click
 * in the middle of it changes what the agent sees, and carries the one
 * button a person has over it. Stop ends the session; the agent is told on
 * its next call, and the strip goes.
 *
 * Along the bottom rather than above the toolbar for the reason the other
 * notices are: on the desktop that bar is the title bar, and anything pushed
 * above it lands under the traffic lights.
 */
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import type { DrivingState } from '../agent/driving'
import type { Translate } from '../i18n'
import { AgentIcon } from '../widgets/icons'

export type AgentDrivingBannerProps = {
  driving: DrivingState
  onStop: () => void
  s: Translate
}

export function AgentDrivingBanner({ driving, onStop, s }: AgentDrivingBannerProps) {
  const session = driving.session
  if (!session) return null
  const name = session.client ?? s('agent.someone')
  const said = session.purpose
    ? s('agent.drivingFor', { name, purpose: session.purpose })
    : s('agent.driving', { name })
  return (
    <Alert
      severity="info"
      square
      icon={<AgentIcon filled />}
      sx={{ py: 0.25, fontSize: 13, borderRadius: 0, flex: '0 0 auto', alignItems: 'center' }}
      data-testid="agent-driving"
      action={(
        <Button size="small" color="inherit" variant="outlined" onClick={onStop} data-testid="agent-stop">
          {s('agent.stop')}
        </Button>
      )}
    >
      <strong>{said}</strong> {s('agent.drivingHint')}
    </Alert>
  )
}
