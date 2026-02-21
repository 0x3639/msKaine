# Token Gating

Token gating restricts group membership to users who hold a minimum balance of a specific ZTS token. When enabled, new joiners without a linked wallet or with insufficient balance are automatically kicked.

## Setup

### 1. Enable token gating

```
/zgate enable zts1znnxxxxxxxxxxxxx9z4ulx 100
```

This requires all members to hold at least 100 ZNN. You can use any ZTS token address.

### 2. Members link their wallets

Members need to link their Zenon address before joining (or within the grace period):

```
/zwallet z1qph8...
/zwallet verify
```

### 3. Check eligibility

Members can verify their status:

```
/zgate check
```

## How It Works

When a new user joins the group:

1. The bot checks if they have a linked and verified Zenon wallet
2. If no wallet is linked, the user is kicked with a message explaining they need to link one
3. If the wallet balance is below the minimum, the user is kicked with a message showing the requirement
4. If the balance meets the requirement, the user is allowed to stay

## Commands

| Command | Permission | Description |
|---|---|---|
| `/zgate info` | Everyone | Show current gating settings |
| `/zgate enable <zts> <min>` | Admin | Enable gating with a token and minimum balance |
| `/zgate disable` | Admin | Disable token gating |
| `/zgate check` | Everyone | Check your own eligibility |

## Notes

- Token gating only checks at join time. Existing members are not retroactively removed if their balance drops.
- The bot needs a working Zenon node connection to verify balances.
- Users must have a linked wallet **before** joining the group.
