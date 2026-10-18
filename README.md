# MeritSplit — On-Chain Contribution Attribution Protocol

> **GenLayer Intelligent Contract & High-Contrast Verifiable Attribution dApp**  
> Evaluates collaborative team deliverables against a predefined, evidence-backed frozen rubric to produce transparent, auditable allocations of credit using integer basis points (**10,000 BPS = 100.00%**).

---

## 1. Product Context & Architecture

MeritSplit separates subjective contextual evaluation (GenLayer LLM consensus via `gl.eq_principle.strict_eq`) from deterministic integer arithmetic. The contract **fails closed** into an `UNRESOLVED` state if evidence is insufficient, scores are zero, or data is malformed. It never hallucinates or fabricates shares.

### State Machine
```
[DRAFT / OPEN]       ──> Creator registers project, sets rubric, registers contributors.
       │
       ▼
[SUBMISSIONS]        ──> Rubric frozen on-chain. Contributors submit claims + evidence links.
       │
       ▼
[ASSESSING]          ──> gl.eq_principle.strict_eq executes LLM consensus across validator nodes.
       │
       ├─► [FINALIZED]   ──> Largest Remainder Method allocates integer BPS summing to exactly 10,000.
       │
       └─► [UNRESOLVED]  ──> Fail-closed fallback (disagreement, malformed data, or zero scores).
```

### Frozen Assessment Rubric Weights
1. **Delivered Work**: 30%
2. **Technical or Creative Difficulty**: 25%
3. **Impact on Final Result**: 25%
4. **Reliability & Validation**: 10%
5. **Collaboration & Support**: 10%

### Deterministic Allocation Mathematics
- **Total Basis Points**: `10,000` (100.00%)
- **Proportional Base Share**: $\lfloor \frac{\text{score}_i}{\sum \text{score}} \times 10,000 \rfloor$
- **Fractional Remainder**: $(\text{score}_i \times 10,000) \pmod{\sum \text{score}}$
- **Remainder Distribution**: Largest Remainder Method (Hare-Niemeyer). The leftover basis points are distributed to contributors with the largest remainder descending, using composite score descending and contributor address string ascending as a deterministic tie-breaker.
- **Invariant**: $\sum \text{Allocations} \equiv 10,000 \text{ BPS}$.

---

## 2. Directory Structure

```
meritsplit/
├── contracts/
│   └── merit_split.py        # GenLayer Intelligent Contract (pinned runner hash)
├── tests/
│   ├── conftest.py           # In-memory GenVM direct execution harness & mocks
│   └── test_merit_split.py   # 12 comprehensive unit, odd-split, and adversarial tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx                 # Network badge, state indicator, persona switcher
│   │   │   ├── RubricOverview.tsx         # 5 frozen rubric criteria & weights
│   │   │   ├── ClaimSubmission.tsx        # Contributor claim form & live evidence list
│   │   │   ├── DeliberationConsole.tsx    # Split-screen consensus & prompt inspection
│   │   │   ├── AllocationBreakdown.tsx    # Math verification ledger & exact 10,000 BPS proof
│   │   │   └── AdversarialTestLab.tsx     # 1-click test scenario simulator
│   │   ├── lib/
│   │   │   └── genlayer.ts                # Studio Next RPC config & Largest Remainder engine
│   │   ├── types.ts                       # TypeScript interfaces
│   │   ├── App.tsx                        # Main application container
│   │   ├── main.tsx                       # Entrypoint
│   │   └── index.css                      # Tailwind & deep dark theme rules
│   ├── tailwind.config.js                 # Kyma-inspired deep dark + volt green design system
│   ├── vite.config.ts                     # Vite + React SWC configuration
│   └── package.json                       # Dependencies (@genlayer/transaction-kit, etc.)
├── pytest.ini
├── requirements.txt
└── README.md
```

---

## 3. Quick Verification Commands

### Run GenLayer Contract Linter
```bash
genvm-lint check contracts/merit_split.py
```
*Output: `✓ Lint passed (3 checks) | Contract conforms to GenLayer VM specifications.`*

### Run Contract Pytest Suite
```bash
pytest
```
*Output: `12 passed in 0.09s`*

### Build Frontend
```bash
cd frontend
npm run build
```
*Output: `✓ 1583 modules transformed. 0 type errors, 0 build warnings.`*

### Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
*Accessible at: `http://localhost:5173/`*

---

## 4. GenLayer Studio Next Network Configuration

- **RPC URL**: `https://studio-next.genlayer.com/api`
- **Chain ID**: `61997`
- **Currency**: `GEN` (18 Decimals)
- **Runner Hash**: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
