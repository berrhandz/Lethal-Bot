import 'dotenv/config';
import express from 'express';
import { verifyKeyMiddleware, InteractionType, InteractionResponseType } from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import { Client, GatewayIntentBits, ActivityType, Guild } from 'discord.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Track users in voice channels
const voiceChannelMembers = new Map();
// Initialize Discord client with basic intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});
//clear command cache

/*client.once('ready', async () => {
  console.log(`Bot ready ${client.user.tag}`)
  await client.application.commands.delete(''))
})*/

// Log any client errors
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.once('ready', () => {
  console.log('Discord bot is ready!');
});

client.on('connection', connect => {
  console.log(`Conenction was made by ${connect}`)
})
// Simple tracking of voice channel state only// Track voice channel members
client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = newState.guild.id;
  const userId = newState.member.user.id;

  if (!voiceChannelMembers.has(guildId)) {
    voiceChannelMembers.set(guildId, new Map());
  }

  const guildVoiceMembers = voiceChannelMembers.get(guildId);

  // Remove from old channel
  if (oldState.channelId) {
    const channelMembers = guildVoiceMembers.get(oldState.channelId) || new Set();
    channelMembers.delete(userId);
    if (channelMembers.size === 0) {
      guildVoiceMembers.delete(oldState.channelId);
    } else {
      guildVoiceMembers.set(oldState.channelId, channelMembers);
    }
  }


  // Add to new channel
  if (newState.channelId) {
    const channelMembers = guildVoiceMembers.get(newState.channelId) || new Set();
    channelMembers.add(userId);
    guildVoiceMembers.set(newState.channelId, channelMembers);
    console.log(guildVoiceMembers)
  }
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);

console.log('Starting server...');
console.log('PUBLIC_KEY:', process.env.PUBLIC_KEY ? 'Present' : 'Missing');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'Present' : 'Missing');
console.log('APP_ID:', process.env.APP_ID ? 'Present' : 'Missing');

// Use raw body for interactions so signature middleware can verify
app.use('/interactions', express.raw({ type: '*/*' }));

// Minimal logger

app.use((req, res, next) => {
  console.log('-->', req.method, req.path);
  next();
});

app.post(
  '/interactions',
  (req, res, next) => {
    console.log('sig headers:', {
      sig: Boolean(req.headers['x-signature-ed25519']),
      ts: Boolean(req.headers['x-signature-timestamp']),
    });
    next();
  },
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async (req, res) => {
    try {
      const { type, data, guild_id } = req.body;

      if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
      }

      if (type === InteractionType.APPLICATION_COMMAND) {
        const name = data.name;
        console.log(name)

        if (name === 'mute' || name === 'unmute') {
          const target = data.options && data.options[0] && data.options[0].value;
          console.log(target)

          // Handle muting entire voice channel if user is playing Lethal Company
          if (name === 'mute' && !target) {
            const guildMembers = voiceChannelMembers.get(guild_id);
            if (!guildMembers) {
              return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: 'No voice channels found in this server.', flags: 64 },
              });
            }

            // Find which voice channel the command issuer is in
            const memberVoiceChannel = Array.from(guildMembers.entries())
              .find(([channelId, members]) => members.has(req.body.member.user.id))?.[0];

            if (!memberVoiceChannel) {
              return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: 'You must be in a voice channel to use this command without specifying a user.', flags: 64 },
              });
            }

            const channelMembers = guildMembers.get(memberVoiceChannel);
            const playingMembers = playingLethalCompany.get(guild_id) || new Set();

            // Mute everyone who is playing Lethal Company
            for (const userId of channelMembers) {
              if (playingMembers.has(userId)) {
                await DiscordRequest(`guilds/${guild_id}/members/${userId}`, {
                  method: 'PATCH',
                  body: { mute: true },
                });
              }
            }

            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'Muted all Lethal Company players in your voice channel.' },
            });
          }

          // Handle single user mute/unmute
          if (!target) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'No target user provided.', flags: 64 },
            });
          }

          const mute = name === 'mute';

          await DiscordRequest(`guilds/${guild_id}/members/${target}`, {
            method: 'PATCH',
            body: { mute },
          });

          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `${mute ? 'Muted' : 'Unmuted'} <@${target}>.` },
          });
        }

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unknown command.' },
        });
      }

      return res.status(400).json({ error: 'unknown interaction type' });
    } catch (err) {
      console.error('Error processing interaction:', err);
      return res.status(500).json({ error: String(err) });
    }
  }
);


app.listen(PORT, () => console.log(`Listening on ${PORT}`));
