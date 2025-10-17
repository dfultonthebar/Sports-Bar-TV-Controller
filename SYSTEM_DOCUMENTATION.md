Here's the result of running `cat -n` on /home/ubuntu/github_repos/tv-controller/SYSTEM_DOCUMENTATION.md:
     1	# Sports Bar TV Controller - System Documentation
     2	
     3	**Version:** 2.3  
     4	**Last Updated:** October 17, 2025  
     5	**Status:** Production Ready
     6	
     7	---
     8	
     9	# ⚠️ MUST READ DOCUMENTATION - ESSENTIAL REFERENCE MATERIALS
    10	
    11	**CRITICAL:** Before making ANY changes to the system, especially UI/styling changes, you MUST review these essential documentation files located in the `docs/` directory:
    12	
    13	## Color Scheme & Styling Standards
    14	- **COLOR_SCHEME_STANDARD.md** - Official color palette and usage guidelines
    15	- **COLOR_SCHEME_STANDARD.pdf** - PDF version of color standards
    16	- **COLOR_STANDARDIZATION_SUMMARY.md** - Summary of color standardization implementation
    17	- **COLOR_STANDARDIZATION_SUMMARY.pdf** - PDF version of standardization summary
    18	
    19	## System Architecture & Performance
    20	- **SUBSCRIPTION_POLLING_IMPLEMENTATION.md** - Subscription polling system details
    21	- **SUBSCRIPTION_POLLING_IMPLEMENTATION.pdf** - PDF version of polling implementation
    22	- **SYSTEM_OPTIMIZATION_SUMMARY.md** - System-wide optimization documentation
    23	
    24	## SSH Connection & Remote Access
    25	- **SSH_OPTIMIZATION_GUIDE.md** - Comprehensive guide for efficient SSH connections to remote server
    26	  - Solves SSH connection hanging issues
    27	  - Provides optimized connection methods (heredoc, SSH config, control sockets)
    28	  - Essential for automation and reliable remote server operations
    29	  - Includes connection multiplexing and performance optimization techniques
    30	
    31	## Why These Documents Matter
    32	These documents contain:
    33	- **Approved color palettes** that ensure readability and consistency
    34	- **Component styling standards** that prevent UI regressions
    35	- **Performance optimization guidelines** that maintain system efficiency
    36	- **Implementation patterns** that have been tested and validated
    37	
    38	**⚠️ WARNING:** Ignoring these standards can result in:
    39	- Unreadable text and poor contrast (Q&A page issues)
    40	- Broken UI components (Matrix page display issues)
    41	- Reverted changes (Global Cache device page problems)
    42	- Inconsistent user experience across the application
    43	
    44	**📍 Documentation Location:** `/home/ubuntu/Sports-Bar-TV-Controller-local/docs/` (local) or `/root/sports-bar-tv-controller/docs/` (production server)
    45	
    46	---
    47	
    48	## Quick Access Information
    49	
    50	### Server Access
    51	- **Host:** 24.123.87.42
    52	- **SSH Port:** 224
    53	- **RDP Port:** 3389
    54	- **Application Port:** **3000** (HTTP)
    55	- **Username:** ubuntu
    56	- **Password:** 6809233DjD$$$ (THREE dollar signs)
    57	- **Application URL:** http://24.123.87.42:3000
    58	
    59	**SSH Connection:**
    60	```bash
    61	ssh -p 224 ubuntu@24.123.87.42
    62	```
    63	
    64	**RDP Connection:**
    65	- **Purpose:** GUI access to Atlas device local network (192.168.5.101)
    66	- **Host:** 24.123.87.42
    67	- **Port:** 3389
    68	- **Username:** ubuntu
    69	- **Password:** 6809233DjD$$$ (THREE dollar signs)
    70	- **Use Case:** Access Atlas device web interface at http://192.168.5.101 through remote desktop
    71	- **Setup:** RDP server configured on remote server for GUI-based Atlas device management
    72	
    73	**RDP Connection Instructions:**
    74	
    75	*Windows:*
    76	```
    77	1. Open Remote Desktop Connection (mstsc.exe)
    78	2. Computer: 24.123.87.42:3389
    79	3. Username: ubuntu
    80	4. Password: 6809233DjD$$$
    81	5. Connect and access Atlas device at 192.168.5.101 in browser
    82	```
    83	
    84	*macOS:*
    85	```
    86	1. Install Microsoft Remote Desktop from App Store
    87	2. Add PC with hostname: 24.123.87.42:3389
    88	3. User account: ubuntu
    89	4. Password: 6809233DjD$$$
    90	5. Connect and access Atlas device at 192.168.5.101 in browser
    91	```
    92	
    93	*Linux:*
    94	```bash
    95	# Using Remmina
    96	remmina -c rdp://ubuntu@24.123.87.42:3389
    97	
    98	# Using xfreerdp
    99	xfreerdp /v:24.123.87.42:3389 /u:ubuntu /p:'6809233DjD$$$' /size:1920x1080
   100	```
   101	
   102	### GitHub Repository
   103	- **Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
   104	- **Development Project Path:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller`
   105	- **Production Server Path:** `/home/ubuntu/Sports-Bar-TV-Controller`
   106	- **PM2 Process Name:** `sports-bar-tv`

---

## 🔴 ACTIVE ISSUES & FIXES

### Issue #1: Atlas Audio Processor Configuration Error (October 17, 2025)

**Status:** 🔧 IN PROGRESS - Fix being deployed  
**Priority:** HIGH  
**Component:** Atlas Audio Control Configuration Page

#### Error Details
- **Error Type:** `TypeError: Cannot read properties of undefined (reading 'length')`
- **Location:** Audio Control Center → Atlas System → Configuration tab
- **File:** `src/components/AtlasProgrammingInterface.tsx` (line 1289)
- **When Occurs:** After configuration is successfully fetched from the Atlas processor API

#### Console Logs
```
5746-57ad8c46598b4100.js:1 Dynamic Atlas configuration loaded: {processor: 'Graystone ', model: 'AZMP8', matrixInputs: 4, atlasInputs: 8, zones: 8, …}
3523-ae6ef65541545892.js:1 [Atlas Config] Fetching configuration for processor: cmgv9nms5000026tc4g5tn029
3523-ae6ef65541545892.js:1 [Atlas Config] Received configuration: {success: true, inputs: Array(8), outputs: Array(8), scenes: Array(3), messages: Array(0)}
3523-ae6ef65541545892.js:1 [Atlas Config] Configuration loaded successfully
2117-b43323754369e4b9.js:1 TypeError: Cannot read properties of undefined (reading 'length')
```

#### Root Cause Analysis
The error occurs during the rendering of the Input Configuration section when trying to display routing checkboxes. Specifically:

1. **API Data Structure Issue:** When configuration is fetched from `/api/atlas/configuration`, the saved JSON may not include the `routing` property for inputs, or it may be `null/undefined`
2. **Missing Data Normalization:** The component doesn't normalize fetched data to ensure all required properties exist
3. **Unsafe Property Access:** At line 1289, the code attempts to access `input.routing.includes(output.id)` without checking if `routing` exists
4. **Method Chain Failure:** The `.includes()` method internally accesses `.length`, causing the error when `routing` is undefined

**Problem Code:**
```typescript
// Line 1289 in AtlasProgrammingInterface.tsx
checked={input.routing.includes(output.id)}  // ❌ Fails if routing is undefined
```

#### The Fix Applied
1. **Data Normalization in fetchConfiguration():**
   - Ensure all fetched inputs have a `routing` array property
   - Map over inputs to add `routing: []` if missing

2. **Defensive Rendering:**
   - Use optional chaining with fallback: `input.routing?.includes(output.id) || false`
   - Prevents error if routing is undefined

3. **Updated Code:**
```typescript
// Normalize inputs to ensure routing array exists
const normalizedInputs = (config.inputs || generateDefaultInputs()).map((input: InputConfig) => ({
  ...input,
  routing: input.routing || []
}))
setInputs(normalizedInputs)

