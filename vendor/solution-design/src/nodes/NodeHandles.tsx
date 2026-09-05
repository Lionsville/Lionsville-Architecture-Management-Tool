import { Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';

/**
 * Four connection points — one per side — each backed by an overlapping
 * source + target handle so a link can be drawn from OR to any side. The
 * source handle renders last (on top) so a drag always *starts* a
 * source→target link.
 *
 * EVERY handle must carry a unique id (POC lesson): React Flow resolves an
 * edge's missing (null) sourceHandle/targetHandle to the *first* handle of
 * that type in DOM order — not to a per-side default — so id-less handles
 * silently pull links to whichever side renders first.
 */
const SIDES = [
  { pos: Position.Top, source: 'top-s', target: 'top-t' },
  { pos: Position.Right, source: 'right-s', target: 'right-t' },
  { pos: Position.Bottom, source: 'bottom-s', target: 'bottom-t' },
  { pos: Position.Left, source: 'left-s', target: 'left-t' },
] as const;

export function NodeHandles({ connectable }: { connectable: boolean }) {
  const tokens = getNodeTokens(useTheme());
  const style: React.CSSProperties = {
    width: 9,
    height: 9,
    background: tokens.handle.bg,
    border: `2px solid ${tokens.handle.border}`,
    opacity: connectable ? 0.55 : 0,
  };
  return (
    <>
      {SIDES.map(({ pos, source, target }) => (
        <Fragment key={pos}>
          <Handle type="target" position={pos} id={target} style={style} isConnectable={connectable} />
          <Handle type="source" position={pos} id={source} style={style} isConnectable={connectable} />
        </Fragment>
      ))}
    </>
  );
}
