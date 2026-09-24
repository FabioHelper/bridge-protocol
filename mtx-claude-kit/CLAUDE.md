# MTX Remake: Claude project rules

## Source of truth

1. `docs/handoff/MTX-CLAUDE-HANDOFF.md` and its three companion docs in `docs/handoff/`
   define scope, slice order, quality bar, performance budget, verification and stopping
   rules. **They win over this file** if the two ever disagree.
2. This file only adds the **model routing** that keeps the MVP inside our budget.

Goal: the best possible MVP remake within a fixed budget. Scope comes from the handoff.
Don't add features, polish passes or refactors the current slice doesn't ask for.

## Model roles

| Role | Model | Does | Never does |
| --- | --- | --- | --- |
| Director / architect | Opus 5.5 (main chat) | Reads the handoff, decides design, writes the **slice card**, reviews the diff, commits | Bulk file-by-file implementation |
| Builder | Sonnet 5 (`slice-builder` agent) | Implements exactly one slice card | Design decisions or scope changes. When the card doesn't cover something, it stops and reports |
| Verifier | Haiku 4.5 (`verifier` agent) | Runs the card's verification commands and reports pass/fail with the output | Editing code |

Relative token price: Opus 5.5 = 1.0, Sonnet 5 = 0.5, Haiku 4.5 = 0.25.
Fable models are **not** used on this project.

## Slice loop

1. **Plan (Opus).** Find the first incomplete slice in the handoff. Inspect only the code
   that slice touches. Write `docs/slices/NN-<name>.md` from `docs/slices/_TEMPLATE.md`.
   The card must be executable without judgment calls: exact files, exact behavior, exact
   numbers, exact verification commands, and an explicit list of what is out of scope.
2. **Build (Sonnet).** Hand the card path to the `slice-builder` agent. Don't paste the
   handoff into the prompt, because the card is the whole brief.
3. **Verify (Haiku).** Run the `verifier` agent with the card path.
4. **Review (Opus).** Read `git diff` against the card's acceptance criteria and the
   handoff's quality rules. Small fixes you make yourself. For a real miss, amend the card
   and send it back to the builder, at most **2 rounds**. After that, stop and report.
5. **Close.** Tick the slice's status in the card, add a line to `docs/slices/LEDGER.md`,
   commit, push. **Stop after one slice** unless the user says to continue.

Cheapest mode: an Opus chat writes several cards and stops. Each card then runs in a
fresh **Sonnet 5** chat with the prompt "Execute docs/slices/NN-<name>.md". The Sonnet
chat follows steps 2–5 itself and doesn't make design calls. When a card is ambiguous,
it writes `BLOCKED: <question>` in the card and stops.

## Stop conditions (in addition to the handoff's)

- The card is ambiguous, or it contradicts the handoff.
- Verification fails after 2 build rounds.
- The slice needs a new dependency, an asset or a design decision the card doesn't name.
- A performance budget from the handoff is exceeded.

When you stop, write what you know, what is blocked and the exact question into the card.
Then commit and end the turn.

## Hygiene

- Commit per slice with the message `slice NN: <name>`. Never commit build output,
  `node_modules`, or files over 50 MB.
- Keep context small: read files by path, don't paste whole docs into prompts, and don't
  re-read the handoff if the card already covers it.
