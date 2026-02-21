import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Ms. Kaine Bot",
  description:
    "Telegram group administration bot with Zenon Network integration",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Commands", link: "/commands/" },
      { text: "Zenon", link: "/zenon/overview" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "Permissions", link: "/guide/permissions" },
          ],
        },
      ],
      "/commands/": [
        {
          text: "Commands",
          items: [
            { text: "Overview", link: "/commands/" },
            { text: "Moderation", link: "/commands/moderation" },
            { text: "Anti-Spam", link: "/commands/anti-spam" },
            { text: "Greetings", link: "/commands/greetings" },
            { text: "Content", link: "/commands/content" },
            { text: "Federations", link: "/commands/federations" },
            { text: "Zenon Network", link: "/commands/zenon" },
            { text: "Settings", link: "/commands/settings" },
          ],
        },
      ],
      "/zenon/": [
        {
          text: "Zenon Network",
          items: [
            { text: "Overview", link: "/zenon/overview" },
            { text: "Token Gating", link: "/zenon/token-gating" },
          ],
        },
      ],
    },
    search: {
      provider: "local",
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/0x3639/msKaine",
      },
    ],
  },
});
