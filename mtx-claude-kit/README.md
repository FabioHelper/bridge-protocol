# MTX Claude kit

A drop-in setup for the MTX remake repo. Opus 5.5 plans and reviews, Sonnet 5 builds,
Haiku 4.5 verifies. Copy everything in this folder, including the hidden `.claude/`, into
the root of the MTX project.

```
CLAUDE.md                      model routing + slice loop (handoff docs stay authoritative)
.claude/agents/slice-builder.md  Sonnet 5 builder subagent
.claude/agents/verifier.md       Haiku 4.5 verifier subagent (read-only)
.claude/settings.json          pre-approved git/npm commands (fewer permission prompts)
docs/slices/_TEMPLATE.md       the slice card format a cheaper model can execute
docs/slices/LEDGER.md          per-slice spend log
```

## Cost model

API list prices per million tokens. On a subscription plan these ratios are the best
proxy for how fast each model uses up your limits.

| Model | Input | Output | Relative | Role here |
| --- | --- | --- | --- | --- |
| Fable 5.1 | $10 | $50 | 2.5× | not used (needs usage credits) |
| **Opus 5.5** | $4 | $20 | 1.0× | director: plan, review, commit |
| **Sonnet 5** | $2 | $10 | 0.5× | builder |
| **Haiku 4.5** | $1 | $5 | 0.25× | verifier |

Most tokens in an agentic coding session come from the many turns of reading and
editing files. Moving that loop to Sonnet halves its cost, and verification on Haiku
costs a quarter. Opus only spends on the short, high-value parts: design, the card and
the diff review. The saving holds only while cards are precise. A vague card makes
Sonnet retry, and a retry costs more than Opus would have spent getting it right. So
the builder stops and asks instead of guessing.

## Two ways to run a slice

- **A: one chat per slice (default).** Select Opus 5.5 and send "Run the next slice per
  CLAUDE.md." Opus writes the card, delegates the build to Sonnet and the checks to
  Haiku, reviews the diff, commits and stops.
- **B: cheapest.** In an Opus 5.5 chat, send "Write cards for the next 3 slices, then
  stop." Then, for each card, open a new chat with **Sonnet 5** selected and send
  "Execute docs/slices/NN-<name>.md per CLAUDE.md." Go back to Opus only when a card
  comes back BLOCKED.

Start a new chat for each slice either way, so no session drags old context along.
