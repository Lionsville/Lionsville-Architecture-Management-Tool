// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The method behind the observations, said once for an agent (ADR-0021,
 * ADR-0026, ADR-0032). The tools say what each call does; this says what each
 * record is *for*, which is the thing a model gets wrong when it is only told
 * the calls: it writes its reading of a problem into the observation, proposes
 * a fix for a symptom, declares a root cause because nothing deeper came to
 * mind, and answers a gate from its own judgement.
 *
 * Handed over on connect by every host — the desktop's paragraph and a hosted
 * environment's both end with it — so it lives here, with no word about a
 * screen in it.
 */
export const OBSERVATIONS_METHOD =
  'Observations, causes, solutions and experiments are a method, and the tools keep to it. '
  + 'An observation (observation.record) is a fact: what was seen, where, when, by whom and the evidence, '
  + 'in neutral words — no explanation, no opinion, no blame and no fix. Where and by whom are required: ask '
  + 'rather than guess. The same thing seen again is observation.seen, not a new record; one written down '
  + 'twice, or by several people, is merged (observation.merge), and two causes that say the same thing are '
  + 'merged too (cause.merge): one survivor keeps standing with the best of the values, the others stay as '
  + 'history, and every link moves where the tree allows it. merge.plan says what a merge would do — which '
  + 'links move, which stay and why — before anything is written. A merge may take records of any scope, '
  + 'above, below or beside; it writes each where it lives, all or none, and where only the scope open can be '
  + 'written it is refused. '
  + 'Why it happens is a cause (cause.add): the team\'s analysis goes there, assumed until a person has '
  + 'checked it. Ask why again — a deeper cause explains a shallower one (cause.link) — until the team says '
  + 'which cause is the root cause (RC-): where the chain ends, and nothing explains it any more. A root cause '
  + 'is said by a person, never inferred: a cause nothing explains yet is an open end, not a root. Never make '
  + 'a cause a root cause, or a root cause a cause again, on your own judgement, any more than you would '
  + 'verify one — ask. '
  + 'Local and global are places, not a permission: every scope\'s observations, causes, solutions and '
  + 'experiments are its own, and a scope reads those of every scope below it (observations.list with below). '
  + 'Nothing is shared, and a record is changed in the scope it lives in. A cause may explain a cause of a '
  + 'scope below; the scope below explains its own observations. '
  + 'What to do about it is a solution (solution.propose), and a solution addresses root causes only. '
  + 'Propose the alternatives too and drop the ones not pursued, with the reason, rather than removing them. '
  + 'A solution is an idea until its gates are answered from what people said — benefit, cost, who it was '
  + 'checked with, earlier attempts — then it is tested by an experiment whose hypothesis could turn out '
  + 'wrong (experiment.plan) before it is proven; people decide it (solution.decide proposes the decision '
  + 'record, its signers accept it) before a plan builds it (solution.plan). When that plan is done, the '
  + 'observations under it should stop being seen: a sighting after that is flagged against the solution, '
  + 'and one that has stopped is archived with a note. '
  + 'What works is observed too: an observation with bright true is a bright spot, analysed the same way — its '
  + 'causes are what make it work, and a solution on its root cause spreads it, with the same gates and '
  + 'experiment; a bright spot and a problem are never merged, and observations.list takes tone. '
  + 'An observation recorded in the wrong scope moves (observation.move), and a move cuts every link that '
  + 'explains it, since a cause explains observations of its own scope only: move.plan says which first. '
  + 'A comment (comment.add) is about a record and never changes it: a question, a doubt or a pointer to '
  + 'more evidence goes there, and what the record should say is changed in the record. '
  + 'When a person describes a problem in one breath, split it — the facts into observations, their '
  + 'explanations into causes, their ideas into solutions — and tell them which went where. Never answer a '
  + 'gate, verify a cause, say a root cause, conclude an experiment or accept a decision on your own judgement: '
  + 'those are the team\'s to say, so ask.'

