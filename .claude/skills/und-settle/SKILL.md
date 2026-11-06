---
name: und-settle
description: Settle an Undecided point (UND-NNN) in the CAMAP Haxe→TS migration specs (task/refacto-hx-ts/specs). Use when the user says "settle UND-NNN: <decision>", "accept suggestion", "keep current behaviour", or asks to investigate an UND point before deciding.
model: sonnet
---

# Settle an UND point

Specs live in `task/refacto-hx-ts/specs/`. Args: `UND-NNN` plus the decision (free text, "accept suggestion", or "keep current behaviour"). Date = today (YYYY-MM-DD).

If the user asks to **investigate** first: spawn the agent they name (count + model; ask if not stated), read-only, citing `path:line`. Log findings to the plan file, report, and stop — do not settle until they decide.

## 1. Gather
```bash
cd task/refacto-hx-ts/specs
awk '/\*\*UND-NNN\*\*/,/Suggestion\*\*/' UNDECIDED.md      # entry: statements, behavior, options, suggestion
grep -n "UND-NNN" UNDECIDED.md UNDECIDED-suggestions.fr.md README.md
grep -rn -A4 "UND-NNN" 0*/                                  # statements + their SUGGESTION/ERRATUM
```
Also grep for related statements **without** the marker (same CODE-NNN, same feature keywords, sibling statements in the same file) — a decision often changes them too (e.g. UND-118 touched ACC-PRO-006, COM-EML-010).

Back up first: `cp -r . /tmp/camap-erratum/specs-before-und<NNN>`

## 2. Rewrite spec statements (`0*/…md`)
For every statement marked `*Undecided (UND-NNN)*`:
- Remove the marker; rewrite the statement as an affirmative user-POV sentence describing the **decided** behavior. Keep the `<!-- … -->` source comment.
- Replace the `**SUGGESTION**` sub-bullet with detail sub-bullets (short sentences) and finish with:
  `  - **DECISION (UND-NNN, <date>)** <decision in one sentence>.`
- "Currently …" lines describing today's code:
  - decision **changes** behavior → turn into `**ERRATUM** Today <current behavior>. Source: \`path:line\` (CODE-NNN if known).`
  - decision **keeps** behavior → existing ERRATUM on it is no longer an erratum: rewrite as a plain sub-bullet ("This is intended: see <ID>.").
- Related unmarked statements: rewrite their text to match; add the DECISION line if their meaning changed.

## 3. UNDECIDED.md
- Title: append ` — **DECIDED**`.
- After the `**Suggestion**` line add: `  - **Decision** (<date>): <decision; mention option letter, e.g. "Suggestion accepted (option a)." or "Keep the current behaviour (option b).">`
- If extra statements were changed, add them to the `**Statements**` line.
- Summary table row (end of file): replace the suggestion with `**Decided:** <standalone sentence>.` Keep the row in place (don't reorder).

## 4. UNDECIDED-suggestions.fr.md
Same row: replace the Suggestion cell with `**Décidé :** <phrase en français>.` Keep the Contexte cell. Vocabulary: contrat AMAP classique, adhésion, coordinateur, panier, bénévoles, feuille d'émargement, cagnotte.

## 5. Impacts
If the decision constrains another open UND point: add `  - **Impact of UND-NNN**: …` to that entry in UNDECIDED.md, `  - **IMPACT OF UND-NNN** …` under its statements, and a parenthetical "(Since UND-NNN is decided, …)" to both summary rows. **Never close the dependent point** — tell the user and let them confirm.

## 6. README + log
- `README.md` → "## Decisions" → "Decided so far:" list, kept in ID order: `- UND-NNN (<date>): <short decision>.`
- Append to `~/.claude/plans/this-project-is-going-temporal-phoenix.md`:
  `=== UND-NNN DECIDED (<date>): <decision>. Updated <IDs>, UNDECIDED.md, FR, README. Backup /tmp/camap-erratum/specs-before-und<NNN>`

Prefer one Python heredoc doing exact `str.replace` on each file (assert each old string is found) over many Edit calls. When matching by regex and splicing (`s[:m.start()]+b+s[m.end():]`), `b` is literal: never put `\1` backrefs in it — build it from `m.group(1)` instead.

## 7. Verify and report
```bash
grep -rn "Undecided (UND-NNN)" .            # must be empty
grep -rn "UND-NNN" . | cut -c1-160          # spec DECISION, entry DECIDED, both table rows, README
grep -c "Décidé" UNDECIDED-suggestions.fr.md
```
Report briefly: statements rewritten (old → new), files touched, impacts on other UND points, any related issues spotted but not settled (offer to add as new UND points). No commits.
