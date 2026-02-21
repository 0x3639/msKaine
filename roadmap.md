# Ms. Kaine Admin Bot - Roadmap

A comprehensive Telegram admin/moderation bot replicating all Miss Rose functionality, built with TypeScript and integrated with the Zenon Network via `znn-typescript-sdk`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS (ESM) |
| Language | TypeScript 5.4+ (strict mode) |
| Bot Framework | grammY 1.x |
| Database | PostgreSQL 16 (via Docker) |
| ORM | Prisma 5.x |
| Cache | Redis 7 (ioredis) |
| Blockchain | znn-typescript-sdk |
| Logging | pino |
| Validation | zod |
| Testing | vitest |
| Container | Docker + docker-compose |

---

## Phase 0: Foundation

**Goal**: Bootable bot with full infrastructure, zero feature commands.

### Deliverables
- Project scaffolding: `package.json`, `tsconfig.json`, ESLint, Prettier
- Docker Compose: PostgreSQL 16 + Redis 7
- Prisma schema: 20+ models (Chat, User, ChatAdmin, Warning, Federation, etc.)
- Environment config with zod validation
- Core singletons: database, redis, logger, zenon-client, error-handler
- Custom `BotContext` type extending grammY Context
- Bot factory with global middleware chain
- 8 middleware layers: session, auth, chat-settings, command-state, antiflood, log-channel, connection, silent-action
- Shared utilities: time-parser, user-resolver, message-builder, permissions
- `/start` and `/help` commands as proof of life

---

## Phase 1: Core Moderation (63 Commands)

**Goal**: Full moderation toolkit operational.

### Admin Management (6 commands)
| Command | Description |
|---|---|
| `/promote` | Promote a user to admin |
| `/demote` | Demote an admin |
| `/adminlist` | List all group admins |
| `/adminerror` | Toggle error messages for non-admin commands |
| `/anonadmin` | Toggle anonymous admin permission verification |
| `/admincache` | Force-refresh admin list cache |

### Restrictions (14 commands)
| Command | Description |
|---|---|
| `/ban` | Permanently ban a user |
| `/tban` | Temporary ban with expiration |
| `/dban` | Delete message and ban (reply only) |
| `/sban` | Silent ban (no notification) |
| `/unban` | Remove a ban |
| `/mute` | Permanently mute a user |
| `/tmute` | Temporary mute with expiration |
| `/dmute` | Delete message and mute (reply only) |
| `/smute` | Silent mute (no notification) |
| `/unmute` | Remove a mute |
| `/kick` | Kick a user (can rejoin) |
| `/dkick` | Delete message and kick (reply only) |
| `/skick` | Silent kick (no notification) |

### Warnings (10 commands)
| Command | Description |
|---|---|
| `/warn` | Issue a warning with reason |
| `/dwarn` | Warn and delete message (reply only) |
| `/swarn` | Silent warning |
| `/rmwarn` | Remove most recent warning |
| `/resetwarn` | Clear all warnings for a user |
| `/warns` | View a user's warnings |
| `/warnings` | View warning configuration |
| `/setwarnlimit` | Set max warnings before action |
| `/setwarnmode` | Set punishment (kick/ban/mute) |
| `/setwarntime` | Set warning expiration time |

### Reports (3 commands)
| Command | Description |
|---|---|
| `/reports` | Enable/disable reporting |
| `/report` | Report a message to admins |
| `@admin` | Alternative report trigger |

### Purges (6 commands)
| Command | Description |
|---|---|
| `/del` | Delete a single message |
| `/purge` | Delete messages from reply point to now |
| `/purge <n>` | Delete n messages from reply point |
| `/spurge` | Silent purge (no confirmation) |
| `/purgefrom` | Mark start of range deletion |
| `/purgeto` | Mark end of range deletion |

### Log Channels (6 commands)
| Command | Description |
|---|---|
| `/setlog` | Set log channel for the group |
| `/unsetlog` | Disable logging |
| `/logchannel` | Check current log channel |
| `/logcategories` | List available log categories |
| `/log` | Enable specific log categories |
| `/nolog` | Disable specific log categories |