/**
 * How the organisation's structure is kept, said once for an agent (ADR-0036,
 * ADR-0039, amended 17 October 2026). The operating model says where a role
 * sits and whom it reports to, and an agent asked to place someone or to say
 * who manages them reaches for the exception as readily as for the rule
 * unless it is told which is which. Handed over on connect beside
 * {@link OBSERVATIONS_METHOD} by every host, with no word about a screen in it.
 */
export const STRUCTURE_DEFAULTS =
  'The organisation\'s structure keeps to its operating model, and so do you. Every structure relationship is read and written '
  + 'by a tool: a unit\'s parent, type, served domains and extra slots (elements.list, element.describe, element.update), a unit '
  + 'type\'s place and slots and a slot\'s line (unitTypes.list, unitType.update), a role\'s line and whether it manages '
  + '(roles.list, role.update), a unit\'s own line and a holder\'s own (reportingLines.list, reportingLine.set, '
  + 'assignment.update), who holds which role (assignments.list, assignment.add, assignment.update, assignment.end), how two '
  + 'units interact (connections.list, relation.add) and a plan\'s moves of a unit (plans.list, plan.move). '
  + 'Keep to the model\'s defaults: place people in the roles their unit\'s slots give, and let reporting lines follow the '
  + 'role\'s and the unit type\'s lines and nesting. Three things are exceptions to the model — a unit\'s own line '
  + '(reportingLine.set), a holder\'s own line (reportsTo on assignment.add or assignment.update) and a role held outside the '
  + 'unit\'s slots — and you write one only when the person you act for explicitly asks for that exception, never because it '
  + 'is quicker; say in your answer that it is one. Where the model says something that is not true for many people, the '
  + 'model is what to change (role.update, unitType.update), and that is the person\'s decision: ask.'

/**
 * How the tree of scopes is kept, said once for an agent (ADR-0040 §1, §2).
 * The four tools say what each call does; this says the one thing a model
 * gets wrong when it is only told the calls: that removing a scope with work
 * in it is the person's decision and not a refusal to argue past. Handed
 * over on connect by every host, with no word about a screen in it.
 */
export const TREE_TOOLS_PARAGRAPH =
  'The tree of scopes is kept with four tools about the tree rather than the scope open, each naming its scope by path: '
  + 'scope.create makes one under a parent, scope.update renames and describes one, scope.move files one elsewhere and '
  + 'scope.remove removes one. A removal is one scope per call and never one with scopes under it: remove those first, '
  + 'deepest first. A scope that holds work is refused until you have told the person what is in it and they have said, '
  + 'in their own words, that it is to go with all of it; pass those words in personSaid — never your own, never on your '
  + 'own judgement, and never because a call was refused. A host that keeps the scope open in a workspace to that '
  + 'workspace says scope.isOpen: open the home of the scope, or of the one above it, and call again.'

/**
 * How the organisation's business sheet is mapped to the tree, said once for
 * an agent (ADR-0040 §4–§7). Three links join a function of the sheet to the
 * scopes, each written by a different tool in a different scope, and an
 * agent that is not told which is which writes the one it found first.
 * Handed over on connect beside {@link STRUCTURE_DEFAULTS} by every host.
 */
export const SHEET_MAPPING_PARAGRAPH =
  'A function of a business sheet — an area, a grouping or a capability — is joined to the tree three ways, and they are told '
  + 'apart. Who answers for it is a unit: relation.add with type assigned from the unit to the function, in the scope that defines '
  + 'the function. Which domain it is handed to is the organisation\'s intent, top-down: element.update scopes on the definition, '
  + 'in the scope that defines it, naming scopes below that one. Which domain took it up is the domain\'s own statement, '
  + 'bottom-up: function.claim in the domain\'s scope, a stand-in of the function on its sheet, under which the domain files its '
  + 'own capabilities. element.describe of a function says its domains and claimedBy; a function nobody handed on and no domain '
  + 'took up is not yet mapped (checks.list). Handing on and taking up are two statements by two scopes: neither writes the other.'
