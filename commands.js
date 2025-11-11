import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Minimal commands for muting/unmuting a user
const MUTE_COMMAND = {
  name: 'mute',
  description: 'Server-mute a user',
  options: [
    {
      type: 6, // USER
      name: 'user',
      description: 'The user to mute',
      required: true,
    },
  ],
};

const UNMUTE_COMMAND = {
  name: 'unmute',
  description: 'Server-unmute a user',
  options: [
    {
      type: 6, // USER
      name: 'user',
      description: 'The user to unmute',
      required: false,
    },
  ],
};

const ALL_COMMANDS = [MUTE_COMMAND, UNMUTE_COMMAND];

// Register commands (overwrites existing global commands)
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
