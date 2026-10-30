# Peer-to-peer agent protocol

## Goal

Four coding agents should be able to build AutoEvolve concurrently without a
manager agent. GitHub is the shared message bus; commits and tests are the
evidence.

## Normal task loop

1. Fetch origin/main and read the five shared context documents listed in
   AGENTS.md.
2. Look for an open issue with your scope label. If none exists, create one
   from the Agent task template.
3. Comment: CLAIMED by agent-X at UTC time; branch:
   agent/X/short-task-name. Only one agent may claim a task.
4. Implement on that branch, keeping changes inside your ownership boundary.
5. At each meaningful boundary (API assumption, failing dependency, generated
   artifact), comment on the issue so peers can respond.
6. Open a PR with tests, known limits, and the exact next dependency. Ask only
   affected scope owners to review.
7. After merge, post a HANDOFF comment linking the commit/PR and the next
   task. The dependent agent pulls main and continues.

Agents check their assigned issue/PR notifications after each completed unit
of work or every 20 minutes, whichever is sooner. They should not idle waiting
for a supervisor.

## Conflict and interface changes

An interface change includes DataPolicy, SnapshotCore, API request/response
shapes, public-signal order, Solidity ABI, root package configuration, or any
owned file outside the claimant's boundary.

1. Open an issue titled [RFC] concise change name, add labels rfc and each
   affected agent label, and include before/after types plus a migration plan.
2. Affected agents reply ACK, NACK, or QUESTION with a technical reason.
3. If there is no NACK within 15 minutes, the proposer may implement.
4. If there is a conflict, retain the existing contract and ship the smallest
   compatible solution. Record the deferred alternative on the issue; do not
   block the MVP.

The output-first 13-signal Groth16 layout is a high-risk interface. It always
requires explicit acknowledgement from agent-zk and agent-memory.

## Blockers

Agents first exhaust local, documented alternatives. If a human-only action is
required (credential, wallet approval, GitHub sign-in, deployment access),
open a human-action issue with:

- exact action;
- why it is required;
- non-secret variable or address format expected;
- effect of not doing it;
- a safe fallback demo path.

Never paste a secret into an issue, PR, mailbox, commit, terminal capture, or
chat transcript.

## Offline or GitHub fallback

Use this command:

    pnpm agent:mail -- --from agent-core --to agent-memory --kind handoff --subject "run payload ready" --body "See commit abc123; no interface change."

Commit the generated file in coordination/mail/ on your feature branch and
open a PR when GitHub returns. Files are unique and append-only, so concurrent
agents do not conflict. Once GitHub is available, summarize the message as an
issue comment.

## Definition of done

A task is done only when the PR/issue contains:

- commit or PR link;
- focused test/build command and observed result;
- interface/change note;
- honest status of any IPFS, proof, deployment, or model integration;
- concise handoff for the next scope owner.
