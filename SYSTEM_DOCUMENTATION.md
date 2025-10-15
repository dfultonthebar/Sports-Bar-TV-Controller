Here's the result of running `cat -n` on /home/ubuntu/github_repos/Sports-Bar-TV-Controller/SYSTEM_DOCUMENTATION.md:
     1	# Sports Bar TV Controller - System Documentation
     2	
     3	**Version:** 2.1  
     4	**Last Updated:** October 15, 2025  
     5	**Status:** Production Ready
     6	
     7	---
     8	
     9	## Quick Access Information
    10	
    11	### Server Access
    12	- **Host:** 24.123.87.42
    13	- **Port:** 224 (SSH)
    14	- **Application Port:** **3000** (HTTP)
    15	- **Username:** ubuntu
    16	- **Password:** 6809233DjD$$$ (THREE dollar signs)
    17	- **Application URL:** http://24.123.87.42:3000
    18	
    19	**SSH Connection:**
    20	```bash
    21	ssh -p 224 ubuntu@24.123.87.42
    22	```
    23	
    24	### GitHub Repository
    25	- **Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
    26	- **Project Path:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller`
    27	- **GitHub Token:** Stored securely in server environment (not documented for security)
    28	
    29	### Quick Deployment
    30	```bash
    31	# SSH into server
    32	ssh -p 224 ubuntu@24.123.87.42
    33	
    34	# Navigate to project
    35	cd ~/github_repos/Sports-Bar-TV-Controller
    36	
    37	# Pull latest changes
    38	git pull origin main
    39	
    40	# Install dependencies and build
    41	npm install
    42	npm run build
    43	
    44	# Restart application
    45	pm2 restart sports-bar-tv-controller
    46	
    47	# Check logs
    48	pm2 logs sports-bar-tv-controller
    49	```
    50	
    51	---
    52	
    53	## Database & Prisma Setup
    54	
    55	### Database Configuration
    56	- **Type:** PostgreSQL
    57	- **Connection:** Configured in `.env` file
    58	- **ORM:** Prisma
    59	
    60	### Prisma Commands
    61	```bash
    62	# Generate Prisma Client
    63	npx prisma generate
    64	
    65	# Run migrations
    66	npx prisma migrate dev
    67	
    68	# Deploy migrations (production)
    69	npx prisma migrate deploy
    70	
    71	# Open Prisma Studio (database browser)
    72	npx prisma studio
    73	
    74	# Check migration status
    75	npx prisma migrate status
    76	```
    77	
    78	### Database Schema Location
    79	- **Schema File:** `prisma/schema.prisma`
    80	- **Migrations:** `prisma/migrations/`
    81	
    82	### Key Database Models
    83	- `MatrixOutput` - TV display outputs
    84	- `MatrixInput` - Video sources
    85	- `WolfpackConfig` - Matrix switcher configuration
    86	- `AudioProcessor` - Atlas audio configuration
    87	- `IndexedFile` - AI Hub codebase files
    88	- `QAPair` - AI Hub Q&A training data
    89	- `TrainingDocument` - AI Hub training documents
    90	- `ApiKey` - AI provider API keys
    91	- `TODO` - Task management
    92	
    93	---
    94	
    95	## System Overview
    96	
    97	The Sports Bar TV Controller is a comprehensive web application designed to manage TV displays, matrix video routing, and sports content scheduling for sports bar environments.
    98	
    99	### Technology Stack
   100	- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
   101	- **Backend:** Next.js API Routes, Prisma ORM
   102	- **Database:** PostgreSQL
   103	- **Hardware Integration:** 
   104	  - Wolfpack HDMI Matrix Switchers (via HTTP API)
   105	  - Atlas AZMP8 Audio Processor (via HTTP API)
   106	- **Process Management:** PM2
   107	- **AI Integration:** Multiple AI providers (Ollama, Abacus AI, OpenAI, Anthropic, X.AI)
   108	
   109	---
   110	
   111	# Application Features by Tab
   112	
   113	## 1. Dashboard (Home)
   114	
   115	### Overview
   116	Main landing page providing quick access to all system features and current system status.
   117	
   118	### Features
   119	- **System Status** - "Server Online" indicator with operational status
   120	- **Quick Access Cards:**
   121	  - AI Hub - Unified AI management & assistance
   122	  - Sports Guide - Find where to watch sports
   123	  - Remote Control - Control TVs and audio systems
   124	  - System Admin - Logs, backups, sync & tests
   125	
   126	### Navigation
   127	- Direct access to all major subsystems
   128	- System health indicators
   129	- Recent activity display
   130	
   131	### API Endpoints
   132	- N/A (frontend only)
   133	
   134	---
   135	
   136	## 2. Video Matrix / Matrix Control
   137	
   138	### Overview
   139	Comprehensive video routing system for managing HDMI matrix switchers and TV displays.
   140	
   141	### Features
   142	
   143	#### Output Configuration
   144	- **Outputs 1-4 (TV 01-04)**: Full matrix outputs with complete controls
   145	  - Power on/off toggle button (green when on, gray when off)
   146	  - Active/inactive checkbox
   147	  - Label field (TV 01, TV 02, TV 03, TV 04)
   148	  - Resolution dropdown (1080p, 4K, 720p)
   149	  - Audio output field
   150	  - Full Wolfpack integration
   151	
   152	- **Outputs 5-32**: Regular matrix outputs with full controls
   153	
   154	- **Outputs 33-36 (Matrix 1-4)**: Audio routing outputs with special controls
   155	  - Used for Atlas audio processor integration
   156	  - Video input selection affects audio routing
   157	
   158	#### Input Configuration
   159	- Configure 32 video sources
   160	- Custom labeling (e.g., "Cable Box 1", "Apple TV")
   161	- Enable/disable individual inputs
   162	
   163	#### TV Selection System
   164	Granular control over which TVs participate in automated schedules:
   165	- `dailyTurnOn` - Boolean flag for morning schedule participation
   166	- `dailyTurnOff` - Boolean flag for "all off" command participation
   167	- Configured per output in the database
   168	
   169	### API Endpoints
   170	
   171	#### GET/POST `/api/matrix/outputs`
   172	- **GET**: Retrieve all matrix outputs
   173	- **POST**: Update output configuration
   174	- **Body**: `{ outputNumber, label, enabled, dailyTurnOn, dailyTurnOff }`
   175	
   176	#### GET `/api/matrix/outputs-schedule`
   177	Retrieve outputs with schedule participation flags
   178	
   179	#### POST `/api/matrix/route`
   180	Route a source to an output:
   181	```json
   182	{
   183	  "input": 5,
   184	  "output": 33
   185	}
   186	```
   187	
   188	#### POST `/api/matrix/power`
   189	Control output power:
   190	```json
   191	{
   192	  "output": 33,
   193	  "state": "on"  // or "off"
   194	}
   195	```
   196	
   197	#### POST `/api/matrix/video-input-selection`
   198	Route video input to Matrix 1-4 audio outputs (33-36)
   199	
   200	### Database Schema
   201	
   202	#### MatrixOutput
   203	```prisma
   204	model MatrixOutput {
   205	  id              Int      @id @default(autoincrement())
   206	  outputNumber    Int      @unique
   207	  label           String
   208	  enabled         Boolean  @default(true)
   209	  isActive        Boolean  @default(false)
   210	  currentInput    Int?
   211	  audioOutput     Int?
   212	  resolution      String?
   213	  dailyTurnOn     Boolean  @default(true)
   214	  dailyTurnOff    Boolean  @default(true)
   215	  isMatrixOutput  Boolean  @default(true)
   216	  createdAt       DateTime @default(now())
   217	  updatedAt       DateTime @updatedAt
   218	}
   219	```
   220	
   221	#### MatrixInput
   222	```prisma
   223	model MatrixInput {
   224	  id          Int      @id @default(autoincrement())
   225	  inputNumber Int      @unique
   226	  label       String
   227	  enabled     Boolean  @default(true)
   228	  createdAt   DateTime @default(now())
   229	  updatedAt   DateTime @updatedAt
   230	}
   231	```
   232	
   233	### Troubleshooting
   234	
   235	**Matrix Switching Not Working:**
   236	1. Test connection in System Admin
   237	2. Verify output/input configuration
   238	3. Check Wolfpack matrix is powered on
   239	4. Verify network connectivity
   240	5. Test individual commands
   241	
   242	**TV Selection Not Working:**
   243	1. Verify database migration status
   244	2. Check output configuration flags
   245	3. Restart application
   246	
   247	---
   248	
   249	## 3. Atlas / Audio Control
   250	
   251	### Overview
   252	Multi-zone audio control system with Atlas AZMP8 processor integration.
   253	
   254	### Features
   255	
   256	#### Atlas AZMP8 Configuration
   257	- **IP Address:** 192.168.5.101:80
   258	- **Model:** AZMP8 (8 inputs, 8 outputs, 8 zones)
   259	- **Status:** Online and authenticated
   260	
   261	#### Configured Audio System
   262	**7 Inputs:**
   263	- Matrix 1-4 (video input audio)
   264	- Mic 1-2
   265	- Spotify
   266	
   267	**7 Outputs/Zones:**
   268	- Bar
   269	- Bar Sub
   270	- Dining Room
   271	- Party Room West
   272	- Party Room East
   273	- Patio
   274	- Bathroom
   275	
   276	**3 Scenes:** Preset configurations for different scenarios
   277	
   278	#### Dynamic Zone Labels
   279	- Zone labels update automatically based on selected video input
   280	- When video input is selected for Matrix 1-4, zone labels reflect the input name
   281	- Example: Selecting "Cable Box 1" updates zone label from "Matrix 1" to "Cable Box 1"
   282	- Falls back to "Matrix 1-4" when no video input selected
   283	
   284	#### Features
   285	- Real-time zone control
   286	- Volume adjustment per zone
   287	- Input selection per zone
   288	- Scene management
   289	- Configuration upload/download
   290	- Automatic timestamped backups
   291	
   292	### API Endpoints
   293	
   294	#### GET `/api/audio-processor`
   295	Get all configured audio processors
   296	
   297	#### POST `/api/atlas/upload-config`
   298	Upload configuration to Atlas processor
   299	
   300	#### GET `/api/atlas/download-config`
   301	Download current configuration from Atlas processor
   302	
   303	#### POST `/api/atlas/route-matrix-to-zone`
   304	Route audio from matrix output to zone
   305	
   306	#### GET `/api/atlas/ai-analysis`
   307	Get AI-powered analysis of audio system performance
   308	
   309	### Configuration Management
   310	
   311	**Configuration File Location:**
   312	- Primary: `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai000260a7xuiepjl.json`
   313	- Backups: `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai000260a7xuiepjl_backup_*.json`
   314	
   315	**Backup Strategy:**
   316	- Automatic backup created on every upload
   317	- Timestamped filename format
   318	- Manual restore by copying backup to primary config file
   319	
   320	### Database Schema
   321	
   322	```prisma
   323	model AudioProcessor {
   324	  id          String   @id @default(cuid())
   325	  name        String
   326	  model       String
   327	  ipAddress   String
   328	  port        Int      @default(80)
   329	  username    String?
   330	  password    String?
   331	  isActive    Boolean  @default(true)
   332	  createdAt   DateTime @default(now())
   333	  updatedAt   DateTime @updatedAt
   334	}
   335	```
   336	
   337	### Troubleshooting
   338	
   339	**Atlas Shows Offline:**
   340	1. Check network connectivity: `ping 192.168.5.101`
   341	2. Verify configuration file exists
   342	3. Check processor is powered on
   343	4. Restore from backup if needed
   344	
   345	**Configuration Not Loading:**
   346	1. Validate JSON configuration file
   347	2. Check file permissions
   348	3. Restore from most recent backup
   349	
   350	---
   351	
   352	## 4. AI Hub
   353	
   354	### Overview
   355	Unified AI management system providing intelligent assistance, codebase analysis, device insights, and AI configuration.
   356	
   357	### Current Status
   358	**Testing Date:** October 15, 2025  
   359	**Overall Status:** ⚠️ **PARTIALLY FUNCTIONAL**  
   360	**Critical Issues:** 2  
   361	**Features Tested:** 7  
   362	**Working Features:** 5  
   363	**Broken Features:** 2
   364	
   365	### Features & Status
   366	
   367	#### ✅ AI Assistant Tab (Partially Working)
   368	
   369	**Status:** Chat interface works, Codebase sync fails
   370	
   371	**Chat Interface:**
   372	- ✅ **Status:** WORKING
   373	- ⚠️ **Performance Issue:** Response time is slow (15+ seconds)
   374	- **Functionality:** Successfully answers questions about the codebase
   375	- **Features:**
   376	  - Natural language queries
   377	  - Codebase context awareness
   378	  - Troubleshooting assistance
   379	  - Code explanations
   380	
   381	**Sync Codebase:**
   382	- ❌ **Status:** FAILING
   383	- 🔴 **Error:** `GET http://24.123.87.42:3000/api/ai-assistant/index-codebase 404 (Internal Server Error)`
   384	- **Impact:** Cannot index codebase for AI analysis
   385	- **Priority:** CRITICAL - Fix immediately
   386	
   387	#### ✅ Teach AI Tab (UI Works, Backend Fails)
   388	
   389	**Upload Documents:**
   390	- ✅ **UI Status:** WORKING
   391	- **Supported Formats:** PDF, Markdown (.md), Text (.txt)
   392	- **Features:**
   393	  - Drag and drop file upload
   394	  - Multiple file support
   395	  - File type validation
   396	- ⚠️ **Note:** Upload errors observed, needs further testing
   397	
   398	**Q&A Training:**
   399	- ❌ **Status:** FAILING
   400	- 🔴 **Error:** `Database error: Failed to create Q&A entry`
   401	- **Console Error:** `500 (Internal Server Error)` for `api/qa-entries.ts`
   402	- **Impact:** Users cannot add Q&A training pairs
   403	- **Priority:** CRITICAL - Fix immediately
   404	- **Features (Non-functional):**
   405	  - Category selection (General, Technical, Troubleshooting, etc.)
   406	  - Question/Answer input fields
   407	  - Entry management
   408	  - Generate from Repository
   409	  - Generate from Docs
   410	  - Upload Q&A File
   411	
   412	**Test AI:**
   413	- ✅ **UI Status:** WORKING
   414	- **Features:**
   415	  - Test question input
   416	  - AI response testing
   417	  - Testing tips and guidance
   418	- ⚠️ **Note:** Cannot fully test without training data
   419	
   420	**Statistics Display:**
   421	- Documents: 0
   422	- Q&A Pairs: 0
   423	- Total Content: 0 Bytes
   424	- Last Updated: 10/15/2025, 1:00:06 AM
   425	
   426	#### ✅ Enhanced Devices Tab (Working)
   427	
   428	**Status:** ✅ FULLY FUNCTIONAL
   429	
   430	**Features:**
   431	- Device AI Assistant for intelligent insights
   432	- Filter options:
   433	  - All Devices dropdown
   434	  - Time range filter (Last 24 Hours)
   435	  - Refresh button
   436	- **Tabs:**
   437	  - Smart Insights
   438	  - Performance
   439	  - Recommendations
   440	  - Predictions
   441	- **Current State:** "No AI insights available for the selected criteria"
   442	
   443	#### ✅ Configuration Tab (Working)
   444	
   445	**Status:** ✅ FULLY FUNCTIONAL
   446	
   447	**Provider Statistics:**
   448	- 1 Active Local Service
   449	- 3 Cloud APIs Ready
   450	- 5 Inactive Local Services
   451	
   452	**Local AI Services:**
   453	- ✅ **Ollama** (http://localhost:11434/api/tags, Model: phi3:mini) - **Active** (4ms)
   454	- ❌ Custom Local AI (http://localhost:8000/v1/models) - Error
   455	- ❌ LocalAI (http://localhost:8080/v1/models) - Error
   456	- ❌ LM Studio (http://localhost:1234/v1/models) - Error
   457	- ❌ Text Generation WebUI (http://localhost:5000/v1/models) - Error
   458	- ❌ Tabby (http://localhost:8080/v1/models) - Error
   459	
   460	**Cloud AI Services:**
   461	- ✅ **OpenAI** - Ready (API key configured)
   462	- ✅ **Anthropic Claude** - Ready (API key configured)
   463	- ✅ **X.AI Grok** - Ready (API key configured)
   464	- ⚠️ **Abacus AI** - Not Configured (No API key)
   465	
   466	**Features:**
   467	- AI System Diagnostics (expandable)
   468	- Provider status monitoring
   469	- Refresh status button
   470	- Local AI setup guide
   471	
   472	#### ✅ API Keys Tab (Working)
   473	
   474	**Status:** ✅ FULLY FUNCTIONAL
   475	
   476	**Features:**
   477	- API key management interface
   478	- Configured API Keys display (currently 0)
   479	- Add API Key button
   480	- Provider documentation links:
   481	  - Ollama (Local) - RECOMMENDED
   482	  - Abacus AI
   483	  - OpenAI
   484	  - LocalAI
   485	  - Custom Local AI
   486	- Local AI Services Status:
   487	  - Port 8000: Active (Custom service detected)
   488	  - Port 11434: Check if Ollama is running
   489	  - Port 8080: Check if LocalAI is running
   490	
   491	**AI Assistant Features Listed:**
   492	- Equipment Troubleshooting
   493	- System Analysis
   494	- Configuration Assistance
   495	- Sports Guide Intelligence
   496	- Operational Insights
   497	- Proactive Monitoring
   498	
   499	### Database Schema
   500	
   501	```prisma
   502	model IndexedFile {
   503	  id            String   @id @default(cuid())
   504	  filePath      String   @unique
   505	  fileName      String
   506	  fileType      String
   507	  content       String   @db.Text
   508	  fileSize      Int
   509	  lastModified  DateTime
   510	  lastIndexed   DateTime @default(now())
   511	  hash          String
   512	  isActive      Boolean  @default(true)
   513	  createdAt     DateTime @default(now())
   514	  updatedAt     DateTime @updatedAt
   515	}
   516	
   517	model QAPair {
   518	  id          String   @id @default(cuid())
   519	  question    String   @db.Text
   520	  answer      String   @db.Text
   521	  context     String?  @db.Text
   522	  source      String?
   523	  category    String?
   524	  isActive    Boolean  @default(true)
   525	  createdAt   DateTime @default(now())
   526	  updatedAt   DateTime @updatedAt
   527	}
   528	
   529	model TrainingDocument {
   530	  id          String   @id @default(cuid())
   531	  title       String
   532	  content     String   @db.Text
   533	  fileType    String
   534	  fileSize    Int
   535	  category    String?
   536	  isActive    Boolean  @default(true)
   537	  createdAt   DateTime @default(now())
   538	  updatedAt   DateTime @updatedAt
   539	}
   540	
   541	model ApiKey {
   542	  id          String   @id @default(cuid())
   543	  provider    String
   544	  keyName     String
   545	  apiKey      String
   546	  isActive    Boolean  @default(true)
   547	  createdAt   DateTime @default(now())
   548	  updatedAt   DateTime @updatedAt
   549	  
   550	  @@unique([provider, keyName])
   551	}
   552	```
   553	
   554	### API Endpoints
   555	
   556	#### POST `/api/ai-assistant/index-codebase`
   557	❌ **Status:** BROKEN (404 error)  
   558	Index codebase files for AI analysis
   559	
   560	#### POST `/api/ai-assistant/chat`
   561	✅ **Status:** WORKING (slow)  
   562	Chat with AI about codebase
   563	
   564	#### POST `/api/ai/qa-generate`
   565	Generate Q&A pairs from repository
   566	
   567	#### POST `/api/ai/qa-entries`
   568	❌ **Status:** BROKEN (500 error)  
   569	Create Q&A training entries
   570	
   571	#### GET/POST `/api/api-keys`
   572	✅ **Status:** WORKING  
   573	Manage AI provider API keys
   574	
   575	#### POST `/api/devices/ai-analysis`
   576	Get AI insights for devices
   577	
   578	### Critical Issues & Fix Plan
   579	
   580	#### 🔴 CRITICAL #1: Q&A Training Database Error
   581	
   582	**Error:** `Database error: Failed to create Q&A entry`  
   583	**API:** `POST /api/ai/qa-entries` returns 500 error  
   584	**Impact:** Users cannot add Q&A training pairs
   585	
   586	**Fix Steps:**
   587	1. Check database schema for `QAPair` table
   588	2. Verify Prisma migrations are up to date
   589	3. Review API route handler (`src/app/api/ai/qa-entries/route.ts`)
   590	4. Check database connection and write permissions
   591	5. Add proper error logging
   592	6. Test with various Q&A entry formats
   593	
   594	**Priority:** Fix immediately before production use
   595	
   596	#### 🔴 CRITICAL #2: Codebase Indexing 404 Error
   597	
   598	**Error:** `GET http://24.123.87.42:3000/api/ai-assistant/index-codebase 404`  
   599	**Impact:** Cannot index codebase for AI assistance
   600	
   601	**Fix Steps:**
   602	1. Verify API route exists in correct location
   603	2. Check route file naming (should be `route.ts` in app router)
   604	3. Ensure proper HTTP method handling (GET/POST)
   605	4. Implement codebase indexing logic if missing
   606	5. Test with actual project directory
   607	6. Add proper error responses
   608	
   609	**Priority:** Fix immediately for full AI Hub functionality
   610	
   611	#### 🟡 HIGH PRIORITY: Chat Performance
   612	
   613	**Issue:** 15+ second response time  
   614	**Impact:** Poor user experience
   615	
   616	**Optimization Steps:**
   617	1. Profile AI model response time
   618	2. Implement streaming responses
   619	3. Add response caching for common questions
   620	4. Consider faster AI model for simple queries
   621	5. Optimize context window size
   622	6. Add better loading indicators
   623	
   624	#### 🟠 MEDIUM PRIORITY: Local AI Services
   625	
   626	**Issue:** 5 local AI services showing error status
   627	
   628	**Services to Fix:**
   629	- Custom Local AI (port 8000)
   630	- LocalAI (port 8080)
   631	- LM Studio (port 1234)
   632	- Text Generation WebUI (port 5000)
   633	- Tabby (port 8080 - port conflict?)
   634	
   635	**Fix Steps:**
   636	1. Verify each service is installed
   637	2. Check if services are running
   638	3. Update service URLs in configuration
   639	4. Add health check with retry logic
   640	5. Document installation instructions
   641	6. Consider making local services optional
   642	
   643	### Recommendations
   644	
   645	**Immediate Actions:**
   646	1. Fix Q&A Training database error (CRITICAL)
   647	2. Fix Codebase Indexing 404 error (CRITICAL)
   648	3. Test document upload feature thoroughly
   649	4. Add proper error messages and user feedback
   650	
   651	**Short-term Improvements:**
   652	1. Optimize chat response performance
   653	2. Implement streaming responses
   654	3. Add progress indicators
   655	4. Configure local AI services
   656	
   657	**Long-term Enhancements:**
   658	1. Add training data export/import
   659	2. Implement batch Q&A generation
   660	3. Add training quality metrics
   661	4. Enhanced device insights with more data
   662	
   663	### Testing Report
   664	📄 **Detailed Testing Report:** `/home/ubuntu/ai_hub_testing_report.md`
   665	
   666	---
   667	
   668	## 5. Sports Guide
   669	
   670	### Overview
   671	Integration with The Rail Media API for sports programming information.
   672	
   673	### Features
   674	- Sports channel guide
   675	- Programming schedules
   676	- Event information
   677	- API key management with validation
   678	
   679	### API Configuration
   680	
   681	**Provider:** The Rail Media  
   682	**API Endpoint:** https://guide.thedailyrail.com/api/v1  
   683	**Current User ID:** 258351
   684	
   685	### API Endpoints
   686	
   687	#### GET `/api/sports-guide/status`
   688	Get current API configuration status
   689	
   690	#### POST `/api/sports-guide/verify-key`
   691	Verify API key validity
   692	
   693	#### POST `/api/sports-guide/update-key`
   694	Update API key (with validation)
   695	
   696	#### GET `/api/sports-guide/channels`
   697	Fetch channel guide data with filtering options
   698	
   699	### Configuration
   700	
   701	1. Navigate to Sports Guide Configuration
   702	2. Click "API" tab
   703	3. Enter User ID and API Key
   704	4. Click "Verify API Key" to test
   705	5. System validates before saving
   706	6. Restart server for full effect
   707	
   708	### Security
   709	- API keys stored in `.env` file (not in repository)
   710	- Keys masked in UI (shows first 8 and last 4 characters only)
   711	- Validation before saving
   712	- Server-side API calls only
   713	
   714	---
   715	
   716	## 6. Streaming Platforms
   717	
   718	### Overview
   719	Management interface for streaming service accounts and configurations.
   720	
   721	### Features
   722	- Platform account management
   723	- Service configuration
   724	- Integration settings
   725	
   726	---
   727	
   728	## 7. Remote Control
   729	
   730	### Overview
   731	Bartender Remote interface for quick TV and audio control.
   732	
   733	### Features
   734	- Quick TV source selection
   735	- Matrix status display
   736	- Bar layout visualization
   737	- Input source shortcuts
   738	
   739	---
   740	
   741	## 8. System Admin
   742	
   743	### Overview
   744	Administrative tools for system management, testing, and maintenance.
   745	
   746	### Features
   747	
   748	#### Wolfpack Configuration
   749	- Matrix IP address setup
   750	- Connection testing
   751	- Switching tests
   752	
   753	#### Matrix Inputs/Outputs
   754	- Input/output labeling
   755	- Enable/disable configuration
   756	- Schedule participation settings
   757	
   758	#### System Logs
   759	- Application logs
   760	- Error tracking
   761	- Activity monitoring
   762	
   763	#### Backup Management
   764	- Manual backup creation
   765	- Backup restoration
   766	- Automated backup status
   767	
   768	#### TODO Management
   769	- Task tracking
   770	- Priority management
   771	- Status updates
   772	
   773	### Wolfpack Integration
   774	
   775	#### POST `/api/wolfpack/test-connection`
   776	Test connectivity to Wolfpack matrix:
   777	```json
   778	{
   779	  "ipAddress": "192.168.1.100"
   780	}
   781	```
   782	
   783	#### POST `/api/wolfpack/test-switching`
   784	Test matrix switching functionality
   785	
   786	#### Database Schema
   787	
   788	```prisma
   789	model WolfpackConfig {
   790	  id         Int      @id @default(autoincrement())
   791	  ipAddress  String   @unique
   792	  name       String?
   793	  createdAt  DateTime @default(now())
   794	  updatedAt  DateTime @updatedAt
   795	}
   796	```
   797	
   798	### TODO Management
   799	
   800	The TODO management system provides task tracking and project management capabilities. The system automatically maintains a `TODO_LIST.md` file that reflects the current state of all tasks in the database.
   801	
   802	#### ⚠️ Important: TODO_LIST.md is Auto-Generated
   803	
   804	**DO NOT EDIT TODO_LIST.md MANUALLY**
   805	
   806	The `TODO_LIST.md` file is automatically generated and updated by the TODO management system. Any manual changes will be overwritten when the system syncs. Always use the TODO API to add, update, or delete tasks.
   807	
   808	The auto-generation happens:
   809	- When a TODO is created via the API
   810	- When a TODO is updated via the API
   811	- When a TODO is deleted via the API
   812	- During periodic system syncs
   813	
   814	#### Database Schema
   815	
   816	```prisma
   817	model Todo {
   818	  id              String        @id @default(cuid())
   819	  title           String
   820	  description     String?
   821	  priority        String        @default("MEDIUM") // "LOW", "MEDIUM", "HIGH", "CRITICAL"
   822	  status          String        @default("PLANNED") // "PLANNED", "IN_PROGRESS", "TESTING", "COMPLETE"
   823	  category        String?
   824	  tags            String?       // JSON array of tags
   825	  createdAt       DateTime      @default(now())
   826	  updatedAt       DateTime      @updatedAt
   827	  completedAt     DateTime?
   828	  
   829	  documents       TodoDocument[]
   830	}
   831	
   832	model TodoDocument {
   833	  id              String   @id @default(cuid())
   834	  todoId          String
   835	  filename        String
   836	  filepath        String
   837	  filesize        Int?
   838	  mimetype        String?
   839	  uploadedAt      DateTime @default(now())
   840	  
   841	  todo            Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
   842	  
   843	  @@index([todoId])
   844	}
   845	```
   846	
   847	#### API Endpoints
   848	
   849	##### GET `/api/todos` - List all TODOs
   850	
   851	Retrieve all TODOs with optional filtering.
   852	
   853	**Query Parameters:**
   854	- `status` (optional) - Filter by status: `PLANNED`, `IN_PROGRESS`, `TESTING`, `COMPLETE`
   855	- `priority` (optional) - Filter by priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
   856	- `category` (optional) - Filter by category string
   857	
   858	**Response:**
   859	```json
   860	{
   861	  "success": true,
   862	  "data": [
   863	    {
   864	      "id": "cmgki7fkg0001vsfg6ghz142f",
   865	      "title": "Fix critical bug",
   866	      "description": "Detailed description...",
   867	      "priority": "CRITICAL",
   868	      "status": "PLANNED",
   869	      "category": "Bug Fix",
   870	      "tags": "[\"ai-hub\", \"database\"]",
   871	      "createdAt": "2025-10-10T07:07:10.000Z",
   872	      "updatedAt": "2025-10-10T07:07:10.000Z",
   873	      "completedAt": null,
   874	      "documents": []
   875	    }
   876	  ]
   877	}
   878	```
   879	
   880	**Example cURL:**
   881	```bash
   882	# Get all TODOs
   883	curl http://localhost:3000/api/todos
   884	
   885	# Get only high priority TODOs
   886	curl http://localhost:3000/api/todos?priority=HIGH
   887	
   888	# Get in-progress tasks
   889	curl http://localhost:3000/api/todos?status=IN_PROGRESS
   890	```
   891	
   892	##### POST `/api/todos` - Create new TODO
   893	
   894	Add a new TODO item to the system. The TODO_LIST.md file will be automatically updated.
   895	
   896	**Request Body:**
   897	```json
   898	{
   899	  "title": "Task title (required)",
   900	  "description": "Detailed task description (optional)",
   901	  "priority": "MEDIUM",
   902	  "status": "PLANNED",
   903	  "category": "Category name (optional)",
   904	  "tags": ["tag1", "tag2"]
   905	}
   906	```
   907	
   908	**Priority Levels:**
   909	- `LOW` - Minor tasks, nice-to-have features
   910	- `MEDIUM` - Standard priority (default)
   911	- `HIGH` - Important tasks requiring attention
   912	- `CRITICAL` - Urgent tasks blocking functionality
   913	
   914	**Status Values:**
   915	- `PLANNED` - Task is planned but not started (default)
   916	- `IN_PROGRESS` - Currently being worked on
   917	- `TESTING` - Implementation complete, being tested
   918	- `COMPLETE` - Task finished and verified
   919	
   920	**Response:**
   921	```json
   922	{
   923	  "success": true,
   924	  "data": {
   925	    "id": "cmgki7fkg0001vsfg6ghz142f",
   926	    "title": "Task title",
   927	    "description": "Detailed task description",
   928	    "priority": "MEDIUM",
   929	    "status": "PLANNED",
   930	    "category": "Category name",
   931	    "tags": "[\"tag1\", \"tag2\"]",
   932	    "createdAt": "2025-10-15T03:00:00.000Z",
   933	    "updatedAt": "2025-10-15T03:00:00.000Z",
   934	    "completedAt": null,
   935	    "documents": []
   936	  }
   937	}
   938	```
   939	
   940	**Example API Calls with Different Priority Levels:**
   941	
   942	**1. Create a LOW priority task:**
   943	```bash
   944	curl -X POST http://localhost:3000/api/todos \
   945	  -H "Content-Type: application/json" \
   946	  -d '{
   947	    "title": "Update documentation styling",
   948	    "description": "Improve markdown formatting in README files",
   949	    "priority": "LOW",
   950	    "status": "PLANNED",
   951	    "category": "Enhancement",
   952	    "tags": ["documentation", "style"]
   953	  }'
   954	```
   955	
   956	**2. Create a MEDIUM priority task (default):**
   957	```bash
   958	curl -X POST http://localhost:3000/api/todos \
   959	  -H "Content-Type: application/json" \
   960	  -d '{
   961	    "title": "Add unit tests for TODO API",
   962	    "description": "Create comprehensive test suite for TODO endpoints",
   963	    "priority": "MEDIUM",
   964	    "category": "Testing & QA",
   965	    "tags": ["testing", "api"]
   966	  }'
   967	```
   968	
   969	**3. Create a HIGH priority task:**
   970	```bash
   971	curl -X POST http://localhost:3000/api/todos \
   972	  -H "Content-Type: application/json" \
   973	  -d '{
   974	    "title": "Optimize database queries",
   975	    "description": "Profile and optimize slow database queries affecting performance",
   976	    "priority": "HIGH",
   977	    "status": "PLANNED",
   978	    "category": "Performance",
   979	    "tags": ["database", "optimization", "high-priority"]
   980	  }'
   981	```
   982	
   983	**4. Create a CRITICAL priority task:**
   984	```bash
   985	curl -X POST http://localhost:3000/api/todos \
   986	  -H "Content-Type: application/json" \
   987	  -d '{
   988	    "title": "CRITICAL: Fix authentication bypass vulnerability",
   989	    "description": "Security vulnerability discovered in authentication flow allowing unauthorized access",
   990	    "priority": "CRITICAL",
   991	    "status": "IN_PROGRESS",
   992	    "category": "Security",
   993	    "tags": ["security", "critical", "urgent", "blocking"]
   994	  }'
   995	```
   996	
   997	**JavaScript/TypeScript Example:**
   998	```typescript
   999	// Using fetch API
  1000	async function createTodo(todoData: {
  1001	  title: string;
  1002	  description?: string;
  1003	  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  1004	  status?: 'PLANNED' | 'IN_PROGRESS' | 'TESTING' | 'COMPLETE';
  1005	  category?: string;
  1006	  tags?: string[];
  1007	}) {
  1008	  const response = await fetch('/api/todos', {
  1009	    method: 'POST',
  1010	    headers: {
  1011	      'Content-Type': 'application/json',
  1012	    },
  1013	    body: JSON.stringify(todoData),
  1014	  });
  1015	
  1016	  const result = await response.json();
  1017	  return result;
  1018	}
  1019	
  1020	// Example usage
  1021	const newTodo = await createTodo({
  1022	  title: 'Implement feature X',
  1023	  description: 'Add new feature to the system',
  1024	  priority: 'HIGH',
  1025	  category: 'Feature',
  1026	  tags: ['frontend', 'ui']
  1027	});
  1028	```
  1029	
  1030	##### PUT `/api/todos/[id]` - Update TODO
  1031	
  1032	Update an existing TODO item.
  1033	
  1034	**Request Body:** Same as POST (all fields optional except those you want to update)
  1035	
  1036	**Example cURL:**
  1037	```bash
  1038	curl -X PUT http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f \
  1039	  -H "Content-Type: application/json" \
  1040	  -d '{
  1041	    "status": "IN_PROGRESS",
  1042	    "priority": "HIGH"
  1043	  }'
  1044	```
  1045	
  1046	##### DELETE `/api/todos/[id]` - Delete TODO
  1047	
  1048	Remove a TODO item from the system.
  1049	
  1050	**Example cURL:**
  1051	```bash
  1052	curl -X DELETE http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f
  1053	```
  1054	
  1055	##### POST `/api/todos/[id]/complete` - Mark TODO as complete
  1056	
  1057	Mark a TODO as complete and set the completion timestamp.
  1058	
  1059	**Example cURL:**
  1060	```bash
  1061	curl -X POST http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f/complete
  1062	```
  1063	
  1064	#### Authentication & Authorization
  1065	
  1066	**Current Status:** No authentication required
  1067	
  1068	The TODO API currently does not require authentication or authorization. All endpoints are publicly accessible on the local network. This is suitable for internal use within a trusted network environment.
  1069	
  1070	**Security Considerations:**
  1071	- API is accessible to anyone on the same network
  1072	- Suitable for internal sports bar management systems
  1073	- For production internet-facing deployments, consider adding:
  1074	  - JWT-based authentication
  1075	  - Role-based access control (RBAC)
  1076	  - API rate limiting
  1077	  - IP whitelisting
  1078	
  1079	#### GitHub Synchronization
  1080	
  1081	The TODO system automatically synchronizes with GitHub:
  1082	- When a TODO is created, updated, or deleted, the `TODO_LIST.md` file is automatically regenerated
  1083	- Changes are committed to the repository with descriptive commit messages
  1084	- Synchronization happens in the background without blocking API responses
  1085	- If GitHub sync fails, the operation still succeeds locally (sync errors are logged)
  1086	
  1087	**Sync Commit Messages:**
  1088	- Create: `chore: Add TODO - [Task Title]`
  1089	- Update: `chore: Update TODO - [Task Title]`
  1090	- Delete: `chore: Remove TODO - [Task Title]`
  1091	
  1092	#### Best Practices
  1093	
  1094	1. **Always use the API** - Never edit TODO_LIST.md directly
  1095	2. **Use descriptive titles** - Make tasks easy to understand at a glance
  1096	3. **Add detailed descriptions** - Include steps, affected components, and expected outcomes
  1097	4. **Tag appropriately** - Use consistent tags for filtering and organization
  1098	5. **Set correct priority** - Use CRITICAL sparingly for true blocking issues
  1099	6. **Update status regularly** - Keep task status current as work progresses
  1100	7. **Complete tasks** - Use the complete endpoint to properly timestamp completion
  1101	
  1102	---
  1103	
  1104	## Backup & Maintenance
  1105	
  1106	### Automated Daily Backup
  1107	
  1108	**Schedule:** Daily at 3:00 AM (server time)  
  1109	**Script:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/backup_script.js`  
  1110	**Backup Directory:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/backups/`  
  1111	**Retention:** 14 days
  1112	
  1113	**Cron Job:**
  1114	```bash
  1115	0 3 * * * cd /home/ubuntu/github_repos/Sports-Bar-TV-Controller && /usr/bin/node backup_script.js >> backup.log 2>&1
  1116	```
  1117	
  1118	**What Gets Backed Up:**
  1119	1. Matrix configuration (JSON format)
  1120	2. Database files (`prisma/data/sports_bar.db`)
  1121	3. Atlas configurations
  1122	
  1123	**Backup File Format:** `backup_YYYY-MM-DD_HH-MM-SS.json`
  1124	
  1125	### Manual Backup
  1126	
  1127	**Database:**
  1128	```bash
  1129	pg_dump sports_bar_tv > backup_$(date +%Y%m%d_%H%M%S).sql
  1130	```
  1131	
  1132	**Application:**
  1133	```bash
  1134	tar -czf sports-bar-backup-$(date +%Y%m%d).tar.gz ~/github_repos/Sports-Bar-TV-Controller
  1135	```
  1136	
  1137	### Restore from Backup
  1138	
  1139	**Database:**
  1140	```bash
  1141	psql sports_bar_tv < backup_20251015_020000.sql
  1142	```
  1143	
  1144	**Atlas Configuration:**
  1145	```bash
  1146	cd ~/github_repos/Sports-Bar-TV-Controller/data/atlas-configs
  1147	cp cmgjxa5ai000260a7xuiepjl_backup_TIMESTAMP.json cmgjxa5ai000260a7xuiepjl.json
  1148	```
  1149	
  1150	---
  1151	
  1152	## Troubleshooting
  1153	
  1154	### Application Issues
  1155	
  1156	**Application Won't Start:**
  1157	```bash
  1158	# Check PM2 status
  1159	pm2 status
  1160	
  1161	# View logs
  1162	pm2 logs sports-bar-tv-controller
  1163	
  1164	# Restart application
  1165	pm2 restart sports-bar-tv-controller
  1166	```
  1167	
  1168	**Database Connection Errors:**
  1169	```bash
  1170	# Check database status
  1171	npx prisma db pull
  1172	
  1173	# Run pending migrations
  1174	npx prisma migrate deploy
  1175	
  1176	# Regenerate Prisma client
  1177	npx prisma generate
  1178	```
  1179	
  1180	### Network Issues
  1181	
  1182	**Wolfpack Matrix Not Responding:**
  1183	1. Check network connectivity: `ping <wolfpack-ip>`
  1184	2. Verify matrix is powered on
  1185	3. Check network cable connections
  1186	4. Confirm same network/VLAN
  1187	5. Test connection in System Admin
  1188	
  1189	**Atlas Processor Offline:**
  1190	1. Check connectivity: `ping 192.168.5.101`
  1191	2. Verify processor is powered on
  1192	3. Check configuration file exists
  1193	4. Restore from backup if needed
  1194	
  1195	### Performance Issues
  1196	
  1197	**Slow Response Times:**
  1198	1. Check PM2 resource usage: `pm2 monit`
  1199	2. Review application logs
  1200	3. Check database size and optimize
  1201	4. Restart application if needed
  1202	
  1203	**High Memory Usage:**
  1204	1. Check PM2 status: `pm2 status`
  1205	2. Restart application: `pm2 restart sports-bar-tv-controller`
  1206	3. Monitor logs for memory leaks
  1207	
  1208	---
  1209	
  1210	## Security Best Practices
  1211	
  1212	### Network Security
  1213	- Wolfpack matrix on isolated VLAN
  1214	- Application behind firewall
  1215	- Use HTTPS in production (configure reverse proxy)
  1216	
  1217	### Authentication
  1218	- Strong passwords for all accounts
  1219	- Regular password rotation
  1220	- Secure storage of credentials
  1221	
  1222	### API Security
  1223	- API keys in `.env` file only
  1224	- Never commit `.env` to repository
  1225	- Masked display in UI
  1226	- Server-side validation
  1227	
  1228	### Database Security
  1229	- Strong database passwords
  1230	- Restrict access to localhost
  1231	- Regular security updates
  1232	- Encrypted backups
  1233	
  1234	---
  1235	
  1236	## Recent Changes

### October 15, 2025 - PR #193: Unified Prisma Client & AI Hub Fixes (MERGED TO MAIN)
**Status:** ✅ Successfully merged, tested, and deployed

#### Changes Implemented
1. **Prisma Client Singleton Pattern**
   - ✅ Unified all Prisma client imports across 9 API route files to use singleton from `@/lib/db`
   - ✅ Prevents multiple Prisma client instances and potential memory leaks
   - ✅ Improves database connection management
   - ✅ Standardizes database access patterns throughout the application

2. **AI Hub Database Models**
   - ✅ Added `IndexedFile` model for tracking indexed codebase files
   - ✅ Added `QAEntry` model (renamed from QAPair) for Q&A training data
   - ✅ Added `TrainingDocument` model for AI Hub training documents
   - ✅ Added `ApiKey` model for managing AI provider API keys
   - ✅ Successfully migrated database with new schema

3. **Logging Enhancements**
   - ✅ Added comprehensive verbose logging to AI system components:
     - Codebase indexing process with file counts and progress
     - Vector embeddings generation and storage
     - Q&A entry creation with detailed field logging
     - Q&A entry retrieval with query debugging
     - Database operations with success/failure tracking

4. **Bug Fixes**
   - ✅ Fixed Q&A entries GET handler that was incorrectly processing requests as POST
   - ✅ Corrected async/await patterns in Q&A API routes
   - ✅ Improved error handling with detailed error messages

#### Testing Results (Remote Server: 24.123.87.42:3000)
All features successfully tested on production server:
- ✅ **Codebase Indexing:** 720 files successfully indexed
- ✅ **Q&A Entry Creation:** Successfully created test entries with proper field mapping
- ✅ **Q&A Entry Retrieval:** GET requests now working correctly, returns all entries
- ✅ **Verbose Logging:** Confirmed in PM2 logs with detailed debugging information
- ✅ **Database Integrity:** All migrations applied successfully, schema validated

#### Files Modified in PR #193
- `src/app/api/ai-assistant/index-codebase/route.ts` - Added verbose logging & unified Prisma
- `src/app/api/ai-assistant/search-code/route.ts` - Unified Prisma client import
- `src/app/api/ai/qa-entries/route.ts` - Fixed GET handler bug & added logging
- `src/app/api/cec/discovery/route.ts` - Unified Prisma client import
- `src/app/api/home-teams/route.ts` - Unified Prisma client import
- `src/app/api/schedules/[id]/route.ts` - Unified Prisma client import
- `src/app/api/schedules/execute/route.ts` - Unified Prisma client import
- `src/app/api/schedules/logs/route.ts` - Unified Prisma client import
- `src/app/api/schedules/route.ts` - Unified Prisma client import
- `prisma/schema.prisma` - Added new AI Hub models
- All backup files removed for clean codebase

#### Related Pull Requests
- ✅ **PR #193** - Successfully merged to main branch (supersedes PR #169)
- ❌ **PR #169** - Closed due to merge conflicts (superseded by PR #193)

#### Benefits Achieved
- Eliminated Prisma client instance conflicts
- Improved AI Hub reliability and debuggability
- Enhanced production monitoring with verbose logging
- Fixed critical Q&A entry retrieval bug
- Clean, maintainable codebase with consistent patterns

  1237	
  1238	### October 15, 2025 - AI Hub Testing & Documentation Update
  1239	- ✅ Comprehensive AI Hub testing completed
  1240	- ✅ Identified 2 critical errors requiring immediate fixes
  1241	- ✅ Created detailed testing report
  1242	- ✅ Reorganized documentation by site tabs
  1243	- ✅ Updated port from 3001 to 3000
  1244	- ✅ Added detailed AI Hub section with status and fix plans
  1245	
  1246	### October 14, 2025 - AI Hub Database Models
  1247	- ✅ Added missing database models (IndexedFile, QAPair, TrainingDocument, ApiKey)
  1248	- ✅ Fixed AI Hub API routes
  1249	- ✅ Verified basic AI Hub functionality
  1250	
  1251	### October 10, 2025 - Atlas Configuration Restoration
  1252	- ✅ Fixed critical Atlas configuration wipe bug
  1253	- ✅ Restored Atlas configuration from backup
  1254	- ✅ Fixed dynamic zone labels
  1255	- ✅ Implemented matrix label updates
  1256	- ✅ Fixed matrix test database errors
  1257	
  1258	### October 9, 2025 - Outputs Configuration & Backup System
  1259	- ✅ Configured outputs 1-4 as full matrix outputs
  1260	- ✅ Implemented automated daily backup system
  1261	- ✅ Added 14-day retention policy
  1262	
  1263	---
  1264	
  1265	## Support Resources
  1266	
  1267	### Documentation Links
  1268	- Next.js: https://nextjs.org/docs
  1269	- Prisma: https://www.prisma.io/docs
  1270	- Tailwind CSS: https://tailwindcss.com/docs
  1271	
  1272	### Project Resources
  1273	- **GitHub Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
  1274	- **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
  1275	- **AI Hub Testing Report:** `/home/ubuntu/ai_hub_testing_report.md`
  1276	
  1277	### Getting Help
  1278	1. Check this documentation
  1279	2. Review application logs: `pm2 logs sports-bar-tv-controller`
  1280	3. Check GitHub issues
  1281	4. Create new issue with detailed information
  1282	
  1283	---
  1284	
  1285	*Last Updated: October 15, 2025 by DeepAgent*  
  1286	*Version: 2.1*  
  1287	*Status: Production Ready (AI Hub has 2 critical issues requiring fixes)*