# ZK proof and settlement workflow

Run this workflow only on the dedicated x86-64 proof host. It produces two
real Groth16 proof artifacts: V1-to-V2 and V2-to-V3. Do not use the mock
verifier outside the local contract test.

## 1. Compile the circuit

Install Circom 2 on the proof host, install repository dependencies, then run:

    pnpm --filter @autoevolve/contracts zk:compile

The generated R1CS, WASM, symbols, witnesses, proving keys, and proof outputs
are intentionally ignored by Git. Check the number of constraints before
selecting a verified Powers of Tau file:

    pnpm exec snarkjs r1cs info ../../circuits/build/AutoEvolveImprovement.r1cs

Use a Powers of Tau file large enough for the reported constraint count and
retain the source/checksum of that file in the ZK issue or PR.

## 2. Trusted setup and verifier source

From packages/contracts, using a verified powersOfTau.ptau file:

    pnpm exec snarkjs groth16 setup ../../circuits/build/AutoEvolveImprovement.r1cs powersOfTau.ptau phase1.zkey
    pnpm exec snarkjs zkey contribute phase1.zkey AutoEvolveImprovement_final.zkey --name="AutoEvolve hackathon contribution"
    pnpm exec snarkjs zkey export verificationkey AutoEvolveImprovement_final.zkey verification_key.json
    pnpm exec snarkjs zkey export solidityverifier AutoEvolveImprovement_final.zkey ../contracts/generated/GeneratedGroth16Verifier.sol
    pnpm compile

Preserve the generated verifier license header. Do not commit zkey, ptau,
witness, or private input files.

## 3. Create CID-bound private inputs

Pin the sanitized snapshot first. Use the actual returned CID, the exact agent
wallet that will submit transactions, and one fixed run ID in both commands:

    pnpm zk:input -- --fixture v1-v2 --run-id RUN_ID --cid REAL_PINATA_CID --agent 0xAGENT --stage 2 > ../../circuits/build/v1-v2-input.json
    pnpm zk:input -- --fixture v2-v3 --run-id RUN_ID --cid REAL_PINATA_CID --agent 0xAGENT --stage 3 > ../../circuits/build/v2-v3-input.json

The JSON printed on stderr is a public-signal preview. The redirected input
file contains private policy witness values, so keep it out of source control.
The script refuses non-improving fixtures and emits the immutable output-first
13-signal layout used by the verifier and registry.

## 4. Prove and locally verify both transitions

    pnpm zk:prove -- --input ../../circuits/build/v1-v2-input.json --zkey AutoEvolveImprovement_final.zkey --verification-key verification_key.json --label v1-v2
    pnpm zk:prove -- --input ../../circuits/build/v2-v3-input.json --zkey AutoEvolveImprovement_final.zkey --verification-key verification_key.json --label v2-v3

Each command fails closed if local Groth16 verification fails. A successful
command writes only public proof, public signals, and a settlement.json adapter
under circuits/proofs/<label>/; no witness is written there.

## 5. Deploy and settle

Copy .env.example to the uncommitted root .env.local and provide Base Sepolia
RPC, deployer key, agent key, test-ETH funding, and the chosen reward amount.
Then deploy the generated verifier, adapter, registry, and escrow:

    pnpm deploy:generated-verifier
    # Place the returned contractAddress in GENERATED_VERIFIER_ADDRESS.
    pnpm deploy:registry
    # Place the returned registry contractAddress in REGISTRY_ADDRESS and NEXT_PUBLIC_REGISTRY_ADDRESS.
    pnpm fund:escrow

Finally submit the exact locally verified proof artifacts. The script validates
run ID, agent wallet, CID hash, stage, rubric hash, continuity of V1-to-V2-to-V3,
and final on-chain V3 state before it prints receipt evidence:

    pnpm settle:run -- --run-id RUN_ID --task-id health-research-sharing-v1 --cid REAL_PINATA_CID --v1-v2 ../../circuits/proofs/v1-v2/settlement.json --v2-v3 ../../circuits/proofs/v2-v3/settlement.json

Only call the result on-chain settled after the command reports transaction
hashes and the Base Sepolia receipts are confirmed.
