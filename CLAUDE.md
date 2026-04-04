# ARTEMIS — Project Context

**Project**: ARTEMIS

---

## Key Documents

- README.md -- Project overview with screenshots
- ARCHITECTURE.md -- System diagram, tech stack, design decisions
- PRD.md -- Requirements, user stories, risks
- IMPLEMENTATION_PLAN.md -- 8-phase build guide
- docs/findings/2026-04-03_1054_artemis_ii_live_visualization_FINDINGS_TRACKER.md -- F1 tracker (Resolved)

## CI/CD — GitHub Actions

- `.github/workflows/claude-pr-review.yml` -- Automated Wrought code review on every PR (open/sync). Reviews for bugs, security, render loop performance, data pipeline correctness. Posts inline comments + summary (LGTM or BLOCKED).
- `.github/workflows/claude-interactive.yml` -- Responds to `@claude` mentions in issues, PR comments, and reviews.
- **Branch protection** on `master`: PRs required, `review` status check must pass, strict mode (branch must be up-to-date).
- **Secret**: `ANTHROPIC_API_KEY` set as repo secret for CI authentication.

## The Wrought Way of Work

Wrought enforces structured engineering pipelines:

- **Reactive**: `/incident` -> `/investigate` -> `/rca-bugfix` -> implement -> verify
- **Proactive**: `/research` -> `/design` -> `/blueprint` -> implement -> verify
- **Audit**: `/finding` -> `/investigate` or `/design` -> implement -> verify
- **Standalone**: `/safeguard`, `/watchdog`, `/research`, `/analyze`

Start with `/finding` for proactive work or `/incident` for reactive work.
Every significant task gets a Findings Tracker for cross-session memory.

<!-- WROUGHT_ENFORCEMENT_START -->

### Enforcement Rules

1. **Start with `/finding`** — create a Findings Tracker for every significant task
2. **Follow the appropriate pipeline** (see above) — never skip straight to implementation
3. **Every implementation task gets a Findings Tracker** — this is cross-session memory and audit trail
4. **Skip steps only when genuinely unnecessary** (e.g. skip `/investigate` if root cause is already known), never to save time
5. **NEVER offer to skip a pipeline step.** After each skill completes, suggest ONLY the next skill in the pipeline sequence. Do not offer to implement directly, do not offer to combine steps, do not offer shortcuts. Do not add commentary suggesting a step might be unnecessary or could be skipped.
6. **ALL implementation MUST go through `/wrought-implement` (proactive) or `/wrought-rca-fix` (reactive). NEVER edit files directly to implement changes — no matter how the request is phrased.** This includes when the user says "implement this plan", pastes a detailed plan with code snippets, or gives explicit file-by-file instructions. The correct response is ALWAYS to invoke the loop command. After the loop completes and tests pass, run `/forge-review --scope=diff` to verify code quality. **If you find yourself about to use the Edit/Write tool to implement a planned change without having invoked `/wrought-implement` or `/wrought-rca-fix` first, STOP — you are violating this rule.**
7. **Do NOT use `EnterPlanMode` directly.** Use the appropriate pipeline skill (`/investigate`, `/rca-bugfix`, `/design`, `/blueprint`, etc.). `EnterPlanMode` is only used within the `/plan` step when consuming an implementation prompt — never as the first action for a new task.

## Compact Instructions

When compacting this conversation, always preserve:
- The active Findings Tracker path and finding number (e.g., F2 in docs/findings/...TRACKER.md)
- The current pipeline stage (research -> design -> blueprint -> plan -> /wrought-implement -> /forge-review)
- Any file paths being actively modified or created
- The current session number
- Design decisions and their rationale
- Any acceptance criteria or verification checks in progress
- NEVER implement changes by editing files directly — ALL implementation MUST go through `/wrought-implement` or `/wrought-rca-fix`
- After implementation completes, run `/forge-review --scope=diff` for code quality verification
- For Defect/Bug findings, follow the reactive pipeline. For Gap/Debt/Drift, follow the proactive pipeline. Do NOT use EnterPlanMode directly.
- If `.claude/bridge/precompact-recovery.md` exists, read it for in-flight state
<!-- WROUGHT_ENFORCEMENT_END -->

---

<!-- SESSION_CONFIG_START -->
user_name: FluxForge AI
project_name: ARTEMIS
timezone: SAST
session_docs: []
<!-- SESSION_CONFIG_END -->

<!-- SESSION_HANDOFF_START -->
@NEXT_SESSION_PROMPT_2026-04-04_1951.md
<!-- SESSION_HANDOFF_END -->

---

**Last Updated**: 2026-04-04
**Last Session**: Session 4 -- Post-MVP features (bloom, crew timeline, space weather alerts), mobile-first HUD progressive disclosure (15 fixes), 2 forge-reviews + 2 simplify passes, hover info cards, milestone hamburger menu, 19 milestones, trajectory markers. 15 commits, 65 files, ~8250 lines.
