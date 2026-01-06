# Soundtrack Your Brand API Integration Fix

## Overview
This document explains the fixes applied to the Soundtrack Your Brand integration, including proper authentication, API usage, and the ability to delete API tokens.

## What Was Fixed

### 1. Authentication Method
- Changed from Bearer token to Basic Authentication
- Now uses proper GraphQL API integration
- Updated error handling and user feedback

### 2. API Token Management
- Added ability to delete API configuration
- Improved token validation
- Better security practices

### 3. Sound Zones
- Updated terminology from "players" to "sound zones"
- Better zone management interface
- Improved visibility controls

## Quick Start

1. Visit `/soundtrack` configuration page
2. Request API access at: https://api.soundtrackyourbrand.com/v2/docs
3. Enter your Base64-encoded API token
4. Click "Save API Token" to validate and sync sound zones
5. Select which zones bartenders can control

## Documentation

See the official Soundtrack API documentation for more details:
- API Docs: https://api.soundtrackyourbrand.com/v2/docs
- Example App: https://github.com/soundtrackyourbrand/soundtrack_api-example_app