// Safe routing check with optional chaining
checked={input.routing?.includes(output.id) || false}
```

#### Hardware Configuration
- **Atlas Processor:** Graystone AZMP8
- **IP Address:** 192.168.5.101
- **Credentials:** admin/6809233DjD$$$
- **Model:** AZMP8 (8 zones with processing)
- **Inputs:** 8
- **Outputs:** 8

#### Testing Requirements
- ✅ Verify configuration page loads without errors
- ✅ Verify input routing checkboxes display correctly
- ✅ Verify routing can be modified and saved
- ✅ Verify configuration persists after save/reload
- ✅ Test with actual Atlas processor at 192.168.5.101
- ✅ Verify all tabs (Inputs, Outputs, Scenes, Messages) load correctly

#### Related Files
- `src/components/AtlasProgrammingInterface.tsx` - Main component with the fix
- `src/app/audio-control/page.tsx` - Parent page that uses the component
- `src/app/api/atlas/configuration/route.ts` - API endpoint for configuration
- `data/atlas-configs/*.json` - Saved configuration files

#### Fix Timeline
- **Issue Discovered:** October 17, 2025, 10:53 PM
- **Root Cause Identified:** October 17, 2025, 11:25 PM
- **Fix Applied:** October 17, 2025, 11:30 PM
- **Deployment:** In Progress
- **Testing:** Pending

   107	- **GitHub Token:** Stored securely in server environment (not documented for security)
   108	
   109	### Quick Deployment to Production
   110	```bash
   111	# SSH into production server
   112	ssh -p 224 ubuntu@24.123.87.42
   113	
   114	# Navigate to project (PRODUCTION PATH)
   115	cd /home/ubuntu/Sports-Bar-TV-Controller
   116	
   117	# Pull latest changes
   118	git pull origin main
   119	
   120	# Install dependencies
   121	npm install
   122	
   123	# Generate Prisma Client
   124	npx prisma generate
   125	
   126	# Build application
   127	npm run build
   128	
   129	# Restart application (PM2 process name: sports-bar-tv)
   130	pm2 restart sports-bar-tv
   131	
   132	# Check logs
   133	pm2 logs sports-bar-tv
   134	```
   135	
   136	---
   137	
   138	## AI System Access
   139	
   140	**IMPORTANT:** This section contains credentials for AI assistants to access and manage the system autonomously. These credentials are intentionally documented here for future AI access.
   141	
   142	### System Access Credentials
   143	
   144	- **Web Interface:** http://24.123.87.42:3000/
   145	- **SSH Host:** 24.123.87.42
   146	- **SSH Port:** 224
   147	- **SSH Username:** ubuntu
   148	- **SSH Password:** 6809233DjD$$$ (THREE dollar signs)
   149	- **Project Directory:** /home/ubuntu/Sports-Bar-TV-Controller
   150	- **GitHub Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
   151	
   152	### Device Information
   153	
   154	- **Fire TV Cube IP Address:** 192.168.5.131
   155	  - Used for ADS bridge configuration
   156	  - Connected to network for remote control
   157	  - Integration with matrix switcher system
   158	
   159	### SSH Connection Command
   160	
   161	```bash
   162	ssh -p 224 ubuntu@24.123.87.42
   163	```
   164	
   165	### Quick Access for AI Assistants
   166	
   167	1. **Access System:**
   168	   ```bash
   169	   ssh -p 224 ubuntu@24.123.87.42
   170	   # Password: 6809233DjD$$$
   171	   ```
   172	
   173	2. **Navigate to Project:**
   174	   ```bash
   175	   cd /home/ubuntu/Sports-Bar-TV-Controller
   176	   ```
   177	
   178	3. **View Application:**
   179	   - Open browser to: http://24.123.87.42:3000/
   180	
   181	4. **Manage Services:**
   182	   ```bash
   183	   # View logs
   184	   pm2 logs sports-bar-tv
   185	   
   186	   # Restart application
   187	   pm2 restart sports-bar-tv
   188	   
   189	   # Check status
   190	   pm2 status
   191	   ```
   192	
   193	### Notes for AI Assistants
   194	
   195	- **Password has THREE dollar signs** at the end: 6809233DjD$$$
   196	- System runs on Intel NUC13ANHi5 hardware
   197	- Application managed via PM2 process manager
   198	- Database: PostgreSQL with Prisma ORM
   199	- Web framework: Next.js 14 with TypeScript
   200	- Always pull latest changes before making modifications
   201	- Use PM2 to restart after code updates
   202	
   203	---
   204	
   205	## Database & Prisma Setup
   206	
   207	### Database Configuration
   208	- **Type:** PostgreSQL
   209	- **Connection:** Configured in `.env` file
   210	- **ORM:** Prisma
   211	
   212	### Prisma Commands
   213	```bash
   214	# Generate Prisma Client
   215	npx prisma generate
   216	
   217	# Run migrations
   218	npx prisma migrate dev
   219	
   220	# Deploy migrations (production)
   221	npx prisma migrate deploy
   222	
   223	# Open Prisma Studio (database browser)
   224	npx prisma studio
   225	
   226	# Check migration status
   227	npx prisma migrate status
   228	```
   229	
   230	### Database Schema Location
   231	- **Schema File:** `prisma/schema.prisma`
   232	- **Migrations:** `prisma/migrations/`
   233	
   234	### Key Database Models
   235	- `MatrixOutput` - TV display outputs
   236	- `MatrixInput` - Video sources
   237	- `WolfpackConfig` - Matrix switcher configuration
   238	- `AudioProcessor` - Atlas audio configuration
   239	- `IndexedFile` - AI Hub codebase files
   240	- `QAPair` - AI Hub Q&A training data
   241	- `TrainingDocument` - AI Hub training documents
   242	- `ApiKey` - AI provider API keys
   243	- `TODO` - Task management
   244	
   245	---
   246	
   247	## System Overview
   248	
   249	The Sports Bar TV Controller is a comprehensive web application designed to manage TV displays, matrix video routing, and sports content scheduling for sports bar environments.
   250	
   251	### Technology Stack
   252	- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
   253	- **Backend:** Next.js API Routes, Prisma ORM
   254	- **Database:** PostgreSQL
   255	- **Hardware Integration:** 
   256	  - Wolfpack HDMI Matrix Switchers (via HTTP API)
   257	  - Atlas AZMP8 Audio Processor (via HTTP API)
   258	- **Process Management:** PM2
   259	- **AI Integration:** Multiple AI providers (Ollama, Abacus AI, OpenAI, Anthropic, X.AI)
   260	
   261	---
   262	
   263	# Application Features by Tab
   264	
   265	## 1. Dashboard (Home)
   266	
   267	### Overview
   268	Main landing page providing quick access to all system features and current system status.
   269	
   270	### Features
   271	- **System Status** - "Server Online" indicator with operational status
   272	- **Quick Access Cards:**
   273	  - AI Hub - Unified AI management & assistance
   274	  - Sports Guide - Find where to watch sports
   275	  - Remote Control - Control TVs and audio systems
   276	  - System Admin - Logs, backups, sync & tests
   277	
   278	### Navigation
   279	- Direct access to all major subsystems
   280	- System health indicators
   281	- Recent activity display
   282	
   283	### API Endpoints
   284	- N/A (frontend only)
   285	
   286	---
   287	
   288	## 2. Video Matrix / Matrix Control
   289	
   290	### Overview
   291	Comprehensive video routing system for managing HDMI matrix switchers and TV displays.
   292	
   293	### Features
   294	
   295	#### Output Configuration
   296	- **Outputs 1-4 (TV 01-04)**: Full matrix outputs with complete controls
   297	  - Power on/off toggle button (green when on, gray when off)
   298	  - Active/inactive checkbox
   299	  - Label field (TV 01, TV 02, TV 03, TV 04)
   300	  - Resolution dropdown (1080p, 4K, 720p)
   301	  - Audio output field
   302	  - Full Wolfpack integration
   303	
   304	- **Outputs 5-32**: Regular matrix outputs with full controls
   305	
   306	- **Outputs 33-36 (Matrix 1-4)**: Audio routing outputs with special controls
   307	  - Used for Atlas audio processor integration
   308	  - Video input selection affects audio routing
   309	
   310	#### Input Configuration
   311	- Configure 32 video sources
   312	- Custom labeling (e.g., "Cable Box 1", "Apple TV")
   313	- Enable/disable individual inputs
   314	
   315	#### TV Selection System
   316	Granular control over which TVs participate in automated schedules:
   317	- `dailyTurnOn` - Boolean flag for morning schedule participation
   318	- `dailyTurnOff` - Boolean flag for "all off" command participation
   319	- Configured per output in the database
   320	
   321	### API Endpoints
   322	
   323	#### GET/POST `/api/matrix/outputs`
   324	- **GET**: Retrieve all matrix outputs
   325	- **POST**: Update output configuration
   326	- **Body**: `{ outputNumber, label, enabled, dailyTurnOn, dailyTurnOff }`
   327	
   328	#### GET `/api/matrix/outputs-schedule`
   329	Retrieve outputs with schedule participation flags
   330	
   331	#### POST `/api/matrix/route`
   332	Route a source to an output:
   333	```json
   334	{
   335	  "input": 5,
   336	  "output": 33
   337	}
   338	```
   339	
   340	#### POST `/api/matrix/power`
   341	Control output power:
   342	```json
   343	{
   344	  "output": 33,
   345	  "state": "on"  // or "off"
   346	}
   347	```
   348	
   349	#### POST `/api/matrix/video-input-selection`
   350	Route video input to Matrix 1-4 audio outputs (33-36)
   351	
   352	### Database Schema
   353	
   354	#### MatrixOutput
   355	```prisma
   356	model MatrixOutput {
   357	  id              Int      @id @default(autoincrement())
   358	  outputNumber    Int      @unique
   359	  label           String
   360	  enabled         Boolean  @default(true)
   361	  isActive        Boolean  @default(false)
   362	  currentInput    Int?
   363	  audioOutput     Int?
   364	  resolution      String?
   365	  dailyTurnOn     Boolean  @default(true)
   366	  dailyTurnOff    Boolean  @default(true)
   367	  isMatrixOutput  Boolean  @default(true)
   368	  createdAt       DateTime @default(now())
   369	  updatedAt       DateTime @updatedAt
   370	}
   371	```
   372	
   373	#### MatrixInput
   374	```prisma
   375	model MatrixInput {
   376	  id          Int      @id @default(autoincrement())
   377	  inputNumber Int      @unique
   378	  label       String
   379	  enabled     Boolean  @default(true)
   380	  createdAt   DateTime @default(now())
   381	  updatedAt   DateTime @updatedAt
   382	}
   383	```
   384	
   385	### Troubleshooting
   386	
   387	**Matrix Switching Not Working:**
   388	1. Test connection in System Admin
   389	2. Verify output/input configuration
   390	3. Check Wolfpack matrix is powered on
   391	4. Verify network connectivity
   392	5. Test individual commands
   393	
   394	**TV Selection Not Working:**
   395	1. Verify database migration status
   396	2. Check output configuration flags
   397	3. Restart application
   398	
   399	---
   400	
   401	## 3. Atlas / Audio Control
   402	
   403	### Overview
   404	Multi-zone audio control system with Atlas AZMP8 processor integration.
   405	
   406	### Features
   407	
   408	#### Atlas AZMP8 Configuration
   409	- **IP Address:** 192.168.5.101:80
   410	- **Model:** AZMP8 (8 inputs, 8 outputs, 8 zones)
   411	- **Status:** Online and authenticated
   412	
   413	#### Configured Audio System
   414	**7 Inputs:**
   415	- Matrix 1-4 (video input audio)
   416	- Mic 1-2
   417	- Spotify
   418	
   419	**7 Outputs/Zones:**
   420	- Bar
   421	- Bar Sub
   422	- Dining Room
   423	- Party Room West
   424	- Party Room East
   425	- Patio
   426	- Bathroom
   427	
   428	**3 Scenes:** Preset configurations for different scenarios
   429	
   430	#### Dynamic Zone Labels
   431	- Zone labels update automatically based on selected video input
   432	- When video input is selected for Matrix 1-4, zone labels reflect the input name
   433	- Example: Selecting "Cable Box 1" updates zone label from "Matrix 1" to "Cable Box 1"
   434	- Falls back to "Matrix 1-4" when no video input selected
   435	
   436	#### Features
   437	- Real-time zone control
   438	- Volume adjustment per zone
   439	- Input selection per zone
   440	- Scene management
   441	- Configuration upload/download
   442	- Automatic timestamped backups
   443	
   444	### API Endpoints
   445	
   446	#### GET `/api/audio-processor`
   447	Get all configured audio processors
   448	
   449	#### POST `/api/atlas/upload-config`
   450	Upload configuration to Atlas processor
   451	
   452	#### GET `/api/atlas/download-config`
   453	Download current configuration from Atlas processor
   454	
   455	#### POST `/api/atlas/route-matrix-to-zone`
   456	Route audio from matrix output to zone
   457	
   458	#### GET `/api/atlas/ai-analysis`
   459	Get AI-powered analysis of audio system performance
   460	
   461	### Configuration Management
   462	
   463	**Configuration File Location:**
   464	- Primary: `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai000260a7xuiepjl.json`
   465	- Backups: `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai000260a7xuiepjl_backup_*.json`
   466	
   467	**Backup Strategy:**
   468	- Automatic backup created on every upload
   469	- Timestamped filename format
   470	- Manual restore by copying backup to primary config file
   471	
   472	### Database Schema
   473	
   474	```prisma
   475	model AudioProcessor {
   476	  id          String   @id @default(cuid())
   477	  name        String
   478	  model       String
   479	  ipAddress   String
   480	  port        Int      @default(80)
   481	  username    String?
   482	  password    String?
   483	  isActive    Boolean  @default(true)
   484	  createdAt   DateTime @default(now())
   485	  updatedAt   DateTime @updatedAt
   486	}
   487	```
   488	
   489	### Troubleshooting
   490	
   491	**Atlas Shows Offline:**
   492	1. Check network connectivity: `ping 192.168.5.101`
   493	2. Verify configuration file exists
   494	3. Check processor is powered on
   495	4. Restore from backup if needed
   496	
   497	**Configuration Not Loading:**
   498	1. Validate JSON configuration file
   499	2. Check file permissions
   500	3. Restore from most recent backup
   501	
   502	---
   503	
   504	## 4. AI Hub
   505	
   506	### Overview
   507	Unified AI management system providing intelligent assistance, codebase analysis, device insights, and AI configuration.
   508	
   509	### Current Status
   510	**Testing Date:** October 15, 2025  
   511	**Overall Status:** ⚠️ **PARTIALLY FUNCTIONAL**  
   512	**Critical Issues:** 2  
   513	**Features Tested:** 7  
   514	**Working Features:** 5  
   515	**Broken Features:** 2
   516	
   517	### Features & Status
   518	
   519	#### ✅ AI Assistant Tab (Partially Working)
   520	
   521	**Status:** Chat interface works, Codebase sync fails
   522	
   523	**Chat Interface:**
   524	- ✅ **Status:** WORKING
   525	- ⚠️ **Performance Issue:** Response time is slow (15+ seconds)
   526	- **Functionality:** Successfully answers questions about the codebase
   527	- **Features:**
   528	  - Natural language queries
   529	  - Codebase context awareness
   530	  - Troubleshooting assistance
   531	  - Code explanations
   532	
   533	**Sync Codebase:**
   534	- ❌ **Status:** FAILING
   535	- 🔴 **Error:** `GET http://24.123.87.42:3000/api/ai-assistant/index-codebase 404 (Internal Server Error)`
   536	- **Impact:** Cannot index codebase for AI analysis
   537	- **Priority:** CRITICAL - Fix immediately
   538	
   539	#### ✅ Teach AI Tab (UI Works, Backend Fails)
   540	
   541	**Upload Documents:**
   542	- ✅ **UI Status:** WORKING
   543	- **Supported Formats:** PDF, Markdown (.md), Text (.txt)
   544	- **Features:**
   545	  - Drag and drop file upload
   546	  - Multiple file support
   547	  - File type validation
   548	- ⚠️ **Note:** Upload errors observed, needs further testing
   549	
   550	**Q&A Training:**
   551	- ❌ **Status:** FAILING
   552	- 🔴 **Error:** `Database error: Failed to create Q&A entry`
   553	- **Console Error:** `500 (Internal Server Error)` for `api/qa-entries.ts`
   554	- **Impact:** Users cannot add Q&A training pairs
   555	- **Priority:** CRITICAL - Fix immediately
   556	- **Features (Non-functional):**
   557	  - Category selection (General, Technical, Troubleshooting, etc.)
   558	  - Question/Answer input fields
   559	  - Entry management
   560	  - Generate from Repository
   561	  - Generate from Docs
   562	  - Upload Q&A File
   563	
   564	**Test AI:**
   565	- ✅ **UI Status:** WORKING
   566	- **Features:**
   567	  - Test question input
   568	  - AI response testing
   569	  - Testing tips and guidance
   570	- ⚠️ **Note:** Cannot fully test without training data
   571	
   572	**Statistics Display:**
   573	- Documents: 0
   574	- Q&A Pairs: 0
   575	- Total Content: 0 Bytes
   576	- Last Updated: 10/15/2025, 1:00:06 AM
   577	
   578	#### ✅ Enhanced Devices Tab (Working)
   579	
   580	**Status:** ✅ FULLY FUNCTIONAL
   581	
   582	**Features:**
   583	- Device AI Assistant for intelligent insights
   584	- Filter options:
   585	  - All Devices dropdown
   586	  - Time range filter (Last 24 Hours)
   587	  - Refresh button
   588	- **Tabs:**
   589	  - Smart Insights
   590	  - Performance
   591	  - Recommendations
   592	  - Predictions
   593	- **Current State:** "No AI insights available for the selected criteria"
   594	
   595	#### ✅ Configuration Tab (Working)
   596	
   597	**Status:** ✅ FULLY FUNCTIONAL
   598	
   599	**Provider Statistics:**
   600	- 1 Active Local Service
   601	- 3 Cloud APIs Ready
   602	- 5 Inactive Local Services
   603	
   604	**Local AI Services:**
   605	- ✅ **Ollama** (http://localhost:11434/api/tags, Model: phi3:mini) - **Active** (4ms)
   606	- ❌ Custom Local AI (http://localhost:8000/v1/models) - Error
   607	- ❌ LocalAI (http://localhost:8080/v1/models) - Error
   608	- ❌ LM Studio (http://localhost:1234/v1/models) - Error
   609	- ❌ Text Generation WebUI (http://localhost:5000/v1/models) - Error
   610	- ❌ Tabby (http://localhost:8080/v1/models) - Error
   611	
   612	**Cloud AI Services:**
   613	- ✅ **OpenAI** - Ready (API key configured)
   614	- ✅ **Anthropic Claude** - Ready (API key configured)
   615	- ✅ **X.AI Grok** - Ready (API key configured)
   616	- ⚠️ **Abacus AI** - Not Configured (No API key)
   617	
   618	**Features:**
   619	- AI System Diagnostics (expandable)
   620	- Provider status monitoring
   621	- Refresh status button
   622	- Local AI setup guide
   623	
   624	#### ✅ API Keys Tab (Working)
   625	
   626	**Status:** ✅ FULLY FUNCTIONAL
   627	
   628	**Features:**
   629	- API key management interface
   630	- Configured API Keys display (currently 0)
   631	- Add API Key button
   632	- Provider documentation links:
   633	  - Ollama (Local) - RECOMMENDED
   634	  - Abacus AI
   635	  - OpenAI
   636	  - LocalAI
   637	  - Custom Local AI
   638	- Local AI Services Status:
   639	  - Port 8000: Active (Custom service detected)
   640	  - Port 11434: Check if Ollama is running
   641	  - Port 8080: Check if LocalAI is running
   642	
   643	**AI Assistant Features Listed:**
   644	- Equipment Troubleshooting
   645	- System Analysis
   646	- Configuration Assistance
   647	- Sports Guide Intelligence
   648	- Operational Insights
   649	- Proactive Monitoring
   650	
   651	### Database Schema
   652	
   653	```prisma
   654	model IndexedFile {
   655	  id            String   @id @default(cuid())
   656	  filePath      String   @unique
   657	  fileName      String
   658	  fileType      String
   659	  content       String   @db.Text
   660	  fileSize      Int
   661	  lastModified  DateTime
   662	  lastIndexed   DateTime @default(now())
   663	  hash          String
   664	  isActive      Boolean  @default(true)
   665	  createdAt     DateTime @default(now())
   666	  updatedAt     DateTime @updatedAt
   667	}
   668	
   669	model QAPair {
   670	  id          String   @id @default(cuid())
   671	  question    String   @db.Text
   672	  answer      String   @db.Text
   673	  context     String?  @db.Text
   674	  source      String?
   675	  category    String?
   676	  isActive    Boolean  @default(true)
   677	  createdAt   DateTime @default(now())
   678	  updatedAt   DateTime @updatedAt
   679	}
   680	
   681	model TrainingDocument {
   682	  id          String   @id @default(cuid())
   683	  title       String
   684	  content     String   @db.Text
   685	  fileType    String
   686	  fileSize    Int
   687	  category    String?
   688	  isActive    Boolean  @default(true)
   689	  createdAt   DateTime @default(now())
   690	  updatedAt   DateTime @updatedAt
   691	}
   692	
   693	model ApiKey {
   694	  id          String   @id @default(cuid())
   695	  provider    String
   696	  keyName     String
   697	  apiKey      String
   698	  isActive    Boolean  @default(true)
   699	  createdAt   DateTime @default(now())
   700	  updatedAt   DateTime @updatedAt
   701	  
   702	  @@unique([provider, keyName])
   703	}
   704	```
   705	
   706	### API Endpoints
   707	
   708	#### POST `/api/ai-assistant/index-codebase`
   709	❌ **Status:** BROKEN (404 error)  
   710	Index codebase files for AI analysis
   711	
   712	#### POST `/api/ai-assistant/chat`
   713	✅ **Status:** WORKING (slow)  
   714	Chat with AI about codebase
   715	
   716	#### POST `/api/ai/qa-generate`
   717	Generate Q&A pairs from repository
   718	
   719	#### POST `/api/ai/qa-entries`
   720	❌ **Status:** BROKEN (500 error)  
   721	Create Q&A training entries
   722	
   723	#### GET/POST `/api/api-keys`
   724	✅ **Status:** WORKING  
   725	Manage AI provider API keys
   726	
   727	#### POST `/api/devices/ai-analysis`
   728	Get AI insights for devices
   729	
   730	### Critical Issues & Fix Plan
   731	
   732	#### 🔴 CRITICAL #1: Q&A Training Database Error
   733	
   734	**Error:** `Database error: Failed to create Q&A entry`  
   735	**API:** `POST /api/ai/qa-entries` returns 500 error  
   736	**Impact:** Users cannot add Q&A training pairs
   737	
   738	**Fix Steps:**
   739	1. Check database schema for `QAPair` table
   740	2. Verify Prisma migrations are up to date
   741	3. Review API route handler (`src/app/api/ai/qa-entries/route.ts`)
   742	4. Check database connection and write permissions
   743	5. Add proper error logging
   744	6. Test with various Q&A entry formats
   745	
   746	**Priority:** Fix immediately before production use
   747	
   748	#### 🔴 CRITICAL #2: Codebase Indexing 404 Error
   749	
   750	**Error:** `GET http://24.123.87.42:3000/api/ai-assistant/index-codebase 404`  
   751	**Impact:** Cannot index codebase for AI assistance
   752	
   753	**Fix Steps:**
   754	1. Verify API route exists in correct location
   755	2. Check route file naming (should be `route.ts` in app router)
   756	3. Ensure proper HTTP method handling (GET/POST)
   757	4. Implement codebase indexing logic if missing
   758	5. Test with actual project directory
   759	6. Add proper error responses
   760	
   761	**Priority:** Fix immediately for full AI Hub functionality
   762	
   763	#### 🟡 HIGH PRIORITY: Chat Performance
   764	
   765	**Issue:** 15+ second response time  
   766	**Impact:** Poor user experience
   767	
   768	**Optimization Steps:**
   769	1. Profile AI model response time
   770	2. Implement streaming responses
   771	3. Add response caching for common questions
   772	4. Consider faster AI model for simple queries
   773	5. Optimize context window size
   774	6. Add better loading indicators
   775	
   776	#### 🟠 MEDIUM PRIORITY: Local AI Services
   777	
   778	**Issue:** 5 local AI services showing error status
   779	
   780	**Services to Fix:**
   781	- Custom Local AI (port 8000)
   782	- LocalAI (port 8080)
   783	- LM Studio (port 1234)
   784	- Text Generation WebUI (port 5000)
   785	- Tabby (port 8080 - port conflict?)
   786	
   787	**Fix Steps:**
   788	1. Verify each service is installed
   789	2. Check if services are running
   790	3. Update service URLs in configuration
   791	4. Add health check with retry logic
   792	5. Document installation instructions
   793	6. Consider making local services optional
   794	
   795	### Recommendations
   796	
   797	**Immediate Actions:**
   798	1. Fix Q&A Training database error (CRITICAL)
   799	2. Fix Codebase Indexing 404 error (CRITICAL)
   800	3. Test document upload feature thoroughly
   801	4. Add proper error messages and user feedback
   802	
   803	**Short-term Improvements:**
   804	1. Optimize chat response performance
   805	2. Implement streaming responses
   806	3. Add progress indicators
   807	4. Configure local AI services
   808	
   809	**Long-term Enhancements:**
   810	1. Add training data export/import
   811	2. Implement batch Q&A generation
   812	3. Add training quality metrics
   813	4. Enhanced device insights with more data
   814	
   815	### Testing Report
   816	📄 **Detailed Testing Report:** `/home/ubuntu/ai_hub_testing_report.md`
   817	
   818	---
   819	
   820	## 5. Sports Guide
   821	
   822	### Overview
   823	Simplified sports programming guide using The Rail Media API as the ONLY data source. All previous data sources (ESPN, TheSportsDB, Spectrum, etc.) have been removed for simplicity and maintainability.
   824	
   825	**Version:** 4.0.0 - Simplified Implementation  
   826	**Last Updated:** October 16, 2025  
   827	**Data Source:** The Rail Media API ONLY
   828	
   829	### Key Changes (Version 4.0.0)
   830	
   831	#### Simplified Architecture
   832	- **REMOVED:** ESPN API integration
   833	- **REMOVED:** TheSportsDB API integration  
   834	- **REMOVED:** Spectrum Channel Service
   835	- **REMOVED:** Sunday Ticket Service
   836	- **REMOVED:** Enhanced streaming sports service
   837	- **REMOVED:** Mock data generation
   838	- **REMOVED:** Multiple hardcoded channel lists
   839	- **KEPT:** The Rail Media API as the ONLY data source
   840	
   841	#### Benefits of Simplification
   842	- Single source of truth for all sports programming data
   843	- Reduced code complexity (600+ lines → 300 lines)
   844	- Easier maintenance and debugging
   845	- Consistent data format
   846	- No API conflicts or data merging issues
   847	- Comprehensive verbose logging for debugging
   848	
   849	### Features
   850	
   851	#### Core Functionality
   852	- **Sports Programming Guide:** Real-time sports TV guide data from The Rail Media
   853	- **Date Range Filtering:** Query specific date ranges or number of days ahead
   854	- **Lineup Filtering:** Filter by satellite, cable, or streaming lineup
   855	- **Search Functionality:** Search for specific teams, leagues, or sports
   856	- **Comprehensive Logging:** Verbose logging for all operations
   857	- **Ollama Integration:** AI-powered query and analysis capabilities
   858	
   859	#### Supported Lineups
   860	- **SAT** - Satellite providers
   861	- **DRTV** - DirecTV
   862	- **DISH** - Dish Network
   863	- **CABLE** - Cable providers
   864	- **STREAM** - Streaming services
   865	
   866	### API Configuration
   867	
   868	**Provider:** The Rail Media  
   869	**API Endpoint:** https://guide.thedailyrail.com/api/v1  
   870	**User ID:** 258351  
   871	**API Key:** Configured in `.env` file
   872	
   873	#### Environment Variables
   874	```bash
   875	SPORTS_GUIDE_API_KEY=12548RK0000000d2bb701f55b82bfa192e680985919
   876	SPORTS_GUIDE_USER_ID=258351
   877	SPORTS_GUIDE_API_URL=https://guide.thedailyrail.com/api/v1
   878	```
   879	
   880	### API Endpoints
   881	
   882	#### POST `/api/sports-guide`
   883	Fetch sports programming guide from The Rail Media API
   884	
   885	**Request Body:**
   886	```json
   887	{
   888	  "startDate": "2025-10-16",  // Optional: YYYY-MM-DD format
   889	  "endDate": "2025-10-23",     // Optional: YYYY-MM-DD format
   890	  "days": 7,                   // Optional: Number of days from today
   891	  "lineup": "SAT",             // Optional: Filter by lineup (SAT, DRTV, etc.)
   892	  "search": "NBA"              // Optional: Search term (team, league, sport)
   893	}
   894	```
   895	
   896	**Response:**
   897	```json
   898	{
   899	  "success": true,
   900	  "requestId": "abc123",
   901	  "dataSource": "The Rail Media API",
   902	  "apiProvider": {
   903	    "name": "The Rail Media",
   904	    "url": "https://guide.thedailyrail.com/api/v1",
   905	    "userId": "258351"
   906	  },
   907	  "fetchMethod": "fetchDateRangeGuide (7 days)",
   908	  "data": {
   909	    "listing_groups": [...]
   910	  },
   911	  "statistics": {
   912	    "totalListingGroups": 42,
   913	    "totalListings": 156,
   914	    "appliedFilters": [],
   915	    "generatedAt": "2025-10-16T..."
   916	  },
   917	  "filters": {
   918	    "startDate": null,
   919	    "endDate": null,
   920	    "days": 7,
   921	    "lineup": null,
   922	    "search": null
   923	  }
   924	}
   925	```
   926	
   927	#### GET `/api/sports-guide`
   928	Get API information, status, and available endpoints
   929	
   930	**Response:**
   931	```json
   932	{
   933	  "success": true,
   934	  "requestId": "xyz789",
   935	  "version": "4.0.0",
   936	  "name": "Simplified Sports Guide API",
   937	  "description": "Sports programming guide using ONLY The Rail Media API",
   938	  "dataSource": {
   939	    "provider": "The Rail Media",
   940	    "url": "https://guide.thedailyrail.com/api/v1",
   941	    "userId": "258351",
   942	    "apiKeySet": true,
   943	    "configured": true
   944	  },
   945	  "endpoints": {...},
   946	  "features": [...],
   947	  "logging": {
   948	    "enabled": true,
   949	    "location": "PM2 logs (pm2 logs sports-bar-tv)",
   950	    "format": "[timestamp] [Sports-Guide] LEVEL: message",
   951	    "levels": ["INFO", "ERROR", "DEBUG"]
   952	  },
   953	  "supportedLineups": [...]
   954	}
   955	```
   956	
   957	#### GET `/api/sports-guide?action=test-connection`
   958	Test The Rail Media API connection
   959	
   960	**Response:**
   961	```json
   962	{
   963	  "success": true,
   964	  "requestId": "test123",
   965	  "connectionTest": {
   966	    "valid": true,
   967	    "message": "API key is valid and working"
   968	  },
   969	  "timestamp": "2025-10-16T..."
   970	}
   971	```
   972	
   973	#### GET `/api/sports-guide/status`
   974	Get current API configuration status
   975	
   976	**Response:**
   977	```json
   978	{
   979	  "success": true,
   980	  "configured": true,
   981	  "apiUrl": "https://guide.thedailyrail.com/api/v1",
   982	  "userId": "258351",
   983	  "apiKeySet": true,
   984	  "apiKeyPreview": "12548RK0...5919"
   985	}
   986	```
   987	
   988	#### POST `/api/sports-guide/verify-key`
   989	Verify API key validity
   990	
   991	**Request Body:**
   992	```json
   993	{
   994	  "apiKey": "your-api-key",
   995	  "userId": "your-user-id"
   996	}
   997	```
   998	
   999	#### POST `/api/sports-guide/update-key`
  1000	Update API key (with validation)
  1001	
  1002	**Request Body:**
  1003	```json
  1004	{
  1005	  "apiKey": "new-api-key",
  1006	  "userId": "new-user-id"
  1007	}
  1008	```
  1009	
  1010	### Ollama AI Integration
  1011	
  1012	The Sports Guide now includes comprehensive AI integration using Ollama for intelligent querying and analysis.
  1013	
  1014	#### Ollama Configuration
  1015	- **Host:** http://localhost:11434 (configurable via `OLLAMA_HOST`)
  1016	- **Model:** phi3:mini (configurable via `OLLAMA_MODEL`)
  1017	- **Status:** Active and operational
  1018	
  1019	#### Ollama API Endpoints
  1020	
  1021	##### POST `/api/sports-guide/ollama/query`
  1022	Query Ollama about sports guide functionality
  1023	
  1024	**Default Query:**
  1025	```json
  1026	{
  1027	  "query": "What sports games are on TV tonight?",
  1028	  "includeRecentLogs": true
  1029	}
  1030	```
  1031	
  1032	**Analyze Logs:**
  1033	```json
  1034	{
  1035	  "action": "analyze-logs"
  1036	}
  1037	```
  1038	
  1039	**Get Recommendations:**
  1040	```json
  1041	{
  1042	  "action": "get-recommendations",
  1043	  "userPreferences": {
  1044	    "favoriteTeams": ["Green Bay Packers", "Milwaukee Bucks"],
  1045	    "favoriteLeagues": ["NFL", "NBA"],
  1046	    "location": "Green Bay, Wisconsin"
  1047	  }
  1048	}
  1049	```
  1050	
  1051	**Test Connection:**
  1052	```json
  1053	{
  1054	  "action": "test-connection"
  1055	}
  1056	```
  1057	
  1058	##### GET `/api/sports-guide/ollama/query`
  1059	Test Ollama connectivity
  1060	
  1061	**Response:**
  1062	```json
  1063	{
  1064	  "success": true,
  1065	  "message": "Ollama is online and accessible",
  1066	  "model": "phi3:mini",
  1067	  "responseTime": 45
  1068	}
  1069	```
  1070	
  1071	#### Ollama Features
  1072	
  1073	1. **Intelligent Query Answering**
  1074	   - Natural language questions about sports programming
  1075	   - Context-aware responses using recent logs
  1076	   - Comprehensive system knowledge
  1077	
  1078	2. **Log Analysis**
  1079	   - Automatic analysis of sports guide logs
  1080	   - System health assessment
  1081	   - Error detection and reporting
  1082	   - Usage pattern identification
  1083	
  1084	3. **Personalized Recommendations**
  1085	   - Sports programming recommendations based on user preferences
  1086	   - Location-based suggestions
  1087	   - Team and league-specific recommendations
  1088	
  1089	4. **Debug Assistance**
  1090	   - Help troubleshooting issues
  1091	   - Explain error messages
  1092	   - Suggest solutions based on logs
  1093	
  1094	### Comprehensive Logging
  1095	
  1096	All sports guide operations are logged with comprehensive detail for debugging and monitoring.
  1097	
  1098	#### Log Format
  1099	```
  1100	[2025-10-16T12:34:56.789Z] [Sports-Guide] LEVEL: message
  1101	```
  1102	
  1103	#### Log Levels
  1104	- **INFO:** General information about operations
  1105	- **ERROR:** Error conditions and failures
  1106	- **DEBUG:** Detailed debugging information
  1107	
  1108	#### Log Locations
  1109	- **PM2 Output Log:** `~/.pm2/logs/sports-bar-tv-out.log`
  1110	- **PM2 Error Log:** `~/.pm2/logs/sports-bar-tv-error.log`
  1111	
  1112	#### Viewing Logs
  1113	
  1114	**Real-time logs:**
  1115	```bash
  1116	pm2 logs sports-bar-tv
  1117	```
  1118	
  1119	**Filter for Sports Guide logs:**
  1120	```bash
  1121	pm2 logs sports-bar-tv | grep "Sports-Guide"
  1122	```
  1123	
  1124	**View specific log file:**
  1125	```bash
  1126	tail -f ~/.pm2/logs/sports-bar-tv-out.log | grep "Sports-Guide"
  1127	```
  1128	
  1129	**Search logs:**
  1130	```bash
  1131	cat ~/.pm2/logs/sports-bar-tv-out.log | grep "Sports-Guide" | grep "ERROR"
  1132	```
  1133	
  1134	#### Logged Operations
  1135	
  1136	- **Request Processing:** Every API request with unique request ID
  1137	- **API Calls:** The Rail API requests with parameters
  1138	- **Data Fetching:** Method used and response statistics
  1139	- **Filtering:** Applied filters and results
  1140	- **Errors:** Detailed error information with stack traces
  1141	- **Statistics:** Request counts, processing times, data volumes
  1142	
  1143	### Configuration Management
  1144	
  1145	#### Viewing Current Configuration
  1146	
  1147	1. Navigate to Sports Guide Configuration page
  1148	2. Click "API" tab
  1149	3. View current User ID and masked API Key
  1150	4. Check configuration status indicator
  1151	
  1152	#### Updating Configuration
  1153	
  1154	**Via UI:**
  1155	1. Navigate to Sports Guide Configuration
  1156	2. Click "API" tab
  1157	3. Enter new User ID and API Key
  1158	4. Click "Verify API Key" to test
  1159	5. Click "Save Configuration"
  1160	6. Restart server for changes to take effect
  1161	
  1162	**Via Command Line:**
  1163	```bash
  1164	# SSH into server
  1165	ssh -p 224 ubuntu@24.123.87.42
  1166	
  1167	# Edit .env file
  1168	nano /home/ubuntu/Sports-Bar-TV-Controller/.env
  1169	
  1170	# Update values:
  1171	# SPORTS_GUIDE_API_KEY=your-new-key
  1172	# SPORTS_GUIDE_USER_ID=your-new-user-id
  1173	
  1174	# Restart application
  1175	pm2 restart sports-bar-tv
  1176	```
  1177	
  1178	### Security
  1179	
  1180	- **API Keys:** Stored only in `.env` file (never in repository)
  1181	- **Key Masking:** UI shows only first 8 and last 4 characters
  1182	- **Validation:** API keys validated before saving
  1183	- **Server-side Only:** All API calls made from server, never client
  1184	- **Environment Variables:** Secure storage of sensitive credentials
  1185	
  1186	### Testing
  1187	
  1188	#### Test API Connection
  1189	```bash
  1190	curl http://24.123.87.42:3000/api/sports-guide?action=test-connection
  1191	```
  1192	
  1193	#### Fetch Today's Guide
  1194	```bash
  1195	curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1196	  -H "Content-Type: application/json" \
  1197	  -d '{}'
  1198	```
  1199	
  1200	#### Fetch 7-Day Guide
  1201	```bash
  1202	curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1203	  -H "Content-Type: application/json" \
  1204	  -d '{"days": 7}'
  1205	```
  1206	
  1207	#### Search for NBA Games
  1208	```bash
  1209	curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1210	  -H "Content-Type: application/json" \
  1211	  -d '{"search": "NBA", "days": 3}'
  1212	```
  1213	
  1214	#### Filter by DirecTV Lineup
  1215	```bash
  1216	curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1217	  -H "Content-Type: application/json" \
  1218	  -d '{"lineup": "DRTV", "days": 1}'
  1219	```
  1220	
  1221	#### Test Ollama Connection
  1222	```bash
  1223	curl http://24.123.87.42:3000/api/sports-guide/ollama/query
  1224	```
  1225	
  1226	#### Query Ollama
  1227	```bash
  1228	curl -X POST http://24.123.87.42:3000/api/sports-guide/ollama/query \
  1229	  -H "Content-Type: application/json" \
  1230	  -d '{"query": "What NFL games are on TV this week?"}'
  1231	```
  1232	
  1233	#### Get AI Recommendations
  1234	```bash
  1235	curl -X POST http://24.123.87.42:3000/api/sports-guide/ollama/query \
  1236	  -H "Content-Type: application/json" \
  1237	  -d '{
  1238	    "action": "get-recommendations",
  1239	    "userPreferences": {
  1240	      "favoriteTeams": ["Green Bay Packers"],
  1241	      "favoriteLeagues": ["NFL"]
  1242	    }
  1243	  }'
  1244	```
  1245	
  1246	### Troubleshooting
  1247	
  1248	#### Issue: "The Rail Media API not configured"
  1249	**Solution:**
  1250	1. Check `.env` file has `SPORTS_GUIDE_API_KEY` and `SPORTS_GUIDE_USER_ID`
  1251	2. Verify values are correct
  1252	3. Restart application: `pm2 restart sports-bar-tv`
  1253	
  1254	#### Issue: "API key is invalid or unauthorized"
  1255	**Solution:**
  1256	1. Verify API key is correct in `.env` file
  1257	2. Test API key using `/api/sports-guide?action=test-connection`
  1258	3. Contact The Rail Media support if key is correct but still failing
  1259	
  1260	#### Issue: No data returned
  1261	**Solution:**
  1262	1. Check PM2 logs: `pm2 logs sports-bar-tv | grep "Sports-Guide"`
  1263	2. Verify date range is valid
  1264	3. Try fetching without filters first
  1265	4. Check The Rail Media API status
  1266	
  1267	#### Issue: Ollama queries failing
  1268	**Solution:**
  1269	1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
  1270	2. Check Ollama model is downloaded: `ollama list`
  1271	3. Restart Ollama if needed: `systemctl restart ollama` (if using systemd)
  1272	4. Check logs for detailed error messages
  1273	
  1274	#### Issue: Slow response times
  1275	**Solution:**
  1276	1. Check network connectivity to The Rail Media API
  1277	2. Review logs for performance issues
  1278	3. Consider reducing date range for queries
  1279	4. Use Ollama to analyze logs for performance patterns
  1280	
  1281	### Migration Notes
  1282	
  1283	#### Upgrading from Version 3.x
  1284	
  1285	**What Changed:**
  1286	- Removed all data sources except The Rail Media API
  1287	- Simplified API interface
  1288	- Added comprehensive logging
  1289	- Added Ollama AI integration
  1290	- Removed hardcoded channel lists
  1291	
  1292	**Migration Steps:**
  1293	1. Ensure The Rail Media API credentials are configured in `.env`
  1294	2. Update any frontend code that relied on old API response format
  1295	3. Test all sports guide functionality
  1296	4. Review logs to ensure proper operation
  1297	5. Update any custom integrations
  1298	
  1299	**Breaking Changes:**
  1300	- Response format changed to focus on The Rail API data structure
  1301	- Removed mock data fallbacks
  1302	- Removed multi-source data merging
  1303	- Changed API response schema
  1304	
  1305	### Future Enhancements
  1306	
  1307	**Planned Features:**
  1308	- Enhanced caching for frequently accessed data
  1309	- Webhook support for real-time updates
  1310	- User preference storage
  1311	- Advanced filtering options
  1312	- Integration with other system features (matrix routing, etc.)
  1313	- Mobile app support
  1314	- Push notifications for favorite teams
  1315	
  1316	### Support
  1317	
  1318	For issues with The Rail Media API:
  1319	- **Website:** https://guide.thedailyrail.com
  1320	- **Support:** Contact The Rail Media support team
  1321	
  1322	For Sports Bar TV Controller issues:
  1323	- **Logs:** `pm2 logs sports-bar-tv | grep "Sports-Guide"`
  1324	- **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
  1325	- **Ollama Assistant:** Use `/api/sports-guide/ollama/query` to ask questions
  1326	
  1327	---
  1328	
  1329	*Last Updated: October 16, 2025*  
  1330	*Version: 4.0.0 - Simplified Implementation*  
  1331	*Data Source: The Rail Media API Only*
  1332	## 6. Streaming Platforms
  1333	
  1334	### Overview
  1335	Management interface for streaming service accounts and configurations.
  1336	
  1337	### Features
  1338	- Platform account management
  1339	- Service configuration
  1340	- Integration settings
  1341	
  1342	---
  1343	
  1344	## 6.5. Global Cache IR Control
  1345	
  1346	### Overview
  1347	Global Cache iTach IR Control system provides comprehensive infrared device management for cable boxes, AV receivers, and other IR-controlled equipment. The system supports both downloading IR codes from the Global Cache IR Database and **learning IR codes directly from physical remote controls**.
  1348	
  1349	**Version:** 2.0 - With IR Learning Support  
  1350	**Last Updated:** October 17, 2025  
  1351	**Status:** Production Ready
  1352	
  1353	### Key Features
  1354	- **Device Management**: Add and manage Global Cache iTach devices (IP2IR, WF2IR, etc.)
  1355	- **IR Code Database**: Download pre-programmed IR codes from Global Cache cloud database
  1356	- **IR Learning**: Learn IR codes directly from physical remote controls
  1357	- **Multi-Port Support**: Configure multiple IR output ports per device
  1358	- **Real-time Testing**: Test device connectivity and IR transmission
  1359	- **Comprehensive Logging**: Verbose logging for debugging and monitoring
  1360	
  1361	### Global Cache Device Management
  1362	
  1363	#### Supported Models
  1364	- **iTach IP2IR**: Ethernet to 3x IR outputs (Port 4998)
  1365	- **iTach WF2IR**: WiFi to 3x IR outputs (Port 4998)
  1366	- **GC-100**: Network adapter with IR/Serial/Relay support
  1367	
  1368	#### Adding Devices
  1369	1. Navigate to Device Configuration → Global Cache tab
  1370	2. Click "Add Device"
  1371	3. Enter device information:
  1372	   - **Device Name**: Friendly name (e.g., "Cable 1 iTach")
  1373	   - **IP Address**: Device network address (e.g., 192.168.5.110)
  1374	   - **Port**: TCP port (default 4998)
  1375	   - **Model** (optional): Device model identifier
  1376	4. Click "Add Device"
  1377	5. System will automatically test connectivity
  1378	
  1379	#### Device Testing
  1380	- Click the "Test" button on any device card
  1381	- System sends `getdevices` command to verify connectivity
  1382	- Results show device information and response time
  1383	- Status indicator shows online/offline state
  1384	
  1385	### IR Learning Feature
  1386	
  1387	**NEW:** The IR learning feature allows you to capture IR codes directly from physical remote controls without needing access to the Global Cache IR Database.
  1388	
  1389	#### How IR Learning Works
  1390	
  1391	The Global Cache iTach devices have a built-in IR receiver (small hole near the power connector) that can capture IR signals from remote controls. The learning process:
  1392	
  1393	1. **Enable Learning Mode**: Device enters learning mode via `get_IRL` command
  1394	2. **Capture Signal**: Point remote at device and press button
  1395	3. **Receive Code**: Device sends captured IR code in Global Cache `sendir` format
  1396	4. **Disable Learning**: Automatic or manual via `stop_IRL` command
  1397	
  1398	#### Using IR Learning
  1399	
  1400	**Step-by-Step Process:**
  1401	
  1402	1. **Navigate to IR Learning Tab**
  1403	   - Go to Device Configuration → Global Cache
  1404	   - Click the "IR Learning" tab
  1405	
  1406	2. **Select Device**
  1407	   - Choose a Global Cache device from the dropdown
  1408	   - Device must be online and reachable
  1409	
  1410	3. **Start Learning**
  1411	   - Click "Start Learning" button
  1412	   - System sends `get_IRL` command to device
  1413	   - Wait for confirmation: "IR Learner Enabled"
  1414	
  1415	4. **Capture IR Signal**
  1416	   - Point your remote control at the Global Cache device
  1417	   - Aim at the small IR receiver hole (near power connector)
  1418	   - Press the button you want to learn
  1419	   - Hold button for 1-2 seconds for best results
  1420	
  1421	5. **View Learned Code**
  1422	   - IR code appears automatically in text area
  1423	   - Code is in Global Cache `sendir` format
  1424	   - Example: `sendir,1:1,1,38000,1,1,342,171,21,64,21,64,...`
  1425	
  1426	6. **Save or Copy Code**
  1427	   - **Option 1**: Click "Copy" to copy code to clipboard
  1428	   - **Option 2**: Enter a function name (e.g., "POWER") and click "Save to IR Device"
  1429	   - Follow instructions to add code to an IR device
  1430	
  1431	**Important Notes:**
  1432	- Learning mode has a 60-second timeout
  1433	- Only one learning session at a time per device
  1434	- Device must not be configured for LED lighting
  1435	- Code is automatically stopped after learning completes
  1436	- Can manually stop learning with "Stop Learning" button
  1437	
  1438	#### IR Learning API Endpoints
  1439	
  1440	**POST `/api/globalcache/learn`**
  1441	Start IR learning session
  1442	
  1443	```json
  1444	{
  1445	  "deviceId": "clx123abc..."
  1446	}
  1447	```
  1448	
  1449	**Response:**
  1450	```json
  1451	{
  1452	  "success": true,
  1453	  "status": "IR code learned successfully",
  1454	  "learnedCode": "sendir,1:1,1,38000,1,1,342,171,21,64,..."
  1455	}
  1456	```
  1457	
  1458	**DELETE `/api/globalcache/learn`**
  1459	Stop IR learning session
  1460	
  1461	```json
  1462	{
  1463	  "deviceId": "clx123abc..."
  1464	}
  1465	```
  1466	
  1467	**Response:**
  1468	```json
  1469	{
  1470	  "success": true,
  1471	  "status": "IR Learner disabled"
  1472	}
  1473	```
  1474	
  1475	#### IR Learning Commands (Global Cache API)
  1476	
  1477	**Enable Learning:**
  1478	```
  1479	get_IRL\r
  1480	```
  1481	
  1482	**Response:**
  1483	```
  1484	IR Learner Enabled
  1485	```
  1486	
  1487	**Learned Code (automatic):**
  1488	```
  1489	sendir,1:1,1,38000,1,1,342,171,21,64,21,64,...\r
  1490	```
  1491	
  1492	**Disable Learning:**
  1493	```
  1494	stop_IRL\r
  1495	```
  1496	
  1497	**Response:**
  1498	```
  1499	IR Learner Disabled
  1500	```
  1501	
  1502	#### Troubleshooting IR Learning
  1503	
  1504	**Problem: "IR Learner Unavailable"**
  1505	- **Cause**: Device is configured for LED lighting control
  1506	- **Solution**: Reconfigure device to disable LED lighting mode
  1507	- **Note**: LED lighting and IR learning cannot be enabled simultaneously
  1508	
  1509	**Problem: "Learning session timeout"**
  1510	- **Cause**: No IR signal received within 60 seconds
  1511	- **Solution**: 
  1512	  - Ensure remote has fresh batteries
  1513	  - Point remote directly at IR receiver hole
  1514	  - Hold button for 1-2 seconds
  1515	  - Try again with stronger IR signal
  1516	
  1517	**Problem: "Connection error"**
  1518	- **Cause**: Cannot connect to Global Cache device
  1519	- **Solution**:
  1520	  - Verify device is powered on
  1521	  - Check network connectivity
  1522	  - Test device in Device Management tab
  1523	  - Verify IP address and port are correct
  1524	
  1525	**Problem: "IR code not working after learning"**
  1526	- **Cause**: Weak or incomplete IR signal captured
  1527	- **Solution**:
  1528	  - Learn code again with remote closer to device
  1529	  - Ensure remote batteries are fresh
  1530	  - Try holding button longer (1-2 seconds)
  1531	  - Verify learned code is not truncated
  1532	
  1533	### Comprehensive Logging
  1534	
  1535	All Global Cache operations include verbose logging for debugging and monitoring.
  1536	
  1537	#### Log Format
  1538	```
  1539	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1540	🎓 [GLOBAL CACHE] Starting IR learning
  1541	   Device ID: clx123abc...
  1542	   Timestamp: 2025-10-17T12:34:56.789Z
  1543	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1544	```
  1545	
  1546	#### Logged Operations
  1547	
  1548	**Device Management:**
  1549	- Device creation and deletion
  1550	- Connection testing
  1551	- Status updates
  1552	
  1553	**IR Learning:**
  1554	- Learning session start/stop
  1555	- Device connection attempts
  1556	- IR code capture events
  1557	- Learning timeouts and errors
  1558	- Code validation
  1559	
  1560	**Viewing Logs:**
  1561	
  1562	```bash
  1563	# Real-time logs
  1564	pm2 logs sports-bar-tv | grep "GLOBAL CACHE"
  1565	
  1566	# Search logs
  1567	cat ~/.pm2/logs/sports-bar-tv-out.log | grep "GLOBAL CACHE"
  1568	
  1569	# Error logs only
  1570	cat ~/.pm2/logs/sports-bar-tv-error.log | grep "GLOBAL CACHE"
  1571	```
  1572	
  1573	### Database Schema
  1574	
  1575	```prisma
  1576	model GlobalCacheDevice {
  1577	  id          String              @id @default(cuid())
  1578	  name        String
  1579	  ipAddress   String              @unique
  1580	  port        Int                 @default(4998)
  1581	  model       String?
  1582	  status      String              @default("offline")
  1583	  lastSeen    DateTime?
  1584	  ports       GlobalCachePort[]
  1585	  createdAt   DateTime            @default(now())
  1586	  updatedAt   DateTime            @updatedAt
  1587	}
  1588	
  1589	model GlobalCachePort {
  1590	  id                String            @id @default(cuid())
  1591	  deviceId          String
  1592	  portNumber        Int
  1593	  portType          String            @default("IR")
  1594	  assignedTo        String?
  1595	  assignedDeviceId  String?
  1596	  irCodeSet         String?
  1597	  enabled           Boolean           @default(true)
  1598	}
  1599	```
  1600	
  1601	### Integration with IR Devices
  1602	
  1603	Learned IR codes can be saved to IR devices for use in automated control:
  1604	
  1605	1. **Create IR Device** (Device Configuration → IR Devices tab)
  1606	2. **Add New Command** to IR device
  1607	3. **Paste Learned Code** into IR Code field
  1608	4. **Assign Function Name** (e.g., "POWER", "CHANNEL UP")
  1609	5. **Link to Global Cache Port** for transmission
  1610	6. **Test Command** to verify functionality
  1611	
  1612	### Best Practices
  1613	
  1614	#### IR Learning
  1615	1. **Fresh Batteries**: Use remote controls with fresh batteries
  1616	2. **Close Proximity**: Hold remote 2-6 inches from IR receiver
  1617	3. **Direct Aim**: Point directly at IR receiver hole
  1618	4. **Button Hold**: Hold button for 1-2 seconds for best capture
  1619	5. **Verify Code**: Test learned code immediately after capture
  1620	6. **Document Codes**: Add descriptive function names
  1621	7. **Backup Codes**: Keep copies of working codes
  1622	
  1623	#### Device Management
  1624	1. **Static IPs**: Assign static IP addresses to Global Cache devices
  1625	2. **Network Isolation**: Place devices on same subnet as server
  1626	3. **Regular Testing**: Test device connectivity regularly
  1627	4. **Firmware Updates**: Keep device firmware up to date
  1628	5. **Port Organization**: Document which ports control which devices
  1629	
  1630	### Limitations
  1631	
  1632	1. **IR Learning:**
  1633	   - Cannot learn if device configured for LED lighting
  1634	   - 60-second timeout per learning session
  1635	   - One learning session at a time per device
  1636	   - IR receiver location may vary by model
  1637	
  1638	2. **Device Support:**
  1639	   - Requires iTach firmware with IR learning support
  1640	   - Not all Global Cache models support IR learning
  1641	   - WiFi models may have network latency
  1642	
  1643	3. **IR Code Quality:**
  1644	   - Learned codes depend on original remote signal strength
  1645	   - Some remotes use proprietary or non-standard IR protocols
  1646	   - Complex codes may require multiple learning attempts
  1647	
  1648	### Future Enhancements
  1649	
  1650	**Planned Features:**
  1651	- [ ] Bulk IR code learning with batch mode
  1652	- [ ] IR code library management and sharing
  1653	- [ ] Automatic IR device creation from learned codes
  1654	- [ ] IR code testing and verification tools
  1655	- [ ] Advanced code editing and manipulation
  1656	- [ ] Integration with IR device templates
  1657	
  1658	### Support
  1659	
  1660	For issues with Global Cache devices or IR learning:
  1661	
  1662	**Device Issues:**
  1663	- Test connectivity in Device Management tab
  1664	- Check PM2 logs for errors
  1665	- Verify network configuration
  1666	- Review Global Cache API documentation
  1667	
  1668	**IR Learning Issues:**
  1669	- Check logs for detailed error messages
  1670	- Verify device is not in LED lighting mode
  1671	- Test with different remote controls
  1672	- Contact Global Cache support for hardware issues
  1673	
  1674	**Documentation:**
  1675	- Global Cache iTach API: See `global-cache-API-iTach.pdf`
  1676	- IR Database API: See `API-GlobalIRDB_ver1.pdf`
  1677	- System logs: `pm2 logs sports-bar-tv`
  1678	
  1679	---
  1680	
  1681	## 7. DirecTV Integration
  1682	
  1683	### Overview
  1684	Integration with DirecTV receivers for sports bar TV control using the SHEF (Set-top Box HTTP Exported Functionality) protocol. The system allows adding, managing, and monitoring DirecTV receivers, retrieving device status and channel information, and routing them through the matrix switcher.
  1685	
  1686	### SHEF Protocol Information
  1687	
  1688	**SHEF (Set-top Box HTTP Exported Functionality)**
  1689	- **Protocol Version:** 1.12 (current H24/100 receiver)
  1690	- **Documentation Version:** 1.3.C (October 2011)
  1691	- **Port:** 8080 (default HTTP API port)
  1692	- **Protocol:** HTTP REST API
  1693	- **Response Format:** JSON
  1694	
  1695	**Protocol Capabilities:**
  1696	- ✅ Device information (version, serial number, mode)
  1697	- ✅ Current channel and program information
  1698	- ✅ Remote control simulation (channel change, key presses)
  1699	- ✅ Program guide data for specific channels
  1700	- ✅ Device location information (multi-room setups)
  1701	
  1702	**Protocol Limitations:**
  1703	- ❌ NO subscription/package information
  1704	- ❌ NO account details or billing data
  1705	- ❌ NO entitled channels list
  1706	- ❌ NO premium package status
  1707	
  1708	**Why Subscription Data is Unavailable:**
  1709	The SHEF API is designed for device control, not account management. Subscription data lives in DirecTV's cloud systems and would require integration with DirecTV's official business API, which is separate from the receiver's local HTTP API.
  1710	
  1711	### Current Status
  1712	**Last Updated:** October 15, 2025, 7:08 PM  
  1713	**Overall Status:** ✅ **FULLY FUNCTIONAL**  
  1714	**Working Features:** 
  1715	- ✅ Receiver management and configuration
  1716	- ✅ Device connectivity testing  
  1717	- ✅ Real-time device status monitoring
  1718	- ✅ Current channel and program information
  1719	- ✅ Device information display (receiver ID, access card, software version)
  1720	- ✅ Matrix switcher integration
  1721	
  1722	**Fix Applied (October 15, 2025):**
  1723	- Fixed subscription polling to correctly handle SHEF API limitations
  1724	- Removed incorrect logic that tried to parse API commands as subscription data
  1725	- Now displays real device information instead of attempting to fetch unavailable subscription data
  1726	- Shows receiver ID, access card ID, current channel, and program information
  1727	
  1728	### SHEF API Endpoints
  1729	
  1730	The DirecTV SHEF protocol provides the following HTTP endpoints on port 8080:
  1731	
  1732	#### Device Information Endpoints
  1733	
  1734	**GET `/info/getVersion`**
  1735	- Returns device version, receiver ID, access card ID, software version, and SHEF API version
  1736	- Example: `http://192.168.5.121:8080/info/getVersion`
  1737	- Response includes: `receiverId`, `accessCardId`, `stbSoftwareVersion`, `version`, `systemTime`
  1738	
  1739	**GET `/info/getSerialNum`**
  1740	- Returns device serial number
  1741	- Example: `http://192.168.5.121:8080/info/getSerialNum`
  1742	
  1743	**GET `/info/mode`**
  1744	- Returns device operational mode (0 = active, other values = standby/off)
  1745	- Example: `http://192.168.5.121:8080/info/mode`
  1746	
  1747	**GET `/info/getLocations`**
  1748	- Lists available client locations for multi-room setups
  1749	- Example: `http://192.168.5.121:8080/info/getLocations`
  1750	
  1751	**GET `/info/getOptions`**
  1752	- Returns list of available API commands (NOT subscription data)
  1753	- This endpoint was previously misunderstood to provide subscription information
  1754	- Actually returns a list of API endpoints with their descriptions and parameters
  1755	- Example: `http://192.168.5.121:8080/info/getOptions`
  1756	
  1757	#### TV Control Endpoints
  1758	
  1759	**GET `/tv/getTuned`**
  1760	- Returns currently tuned channel and program information
  1761	- Example: `http://192.168.5.121:8080/tv/getTuned`
  1762	- Response includes: `major`, `minor`, `callsign`, `title`, `programId`, `rating`, etc.
  1763	
  1764	**GET `/tv/getProgInfo?major=<channel>&time=<timestamp>`**
  1765	- Returns program information for a specific channel at a given time
  1766	- Parameters: `major` (required), `minor` (optional), `time` (optional)
  1767	- Example: `http://192.168.5.121:8080/tv/getProgInfo?major=202`
  1768	
  1769	**GET `/tv/tune?major=<channel>&minor=<subchannel>`**
  1770	- Tunes to a specific channel
  1771	- Parameters: `major` (required), `minor` (optional)
  1772	- Example: `http://192.168.5.121:8080/tv/tune?major=202`
  1773	
  1774	#### Remote Control Endpoints
  1775	
  1776	**GET `/remote/processKey?key=<keyname>`**
  1777	- Simulates pressing a remote control button
  1778	- Parameters: `key` (required) - button name (e.g., "power", "menu", "chanup", "chandown")
  1779	- Example: `http://192.168.5.121:8080/remote/processKey?key=power`
  1780	- Available keys: power, poweron, poweroff, format, pause, rew, replay, stop, advance, ffwd, record, play, guide, active, list, exit, back, menu, info, up, down, left, right, select, red, green, yellow, blue, chanup, chandown, prev, 0-9, dash, enter
  1781	
  1782	**GET `/serial/processCommand?cmd=<hex_command>`**
  1783	- Sends a raw serial command to the receiver (advanced users only)
  1784	- Parameters: `cmd` (required) - hexadecimal command string
  1785	
  1786	#### Deprecated Endpoints (Do Not Use)
  1787	
  1788	**GET `/dvr/getPlaylist`** - Deprecated in SHEF v1.3.C
  1789	**GET `/dvr/play`** - Deprecated in SHEF v1.3.C
  1790	
  1791	### Features
  1792	
  1793	#### Receiver Management
  1794	- **Add DirecTV Receivers:** Configure receivers with IP address, port, and receiver type
  1795	- **Matrix Integration:** Assign receivers to specific matrix input channels (1-32)
  1796	- **Connection Testing:** Test connectivity to DirecTV receivers
  1797	- **Subscription Data:** Retrieve active subscriptions and sports packages
  1798	- **Status Monitoring:** Real-time connection status indicators
  1799	
  1800	#### Receiver Configuration
  1801	- **Device Name:** Custom label for identification
  1802	- **IP Address:** Network address of DirecTV receiver
  1803	- **Port:** Default 8080 (DirecTV API port)
  1804	- **Receiver Type:** Genie HD DVR, HR24, etc.
  1805	- **Matrix Input Channel:** SELECT dropdown with 32 input channels
  1806	  - Format: "Input 1: Cable Box 1 (Cable Box)"
  1807	  - Links receiver to specific matrix input for routing
  1808	
  1809	### Testing Results (October 15, 2025)
  1810	
  1811	#### ✅ Successful Operations
  1812	
  1813	**1. Receiver Creation (PASSED)**
  1814	- Successfully created DirecTV receivers with full configuration
  1815	- Matrix Input Channel field is functional as SELECT dropdown
  1816	- All 32 matrix input channels available in dropdown
  1817	- Receiver appears in UI with proper configuration
  1818	- Status indicator shows "Connected" (green checkmark)
  1819	
  1820	**2. Receiver Deletion (PASSED)**
  1821	- Successfully removed multiple receivers (tested with 9 receivers)
  1822	- Deletion confirmation dialog appears for each receiver
  1823	- Each deletion processed successfully
  1824	- UI updates correctly after each deletion
  1825	
  1826	**3. Form Validation (PASSED)**
  1827	- IP address validation working correctly
  1828	- Port number validation (default 8080)
  1829	- Matrix input channel selection functional
  1830	- All form fields properly integrated with React state
  1831	
  1832	#### ❌ Failed Operations & Known Issues
  1833	
  1834	**1. Subscription Data Retrieval (FAILED)**
  1835	- **Status:** ❌ FAILS when no physical receiver present
  1836	- **Error Message:** "Polling Failed - Unable to connect to DirecTV receiver"
  1837	- **Dialog Display:**
  1838	  - Title: "Device Subscriptions - [Receiver Name]"
  1839	  - Error Badge: Red "Error" indicator
  1840	  - Error Message: "Polling Failed - Unable to connect to DirecTV receiver"
  1841	  - Active Subscriptions: 0
  1842	  - Sports Packages: 0
  1843	  - Last Updated: Timestamp
  1844	
  1845	**2. Connection Test Results**
  1846	- **Visual Indicator:** Shows "Connected" (green) in UI
  1847	- **Actual Status:** Cannot verify without physical hardware
  1848	- **Limitation:** UI may show connected even when receiver is unreachable
  1849	
  1850	### Error Messages & Diagnostics
  1851	
  1852	#### Subscription Polling Error
  1853	```
  1854	Error: Unable to connect to DirecTV receiver
  1855	Status: Polling Failed
  1856	Active Subscriptions: 0
  1857	Sports Packages: 0
  1858	Timestamp: [Date/Time of polling attempt]
  1859	```
  1860	
  1861	**Root Causes:**
  1862	1. **No Physical Device:** IP address has no actual DirecTV receiver
  1863	2. **Network Connectivity:** Receiver unreachable from server network
  1864	3. **Receiver Offline:** Device powered off or disconnected
  1865	4. **Firewall/Port Blocking:** Port 8080 blocked by network firewall
  1866	5. **API Endpoint Issue:** Backend API connection problems
  1867	
  1868	#### Form Input Handling Issues
  1869	During testing, direct typing in React form fields did not update state properly. Workaround implemented using native JavaScript:
  1870	
  1871	```javascript
  1872	const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  1873	  window.HTMLInputElement.prototype, "value"
  1874	).set;
  1875	nativeInputValueSetter.call(inputElement, 'value');
  1876	inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  1877	```
  1878	
  1879	### Verbose Logging Implementation
  1880	
  1881	The DirecTV system includes comprehensive logging for debugging and monitoring:
  1882	
  1883	#### Log Locations
  1884	- **PM2 Logs:** `pm2 logs sports-bar-tv`
  1885	- **Log Files:** `/home/ubuntu/.pm2/logs/`
  1886	  - `sports-bar-tv-out.log` - Standard output
  1887	  - `sports-bar-tv-error.log` - Error output
  1888	
  1889	#### Logged Operations
  1890	
  1891	**Receiver Creation:**
  1892	```
  1893	[DirecTV] Creating new receiver: Test DirecTV
  1894	[DirecTV] IP: 192.168.5.121, Port: 8080
  1895	[DirecTV] Matrix Channel: 1 (Input 1: Cable Box 1)
  1896	[DirecTV] Receiver created successfully
  1897	```
  1898	
  1899	**Connection Testing:**
  1900	```
  1901	[DirecTV] Testing connection to 192.168.5.121:8080
  1902	[DirecTV] Connection attempt: [SUCCESS/FAILED]
  1903	[DirecTV] Response time: [X]ms
  1904	```
  1905	
  1906	**Subscription Polling:**
  1907	```
  1908	[DirecTV] Polling subscriptions for receiver: Test DirecTV
  1909	[DirecTV] API endpoint: http://192.168.5.121:8080/api/subscriptions
  1910	[DirecTV] ERROR: Unable to connect to DirecTV receiver
  1911	[DirecTV] Error details: [Connection timeout/Network unreachable/etc.]
  1912	```
  1913	
  1914	**Receiver Deletion:**
  1915	```
  1916	[DirecTV] Deleting receiver: Test DirecTV (ID: xxx)
  1917	[DirecTV] Receiver deleted successfully
  1918	```
  1919	
  1920	#### Accessing Logs
  1921	
  1922	**View Real-time Logs:**
  1923	```bash
  1924	pm2 logs sports-bar-tv
  1925	```
  1926	
  1927	**View Specific Log File:**
  1928	```bash
  1929	tail -f ~/.pm2/logs/sports-bar-tv-out.log
  1930	tail -f ~/.pm2/logs/sports-bar-tv-error.log
  1931	```
  1932	
  1933	**Search Logs for DirecTV Events:**
  1934	```bash
  1935	pm2 logs sports-bar-tv | grep DirecTV
  1936	cat ~/.pm2/logs/sports-bar-tv-out.log | grep "DirecTV"
  1937	```
  1938	
  1939	### UI Components & Behavior
  1940	
  1941	#### Receiver Card Interface
  1942	When a DirecTV receiver is selected, three action buttons appear:
  1943	
  1944	1. **Purple Button (Leftmost):** Retrieve subscription data
  1945	2. **Blue Button (Middle):** Additional functionality (TBD)
  1946	3. **Red/Orange Button (Rightmost):** Delete receiver
  1947	
  1948	#### Status Indicators
  1949	- **Green Checkmark:** "Connected" status
  1950	- **Red Badge:** Error or disconnected status
  1951	- **Loading Spinner:** Operation in progress
  1952	
  1953	#### Matrix Input Channel Field
  1954	- **Type:** SELECT dropdown (not text input)
  1955	- **Position:** Second select element in form
  1956	- **Options:** 32 channels with descriptive labels
  1957	- **Value Format:** String numbers "1" through "32"
  1958	- **Label Format:** "Input [N]: [Label] ([Type])"
  1959	
  1960	### API Endpoints
  1961	
  1962	#### POST `/api/directv/receivers`
  1963	Create a new DirecTV receiver configuration.
  1964	
  1965	**Request Body:**
  1966	```json
  1967	{
  1968	  "deviceName": "Test DirecTV",
  1969	  "ipAddress": "192.168.5.121",
  1970	  "port": 8080,
  1971	  "receiverType": "Genie HD DVR",
  1972	  "matrixInputChannel": 1
  1973	}
  1974	```
  1975	
  1976	**Response:**
  1977	```json
  1978	{
  1979	  "success": true,
  1980	  "receiver": {
  1981	    "id": "xxx",
  1982	    "deviceName": "Test DirecTV",
  1983	    "ipAddress": "192.168.5.121",
  1984	    "port": 8080,
  1985	    "receiverType": "Genie HD DVR",
  1986	    "matrixInputChannel": 1,
  1987	    "connected": true,
  1988	    "createdAt": "2025-10-15T18:10:00.000Z"
  1989	  }
  1990	}
  1991	```
  1992	
  1993	#### GET `/api/directv/receivers`
  1994	Retrieve all configured DirecTV receivers.
  1995	
  1996	#### DELETE `/api/directv/receivers/[id]`
  1997	Delete a specific DirecTV receiver.
  1998	
  1999	#### POST `/api/directv/test-connection`
  2000	Test connection to a DirecTV receiver.
  2001	
  2002	**Request Body:**
  2003	```json
  2004	{
  2005	  "receiverId": "xxx"
  2006	}
  2007	```
  2008	
  2009	**Response:**
  2010	```json
  2011	{
  2012	  "success": true,
  2013	  "connected": true,
  2014	  "responseTime": 45
  2015	}
  2016	```
  2017	
  2018	#### POST `/api/directv/subscriptions`
  2019	Retrieve subscription data from DirecTV receiver.
  2020	
  2021	**Request Body:**
  2022	```json
  2023	{
  2024	  "receiverId": "xxx"
  2025	}
  2026	```
  2027	
  2028	**Response (Success):**
  2029	```json
  2030	{
  2031	  "success": true,
  2032	  "activeSubscriptions": 150,
  2033	  "sportsPackages": 12,
  2034	  "packages": [
  2035	    {"name": "NFL Sunday Ticket", "active": true},
  2036	    {"name": "NBA League Pass", "active": true}
  2037	  ],
  2038	  "lastUpdated": "2025-10-15T18:10:26.000Z"
  2039	}
  2040	```
  2041	
  2042	**Response (Error):**
  2043	```json
  2044	{
  2045	  "success": false,
  2046	  "error": "Unable to connect to DirecTV receiver",
  2047	  "activeSubscriptions": 0,
  2048	  "sportsPackages": 0,
  2049	  "lastUpdated": "2025-10-15T18:10:26.000Z"
  2050	}
  2051	```
  2052	
  2053	### Database Schema
  2054	
  2055	```prisma
  2056	model DirecTVReceiver {
  2057	  id                  String   @id @default(cuid())
  2058	  deviceName          String
  2059	  ipAddress           String
  2060	  port                Int      @default(8080)
  2061	  receiverType        String
  2062	  matrixInputChannel  Int
  2063	  connected           Boolean  @default(false)
  2064	  lastConnected       DateTime?
  2065	  activeSubscriptions Int?
  2066	  sportsPackages      Int?
  2067	  lastPolled          DateTime?
  2068	  createdAt           DateTime @default(now())
  2069	  updatedAt           DateTime @updatedAt
  2070	  
  2071	  @@unique([ipAddress, port])
  2072	}
  2073	```
  2074	
  2075	### Known Issues & Limitations
  2076	
  2077	#### 1. Physical Hardware Required
  2078	**Issue:** Subscription polling and advanced features require actual DirecTV hardware  
  2079	**Impact:** Cannot fully test or use subscription features without physical receiver  
  2080	**Workaround:** UI and management features work independently of hardware  
  2081	**Status:** EXPECTED BEHAVIOR - Not a bug
  2082	
  2083	#### 2. Connection Status Ambiguity
  2084	**Issue:** UI may show "Connected" status even when receiver is unreachable  
  2085	**Impact:** Users may be misled about actual device connectivity  
  2086	**Recommendation:** Implement periodic health checks and more accurate status reporting  
  2087	**Priority:** MEDIUM
  2088	
  2089	#### 3. Form Input React State Sync
  2090	**Issue:** Direct typing in form fields may not update React state  
  2091	**Impact:** Values may not save properly on form submission  
  2092	**Workaround:** Use native JavaScript input setter with event dispatch  
  2093	**Status:** Workaround implemented, consider fixing React state management  
  2094	**Priority:** LOW
  2095	
  2096	#### 4. Network Topology Dependency
  2097	**Issue:** Server must be on same network as DirecTV receivers  
  2098	**Impact:** Cannot manage receivers on different VLANs/subnets without routing  
  2099	**Recommendation:** Document network requirements, consider VPN/tunnel for remote access  
  2100	**Priority:** MEDIUM
  2101	
  2102	### Troubleshooting Guide
  2103	
  2104	#### Problem: "Unable to connect to DirecTV receiver"
  2105	
  2106	**Diagnostic Steps:**
  2107	
  2108	1. **Verify Network Connectivity**
  2109	   ```bash
  2110	   # SSH into server
  2111	   ssh -p 224 ubuntu@24.123.87.42
  2112	   
  2113	   # Test ping to receiver
  2114	   ping 192.168.5.121
  2115	   
  2116	   # Test HTTP connectivity
  2117	   curl http://192.168.5.121:8080
  2118	   ```
  2119	
  2120	2. **Check Receiver Status**
  2121	   - Verify DirecTV receiver is powered on
  2122	   - Confirm receiver is connected to network
  2123	   - Check receiver's IP address in network settings
  2124	   - Verify receiver's network LED indicator
  2125	
  2126	3. **Validate Configuration**
  2127	   - Confirm IP address is correct in UI
  2128	   - Verify port number (should be 8080)
  2129	   - Check receiver is configured for network control
  2130	   - Ensure receiver firmware is up to date
  2131	
  2132	4. **Review Backend Logs**
  2133	   ```bash
  2134	   # Check PM2 logs for DirecTV errors
  2135	   pm2 logs sports-bar-tv | grep DirecTV
  2136	   
  2137	   # Check last 50 lines of error log
  2138	   tail -50 ~/.pm2/logs/sports-bar-tv-error.log
  2139	   ```
  2140	
  2141	5. **Test Firewall/Port Access**
  2142	   ```bash
  2143	   # Test if port 8080 is accessible
  2144	   telnet 192.168.5.121 8080
  2145	   
  2146	   # Or use nc (netcat)
  2147	   nc -zv 192.168.5.121 8080
  2148	   ```
  2149	
  2150	6. **Verify Network Routing**
  2151	   ```bash
  2152	   # Check routing table
  2153	   route -n
  2154	   
  2155	   # Trace route to receiver
  2156	   traceroute 192.168.5.121
  2157	   ```
  2158	
  2159	#### Problem: Receiver shows "Connected" but subscription data fails
  2160	
  2161	**Possible Causes:**
  2162	- Connection test endpoint responds but subscription API doesn't
  2163	- Receiver authentication required for subscription data
  2164	- API endpoint path incorrect for receiver model
  2165	- Receiver doesn't support network subscription queries
  2166	
  2167	**Solutions:**
  2168	1. Review DirecTV receiver's network API documentation
  2169	2. Check if authentication/credentials required
  2170	3. Verify API endpoint paths for specific receiver model
  2171	4. Test with DirecTV's official API testing tools
  2172	
  2173	#### Problem: Form submission not saving values
  2174	
  2175	**Solution:**
  2176	1. Clear browser cache and reload page
  2177	2. Check browser console for JavaScript errors
  2178	3. Verify React state updates in browser DevTools
  2179	4. Use workaround with native input setters if needed
  2180	
  2181	#### Problem: Matrix input channel not routing correctly
  2182	
  2183	**Diagnostic Steps:**
  2184	1. Verify matrix input channel number is correct (1-32)
  2185	2. Check matrix switcher configuration in System Admin
  2186	3. Test matrix switching directly without DirecTV
  2187	4. Verify input channel is properly configured in matrix
  2188	
  2189	### Recommendations for Production Use
  2190	
  2191	#### Network Configuration
  2192	1. **Isolated VLAN:** Place DirecTV receivers on dedicated VLAN
  2193	2. **Static IPs:** Assign static IP addresses to all receivers
  2194	3. **DNS Records:** Create DNS entries for receivers (e.g., directv-1.local)
  2195	4. **Port Forwarding:** Configure if receivers are on different subnet
  2196	
  2197	#### Monitoring & Maintenance
  2198	1. **Health Checks:** Implement periodic connection health checks (every 5 minutes)
  2199	2. **Status Alerts:** Send notifications when receivers go offline
  2200	3. **Log Rotation:** Ensure PM2 logs don't fill disk space
  2201	4. **Backup Configuration:** Backup receiver configurations daily
  2202	
  2203	#### Testing with Real Hardware
  2204	To properly test and use DirecTV features:
  2205	
  2206	1. **Acquire Compatible Receiver:**
  2207	   - Genie HD DVR (HR44, HR54)
  2208	   - HR24 HD DVR
  2209	   - Or other network-enabled DirecTV receivers
  2210	
  2211	2. **Network Setup:**
  2212	   - Connect receiver to network
  2213	   - Assign static IP or create DHCP reservation
  2214	   - Verify network connectivity from server
  2215	
  2216	3. **Receiver Configuration:**
  2217	   - Enable network control in receiver settings
  2218	   - Configure IP address and port
  2219	   - Test receiver's web interface directly
  2220	
  2221	4. **Application Testing:**
  2222	   - Add receiver with correct IP and settings
  2223	   - Test connection functionality
  2224	   - Verify subscription polling works
  2225	   - Test matrix routing integration
  2226	
  2227	#### Security Considerations
  2228	1. **API Access:** Secure DirecTV API endpoints if exposed
  2229	2. **Network Segmentation:** Isolate receivers from guest networks
  2230	3. **Access Control:** Implement authentication for receiver management
  2231	4. **Audit Logging:** Log all receiver configuration changes
  2232	
  2233	### Integration with Matrix Switcher
  2234	
  2235	DirecTV receivers integrate seamlessly with the Wolfpack HDMI matrix:
  2236	
  2237	1. **Configuration:** Assign receiver to specific matrix input channel
  2238	2. **Routing:** Route receiver to any TV output via matrix control
  2239	3. **Status:** Monitor receiver status alongside matrix outputs
  2240	4. **Control:** Manage receiver and routing from single interface
  2241	
  2242	**Example Workflow:**
  2243	1. Add DirecTV receiver on matrix input channel 5
  2244	2. Configure receiver as "Sports Bar DirecTV - Main"
  2245	3. Route to TV outputs as needed for sports events
  2246	4. Monitor connection status and subscriptions
  2247	5. Verify sports packages include desired channels
  2248	
  2249	### Future Enhancements
  2250	
  2251	**Planned Features:**
  2252	- [ ] Implement periodic health checks with accurate status reporting
  2253	- [ ] Add receiver channel control (change channels remotely)
  2254	- [ ] Integrate with Sports Guide for auto-tuning
  2255	- [ ] Support multiple receiver types (clients, mini-Genies)
  2256	- [ ] Implement receiver discovery on network
  2257	- [ ] Add bulk receiver management
  2258	- [ ] Create receiver groups for simultaneous control
  2259	- [ ] Implement receiver event scheduling
  2260	
  2261	**Under Consideration:**
  2262	- Remote recording management
  2263	- DVR playlist integration
  2264	- Channel favorites sync
  2265	- Multi-receiver coordination
  2266	- Advanced diagnostic tools
  2267	
  2268	---
  2269	
  2270	## 8. IR Device Setup & Global Cache Integration
  2271	
  2272	### Overview
  2273	**Version:** 1.0  
  2274	**Last Updated:** October 17, 2025  
  2275	**Status:** Production Ready
  2276	
  2277	The IR Device Setup system provides comprehensive management of infrared-controlled devices (cable boxes, satellite receivers, AV receivers, etc.) through Global Cache iTach IR control devices. This unified system allows users to configure IR devices, assign them to Global Cache devices and ports, and control them remotely.
  2278	
  2279	### System Architecture
  2280	
  2281	#### Components
  2282	
  2283	1. **Global Cache iTach Devices**
  2284	   - Network-connected IR blasters
  2285	   - Support 3 IR ports per device
  2286	   - TCP communication on port 4998
  2287	   - Status monitoring and health checks
  2288	
  2289	2. **IR Devices**
  2290	   - Physical devices to be controlled (cable boxes, receivers, etc.)
  2291	   - Each device linked to a specific Global Cache device and port
  2292	   - Matrix switcher integration for video routing
  2293	   - IR command database integration
  2294	
  2295	3. **IR Command Database**
  2296	   - Global Cache online IR code database
  2297	   - Thousands of device codesets
  2298	   - Search by brand/model
  2299	   - Automatic command download
  2300	
  2301	### Features
  2302	
  2303	#### Global Cache Device Management
  2304	- **Add/Remove Devices**: Configure Global Cache iTach devices with IP address and port
  2305	- **Connection Testing**: Test connectivity to devices
  2306	- **Port Configuration**: Manage 3 IR ports per device
  2307	- **Status Monitoring**: Real-time online/offline status
  2308	- **Port Assignment**: Track which IR device is assigned to each port
  2309	
  2310	#### IR Device Configuration
  2311	- **Device Creation**: Add IR devices with:
  2312	  - Name (e.g., "Cable Box 1")
  2313	  - Type (Cable Box, Satellite, AV Receiver, etc.)
  2314	  - Brand (e.g., "DirecTV", "Dish", "Denon")
  2315	  - Model (optional)
  2316	  - Global Cache device selection (dropdown)
  2317	  - Port number selection (dropdown, filtered by device)
  2318	  - Matrix input channel (optional)
  2319	  - Description (optional)
  2320	
  2321	- **Edit Functionality**: Modify existing IR device configurations
  2322	- **Delete Functionality**: Remove IR devices with confirmation
  2323	- **IR Database Integration**: Search and download IR codes from Global Cache database
  2324	- **Command Management**: View and organize IR commands per device
  2325	
  2326	#### Verbose Logging
  2327	All operations include comprehensive console logging:
  2328	- Component mounting and initialization
  2329	- Device loading and counts
  2330	- Global Cache device selection
  2331	- Port selection changes
  2332	- Add/Update/Delete operations
  2333	- API calls and responses
  2334	- Error handling with detailed messages
  2335	
  2336	### API Endpoints
  2337	
  2338	#### Global Cache Devices
  2339	
  2340	**GET `/api/globalcache/devices`**
  2341	- List all Global Cache devices with ports
  2342	- Returns device status, IP address, port info
  2343	
  2344	**POST `/api/globalcache/devices`**
  2345	- Add new Global Cache device
  2346	- Tests connection during creation
  2347	- Creates 3 IR ports automatically
  2348	
  2349	**DELETE `/api/globalcache/devices/[id]`**
  2350	- Remove Global Cache device
  2351	- Cascades to delete port assignments
  2352	
  2353	#### IR Devices
  2354	
  2355	**GET `/api/ir/devices`**
  2356	- List all IR devices
  2357	- Includes ports, commands, and Global Cache assignments
  2358	- Comprehensive logging
  2359	
  2360	**POST `/api/ir/devices`**
  2361	- Create new IR device
  2362	- Accepts globalCacheDeviceId and globalCachePortNumber
  2363	- Validates required fields (name, deviceType, brand)
  2364	- Logs all operations
  2365	
  2366	**PUT `/api/ir/devices/[id]`**
  2367	- Update existing IR device
  2368	- Supports partial updates
  2369	- Logs changes with before/after values
  2370	
  2371	**DELETE `/api/ir/devices/[id]`**
  2372	- Remove IR device
  2373	- Deletes associated commands
  2374	- Requires confirmation
  2375	
  2376	#### IR Commands
  2377	
  2378	**GET `/api/ir/database/brands`**
  2379	- Search IR database for device brands
  2380	
  2381	**GET `/api/ir/database/models`**
  2382	- Get models for specific brand
  2383	
  2384	**POST `/api/ir/database/download`**
  2385	- Download IR commands for device
  2386	- Saves to database linked to IR device
  2387	
  2388	### Database Schema
  2389	
  2390	#### GlobalCacheDevice
  2391	```prisma
  2392	model GlobalCacheDevice {
  2393	  id          String              @id @default(cuid())
  2394	  name        String
  2395	  ipAddress   String              @unique
  2396	  port        Int                 @default(4998)
  2397	  model       String?
  2398	  status      String              @default("offline")
  2399	  lastSeen    DateTime?
  2400	  ports       GlobalCachePort[]
  2401	  createdAt   DateTime            @default(now())
  2402	  updatedAt   DateTime            @updatedAt
  2403	}
  2404	```
  2405	
  2406	#### GlobalCachePort
  2407	```prisma
  2408	model GlobalCachePort {
  2409	  id                String            @id @default(cuid())
  2410	  deviceId          String
  2411	  device            GlobalCacheDevice @relation(...)
  2412	  portNumber        Int
  2413	  portType          String            @default("IR")
  2414	  assignedTo        String?
  2415	  assignedDeviceId  String?
  2416	  enabled           Boolean           @default(true)
  2417	  irDevice          IRDevice?         @relation(...)
  2418	  createdAt         DateTime          @default(now())
  2419	  updatedAt         DateTime          @updatedAt
  2420	}
  2421	```
  2422	
  2423	#### IRDevice
  2424	```prisma
  2425	model IRDevice {
  2426	  id                    String              @id @default(cuid())
  2427	  name                  String
  2428	  deviceType            String
  2429	  brand                 String
  2430	  model                 String?
  2431	  matrixInput           Int?
  2432	  matrixInputLabel      String?
  2433	  irCodeSetId           String?
  2434	  globalCacheDeviceId   String?             // NEW FIELD
  2435	  globalCachePortNumber Int?                // NEW FIELD
  2436	  description           String?
  2437	  status                String              @default("active")
  2438	  ports                 GlobalCachePort[]
  2439	  commands              IRCommand[]
  2440	  createdAt             DateTime            @default(now())
  2441	  updatedAt             DateTime            @updatedAt
  2442	}
  2443	```
  2444	
  2445	#### IRCommand
  2446	```prisma
  2447	model IRCommand {
  2448	  id                String    @id @default(cuid())
  2449	  deviceId          String
  2450	  device            IRDevice  @relation(...)
  2451	  functionName      String
  2452	  irCode            String
  2453	  category          String?
  2454	  description       String?
  2455	  createdAt         DateTime  @default(now())
  2456	  updatedAt         DateTime  @updatedAt
  2457	}
  2458	```
  2459	
  2460	### User Interface
  2461	
  2462	#### Device Configuration Page (`/device-config`)
  2463	- **Two Tabs**:
  2464	  1. **Global Cache**: Manage Global Cache iTach devices
  2465	  2. **IR Devices**: Configure IR-controlled devices
  2466	
  2467	#### IR Device Setup Interface
  2468	
  2469	**Add/Edit Form Fields:**
  2470	- Device Name* (required)
  2471	- Device Type* (dropdown: Cable Box, Satellite, AV Receiver, etc.)
  2472	- Brand* (required)
  2473	- Model (optional)
  2474	- **Global Cache Device** (dropdown with device name, IP, status)
  2475	- **Port Number** (dropdown, shows Port 1-3, filtered by selected device)
  2476	- Matrix Input Channel (optional)
  2477	- Matrix Input Label (optional)
  2478	- Description (optional)
  2479	
  2480	**Device Cards Display:**
  2481	- Device name, brand, model, type
  2482	- Command count badge
  2483	- Global Cache device name
  2484	- Global Cache port number
  2485	- Matrix input information
  2486	- Codeset ID
  2487	- Description
  2488	- Available commands (first 10 shown)
  2489	- Action buttons:
  2490	  - IR Database (search and download codes)
  2491	  - Edit (modify configuration)
  2492	  - Delete (remove device)
  2493	
  2494	### Workflow
  2495	
  2496	#### Adding a New IR Device
  2497	
  2498	1. **Navigate to Device Configuration** (`/device-config`)
  2499	2. **Switch to IR Devices Tab**
  2500	3. **Click "Add IR Device"**
  2501	4. **Fill in device information**:
  2502	   - Name: "Cable Box 1"
  2503	   - Type: "Cable Box"
  2504	   - Brand: "Spectrum"
  2505	   - Model: "DCX3600" (optional)
  2506	5. **Select Global Cache Device**:
  2507	   - Choose from dropdown: "GC iTach 1 (192.168.5.110) - online"
  2508	   - Port dropdown activates
  2509	6. **Select Port Number**:
  2510	   - Choose "Port 1 (IR)" or "Port 2 (IR)" or "Port 3 (IR)"
  2511	   - Shows if port is already assigned
  2512	7. **Optionally set Matrix Input**:
  2513	   - Channel: 5
  2514	   - Label: "Cable"
  2515	8. **Add Description** (optional)
  2516	9. **Click "Add Device"**
  2517	10. **Device appears in list** with all configured details
  2518	
  2519	#### Downloading IR Codes
  2520	
  2521	1. **Click "IR Database" button** on device card
  2522	2. **Search for device** by brand and model
  2523	3. **Select codeset** from results
  2524	4. **Download commands** to device
  2525	5. **Commands appear** in device card
  2526	
  2527	#### Editing an IR Device
  2528	
  2529	1. **Click "Edit" button** on device card
  2530	2. **Form pre-fills** with current values
  2531	3. **Modify any fields**:
  2532	   - Change Global Cache device
  2533	   - Switch port number
  2534	   - Update matrix channel
  2535	4. **Click "Update Device"**
  2536	5. **Device updates** immediately
  2537	
  2538	### Console Logging Examples
  2539	
  2540	#### Component Mount
  2541	```
  2542	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2543	🔌 [IR DEVICE SETUP] Component mounted
  2544	   Timestamp: 2025-10-17T10:30:00.000Z
  2545	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2546	```
  2547	
  2548	#### Loading Devices
  2549	```
  2550	📋 [IR DEVICE SETUP] Loading IR devices...
  2551	✅ [IR DEVICE SETUP] IR devices loaded: 3
  2552	📡 [IR DEVICE SETUP] Loading Global Cache devices...
  2553	✅ [IR DEVICE SETUP] Global Cache devices loaded: 2
  2554	```
  2555	
  2556	#### Adding Device
  2557	```
  2558	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2559	➕ [IR DEVICE SETUP] Adding new device
  2560	   Name: Cable Box 1
  2561	   Type: Cable Box
  2562	   Brand: Spectrum
  2563	   Global Cache Device: cm1234567890
  2564	   Global Cache Port: 1
  2565	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2566	```
  2567	
  2568	#### API Response
  2569	```
  2570	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2571	➕ [IR DEVICES] Creating new IR device
  2572	   Timestamp: 2025-10-17T10:30:00.000Z
  2573	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2574	   Name: Cable Box 1
  2575	   Type: Cable Box
  2576	   Brand: Spectrum
  2577	   Model: DCX3600
  2578	   Global Cache Device: cm1234567890
  2579	   Global Cache Port: 1
  2580	✅ [IR DEVICES] Device created successfully
  2581	   ID: clm9876543210
  2582	━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2583	```
  2584	
  2585	### Troubleshooting
  2586	
  2587	#### Issue: No Global Cache devices in dropdown
  2588	
  2589	**Solution:**
  2590	1. Navigate to Global Cache tab
  2591	2. Add Global Cache iTach device with IP address
  2592	3. Test connection
  2593	4. Return to IR Devices tab
  2594	5. Refresh page if needed
  2595	
  2596	#### Issue: Port dropdown is disabled
  2597	
  2598	**Solution:**
  2599	1. Select a Global Cache device first
  2600	2. Port dropdown will activate automatically
  2601	3. Ports are filtered to show only enabled ports on selected device
  2602	
  2603	#### Issue: Device not controlling IR equipment
  2604	
  2605	**Diagnostic Steps:**
  2606	1. Verify Global Cache device is online (check status in Global Cache tab)
  2607	2. Confirm correct port number is selected
  2608	3. Test Global Cache connection manually
  2609	4. Ensure IR emitter is connected to correct port
  2610	5. Download IR codes from database if not done
  2611	6. Test IR commands through API
  2612	
  2613	#### Issue: IR codes not working
  2614	
  2615	**Solution:**
  2616	1. Try downloading different codeset from IR database
  2617	2. Verify IR emitter is positioned correctly near device IR sensor
  2618	3. Check for IR interference from other sources
  2619	4. Test Global Cache device with other commands
  2620	
  2621	#### Issue: "Argument `irCode` is missing" error when downloading IR codes
  2622	
  2623	**Error Message:**
  2624	```
  2625	❌ Error downloading VOLUME UP: 
  2626	Invalid `prisma.iRCommand.create()` invocation:
  2627	{
  2628	  data: {
  2629	    deviceId: "...",
  2630	    functionName: "VOLUME UP",
  2631	    hexCode: undefined,
  2632	    codeSetId: "6935",
  2633	    category: "Volume",
  2634	+   irCode: String
  2635	  }
  2636	}
  2637	Argument `irCode` is missing.
  2638	```
  2639	
  2640	**Root Causes:**
  2641	1. **API Rate Limit**: Global Cache API has daily download limits
  2642	2. **Invalid API Key**: API key expired or not logged in
  2643	3. **Missing Code Data**: API returned error response instead of code data
  2644	4. **Network Issues**: Connection problems with Global Cache servers
  2645	
  2646	**Fix Applied (October 17, 2025):**
  2647	
  2648	The system now includes comprehensive validation and error handling:
  2649	
  2650	1. **API Response Validation**: Checks if response is a `CodeResponse` (error) vs `Code` (success)
  2651	2. **Error Code Mapping**: Maps Global Cache API error codes to human-readable messages:
  2652	   - Code 2: API Key not found
  2653	   - Code 3: User not logged in
  2654	   - Code 4: Too many requests (rate limit exceeded)
  2655	   - Code 5: Unknown output type
  2656	   - Code 6: Direct output not allowed for account
  2657	   - Code 7: API key required but not provided
  2658	   - Code 8: Email send failed
  2659	   - Code 9: Unknown format requested
  2660	3. **Missing Field Detection**: Validates that `Code1` field exists before creating database entry
  2661	4. **Enhanced Logging**: Detailed console logs show raw API responses and validation steps
  2662	
  2663	**Diagnostic Steps:**
  2664	1. **Check PM2 logs** for detailed error messages:
  2665	   ```bash
  2666	   pm2 logs sports-bar-tv | grep "IR DATABASE"
  2667	   ```
  2668	
  2669	2. **Look for API error codes** in logs:
  2670	   ```
  2671	   ⚠️  [IR DATABASE] Received CodeResponse (not Code)
  2672	      Status: failure
  2673	      Message: Too many IR codes already requested today
  2674	      Error Code: 4
  2675	   ```
  2676	
  2677	3. **Verify API credentials**:
  2678	   - Check if logged in to Global Cache IR Database
  2679	   - Verify API key is valid and active
  2680	   - Re-login if necessary
  2681	
  2682	4. **Check rate limits**:
  2683	   - Global Cache limits downloads per day
  2684	   - Wait 24 hours if rate limit exceeded
  2685	   - Consider using sandbox mode for testing
  2686	
  2687	**Solutions:**
  2688	
  2689	1. **Rate Limit Exceeded (Error Code 4)**:
  2690	   - Wait until next day (resets at midnight UTC)
  2691	   - Use sandbox mode for testing: Add `sandbox=true` to API URL
  2692	   - Prioritize essential commands only
  2693	
  2694	2. **API Key Issues (Error Code 2, 3, 7)**:
  2695	   - Navigate to IR Device Setup
  2696	   - Click "IR Database Login"
  2697	   - Enter credentials and re-login
  2698	   - Verify API key is stored in database
  2699	
  2700	3. **Network/Connection Issues**:
  2701	   - Check internet connectivity
  2702	   - Verify firewall allows outbound HTTPS to irdb.globalcache.com:8081
  2703	   - Test connection to Global Cache API
  2704	
  2705	4. **Invalid Code Data**:
  2706	   - Try different codeset for same device
  2707	   - Report issue to Global Cache support
  2708	   - Use learning mode if available
  2709	
  2710	**Verification:**
  2711	
  2712	After fix, successful downloads show:
  2713	```
  2714	✅ [IR DATABASE] Code downloaded successfully
  2715	   Function: VOLUME UP
  2716	   Code1 length: 68
  2717	   HexCode1 length: 32
  2718	✅ Created command: VOLUME UP
  2719	```
  2720	
  2721	**Prevention:**
  2722	- Monitor daily download count
  2723	- Download codes in batches to avoid rate limits
  2724	- Keep API credentials current and valid
  2725	- Use comprehensive error handling in custom integrations
  2726	
  2727	### Best Practices
  2728	
  2729	#### Global Cache Device Naming
  2730	- Use descriptive names: "GC iTach 1 - Bar Area"
  2731	- Include location for easy identification
  2732	- Document which area/rack device is located in
  2733	
  2734	#### Port Assignment
  2735	- Document port assignments in device descriptions
  2736	- Use consistent naming conventions
  2737	- Track cable connections physically
  2738	
  2739	#### IR Device Organization
  2740	- Use clear, consistent naming
  2741	- Include location in name: "Cable Box 1 - TV 3"
  2742	- Set matrix input for automatic video routing
  2743	- Add detailed descriptions for complex setups
  2744	
  2745	#### Testing
  2746	- Test connection after adding Global Cache device
  2747	- Verify IR codes work before production use
  2748	- Test edit functionality periodically
  2749	- Monitor logs for errors
  2750	
  2751	### Integration with Other Systems
  2752	
  2753	#### Matrix Switcher
  2754	- IR devices can specify matrix input channel
  2755	- Enables automatic video routing
  2756	- Coordinates IR control with video switching
  2757	
  2758	#### Bartender Remote
  2759	- IR commands can be triggered from remote interface
  2760	- Simplifies bartender operations
  2761	- Reduces complexity for staff
  2762	
  2763	#### Schedule System
  2764	- IR devices can be controlled via scheduled events
  2765	- Automatic channel changes
  2766	- Power on/off automation
  2767	
  2768	### Future Enhancements
  2769	
  2770	**Planned Features:**
  2771	- [ ] Macro commands (multiple IR commands in sequence)
  2772	- [ ] IR learning mode (learn from physical remote)
  2773	- [ ] Bulk IR code downloads
  2774	- [ ] Command testing interface
  2775	- [ ] Activity monitoring and logging
  2776	- [ ] Port conflict detection
  2777	- [ ] Automatic port assignment suggestions
  2778	- [ ] IR code validation and testing
  2779	
  2780	### Migration Notes
  2781	
  2782	**October 17, 2025 Update:**
  2783	- Added `globalCacheDeviceId` field to IRDevice model
  2784	- Added `globalCachePortNumber` field to IRDevice model
  2785	- Updated API routes to handle new fields
  2786	- Added dropdown selectors in UI
  2787	- Implemented edit functionality
  2788	- Added comprehensive verbose logging throughout
  2789	
  2790	**Database Migration:**
  2791	```bash
  2792	cd /home/ubuntu/Sports-Bar-TV-Controller
  2793	npx prisma db push
  2794	npx prisma generate
  2795	```
  2796	
  2797	**Component Updates:**
  2798	- IRDeviceSetup.tsx: Added Global Cache device/port selection
  2799	- API routes: Added logging and new field handling
  2800	- Database schema: Added new fields with indexes
  2801	
  2802	### Support
  2803	
  2804	**Viewing Logs:**
  2805	```bash
  2806	# Real-time logs
  2807	pm2 logs sports-bar-tv
  2808	
  2809	# Search for IR device operations
  2810	pm2 logs sports-bar-tv | grep "IR DEVICE SETUP"
  2811	
  2812	# Search for API operations
  2813	pm2 logs sports-bar-tv | grep "IR DEVICES"
  2814	```
  2815	
  2816	**Testing API:**
  2817	```bash
  2818	# List IR devices
  2819	curl http://24.123.87.42:3000/api/ir/devices
  2820	
  2821	# List Global Cache devices
  2822	curl http://24.123.87.42:3000/api/globalcache/devices
  2823	
  2824	# Test Global Cache connection
  2825	curl -X POST http://24.123.87.42:3000/api/globalcache/devices/[id]/test
  2826	```
  2827	
  2828	---
  2829	
  2830	## 9. Remote Control
  2831	
  2832	### Overview
  2833	Bartender Remote interface for quick TV and audio control.
  2834	
  2835	### Features
  2836	- Quick TV source selection
  2837	- Matrix status display
  2838	- Bar layout visualization
  2839	- Input source shortcuts
  2840	
  2841	---
  2842	
  2843	## 10. System Admin
  2844	
  2845	### Overview
  2846	Administrative tools for system management, testing, and maintenance.
  2847	
  2848	### Features
  2849	
  2850	#### Wolfpack Configuration
  2851	- Matrix IP address setup
  2852	- Connection testing
  2853	- Switching tests
  2854	
  2855	#### Matrix Inputs/Outputs
  2856	- Input/output labeling
  2857	- Enable/disable configuration
  2858	- Schedule participation settings
  2859	
  2860	#### System Logs
  2861	- Application logs
  2862	- Error tracking
  2863	- Activity monitoring
  2864	
  2865	#### Backup Management
  2866	- Manual backup creation
  2867	- Backup restoration
  2868	- Automated backup status
  2869	
  2870	#### TODO Management
  2871	- Task tracking
  2872	- Priority management
  2873	- Status updates
  2874	
  2875	### Wolfpack Integration
  2876	
  2877	#### POST `/api/wolfpack/test-connection`
  2878	Test connectivity to Wolfpack matrix:
  2879	```json
  2880	{
  2881	  "ipAddress": "192.168.1.100"
  2882	}
  2883	```
  2884	
  2885	#### POST `/api/wolfpack/test-switching`
  2886	Test matrix switching functionality
  2887	
  2888	#### Database Schema
  2889	
  2890	```prisma
  2891	model WolfpackConfig {
  2892	  id         Int      @id @default(autoincrement())
  2893	  ipAddress  String   @unique
  2894	  name       String?
  2895	  createdAt  DateTime @default(now())
  2896	  updatedAt  DateTime @updatedAt
  2897	}
  2898	```
  2899	
  2900	### TODO Management
  2901	
  2902	The TODO management system provides task tracking and project management capabilities. The system automatically maintains a `TODO_LIST.md` file that reflects the current state of all tasks in the database.
  2903	
  2904	#### ⚠️ Important: TODO_LIST.md is Auto-Generated
  2905	
  2906	**DO NOT EDIT TODO_LIST.md MANUALLY**
  2907	
  2908	The `TODO_LIST.md` file is automatically generated and updated by the TODO management system. Any manual changes will be overwritten when the system syncs. Always use the TODO API to add, update, or delete tasks.
  2909	
  2910	The auto-generation happens:
  2911	- When a TODO is created via the API
  2912	- When a TODO is updated via the API
  2913	- When a TODO is deleted via the API
  2914	- During periodic system syncs
  2915	
  2916	#### Database Schema
  2917	
  2918	```prisma
  2919	model Todo {
  2920	  id              String        @id @default(cuid())
  2921	  title           String
  2922	  description     String?
  2923	  priority        String        @default("MEDIUM") // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  2924	  status          String        @default("PLANNED") // "PLANNED", "IN_PROGRESS", "TESTING", "COMPLETE"
  2925	  category        String?
  2926	  tags            String?       // JSON array of tags
  2927	  createdAt       DateTime      @default(now())
  2928	  updatedAt       DateTime      @updatedAt
  2929	  completedAt     DateTime?
  2930	  
  2931	  documents       TodoDocument[]
  2932	}
  2933	
  2934	model TodoDocument {
  2935	  id              String   @id @default(cuid())
  2936	  todoId          String
  2937	  filename        String
  2938	  filepath        String
  2939	  filesize        Int?
  2940	  mimetype        String?
  2941	  uploadedAt      DateTime @default(now())
  2942	  
  2943	  todo            Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  2944	  
  2945	  @@index([todoId])
  2946	}
  2947	```
  2948	
  2949	#### API Endpoints
  2950	
  2951	##### GET `/api/todos` - List all TODOs
  2952	
  2953	Retrieve all TODOs with optional filtering.
  2954	
  2955	**Query Parameters:**
  2956	- `status` (optional) - Filter by status: `PLANNED`, `IN_PROGRESS`, `TESTING`, `COMPLETE`
  2957	- `priority` (optional) - Filter by priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  2958	- `category` (optional) - Filter by category string
  2959	
  2960	**Response:**
  2961	```json
  2962	{
  2963	  "success": true,
  2964	  "data": [
  2965	    {
  2966	      "id": "cmgki7fkg0001vsfg6ghz142f",
  2967	      "title": "Fix critical bug",
  2968	      "description": "Detailed description...",
  2969	      "priority": "CRITICAL",
  2970	      "status": "PLANNED",
  2971	      "category": "Bug Fix",
  2972	      "tags": "[\"ai-hub\", \"database\"]",
  2973	      "createdAt": "2025-10-10T07:07:10.000Z",
  2974	      "updatedAt": "2025-10-10T07:07:10.000Z",
  2975	      "completedAt": null,
  2976	      "documents": []
  2977	    }
  2978	  ]
  2979	}
  2980	```
  2981	
  2982	**Example cURL:**
  2983	```bash
  2984	# Get all TODOs
  2985	curl http://localhost:3000/api/todos
  2986	
  2987	# Get only high priority TODOs
  2988	curl http://localhost:3000/api/todos?priority=HIGH
  2989	
  2990	# Get in-progress tasks
  2991	curl http://localhost:3000/api/todos?status=IN_PROGRESS
  2992	```
  2993	
  2994	##### POST `/api/todos` - Create new TODO
  2995	
  2996	Add a new TODO item to the system. The TODO_LIST.md file will be automatically updated.
  2997	
  2998	**Request Body:**
  2999	```json
  3000	{
  3001	  "title": "Task title (required)",
  3002	  "description": "Detailed task description (optional)",
  3003	  "priority": "MEDIUM",
  3004	  "status": "PLANNED",
  3005	  "category": "Category name (optional)",
  3006	  "tags": ["tag1", "tag2"]
  3007	}
  3008	```
  3009	
  3010	**Priority Levels:**
  3011	- `LOW` - Minor tasks, nice-to-have features
  3012	- `MEDIUM` - Standard priority (default)
  3013	- `HIGH` - Important tasks requiring attention
  3014	- `CRITICAL` - Urgent tasks blocking functionality
  3015	
  3016	**Status Values:**
  3017	- `PLANNED` - Task is planned but not started (default)
  3018	- `IN_PROGRESS` - Currently being worked on
  3019	- `TESTING` - Implementation complete, being tested
  3020	- `COMPLETE` - Task finished and verified
  3021	
  3022	**Response:**
  3023	```json
  3024	{
  3025	  "success": true,
  3026	  "data": {
  3027	    "id": "cmgki7fkg0001vsfg6ghz142f",
  3028	    "title": "Task title",
  3029	    "description": "Detailed task description",
  3030	    "priority": "MEDIUM",
  3031	    "status": "PLANNED",
  3032	    "category": "Category name",
  3033	    "tags": "[\"tag1\", \"tag2\"]",
  3034	    "createdAt": "2025-10-15T03:00:00.000Z",
  3035	    "updatedAt": "2025-10-15T03:00:00.000Z",
  3036	    "completedAt": null,
  3037	    "documents": []
  3038	  }
  3039	}
  3040	```
  3041	
  3042	**Example API Calls with Different Priority Levels:**
  3043	
  3044	**1. Create a LOW priority task:**
  3045	```bash
  3046	curl -X POST http://localhost:3000/api/todos \
  3047	  -H "Content-Type: application/json" \
  3048	  -d '{
  3049	    "title": "Update documentation styling",
  3050	    "description": "Improve markdown formatting in README files",
  3051	    "priority": "LOW",
  3052	    "status": "PLANNED",
  3053	    "category": "Enhancement",
  3054	    "tags": ["documentation", "style"]
  3055	  }'
  3056	```
  3057	
  3058	**2. Create a MEDIUM priority task (default):**
  3059	```bash
  3060	curl -X POST http://localhost:3000/api/todos \
  3061	  -H "Content-Type: application/json" \
  3062	  -d '{
  3063	    "title": "Add unit tests for TODO API",
  3064	    "description": "Create comprehensive test suite for TODO endpoints",
  3065	    "priority": "MEDIUM",
  3066	    "category": "Testing & QA",
  3067	    "tags": ["testing", "api"]
  3068	  }'
  3069	```
  3070	
  3071	**3. Create a HIGH priority task:**
  3072	```bash
  3073	curl -X POST http://localhost:3000/api/todos \
  3074	  -H "Content-Type: application/json" \
  3075	  -d '{
  3076	    "title": "Optimize database queries",
  3077	    "description": "Profile and optimize slow database queries affecting performance",
  3078	    "priority": "HIGH",
  3079	    "status": "PLANNED",
  3080	    "category": "Performance",
  3081	    "tags": ["database", "optimization", "high-priority"]
  3082	  }'
  3083	```
  3084	
  3085	**4. Create a CRITICAL priority task:**
  3086	```bash
  3087	curl -X POST http://localhost:3000/api/todos \
  3088	  -H "Content-Type: application/json" \
  3089	  -d '{
  3090	    "title": "CRITICAL: Fix authentication bypass vulnerability",
  3091	    "description": "Security vulnerability discovered in authentication flow allowing unauthorized access",
  3092	    "priority": "CRITICAL",
  3093	    "status": "IN_PROGRESS",
  3094	    "category": "Security",
  3095	    "tags": ["security", "critical", "urgent", "blocking"]
  3096	  }'
  3097	```
  3098	
  3099	**JavaScript/TypeScript Example:**
  3100	```typescript
  3101	// Using fetch API
  3102	async function createTodo(todoData: {
  3103	  title: string;
  3104	  description?: string;
  3105	  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  3106	  status?: 'PLANNED' | 'IN_PROGRESS' | 'TESTING' | 'COMPLETE';
  3107	  category?: string;
  3108	  tags?: string[];
  3109	}) {
  3110	  const response = await fetch('/api/todos', {
  3111	    method: 'POST',
  3112	    headers: {
  3113	      'Content-Type': 'application/json',
  3114	    },
  3115	    body: JSON.stringify(todoData),
  3116	  });
  3117	
  3118	  const result = await response.json();
  3119	  return result;
  3120	}
  3121	
  3122	// Example usage
  3123	const newTodo = await createTodo({
  3124	  title: 'Implement feature X',
  3125	  description: 'Add new feature to the system',
  3126	  priority: 'HIGH',
  3127	  category: 'Feature',
  3128	  tags: ['frontend', 'ui']
  3129	});
  3130	```
  3131	
  3132	##### PUT `/api/todos/[id]` - Update TODO
  3133	
  3134	Update an existing TODO item.
  3135	
  3136	**Request Body:** Same as POST (all fields optional except those you want to update)
  3137	
  3138	**Example cURL:**
  3139	```bash
  3140	curl -X PUT http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f \
  3141	  -H "Content-Type: application/json" \
  3142	  -d '{
  3143	    "status": "IN_PROGRESS",
  3144	    "priority": "HIGH"
  3145	  }'
  3146	```
  3147	
  3148	##### DELETE `/api/todos/[id]` - Delete TODO
  3149	
  3150	Remove a TODO item from the system.
  3151	
  3152	**Example cURL:**
  3153	```bash
  3154	curl -X DELETE http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f
  3155	```
  3156	
  3157	##### POST `/api/todos/[id]/complete` - Mark TODO as complete
  3158	
  3159	Mark a TODO as complete and set the completion timestamp.
  3160	
  3161	**Example cURL:**
  3162	```bash
  3163	curl -X POST http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f/complete
  3164	```
  3165	
  3166	#### Authentication & Authorization
  3167	
  3168	**Current Status:** No authentication required
  3169	
  3170	The TODO API currently does not require authentication or authorization. All endpoints are publicly accessible on the local network. This is suitable for internal use within a trusted network environment.
  3171	
  3172	**Security Considerations:**
  3173	- API is accessible to anyone on the same network
  3174	- Suitable for internal sports bar management systems
  3175	- For production internet-facing deployments, consider adding:
  3176	  - JWT-based authentication
  3177	  - Role-based access control (RBAC)
  3178	  - API rate limiting
  3179	  - IP whitelisting
  3180	
  3181	#### GitHub Synchronization
  3182	
  3183	The TODO system automatically synchronizes with GitHub:
  3184	- When a TODO is created, updated, or deleted, the `TODO_LIST.md` file is automatically regenerated
  3185	- Changes are committed to the repository with descriptive commit messages
  3186	- Synchronization happens in the background without blocking API responses
  3187	- If GitHub sync fails, the operation still succeeds locally (sync errors are logged)
  3188	
  3189	**Sync Commit Messages:**
  3190	- Create: `chore: Add TODO - [Task Title]`
  3191	- Update: `chore: Update TODO - [Task Title]`
  3192	- Delete: `chore: Remove TODO - [Task Title]`
  3193	
  3194	#### Best Practices
  3195	
  3196	1. **Always use the API** - Never edit TODO_LIST.md directly
  3197	2. **Use descriptive titles** - Make tasks easy to understand at a glance
  3198	3. **Add detailed descriptions** - Include steps, affected components, and expected outcomes
  3199	4. **Tag appropriately** - Use consistent tags for filtering and organization
  3200	5. **Set correct priority** - Use CRITICAL sparingly for true blocking issues
  3201	6. **Update status regularly** - Keep task status current as work progresses
  3202	7. **Complete tasks** - Use the complete endpoint to properly timestamp completion
  3203	
  3204	---
  3205	
  3206	## Backup & Maintenance
  3207	
  3208	### Automated Daily Backup
  3209	
  3210	**Schedule:** Daily at 3:00 AM (server time)  
  3211	**Script:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/backup_script.js`  
  3212	**Backup Directory:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/backups/`  
  3213	**Retention:** 14 days
  3214	
  3215	**Cron Job:**
  3216	```bash
  3217	0 3 * * * cd /home/ubuntu/github_repos/Sports-Bar-TV-Controller && /usr/bin/node backup_script.js >> backup.log 2>&1
  3218	```
  3219	
  3220	**What Gets Backed Up:**
  3221	1. Matrix configuration (JSON format)
  3222	2. Database files (`prisma/data/sports_bar.db`)
  3223	3. Atlas configurations
  3224	
  3225	**Backup File Format:** `backup_YYYY-MM-DD_HH-MM-SS.json`
  3226	
  3227	### Manual Backup
  3228	
  3229	**Database:**
  3230	```bash
  3231	pg_dump sports_bar_tv > backup_$(date +%Y%m%d_%H%M%S).sql
  3232	```
  3233	
  3234	**Application:**
  3235	```bash
  3236	tar -czf sports-bar-backup-$(date +%Y%m%d).tar.gz ~/github_repos/Sports-Bar-TV-Controller
  3237	```
  3238	
  3239	### Restore from Backup
  3240	
  3241	**Database:**
  3242	```bash
  3243	psql sports_bar_tv < backup_20251015_020000.sql
  3244	```
  3245	
  3246	**Atlas Configuration:**
  3247	```bash
  3248	cd ~/github_repos/Sports-Bar-TV-Controller/data/atlas-configs
  3249	cp cmgjxa5ai000260a7xuiepjl_backup_TIMESTAMP.json cmgjxa5ai000260a7xuiepjl.json
  3250	```
  3251	
  3252	---
  3253	
  3254	## Troubleshooting
  3255	
  3256	### Application Issues
  3257	
  3258	**Application Won't Start:**
  3259	```bash
  3260	# Check PM2 status
  3261	pm2 status
  3262	
  3263	# View logs
  3264	pm2 logs sports-bar-tv
  3265	
  3266	# Restart application
  3267	pm2 restart sports-bar-tv
  3268	```
  3269	
  3270	**Database Connection Errors:**
  3271	```bash
  3272	# Check database status
  3273	npx prisma db pull
  3274	
  3275	# Run pending migrations
  3276	npx prisma migrate deploy
  3277	
  3278	# Regenerate Prisma client
  3279	npx prisma generate
  3280	```
  3281	
  3282	### Network Issues
  3283	
  3284	**Wolfpack Matrix Not Responding:**
  3285	1. Check network connectivity: `ping <wolfpack-ip>`
  3286	2. Verify matrix is powered on
  3287	3. Check network cable connections
  3288	4. Confirm same network/VLAN
  3289	5. Test connection in System Admin
  3290	
  3291	**Atlas Processor Offline:**
  3292	1. Check connectivity: `ping 192.168.5.101`
  3293	2. Verify processor is powered on
  3294	3. Check configuration file exists
  3295	4. Restore from backup if needed
  3296	
  3297	### Performance Issues
  3298	
  3299	**Slow Response Times:**
  3300	1. Check PM2 resource usage: `pm2 monit`
  3301	2. Review application logs
  3302	3. Check database size and optimize
  3303	4. Restart application if needed
  3304	
  3305	**High Memory Usage:**
  3306	1. Check PM2 status: `pm2 status`
  3307	2. Restart application: `pm2 restart sports-bar-tv`
  3308	3. Monitor logs for memory leaks
  3309	
  3310	---
  3311	
  3312	## Security Best Practices
  3313	
  3314	### Network Security
  3315	- Wolfpack matrix on isolated VLAN
  3316	- Application behind firewall
  3317	- Use HTTPS in production (configure reverse proxy)
  3318	
  3319	### Authentication
  3320	- Strong passwords for all accounts
  3321	- Regular password rotation
  3322	- Secure storage of credentials
  3323	
  3324	### API Security
  3325	- API keys in `.env` file only
  3326	- Never commit `.env` to repository
  3327	- Masked display in UI
  3328	- Server-side validation
  3329	
  3330	### Database Security
  3331	- Strong database passwords
  3332	- Restrict access to localhost
  3333	- Regular security updates
  3334	- Encrypted backups
  3335	
  3336	---
  3337	
  3338	## Recent Changes
  3339	
  3340	### October 15, 2025 - DirecTV Integration Documentation Update
  3341	**Status:** ✅ Documentation complete  
  3342	**Updated By:** DeepAgent
  3343	
  3344	#### Documentation Added
  3345	- ✅ Comprehensive DirecTV Integration section (Section 7)
  3346	- ✅ Complete testing results from October 15, 2025 testing session
  3347	- ✅ Detailed error messages and diagnostics
  3348	- ✅ Verbose logging implementation details
  3349	- ✅ API endpoint specifications with request/response examples
  3350	- ✅ Database schema for DirecTVReceiver model
  3351	- ✅ Known issues and limitations documentation
  3352	- ✅ Comprehensive troubleshooting guide
  3353	- ✅ Production deployment recommendations
  3354	- ✅ Network configuration guidelines
  3355	- ✅ Security considerations
  3356	- ✅ Future enhancement roadmap
  3357	
  3358	#### Testing Results Documented
  3359	**Successful Operations:**
  3360	- Receiver creation with full configuration
  3361	- Receiver deletion (tested with 9 receivers)
  3362	- Form validation and React integration
  3363	- Matrix input channel selection (32 channels)
  3364	
  3365	**Known Issues:**
  3366	- Subscription polling requires physical DirecTV hardware
  3367	- Connection status ambiguity in UI
  3368	- Form input React state synchronization workaround needed
  3369	- Network topology dependencies
  3370	
  3371	#### Logging Details Added
  3372	- PM2 log locations and access methods
  3373	- Logged operations for all DirecTV activities
  3374	- Example log outputs for debugging
  3375	- Log search commands for troubleshooting
  3376	
  3377	#### Troubleshooting Guide Includes
  3378	- Network connectivity verification steps
  3379	- Receiver status checking procedures
  3380	- Configuration validation methods
  3381	- Backend log review commands
  3382	- Firewall/port testing procedures
  3383	- Common problems and solutions
  3384	
  3385	---
  3386	
  3387	### October 15, 2025 - PR #193: Unified Prisma Client & AI Hub Fixes (MERGED TO MAIN)
  3388	**Status:** ✅ Successfully merged, tested, and deployed
  3389	
  3390	#### Changes Implemented
  3391	1. **Prisma Client Singleton Pattern**
  3392	   - ✅ Unified all Prisma client imports across 9 API route files to use singleton from `@/lib/db`
  3393	   - ✅ Prevents multiple Prisma client instances and potential memory leaks
  3394	   - ✅ Improves database connection management
  3395	   - ✅ Standardizes database access patterns throughout the application
  3396	
  3397	2. **AI Hub Database Models**
  3398	   - ✅ Added `IndexedFile` model for tracking indexed codebase files
  3399	   - ✅ Added `QAEntry` model (renamed from QAPair) for Q&A training data
  3400	   - ✅ Added `TrainingDocument` model for AI Hub training documents
  3401	   - ✅ Added `ApiKey` model for managing AI provider API keys
  3402	   - ✅ Successfully migrated database with new schema
  3403	
  3404	3. **Logging Enhancements**
  3405	   - ✅ Added comprehensive verbose logging to AI system components:
  3406	     - Codebase indexing process with file counts and progress
  3407	     - Vector embeddings generation and storage
  3408	     - Q&A entry creation with detailed field logging
  3409	     - Q&A entry retrieval with query debugging
  3410	     - Database operations with success/failure tracking
  3411	
  3412	4. **Bug Fixes**
  3413	   - ✅ Fixed Q&A entries GET handler that was incorrectly processing requests as POST
  3414	   - ✅ Corrected async/await patterns in Q&A API routes
  3415	   - ✅ Improved error handling with detailed error messages
  3416	
  3417	#### Testing Results (Remote Server: 24.123.87.42:3000)
  3418	All features successfully tested on production server:
  3419	- ✅ **Codebase Indexing:** 720 files successfully indexed
  3420	- ✅ **Q&A Entry Creation:** Successfully created test entries with proper field mapping
  3421	- ✅ **Q&A Entry Retrieval:** GET requests now working correctly, returns all entries
  3422	- ✅ **Verbose Logging:** Confirmed in PM2 logs with detailed debugging information
  3423	- ✅ **Database Integrity:** All migrations applied successfully, schema validated
  3424	
  3425	#### Files Modified in PR #193
  3426	- `src/app/api/ai-assistant/index-codebase/route.ts` - Added verbose logging & unified Prisma
  3427	- `src/app/api/ai-assistant/search-code/route.ts` - Unified Prisma client import
  3428	- `src/app/api/ai/qa-entries/route.ts` - Fixed GET handler bug & added logging
  3429	- `src/app/api/cec/discovery/route.ts` - Unified Prisma client import
  3430	- `src/app/api/home-teams/route.ts` - Unified Prisma client import
  3431	- `src/app/api/schedules/[id]/route.ts` - Unified Prisma client import
  3432	- `src/app/api/schedules/execute/route.ts` - Unified Prisma client import
  3433	- `src/app/api/schedules/logs/route.ts` - Unified Prisma client import
  3434	- `src/app/api/schedules/route.ts` - Unified Prisma client import
  3435	- `prisma/schema.prisma` - Added new AI Hub models
  3436	- All backup files removed for clean codebase
  3437	
  3438	#### Related Pull Requests
  3439	- ✅ **PR #193** - Successfully merged to main branch (supersedes PR #169)
  3440	- ❌ **PR #169** - Closed due to merge conflicts (superseded by PR #193)
  3441	
  3442	#### Benefits Achieved
  3443	- Eliminated Prisma client instance conflicts
  3444	- Improved AI Hub reliability and debuggability
  3445	- Enhanced production monitoring with verbose logging
  3446	- Fixed critical Q&A entry retrieval bug
  3447	- Clean, maintainable codebase with consistent patterns
  3448	
  3449	
  3450	### October 15, 2025 - AI Hub Testing & Documentation Update
  3451	- ✅ Comprehensive AI Hub testing completed
  3452	- ✅ Identified 2 critical errors requiring immediate fixes
  3453	- ✅ Created detailed testing report
  3454	- ✅ Reorganized documentation by site tabs
  3455	- ✅ Updated port from 3001 to 3000
  3456	- ✅ Added detailed AI Hub section with status and fix plans
  3457	
  3458	### October 14, 2025 - AI Hub Database Models
  3459	- ✅ Added missing database models (IndexedFile, QAPair, TrainingDocument, ApiKey)
  3460	- ✅ Fixed AI Hub API routes
  3461	- ✅ Verified basic AI Hub functionality
  3462	
  3463	### October 10, 2025 - Atlas Configuration Restoration
  3464	- ✅ Fixed critical Atlas configuration wipe bug
  3465	- ✅ Restored Atlas configuration from backup
  3466	- ✅ Fixed dynamic zone labels
  3467	- ✅ Implemented matrix label updates
  3468	- ✅ Fixed matrix test database errors
  3469	
  3470	### October 9, 2025 - Outputs Configuration & Backup System
  3471	- ✅ Configured outputs 1-4 as full matrix outputs
  3472	- ✅ Implemented automated daily backup system
  3473	- ✅ Added 14-day retention policy
  3474	
  3475	---
  3476	
  3477	## Support Resources
  3478	
  3479	### Documentation Links
  3480	- Next.js: https://nextjs.org/docs
  3481	- Prisma: https://www.prisma.io/docs
  3482	- Tailwind CSS: https://tailwindcss.com/docs
  3483	
  3484	### Project Resources
  3485	- **GitHub Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
  3486	- **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
  3487	- **AI Hub Testing Report:** `/home/ubuntu/ai_hub_testing_report.md`
  3488	
  3489	### Getting Help
  3490	1. Check this documentation
  3491	2. Review application logs: `pm2 logs sports-bar-tv`
  3492	3. Check GitHub issues
  3493	4. Create new issue with detailed information
  3494	
  3495	---
  3496	
  3497	*Last Updated: October 15, 2025 by DeepAgent*  
  3498	*Version: 2.2*  
  3499	*Status: Production Ready (AI Hub has 2 critical issues requiring fixes)*
  3500	---
  3501	
  3502	## Recent Deployments
  3503	
  3504	### PR #193 - Prisma Client Singleton Pattern Fix (October 15, 2025)
  3505	
  3506	**Deployment Date:** October 15, 2025  
  3507	**Deployed By:** DeepAgent  
  3508	**Commit:** f51616d - "Fix: Unify Prisma Client Singleton Pattern (#193)"
  3509	
  3510	**Changes:**
  3511	- Unified Prisma Client singleton pattern across the application
  3512	- Fixed database connection handling issues
  3513	- Improved application stability and performance
  3514	
  3515	**Deployment Steps Executed:**
  3516	1. SSH connection established to production server (24.123.87.42:224)
  3517	2. Navigated to `/home/ubuntu/Sports-Bar-TV-Controller`
  3518	3. Pulled latest changes from main branch (already up to date)
  3519	4. Ran `npm install` (dependencies up to date)
  3520	5. Generated Prisma Client with `npx prisma generate`
  3521	6. Built application with `npm run build` (completed successfully)
  3522	7. Restarted PM2 process `sports-bar-tv`
  3523	
  3524	**Verification:**
  3525	- PM2 process status: **Online** ✓
  3526	- Application startup: **Successful** (Ready in 496ms) ✓
  3527	- Memory usage: 57.0mb (healthy) ✓
  3528	- CPU usage: 0% (stable) ✓
  3529	- Uptime: Stable with no crashes ✓
  3530	
  3531	**Documentation Updates:**
  3532	- Corrected production server path to `/home/ubuntu/Sports-Bar-TV-Controller`
  3533	- Updated PM2 process name to `sports-bar-tv` (was incorrectly documented as `sports-bar-tv-controller`)
  3534	- Added `npx prisma generate` step to deployment procedure
  3535	- Clarified distinction between development and production paths
  3536	
  3537	
  3538	---
  3539	
  3540	## 11. Amazon Fire TV Integration
  3541	
  3542	### Overview
  3543	
  3544	The Sports Bar TV Controller includes comprehensive integration with Amazon Fire TV devices for remote control, automation, and matrix routing. The system uses Android Debug Bridge (ADB) for network-based control of Fire TV devices, enabling automated content selection, app launching, and coordination with the Wolfpack HDMI matrix switcher.
  3545	
  3546	**Current Production Configuration:**
  3547	- **Fire TV Model:** Fire TV Cube (3rd Gen - AFTGAZL)
  3548	- **IP Address:** 192.168.5.131
  3549	- **Port:** 5555 (ADB default)
  3550	- **Matrix Input:** Channel 13
  3551	- **Connection Status:** Fully operational
  3552	- **ADB Status:** Enabled and connected
  3553	
  3554	### Fire TV Cube Specifications
  3555	
  3556	**Hardware:**
  3557	- **Model:** AFTGAZL (Amazon Fire TV Cube, 3rd Generation - 2022)
  3558	- **Processor:** Octa-core ARM-based processor
  3559	- **RAM:** 2GB
  3560	- **Storage:** 16GB
  3561	- **Operating System:** Fire OS 7+ (Based on Android 9)
  3562	- **Network:** Wi-Fi 6, Gigabit Ethernet port
  3563	- **Ports:** HDMI 2.1 output, Micro USB, Ethernet, IR extender
  3564	
  3565	**Capabilities:**
  3566	- 4K Ultra HD, HDR, HDR10+, Dolby Vision
  3567	- Dolby Atmos audio
  3568	- Hands-free Alexa voice control
  3569	- Built-in speaker for Alexa
  3570	- IR blaster for TV control
  3571	- HDMI-CEC support
  3572	
  3573	### ADB Bridge Configuration
  3574	
  3575	**Server Configuration:**
  3576	- **ADB Path:** `/usr/bin/adb`
  3577	- **ADB Version:** 1.0.41 (Version 28.0.2-debian)
  3578	- **Installation Location:** `/usr/lib/android-sdk/platform-tools/adb`
  3579	- **Connection Status:** Active and connected to 192.168.5.131:5555
  3580	- **Device State:** "device" (fully operational)
  3581	- **Setup Date:** October 16, 2025
  3582	
  3583	**Connection Management:**
  3584	```bash
  3585	# Connect to Fire TV Cube
  3586	adb connect 192.168.5.131:5555
  3587	
  3588	# Check connection status
  3589	adb devices
  3590	# Expected output:
  3591	# List of devices attached
  3592	# 192.168.5.131:5555    device
  3593	
  3594	# Test device communication
  3595	adb -s 192.168.5.131:5555 shell getprop ro.product.model
  3596	# Expected output: AFTGAZL
  3597	
  3598	# Disconnect (if needed)
  3599	adb disconnect 192.168.5.131:5555
  3600	```
  3601	
  3602	### Enabling ADB on Fire TV
  3603	
  3604	**Step-by-Step Process:**
  3605	
  3606	1. **Enable Developer Options:**
  3607	   - Go to Settings → My Fire TV → About
  3608	   - Click on device name 7 times rapidly
  3609	   - "Developer Options" will appear in Settings
  3610	
  3611	2. **Enable ADB Debugging:**
  3612	   - Go to Settings → My Fire TV → Developer Options
  3613	   - Turn on "ADB Debugging"
  3614	   - Confirm warning dialog
  3615	
  3616	3. **First Connection Authorization:**
  3617	   - First ADB connection shows authorization prompt on TV
  3618	   - Select "Always allow from this computer"
  3619	   - Tap OK to authorize
  3620	
  3621	### Matrix Integration
  3622	
  3623	**Physical Connection:**
  3624	- Fire TV Cube HDMI output → Wolfpack Matrix Input 13
  3625	- Matrix can route Input 13 to any of 32 TV outputs
  3626	
  3627	**Routing Control:**
  3628	```bash
  3629	# Route Fire TV to specific TV output
  3630	POST /api/matrix/route
  3631	{
  3632	  "input": 13,      # Fire TV's matrix input
  3633	  "output": 33      # Target TV output
  3634	}
  3635	
  3636	# Route to multiple TVs simultaneously
  3637	POST /api/matrix/route-multiple
  3638	{
  3639	  "input": 13,
  3640	  "outputs": [33, 34, 35]
  3641	}
  3642	```
  3643	
  3644	**Benefits:**
  3645	- Unified control of Fire TV content routing
  3646	- Show same Fire TV content on multiple displays
  3647	- Quick switching between Fire TV and other sources
  3648	- Coordinate Fire TV control with matrix routing
  3649	
  3650	### API Endpoints
  3651	
  3652	#### Device Management
  3653	
  3654	**GET /api/firetv-devices**
  3655	- Retrieve all configured Fire TV devices
  3656	- Returns array of device objects with status
  3657	
  3658	**POST /api/firetv-devices**
  3659	- Add new Fire TV device
  3660	- Requires: name, ipAddress, port, deviceType
  3661	- Optional: inputChannel (matrix input)
  3662	- Validates IP format and prevents duplicates
  3663	
  3664	**PUT /api/firetv-devices**
  3665	- Update existing Fire TV device configuration
  3666	- Can modify all fields except device ID
  3667	
  3668	**DELETE /api/firetv-devices?id={deviceId}**
  3669	- Remove Fire TV device from system
  3670	- Device can be re-added anytime
  3671	
  3672	#### Remote Control
  3673	
  3674	**POST /api/firetv-devices/send-command**
  3675	Send remote control command to Fire TV:
  3676	```json
  3677	{
  3678	  "deviceId": "device_id",
  3679	  "ipAddress": "192.168.5.131",
  3680	  "port": 5555,
  3681	  "command": "HOME"
  3682	}
  3683	```
  3684	
  3685	**Supported Commands:**
  3686	- Navigation: UP, DOWN, LEFT, RIGHT, OK, BACK, HOME, MENU
  3687	- Media: PLAY_PAUSE, PLAY, PAUSE, REWIND, FAST_FORWARD
  3688	- Volume: VOL_UP, VOL_DOWN, MUTE
  3689	- Power: SLEEP, WAKEUP
  3690	
  3691	**App Launch:**
  3692	```json
  3693	{
  3694	  "deviceId": "device_id",
  3695	  "ipAddress": "192.168.5.131",
  3696	  "port": 5555,
  3697	  "appPackage": "com.espn.score_center"
  3698	}
  3699	```
  3700	
  3701	#### Connection Testing
  3702	
  3703	**POST /api/firetv-devices/test-connection**
  3704	Test connectivity to Fire TV device:
  3705	```json
  3706	{
  3707	  "ipAddress": "192.168.5.131",
  3708	  "port": 5555,
  3709	  "deviceId": "device_id"
  3710	}
  3711	```
  3712	
  3713	**Success Response:**
  3714	```json
  3715	{
  3716	  "success": true,
  3717	  "message": "Fire TV device connected via ADB",
  3718	  "deviceInfo": {
  3719	    "model": "AFTGAZL",
  3720	    "version": "Fire OS 7.6.6.8"
  3721	  }
  3722	}
  3723	```
  3724	
  3725	#### Subscription Polling
  3726	
  3727	**POST /api/firetv-devices/subscriptions/poll**
  3728	Retrieve device status and installed apps:
  3729	```json
  3730	{
  3731	  "deviceId": "device_id",
  3732	  "ipAddress": "192.168.5.131",
  3733	  "port": 5555
  3734	}
  3735	```
  3736	
  3737	### Remote Control Commands
  3738	
  3739	**Navigation Commands:**
  3740	```bash
  3741	# D-Pad Navigation
  3742	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_UP        # 19
  3743	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_DOWN      # 20
  3744	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_LEFT      # 21
  3745	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_RIGHT     # 22
  3746	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_CENTER    # 23 (OK/Select)
  3747	
  3748	# System Navigation
  3749	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_HOME           # 3
  3750	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_BACK           # 4
  3751	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MENU           # 82
  3752	```
  3753	
  3754	**Media Controls:**
  3755	```bash
  3756	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PLAY_PAUSE    # 85
  3757	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PLAY          # 126
  3758	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PAUSE         # 127
  3759	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_REWIND        # 89
  3760	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_FAST_FORWARD  # 90
  3761	```
  3762	
  3763	**Volume Controls:**
  3764	```bash
  3765	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_VOLUME_UP      # 24
  3766	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_VOLUME_DOWN    # 25
  3767	adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_VOLUME_MUTE    # 164
  3768	```
  3769	
  3770	### Streaming Apps Configuration
  3771	
  3772	**Sports Streaming Apps:**
  3773	- **ESPN** - `com.espn.score_center`
  3774	- **FOX Sports** - `com.fox.now`
  3775	- **NBC Sports** - `com.nbc.nbcsports.liveextra`
  3776	- **Paramount+** (CBS Sports) - `com.cbs.ott`
  3777	- **YouTube TV** - `com.google.android.youtube.tv`
  3778	
  3779	**League-Specific Apps:**
  3780	- **NFL+** - `com.nflmobile.nflnow`
  3781	- **NFL Game Pass** - `com.nfl.gamepass`
  3782	- **NBA League Pass** - `com.nba.game`
  3783	- **MLB.TV** - `com.bamnetworks.mobile.android.gameday.mlb`
  3784	- **NHL.TV** - `com.nhl.gc1112.free`
  3785	
  3786	**App Launch Commands:**
  3787	```bash
  3788	# Launch ESPN
  3789	adb -s 192.168.5.131:5555 shell monkey -p com.espn.score_center 1
  3790	
  3791	# Launch Netflix
  3792	adb -s 192.168.5.131:5555 shell monkey -p com.netflix.ninja 1
  3793	
  3794	# Alternative method
  3795	adb -s 192.168.5.131:5555 shell am start -n com.espn.score_center/.MainActivity
  3796	```
  3797	
  3798	### Automation Capabilities
  3799	
  3800	**Scheduled App Launching:**
  3801	```bash
  3802	# Crontab example: Launch ESPN at 7 PM daily
  3803	0 19 * * * curl -X POST http://localhost:3000/api/firetv-devices/send-command \
  3804	  -H "Content-Type: application/json" \
  3805	  -d '{"deviceId":"device_id","appPackage":"com.espn.score_center"}'
  3806	```
  3807	
  3808	**Coordinated Control:**
  3809	```bash
  3810	# Script for game day setup
  3811	#!/bin/bash
  3812	# 1. Route Fire TV to main bar TVs
  3813	curl -X POST http://localhost:3000/api/matrix/route \
  3814	  -d '{"input":13,"outputs":[33,34,35]}'
  3815	
  3816	# 2. Launch sports app
  3817	curl -X POST http://localhost:3000/api/firetv-devices/send-command \
  3818	  -d '{"deviceId":"device_id","appPackage":"com.espn.score_center"}'
  3819	```
  3820	
  3821	### Diagnostic Commands
  3822	
  3823	**Device Information:**
  3824	```bash
  3825	# Get device model
  3826	adb -s 192.168.5.131:5555 shell getprop ro.product.model
  3827	# Output: AFTGAZL
  3828	
  3829	# Get Fire OS version
  3830	adb -s 192.168.5.131:5555 shell getprop ro.build.version.release
  3831	# Output: 9
  3832	
  3833	# Get all properties
  3834	adb -s 192.168.5.131:5555 shell getprop
  3835	
  3836	# Get device uptime
  3837	adb -s 192.168.5.131:5555 shell uptime
  3838	```
  3839	
  3840	**Network Information:**
  3841	```bash
  3842	# IP address details
  3843	adb -s 192.168.5.131:5555 shell ifconfig wlan0
  3844	
  3845	# Network interfaces
  3846	adb -s 192.168.5.131:5555 shell ip addr show
  3847	```
  3848	
  3849	**Installed Apps:**
  3850	```bash
  3851	# List all packages
  3852	adb -s 192.168.5.131:5555 shell pm list packages
  3853	
  3854	# User-installed apps only
  3855	adb -s 192.168.5.131:5555 shell pm list packages -3
  3856	
  3857	# Search for specific app
  3858	adb -s 192.168.5.131:5555 shell pm list packages | grep -i espn
  3859	```
  3860	
  3861	**Current App Status:**
  3862	```bash
  3863	# Get currently focused app
  3864	adb -s 192.168.5.131:5555 shell dumpsys window | grep mCurrentFocus
  3865	# Output: mCurrentFocus=Window{hash u0 package/activity}
  3866	```
  3867	
  3868	### Troubleshooting
  3869	
  3870	**Device Shows Offline:**
  3871	
  3872	1. **Verify Network Connectivity:**
  3873	   ```bash
  3874	   ping 192.168.5.131
  3875	   # Should respond with low latency (< 50ms)
  3876	   ```
  3877	
  3878	2. **Check ADB Status on Fire TV:**
  3879	   - Settings → My Fire TV → Developer Options
  3880	   - Ensure "ADB Debugging" is ON
  3881	   - May auto-disable after system updates
  3882	
  3883	3. **Test Port Accessibility:**
  3884	   ```bash
  3885	   telnet 192.168.5.131 5555
  3886	   # Or
  3887	   nc -zv 192.168.5.131 5555
  3888	   ```
  3889	
  3890	4. **Restart ADB Server:**
  3891	   ```bash
  3892	   adb kill-server
  3893	   adb start-server
  3894	   adb connect 192.168.5.131:5555
  3895	   ```
  3896	
  3897	5. **Restart Fire TV:**
  3898	   - Unplug Fire TV Cube for 30 seconds
  3899	   - Plug back in, wait for full boot (2 minutes)
  3900	   - Reconnect ADB
  3901	
  3902	**Commands Timeout:**
  3903	
  3904	1. Check network latency (should be < 100ms)
  3905	2. Verify Fire TV not overloaded (close background apps)
  3906	3. Test with simple command (HOME) first
  3907	4. Review PM2 logs for specific errors
  3908	
  3909	**Connection Drops:**
  3910	
  3911	1. **Use Static IP:**
  3912	   - Assign static IP to Fire TV: 192.168.5.131
  3913	   - Or use DHCP reservation based on MAC address
  3914	
  3915	2. **Improve Network:**
  3916	   - Use Ethernet instead of Wi-Fi (recommended)
  3917	   - Check for network congestion
  3918	   - Verify no VLAN isolation
  3919	
  3920	3. **Keep-Alive Script:**
  3921	   ```bash
  3922	   # Run every 5 minutes via cron
  3923	   */5 * * * * adb -s 192.168.5.131:5555 shell echo "keepalive" > /dev/null
  3924	   ```
  3925	
  3926	### Health Monitoring
  3927	
  3928	**Automated Health Check Script:**
  3929	```bash
  3930	#!/bin/bash
  3931	# /home/ubuntu/scripts/firetv-health-check.sh
  3932	
  3933	DEVICE_IP="192.168.5.131"
  3934	DEVICE_PORT="5555"
  3935	LOG="/var/log/firetv-health.log"
  3936	
  3937	# Test connectivity
  3938	if ! adb devices | grep "$DEVICE_IP:$DEVICE_PORT" | grep "device" > /dev/null; then
  3939	  echo "[$(date)] Fire TV offline - reconnecting" >> $LOG
  3940	  adb connect $DEVICE_IP:$DEVICE_PORT >> $LOG
  3941	else
  3942	  echo "[$(date)] Fire TV online" >> $LOG
  3943	fi
  3944	```
  3945	
  3946	**Schedule with cron:**
  3947	```bash
  3948	# Run every 5 minutes
  3949	*/5 * * * * /home/ubuntu/scripts/firetv-health-check.sh
  3950	```
  3951	
  3952	**Monitoring Metrics:**
  3953	- Connection status (online/offline)
  3954	- Response time (should be < 500ms)
  3955	- Command success rate (target > 95%)
  3956	- ADB connection stability
  3957	
  3958	### Data Storage
  3959	
  3960	**Configuration File:**
  3961	- **Location:** `/data/firetv-devices.json`
  3962	- **Format:** JSON array of device objects
  3963	- **Backup:** Included in automated daily backups (3:00 AM)
  3964	- **Backup Location:** `/backups/` with timestamps
  3965	
  3966	**Device Object Structure:**
  3967	```json
  3968	{
  3969	  "id": "firetv_timestamp_hash",
  3970	  "name": "Fire TV Cube Bar",
  3971	  "ipAddress": "192.168.5.131",
  3972	  "port": 5555,
  3973	  "deviceType": "Fire TV Cube",
  3974	  "inputChannel": "13",
  3975	  "isOnline": true,
  3976	  "adbEnabled": true,
  3977	  "addedAt": "2025-10-16T10:30:00.000Z",
  3978	  "updatedAt": "2025-10-16T12:00:00.000Z"
  3979	}
  3980	```
  3981	
  3982	### Best Practices
  3983	
  3984	**Network Configuration:**
  3985	- Use static IP address for Fire TV devices
  3986	- Ethernet connection preferred over Wi-Fi
  3987	- Ensure low latency (< 50ms) to Fire TV
  3988	- No firewall blocking port 5555
  3989	
  3990	**Device Management:**
  3991	- Keep ADB debugging enabled at all times
  3992	- Regular connectivity tests before events
  3993	- Monitor for system updates (may disable ADB)
  3994	- Restart Fire TV weekly during maintenance
  3995	
  3996	**Security:**
  3997	- Limit access to ADB port (5555) from external networks
  3998	- Use network segmentation for streaming devices
  3999	- Secure SSH access to controller server
  4000	- Monitor unauthorized ADB connection attempts
  4001	
  4002	**Performance:**
  4003	- Close unused apps regularly
  4004	- Clear cache monthly
  4005	- Monitor storage space (keep > 2GB free)
  4006	- Restart Fire TV during off-hours
  4007	
  4008	### Integration with Sports Guide
  4009	
  4010	**Automated Content Selection:**
  4011	- Sports Guide can trigger Fire TV app launches
  4012	- Route Fire TV to appropriate displays based on schedule
  4013	- Coordinate multiple Fire TVs for multi-game viewing
  4014	- Automatic switching between streaming services
  4015	
  4016	**Game Day Workflow:**
  4017	1. Sports Guide identifies upcoming games
  4018	2. System determines which streaming service has content
  4019	3. Fire TV launches appropriate app
  4020	4. Matrix routes Fire TV to designated displays
  4021	5. Content ready for viewing at game time
  4022	
  4023	### Documentation References
  4024	
  4025	**Comprehensive Documentation:**
  4026	- **Q&A Sheet:** `/home/ubuntu/amazon_firetv_qa_sheet.md`
  4027	- **ADB Bridge Setup:** `/home/ubuntu/firetv_ads_bridge_setup.md`
  4028	- **Testing Report:** `/home/ubuntu/firetv_testing_findings.md`
  4029	- **Total Q&A Pairs:** 95+ covering all aspects
  4030	
  4031	**Topics Covered:**
  4032	- Device setup and configuration
  4033	- ADB bridge installation and setup
  4034	- Matrix integration
  4035	- API endpoints reference
  4036	- Remote control commands
  4037	- Troubleshooting procedures
  4038	- Best practices for deployment
  4039	
  4040	### Current Status
  4041	
  4042	**Production Environment:**
  4043	- ✅ Fire TV Cube connected and operational (192.168.5.131:5555)
  4044	- ✅ ADB bridge fully configured and tested
  4045	- ✅ Matrix integration active (Input 13)
  4046	- ✅ API endpoints operational
  4047	- ✅ Remote control commands working
  4048	- ✅ Form submission bugs fixed (October 15, 2025)
  4049	- ✅ CSS styling issues resolved
  4050	- ✅ Comprehensive documentation complete
  4051	
  4052	**Last Updated:** October 16, 2025
  4053	**Last Tested:** October 16, 2025
  4054	**Status:** Production Ready ✓
  4055	
  4056	---
  4057	
  4058	
  4059	---
  4060	
  4061	## LATEST UPDATE: Sports Guide v5.0.0 - October 16, 2025
  4062	
  4063	### Critical Fix Applied
  4064	
  4065	**Issue:** Sports Guide was not loading ANY data from The Rail Media API.
  4066	
  4067	**Root Cause:** Frontend/backend parameter mismatch - frontend sent `selectedLeagues`, backend expected `days/startDate/endDate`.
  4068	
  4069	**Solution:** Drastically simplified the entire system:
  4070	- ✅ **REMOVED** all league selection UI (800+ lines of code removed)
  4071	- ✅ **ADDED** automatic loading of ALL sports on page visit
  4072	- ✅ **ADDED** maximum verbosity logging for AI analysis
  4073	- ✅ **FIXED** both Sports Guide and Bartender Remote Channel Guide
  4074	
  4075	### Results
  4076	
  4077	**Sports Guide (`/sports-guide`):**
  4078	- ✅ Auto-loads 7 days of ALL sports programming
  4079	- ✅ Displays 17+ sports categories
  4080	- ✅ Shows 361+ games with full details
  4081	- ✅ No user interaction required
  4082	- ✅ Simple search and refresh interface
  4083	
  4084	**Bartender Remote Channel Guide (`/remote` → Guide tab):**
  4085	- ✅ Successfully loads sports data from Rail Media API
  4086	- ✅ Shows device-specific channel numbers
  4087	- ✅ Cable/Satellite/Streaming support
  4088	- ✅ "Watch" button integration
  4089	
  4090	### Testing Verified
  4091	
  4092	**Test Date:** October 16, 2025 at 4:29-4:30 AM
  4093	
  4094	**Sports Guide Test Results:**
  4095	- Loaded 17 sports, 361 games
  4096	- MLB Baseball: 18 games
  4097	- NBA Basketball: 22 games  
  4098	- NFL, NHL, College sports, Soccer, and more
  4099	- Load time: ~5 seconds
  4100	
  4101	**Bartender Remote Test Results:**
  4102	- Cable Box 1 guide loaded successfully
  4103	- MLB games displayed with channel numbers (FOXD 831, UniMas 806)
  4104	- NBA games displayed with channel numbers (ESPN2 28, NBALP)
  4105	- Watch buttons functional
  4106	
  4107	### Architecture Changes (v5.0.0)
  4108	
  4109	**Before:**
  4110	```
  4111	Frontend → { selectedLeagues: [...] }
  4112	     ↓
  4113	API Route expects { days, startDate, endDate }
  4114	     ↓
  4115	MISMATCH ❌ → No data
  4116	```
  4117	
  4118	**After:**
  4119	```
  4120	Frontend → Auto-load on mount → { days: 7 }
  4121	     ↓
  4122	API Route → Fetch from Rail Media API
  4123	     ↓
  4124	ALL sports data returned ✅
  4125	     ↓
  4126	Display in both Sports Guide and Bartender Remote ✅
  4127	```
  4128	
  4129	### Maximum Verbosity Logging
  4130	
  4131	All API routes now include comprehensive timestamped logging:
  4132	- Every API request with full parameters
  4133	- Full API responses with data counts
  4134	- Error details with stack traces
  4135	- Performance timing
  4136	- Accessible via `pm2 logs sports-bar-tv`
  4137	
  4138	### Files Modified
  4139	
  4140	1. `/src/app/api/sports-guide/route.ts` - Simplified auto-loading API
  4141	2. `/src/components/SportsGuide.tsx` - Removed league UI, added auto-loading
  4142	3. `/src/app/api/channel-guide/route.ts` - Integrated Rail Media API
  4143	
  4144	### Deployment
  4145	
  4146	```bash
  4147	cd /home/ubuntu/Sports-Bar-TV-Controller
  4148	npm run build
  4149	pm2 restart sports-bar-tv
  4150	```
  4151	
  4152	**Status:** Application successfully rebuilt and restarted.
  4153	
  4154	### Detailed Report
  4155	
  4156	See `SPORTS_GUIDE_FIX_REPORT.md` for complete technical details, testing results, and architecture diagrams.
  4157	
  4158	---
  4159	
  4160	