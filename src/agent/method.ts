// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The method behind the observations, said once for an agent (ADR-0021,
 * ADR-0026). The tools say what each call does; this says what each record is
 * *for*, which is the thing a model gets wrong when it is only told the calls:
 * it writes its reading of a problem into the observation, proposes a fix for
 * a symptom, and answers a gate from its own judgement.
 *
 * Handed over on connect by every host — the desktop's paragraph and a hosted
 * environment's both end with it — so it lives here, with no word about a
 * screen in it.
 */
export const OBSERVATIONS_METHOD =
  'Observations, causes, solutions and experiments are a method, and the tools keep to it. '
  + 'An observation (observation.record) is a fact: what was seen, where, when, by whom and the evidence, '
  + 'in neutral words — no explanation, no opinion, no blame and no fix. The same thing seen again is '
  + 'observation.seen, not a new record; one written down twice is merged. '
  + 'Why it happens is a cause (cause.add): the team\'s analysis goes there, assumed until a person has '
  + 'checked it. Ask why again — a deeper cause explains a shallower one (cause.link) — until you reach a '
  + 'root cause, one nothing else explains. '
  + 'What to do about it is a solution (solution.propose), and a solution addresses root causes only. '
  + 'Propose the alternatives too and drop the ones not pursued, with the reason, rather than removing them. '
  + 'A solution is an idea until its gates are answered from what people said — benefit, cost, who it was '
  + 'checked with, earlier attempts — then it is tested by an experiment whose hypothesis could turn out '
  + 'wrong (experiment.plan) before it is proven; people decide it (solution.decide proposes the decision '
  + 'record, its signers accept it) before a plan builds it (solution.plan). When that plan is done, the '
  + 'observations under it should stop being seen: a sighting after that is flagged against the solution, '
  + 'and one that has stopped is archived with a note. '
  + 'When a person describes a problem in one breath, split it — the facts into observations, their '
  + 'explanations into causes, their ideas into solutions — and tell them which went where. Never answer a '
  + 'gate, verify a cause, conclude an experiment or accept a decision on your own judgement: those are the '
  + 'team\'s to say, so ask.'
