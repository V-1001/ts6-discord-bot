TS6 Discord Bot



A Discord bot that monitors a TeamSpeak 6 server through the WebQuery API and displays the current server status and connected users in a Discord channel.



This version maintains a single persistent status embed, automatically updates it when users join or leave, detects when the TeamSpeak server goes offline, and updates the bot's Discord activity to reflect the current server status.



Features

Live user list — Displays all currently connected TeamSpeak users in a single Discord embed.

Online/offline detection — Shows whether the TeamSpeak server is currently online or offline.

Persistent status message — The bot updates an existing status message instead of deleting and recreating the channel's message history on startup.

Bot activity status — Displays information such as Watching 3 users on TeamSpeak in the Discord member sidebar.

Read-only channel — Automatically prevents regular members from sending messages in the designated status channel.

Self-healing — If the bot's status message is deleted, the bot can recreate it.

Invite link — Optionally includes a clickable TeamSpeak invite link in the status embed.

Invite parameters — Supports TeamSpeak server passwords, channel IDs, and channel passwords in the invite link.

Configurable polling — Choose how frequently the bot checks the TeamSpeak server.

Requirements



Before installing the bot, you will need:



Node.js 18 or newer

A running TeamSpeak 6 server

TeamSpeak 6 WebQuery enabled

A TeamSpeak WebQuery API key

A Discord server where you have permission to add a bot

A Discord bot application/token

Installation

1\. Download or clone the repository



Download this repository or clone it with Git:



git clone https://github.com/V-1001/ts6-discord-bot.git

cd ts6-discord-bot



If you downloaded the ZIP from GitHub, extract it and open a terminal in the extracted folder.



2\. Install dependencies



Run:



npm install



This installs the required Node.js packages into the node\_modules folder.



You do not need to download or upload the node\_modules folder yourself. It is automatically created by npm install.



3\. Create your .env file



The repository includes a .env.example file containing the configuration variables the bot needs.



Make a copy of .env.example and rename the copy to .env.



Then open .env and replace the placeholder values with your own TeamSpeak and Discord configuration.



Your .env should look similar to:



TS\_API\_BASE=http://127.0.0.1:10080/1

TS\_API\_KEY=YOUR\_TS\_API\_KEY

DISCORD\_TOKEN=YOUR\_DISCORD\_BOT\_TOKEN

STATUS\_CHANNEL\_ID=YOUR\_DISCORD\_CHANNEL\_ID

POLL\_INTERVAL=5000

TS\_INVITE\_LINK=YOUR\_TS\_INVITE\_LINK



Do not upload your .env file to GitHub.



Your .env file may contain private credentials such as your Discord bot token and TeamSpeak API key.



Environment Variables

Variable	Required	Description

TS\_API\_BASE	Yes	TeamSpeak WebQuery base URL. Example: http://127.0.0.1:10080/1

TS\_API\_KEY	Yes	TeamSpeak WebQuery API key

DISCORD\_TOKEN	Yes	Discord bot token

STATUS\_CHANNEL\_ID	Yes	Discord channel ID where the status embed will be displayed

POLL\_INTERVAL	No	How often the bot checks TeamSpeak, in milliseconds. Default: 5000

TS\_INVITE\_LINK	No	Base URL used for the TeamSpeak invite link

TS\_SERVER\_PASSWORD	No	TeamSpeak server password

TS\_CHANNEL\_ID	No	TeamSpeak channel ID to include in the invite link

TS\_CHANNEL\_PASSWORD	No	TeamSpeak channel password

TeamSpeak Invite Link



TS\_INVITE\_LINK is optional.



If configured, the bot adds a clickable link to the status embed.



The optional TS\_SERVER\_PASSWORD, TS\_CHANNEL\_ID, and TS\_CHANNEL\_PASSWORD values can be used to add connection parameters to the invite link.



Discord Bot Setup

1\. Create the Discord application



Go to the Discord Developer Portal and create a new application:



https://discord.com/developers/applications



2\. Create the bot



Open your application and go to Bot.



Create the bot and copy its token.



Keep the bot token private. Do not commit it to GitHub.



Place the token in your .env file:



DISCORD\_TOKEN=YOUR\_DISCORD\_BOT\_TOKEN



3\. Invite the bot to your server



Under OAuth2 → URL Generator, select:



Scopes



bot



Bot Permissions



Manage Channels

