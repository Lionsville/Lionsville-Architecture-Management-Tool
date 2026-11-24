// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The vocabulary's rules, read on demand (ADR-0007, amended 22 November
 * 2026): what a tool's description used to carry beyond what the tool does
 * and what it takes, and what every tool shares — `scope`, `ifRevision`, a
 * person, a page — said once.
 *
 * A client is handed every tool's description on every turn, so a rule
 * written into one is paid for whether or not the model ever calls that
 * tool. Here a rule is paid for when it is asked: `rules.read` with `about`
 * a topic below or a tool's name answers it, and a description that has
 * more here ends `(rules.read)`. The text is the vocabulary's own, English
 * and outside `i18n` for the reason `tools.ts` gives.
 *
 * One table, keyed by topic and by tool, so whatever else serves the
 * vocabulary's rules — a description, a code mode's own description of its
 * calls — reads the same words from the same place.
 */
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'

/** What every tool shares, and the ways of working said apart from any one tool. */
export const RULE_TOPICS = ['scope', 'ifRevision', 'person', 'paging', 'batch', 'sheet'] as const
export type RuleTopic = (typeof RULE_TOPICS)[number]

/** One rule: a line saying what it is about, and the whole of it. */
export type Rule = { readonly about: string; readonly text: string }

const TOPICS: Record<RuleTopic, Rule> = {
  scope: {
    about: 'The scope a tool answers for, which every tool but a few takes.',
    text: 'scope is which scope to answer for, as its path: "" is the organisation, "acme/retail" a scope filed under '
      + 'another — a domain, a team, a landscape scope (scopes.list says which there are). Left out, it is the scope open '
      + 'in the app, where one is. A read over another scope is answered from its document as it is kept; a change, a '
      + 'picture, undo and the session\'s own lists need that scope open where the host keeps a scope open, and are '
      + 'refused agent.scopeNotOpen otherwise. A tool about the whole tree, the people register, the tree of scopes or '
      + 'the app itself takes none, and checks.list, views.list, assignments.list and evaluation.read read their own '
      + 'scope as a filter or as the scope they are about.',
  },
  ifRevision: {
    about: 'The guard every change takes against a scope that moved on.',
    text: 'Every change answers with the scope\'s revision, a counter that moves with every step; project.current and '
      + 'activity.list say it too. Pass it back as ifRevision when a call must not land on a scope somebody has moved '
      + 'on since you read it: a call whose revision is not the current one is refused agent.stale and nothing lands — '
      + 'read again and decide again. A batch takes one for the whole batch, and a step\'s own is held to the revision '
      + 'the batch started from. A dry run of a batch answers the revision it was tried against, to pass to the batch '
      + 'that lands it. The people register and the tree of scopes are outside a scope\'s history and take none.',
  },
  person: {
    about: 'A field that names a person.',
    text: 'A field that names a person (an owner, who saw an observation, who proposed a decision, a signer) takes a '
      + 'person from the register as { "person": id }, the id from people.list — person.add checks the four signs of a '
      + 'duplicate first — or text: a name, initials, a team, where nobody in the register is meant. A picked person '
      + 'is answered by name, or by pseudonym where the organisation says so, and never by address.',
  },
  paging: {
    about: 'How a list read answers a page, and goes on.',
    text: 'Every list read answers a page: limit rows (each list has a default and a most), total and shown, and next '
      + 'while there are more — pass it back as cursor, with the same other arguments, for the next page. fields keeps '
      + 'only the fields named of each row, and its id. A cursor from another question is refused. Where the list '
      + 'changed between two pages, the next starts after the row the last one ended on and says moved: true — what was '
      + 'added or removed before that row is not in the pages you read, so ask again without cursor where you need '
      + 'the list whole; where that row is gone the call is refused agent.pageMoved.',
  },
  batch: {
    about: 'Several changes as one step: references, a dry run, the guard and the cap.',
    text: 'batch lands its steps as one undo step, all or nothing, each built on the model the steps before it left. '
      + 'Any argument value of a step may be { "$ref": "steps[n].field" } (deeper with .field and [i]): the value at '
      + 'that path in the answer of step n, an earlier step of the same batch, put in its place before the step is '
      + 'built — how a step names the id an earlier step minted. A reference to the step itself, a later one, one not '
      + 'there or a field not answered is refused agent.badReference. dryRun: true builds and checks every step and '
      + 'answers each step\'s answer and the changes they would make, in the landscape\'s own terms, landing nothing. '
      + 'At most 200 steps (agent.tooManySteps). A step addressed to another scope, a tool that draws, looks or asks '
      + 'the session, and the tree\'s and the register\'s tools are not batched.',
  },
  sheet: {
    about: 'A business sheet\'s functions and the tree, and placing a sheet\'s poster.',
    text: 'A function of a business sheet — an area, a grouping or a capability — is joined to the tree three ways, and they are told '
      + 'apart. Who answers for it is a unit: relation.add with type assigned from the unit to the function, in the scope that defines '
      + 'the function. Which domain it is handed to is the organisation\'s intent, top-down: element.update scopes on the definition, '
      + 'in the scope that defines it, naming scopes below that one. Which domain took it up is the domain\'s own statement, '
      + 'bottom-up: function.claim in the domain\'s scope, a stand-in of the function on its sheet, under which the domain files its '
      + 'own capabilities. element.describe of a function says its domains and claimedBy; a function nobody handed on and no domain '
      + 'took up is not yet mapped (checks.list). Handing on and taking up are two statements by two scopes: neither writes the other. '
      + 'A sheet\'s poster is placed with the same tools as a board and needs no screen, being arithmetic on fixed sizes: element.place, moveBy, '
      + 'placeNextTo, align and distribute move its blocks, an area or the journey by id and the stakeholder column as rail; a tile takes a cell; '
      + 'diagram.tidy is First layout; diagram.inspect says where everything is and what overlaps, and nothing fixes an overlap by itself. '
      + 'A tile moved to another area is element.update parentId, a fact on every view, while a place, a label and a free item (posterItem.add) are this view\'s only. '
      + 'A label shown on a tile (diagram.update labels) is a display choice: taking one off ends nobody\'s assignment.',
  },
}

