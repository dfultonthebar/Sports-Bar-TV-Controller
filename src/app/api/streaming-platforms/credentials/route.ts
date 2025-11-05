/**
 * Streaming Credentials API
 * ENHANCED: Now uses AES-256-GCM encryption for storing credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt, encryptToString, decryptFromString } from '@/lib/security/encryption';
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware';

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic';

const CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'streaming-credentials.json');

interface StreamingCredential {
  id: string;
  platformId: string;
  username: string;
  passwordHash: string; // Now encrypted with AES-256-GCM
  encrypted: boolean; // Always true with new encryption
  encryptionVersion: string; // Track encryption version
  lastUpdated: string;
  status: 'active' | 'expired' | 'error';
  lastSync?: string;
}

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load credentials from file
function loadCredentials(): StreamingCredential[] {
  try {
    ensureDataDirectory();
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    logger.error('Error loading credentials:', error);
    return [];
  }
}

// Save credentials to file
function saveCredentials(credentials: StreamingCredential[]): boolean {
  try {
    ensureDataDirectory();
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
    return true;
  } catch (error) {
    logger.error('Error saving credentials:', error);
    return false;
  }
}

/**
 * Decrypt password from stored credential
 * Handles both old base64 encoding and new AES-256-GCM encryption
 */
function decryptPassword(credential: StreamingCredential): string {
  try {
    // New encryption method (AES-256-GCM)
    if (credential.encryptionVersion === 'aes-256-gcm') {
      return decryptFromString(credential.passwordHash);
    }

    // Legacy base64 encoding (for backwards compatibility)
    if (credential.encrypted && credential.passwordHash) {
      return Buffer.from(credential.passwordHash, 'base64').toString();
    }

    // Plain text (should not happen in production)
    return credential.passwordHash;
  } catch (error) {
    logger.error('Error decrypting password:', error);
    throw new Error('Failed to decrypt password');
  }
}

/**
 * Encrypt password using AES-256-GCM
 */
function encryptPassword(password: string): string {
  return encryptToString(password);
}

/**
 * GET /api/streaming-platforms/credentials
 * Retrieve all stored credentials (without passwords)
 */
export async function GET(request: NextRequest) {
  try {
    const credentials = loadCredentials();

    // Return credentials without sensitive data
    const safeCredentials = credentials.map(cred => ({
      id: cred.id,
      platformId: cred.platformId,
      username: cred.username,
      encrypted: cred.encrypted,
      encryptionVersion: cred.encryptionVersion,
      lastUpdated: cred.lastUpdated,
      status: cred.status,
      lastSync: cred.lastSync,
    }));

    return NextResponse.json({
      success: true,
      credentials: safeCredentials,
    });
  } catch (error) {
    logger.error('Error getting credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load credentials' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/streaming-platforms/credentials
 * Add or update streaming platform credentials
 */
export async function POST(request: NextRequest) {
  // QUICK WIN 3: Apply rate limiting to authentication endpoint
  const rateLimitCheck = await withRateLimit(request, 'AUTH')

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.streamingCredentials)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  // Security: use validated data
  const { data } = bodyValidation
  const { platformId, username, password, rememberMe } = data
  try {
    ;

    if (!platformId || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate encryption is configured
    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Encryption not configured. Please set ENCRYPTION_KEY environment variable.'
        },
        { status: 500 }
      );
    }

    const credentials = loadCredentials();
    const existingIndex = credentials.findIndex(c => c.platformId === platformId);

    // Encrypt the password using AES-256-GCM
    const encryptedPassword = encryptPassword(password);

    const newCredential: StreamingCredential = {
      id: existingIndex >= 0 ? credentials[existingIndex].id : `cred_${Date.now()}`,
      platformId,
      username,
      passwordHash: encryptedPassword,
      encrypted: true,
      encryptionVersion: 'aes-256-gcm', // Track encryption version
      lastUpdated: new Date().toISOString(),
      status: 'active',
      lastSync: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      credentials[existingIndex] = newCredential;
    } else {
      credentials.push(newCredential);
    }

    if (saveCredentials(credentials)) {
      const jsonResponse = NextResponse.json({
        success: true,
        credential: {
          id: newCredential.id,
          platformId: newCredential.platformId,
          username: newCredential.username,
          encrypted: newCredential.encrypted,
          encryptionVersion: newCredential.encryptionVersion,
          lastUpdated: newCredential.lastUpdated,
          status: newCredential.status,
        },
      })
      return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
    } else {
      const jsonResponse = NextResponse.json(
        { success: false, error: 'Failed to save credentials' },
        { status: 500 }
      )
      return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
    }
  } catch (error) {
    logger.error('Error saving credentials:', error);
    const jsonResponse = NextResponse.json(
      {
        success: false,
        error: 'Failed to save credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  }
}

/**
 * DELETE /api/streaming-platforms/credentials
 * Remove streaming platform credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const { platformId } = await request.json();

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      );
    }

    const credentials = loadCredentials();
    const filteredCredentials = credentials.filter(c => c.platformId !== platformId);

    if (saveCredentials(filteredCredentials)) {
      return NextResponse.json({
        success: true,
        message: 'Credentials removed successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to remove credentials' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error removing credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove credentials' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/streaming-platforms/credentials/verify
 * Verify that credentials can be decrypted
 * Used for testing and migration
 */
export async function PUT(request: NextRequest) {
  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.streamingCredentials)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  // Security: use validated data
  const { data } = bodyValidation
  const { platformId } = data
  try {
    ;

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      );
    }

    const credentials = loadCredentials();
    const credential = credentials.find(c => c.platformId === platformId);

    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credentials not found' },
        { status: 404 }
      );
    }

    try {
      // Attempt to decrypt the password
      const decrypted = decryptPassword(credential);

      return NextResponse.json({
        success: true,
        message: 'Credentials verified successfully',
        encryptionVersion: credential.encryptionVersion,
        canDecrypt: true,
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to decrypt credentials',
        encryptionVersion: credential.encryptionVersion,
        canDecrypt: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    logger.error('Error verifying credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify credentials' },
      { status: 500 }
    );
  }
}