Send Messages

Manage Messages

Read Message History

View Channels



Use the generated URL to invite the bot to your Discord server.



4\. Create the status channel



Create a Discord text channel where you want the TeamSpeak status to appear.



Enable Developer Mode in Discord if necessary.



Right-click the channel and select Copy Channel ID.



Add the ID to your .env file:



STATUS\_CHANNEL\_ID=YOUR\_DISCORD\_CHANNEL\_ID



The bot will automatically make this channel read-only for regular members.



TeamSpeak 6 WebQuery Setup



The bot communicates with TeamSpeak through the TeamSpeak 6 WebQuery API.



Make sure WebQuery is enabled on your TeamSpeak server and that you have a valid API key.



For a local TeamSpeak server, the WebQuery URL may look like:



http://127.0.0.1:10080/1



Configure the values in your .env file:



TS\_API\_BASE=http://127.0.0.1:10080/1

TS\_API\_KEY=YOUR\_TS\_API\_KEY



The bot uses WebQuery to retrieve the currently connected TeamSpeak clients.



Running the Bot



Once your .env file is configured, start the bot with:



npm start



If everything is configured correctly, the console will show the bot connecting to Discord and checking the TeamSpeak server.



The bot will then periodically update the Discord status message.



The default polling interval is 5 seconds.



You can change this using:



POLL\_INTERVAL=5000



For example, 10000 would check every 10 seconds.



Bot Status

TeamSpeak online with users connected



The Discord embed displays the current users.



Example:



TeamSpeak Server Status



Click here to join



Users Online

• PlayerOne

• PlayerTwo

• PlayerThree



The bot activity will show:



Watching 3 users on TeamSpeak



TeamSpeak online with nobody connected



The status remains online and displays:



No users currently connected



TeamSpeak offline



The status embed changes to:



🔴 TeamSpeak 6 server is currently offline.



The bot remains connected to Discord and will automatically detect when TeamSpeak becomes available again.



Status Message Behavior



The bot maintains a single status message in the designated Discord channel.



When the bot starts, it looks for an existing status message created by the bot and updates it rather than creating a new message every time.



If the status message is deleted, the bot can recreate it.



The bot does not purge the channel's existing message history on startup.



Because the status channel is intended to be read-only, the bot requires permission to manage the channel's permissions.



Docker



Docker is optional. You can run the bot directly with Node.js as described above.



Build and run locally



docker build -t ts6-discord-bot .



docker run -d --name ts6-discord-bot

\-e TS\_API\_BASE=http://localhost:10080/1

\-e TS\_API\_KEY=your\_api\_key

\-e DISCORD\_TOKEN=your\_discord\_token

\-e STATUS\_CHANNEL\_ID=your\_channel\_id

ts6-discord-bot



Docker Compose



services:

ts6-discord-bot:

image: ghcr.io/andygobrien/ts6-discord-bot:latest

container\_name: ts6-discord-bot

restart: unless-stopped

environment:

\# TeamSpeak

\- TS\_API\_BASE=http://localhost:10080/1

\- TS\_API\_KEY=your\_api\_key

\- POLL\_INTERVAL=5000

\- TS\_INVITE\_LINK={base invite link}

\- TS\_SERVER\_PASSWORD=your\_server\_password

\- TS\_CHANNEL\_ID=5

\- TS\_CHANNEL\_PASSWORD=your\_channel\_password



&#x20; # Discord

&#x20; - DISCORD\_TOKEN=your\_discord\_token

&#x20; - STATUS\_CHANNEL\_ID=your\_channel\_id

Optional: Caddy Reverse Proxy for Invite Links



If you want a clean HTTPS invite URL that redirects to a TeamSpeak client URI, you can use Caddy as a reverse proxy.



Example Caddy configuration:



yourdomain.com {

@ts path /ts

redir @ts ts3server://yourdomain.com?port=9987\&{query} 308

}



This passes query parameters such as the server password, channel ID, and channel password through to the TeamSpeak client URI.



Configuration and Security Notes

Keep .env private



Your .env file may contain:



Discord bot tokens

TeamSpeak API keys

TeamSpeak passwords

Private invite information



Never commit .env to GitHub.



The repository includes .env.example so users can see which configuration variables are required without exposing private credentials.



node\_modules



The node\_modules directory is generated automatically when you run:



npm install



It should not be committed to the repository.



License



MIT