/** A tool's rules: what its description said before it was cut to what the tool does and takes. */
const TOOL_RULES: Partial<Record<ToolName, string>> = {
  'checks.list':
    'What the tree contradicts about itself (ADR-0012 §9), as findings with a key: check.conflict (two scopes define '
    + 'one id at one depth), check.kindClash (a unit in one scope and something else in another share one id: '
    + 'neither may be reused as the other; the unit still serves and is read as a unit), check.drift (a stand-in\'s '
    + 'cached name disagrees with its master), check.dangling (a stand-in nobody defines), check.danglingEnd (a '
    + 'relation end nobody holds), check.proposal (a domain names a function no ancestor has), check.ownedElsewhere '
    + '(the owner\'s detail written on a stand-in), check.unattributed (outside, and nobody has said whose), '
    + 'check.unmapped and check.uncovered (the business layer\'s two), check.causeExplainsObservationBelow (a cause '
    + 'explains an observation of a scope below, which nothing makes any more: link the cause there that explains '
    + 'it, named in the detail, instead), check.drawingLinkMissing (a shape on a drawing points at an element this '
    + 'scope does not hold), and check.notDrawn (a master drawn on no view). The operating model\'s, at the '
    + 'organisation: check.accountability (a responsibility not exactly one role\'s A) and check.unitTypeNowhere (a '
    + 'unit type neither at the top nor in a unit type that sits anywhere, so no unit of it can be placed). The '
    + 'organisation\'s own (ADR-0036): check.roleVacant, check.roleOverMax, check.unitMisplaced, check.unitSpans, '
    + 'check.unitOverLimit, check.assignmentEnded, check.assignmentOrphaned (an assignment, running or over, in a '
    + 'unit that is not there: the person in person; a person removes it, from the Checks page — tell them), '
    + 'check.unitTypeEnded, check.personOverloaded and check.unitNotServing (an area, grouping or capability '
    + 'assigned to a unit that serves neither its domain nor sits under a unit that does; the unit in detail); '
    + 'check.servedScopeGone (a unit that serves a path no scope is at — a scope removed, or moved before 3.7.5 — '
    + 'the path in detail: put it right with element.update on the unit\'s scopes); and the reporting lines\' '
    + '(ADR-0039), about the unit a line runs from: check.reportingLoop (solid lines that come back to where they '
    + 'started, the chain in detail), check.reportingDangling, check.reportingAmbiguous and check.reportingVacant '
    + '(reportingLines.list says each line), read on a day — today, or the day given as on, with every plan\'s '
    + 'moves of that day. Beside its key each finding answers its weight — fix (the model contradicts itself), '
    + 'review (worth a look) or note (information, often intended) — its category (landscape, plans, organisation, '
    + 'teams, analysis), and why its check matters and how to fix it, in English, from the one catalogue of checks. '
    + 'A note — check.notDrawn, check.proposal — is listed only when the notes are asked for (notes), or when its '
    + 'key is. A finding is never a refusal and never a reason a save fails. A review or a note a person marked as '
    + 'intended is answered apart, under marked (its total, and each finding with mark: the day it was marked and '
    + 'the reason given), and is not among total and some. No tool marks a finding as intended or takes a mark '
    + 'back: that is a person\'s, so an agent cannot silence a check. The Checks page on a home (app.open page '
    + 'checks) lists these beside the dates\' findings of every scope (roadmap.check) and the Conway map\'s '
    + '(diagram.inspect), by check and category, in the same weights and words.',
  'diagram.inspect':
    'A layout report on a diagram, in geometry rather than pixels: the box around everything, on a landscape the '
    + 'rectangle of every band and of every domain group with its members, cards that overlap and by how much, '
    + 'lines that cut through a card, cards drawn in another band than they are filed in, group members outside '
    + 'their group, cards off the board, cards nothing connects to, and how full each band is. Lists are capped; '
    + 'totals are whole. Read this before and after moving anything, and read the band rectangles before choosing a '
    + 'coordinate. On a business architecture sheet it reports the page instead, with `poster` saying where each '
    + 'block is, whether anybody placed them, which overlap, the tiles in hand-placed cells, the blocks waiting '
    + 'under the page, and the names a tile\'s clamp would likely cut: the stakeholder rail (the parties, then the '
    + 'units the sheet uses, with a count of the units it leaves out), the journey with a row per lane, and every '
    + 'area with what covers each capability. On an enterprise map it reports the rows — every function in tree '
    + 'order with the applications supporting it, rolled up on the sections — and the columns. On a technology '
    + 'landscape it reports the three bands — the applications by the scope that answers for each, the services '
    + 'nested by parent, the platforms nested where the tree nests — and the lines between them, every one a row '
    + 'that exists. On an organisation chart (ADR-0036 §7) it reports the units as a tree on the view\'s day, each '
    + 'role with its holders by person id, their share, who is over 100% and the vacancies; on a Conway map, the '
    + 'units over their applications, every interface that crosses between units with whether an interaction covers '
    + 'it, the interactions that hold, and the findings, each with its key (check.interfaceUndeclared, '
    + 'check.interactionUnused, check.applicationUnowned, check.applicationOwnerNamed, check.unitOverLimit), weight '
    + 'and category as checks.list says them.',
  'app.open':
    'Move the app: open a scope, and in it a view or a page — what a person does with the tree, the tabs and the cards. '
    + '`scope` is a path from scopes.list (default: the open one); `page` is what to show there: home (the scope\'s '
    + 'own screen, nothing open), board / sheet / map / technology / drawing / chart / conway (a view, by id, or '
    + 'the only one of that kind), decisions (optionally on one record), observations (optionally on one record, '
    + 'and on one of its tabs with `tab`), roadmap, plan (by id), element (selected on a board that draws it), '
    + 'document or documentation (a record\'s page), platform or service (a report, by id), register, '
    + 'technologyRegister or people (the organisation-wide lists and the people register, on the home; people '
    + 'optionally on one person, their register id as id), operating (the operating model: unit types, roles, '
    + 'responsibilities and the libraries — kept at the organisation, so its scope is "" and may be left out; '
    + 'optionally on one unit type, role or responsibility), checks (every check by category over the scope\'s home '
    + '— what it finds there, why each matters and how to fix it, and what was marked as intended — optionally on '
    + 'one check, its key as id), principles (the scope\'s architecture principles, with those above it and of the '
    + 'topics relevant to it — optionally on one principle). `select` names an element to select on the board, '
    + 'sheet, map, technology landscape, organisation chart (a unit) or Conway map (a unit or an application) being '
    + 'opened; where that view does not draw it, nothing is selected. Opening never makes a view. With no page a '
    + 'scope opens on its canvas, or on its home when it draws nothing. Answers with app.current once the app has '
    + 'arrived. Starts a driving session, which the person sees as a banner and can stop. Refused agent.draftOpen '
    + 'while the person is writing something not yet saved that the move would drop. Arguments: id — The view, '
    + 'element, plan, decision, observation, cause, solution, experiment, unit type, role or responsibility the '
    + 'page is about, where it is about one; on checks, a check\'s key (check.roleVacant). tab — Which tab of the '
    + 'page, on a page with tabs. Observations: register (Seen), analysis (Why), solutions (Solve), results (Did it '
    + 'work); analysis and solutions also as analysis-list, analysis-map, solutions-list, solutions-map. People: '
    + 'people, review, privacy. Register: applications, services, platforms. A Conway map: grid, lines. Any other '
    + 'tab is refused and the answer lists the page\'s own.',
  'relation.add':
    'Join two elements with a typed relation (ADR-0012): supports (an application covers a capability), serves, '
    + 'realises (a process is how a capability is done — or, ADR-0014, a platform is how a platformService is '
    + 'delivered), assigned (an actor is responsible for a function, a step, or maintains a platformService or a '
    + 'platform), hostedOn (an application or a component runs on a platform — never a platform on a platform, '
    + 'which is parentId) or uses (an application or a component consumes a platformService, or binds to one '
    + 'platform), or interacts (ADR-0036 §7: one unit — an actor with a unit type — works with another, in a mode: '
    + 'collaboration, service or facilitating; the Conway map holds the interfaces between their applications '
    + 'against these rows). Dated when it only holds for a while — the roadmap draws the window. One end may be an '
    + 'element another scope defines, as long as register.list or scopes.list knows the id: an organisation\'s '
    + 'capability supported by a landscape\'s application is written on the organisation. For a flow between two '
    + 'applications use connect, which also takes a protocol and a direction. assigned from a unit to an area, a '
    + 'grouping or a capability of a business sheet says the unit answers for that function, and is written in the '
    + 'scope that defines the function, the unit kept anywhere; which domain the function is handed to is its '
    + 'scopes (element.update). Answers with the relation\'s id. Arguments: certainty — assumed where nobody has '
    + 'checked this, confirmed where somebody has; a card draws dashed and a row says the word. Use it rather than '
    + 'writing (assumed) or ??? into a name or a protocol. Null: nobody has said. validFrom — The first day it '
    + 'holds, yyyy-mm-dd (ADR-0009). Absent: it follows its ends. validUntil — The last day it holds, yyyy-mm-dd, '
    + 'inclusive. Absent: it follows its ends. mode — interacts only (ADR-0036 §7): how the two units work together '
    + '— collaboration, service (one provides what the other consumes, X-as-a-Service) or facilitating (one helps '
    + 'the other learn or adopt something).',
  'diagram.update':
    'Change what a laid-out view is OF (ADR-0012 §6). A sheet draws the journey `journeyId` names — a root step, whose '
    + 'children are the phases and their children the steps — with a row per actor in `lanes`, and the function '
    + 'roots in `areas` in that order; `showActors` false hides the stakeholder rail; `paper` is the canvas it is '
    + 'laid out on — A4 to A0 landscape, A2 by default, or fit for the window; `columns` fixes how many columns its '
    + 'areas are laid out in (absent fits the canvas) and `areaSpans` maps an area id to the columns it takes, its '
    + 'capabilities side by side inside it — on paper an area not named there is widened until the page fits the '
    + 'paper\'s short side. A map takes `areas` as its sections. Absent journeyId or areas is the honest default: '
    + 'no journey band, every root. A technology landscape takes nothing here: everything on it is derived. Each '
    + 'list given replaces that list whole; null clears a field. A board takes `asOf`, the day it draws the model '
    + 'as of. Where a card sits is element.place, not this. A sheet\'s `labels` are the functions whose answering '
    + 'unit its poster shows on the tile (who answers is still relation.add type assigned, in the same batch), and '
    + '`poster` says its tile size, how many rows its journey takes and the free line at its foot. Arguments: '
    + 'colourBy — A landscape: what the application cards are tinted by (ADR-0013) — "platform" groups them by what '
    + 'they run on, "technologyLifecycle" by the worst phase among the platforms they stand on, "lifecycle", '
    + '"category", "owner", "vendor" or "technology" by what each card\'s record says, "aspect:<key>" by the status '
    + 'in one of the board\'s aspect columns, and "one:<id>" (ADR-0020) colours every application that uses, is '
    + 'hosted on or leverages the platform or platformService with that id and fades the rest. Null: nothing. '
    + 'Presentation only; no rows change.',
  'function.claim':
    'Take up an area, a grouping or a capability of a scope above this one (ADR-0040 §5): the domain says it does that '
    + 'function, by keeping a stand-in of it on its own business sheet — what From above… on a sheet does. One step '
    + 'in this scope, nothing written in the scope above. It is filed under its parent where this scope holds the '
    + 'parent, and otherwise is a root of the sheet, drawn as one of its areas (diagramId says which sheet where '
    + 'there are several); what this scope took up under it before is filed under it in the same step. The '
    + 'domain\'s own capabilities go under it with element.add parentId, which is its refinement. Three links '
    + 'between the business sheet and the tree, told apart: who answers for a function is relation.add assigned '
    + 'from a unit, in the scope that defines the function; which domain it is handed to is element.update scopes '
    + 'on the definition, in that scope; which domain took it up is this tool, in the scope below. element.describe '
    + 'of a function says its domains and claimedBy. Refused claim.notAbove for a function defined beside or below '
    + 'this scope, claim.definedHere for one this scope defines; one it holds already is answered with already. '
    + 'Taking it back is element.remove of the stand-in. Answers with where it landed.',
  'cause.merge':
    'Several causes say the same thing: fold them into one survivor (ADR-0035), as observation.merge does for '
    + 'observations. into is the survivor, of this scope or of intoScope; absorb lists the causes folded in, each '
    + 'with its scope where it is not the survivor\'s. The survivor keeps its own title, state, root and body '
    + 'unless values says otherwise — verified only with the evidence written, and root only when a person said so; '
    + 'an absorbed cause stays as history, labelled as merged, and is no longer drawn, linked or addressed. Three '
    + 'kinds of link move where the survivor may hold them: what an absorbed cause explains, the causes that '
    + 'explain it, and the solutions that address it (of the survivor\'s scope, and only while it is a root cause). '
    + 'A link that would loop, point up or sideways, or name a root cause is not moved and stays on the absorbed '
    + 'cause; merge.plan says which, by key, before anything is written. Refused, with the root steps\' keys, where '
    + 'the survivor would be a root cause something still explains, or a cause again that a solution still '
    + 'addresses. Lands as observation.merge does: one step on this scope, which undo takes back, or one step on '
    + 'every scope it writes where the host can, and agent.scopeNotOpen where it cannot. Arguments: links — What to '
    + 'do with a link the merge touches, by the key merge.plan answers. A row not named moves where it may, at the '
    + 'strength offered. links[].move — false: it stays on the absorbed record, as history. true for a row that may '
    + 'not move is refused. links[].strength — Its strength where it lands. Default: the stronger of the links that '
    + 'land there.',
  'observation.merge':
    'Several observations are the same thing: fold them into one survivor (ADR-0035). into is the survivor, of this '
    + 'scope or of intoScope; absorb lists the records folded in, each with its scope where it is not the '
    + 'survivor\'s — above, below or beside. The survivor keeps its own title, where, by, impact, day and body '
    + 'unless values says otherwise, and its sightings are the sum; every record says so in its history, and an '
    + 'absorbed one stays as history, never deleted. Every link that names an absorbed record moves to the survivor '
    + 'where the tree allows it — a cause explains observations of its own scope only — and stays on the absorbed '
    + 'record where it does not. merge.plan says what would move, by key, before anything is written; links unticks '
    + 'a row or chooses its strength. A merge that writes only the scope this call is for is one step, which undo '
    + 'takes back. One that writes other scopes is one step on each, all or none, where the host can write several '
    + 'scopes as one, and is refused agent.scopeNotOpen where it cannot. id and fromScope are the old way to say '
    + 'it, accepted for one beta: id is one observation to absorb, and with fromScope (a scope below) only this '
    + 'scope\'s survivor is written, as before. Use absorb. Arguments: links — What to do with a link the merge '
    + 'touches, by the key merge.plan answers. A row not named moves where it may, at the strength offered. '
    + 'links[].move — false: it stays on the absorbed record, as history. true for a row that may not move is '
    + 'refused. links[].strength — Its strength where it lands. Default: the stronger of the links that land there.',
  'reportingLines.list':
    'The reporting lines on a day (ADR-0039), across the whole tree: for each role in each unit that has one, its kind '
    + '(solid, a line manager\'s; dotted, functional), where it was said (said: role, for every unit that holds the '
    + 'role; type, on the unit type\'s slot; unit, the unit\'s own; person, one holder\'s own, with the '
    + 'assignmentId and personId it holds for), whether it is an exception to the model (override: true for a '
    + 'unit\'s own line and a holder\'s own; the role\'s and the type\'s lines and nesting are the model\'s '
    + 'defaults), whether its target is in the same unit (within), its days, and how it stands — lands (on a role '
    + 'in a unit, named with the scope that keeps it), nesting (the unit says the role reports by nesting here), '
    + 'dangling (no unit has the target role) or ambiguous (several do and none is above; the candidates named). A '
    + 'holder\'s own solid line holds for them in place of their role\'s there; a role held outside the unit\'s '
    + 'slots takes the role\'s own line, and such placements are listed apart (exceptions). Then what the lines '
    + 'contradict: a loop (the chain, and the first day it is there), and a line that is dangling, ambiguous or '
    + 'lands on a role nobody holds that day.',
  'scopes.list':
    'Every scope in the organisation (ADR-0012 §1): its path, its name, what it says it is — a unit type of the '
    + 'operating model (unitTypeId and unitType, ADR-0036) or a built-in kind (organisation, domain, programme, '
    + 'team, landscape — a landscape scope, which is not the same thing as a landscape board — or topic, ADR-0042) '
    + '— the units that serve it today with their types (servedBy), how its type stands to theirs (typeLink: '
    + 'agrees, disagrees, unserved, gone or unsaid), how many views it holds, and which one is open in the app. The '
    + 'tree is kept with scope.create, scope.update, scope.move and scope.remove (ADR-0040). A scope\'s type '
    + 'follows the unit linked to it: a unit\'s scopes written by element.add or element.update give each scope the '
    + 'unit\'s type where this host writes other scopes, and the answer\'s scopeTypes says which did. A path is '
    + 'what `scope` takes on every other tool; "" is the organisation itself. A function of a business sheet and '
    + 'the tree are linked three ways, told apart: a unit answers for it (relation.add, assigned), it is handed to '
    + 'a domain (element.update, its scopes), and a domain takes it up (a stand-in of it in that domain\'s sheet).',
  'observation.move':
    'Move an observation of this scope to another scope it belongs in — above, below or beside (ADR-0038). It is the '
    + 'same record under the same id, with the next number of the scope it goes to, and its title, place, observer, '
    + 'impact, day, body, sightings, history and comments go with it; where it was keeps it as a tombstone that '
    + 'says where it went, so a link to it still leads there. A cause explains observations of its own scope only, '
    + 'so every link that explains it is cut: the link stays on its cause as history, and the analysis starts again '
    + 'in the scope it goes to. move.plan says which links, before anything is written: tell the person. Moving it '
    + 'back to a scope that holds its tombstone brings that back under its old number, and the links cut there '
    + 'explain it again. An archived observation is restored first; a merged one is not moved. It writes two '
    + 'scopes, one step on each, all or none, where the host can write several scopes as one, and is refused '
    + 'agent.scopeNotOpen where it cannot; undo does not take it back — moving it back does. Not solution.move, '
    + 'which moves a solution\'s state. Answers its new label and the links cut.',
  'scope.create':
    'Make a scope under another (ADR-0040), as the organisation screen\'s new-scope dialog does, with or without a '
    + 'scope open: at the address the dialog gives it — the name\'s slug under the parent, suffixed where that is '
    + 'taken or a reserved word (the answer says the path). withBoard makes a landscape scope with one board; '
    + 'without, a domain, which files others and draws nothing itself. servedBy links a unit (an actor with a unit '
    + 'type, element.describe) to serve it from the start: the unit\'s scopes are written in the scope that keeps '
    + 'the unit and the new scope takes the unit\'s type, as Served by does; a link refused leaves the scope made '
    + 'and the answer says where the link is made instead. Refused agent.unknownScope for a parent that is not '
    + 'there. Not a step on the scope open, so not in a batch and not undone with undo. topic makes a topic '
    + '(ADR-0042): filed under the organisation\'s topics place, made on first use, unless parent is in that place '
    + 'or is a topic itself, which makes a subtopic; its links are written with scope.update relevantTo. Answers '
    + 'the path, the name, the kind, the board and what the link came to.',
  'reportingLine.set':
    'Say where the holders of a role in one unit report, as one step in the scope that keeps the unit — which must be '
    + 'the scope open. This is an OVERRIDE of the model for that unit: by default a role\'s holders report where '
    + 'the role and the unit type say (role.update, unitType.update) and otherwise by nesting, and that is what to '
    + 'keep to; write a unit\'s own line only when the person you act for explicitly asks for this exception, and '
    + 'say in your answer that it is one. For one person rather than everybody in the role there, the holder\'s own '
    + 'line is assignment.update with reportsTo. With to, they report to the holders of to.roleId in the unit '
    + 'to.unitId; without it, the role reports by nesting here, whatever the unit type says. It replaces the '
    + 'unit\'s own line of that role and kind, and its type\'s on the days it runs. A line from a role to itself in '
    + 'the same unit is refused (reportingLine.self), and so is a solid one that would close a loop on the day it '
    + 'is written or on its first day (reportingLine.loop, the chain in the detail). reportingLines.list says each '
    + 'line and where it lands. Arguments: to.person — One holder of that role in that unit, by register id '
    + '(assignments.list): the line lands on them alone, and who manages in turn goes on from them. Leave it out '
    + 'for whoever holds the role there. Where they no longer hold it on a day, the line is vacant that day (a '
    + 'finding) and the model\'s answer stands. kind — solid: the holders of the target role manage these, in place '
    + 'of the nesting, and a right a host grants from managing follows it. dotted: functional, shown and answered, '
    + 'and deciding nothing. Default solid.',
  'assignments.list':
    'Who holds which role in which unit (ADR-0036 §4), across the whole tree: each assignment with the scope that keeps '
    + 'it, its unit and role by id and by name, its person by register id and by name — or by pseudonym where the '
    + 'organisation\'s policy gives agents pseudonyms, and never an address — its share in per cent, its days and '
    + 'whether the person is acting. Those running on the day unless all is asked. Asked about one unit, it also '
    + 'says the unit\'s slots against how many hold each on the day, the roles held there outside them '
    + '(exceptions), and who manages it: whoever holds a role that manages, in it or a unit above it. Each '
    + 'assignment says who manages its holder, each with via — nesting, line where a solid line of the model\'s '
    + 'decides it (the role\'s or the unit type\'s), override where an exception does (the unit\'s own line, or the '
    + 'holder\'s own) — and the dotted lines apart; the holder\'s own lines as written (reportsTo); and exception: '
    + 'true where the role is not one of the unit\'s slots (ADR-0039, amended 17 October 2026). Core grants nothing '
    + 'from that; it is said.',
  'unitTypes.list':
    'The organisation\'s kinds of unit (ADR-0036), in its own words: each unit type\'s purpose, where a unit of it may '
    + 'sit (at the top, under the organisation, and under the unit types listed in within), whether it may serve '
    + 'more than one domain (spans), the roles it holds with how many of each (slots: min, and max where there is '
    + 'one), how many applications a unit of it should own at most (limit), the library entry it was based on '
    + '(basedOn, with the name it was given then where that was not the library\'s, and where it was put then, '
    + 'placed, where that was not where the library puts it), and the library entries it was matched to when a '
    + 'library was brought in (alsoBasedOn). Listed as the structure stands: by lane — 1 for a type that may sit at '
    + 'the top, and below the deepest type it may sit in — then by its order in the lane, then by name; a type that '
    + 'sits nowhere has no lane, says sitsNowhere and comes last. The operating model is kept at the organisation: '
    + 'whatever scope is open, this answers from there.',
  'element.add':
    'Add an element to the landscape, and draw it on a diagram (the one on screen unless said otherwise) where its kind '
    + 'is one a board can draw. It gets the id the file would give it, derived from the name, and lands in its '
    + 'kind\'s own band unless a zone or a spot is named. A business kind — a step, a function, a process — is a '
    + 'record and is drawn nowhere: a sheet is laid out from the tree rather than dragged, so it needs no diagram '
    + 'and can be added while a scope\'s home is on screen. A platform — a cluster, a broker, a bus, the tooling '
    + '(ADR-0013) — is drawn as the chip of the management band and lands there; what runs on it and what passes '
    + 'through it are rows, not lines. A platformService (ADR-0014) is the offering a platform realises — container '
    + 'platform, message brokering, managed database — what a team asks for and a platform team is accountable for; '
    + 'the same chip, a tree by parentId like every kind. Answers with the id, and with whether it was drawn. '
    + 'Arguments: certainty — assumed where nobody has checked this, confirmed where somebody has; a card draws '
    + 'dashed and a row says the word. Use it rather than writing (assumed) or ??? into a name or a protocol. Null: '
    + 'nobody has said. platformArchetype — A platform only: what it is (ADR-0014) — a place something is hostedOn '
    + '(a cluster, a namespace, an account: the deployment boxes draw these), a service something consumes (a '
    + 'broker, a bus, a vault), or a network. Service when unsaid. shared — A platformService only: offered for use '
    + 'beyond the team that maintains it (ADR-0014). False or null takes it off. Where unsaid, a service assigned '
    + 'to one actor and used by an application of another team is reported as check.offeredNotShared rather than '
    + 'assumed. isManaged — Kept on the record for the files that carry it; nothing in the app reads or shows it '
    + 'since 3.7.0. Whose a system is, is `outside`. owner — Who answers for it. On an application this and partyId '
    + 'are one field: name a unit with partyId where a unit answers for it; text here is a name, and is flagged as '
    + 'not being a unit (check.applicationOwnerNamed). Setting one clears the other. Which scope owns it is the '
    + 'scope it is kept in. Where none is written, an application\'s owner may be worked out from the operating '
    + 'model\'s rule (answered as ownerByRule). A person: { "person": id } or text (rules.read person). outside — '
    + 'True when nobody in this organisation owns it. What the externalSystem kind used to say, as the fact it '
    + 'always was. partyId — The id of the actor it belongs to: one this scope keeps or one a scope above it keeps. '
    + 'On an application this is its owner, the unit that answers for it, and clears a name in owner. Without '
    + 'outside it says whose it is in the organisation; with outside, whose it is outside it. order — Where it sits '
    + 'among its siblings, low first. Only say it where the order is a decision — a journey reads left to right. '
    + 'lane — A step only: the id of the actor whose own path this step is. Absent means the row every lane shares. '
    + 'retiredOn — The day it is gone, yyyy-mm-dd. A board dated after it draws neither the card nor its lines. '
    + 'successorId — The id of what replaces it when it retires. The roadmap\'s checks read this. aspects — '
    + 'Maturity per aspect, keyed by aspect (platform, cicd, dr, security, monitoring, backup, compliance, cost, or '
    + 'a custom key): managed, partial, none or atRisk. Only the keys given change; null takes an aspect off. '
    + 'accentColor — The card\'s accent, as a hex colour like #2e86c1. Empty or null gives the theme\'s back. '
    + 'iconKey — The mark drawn on the card, by its key in the icon registry. Empty or null takes it off. icon — A '
    + 'step or an actor: its picture on a sheet\'s poster, a shipped icon\'s name or a content address '
    + 'from images.list (image.upload puts one there). Empty or null takes it off. unitTypeId — An actor only: the '
    + 'organisation\'s kind of unit it is, by the id of a unit type (unitTypes.list) — which makes it a unit '
    + '(ADR-0036 §3), holding the roles its type says. Null or empty takes it off, and it is a party again. scopes '
    + '— A function: the domains it is handed to, by scope path, each below the scope that defines it — the scope '
    + 'above\'s intent; a domain taking it up is a stand-in in its own sheet, which this does not write. A unit: '
    + 'the domains it serves, by scope path — absent means the scope it is kept in, or no domain where that is the '
    + 'organisation ("" is never a domain, and is dropped); several only where its unit type spans domains (a check '
    + 'says so otherwise). Replaces the list; null clears it. Each domain named takes the unit\'s type as its own '
    + '(ADR-0036, amended 17 October 2026) unless its type already agrees with a unit serving it; the answer\'s '
    + 'scopeTypes says which did. Every path is checked against the tree (ADR-0040): one it does not hold is '
    + 'agent.unknownScope, naming the entry. extraSlots — A unit only: roles it holds beyond its type\'s, each with '
    + 'how many. Replaces the list; null clears it. extraSlots[].min — At least this many; 0 for a role it may have '
    + 'and need not. extraSlots[].max — At most this many; leave it out for no upper bound.',
  'observations.list':
    'What was observed in this scope (ADR-0021): id, label, title, date, where, impact, how often it was seen, and the '
    + 'causes it was analysed into. With below true, the observations of every scope under this one instead '
    + '(ADR-0032): local to those scopes, each with the path of the scope it lives in and the causes of that scope '
    + 'that explain it. An observation merged into another is listed only when includeMerged is true, with '
    + 'mergedInto — and mergedIntoScope where the survivor lives in another scope (ADR-0035); an archived one — '
    + 'fixed, addressed, no longer relevant — only when includeArchived is true. Each says its tone — bright '
    + '(something that works), neutral or problem (ADR-0038) — and who recorded it where that was kept; tone lists '
    + 'one tone alone, and recordedBy: "me" what the person you act for recorded or saw: by their account or entry, '
    + 'a merged entry included, or by their full name typed as who saw it or kept as who recorded it. about lists '
    + 'only the observations about one element, by id, and each observation answers the elements it is about as '
    + 'about (ADR-0032, amended 22 November 2026).',
  'diagram.create':
    'Add a diagram: a new landscape by name, a C4 container view of one application seeded with its components and laid '
    + 'out on first open, a business architecture sheet over the journey and the areas this project already holds, '
    + 'an enterprise map — every function against the applications that support it, with the gaps — or a technology '
    + 'landscape: the applications, the services they use and the platforms that deliver them, in three bands '
    + '(ADR-0015) — or, ADR-0036 §7, an organisation chart (chart: the units filed here and below, and those '
    + 'serving here, as a tree with their roles, holders and vacancies on the view\'s day) or a Conway map (conway: '
    + 'those units over the applications they own, the interfaces between them and the interactions declared '
    + 'between the units, with what they contradict). Every kind is switched to once made: the laid-out ones are '
    + 'drawn in their tab like a board (ADR-0016). Answers with the id.',
  'element.update':
    'Change an element\'s fields. Only the fields given change; the rest stay as they are, and null clears an optional '
    + 'one. The dates go live → retiring → retired and are refused out of order; a parentId that would make a loop '
    + 'is refused; where a card sits on a diagram is element.place, not this. Order among siblings is `order`, low '
    + 'first — a sheet lays its trees out by it. A unit\'s parentId may be any unit in the organisation, kept in '
    + 'any scope, found by its id: the unit moves there with its people, its reporting lines, the scopes it serves '
    + 'and the units inside it, its order among its new siblings starts afresh, and a loop over the organisation — '
    + 'today or on a later day a plan\'s move reaches — is refused. Where its type may not sit there it is moved '
    + 'all the same and the answer says misplaced: true. Call it in the scope that keeps the unit. This is a '
    + 'correction, with no day; a move on a day is plan.move. Arguments: certainty — assumed where nobody has '
    + 'checked this, confirmed where somebody has; a card draws dashed and a row says the word. Use it rather than '
    + 'writing (assumed) or ??? into a name or a protocol. Null: nobody has said. platformArchetype — A platform '
    + 'only: what it is (ADR-0014) — a place something is hostedOn (a cluster, a namespace, an account: the '
    + 'deployment boxes draw these), a service something consumes (a broker, a bus, a vault), or a network. Service '
    + 'when unsaid. shared — A platformService only: offered for use beyond the team that maintains it (ADR-0014). '
    + 'False or null takes it off. Where unsaid, a service assigned to one actor and used by an application of '
    + 'another team is reported as check.offeredNotShared rather than assumed. isManaged — Kept on the record for '
    + 'the files that carry it; nothing in the app reads or shows it since 3.7.0. Whose a system is, is `outside`. '
    + 'owner — Who answers for it. On an application this and partyId are one field: name a unit with partyId where '
    + 'a unit answers for it; text here is a name, and is flagged as not being a unit '
    + '(check.applicationOwnerNamed). Setting one clears the other. Which scope owns it is the scope it is kept in. '
    + 'Where none is written, an application\'s owner may be worked out from the operating model\'s rule (answered '
    + 'as ownerByRule). A person: { "person": id } or text (rules.read person). outside — True when nobody in this '
    + 'organisation owns it. What the externalSystem kind used to say, as the fact it always was. partyId — The id '
    + 'of the actor it belongs to: one this scope keeps or one a scope above it keeps. On an application this is '
    + 'its owner, the unit that answers for it, and clears a name in owner. Without outside it says whose it is in '
    + 'the organisation; with outside, whose it is outside it. order — Where it sits among its siblings, low first. '
    + 'Only say it where the order is a decision — a journey reads left to right. lane — A step only: the id of the '
    + 'actor whose own path this step is. Absent means the row every lane shares. retiredOn — The day it is gone, '
    + 'yyyy-mm-dd. A board dated after it draws neither the card nor its lines. successorId — The id of what '
    + 'replaces it when it retires. The roadmap\'s checks read this. aspects — Maturity per aspect, keyed by aspect '
    + '(platform, cicd, dr, security, monitoring, backup, compliance, cost, or a custom key): managed, partial, '
    + 'none or atRisk. Only the keys given change; null takes an aspect off. accentColor — The card\'s accent, as a '
    + 'hex colour like #2e86c1. Empty or null gives the theme\'s back. iconKey — The mark drawn on the card, by its '
    + 'key in the icon registry. Empty or null takes it off. icon — A step or an actor: its picture on a sheet\'s '
    + 'poster, a shipped icon\'s name or a content address from images.list (image.upload puts one there). Empty or '
    + 'null takes it off. unitTypeId — An actor only: the organisation\'s kind of unit it is, by the id of a unit '
    + 'type (unitTypes.list) — which makes it a unit (ADR-0036 §3), holding the roles its type says. Null or empty '
    + 'takes it off, and it is a party again. scopes — A function: the domains it is handed to, by scope path, each '
    + 'below the scope that defines it — the scope above\'s intent; a domain taking it up is a stand-in in its own '
    + 'sheet, which this does not write. A unit: the domains it serves, by scope path — absent means the scope it '
    + 'is kept in, or no domain where that is the organisation ("" is never a domain, and is dropped); several only '
    + 'where its unit type spans domains (a check says so otherwise). Replaces the list; null clears it. Each '
    + 'domain named takes the unit\'s type as its own (ADR-0036, amended 17 October 2026) unless its type already '
    + 'agrees with a unit serving it; the answer\'s scopeTypes says which did. Every path is checked against the '
    + 'tree (ADR-0040): one it does not hold is agent.unknownScope, naming the entry. extraSlots — A unit only: '
    + 'roles it holds beyond its type\'s, each with how many. Replaces the list; null clears it. extraSlots[].min — '
    + 'At least this many; 0 for a role it may have and need not. extraSlots[].max — At most this many; leave it '
    + 'out for no upper bound.',
  'element.remove':
    'Remove an element from the landscape, with every connection that ends on it, its place on every diagram, and any '
    + 'container view about it — and, for a unit, every assignment in it, ended ones included: deleting a unit is a '
    + 'correction, so its people\'s roles in it go as if never held, and the answer lists them '
    + '(assignmentsRemoved). To keep who held what, retire the unit on a day with element.update instead. The units '
    + 'inside a unit move up into its parent where their type may sit there (unitsMoved); where it may not, the '
    + 'call is refused with agent.unitsInside and the choices named — never pick one yourself: ask the person, then '
    + 'call again with units. Applications that name the unit as their team are cleared (teamCleared), and its rows '
    + 'kept in other scopes go there too (alsoChanged), as one change. One undo step puts all of it back, unless '
    + 'other scopes were changed: then it is undone scope by scope.',
  'plan.update':
    'Change a plan\'s fields, its lists or its body in place. Only what is given changes; null clears from, to and '
    + 'owner; a list given replaces that list whole. The status follows draft → agreed → running → done, with '
    + 'abandoned reachable from any of the first three and every arrow reversible. The three forward moves are '
    + 'gated, over the plan as the call leaves it: agreed needs from and to (to not before from), an owner, an '
    + 'element it names and every decision it rests on accepted; running the same and from not in the future; done '
    + 'every introduced element dated live, every retired one dated gone and no interface left unported. A refusal '
    + 'names what the gate still needs. When the body holds a ```business-case fence the answer carries what it '
    + 'computes — read plan.read for the fence\'s shape. The dates on the elements a plan introduces or retires are '
    + 'the elements\' own: set them with element.update. Arguments: initiative — An initiative the organisation '
    + 'follows (ADR-0012 §7): shown on the roadmap of every scope above this one, read there and edited here. False '
    + 'takes it off them.',
  'assignment.add':
    'Put a person in a role of a unit, as one step in the scope that keeps the unit — which must be the scope open. '
    + 'Keep to the model: place them in a role the unit\'s slots give (assignments.list with unitId lists them) and '
    + 'let their reporting line follow the role, the unit type and nesting. A role outside the slots is an '
    + 'exception placement — allowed, answered exception: true, shown as an exception wherever the holder is, and '
    + 'no finding — to write only when the person you act for explicitly asks for it, saying in your answer that it '
    + 'is one; so is reportsTo, the holder\'s own line. The assignment holds the person\'s register id, never a '
    + 'name: add someone new with person.add first, which checks the register for duplicates. Someone who has left '
    + 'or been forgotten is refused. A slot over its maximum and a person over 100% are findings (checks.list), not '
    + 'refusals. Answers with the id. Arguments: reportsTo — An EXCEPTION to the model, for this holder only: where '
    + 'they report in place of what their role, their unit\'s type, their unit and nesting say. Write it only when '
    + 'the person you act for explicitly asks for this exception, and say in your answer that it is one; otherwise '
    + 'leave it out and the model\'s lines hold. At most one line of each kind: a solid one decides who manages '
    + 'this holder (and the managing right a host grants follows it); a dotted one is functional and replaces their '
    + 'role\'s dotted line for them. A line to their own role in their own unit is refused (reportingLine.self), '
    + 'and a solid one that would close a loop (reportingLine.loop). On assignment.update the list replaces theirs; '
    + 'an empty list or null goes back to the model\'s. reportsTo[].to.unitId — The unit reported to, anywhere in '
    + 'the organisation (assignments.list, elements.list). reportsTo[].to.person — One holder of that role in that '
    + 'unit, by register id (assignments.list): the line lands on them alone, and who manages in turn goes on '
    + 'from them. Leave it out for whoever holds the role there. Where they no longer hold it on a day, the line is '
    + 'vacant that day (a finding) and the model\'s answer stands. reportsTo[].kind — solid: the holders of the '
    + 'target role manage these, in place of the nesting, and a right a host grants from managing follows it. '
    + 'dotted: functional, shown and answered, and deciding nothing. Default solid.',
  'scope.update':
    'Change what a scope says about itself (ADR-0040), as its settings dialog does: its name and description, and what '
    + 'it is — a unit type of the operating model (unitTypeId, unitTypes.list) or a built-in kind, never both: the '
    + 'one given clears the other — the client its drawings are made out to, and its links. Only the fields given '
    + 'change; null clears an optional one. The organisation is described like any scope. The address stays: '
    + 'scope.move files it elsewhere. relevantTo is a topic\'s links to the scopes it is relevant to (ADR-0042), '
    + 'given whole as topics.list reads them: to link one, give the list with it added and from the day it begins — '
    + 'today, for a link made now; to end one, give it an until, its last day, and keep it as history; leave a link '
    + 'out only where it was made by mistake. A scope that says where it is relevant is a topic. Answers which '
    + 'fields changed.',
  'people.list':
    'The organisation\'s people register (ADR-0036), kept outside the history: each entry\'s id, name, kind (internal '
    + 'or external), state (active, left or forgotten) and the days it moved, and whether it has a work address — '
    + 'never the address. `shows` says whether names are shown or, where the organisation\'s policy says so, '
    + 'pseudonyms (Person 4K7Q; a forgotten entry is Former colleague 4K7Q). `redirects` are entries a merge folded '
    + 'into another: an id there resolves to its mergedInto. `possibleDuplicates` are pairs that may be one person '
    + '— the same address, the same name, nearly the same name, or the same family name and initial — for a person '
    + 'to merge on the People page, without the pairs a person answered there as not the same person. No tool '
    + 'forgets, removes or merges, and none answers or takes back that two entries are not the same person.',
  'merge.plan':
    'What observation.merge or cause.merge would do with these arguments, without doing it (ADR-0035): the survivor and '
    + 'the records it would absorb, every link that names an absorbed record — its key, the record it lives on and '
    + 'the one it names, where it would land, whether it may move and, where not, why in the link form\'s words, '
    + 'whether both records had it and the strength offered — the scopes the merge would write, and the refusal it '
    + 'would meet, if any — and how many comments travel with the absorbed records\' threads, counted for the scope '
    + 'this call is for; those of records in another scope are carried all the same and counted in the merge\'s '
    + 'answer, and commentsNotCounted names those scopes. Pass the key back in links to keep a row where it is or '
    + 'choose its strength. A read: it changes nothing, and answers for a scope that is not open. Arguments: links '
    + '— What to do with a link the merge touches, by the key merge.plan answers. A row not named moves where it '
    + 'may, at the strength offered. links[].move — false: it stays on the absorbed record, as history. true for a '
    + 'row that may not move is refused. links[].strength — Its strength where it lands. Default: the stronger of '
    + 'the links that land there.',
  'search':
    'Search every kind of record together, the way ⌘K does in the app: elements and their documentation, views, '
    + 'relations, decision records, plans and their milestones, observations, causes, solutions and experiments — '
    + 'in this scope, the decision records of the scopes above, and the observations and initiatives the scopes '
    + 'below share with it. Every word of the query must occur; case and accents do not matter. Each hit says its '
    + 'kind, its id, its title and, where it has one, its label (OB-0007), status and a snippet of the prose that '
    + 'matched; a hit held by another scope says so as scopePath — read it there by passing that as scope. A hit of '
    + 'kind adr also carries adrId and scope (group, landscape or application), an element or its documentation '
    + 'elementId and name, and a plan planId, as they did before the other kinds were searched.',
  'diagram.render':
    'A picture of a diagram as the app draws it, as a PNG, with the transform it was drawn with so a pixel maps back to '
    + 'a flow coordinate. Crop to some elements or to a region: a whole landscape within the pixel budget is a '
    + 'thumbnail. Switches the app to that diagram; the window must be visible. An organisation chart or a Conway '
    + 'map shows people by name, and is refused where the organisation gives agents pseudonyms: diagram.inspect '
    + 'reads either. A business architecture sheet, an enterprise map or a technology landscape is drawn whole — '
    + 'none has coordinates to crop to — and the crop arguments are ignored for one. A sheet takes `pageWidth`: the '
    + 'CSS width it is laid out at before drawing, so its areas tile as they would on paper (A1 is 3179, A0 is '
    + '4494); raise maxPixels with it, or the picture is scaled down to fit the budget.',
  'cause.add':
    'Say what lies behind one or more observations, or behind other causes (ADR-0021): a new cause, assumed until '
    + 'verified, numbered after the last one here. This is where the analysis goes — the team\'s explanation, one '
    + 'statement per cause, with no remedy in it (a remedy is a solution). Then ask why again: a deeper cause '
    + 'explains this one (explains: this cause\'s id), until the team says one is the root cause, where the chain '
    + 'ends and solutions go (ADR-0032). root: true makes it one as it is made — only when a person said so. Name '
    + 'what it explains and the links are made in the same step: observations and causes of this scope, and causes '
    + 'of a scope below (with its scope) — never an observation below, which that scope explains, and never a root '
    + 'cause. Leave the body out for the template.',
  'element.place':
    'Put an element at a spot on a diagram, in flow coordinates, and on a landscape file it in a band or a domain '
    + 'group. A spot in another band than the one it is filed in is refused unless the band is named too; a card '
    + 'put in a band is kept inside it; a group named grows its box to hold the card, and null takes the card out '
    + 'of its group. With only a group given the card lands at a free slot inside its box. On a sheet it places a '
    + 'block, in poster units on the 1860 wide page: an area or the journey by its id, the stakeholder column as '
    + 'rail, a free item by its id, with width and height to resize. The first block placed writes every block, and '
    + 'the poster stops following the first layout until diagram.tidy. A tile takes cell instead, in its block\'s '
    + 'grid, and null flows again.',
  'technology.use':
    'Make what an application or a component uses equal to a list (ADR-0020): the platformServices it consumes and the '
    + 'platforms it binds to, as one step — rows for targets no longer named are removed, rows for new ones '
    + 'written, and a kept row left exactly as it was. A target another scope defines (technology.list knows it) '
    + 'arrives as a stand-in in the same step. This is what the inspector\'s Uses picker and a drop on the '
    + 'technology landscape write; relation.add with type uses writes one row at a time. Refused '
    + 'command.technologyEnds for a target that is neither a platformService nor a platform, or an element that is '
    + 'neither an application nor a component, and agent.unknownId for a target nobody in the organisation defines. '
    + 'Answers with the rows written and removed.',
  'observation.record':
    'Write down something that was seen (ADR-0021), numbered after the last observation in this scope, seen once. Where '
    + 'it was seen and who saw it are required, and the day is today unless date says another. An observation is a '
    + 'fact: what was seen, where, when, by whom and the evidence, in neutral words — no explanation, no opinion, '
    + 'no blame and no fix. Why it happens is a cause (cause.add); what to do about it is a solution '
    + '(solution.propose). When a person\'s account mixes them, record the facts here, put the rest where it '
    + 'belongs and say so. Seen again is observation.seen, not a new record; check observations.list first. It is '
    + 'local to the scope it is recorded in, and every scope above reads it (ADR-0032): nothing is shared. about '
    + 'names the elements it is about, by id — elements this scope holds, its own or stand-ins, refused '
    + 'agent.unknownId otherwise — while where stays in words beside it. Leave '
    + 'the body out for the template. Arguments: principles — Principles in force here that this record cites, in '
    + 'the same step (ADR-0041 §7); principles.suggest finds them. Adds to what it cites; principle.uncite takes '
    + 'one back. principles[].scope — The scope that keeps it ("" the organisation). Default: the scope open. '
    + 'principles[].stance — A decision: supports (default) or deviates. An observation: holds (default), chafes or '
    + 'missing.',
  'plan.move':
    'Put a unit under a new parent on a day, as part of a plan (ADR-0036 §6): a reorganisation is a plan, and the move '
    + 'holds wherever the organisation is read on that day or after it — assignments.list with on, checks.list with '
    + 'on, who manages a unit — and not before. One move per unit and plan: moving it again changes the move, and '
    + 'remove takes it off; parentId left out puts it at the top, under the organisation itself. A parent below the '
    + 'unit on that day is refused. The move is shifted with the plan. A move outside a plan is a correction: '
    + 'element.update with parentId. The people of a unit or a role that ends are moved on the plan\'s page, or '
    + 'with assignment.end and assignment.add in one batch. Answers with the plan\'s moves.',
  'decision.transition':
    'Move a decision record to its next status: proposed → reviewing → accepted or rejected, a proposal withdrawn '
    + '(proposed → rejected, with a reason), review sent back to proposed, and accepted → superseded (naming an '
    + 'accepted successor). Accepting is gated: the body has its context, at least two considered options, an '
    + 'outcome naming one of them and a consequence, not the template\'s placeholders; a signer approved and none '
    + 'rejected; and every record it supersedes is accepted — those move to superseded in the same step. Rejecting '
    + 'needs a reason or a rejecting signer. A refusal names what the gate still needs. Accepted, rejected and '
    + 'superseded records are locked; superseding is the one move an accepted record has.',
  'assignment.update':
    'Correct an assignment, as one step in the scope that keeps it — which must be the scope open: its share, whether '
    + 'the person is acting, its first and last day, and the holder\'s own reporting lines (reportsTo). Only the '
    + 'fields given change; null clears the share (all of their time), acting, the last day and reportsTo. Days run '
    + 'forwards (command.datesOutOfOrder). Ending one is assignment.end; another unit or role is a new assignment '
    + '(assignment.end, then assignment.add). Keep to the model\'s defaults: reportsTo is an exception for this '
    + 'holder alone, written only when the person you act for explicitly asks for it — say in your answer that it '
    + 'is one — and reportsTo null puts the model\'s lines back. Arguments: reportsTo — An EXCEPTION to the model, '
    + 'for this holder only: where they report in place of what their role, their unit\'s type, their unit and '
    + 'nesting say. Write it only when the person you act for explicitly asks for this exception, and say in your '
    + 'answer that it is one; otherwise leave it out and the model\'s lines hold. At most one line of each kind: a '
    + 'solid one decides who manages this holder (and the managing right a host grants follows it); a dotted one is '
    + 'functional and replaces their role\'s dotted line for them. A line to their own role in their own unit is '
    + 'refused (reportingLine.self), and a solid one that would close a loop (reportingLine.loop). On '
    + 'assignment.update the list replaces theirs; an empty list or null goes back to the model\'s. '
    + 'reportsTo[].to.unitId — The unit reported to, anywhere in the organisation (assignments.list, '
    + 'elements.list). reportsTo[].to.person — One holder of that role in that unit, by register id '
    + '(assignments.list): the line lands on them alone, and who manages in turn goes on from them. Leave it out '
    + 'for whoever holds the role there. Where they no longer hold it on a day, the line is vacant that day (a '
    + 'finding) and the model\'s answer stands. reportsTo[].kind — solid: the holders of the target role manage '
    + 'these, in place of the nesting, and a right a host grants from managing follows it. dotted: functional, '
    + 'shown and answered, and deciding nothing. Default solid.',
  'technology.list':
    'Every platform service and platform in the organisation, derived from the whole tree (ADR-0014): the scope that '
    + 'answers for it, the scopes that draw it, and what the rows say. A service: who maintains it (assigned), '
    + 'whether it is shared, how many applications consume it and from how many scopes, and what realises it — '
    + 'empty is a real gap. A platform: what it is, what it realises, how many things are hosted on it or on '
    + 'anything filed under it, what it sits in, and the service it belongs to. With the keys of the findings about '
    + 'it, including check.offeredNotShared. Beside register.list, which is the applications. Filter by kind, or by '
    + 'a free-text query over name, id, master and maintainer.',
  'views.list':
    'Every view in the organisation, scope by scope: boards (layer7 and container), business sheets, enterprise maps, '
    + 'technology landscapes, drawings, organisation charts (chart) and Conway maps (conway), each with its id, '
    + 'name and kind, and which is on the tab in its scope. A drawing also says the element it is anchored to, when '
    + 'it has one, and the element ids its shapes point at. The overview a person gets from the organisation screen '
    + 'and the tabs, in one answer; app.open takes a row\'s scope and id. Reads every scope that holds a view, so '
    + 'ask once and keep it. A scope may hold none — its observations, decisions and plans are all it keeps — and '
    + 'is then not listed.',
  'principles.list':
    'Architecture principles (ADR-0041). With scope: those in force there today — its own, every scope\'s above it, and '
    + 'those of the topics relevant to it (ADR-0042) — each with the scope that keeps it and via (here · above · '
    + 'topic); with own: true, only the scope\'s own, with its groups. Without scope: every scope\'s own. Each '
    + 'principle says its number (PR-NNNN on screen), title, statement, status (candidate · accepted · retired), '
    + 'regime and its aspects, numbered under it. A merged one is left out. A scope\'s groups come with their ids, '
    + 'what principleGroups.set renames one by; a principle names its groups by name. principle.read says the rest '
    + 'of one.',
  'solutions.list':
    'What this scope is doing about its causes (ADR-0026): each solution with its label, title, state and phase (idea, '
    + 'shaped, testing, proven, adopted, implemented — implemented is read off its plan being done — or dropped), '
    + 'benefit and cost, the causes it addresses and whether each is a root, who it was checked with, earlier '
    + 'attempts, its experiments, its decision record and plan, what the next gate still needs (next.open), the '
    + 'questions its record asks (worksAround: it treats no root cause; addsOnly: its plan retires nothing; '
    + 'adoptedUnplanned), and, once implemented, any observation seen again since. Dropped ones only with '
    + 'includeDropped.',
  'solution.propose':
    'Propose a solution for one or more causes of this scope (ADR-0026): a new idea, numbered after the last one here, '
    + 'linked to what it addresses in the same step. A solution addresses root causes only: a cause a deeper cause '
    + 'explains is refused, naming the deeper one — keep asking why until the analysis reaches a root. Proposing is '
    + 'cheap on purpose; the vetting is the gates after it. Propose the alternatives too, and drop the ones not '
    + 'pursued with the reason rather than removing them: they are what was considered. A cause that later gains a '
    + 'deeper one keeps its solutions, which are then asked whether they work around the problem.',
  'scope.move':
    'File a scope, and everything filed under it, under another parent (ADR-0040): its last address segment kept, '
    + 'suffixed where taken. Every identity, state and history goes with it, and every stand-in elsewhere that '
    + 'named an address in it is re-addressed as that scope\'s own step, and so is every unit whose served scopes '
    + 'name one (listed in units, by id and the scope that keeps it); one kept in a scope the person may not write '
    + 'is listed in notCarried, and the move stands. Refused scope.organisation for the organisation, '
    + 'shell.scopeIntoItself for a parent under the scope itself. Answers from, to, carried, notCarried and units.',
  'experiment.conclude':
    'Move an experiment on, one step at a time: planned → running (which sets from to today), running → planned, '
    + 'running → confirmed, refuted or inconclusive (a conclusion needs the result — counted, where there are '
    + 'numbers — and ends on to, today unless given, never before from), and a concluded one → running, which '
    + 'reopens it. The outcome is what the team observed, so conclude only when told it. Reopening a confirmed '
    + 'experiment may take the proof from the solutions it proved: the answer lists them in proofWithdrawn, so tell '
    + 'the person. A refuted one stays; it is the evidence the next person asks for.',
  'references.list':
    'What a document may refer to (ADR-0043 §9, §10), in the open scope or the scope named: its views and elements, the '
    + 'principles in force there and each of their aspects, every building block\'s requirements and every scope\'s '
    + 'evaluation of one, and its decisions and observations — each with the markdown that refers to it, to write '
    + 'into a description or a decision\'s body as it is: an element by [[Name]] in a sentence, a view by '
    + '![name](view:id), the rest as a ref fence on lines of its own, drawn from the model each time it is read. '
    + 'query narrows them; at most 50, best first.',
  'scope.remove':
    'Remove one scope (ADR-0040). There is no undo for this. An empty scope goes on request — what it says about itself '
    + 'is not work. One with scopes under it is refused scope.scopesBelow, naming them: remove those first, deepest '
    + 'first, one call each. One that holds work — views, elements, records, plans, assignments, comments, pictures '
    + '— is refused scope.notEmpty with what it holds: tell the person, and only if they then say in their own '
    + 'words that it is to go with all of it, call again with removeContents and their words in personSaid. Answers '
    + 'what went, by kind.',
  'roles.list':
    'The organisation\'s roles (ADR-0036): name, short name and purpose, its duties — a responsibility each, marked R, '
    + 'A, C or I — whether whoever holds it manages the people of the unit and of the units below (manages), where '
    + 'its holders report wherever it is held (reportsTo, ADR-0039; reportingLines.list lands each line on a unit), '
    + 'the unit types that hold it, the library entry it was based on (basedOn) and those it was matched to when a '
    + 'library was brought in (alsoBasedOn), and the rules that name a role. Kept at the organisation, and answered '
    + 'from there.',
  'roadmap.check':
    'What the dates in this landscape contradict: a retirement with connections still live, a successor that goes live '
    + 'after the thing it replaces is gone, a retirement with no successor named, a connection valid after one of '
    + 'its ends has retired, and a plan past the day it was due to finish. It reports contradictions only — it '
    + 'cannot tell you a landscape is out of date. It also reports an "impliedInterface": container-level lines '
    + 'running between two applications with no application-level interface written for them, which '
    + 'interface.accept draws.',
  'element.describe':
    'Everything about one element: its fields, its documentation as markdown, the connections that end on it, where it '
    + 'is drawn on each diagram, the decisions this scope keeps about it, and the open observations on it here and '
    + 'in the scopes below (id, label, title, tone, and scope where it is another; ADR-0032, amended 22 November '
    + '2026). A record carrying `ref` is a STAND-IN: the '
    + 'thing is defined in the scope that `ref` names, its `name` and `ref` are caches of what is written there, '
    + 'and its description is the owner\'s, shown here and changed there. Everything else on a stand-in — '
    + 'lifecycle, dates, owner, vendor, technology, aspects — belongs to the owning scope and cannot be changed '
    + 'from here.',
  'move.plan':
    'What observation.move would do with these arguments, without doing it (ADR-0038): the number the observation would '
    + 'have in the scope it goes to, whether it moves back over its own tombstone there, the scopes it would write, '
    + 'how many comments go with it, and every link it would cut — each cause that explains it, with the solutions '
    + 'on a root cause the link leads to — or, moving back, the links that would explain it again; and the refusal '
    + 'it would meet, if any. A read: it changes nothing, and answers for a scope that is not open.',
  'block.update':
    'Change a building block kept in the open scope (ADR-0043 §2, §3): its requirements — the capabilities it must '
    + 'provide (a must fails any solution that does not cover it fully) and its usage contexts, each with what it '
    + 'needs of each capability, 0 to 4 — and its catalogue of solutions. Each list given is the whole list: keep '
    + 'an item by giving it back with its id; an item without an id is new. A context names a capability by its id '
    + 'or by its words. Its name and description are element.update\'s. Answers the ids each item has.',
  'causes.list':
    'The causes this scope\'s analysis found (ADR-0021): id, label (CA-, or RC- for a root cause), title, assumed or '
    + 'verified, what each explains (observations and shallower causes here, causes of the scopes below, with the '
    + 'strength of each link), what explains it, and whether it is a root cause — one a person said is (ADR-0032), '
    + 'where the chain ends. A cause merged into another (cause.merge) is history: listed only when includeMerged '
    + 'is true, with mergedInto — and mergedIntoScope where the survivor lives in another scope.',
  'cause.link':
    'A cause explains something: an observation or a shallower cause of this scope, or a cause of a scope below '
    + '(explainsScope: its path; ADR-0032). Linking to what it already explains changes the strength: how firmly '
    + 'the team believes this cause explains it. Refused: a loop between causes, a root cause as the thing '
    + 'explained, a cause of this scope or one above named as below, a scope beside this one, and an observation of '
    + 'a scope below — that scope explains its own observations, and this one explains its causes.',
  'cause.update':
    'Correct a cause: its title, its body, or its state — verified once a person says the team has checked it against '
    + 'evidence, never on your own reasoning, and only with the body\'s "Why we think so" and "How to verify" '
    + 'filled in (the same call may write them); back to assumed when it has not. root makes it a root cause or a '
    + 'cause again (ADR-0032), only when a person said so: a root cause is refused while a cause explains it, and a '
    + 'cause again while a solution addresses it, and the refusal names them.',
  'person.add':
    'Add a person to the register (ADR-0036): active, with an id and a pseudonym drawn at random. Not a step — there is '
    + 'no undo and no Activity line; a mistake is put right by a person on the People page. Checks for a possible '
    + 'duplicate first, as every way in does: where somebody similar is there already the call is refused with '
    + 'agent.possibleDuplicate and the candidates in the detail — use their id, or call again with addAnyway when '
    + 'it is truly somebody else. Answers the entry as shown to agents.',
  'plan.port':
    'Move an interface of a plan onto the element it introduces, on a day (ADR-0010): a twin of the line on the new end '
    + 'valid from that day, and the original valid until the day before. Without a connectionId, every interface of '
    + 'the plan not yet planned moves on that day, as one step — and a line another plan has already closed is '
    + 'skipped and listed, never re-dated. Naming such a line is refused; plan.unport it under its own plan first. '
    + 'plan.read shows the interfaces and where each has gone.',
  'service.report':
    'One platform service, and what would be stranded if it were withdrawn (ADR-0014): who maintains it, whether it is '
    + 'shared, what realises it this year — empty is a real gap — who consumes it by application (a container\'s '
    + 'row counts for its application, said beside it) and from which scopes, and which consumers are still on it '
    + 'on the day it goes, or all of them where no day is set. A report, not a view: there is no diagram to inspect '
    + 'or render. The platform\'s side is platform.report.',
  'evaluation.propose':
    'Propose the decision the open scope\'s evaluation of a building block becomes (ADR-0043 §7), as the block\'s page '
    + 'does: a decision record, proposed, choosing one option weighed here, drafted with the context, what is '
    + 'needed here as its drivers, every option with its fit and the evaluation referred to; the principles the '
    + 'block cites are cited as supporting it. Its consequences and signers are the person\'s; accepting it '
    + '(decision.transition) marks the option chosen in the evaluation.',
  'person.leave':
    'Mark a person as left on their last day (ADR-0036 §10): the register says left, the name stays shown for the '
    + 'period the organisation\'s policy sets and is then forgotten, and everything leaving does beyond the '
    + 'register is done — `endedAssignments` says how many of their assignments ended. Not a step. Only someone '
    + 'active leaves, and not on a day further back than the policy keeps a name, which would forget it at once. '
    + 'Forgetting and removing are a person\'s, on the People page.',
  'connections.list':
    'The connections between elements: id, source, target, label, protocol, technology, the days it is valid where '
    + 'dated, and which plan dated it where a port did. An application-level interface that has landed a level down '
    + 'carries its "refinements" nested — the container lines that are part of it, each with its ends and its own '
    + 'protocol — and a container line says which interface it "refines" (ADR-0013). Filter to those ending on one '
    + 'element, or to those drawn on one diagram.',
  'role.add':
    'Add a role to the organisation\'s operating model, in its own words: a purpose, its duties — a responsibility each '
    + 'from responsibilities.list, marked R (responsible), A (accountable), C (consulted) or I (informed) — and '
    + 'whether its holder manages the people of the unit (manages), and where its holders report wherever it is '
    + 'held (reportsTo). A role is held in a unit type through that type\'s slots (unitType.update). At the '
    + 'organisation, which must be the scope open. Arguments: reportsTo — Where the holders of this role report, '
    + 'wherever the role is held: at most one line of each kind, solid (a line manager\'s, which decides who '
    + 'manages them) and dotted (functional, shown and deciding nothing). Each lands on the holders of roleId in '
    + 'the same unit where within is true, else in the nearest unit above that has the role, else in the one unit '
    + 'of the organisation that has it. The nearest place that says anything wins, kind by kind: a unit\'s own line '
    + '(reportingLine.set) over the unit type\'s slot, over the role. An empty list says nothing. A solid line that '
    + 'would close a loop is refused (reportingLine.loop), and one from a role to itself in the same unit '
    + '(reportingLine.self). reportsTo[].roleId — The role reported to, by id (roles.list). Leave it out on a slot '
    + 'to say the holders report by nesting in units of this type, whatever the role says for itself. '
    + 'reportsTo[].kind — solid: the holders of the target role manage these, in place of the nesting, and a right '
    + 'a host grants from managing follows it. dotted: functional, shown and answered, and deciding nothing. '
    + 'Default solid. reportsTo[].within — True: the holders report to that role in the same unit (a developer to '
    + 'the team\'s tech lead).',
  'blocks.list':
    'Building blocks (ADR-0043): each with the scope that keeps it, its capabilities (a must marked), its usage '
    + 'contexts with what each needs of every capability (0–4), and its catalogue of solutions; and every scope\'s '
    + 'evaluation of it — the contexts that apply there, the options weighed with their fit (0–100, the musts each '
    + 'fails), the solution chosen and the decision that chose it. With id: that block only. With scope: the blocks '
    + 'kept there and those it evaluates.',
  'person.takeBackLeaving':
    'Take back a leaving that was a mistake, when the person you act for says so: the entry is active again with no '
    + 'last day, and each assignment that leaving ended runs on as it did, by steps in Activity — '
    + '`restoredAssignments` says how many. One whose last day somebody changed since stays as it is, and one the '
    + 'leaving took away, because it only began after that day, does not come back: say so. Refused once the name '
    + 'is forgotten. The register itself is not a step.',
  'register.list':
    'Every application in the organisation, derived from the whole tree (ADR-0012 §2): the scope that answers for it '
    + '(its master), the scopes above that declare it, the scopes that draw it as a stand-in, whether it is outside '
    + 'the organisation and whose it is, and the keys of the findings about it — defined twice, a stale cache, '
    + 'unattributed. Filter by a free-text query over name, id and master. The services and platforms are '
    + 'technology.list, beside it.',
  'observation.note':
    'Say an observation has been read and wants no cause: it leaves the waiting list and stays what it is, drawn, '
    + 'searchable and a merge target — or, with takeBack, put it back on the list. Only when the person you act for '
    + 'said so: a problem nobody has explained is a cause waiting to be found, not something to tidy away. Archive '
    + 'is for what stopped being true; this is for what is true and needs nothing. Kept in its history, with the '
    + 'day and the reason.',
  'principles.suggest':
    'Which principles in force at a scope may apply to what is being written (ADR-0041 §9), best first: the words of '
    + 'text matched against each principle\'s title, statement, aspects, keywords and group names, and what other '
    + 'records about the same subject cite. Each says the words that matched and why. It is word matching, not '
    + 'understanding: read them and cite what holds. Ask before proposing a decision, recording an observation or '
    + 'changing a design.',
  'platform.report':
    'One platform, and what would be left standing if it went (ADR-0013): what is filed under it, what it stands on, '
    + 'what runs on it — the containers, each named beside its application, and the applications that have no '
    + 'containers and say where they run themselves — what uses it, and the container-level interfaces that cross '
    + 'it, each with the application-level interface it is part of. A report, not a view: there is no diagram to '
    + 'inspect or render.',
  'plan.replace':
    'Start replacing an application (ADR-0010), as one undo step: the new application in the image of the old, drawn '
    + 'beside it on every diagram the old is on; the dates on both; the successor; a dashed tap from old to new for '
    + 'the shadow run, closing the day before cutover; and a plan naming all of it with two milestones. Which '
    + 'interface moves when is not decided here — use plan.port afterwards. Answers with the plan\'s id and the new '
    + 'element\'s id.',
  'principle.update':
    'Change a principle of the open scope: its title, statement, regime, status (candidate, accepted, retired), '
    + 'rationale, implications, question, keywords, or the groups it is filed under. groups is the whole list, by '
    + 'name, so moving it to another group is naming that one: [] files it under none, and a name the scope has not '
    + 'got is made in the same step. An accepted principle\'s statement changed is sharpened, and needs note saying '
    + 'why.',
  'evaluation.add':
    'Start the open scope\'s evaluation of a building block (ADR-0043 §4), kept here or anywhere (blocks.list): the '
    + 'usage contexts that apply here, by id or name — all of the block\'s where none are given — and, with '
    + 'copyFrom, the options and ratings another scope\'s evaluation of it holds, to change from there. One '
    + 'evaluation of a block per scope. Then evaluation.rate rates the options, and evaluation.propose proposes the '
    + 'decision.',
  'diagram.tidy':
    'Lay a diagram out, as the Tidy button does: the app\'s layout engine places every card and routes every line. One '
    + 'undo step. Refuses a board over the cap. Answers with the layout report afterwards. On a sheet it is First '
    + 'layout, which is arithmetic: every block and hand-placed tile back to computed, so the poster follows the '
    + 'model again and its free items stay. With tiles true, Reset tiles: only the hand-placed tiles.',
  'image.upload':
    'Put a picture into the project for its documents to show (ADR-0009): a PNG, JPEG, SVG or WebP under two megabytes, '
    + 'as base64 or a data URL. Answers with its name and the markdown line that shows it from a description, a '
    + 'decision or a plan: `![alt](image:<name>)`. Not an undo step: the picture is in the scope\'s library beside '
    + 'the model, and a document that stops referring to it is what removes it from view.',
  'solution.decide':
    'Propose the decision record for a solution, as one step: a new record on the Decisions page, its context written '
    + 'from what the solution addresses and what else was considered, and the link. It is then taken through its '
    + 'status and signers on the Decisions page (decision.transition); adopted needs it accepted. Accepting is the '
    + 'signers\' decision: move the record to accepted only when a person says it was.',
  'aspectScale.set':
    'Give an aspect a numeric scale, or change one, for the whole organisation (ADR-0046): 1 to 5 unless said '
    + 'otherwise. Any aspect may have one: an existing column\'s key, or a new key such as maturity. Narrowing a '
    + 'scale keeps every rating; one left outside it reads as unrated until it is rated again. Kept at the '
    + 'organisation: open it first. The organisation\'s word to give: ask before changing one in use.',
  'session.start':
    'Say what you are about to do. A driving session starts by itself on the first call that moves the app or changes '
    + 'the model; this one starts it on purpose and puts your reason on the banner the person sees, which is the '
    + 'courteous way to begin. After the person pressed Stop, every driving call is refused with agent.stopped '
    + 'until this is called again — do that only when they have asked you to continue.',
  'connect':
    'Draw a connection from one element to another, dated when the line is temporary. Answers with the connection\'s '
    + 'id. A line to or from a component is a container-level line: say with "refines" which application-level '
    + 'interface it is part of, or leave it out and it is an interface of its own that roadmap.check will offer to '
    + 'draw the application line for. Arguments: certainty — assumed where nobody has checked this, confirmed where '
    + 'somebody has; a card draws dashed and a row says the word. Use it rather than writing (assumed) or ??? into '
    + 'a name or a protocol. Null: nobody has said. protocol — How: REST, AMQP, SFTP, a file drop. On the CONTAINER '
    + 'line (ADR-0013): an application-level interface with refinements shows the set they carry and keeps none of '
    + 'its own, and the first refinement to land clears it. One with no refinements keeps it. technology — What the '
    + 'interface is built out of, in a few words. On the container line, as protocol is. refines — The id of the '
    + 'application-level interface this container-level line is part of (ADR-0013). Each end must be the '
    + 'corresponding end of that line or a component filed under it — source under source, target under target — '
    + 'and that line must not itself refine one: an interface lands once. Null detaches, leaving the line an '
    + 'interface of its own. validFrom — The first day the line is there, yyyy-mm-dd (ADR-0009). Absent: it follows '
    + 'its ends. validUntil — The last day it is there, yyyy-mm-dd, inclusive. Absent: it follows its ends. color — '
    + 'The stroke, as a hex colour like #c0392b. The theme\'s own when absent.',
  'connection.update':
    'Change a connection\'s label, protocol, direction, validity, colour or line style; null clears a field. Colour a '
    + 'line by what flows over it and a busy board reads again; "solid" and an empty colour give the theme back its '
    + 'line. Arguments: certainty — assumed where nobody has checked this, confirmed where somebody has; a card '
    + 'draws dashed and a row says the word. Use it rather than writing (assumed) or ??? into a name or a protocol. '
    + 'Null: nobody has said. protocol — How: REST, AMQP, SFTP, a file drop. On the CONTAINER line (ADR-0013): an '
    + 'application-level interface with refinements shows the set they carry and keeps none of its own, and the '
    + 'first refinement to land clears it. One with no refinements keeps it. technology — What the interface is '
    + 'built out of, in a few words. On the container line, as protocol is. refines — The id of the '
    + 'application-level interface this container-level line is part of (ADR-0013). Each end must be the '
    + 'corresponding end of that line or a component filed under it — source under source, target under target — '
    + 'and that line must not itself refine one: an interface lands once. Null detaches, leaving the line an '
    + 'interface of its own. validFrom — The first day the line is there, yyyy-mm-dd (ADR-0009). Absent: it follows '
    + 'its ends. validUntil — The last day it is there, yyyy-mm-dd, inclusive. Absent: it follows its ends. color — '
    + 'The stroke, as a hex colour like #c0392b. The theme\'s own when absent.',
  'connections.update':
    'connection.update for several lines at once, as one undo step: every change lands or none does. Each item takes '
    + 'what connection.update takes. Arguments: items[].certainty — assumed where nobody has checked this, '
    + 'confirmed where somebody has; a card draws dashed and a row says the word. Use it rather than writing '
    + '(assumed) or ??? into a name or a protocol. Null: nobody has said. items[].protocol — How: REST, AMQP, SFTP, '
    + 'a file drop. On the CONTAINER line (ADR-0013): an application-level interface with refinements shows the set '
    + 'they carry and keeps none of its own, and the first refinement to land clears it. One with no refinements '
    + 'keeps it. items[].technology — What the interface is built out of, in a few words. On the container line, as '
    + 'protocol is. items[].refines — The id of the application-level interface this container-level line is part '
    + 'of (ADR-0013). Each end must be the corresponding end of that line or a component filed under it — source '
    + 'under source, target under target — and that line must not itself refine one: an interface lands once. Null '
    + 'detaches, leaving the line an interface of its own. items[].validFrom — The first day the line is there, '
    + 'yyyy-mm-dd (ADR-0009). Absent: it follows its ends. items[].validUntil — The last day it is there, '
    + 'yyyy-mm-dd, inclusive. Absent: it follows its ends. items[].color — The stroke, as a hex colour like '
    + '#c0392b. The theme\'s own when absent.',
  'relation.update':
    'Change what a relation means, what it says, or the days it holds; null clears a field. A flow\'s protocol, '
    + 'direction and look are connection.update\'s, because only a flow has them. Arguments: certainty — assumed '
    + 'where nobody has checked this, confirmed where somebody has; a card draws dashed and a row says the word. '
    + 'Use it rather than writing (assumed) or ??? into a name or a protocol. Null: nobody has said. validFrom — '
    + 'The first day it holds, yyyy-mm-dd (ADR-0009). Absent: it follows its ends. validUntil — The last day it '
    + 'holds, yyyy-mm-dd, inclusive. Absent: it follows its ends. mode — interacts only (ADR-0036 §7): how the two '
    + 'units work together — collaboration, service (one provides what the other consumes, X-as-a-Service) or '
    + 'facilitating (one helps the other learn or adopt something).',
  'decision.propose':
    'Add an architecture decision record in the proposed state, numbered after the last one in its list: the '
    + 'landscape\'s, or one application\'s. The body is MADR markdown; leave it out for the template. Name the '
    + 'plans that rest on it and they are linked in the same step. A record is about one application at most — that '
    + 'is its scope, not a list of elements. Answers with the id and the label. Arguments: signers — The people the '
    + 'decision is put to, replacing the list. Each has a name and may have a role, a verdict and the day of it. '
    + 'signers[] — One signer. A person from the register who gives a verdict keeps the name they signed with, '
    + 'beside the id: it stays after they are forgotten. Where the organisation gives agents pseudonyms, that name '
    + 'is withheld from you (signedAsWithheld, proposedAsWithheld). supersedes — The ids of accepted records this '
    + 'one replaces, replacing the list. Accepting this record moves each of them to superseded in the same step; '
    + 'rejecting it leaves them accepted. proposedBy — Who proposed it. When the only approving signer is the same '
    + 'person, accepting it answers with a warning. Once anybody has signed, the proposer\'s name is fixed beside '
    + 'the id. A person: { "person": id } or text (rules.read person). principles — Principles in force here that '
    + 'this record cites, in the same step (ADR-0041 §7); principles.suggest finds them. Adds to what it cites; '
    + 'principle.uncite takes one back. principles[].scope — The scope that keeps it ("" the organisation). '
    + 'Default: the scope open. principles[].stance — A decision: supports (default) or deviates. An observation: '
    + 'holds (default), chafes or missing.',
  'decision.update':
    'Correct a record that is still proposed or reviewing: its title, its body, its date, who it was put to, who '
    + 'proposed it, or which accepted records it supersedes. Accepted, rejected and superseded records are locked; '
    + 'a group\'s records are changed on their page. Arguments: signers — The people the decision is put to, '
    + 'replacing the list. Each has a name and may have a role, a verdict and the day of it. signers[] — One '
    + 'signer. A person from the register who gives a verdict keeps the name they signed with, beside the id: it '
    + 'stays after they are forgotten. Where the organisation gives agents pseudonyms, that name is withheld '
    + 'from you (signedAsWithheld, proposedAsWithheld). supersedes — The ids of accepted records this one replaces, '
    + 'replacing the list. Accepting this record moves each of them to superseded in the same step; rejecting it '
    + 'leaves them accepted. proposedBy — Who proposed it. When the only approving signer is the same person, '
    + 'accepting it answers with a warning. Once anybody has signed, the proposer\'s name is fixed beside the id. A '
    + 'person: { "person": id } or text (rules.read person). null clears it. principles — Principles in force here '
    + 'that this record cites, in the same step (ADR-0041 §7); principles.suggest finds them. Adds to what it '
    + 'cites; principle.uncite takes one back. principles[].scope — The scope that keeps it ("" the organisation). '
    + 'Default: the scope open. principles[].stance — A decision: supports (default) or deviates. An observation: '
    + 'holds (default), chafes or missing.',
  'observation.update':
    'Correct an observation — keeping it a fact, with any reading of it moved to a cause: its title, body, where, the '
    + 'elements it is about, who, date, impact or tone. Who recorded it stays as it was. Title, where and who may be '
    + 'corrected, never blanked. about is the whole list of the elements it is about, by id, each one this scope '
    + 'holds (agent.unknownId otherwise); an empty list takes them off. '
    + 'The count moves only through observation.seen and observation.merge; closing it is observation.archive. '
    + 'Arguments: principles — Principles in force here that this record cites, in the same step (ADR-0041 §7); '
    + 'principles.suggest finds them. Adds to what it cites; principle.uncite takes one back. principles[].scope — '
    + 'The scope that keeps it ("" the organisation). Default: the scope open. principles[].stance — A decision: '
    + 'supports (default) or deviates. An observation: holds (default), chafes or missing.',
  'unitType.add':
    'Add a kind of unit to the organisation\'s operating model, in its own word for it. It may sit at the top, under '
    + 'the organisation itself (top; true where within is not given), and under the unit types in within; slots are '
    + 'the roles a unit of it holds, each at least min and at most max. The operating model is kept at the '
    + 'organisation, which must be the scope open (app.open with scope ""). Arguments: slots[].min — At least this '
    + 'many; 0 for a role it may have and need not. slots[].max — At most this many; leave it out for no upper '
    + 'bound. slots[].reportsTo — Where the holders of this role report, in every unit of the type, in place of '
    + 'what the role says: at most one line of each kind, solid (a line manager\'s, which decides who manages them) '
    + 'and dotted (functional, shown and deciding nothing). Each lands on the holders of roleId in the same unit '
    + 'where within is true, else in the nearest unit above that has the role, else in the one unit of the '
    + 'organisation that has it. The nearest place that says anything wins, kind by kind: a unit\'s own line '
    + '(reportingLine.set) over the unit type\'s slot, over the role. An empty list says nothing. A solid line that '
    + 'would close a loop is refused (reportingLine.loop), and one from a role to itself in the same unit '
    + '(reportingLine.self). slots[].reportsTo[].roleId — The role reported to, by id (roles.list). Leave it out on '
    + 'a slot to say the holders report by nesting in units of this type, whatever the role says for itself. '
    + 'slots[].reportsTo[].kind — solid: the holders of the target role manage these, in place of the nesting, and '
    + 'a right a host grants from managing follows it. dotted: functional, shown and answered, and deciding '
    + 'nothing. Default solid. slots[].reportsTo[].within — True: the holders report to that role in the same unit '
    + '(a developer to the team\'s tech lead).',
  'unitType.update':
    'Change a unit type. Only the fields given change; within and slots replace the lists; null clears the purpose, '
    + 'top, spans, the limit and the order. A blank name is refused. At the organisation, which must be the scope '
    + 'open. Arguments: slots[].min — At least this many; 0 for a role it may have and need not. slots[].max — At '
    + 'most this many; leave it out for no upper bound. slots[].reportsTo — Where the holders of this role report, '
    + 'in every unit of the type, in place of what the role says: at most one line of each kind, solid (a line '
    + 'manager\'s, which decides who manages them) and dotted (functional, shown and deciding nothing). Each lands '
    + 'on the holders of roleId in the same unit where within is true, else in the nearest unit above that has the '
    + 'role, else in the one unit of the organisation that has it. The nearest place that says anything wins, kind '
    + 'by kind: a unit\'s own line (reportingLine.set) over the unit type\'s slot, over the role. An empty list '
    + 'says nothing. A solid line that would close a loop is refused (reportingLine.loop), and one from a role to '
    + 'itself in the same unit (reportingLine.self). slots[].reportsTo[].roleId — The role reported to, by id '
    + '(roles.list). Leave it out on a slot to say the holders report by nesting in units of this type, whatever '
    + 'the role says for itself. slots[].reportsTo[].kind — solid: the holders of the target role manage these, in '
    + 'place of the nesting, and a right a host grants from managing follows it. dotted: functional, shown and '
    + 'answered, and deciding nothing. Default solid. slots[].reportsTo[].within — True: the holders report to that '
    + 'role in the same unit (a developer to the team\'s tech lead).',
  'role.remove':
    'Remove a role from the operating model. Refused agent.inUse, naming each use, while a unit type has a slot for it '
    + 'or a slot whose holders report to it, another role reports to it or names it as a successor, a rule names it, '
    + 'a unit in any scope has a slot or a reporting line of its own with it, or an assignment in any scope names it '
    + '— ended ones too, since they say who held it. Change each first; nothing is taken along but the role\'s own '
    + 'duties, answered as partsRemoved. Where people held it, until on role.update is usually what is meant. Refused '
    + 'agent.notAllRead where not every scope was read. Ask the person before removing.',
  'unitType.remove':
    'Remove a unit type from the operating model. Refused agent.inUse, naming each use, while a unit in any scope or a '
    + 'scope is one, another type may sit in it, or another type names it as a successor. Change each first; nothing '
    + 'is taken along but the type\'s own slots. Where units were one, until on unitType.update is usually what is '
    + 'meant. Refused agent.notAllRead where not every scope was read. Ask the person before removing.',
  'responsibility.remove':
    'Remove a responsibility. Every role\'s part in it goes with it in the same step, as it does on the page, and the '
    + 'answer lists them (partsRemoved): say them to the person, and ask first where somebody is accountable.',
  'raci.set':
    'Set cells of the RACI: each names a role, a responsibility and the letter, null to take the role\'s part away. At '
    + 'most 500 in a call, one step and one undo; a cell not named stays as it is, where duties on role.update '
    + 'replaces a role\'s whole list. Every id that is not there is named before anything is written, and a cell '
    + 'given twice is refused. A responsibility not exactly one role\'s A is a finding, answered in findings, never a '
    + 'refusal. Write the letters a source or the person gives, not a guess. A role or a responsibility made by an '
    + 'earlier step of a batch is named with its reference.',
  'role.update':
    'Change a role. Only the fields given change; duties and reportsTo replace their lists; null clears the short name, '
    + 'the purpose, manages, the order and reportsTo. A blank name is refused. At the organisation, which must be the scope '
    + 'open. Arguments: reportsTo — Where the holders of this role report, wherever the role is held: at most one '
    + 'line of each kind, solid (a line manager\'s, which decides who manages them) and dotted (functional, shown '
    + 'and deciding nothing). Each lands on the holders of roleId in the same unit where within is true, else in '
    + 'the nearest unit above that has the role, else in the one unit of the organisation that has it. The nearest '
    + 'place that says anything wins, kind by kind: a unit\'s own line (reportingLine.set) over the unit type\'s '
    + 'slot, over the role. An empty list says nothing. A solid line that would close a loop is refused '
    + '(reportingLine.loop), and one from a role to itself in the same unit (reportingLine.self). '
    + 'reportsTo[].roleId — The role reported to, by id (roles.list). Leave it out on a slot to say the holders '
    + 'report by nesting in units of this type, whatever the role says for itself. reportsTo[].kind — solid: the '
    + 'holders of the target role manage these, in place of the nesting, and a right a host grants from managing '
    + 'follows it. dotted: functional, shown and answered, and deciding nothing. Default solid. reportsTo[].within '
    + '— True: the holders report to that role in the same unit (a developer to the team\'s tech lead).',
  'plan.create':
    'Add a plan that is not a replacement (ADR-0009): a migration, a platform move, an upgrade. Numbered after the last '
    + 'one, and always a draft: plan.update moves it on. Name the elements it touches by role and the decisions it '
    + 'rests on; the body is markdown and starts from the template — headings and a ```business-case fence — when '
    + 'left out. Answers with the id and the label. Arguments: initiative — An initiative the organisation follows '
    + '(ADR-0012 §7): shown on the roadmap of every scope above this one, read there and edited here. False takes '
    + 'it off them.',
}

/** Every rule there is, keyed by topic or by tool: the one table. */
export const RULES: Readonly<Record<string, Rule>> = {
  ...TOPICS,
  ...Object.fromEntries(Object.entries(TOOL_RULES).map(([tool, text]) => [tool, { about: `The tool ${tool}.`, text: text! }])),
}

/** Whether a tool has rules here: its description then ends `(rules.read)`. */
export function hasRules(tool: string): boolean {
  return tool in TOOL_RULES
}

/** `rules.read`: one topic's or one tool's rules, or with nothing asked, what there is to ask. */
export function readRules(rawArgs: unknown): AgentAnswer {
  const wrong = checkArguments(toolSpec('rules.read').inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const about = (rawArgs as { about?: string } | undefined)?.about
  if (about === undefined) {
    return json({
      topics: RULE_TOPICS.map((topic) => ({ about: topic, is: TOPICS[topic].about })),
      tools: Object.keys(TOOL_RULES),
    })
  }
  const rule = RULES[about]
  if (!rule) return refused('agent.unknownId', `no rules about ${about}: rules.read without about lists what there is`)
  return json({ about, text: rule.text })
}
