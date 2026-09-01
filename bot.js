require('dotenv').config();

const http = require('http');

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActivityType
} = require('discord.js');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const config = {
  // TeamSpeak
  TS_API_BASE:   process.env.TS_API_BASE   || 'http://localhost:10080/1',
  TS_API_KEY:    process.env.TS_API_KEY    || 'YOUR_TS_API_KEY',
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL || '5000'),
  TS_INVITE_URL: process.env.TS_INVITE_LINK || null,
  TS_SERVER_PASSWORD: process.env.TS_SERVER_PASSWORD || null,
  TS_CHANNEL_ID: process.env.TS_CHANNEL_ID || null,
  TS_CHANNEL_PASSWORD: process.env.TS_CHANNEL_PASSWORD || null,

  // Discord
  DISCORD_TOKEN:       process.env.DISCORD_TOKEN       || 'YOUR_DISCORD_BOT_TOKEN',
  STATUS_CHANNEL_ID:   process.env.STATUS_CHANNEL_ID   || 'YOUR_STATUS_CHANNEL_ID',
};
// ───────────────────────────────────────────────────────────────────────────

const discord = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// State
let previousClients = new Map();
let statusMessage = null;
let lastStatusCount = -1;
let tsOnline = null;

// ─── TEAMSPEAK API ──────────────────────────────────────────────────────────

