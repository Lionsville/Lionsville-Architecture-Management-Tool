// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the canvas can do to a selection and only it can work out, because the
 * sums read the boxes it measured: align, distribute and group. The panel beside
 * it offers the same acts, so the canvas sits here while it is mounted; a view that
 * draws no canvas leaves the seat empty, and the panel offers nothing of the kind.
 */
import { createContext, useContext, useEffect } from 'react';
import type { AlignAxis, DistributeAxis } from '../../layout/alignDistribute';

export type ArrangeActs = {
  align(axis: AlignAxis): void;
  distribute(axis: DistributeAxis): void;
  group(): void;
};

export type ArrangeSeat = { current: ArrangeActs | null };

const SeatContext = createContext<ArrangeSeat | undefined>(undefined);
export const ArrangeSeatProvider = SeatContext.Provider;
export const useArrangeSeat = () => useContext(SeatContext);

/** The canvas takes the seat for as long as it is drawn, with today's acts. */
export function useTakeArrangeSeat(acts: ArrangeActs): void {
  const seat = useArrangeSeat();
  useEffect(() => {
    if (!seat) return undefined;
    seat.current = acts;
    return () => { seat.current = null; };
  }, [seat, acts]);
}