### Pins (7 commands)
| Command | Description |
|---|---|
| `/pin` | Pin a message |
| `/pin loud` | Pin with notification |
| `/permapin` | Pin a new custom message |
| `/unpin` | Unpin most recent pin |
| `/unpinall` | Unpin all messages |
| `/antichannelpin` | Toggle auto-pin of channel posts |
| `/cleanlinked` | Toggle deletion of linked channel messages |

### Approvals (5 commands)
| Command | Description |
|---|---|
| `/approve` | Make user immune from automated actions |
| `/approval` | Check if a user is approved |
| `/approved` | List all approved users |
| `/unapprove` | Remove approval |
| `/unapproveall` | Remove all approvals (owner only) |

### Disabling Commands (6 commands)
| Command | Description |
|---|---|
| `/disabled` | List disabled commands |
| `/disableable` | List commands that can be disabled |
| `/disable` | Disable a command for non-admins |
| `/enable` | Re-enable a command |
| `/disabledel` | Toggle deletion of disabled command attempts |
| `/disableadmin` | Toggle whether disabled commands apply to admins |

---

## Phase 2: Anti-Spam (66 Commands)

**Goal**: Complete spam prevention and greeting system.

### Locks (12 commands)
| Command | Description |
|---|---|
| `/locks` | Check active locks |
| `/locks list` | Display all locks and status |
| `/locktypes` | View all lockable content types |
| `/lock <type>` | Lock content types (gif, video, sticker, etc.) |
| `/unlock <type>` | Unlock content types |
| `/lockwarns` | Toggle warnings for lock violations |
| `/lock <types> ### <reason> {mode}` | Lock with custom action |
| `/allowlist` | Display allowlisted items |
| `/allowlist <item>` | Add to allowlist |
| `/rmallowlist <item>` | Remove from allowlist |
| `/rmallowlistall` | Clear entire allowlist (owner only) |

### CAPTCHAs (11 commands)
| Command | Description |
|---|---|
| `/captcha on/off` | Toggle CAPTCHA verification |
| `/captchamode` | Set mode: button, text, math, text2 |
| `/setcaptchatext` | Customize CAPTCHA button text |
| `/resetcaptchatext` | Reset to default text |
| `/captchakick on/off` | Toggle auto-kick for unsolved CAPTCHAs |
| `/captchakicktime` | Set kick timer (5m to 1d) |
| `/captcharules on/off` | Require rules acceptance |
| `/captchamutetime` | Auto-unmute timer |

### Blocklists (15 commands + 9 trigger types)
| Command | Description |
|---|---|
| `/blocklist` | List active blocklist triggers |
| `/addblocklist` | Add trigger (word, "phrase", or batch) |
| `/rmblocklist` | Remove trigger(s) |
| `/rmblocklistall` | Remove all triggers (owner only) |
| `/blocklistmode` | Set action: nothing, warn, kick, ban, mute |
| `/blocklistdelete` | Toggle message deletion |
| `/setblocklistreason` | Set custom default reason |
| `/resetblocklistreason` | Reset to default reason |

**Trigger types**: stickerpack, file pattern, forward source, inline bot, username pattern, name pattern, prefix, exact match, lookalike/homoglyph

### Antiflood (6 commands)
| Command | Description |
|---|---|
| `/flood` | Check antiflood settings |
| `/setflood` | Set consecutive message threshold |
| `/setfloodtimer` | Set time-based flood detection |
| `/setfloodmode` | Set punishment action |
| `/clearflood on/off` | Toggle deletion of all flood messages |

### Antiraid (8 commands)
| Command | Description |
|---|---|
| `/antiraid` | Display/toggle antiraid status |
| `/antiraid on` | Enable for configured duration |
| `/antiraid <duration>` | Enable for custom duration |
| `/antiraid off` | Disable immediately |
| `/raidtime` | Set antiraid active duration |
| `/raidactiontime` | Set temp ban duration during raids |
| `/autoantiraid` | Auto-enable on join velocity spike |
| `/autoantiraid off` | Disable auto detection |

### Greetings (9 commands)
| Command | Description |
|---|---|
| `/welcome` | View current welcome message |
| `/welcome on/off` | Toggle welcome messages |
| `/welcome noformat` | View raw welcome text |
| `/setwelcome` | Set custom welcome (text/media) |
| `/resetwelcome` | Reset to default |
| `/goodbye` | View current goodbye message |
| `/goodbye on/off` | Toggle goodbye messages |
| `/setgoodbye` | Set custom goodbye |
| `/resetgoodbye` | Reset to default |
| `/cleanwelcome on/off` | Auto-delete old welcome messages |

