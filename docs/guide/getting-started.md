# Getting Started

## Adding the Bot

1. Search for **@msKaine_bot** on Telegram (or your self-hosted instance)
2. Click **Add to Group** and select your group
3. Promote the bot to **admin** with these permissions:
   - Delete messages
   - Ban users
   - Invite users via link
   - Pin messages
   - Manage video chats (optional)

## First Steps

Once the bot is an admin, it's ready to go. All features default to **off** — you enable what you need.

### Set up welcome messages

```
/welcome on
/setwelcome Welcome {mention} to {chatname}! Please read the /rules
```

### Set group rules

```
/setrules 1. No spam
2. Be respectful
3. English only
```

### Enable CAPTCHA for new members

```
/captcha on
/captchamode math
/captchakicktime 5m
```

### Configure warnings

```
/setwarnlimit 3
/setwarnmode tban
/setwarntime 7d
```

## PM Connection

Admins can manage groups remotely from a private chat:

1. Run `/connect` in the group to get the chat ID
2. Open a PM with the bot
3. Run `/connect <chat_id>`
4. Use admin commands as if you were in the group

## Next Steps

- [Configuration](/guide/configuration) — environment variables and Docker setup
- [Permissions](/guide/permissions) — understand permission levels
- [Command Reference](/commands/) — browse all commands
