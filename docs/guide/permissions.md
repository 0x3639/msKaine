# Permissions

Ms. Kaine uses a layered permission system to control who can run which commands.

## Permission Levels

| Level | Who | Examples |
|---|---|---|
| **Everyone** | Any group member | `/rules`, `/id`, `/warns`, `/notes`, `/zbalance` |
| **Admin** | Telegram group admins | `/ban`, `/warn`, `/lock`, `/captcha`, `/setlog` |
| **Creator** | Group creator (owner) | `/unpinall`, `/unapproveall`, `/stopall`, `/anonadmin` |
| **Bot Owner** | `BOT_OWNER_ID` env var | `/broadcast` |
| **Fed Owner** | Federation creator | `/delfed`, `/fedpromote`, `/subfed`, `/importfbans` |
| **Fed Admin** | Promoted federation admins | `/fban`, `/unfban`, `/fbanlist` |
| **Bot Wallet** | Requires `ZENON_MNEMONIC` | `/zsend`, `/zfuse` |
| **PM Only** | Must be used in private chat | `/newfed`, `/disconnect`, `/connection` |

## How It Works

The bot checks permissions on every command using the Telegram `getChatMember` API:

- **creator** status → full access
- **administrator** status → admin access
- Neither → regular member (everyone-level commands only)

If the API call fails (e.g., rate limiting), the bot falls back to a cached admin list.

## Approved Users

Users granted `/approve` status are exempted from automated moderation:
- Antiflood (won't be rate-limited)
- Filters (auto-replies won't trigger)
- Blocklist (blocked words won't match)
- Locks (locked content types won't be deleted)

Approved status does **not** grant admin commands.

## Anonymous Admins

By default, the bot cannot identify anonymous admins. The `/anonadmin on` setting (creator only) trusts all anonymous admins with full permissions. This is a security risk — use with caution.

## Disabling Commands

Admins can disable specific commands for non-admin users:

```
/disable rules     # Non-admins can't use /rules
/enable rules      # Re-enable it
/disableadmin on   # Also apply to admins
/disabledel on     # Auto-delete disabled command messages
```

Use `/disableable` to see which commands can be disabled.