---

## Phase 3: Content & Features (82 Commands)

**Goal**: Full content management, federation system, and utility commands.

### Formatting Engine
- Fillings: `{first}`, `{last}`, `{fullname}`, `{username}`, `{mention}`, `{id}`, `{chatname}`, `{rules}`, `{preview}`, `{nonotif}`, `{protect}`, `{mediaspoiler}`
- Button syntax: `[text](buttonurl://url)` and `[text](buttonurl://url:same)`
- Random content: `%%%` delimiter for message variations
- Markdown: bold, italic, underline, strikethrough, code, spoiler, quotes

### Info (2 commands)
| Command | Description |
|---|---|
| `/id` | Get chat/user ID |
| `/info` | Get user information |

### Rules (7 commands)
| Command | Description |
|---|---|
| `/rules` | Display group rules |
| `/setrules` | Set rules message |
| `/privaterules on/off` | Toggle PM delivery |
| `/resetrules` | Remove rules |
| `/setrulesbutton` | Customize rules button text |
| `/resetrulesbutton` | Reset button text |

### Filters (10 commands)
| Command | Description |
|---|---|
| `/filter <word> <reply>` | Create word filter |
| `/filter "<phrase>" <reply>` | Create phrase filter |
| `/filter (<multi>) <reply>` | Batch filter creation |
| `/filter prefix:<trigger>` | Prefix-match filter |
| `/filter exact:<trigger>` | Exact-match filter |
| `/stop` | Remove a filter |
| `/stopall` | Remove all filters (owner only) |
| `/filters` | List active filters |

### Notes (8 commands)
| Command | Description |
|---|---|
| `/save` | Save a note (text/media) |
| `/get` | Retrieve a note |
| `#triggerword` | Shorthand note retrieval |
| `/notes` | List all notes |
| `/clear` | Delete a note |
| `/privatenotes on/off` | Toggle PM delivery |

**Note fillings**: `{private}`, `{noprivate}`, `{admin}`, `{repeat <time>}`

### Connections (6 commands)
| Command | Description |
|---|---|
| `/connect` | Connect PM to a group |
| `/connect` (no args) | List recent connections |
| `/disconnect` | End connection |
| `/connection` | Show current connection |
| `/reconnect` | Switch between connections |

### Echo (3 commands)
| Command | Description |
|---|---|
| `/echo` | Repeat message with formatting |
| `/say` | Alias for /echo |
| `/broadcast` | Send to all groups (owner only) |

### Cleaning (9 commands)
| Command | Description |
|---|---|
| `/cleancommand <type>` | Auto-delete command messages |
| `/keepcommand <type>` | Stop auto-deleting |
| `/cleancommandtypes` | List available types |
| `/cleanmsg <type>` | Auto-delete bot messages after 5min |
| `/keepmsg <type>` | Stop auto-deleting bot messages |
| `/cleanmsgtypes` | List available types |
| `/cleanservice on/off` | Auto-delete service messages |
| `/nocleanservice <type>` | Exempt specific service types |
| `/cleanservicetypes` | List available types |

### Silent Actions (2 commands + 4 prefixes)
| Command | Description |
|---|---|
| `/silentactions on/off` | Toggle silent actions (owner only) |
| `sban`, `skick`, `smute`, `swarn` | Silent action prefixes |

### Federations (26 commands)
| Command | Description |
|---|---|
| `/newfed` | Create federation (PM only) |
| `/renamefed` | Rename federation |
| `/delfed` | Delete federation (irreversible) |
| `/fedinfo` | Federation info |
| `/fedadmins` | List federation admins |
| `/chatfed` | Check chat's federation |
| `/myfeds` | List your federations |
| `/fedpromote` | Add federation admin |
| `/feddemote` | Remove federation admin |
| `/feddemoteme` | Demote yourself |
| `/fedreason on/off` | Require ban reasons |
| `/fednotif on/off` | Toggle ban notifications |
| `/setfedlog` | Enable federation logging |
| `/unsetfedlog` | Disable federation logging |
| `/fbanlist` | Export ban list (csv/json) |
| `/importfbans` | Import bans from file |
| `/subfed` | Subscribe to another federation |
| `/unsubfed` | Unsubscribe |
| `/fedsubs` | List subscriptions |
| `/joinfed` | Join chat to federation |
| `/leavefed` | Remove chat from federation |
| `/quietfed on/off` | Toggle fedban notifications |
| `/fban` | Federation ban |
| `/unfban` | Federation unban |
| `/fedstat` | Check federation ban status |
| `/fbanstat` | Ban details for specific federation |

