# Team

There is no permanent AI-agent lead. Four agents coordinate directly through
GitHub issues, PR reviews, and the fallback mailbox described in
coordination/PROTOCOL.md. A human may take the release action (enter secrets,
deploy, submit), but agents can build and integrate independently.

| Agent ID        | Human pairing     | AI-device scope                                       | Definition of done                                       |
| --------------- | ----------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| agent-core      | TBD               | packages/core plus run route                          | V1/V2/V3 tests and live-model error path pass            |
| agent-zk        | x86-64 proof host | circuits plus packages/contracts                      | two local proofs, verifier artifact, contract tests      |
| agent-memory    | TBD               | packages/memory, packages/chain, attest/search routes | CID validation, pin/read tests, verified-memory handoff  |
| agent-dashboard | TBD               | dashboard presentation files                          | all evidence states render and browser smoke test passes |

## Human-only actions

Only a human should enter credentials, approve a wallet transaction, select
public/private visibility for the GitHub repository, or submit the hackathon
entry. Agents must request those actions through a GitHub issue or mailbox
message with the exact minimum input needed.
