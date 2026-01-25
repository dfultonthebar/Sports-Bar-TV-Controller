/**
 * HTD TCP Client
 *
 * Handles TCP socket communication with HTD audio controllers via gateway
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';
import { logger } from '@sports-bar/logger';
import type { HTDPendingCommand } from './types';
import { HTD_NETWORK_CONFIG, HTD_RESPONSE } from './config';
import { formatCommandHex } from './htd-protocol';

export interface HTDTcpClientConfig {
  ipAddress: string;
  port: number;
  commandDelay: number;
}

export interface HTDTcpClientEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  data: (data: Buffer) => void;
}

/**
 * HTD TCP Client for network communication
 *
 * Features:
 * - Command queue with delay between commands
 * - Response buffering for multi-packet responses
 * - Automatic timeout handling
 * - Event-based connection status
 */
export class HTDTcpClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: HTDTcpClientConfig;
  private connected = false;
  private connecting = false;
  private responseBuffer = Buffer.alloc(0);
  private pendingCommand: HTDPendingCommand | null = null;
  private commandQueue: Array<{
    command: Buffer;
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  }> = [];
  private processingQueue = false;
  private lastCommandTime = 0;

  constructor(config: Partial<HTDTcpClientConfig> & { ipAddress: string }) {
    super();
    this.config = {
      ipAddress: config.ipAddress,
      port: config.port ?? HTD_NETWORK_CONFIG.DEFAULT_PORT,
      commandDelay: config.commandDelay ?? HTD_NETWORK_CONFIG.COMMAND_DELAY,
    };
  }

  /**
   * Connect to the HTD gateway
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.connecting = false;
        this.cleanup();
        reject(new Error(`Connection timeout to ${this.config.ipAddress}:${this.config.port}`));
      }, HTD_NETWORK_CONFIG.CONNECT_TIMEOUT);

      this.socket = new Socket();

      this.socket.on('connect', () => {
        clearTimeout(timeoutHandle);
        this.connecting = false;
        this.connected = true;
        logger.info(`[HTD] Connected to ${this.config.ipAddress}:${this.config.port}`);
        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        logger.error(`[HTD] Socket error: ${error.message}`);
        this.emit('error', error);
        if (this.connecting) {
          this.connecting = false;
          reject(error);
        }
      });

      this.socket.on('close', () => {
        this.handleDisconnect();
      });

      this.socket.on('timeout', () => {
        logger.warn('[HTD] Socket timeout');
        this.socket?.destroy();
      });

      this.socket.setTimeout(HTD_NETWORK_CONFIG.RESPONSE_TIMEOUT);

      logger.debug(`[HTD] Connecting to ${this.config.ipAddress}:${this.config.port}`);
      this.socket.connect(this.config.port, this.config.ipAddress);
    });
  }

  /**
   * Disconnect from the HTD gateway
   */
  async disconnect(): Promise<void> {
    if (!this.connected && !this.connecting) {
      return;
    }

    // Reject any pending commands
    if (this.pendingCommand) {
      this.pendingCommand.reject(new Error('Connection closed'));
      clearTimeout(this.pendingCommand.timeout);
      this.pendingCommand = null;
    }

    // Reject queued commands
    for (const cmd of this.commandQueue) {
      cmd.reject(new Error('Connection closed'));
    }
    this.commandQueue = [];

    this.cleanup();
    logger.info('[HTD] Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a command and wait for response
   *
   * @param command - Command buffer to send
   * @returns Response buffer
   */
  async sendCommand(command: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Send a command without waiting for response
   *
   * @param command - Command buffer to send
   */
  sendCommandNoWait(command: Buffer): void {
    if (!this.connected || !this.socket) {
      logger.error('[HTD] Cannot send command: not connected');
      return;
    }

    logger.debug(`[HTD] Sending (no-wait): ${formatCommandHex(command)}`);
    this.socket.write(command);
    this.lastCommandTime = Date.now();
  }

  /**
   * Process the command queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.commandQueue.length === 0) {
      return;
    }

    if (this.pendingCommand) {
      // Wait for pending command to complete
      return;
    }

    this.processingQueue = true;

    try {
      const queueItem = this.commandQueue.shift();
      if (!queueItem) {
        return;
      }

      // Enforce command delay
      const timeSinceLastCommand = Date.now() - this.lastCommandTime;
      if (timeSinceLastCommand < this.config.commandDelay) {
        await this.delay(this.config.commandDelay - timeSinceLastCommand);
      }

      if (!this.connected || !this.socket) {
        queueItem.reject(new Error('Not connected'));
        this.processingQueue = false;
        this.processQueue();
        return;
      }

      // Set up pending command with timeout
      const timeout = setTimeout(() => {
        if (this.pendingCommand) {
          logger.warn('[HTD] Command timeout');
          this.pendingCommand.reject(new Error('Command response timeout'));
          this.pendingCommand = null;
          this.responseBuffer = Buffer.alloc(0);
          this.processingQueue = false;
          this.processQueue();
        }
      }, HTD_NETWORK_CONFIG.RESPONSE_TIMEOUT);

      this.pendingCommand = {
        command: queueItem.command,
        resolve: queueItem.resolve,
        reject: queueItem.reject,
        timeout,
        timestamp: Date.now(),
      };

      // Send the command
      logger.debug(`[HTD] Sending: ${formatCommandHex(queueItem.command)}`);
      this.socket.write(queueItem.command);
      this.lastCommandTime = Date.now();
    } finally {
      // Will be set to false when response is received
      if (!this.pendingCommand) {
        this.processingQueue = false;
        this.processQueue();
      }
    }
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    logger.debug(`[HTD] Received: ${formatCommandHex(data)}`);

    // Emit raw data event
    this.emit('data', data);

    // Accumulate response data
    this.responseBuffer = Buffer.concat([this.responseBuffer, data]);

    // Check if we have a complete response
    if (this.isResponseComplete()) {
      if (this.pendingCommand) {
        clearTimeout(this.pendingCommand.timeout);
        this.pendingCommand.resolve(this.responseBuffer);
        this.pendingCommand = null;
      }

      this.responseBuffer = Buffer.alloc(0);
      this.processingQueue = false;
      this.processQueue();
    }
  }

  /**
   * Check if the response buffer contains a complete response
   */
  private isResponseComplete(): boolean {
    // For query response, expect at least header + one zone (14 bytes per zone)
    if (this.responseBuffer.length >= HTD_RESPONSE.HEADER_SIZE + HTD_RESPONSE.BYTES_PER_ZONE) {
      // Check for valid start byte
      if (this.responseBuffer[0] === HTD_RESPONSE.START_BYTE) {
        return true;
      }
    }

    // For control commands, response might be shorter (echo or ACK)
    if (this.responseBuffer.length >= 6) {
      return true;
    }

    return false;
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.cleanup();

    if (wasConnected) {
      logger.info('[HTD] Connection closed');
      this.emit('disconnected');
    }
  }

  /**
   * Clean up socket and state
   */
  private cleanup(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.connecting = false;
    this.responseBuffer = Buffer.alloc(0);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the IP address
   */
  getIpAddress(): string {
    return this.config.ipAddress;
  }

  /**
   * Get the port
   */
  getPort(): number {
    return this.config.port;
  }
}
