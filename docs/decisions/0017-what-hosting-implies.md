# ADR-0017 — What hosting implies, and technology from the register

* Status: accepted
* Date: 2026-09-17
* Deciders: Wouter Simons
* Amends: ADR-0014 §5 (one thing per question, and the rest computed)

## Context and Problem Statement

ADR-0014 gave an application one sentence per question: *hosted on* a
platform is where a container runs, *uses* a service is what it consumes,
and what it depends on is derived through the services it uses and what
realises them. Two things stood in the way of writing either sentence from
a landscape about a platform another scope defines.

**The pickers only knew this scope.** *Hosted on* offered the platforms
the landscape held — definitions and stand-ins — and nothing else, and the
library beside the palette (*Existing application…*) listed applications
only. So a container could not be hosted on Azure Cloud until somebody had
drawn Azure Cloud on the landscape's board by hand, which nobody did, and
the platform scope's landscape stayed empty of consumers.

**Hosting said nothing about the service.** A container hosted on Azure
Cloud, which realises *Cloud service*, leverages the cloud service by any
reading — and the model read nothing, because leverage was derived through
`uses` alone. The one sentence a team does write, *it runs on Azure*, left
the offering it stands on invisible in the record, the landscape and the
service report's count of who leans on it.

## Decision Drivers

* The team writes the sentence it knows. A container's team knows where
  it runs; it rarely writes what offering that amounts to.
* One fact, once. The service a hosting implies must be derived, never
  written a second time — and never silently written *for* the team.
* A record another scope defines arrives as a stand-in, as it does
  everywhere else (ADR-0012 §3), in the same step as the fact that names
  it, so there is one undo and nothing half done.

## Decision Outcome

### 1. What hosting implies is leveraged

`impliedServicesOf` in `model/leverage.ts`: the services realised by the
platforms an application is hosted on, or by anything above them in the
platform tree, less what the application says it uses itself. `leverageOf`
answers them beside the used ones, marked `implied`, with the platforms
behind each narrowed as ADR-0015 §3 narrows. The record's *Leverages*
line says *(implied by hosting)* after such a service. Nothing is stored:
a `uses` row written later is the same fact said out loud, and the implied
entry goes.

### 2. The landscape draws and counts it

The technology landscape (ADR-0015) carries `implied` on every
application beside `uses`. An implied use is drawn as a dotted line to the
service with the band open — with the band hidden the hosting itself is
the line — and it counts as a consumer on the service's card and in the
record on the right, noted as implied. The agent's `diagram.inspect`
reports it the same way.

### 3. The pickers know the organisation

*Hosted on* lists, under *Elsewhere in the organisation*, every platform
another scope answers for and this one does not hold, places first, each
with the scope it comes from. Choosing one writes the stand-in and the
`hostedOn` row as one step (`setHostedOn` takes the stand-in the host
hands it through the ownership seam's `technology`). The library beside
the palette lists every platform and service the tree defines after the
applications, each with its kind; a platform or a service drawn from it
lands in the management band without the band question, because it has
only the one.

### 4. What stays exactly as it is

`uses` a platform directly; the platform team's `realises`; the service
report's consumers, which still count the rows written — an implied
consumer is on the landscape and on the record, and the report's count of
who *said* they lean on it is a different question, left as it is until
somebody needs the other.

## Consequences

* `Leverage.services[].implied`, `impliedServicesOf`, and `implied` on the
  landscape's applications and edges; `LibraryRow.kind`;
  `EditorOwnership.technology`; a third argument on `setHostedOn`.
* A landscape whose containers are hosted on a shared cloud shows the
  cloud service as leveraged without anybody writing a `uses` row, and the
  platform scope's landscape shows those containers' applications as
  consumers.
* Open: whether the service report should count implied consumers, and
  whether *Uses* should get the same *Elsewhere* list the moment a service
  is chosen from a picker rather than drawn as a line.
