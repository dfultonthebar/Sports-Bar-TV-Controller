
// DirecTV Command Mapper

import { REMOTE_KEYS, SERIAL_COMMANDS } from './constants';
import type { DirecTVCommand } from './types';

export class CommandMapper {
  private commands: Map<string, DirecTVCommand[]> = new Map();

  constructor() {
    this.initializeCommands();
  }

  /**
   * Initialize default command mappings
   */
  private initializeCommands(): void {
    // Remote key commands (all models)
    Object.entries(REMOTE_KEYS).forEach(([name, code]) => {
      this.addCommand({
        id: '',
        model: 'all',
        commandType: 'remote_key',
        commandName: name.toLowerCase(),
        commandCode: code,
        endpoint: '/remote/processKey',
        parameters: { key: code },
        description: `Press ${name} button`,
        category: this.categorizeCommand(name),
      });
    });

    // Serial commands (all models)
    Object.entries(SERIAL_COMMANDS).forEach(([name, code]) => {
      this.addCommand({
        id: '',
        model: 'all',
        commandType: 'serial',
        commandName: name.toLowerCase(),
        commandCode: code,
        endpoint: '/serial/processCommand',
        parameters: { cmd: code },
        description: `Execute ${name} command`,
        category: 'system',
      });
    });

    // Tune command (all models)
    this.addCommand({
      id: '',
      model: 'all',
      commandType: 'tune',
      commandName: 'tune',
      commandCode: 'tune',
      endpoint: '/tv/tune',
      parameters: { major: 0 },
      description: 'Tune to channel',
      category: 'channel',
    });

    // Info commands (all models)
    this.addCommand({
      id: '',
      model: 'all',
      commandType: 'info',
      commandName: 'get_tuned',
      commandCode: 'getTuned',
      endpoint: '/tv/getTuned',
      description: 'Get currently tuned channel',
      category: 'info',
    });

    this.addCommand({
      id: '',
      model: 'all',
      commandType: 'info',
      commandName: 'get_version',
      commandCode: 'getVersion',
      endpoint: '/info/getVersion',
      description: 'Get SHEF version',
      category: 'info',
    });

    // Genie-specific commands
    this.addCommand({
      id: '',
      model: 'HR34',
      commandType: 'info',
      commandName: 'get_locations',
      commandCode: 'getLocations',
      endpoint: '/info/getLocations',
      description: 'Get client locations',
      category: 'info',
    });

    this.addCommand({
      id: '',
      model: 'HR44',
      commandType: 'info',
      commandName: 'get_locations',
      commandCode: 'getLocations',
      endpoint: '/info/getLocations',
      description: 'Get client locations',
      category: 'info',
    });

    this.addCommand({
      id: '',
      model: 'HR54',
      commandType: 'info',
      commandName: 'get_locations',
      commandCode: 'getLocations',
      endpoint: '/info/getLocations',
      description: 'Get client locations',
      category: 'info',
    });
  }

  /**
   * Add a command to the mapper
   */
  private addCommand(command: DirecTVCommand): void {
    const key = `${command.model}:${command.commandType}:${command.commandName}`;
    const existing = this.commands.get(key) || [];
    existing.push(command);
    this.commands.set(key, existing);
  }

  /**
   * Get command for a specific model
   */
  getCommand(model: string, commandType: string, commandName: string): DirecTVCommand | undefined {
    // Try model-specific command first
    const modelKey = `${model}:${commandType}:${commandName}`;
    const modelCommands = this.commands.get(modelKey);
    if (modelCommands && modelCommands.length > 0) {
      return modelCommands[0];
    }

    // Fall back to 'all' models
    const allKey = `all:${commandType}:${commandName}`;
    const allCommands = this.commands.get(allKey);
    if (allCommands && allCommands.length > 0) {
      return allCommands[0];
    }

    return undefined;
  }

  /**
   * Get all commands for a model
   */
  getCommandsForModel(model: string): DirecTVCommand[] {
    const commands: DirecTVCommand[] = [];

    // Get model-specific commands
    for (const [key, cmds] of this.commands.entries()) {
      if (key.startsWith(`${model}:`)) {
        commands.push(...cmds);
      }
    }

    // Get 'all' model commands
    for (const [key, cmds] of this.commands.entries()) {
      if (key.startsWith('all:')) {
        commands.push(...cmds);
      }
    }

    return commands;
  }

  /**
   * Categorize command based on name
   */
  private categorizeCommand(name: string): string {
    const upperName = name.toUpperCase();

    if (upperName.includes('POWER')) return 'power';
    if (['UP', 'DOWN', 'LEFT', 'RIGHT', 'SELECT', 'BACK', 'EXIT'].includes(upperName)) return 'navigation';
    if (['MENU', 'GUIDE', 'INFO', 'LIST'].includes(upperName)) return 'menu';
    if (upperName.includes('CHAN') || upperName.includes('PREV')) return 'channel';
    if (upperName.includes('NUM_') || upperName === 'DASH' || upperName === 'ENTER') return 'numeric';
    if (['PLAY', 'PAUSE', 'STOP', 'REW', 'FFWD', 'RECORD', 'REPLAY', 'ADVANCE'].includes(upperName)) return 'playback';
    if (['RED', 'GREEN', 'YELLOW', 'BLUE'].includes(upperName)) return 'color';

    return 'other';
  }

  /**
   * Get all commands
   */
  getAllCommands(): DirecTVCommand[] {
    const allCommands: DirecTVCommand[] = [];
    for (const cmds of this.commands.values()) {
      allCommands.push(...cmds);
    }
    return allCommands;
  }
}
