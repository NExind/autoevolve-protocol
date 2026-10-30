# AutoEvolve Improvement Circuit

`AutoEvolveImprovement.circom` privately receives two normalized `DataPolicy`
versions. It derives the same ten score checks used by `@autoevolve/core`,
constrains `nextScore > previousScore`, and exposes 13 public signals:

| Index | Public signal                                                          |
| ----- | ---------------------------------------------------------------------- |
| 0–1   | derived previous / next score (main-component outputs)                 |
| 2     | Poseidon binding over commitments and metadata (main-component output) |
| 3–4   | previous / next Poseidon policy commitments                            |
| 5–6   | run ID low / high 128-bit limbs                                        |
| 7–8   | `keccak256(CID)` low / high limbs                                      |
| 9     | agent wallet as `uint160`                                              |
| 10    | target stage                                                           |
| 11–12 | rubric-hash low / high limbs                                           |

Circom serializes main-component outputs before explicitly declared public
inputs; the SDK and registry intentionally use this exact output-first order.

The circuit does **not** prove model quality or hidden reasoning. It proves the
specific arithmetic evaluator claim over the private policy witnesses.

## Build on the x86-64 proof host

    pnpm install
    cd packages/contracts
    pnpm zk:compile

Install Circom 2 first. The script emits build artifacts under
`circuits/build/`, which are intentionally ignored by Git. Complete a trusted
setup and generate the verifier with snarkjs before deployment; see
`packages/contracts/scripts/zk/README.md`.
