// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { createContext } from 'react';

/** What a container diagram's boundary can ask of its canvas, without every node being handed it. */
export const ContainerBoardContext = createContext<{ onAddContainer?: () => void }>({});
