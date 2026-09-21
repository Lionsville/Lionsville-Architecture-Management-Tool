# Release notes, next version — draft

*What has landed on `main` since 2.3.0 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**The app is called Lionsville Architect.** The window, the menus, the About box and the installers all say the new name. Nothing else changed: your folders, your files and your settings are where they were, and this version opens them exactly as the last one did.

**Observations, and what lies behind them.** *Observations* on the bar, and a card on every scope's home, opens a register of what the team saw — numbered, dated, where, how much it matters, how often it has been seen — with the record beside it. *Seen again* counts one more and writes the day into the record's history. Two observations that turn out to be the same are merged, with the sightings and the history kept on both records. An observation is local unless you share it; shared, every scope above reads it, may link it to a cause of its own and may merge it into one of its own — changed where it lives, as every record is.

**Analysed, as a team, into causes.** *Link to a cause…* names what lies behind an observation, existing or new, with the strength of the relationship; *Link to a deeper cause…* does the same one level further. A cause starts assumed and is marked verified once checked; a cause nobody explains is a root cause, and stops being one the moment a deeper cause is linked. The *Analysis* tab draws it: observations on the left as circles sized by impact and tinted by how often they were seen, causes in lanes, root causes on the right, and the weight of each line the strength of the link. The seam between the register or the picture and the reading pane is dragged to give either more room.

**Closed, not deleted.** An observation that was fixed, addressed or has stopped mattering is *archived*, with the day and a note on why in its history; it leaves the analysis — not drawn, not queued, not offered upward — and stays in the register under *Show archived* until *Restore* brings it back. Every observation also says who saw it, as free text.

**For an agent:** `observations.list`, `observation.read`, `causes.list`, `cause.read`; `observation.record`, `observation.update`, `observation.seen`, `observation.archive`, `observation.merge`, `observation.remove`, `cause.add`, `cause.update`, `cause.link`, `cause.unlink`, `cause.remove`; `app.open` takes `observations`.

**Since 2.4.0-beta.1:** the causes are read back from the folder — the beta wrote `observations/causes/` on every save and never read it, so an analysis was lost when the scope was reopened. The files were never removed: open the folder with this version and the causes are back.

**In a browser, with nothing installed.** [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/) runs the newest release — this one, from now on — as a page: your work stays in that browser, or in a folder it opens for you in Chrome and Edge, and nothing is sent anywhere. Every release also carries `web-<version>.zip`, the same build, for hosting it yourself.

**On disk:** `observations/NNNN-<slug>.md` and `observations/causes/NNNN-<slug>.md` beside the decisions and the plans, and the folder format is 7. A folder written by 2.3.0 opens as it is; a folder written by this version keeps its observations, which 2.3.0 would not read.

The reasoning is ADR-0021 in `docs/decisions/`.