---

## Phase 4: Zenon SDK Integration

**Goal**: Full blockchain integration with bot-owned wallet and user wallet linking.

### Core Setup
- Zenon SDK singleton wrapper (`zenon-client.ts`)
- Bot wallet from mnemonic (in .env)
- User wallet linking via signature verification

### Wallet & Balance
| Command | Description |
|---|---|
| `/zwallet` | Link Telegram account to Zenon address |
| `/zbalance [address]` | Query ZNN/QSR balance |
| `/zaddress` | Show linked address |

### Network & Info
| Command | Description |
|---|---|
| `/zstats` | Network statistics |
| `/zmomentum` | Latest momentum info |
| `/ztoken <ZTS>` | Token information |
| `/ztokens [address]` | List tokens for address |

### Pillars & Delegation
| Command | Description |
|---|---|
| `/zpillar <name>` | Pillar information |
| `/zpillars` | List all pillars |
| `/zdelegate <name>` | Delegate to a pillar |
| `/zrewards [address]` | Check uncollected rewards |

### Staking & Plasma
| Command | Description |
|---|---|
| `/zstake <amount> <duration>` | Stake ZNN |
| `/zstakes [address]` | View active stakes |
| `/zunstake <id>` | Cancel a stake |
| `/zplasma [address]` | Check plasma level |
| `/zfuse <address> <amount>` | Fuse QSR for plasma |

### Transactions
| Command | Description |
|---|---|
| `/zsend <address> <amount> <ZNN/QSR>` | Send tokens (with confirmation) |

### Bridge & HTLC
| Command | Description |
|---|---|
| `/zbridge info` | Bridge status |
| `/zbridge networks` | List bridge networks |
| `/zwrap <network> <address> <amount>` | Wrap tokens for cross-chain |
| `/zhtlc create` | Create hash time-locked contract |
| `/zhtlc unlock` | Unlock HTLC |
| `/zhtlc info` | HTLC details |

### Governance
| Command | Description |
|---|---|
| `/zproposals` | List Accelerator-Z proposals |
| `/zproposal <id>` | Proposal details |
| `/zvote <id> <yes/no/abstain>` | Vote on proposal |

### Real-Time Subscriptions
| Command | Description |
|---|---|
| `/zsub momentum` | Subscribe to new momentums |
| `/zsub address <addr>` | Subscribe to address activity |
| `/zunsub` | Unsubscribe |

### Token Gating
| Command | Description |
|---|---|
| `/zgate enable <ZTS> <minAmount>` | Enable token-gated access |
| `/zgate disable` | Disable gating |
| `/zgate check` | Manual member verification |

---

## Phase 5: Production Hardening

**Goal**: Production-ready deployment with monitoring and testing.

### Deliverables
- grammY auto-retry plugin for Telegram API rate limits
- Per-user per-command rate limiting via Redis
- Graceful shutdown: drain updates, close DB/Redis/Zenon
- Docker multi-stage production Dockerfile
- CI/CD pipeline (GitHub Actions): lint, type-check, test, build
- Unit tests: 80%+ coverage on services and utilities (vitest)
- Integration tests: DB operations, Redis patterns, Zenon SDK mocks
- Handler tests: mock grammY contexts for command testing
- Structured logging with pino
- Health check endpoint
- Command reference documentation
- Deployment guide

---

## Summary

| Phase | Commands | Description |
|---|---|---|
| Phase 0 | 2 | Foundation + /start, /help |
| Phase 1 | 63 | Core moderation |
| Phase 2 | 66 | Anti-spam + greetings |
| Phase 3 | 82 | Content, federations, utilities |
| Phase 4 | ~30 | Zenon blockchain integration |
| Phase 5 | - | Production hardening + tests |
| **Total** | **~243** | **Complete bot** |