async function fetchTS(endpoint) {
  const url = new URL(`${config.TS_API_BASE}/${endpoint}?ts=${Date.now()}`);

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'x-api-key': config.TS_API_KEY,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 8000,
    }, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`TS API responded ${res.statusCode}`));
          return;
        }

        try {
          const json = JSON.parse(data);

          if (json.status?.code !== 0) {
            reject(new Error(`TS API error: ${json.status?.message}`));
            return;
          }

          resolve(json.body || []);
        } catch (err) {
          reject(new Error(`Invalid TS API response: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TS API request timed out'));
    });

    req.on('error', reject);

    req.end();
  });
}

async function fetchTSClients() {
  const clients = await fetchTS('clientlist');

  return clients.filter(
    c => String(c.client_type) === '0'
  );
}

async function fetchTSChannels() {
  return await fetchTS('channellist');
}

// ─── BUILD SERVER STATE ─────────────────────────────────────────────────────

async function fetchTSServerState() {
  const [clients, channels] = await Promise.all([
    fetchTSClients(),
    fetchTSChannels()
  ]);

  const channelMap = new Map();

  for (const channel of channels) {
    channelMap.set(
      String(channel.cid),
      channel.channel_name || 'Unknown Channel'
    );
  }

  const clientMap = new Map();

  for (const client of clients) {
    const clientId = String(client.clid);
    const channelId = String(client.cid);

    clientMap.set(clientId, {
      nickname: client.client_nickname,
      cid: channelId,
      channelName: channelMap.get(channelId) || 'Unknown Channel'
    });
  }

  return {
    clients: clientMap,
    channelMap
  };
}

// ─── DISCORD HELPERS ────────────────────────────────────────────────────────

function buildStatusEmbed(clients, online = true) {
  if (!online) {
    return new EmbedBuilder()
      .setTitle('TeamSpeak Server Status')
      .setColor(0xe74c3c)
      .setDescription('🔴 **TeamSpeak 6 server is currently offline.**')
      .setFooter({ text: 'Server offline' })
      .setTimestamp();
  }

  const clientList = [...clients.values()];
  const count = clientList.length;

  const embed = new EmbedBuilder()
    .setTitle('TeamSpeak Server Status')
    .setColor(0x2ecc71)
    .setFooter({
      text: `${count} user${count !== 1 ? 's' : ''} online`
    })
    .setTimestamp();

  // ─── INVITE LINK ────────────────────────────────────────────────────────

  if (config.TS_INVITE_URL) {
    const params = [
      config.TS_SERVER_PASSWORD
        ? `password=${encodeURIComponent(config.TS_SERVER_PASSWORD)}`
        : '',
      config.TS_CHANNEL_ID
        ? `cid=${encodeURIComponent(config.TS_CHANNEL_ID)}`
        : '',
      config.TS_CHANNEL_PASSWORD
        ? `channelpassword=${encodeURIComponent(config.TS_CHANNEL_PASSWORD)}`
        : '',
    ].filter(Boolean).join('&');

    const url = params
      ? `${config.TS_INVITE_URL}?${params}`
      : config.TS_INVITE_URL;

    embed.setDescription(`[Click here to join](${url})`);
  }

  // ─── GROUP USERS BY CHANNEL ─────────────────────────────────────────────

  const channels = new Map();

  for (const client of clientList) {
    const channelName = client.channelName;

    if (!channels.has(channelName)) {
      channels.set(channelName, []);
    }

    channels.get(channelName).push(client.nickname);
  }

  // Sort channels alphabetically, but keep Default Channel at the bottom.
  const sortedChannels = [...channels.entries()].sort((a, b) => {
    const aDefault = a[0].toLowerCase() === 'default channel';
    const bDefault = b[0].toLowerCase() === 'default channel';

    if (aDefault && !bDefault) return 1;
    if (!aDefault && bDefault) return -1;

    return a[0].localeCompare(
      b[0],
      undefined,
      { sensitivity: 'base' }
    );
  });

  let channelDisplay = '';

  for (const [channelName, nicknames] of sortedChannels) {
    nicknames.sort((a, b) =>
      a.localeCompare(
        b,
        undefined,
        { sensitivity: 'base' }
      )
    );

    const icon =
      channelName.toLowerCase() === 'default channel'
        ? '🔊'
        : '🎮';

    channelDisplay +=
      `**${icon} ${channelName}**\n` +
      nicknames.map(n => `• **${n}**`).join('\n') +
      '\n\n';
  }

  embed.addFields({
    name: 'Users Online',
    value: count > 0
      ? channelDisplay.trim()
      : '*No users currently connected*',
    inline: false,
  });

  return embed;
}

function updateBotActivity(count) {
  if (count === lastStatusCount) return;

  const label = count === 1 ? 'user' : 'users';

  const text = count > 0
    ? `${count} ${label} on TeamSpeak`
    : 'TeamSpeak — no users online';

  discord.user.setActivity(text, {
    type: ActivityType.Watching
  });

  lastStatusCount = count;

  console.log(
    `[Discord] Bot activity set to: "Watching ${text}"`
  );
}

async function lockChannel(channel) {
  try {
    const everyoneRole = channel.guild.roles.everyone;

    await channel.permissionOverwrites.edit(everyoneRole, {
      [PermissionsBitField.Flags.SendMessages]: false,
      [PermissionsBitField.Flags.AddReactions]: false,
      [PermissionsBitField.Flags.CreatePublicThreads]: false,
      [PermissionsBitField.Flags.CreatePrivateThreads]: false,
      [PermissionsBitField.Flags.ViewChannel]: true,
    });

    console.log(
      '[Discord] Channel locked to read-only for @everyone'
    );

  } catch (err) {
    console.error(
      '[Discord] Failed to lock channel:',
      err.message
    );
  }
}

async function purgeChannel(channel) {
  try {
    let fetched;

    do {
      fetched = await channel.messages.fetch({ limit: 100 });

      if (fetched.size > 0) {
        const recent = fetched.filter(
          m => Date.now() - m.createdTimestamp <
            14 * 24 * 60 * 60 * 1000
        );

        const old = fetched.filter(
          m => Date.now() - m.createdTimestamp >=
            14 * 24 * 60 * 60 * 1000
        );

        if (recent.size > 0) {
          await channel.bulkDelete(recent, true);
        }

        for (const [, msg] of old) {
          await msg.delete().catch(() => {});
        }
      }

    } while (fetched.size > 0);

    console.log('[Discord] Channel purged');

  } catch (err) {
    console.error(
      '[Discord] Failed to purge channel:',
      err.message
    );
  }
}

async function initStatusMessage(channel, clients, online = true) {
  await lockChannel(channel);

  const embed = buildStatusEmbed(clients, online);

  try {
    const messages = await channel.messages.fetch({
      limit: 50
    });

    const existing = messages.find(
      m =>
        m.author.id === discord.user.id &&
        m.embeds.length > 0
    );

    if (existing) {
      statusMessage = existing;

      await statusMessage.edit({
        embeds: [embed]
      });

      console.log(
        '[Discord] Existing status message updated'
      );

    } else {
      statusMessage = await channel.send({
        embeds: [embed]
      });

      console.log(
        '[Discord] Status message created'
      );
    }

  } catch (err) {
    console.error(
      '[Discord] Failed to initialize status message:',
      err.message
    );
  }
}

async function updateStatusMessage(clients, online = true) {
  try {
    const embed = buildStatusEmbed(clients, online);

    if (!statusMessage) {
      const channel = await discord.channels.fetch(
        config.STATUS_CHANNEL_ID
      );

      if (!channel) return;

      const messages = await channel.messages.fetch({
        limit: 10
      });

      const existing = messages.find(
        m =>
          m.author.id === discord.user.id &&
          m.embeds.length > 0
      );

      if (existing) {
        statusMessage = existing;

        await statusMessage.edit({
          embeds: [embed]
        });

      } else {
        statusMessage = await channel.send({
          embeds: [embed]
        });

        console.log(
          '[Discord] Status message (re)created in updateStatusMessage'
        );
      }

    } else {
      await statusMessage.edit({
        embeds: [embed]
      });
    }

  } catch (err) {
    console.error(
      '[Discord] Failed to edit or (re)create status message:',
      err.message
    );
  }
}

// ─── STATE COMPARISON ───────────────────────────────────────────────────────

function serverStateChanged(previous, current) {
  if (previous.size !== current.size) {
    return true;
  }

  for (const [clientId, currentClient] of current) {
    const previousClient = previous.get(clientId);

    if (!previousClient) {
      return true;
    }

    if (
      previousClient.nickname !== currentClient.nickname ||
      previousClient.cid !== currentClient.cid ||
      previousClient.channelName !== currentClient.channelName
    ) {
      return true;
    }
  }

  return false;
}

// ─── POLL LOOP ───────────────────────────────────────────────────────────────

async function poll() {
  try {
    const { clients } = await fetchTSServerState();

    const changed =
      tsOnline !== true ||
      serverStateChanged(previousClients, clients);

    if (changed) {

      // Detect joins/leaves
      const joined = [];

      for (const [clientId, client] of clients) {
        if (!previousClients.has(clientId)) {
          joined.push(client);
        }
      }

      const left = [];

      for (const [clientId, client] of previousClients) {
        if (!clients.has(clientId)) {
          left.push(client);
        }
      }

      joined.forEach(client => {
        console.log(
          `[TS6] JOIN: ${client.nickname} (${client.channelName})`
        );
      });

      left.forEach(client => {
        console.log(
          `[TS6] LEAVE: ${client.nickname}`
        );
      });

      // Detect channel moves
      for (const [clientId, currentClient] of clients) {
        const previousClient = previousClients.get(clientId);

        if (
          previousClient &&
          previousClient.cid !== currentClient.cid
        ) {
          console.log(
            `[TS6] MOVE: ${currentClient.nickname} ` +
            `${previousClient.channelName} → ${currentClient.channelName}`
          );
        }
      }

      await updateStatusMessage(clients, true);

      updateBotActivity(clients.size);

      if (tsOnline !== true) {
        console.log('[TS6] Server is ONLINE');
      }
    }

    previousClients = clients;
    tsOnline = true;

  } catch (err) {
    console.error('[Poll] Error:', err.message);

    if (tsOnline !== false) {
      console.log('[TS6] Server is OFFLINE');

      previousClients = new Map();
      tsOnline = false;

      await updateStatusMessage(new Map(), false);

      discord.user.setActivity(
        'TeamSpeak — offline',
        {
          type: ActivityType.Watching
        }
      );

      lastStatusCount = -1;
    }
  }
}

// ─── STARTUP ─────────────────────────────────────────────────────────────────

discord.once('clientReady', async () => {

  console.log(
    `[Discord] Logged in as ${discord.user.tag}`
  );

  console.log(
    `[Config] Polling TS6 at ${config.TS_API_BASE} ` +
    `every ${config.POLL_INTERVAL / 1000}s`
  );

  try {

    const { clients } = await fetchTSServerState();

    previousClients = clients;
    tsOnline = true;

    console.log(
      `[TS6] Bot started. ${clients.size} user(s) currently online:`
    );

    clients.forEach(client => {
      console.log(
        `  - ${client.nickname} (${client.channelName})`
      );
    });

    const channel = await discord.channels.fetch(
      config.STATUS_CHANNEL_ID
    );

    if (channel) {
      await initStatusMessage(
        channel,
        clients
      );
    }

    updateBotActivity(clients.size);

  } catch (err) {

    console.error(
      '[Startup] TS6 server is offline:',
      err.message
    );

    previousClients = new Map();
    tsOnline = false;

    try {

      const channel = await discord.channels.fetch(
        config.STATUS_CHANNEL_ID
      );

      if (channel) {
        await initStatusMessage(
          channel,
          new Map(),
          false
        );
      }

      discord.user.setActivity(
        'TeamSpeak — offline',
        {
          type: ActivityType.Watching
        }
      );

    } catch (discordErr) {

      console.error(
        '[Startup] Failed to create offline status:',
        discordErr.message
      );
    }
  }

  setInterval(
    poll,
    config.POLL_INTERVAL
  );
});

discord.on(
  'error',
  err => console.error(
    '[Discord] Client error:',
    err
  )
);

discord.login(
  config.DISCORD_TOKEN
);