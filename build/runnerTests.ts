// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The test files that run on a developer's machine and not on GitHub's runner
 * (25 October 2026: the runner's check brief, about five minutes, and the
 * whole set run before a push on a fast machine).
 *
 * `npm run check` runs every test, with coverage, here. `npm run
 * check:runner` — what `.github/workflows/check.yml` runs, in two shards —
 * runs the rest without coverage: these files each took 2 s or more on the runner (the
 * check of 25 October 2026, run 40224330980, with coverage on), or would by
 * four times their time on a fast laptop. They are the app's journeys over
 * the whole shell, the canvas's and the pages' integration suites, and the
 * builds' own scans — none of them less of a test for running here.
 *
 * A file that grows past the line is added; one that becomes quick is taken
 * off. `build/runnerTests.test.ts` holds every entry to a file that is
 * there, once, in order.
 */
export const LOCAL_ONLY: readonly string[] = [
  'build/cycles.test.ts', // 9 s
  'build/promises.test.ts', // 44 s
  'build/smokeRun.test.ts', // 7 s
  'build/storageLine.test.ts', // 21 s
  'build/unitSize.test.ts', // 10 s
  'electron/main/fileStore.test.ts', // 3 s
  'electron/main/watch.test.ts', // 7 s
  'src/adapters/folder/desktop/IpcDirectoryHandle.test.ts', // 20 s
  'src/adapters/folder/desktop/desktopRepositories.test.ts', // 200 s
  'src/adapters/folder/folderRepositories.test.ts', // 4 s
  'src/adapters/repositories/entryStates.test.ts', // 48 s
  'src/adapters/webStorage/browserRepositories.test.ts', // 10 s
  'src/agent/pure.test.ts', // 5 s
  'src/app/ActivityMenu.test.tsx', // 3 s
  'src/app/App.accessibility.test.tsx', // 145 s
  'src/app/App.agent.test.tsx', // 3 s
  'src/app/App.channel.test.tsx', // 7 s
  'src/app/App.chart.test.tsx', // 4 s
  'src/app/App.chartPick.test.tsx', // 13 s
  'src/app/App.checks.test.tsx', // 13 s
  'src/app/App.commands.test.tsx', // 15 s
  'src/app/App.controlNames.test.tsx', // 145 s
  'src/app/App.decisions.test.tsx', // 4 s
  'src/app/App.destination.test.tsx', // 45 s
  'src/app/App.documentLink.test.tsx', // 12 s
  'src/app/App.driving.test.tsx', // 16 s
  'src/app/App.failures.test.tsx', // 4 s
  'src/app/App.firstRun.test.tsx', // 3 s
  'src/app/App.folderExample.test.tsx', // 3 s
  'src/app/App.history.test.tsx', // 29 s
  'src/app/App.index.test.tsx', // 5 s
  'src/app/App.keyboard.test.tsx', // 15 s
  'src/app/App.landing.test.tsx', // 3 s
  'src/app/App.liveViews.test.tsx', // 7 s
  'src/app/App.menuAfterDialog.test.tsx', // 3 s
  'src/app/App.pageRules.test.tsx', // 4 s
  'src/app/App.people.test.tsx', // 15 s
  'src/app/App.pictures.test.tsx', // 19 s
  'src/app/App.preferences.test.tsx', // 4 s
  'src/app/App.projectSettings.test.tsx', // 9 s
  'src/app/App.readOnly.test.tsx', // 23 s
  'src/app/App.recordParty.test.tsx', // 11 s
  'src/app/App.scopeTree.test.tsx', // 43 s
  'src/app/App.share.test.tsx', // 9 s
  'src/app/App.shareSelect.test.tsx', // 3 s
  'src/app/App.storage.test.tsx', // 33 s
  'src/app/App.undo.test.tsx', // 2 s
  'src/app/App.unitDelete.test.tsx', // 17 s
  'src/app/App.unitFirst.test.tsx', // 12 s
  'src/app/App.workingFileCheck.test.tsx', // 10 s
  'src/app/App.workingFileDrawless.test.tsx', // 4 s
  'src/app/App.workingFilePictures.test.tsx', // 4 s
  'src/app/BackForward.test.tsx', // 5 s
  'src/app/DrawingEditor.test.tsx', // 2 s
  'src/app/ShellToolbar.test.tsx', // 3 s
  'src/app/WorkspacePages.firstOpen.test.tsx', // 9 s
  'src/app/WorkspacePages.test.tsx', // 24 s
  'src/app/dialogs/ConnectAgentDialog.test.tsx', // 2 s
  'src/app/dialogs/PasswordDialog.test.tsx', // 2 s
  'src/app/history/history.test.tsx', // 22 s
  'src/app/history/putBack.test.tsx', // 4 s
  'src/app/observationForm.test.tsx', // 7 s
  'src/app/organisation/BoardsTable.test.tsx', // 2 s
  'src/app/organisation/ChecksPage.test.tsx', // 6 s
  'src/app/organisation/HomeSearch.test.tsx', // 4 s
  'src/app/organisation/OrganisationScreen.test.tsx', // 41 s
  'src/app/organisation/OrganisationScreen.topics.test.tsx', // 14 s
  'src/app/organisation/OrganisationScreen.tree.test.tsx', // 41 s
  'src/app/organisation/ScopeSettingsDialog.test.tsx', // 8 s
  'src/app/organisation/ServedBy.test.tsx', // 20 s
  'src/app/organisation/Topics.test.tsx', // 7 s
  'src/app/personReaders.test.tsx', // 6 s
  'src/app/principles/Citations.test.tsx', // 3 s
  'src/app/principles/PrinciplesPage.test.tsx', // 12 s
  'src/app/questionDialogs.test.tsx', // 7 s
  'src/app/units/AssignmentInspector.test.tsx', // 5 s
  'src/app/units/ChartFolding.test.tsx', // 17 s
  'src/app/units/ChartMove.test.tsx', // 7 s
  'src/app/units/ChartNewUnit.test.tsx', // 7 s
  'src/app/units/ChartOrder.test.tsx', // 4 s
  'src/app/units/ChartPage.test.tsx', // 16 s
  'src/app/units/ChartReading.test.tsx', // 4 s
  'src/app/units/ConwayPage.test.tsx', // 7 s
  'src/app/units/EndedHolders.test.tsx', // 2 s
  'src/app/units/PlanOrganisation.test.tsx', // 7 s
  'src/app/units/UnitSection.test.tsx', // 20 s
  'src/app/useAgentGateway.test.tsx', // 5 s
  'src/app/useProjectFiles.test.tsx', // 7 s
  'src/app/useSheet.test.tsx', // 4 s
  'src/blocks/ui/Blocks.test.tsx', // 9 s
  'src/business/ui/FunctionInspector.test.tsx', // 22 s
  'src/business/ui/LaneDialog.test.tsx', // 3 s
  'src/business/ui/MapPage.test.tsx', // 4 s
  'src/business/ui/SheetPage.test.tsx', // 22 s
  'src/business/ui/SheetRail.test.tsx', // 4 s
  'src/business/ui/SheetSettingsDialog.test.tsx', // 5 s
  'src/comments/ui/CommentThread.test.tsx', // 3 s
  'src/decisions/ui/AdrPage.test.tsx', // 16 s
  'src/documentation/ui/DocumentationPage.test.tsx', // 12 s
  'src/documentation/ui/MarkdownView.test.tsx', // 2 s
  'src/documentation/ui/References.test.tsx', // 2 s
  'src/editor/ConnectionInspector.test.tsx', // 10 s
  'src/editor/DiagramSettingsDialog.test.tsx', // 13 s
  'src/editor/EditorToolbar.busy.test.tsx', // 2 s
  'src/editor/EditorToolbar.sheets.test.tsx', // 2 s
  'src/editor/EditorToolbar.tidySettings.test.tsx', // 2 s
  'src/editor/ElementInspector.test.tsx', // 34 s
  'src/editor/MultiSelectionInspector.test.tsx', // 2 s
  'src/editor/SolutionDesignEditor.asOf.test.tsx', // 8 s
  'src/editor/SolutionDesignEditor.deployment.test.tsx', // 4 s
  'src/editor/SolutionDesignEditor.handle.test.tsx', // 3 s
  'src/editor/SolutionDesignEditor.keyboard.test.tsx', // 15 s
  'src/editor/SolutionDesignEditor.laidOut.test.tsx', // 5 s
  'src/editor/SolutionDesignEditor.landing.test.tsx', // 3 s
  'src/editor/SolutionDesignEditor.language.test.tsx', // 11 s
  'src/editor/SolutionDesignEditor.layoutErrors.test.tsx', // 18 s
  'src/editor/SolutionDesignEditor.overlay.test.tsx', // 8 s
  'src/editor/SolutionDesignEditor.preferences.test.tsx', // 5 s
  'src/editor/SolutionDesignEditor.readingLayout.test.tsx', // 9 s
  'src/editor/SolutionDesignEditor.safeDelete.test.tsx', // 16 s
  'src/editor/SolutionDesignEditor.searchPanels.test.tsx', // 18 s
  'src/editor/SolutionDesignEditor.test.tsx', // 54 s
  'src/editor/canvas/ContextMenu.test.tsx', // 2 s
  'src/editor/canvas/DiagramCanvas.contextMenu.test.tsx', // 34 s
  'src/editor/canvas/ElementPalette.test.tsx', // 13 s
  'src/editor/canvas/Layer7Canvas.groupMenu.test.tsx', // 6 s
  'src/editor/canvas/virtualisation.test.tsx', // 24 s
  'src/editor/edges/FloatingEdge.drag.test.tsx', // 9 s
  'src/editor/edges/FloatingEdge.sides.test.tsx', // 4 s
  'src/editor/export/ExportDialog.test.tsx', // 3 s
  'src/editor/nodes/LogoGrid.test.tsx', // 3 s
  'src/editor/nodes/logoRendering.test.tsx', // 2 s
  'src/editor/textEdits.test.tsx', // 17 s
  'src/editor/useReadingLayout.test.ts', // 3 s
  'src/layout/tidy.test.ts', // 3 s
  'src/model/commands/inverse.property.test.ts', // 2 s
  'src/observations/ui/FormDialog.test.tsx', // 4 s
  'src/observations/ui/MergePage.test.tsx', // 11 s
  'src/observations/ui/MovePage.test.tsx', // 4 s
  'src/observations/ui/ObservationForm.test.tsx', // 39 s
  'src/observations/ui/ObservationsPage.test.tsx', // 61 s
  'src/observations/ui/PictureFilters.test.tsx', // 25 s
  'src/observations/ui/Readers.test.tsx', // 17 s
  'src/observations/ui/SolutionsTab.test.tsx', // 26 s
  'src/operating/ui/LibraryDialog.test.tsx', // 23 s
  'src/operating/ui/OperatingModelPage.test.tsx', // 49 s
  'src/operating/ui/UnitsAndRoles.test.tsx', // 15 s
  'src/people/ui/PeoplePage.test.tsx', // 28 s
  'src/platform/node/git.test.ts', // 71 s
  'src/platform/node/gitEntries.test.ts', // 49 s
  'src/platform/node/gitPrograms.test.ts', // 116 s
  'src/platform/node/workingFile.test.ts', // 3 s
  'src/providers/builtIns.test.ts', // 7 s
  'src/providers/folder/FolderAdoption.test.tsx', // 3 s
  'src/roadmap/ui/PlanPage.test.tsx', // 41 s
  'src/roadmap/ui/ReplaceDialog.test.tsx', // 3 s
  'src/roadmap/ui/RoadmapPage.test.tsx', // 14 s
  'src/search/ui/GlobalSearchDialog.test.tsx', // 3 s
  'src/technology/ui/PlatformReportPage.test.tsx', // 2 s
  'src/technology/ui/TechnologyLandscapePage.test.tsx', // 7 s
  'src/widgets/FindingMarks.test.tsx', // 3 s
  'src/widgets/FindingsList.test.tsx', // 3 s
  'src/widgets/PickToAdd.test.tsx', // 2 s
  'src/widgets/lazyPart.test.tsx', // 8 s
]
