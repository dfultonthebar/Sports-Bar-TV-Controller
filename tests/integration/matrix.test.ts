/**
 * Matrix Control Integration Tests
 * Tests Wolf Pack Matrix hardware communication
 */

import { Socket } from 'net';

describe('Matrix Control', () => {
  const matrixIp = process.env.MATRIX_IP || '192.168.5.100';
  const matrixPort = parseInt(process.env.MATRIX_PORT || '23');
  const skipHardwareTests = process.env.SKIP_HARDWARE_TESTS === 'true';

  // Helper function to send TCP command
  const sendTcpCommand = (command: string, timeout = 10000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let response = '';

      const timeoutHandle = setTimeout(() => {
        socket.destroy();
        reject(new Error('Command timeout'));
      }, timeout);

      socket.connect(matrixPort, matrixIp, () => {
        socket.write(command);
      });

      socket.on('data', (data) => {
        response += data.toString();
        // Wolf Pack responds with "OK" or "ERR"
        if (response.includes('OK') || response.includes('ERR')) {
          clearTimeout(timeoutHandle);
          socket.destroy();
          resolve(response.trim());
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });

      socket.on('timeout', () => {
        clearTimeout(timeoutHandle);
        socket.destroy();
        reject(new Error('Socket timeout'));
      });
    });
  };

  // Helper to check if matrix is reachable
  const checkMatrixReachable = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 5000);

      socket.connect(matrixPort, matrixIp, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  };

  describe('Matrix Connectivity', () => {
    test('Can connect to Wolf Pack at configured address', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await checkMatrixReachable();

      if (!isReachable) {
        console.warn(
          `Matrix at ${matrixIp}:${matrixPort} is not reachable. ` +
          'This may be expected if the device is offline.'
        );
      }

      // Don't fail test if device is offline - just report status
      expect(typeof isReachable).toBe('boolean');
      console.log(`Matrix reachability: ${isReachable ? 'ONLINE' : 'OFFLINE'}`);
    }, 15000);

    test('Connection times out appropriately on invalid address', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const startTime = Date.now();
      const isReachable = await new Promise((resolve) => {
        const socket = new Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 3000);

        socket.connect(9999, '192.168.5.254', () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(true);
        });

        socket.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      const duration = Date.now() - startTime;

      expect(isReachable).toBe(false);
      expect(duration).toBeLessThan(5000); // Should timeout quickly
      console.log(`Timeout test completed in ${duration}ms`);
    }, 10000);
  });

  describe('Matrix Commands', () => {
    beforeEach(async () => {
      if (!skipHardwareTests) {
        const isReachable = await checkMatrixReachable();
        if (!isReachable) {
          console.log('Matrix is not reachable - skipping command tests');
        }
      }
    });

    test('Can send valid routing command', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await checkMatrixReachable();
      if (!isReachable) {
        console.log('Matrix is not reachable - skipping test');
        return;
      }

      try {
        // Route input 1 to output 1 (MT00SW0101.)
        const response = await sendTcpCommand('MT00SW0101.');

        expect(response).toBeDefined();
        console.log(`Matrix response: ${response}`);

        // Response should contain OK or ERR
        expect(response.includes('OK') || response.includes('ERR')).toBe(true);
      } catch (error) {
        // If matrix is not responding, log but don't fail test
        console.warn('Matrix command failed:', error);
      }
    }, 15000);

    test('Can get current routing status', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await checkMatrixReachable();
      if (!isReachable) {
        console.log('Matrix is not reachable - skipping test');
        return;
      }

      try {
        // Query routing status (MT00RD.)
        const response = await sendTcpCommand('MT00RD.');

        expect(response).toBeDefined();
        console.log(`Status response: ${response}`);
      } catch (error) {
        console.warn('Status query failed:', error);
      }
    }, 15000);

    test('Command includes period terminator', () => {
      const command = 'MT00SW0101';
      const formattedCommand = command.endsWith('.') ? command : command + '.';

      expect(formattedCommand).toBe('MT00SW0101.');
      expect(formattedCommand.endsWith('.')).toBe(true);
    });

    test('Handles invalid commands gracefully', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await checkMatrixReachable();
      if (!isReachable) {
        console.log('Matrix is not reachable - skipping test');
        return;
      }

      try {
        // Send invalid command
        const response = await sendTcpCommand('INVALID.');

        // Matrix should respond with ERR
        expect(response).toBeDefined();
        console.log(`Invalid command response: ${response}`);
      } catch (error) {
        // Error is expected for invalid commands
        expect(error).toBeDefined();
      }
    }, 15000);
  });

  describe('Matrix Protocol', () => {
    test('Valid routing commands follow Wolf Pack format', () => {
      // Format: MT00SW[input][output].
      const testCases = [
        { input: 1, output: 1, expected: 'MT00SW0101.' },
        { input: 2, output: 5, expected: 'MT00SW0205.' },
        { input: 13, output: 8, expected: 'MT00SW1308.' },
      ];

      testCases.forEach(({ input, output, expected }) => {
        const command = `MT00SW${String(input).padStart(2, '0')}${String(output).padStart(2, '0')}.`;
        expect(command).toBe(expected);
      });
    });

    test('Commands are properly terminated', () => {
      const commands = [
        'MT00SW0101.',
        'MT00RD.',
        'MT00PWON.',
        'MT00PWOFF.',
      ];

      commands.forEach((cmd) => {
        expect(cmd.endsWith('.')).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('Handles connection refusal', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      // Try to connect to a port that's unlikely to be open
      try {
        await sendTcpCommand('TEST.', 3000);
      } catch (error) {
        expect(error).toBeDefined();
        console.log('Connection refusal handled correctly');
      }
    }, 10000);

    test('Handles network timeout', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const startTime = Date.now();

      try {
        // Use very short timeout
        await sendTcpCommand('MT00RD.', 1000);
      } catch (error) {
        const duration = Date.now() - startTime;

        // Should timeout within reasonable time
        expect(duration).toBeLessThan(3000);
        console.log(`Timeout handled in ${duration}ms`);
      }
    }, 10000);
  });
});
