// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: the app's boot.
 *
 * The one entry that is an import for what it does. The boot has no name to
 * offer: a build composed from this one registers its own source and its own
 * words, and then imports this, which opens whatever the address names through
 * the registry and draws the app over it (ADR-0022, amended). The order of
 * those imports is the wiring, so this entry holds nothing else.
 */
import '../../app/main'
