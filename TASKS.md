# Task Board

The live board is coordination/WORK_BOARD.md. Use GitHub issues for claims,
discussion, and status; this file is a compact submission checklist, not a
place for concurrent edits.

## Human-action prerequisites

- [ ] Create a Gemini key and place it only in local .env.local.
- [ ] Create a Pinata JWT and place it only in local .env.local.
- [ ] Provide a Base Sepolia RPC URL, agent wallet, deployer wallet, and faucet
      funds through local environment variables.
- [ ] Authenticate GitHub CLI or create a remote repository, then run
      pnpm github:bootstrap -- --repo OWNER/REPO.
- [ ] Install Circom on the x86-64 proof host.

## Evidence gates

- [ ] Two local Groth16 proofs verify against their verification key.
- [ ] The generated verifier, adapter, and registry are deployed to Base
      Sepolia and the registry escrow is funded.
- [ ] A real sanitized CID is pinned; the CID hash is bound to each proof.
- [ ] V1-to-V2 and V2-to-V3 settlements succeed and transaction receipts are saved.
- [ ] Agent Beta reads the registry pointer and consumes only allowlisted
      memory cards.
- [ ] Dashboard is deployed and rehearsed with a clean browser session.
