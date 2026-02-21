# Zenon Network Integration

Mr. Kaine includes native integration with the [Zenon Network](https://zenon.network) blockchain, enabling wallet linking, on-chain queries, token gating, and more.

## Requirements

Zenon features require a Zenon node connection. Set these in your `.env`:

```
ZENON_NODE_HTTP=https://node.zenonhub.io:35997
ZENON_NODE_WS=wss://node.zenonhub.io:35998
```

For features that send transactions (`/zsend`, `/zfuse`), you also need:

```
ZENON_MNEMONIC=your_wallet_mnemonic_here
```

If no node is configured, the bot runs normally — Zenon commands simply return an "unavailable" message.

## Wallet Linking

Users can link their Zenon address to their Telegram account:

```
/zwallet z1qph8...     # Link an address
/zwallet verify        # Mark as verified
/zwallet unlink        # Remove the link
/zwallet               # Show linked address
```

A linked wallet enables:
- `/zbalance` without specifying an address
- `/zstakes`, `/zrewards`, `/zdelegate` using your linked address
- Token gating eligibility checks

## On-Chain Queries

| Command | What it shows |
|---|---|
| `/zstats` | Network sync state, height, peers, node version |
| `/zmomentum [height]` | Frontier or specific momentum |
| `/zbalance [address]` | ZNN/QSR and other token balances |
| `/ztoken <zts>` | Token details (name, supply, flags) |
| `/ztokens [page]` | All tokens on the network |
| `/zpillar <name>` | Pillar rank, weight, rewards |
| `/zpillars [page]` | All pillars ranked by weight |
| `/zstakes [address]` | Active staking entries |
| `/zrewards [address]` | Uncollected rewards |
| `/zplasma [address]` | Plasma level and QSR fusions |
| `/zdelegate [pillar]` | Delegation info |

## Bot Wallet Operations

If `ZENON_MNEMONIC` is configured:

- `/zsend <address> <amount> [token]` — Send tokens with inline confirmation
- `/zfuse <address> <amount>` — Fuse QSR for plasma
- `/zaddress` — Show the bot's address

## Advanced Features

- **[Token Gating](/zenon/token-gating)** — Restrict group access based on token holdings
- **Event Subscriptions** — `/zsub momentum` or `/zsub address z1...` for real-time notifications
- **Bridge Info** — `/zbridge` for bridge status, `/zwrap` for wrapping instructions
- **HTLC** — `/zhtlc info <id>` for hash time-locked contract details
- **Accelerator-Z** — `/zproposals` and `/zproposal <id>` for funding proposals
