# SHADOW MUSIC

> *"Where Silence Meets Sound."*

A classic Japanese Samurai-themed Discord Music Bot built with **Node.js**, **Discord.js v14**, **Kazagumo / Shoukaku (Lavalink v4)**, **SQLite (`better-sqlite3`)**, and **Express + WebSockets** using **Discord Bot Token authentication only** (no OAuth2 login or redirect URIs required).

---

## Project Architecture

```text
shadow-music/
├── server.ts                          # Express + WebSocket + Discord bot host server (port 3000)
├── lavalink/
│   └── application.yml                # Lavalink v4 audio node configuration
├── assets/
│   └── samurai-logo.jpg               # Official Samurai artwork copy
├── src/
│   ├── shared/types.ts                # Shared TypeScript interfaces
│   ├── audio/webAudioEngine.ts        # Local studio audio player
│   ├── bot/
│   │   ├── index.ts                   # Discord.js v14 + Kazagumo/Shoukaku Lavalink entrypoint
│   │   ├── deploy-commands.ts         # Slash command registration script
│   │   ├── config/botConfig.ts        # Environment variable loader
│   │   ├── database/sqlite.ts         # SQLite persistence (settings, playlists, history, favorites, blacklist, stats)
│   │   ├── music/
│   │   │   ├── playerManager.ts       # Server-authoritative GuildMusicBridge
│   │   │   └── discordPlayerEmbed.ts  # Classic monochrome Samurai Discord Embed + 9 buttons + queue select menu
│   │   ├── buttons/playerButtons.ts   # Discord button & select-menu interaction handlers
│   │   ├── commands/
│   │   │   ├── music/                 # 19 basic music slash commands (/play through /join)
│   │   │   ├── playlist/              # 7 /playlist subcommands (create, delete, add, remove, play, list, view)
│   │   │   ├── utility/               # 8 utility commands (/help through /serverinfo)
│   │   │   └── admin/                 # 8 admin commands (/247 through /unblacklist)
│   │   ├── handlers/                  # Command & event loaders (including prefix & voice inactivity)
│   │   └── utils/                     # Formatters, permission validators, and 42-command registry
│   └── components/                    # Classic GUI bot control console
└── .env.example                       # Environment variable template
```

---

## Where to Place Your Uploaded Samurai Logo

To use your own uploaded black-and-white Samurai image across the bot assets and embeds:

1. Replace `/src/assets/images/samurai_logo_1795268379491.jpg` with your Samurai artwork (keep the filename or update `SAMURAI_LOGO_URL` in `src/bot/database/sqlite.ts` and `SAMURAI_LOGO` in `src/App.tsx`).
2. Replace `/assets/samurai-logo.jpg` for local Discord bot asset reference.
3. Upload the same image as the **Bot Icon** inside the [Discord Developer Portal](https://discord.com/developers/applications) under **Bot → Icon**.

---

## Setup & Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` (or configure secrets in your hosting environment):

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_client_id
DISCORD_DEV_GUILD_ID=
LAVALINK_HOST=127.0.0.1
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
```

### 3. Discord Developer Portal Configuration

1. Open [Discord Developer Portal](https://discord.com/developers/applications) and create/select your application.
2. Under **Bot**:
   - Copy your **Bot Token** into `DISCORD_BOT_TOKEN`.
   - Enable **Message Content Intent** (for prefix commands such as `!play`, `!skip`, `!np`) and **Server Members Intent** (for DJ role verification).
3. Under **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands` with permissions `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Manage Channels` (for `/setup`) to invite the bot to your Discord server. No Redirect URI or OAuth2 client secret is needed.

### 4. Lavalink v4 Setup

Download the latest `Lavalink.jar` (v4+) and start it with the included configuration:

```bash
java -jar Lavalink.jar --spring.config.location=./lavalink/application.yml
```

### 5. Register Discord Slash Commands

```bash
npm run deploy-commands
```

*(Set `DISCORD_DEV_GUILD_ID` in `.env` for instant guild-level registration during development, or leave it unset for global registration.)*

### 6. Run Development or Production

```bash
# Development
npm run dev

# Production build & start
npm run build
npm run start
```

---

## Railway Deployment

`railway.json` is pre-configured with `RAILPACK`, `buildCommand: "npm run build"`, `startCommand: "npm run start"`, and `healthcheckPath: "/health"`.

1. Deploy a **Lavalink v4** service in your Railway project using `./lavalink/application.yml` (port `2333`).
2. Deploy **SHADOW MUSIC** from your repository or uploaded project files.
3. Set these Railway environment variables on the bot service:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID` *(optional — auto-derived from `DISCORD_BOT_TOKEN` if omitted)*
   - `LAVALINK_HOST` (e.g., `lavalink.railway.internal` for Railway private networking)
   - `LAVALINK_PORT` (`2333`)
   - `LAVALINK_PASSWORD` (`youshallnotpass` or your Lavalink server password)
   - `LAVALINK_SECURE` (`false` for internal private network; `true` for public HTTPS/WSS)
   - `LAVALINK_NAME` (`railway-lavalink`)
4. Slash commands register automatically on startup, or run `npm run deploy-commands` manually.

