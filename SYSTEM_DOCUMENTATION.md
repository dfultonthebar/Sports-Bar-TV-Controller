Here's the result of running `cat -n` on /home/ubuntu/github_repos/Sports-Bar-TV-Controller/SYSTEM_DOCUMENTATION.md:
     1	Here's the result of running `cat -n` on /home/ubuntu/github_repos/tv-controller/SYSTEM_DOCUMENTATION.md:
     2	     1  # Sports Bar TV Controller - System Documentation
     3	     2  
     4	     3  **Version:** 2.3  
     5	     4  **Last Updated:** October 17, 2025  
     6	     5  **Status:** Production Ready
     7	     6  
     8	     7  ---
     9	     8  
    10	     9  # ⚠️ MUST READ DOCUMENTATION - ESSENTIAL REFERENCE MATERIALS
    11	    10  
    12	    11  **CRITICAL:** Before making ANY changes to the system, especially UI/styling changes, you MUST review these essential documentation files located in the `docs/` directory:
    13	    12  
    14	    13  ## Color Scheme & Styling Standards
    15	    14  - **COLOR_SCHEME_STANDARD.md** - Official color palette and usage guidelines
    16	    15  - **COLOR_SCHEME_STANDARD.pdf** - PDF version of color standards
    17	    16  - **COLOR_STANDARDIZATION_SUMMARY.md** - Summary of color standardization implementation
    18	    17  - **COLOR_STANDARDIZATION_SUMMARY.pdf** - PDF version of standardization summary
    19	    18  
    20	    19  ## System Architecture & Performance
    21	    20  - **SUBSCRIPTION_POLLING_IMPLEMENTATION.md** - Subscription polling system details
    22	    21  - **SUBSCRIPTION_POLLING_IMPLEMENTATION.pdf** - PDF version of polling implementation
    23	    22  - **SYSTEM_OPTIMIZATION_SUMMARY.md** - System-wide optimization documentation
    24	    23  
    25	    24  ## SSH Connection & Remote Access
    26	    25  - **SSH_OPTIMIZATION_GUIDE.md** - Comprehensive guide for efficient SSH connections to remote server
    27	    26    - Solves SSH connection hanging issues
    28	    27    - Provides optimized connection methods (heredoc, SSH config, control sockets)
    29	    28    - Essential for automation and reliable remote server operations
    30	    29    - Includes connection multiplexing and performance optimization techniques
    31	    30  
    32	    31  ## Why These Documents Matter
    33	    32  These documents contain:
    34	    33  - **Approved color palettes** that ensure readability and consistency
    35	    34  - **Component styling standards** that prevent UI regressions
    36	    35  - **Performance optimization guidelines** that maintain system efficiency
    37	    36  - **Implementation patterns** that have been tested and validated
    38	    37  
    39	    38  **⚠️ WARNING:** Ignoring these standards can result in:
    40	    39  - Unreadable text and poor contrast (Q&A page issues)
    41	    40  - Broken UI components (Matrix page display issues)
    42	    41  - Reverted changes (Global Cache device page problems)
    43	    42  - Inconsistent user experience across the application
    44	    43  
    45	    44  **📍 Documentation Location:** `/home/ubuntu/Sports-Bar-TV-Controller-local/docs/` (local) or `/root/sports-bar-tv-controller/docs/` (production server)
    46	    45  
    47	    46  ---
    48	    47  
    49	    48  ## Quick Access Information
    50	    49  
    51	    50  ### Server Access
    52	    51  - **Host:** 24.123.87.42
    53	    52  - **SSH Port:** 224
    54	    53  - **RDP Port:** 3389
    55	    54  - **Application Port:** **3000** (HTTP)
    56	    55  - **Username:** ubuntu
    57	    56  - **Password:** 6809233DjD$$$ (THREE dollar signs)
    58	    57  - **Application URL:** http://24.123.87.42:3000
    59	    58  
    60	    59  **SSH Connection:**
    61	    60  ```bash
    62	    61  ssh -p 224 ubuntu@24.123.87.42
    63	    62  ```
    64	    63  
    65	    64  **RDP Connection:**
    66	    65  - **Purpose:** GUI access to Atlas device local network (192.168.5.101)
    67	    66  - **Host:** 24.123.87.42
    68	    67  - **Port:** 3389
    69	    68  - **Username:** ubuntu
    70	    69  - **Password:** 6809233DjD$$$ (THREE dollar signs)
    71	    70  - **Use Case:** Access Atlas device web interface at http://192.168.5.101 through remote desktop
    72	    71  - **Setup:** RDP server configured on remote server for GUI-based Atlas device management
    73	    72  
    74	    73  **RDP Connection Instructions:**
    75	    74  
    76	    75  *Windows:*
    77	    76  ```
    78	    77  1. Open Remote Desktop Connection (mstsc.exe)
    79	    78  2. Computer: 24.123.87.42:3389
    80	    79  3. Username: ubuntu
    81	    80  4. Password: 6809233DjD$$$
    82	    81  5. Connect and access Atlas device at 192.168.5.101 in browser
    83	    82  ```
    84	    83  
    85	    84  *macOS:*
    86	    85  ```
    87	    86  1. Install Microsoft Remote Desktop from App Store
    88	    87  2. Add PC with hostname: 24.123.87.42:3389
    89	    88  3. User account: ubuntu
    90	    89  4. Password: 6809233DjD$$$
    91	    90  5. Connect and access Atlas device at 192.168.5.101 in browser
    92	    91  ```
    93	    92  
    94	    93  *Linux:*
    95	    94  ```bash
    96	    95  # Using Remmina
    97	    96  remmina -c rdp://ubuntu@24.123.87.42:3389
    98	    97  
    99	    98  # Using xfreerdp
   100	    99  xfreerdp /v:24.123.87.42:3389 /u:ubuntu /p:'6809233DjD$$$' /size:1920x1080
   101	   100  ```
   102	   101  
   103	   102  ### GitHub Repository
   104	   103  - **Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
   105	   104  - **Development Project Path:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller`
   106	   105  - **Production Server Path:** `/home/ubuntu/Sports-Bar-TV-Controller`
   107	   106  - **PM2 Process Name:** `sports-bar-tv`
   108	
   109	---
   110	
   111	## 🔴 ACTIVE ISSUES & FIXES
   112	
   113	### Issue #1: Atlas Audio Processor Configuration Error (October 17, 2025)
   114	
   115	**Status:** 🔧 IN PROGRESS - Fix being deployed  
   116	**Priority:** HIGH  
   117	**Component:** Atlas Audio Control Configuration Page
   118	
   119	#### Error Details
   120	- **Error Type:** `TypeError: Cannot read properties of undefined (reading 'length')`
   121	- **Location:** Audio Control Center → Atlas System → Configuration tab
   122	- **File:** `src/components/AtlasProgrammingInterface.tsx` (line 1289)
   123	- **When Occurs:** After configuration is successfully fetched from the Atlas processor API
   124	
   125	#### Console Logs
   126	```
   127	5746-57ad8c46598b4100.js:1 Dynamic Atlas configuration loaded: {processor: 'Graystone ', model: 'AZMP8', matrixInputs: 4, atlasInputs: 8, zones: 8, …}
   128	3523-ae6ef65541545892.js:1 [Atlas Config] Fetching configuration for processor: cmgv9nms5000026tc4g5tn029
   129	3523-ae6ef65541545892.js:1 [Atlas Config] Received configuration: {success: true, inputs: Array(8), outputs: Array(8), scenes: Array(3), messages: Array(0)}
   130	3523-ae6ef65541545892.js:1 [Atlas Config] Configuration loaded successfully
   131	2117-b43323754369e4b9.js:1 TypeError: Cannot read properties of undefined (reading 'length')
   132	```
   133	
   134	#### Root Cause Analysis
   135	The error occurs during the rendering of the Input Configuration section when trying to display routing checkboxes. Specifically:
   136	
   137	1. **API Data Structure Issue:** When configuration is fetched from `/api/atlas/configuration`, the saved JSON may not include the `routing` property for inputs, or it may be `null/undefined`
   138	2. **Missing Data Normalization:** The component doesn't normalize fetched data to ensure all required properties exist
   139	3. **Unsafe Property Access:** At line 1289, the code attempts to access `input.routing.includes(output.id)` without checking if `routing` exists
   140	4. **Method Chain Failure:** The `.includes()` method internally accesses `.length`, causing the error when `routing` is undefined
   141	
   142	**Problem Code:**
   143	```typescript
   144	// Line 1289 in AtlasProgrammingInterface.tsx
   145	checked={input.routing.includes(output.id)}  // ❌ Fails if routing is undefined
   146	```
   147	
   148	#### The Fix Applied
   149	1. **Data Normalization in fetchConfiguration():**
   150	   - Ensure all fetched inputs have a `routing` array property
   151	   - Map over inputs to add `routing: []` if missing
   152	
   153	2. **Defensive Rendering:**
   154	   - Use optional chaining with fallback: `input.routing?.includes(output.id) || false`
   155	   - Prevents error if routing is undefined
   156	
   157	3. **Updated Code:**
   158	```typescript
   159	// Normalize inputs to ensure routing array exists
   160	const normalizedInputs = (config.inputs || generateDefaultInputs()).map((input: InputConfig) => ({
   161	  ...input,
   162	  routing: input.routing || []
   163	}))
   164	setInputs(normalizedInputs)
   165	
   166	// Safe routing check with optional chaining
   167	checked={input.routing?.includes(output.id) || false}
   168	```
   169	
   170	#### Hardware Configuration
   171	- **Atlas Processor:** Graystone AZMP8
   172	- **IP Address:** 192.168.5.101
   173	- **Credentials:** admin/6809233DjD$$$
   174	- **Model:** AZMP8 (8 zones with processing)
   175	- **Inputs:** 8
   176	- **Outputs:** 8
   177	
   178	#### Testing Requirements
   179	- ✅ Verify configuration page loads without errors
   180	- ✅ Verify input routing checkboxes display correctly
   181	- ✅ Verify routing can be modified and saved
   182	- ✅ Verify configuration persists after save/reload
   183	- ✅ Test with actual Atlas processor at 192.168.5.101
   184	- ✅ Verify all tabs (Inputs, Outputs, Scenes, Messages) load correctly
   185	
   186	#### Related Files
   187	- `src/components/AtlasProgrammingInterface.tsx` - Main component with the fix
   188	- `src/app/audio-control/page.tsx` - Parent page that uses the component
   189	- `src/app/api/atlas/configuration/route.ts` - API endpoint for configuration
   190	- `data/atlas-configs/*.json` - Saved configuration files
   191	
   192	#### Fix Timeline
   193	- **Issue Discovered:** October 17, 2025, 10:53 PM
   194	- **Root Cause Identified:** October 17, 2025, 11:25 PM
   195	- **Fix Applied:** October 17, 2025, 11:30 PM
   196	- **Deployment:** In Progress
   197	- **Testing:** Pending
   198	
   199	   107  - **GitHub Token:** Stored securely in server environment (not documented for security)
   200	   108  
   201	   109  ### Quick Deployment to Production
   202	   110  ```bash
   203	   111  # SSH into production server
   204	   112  ssh -p 224 ubuntu@24.123.87.42
   205	   113  
   206	   114  # Navigate to project (PRODUCTION PATH)
   207	   115  cd /home/ubuntu/Sports-Bar-TV-Controller
   208	   116  
   209	   117  # Pull latest changes
   210	   118  git pull origin main
   211	   119  
   212	   120  # Install dependencies
   213	   121  npm install
   214	   122  
   215	   123  # Generate Prisma Client
   216	   124  npx prisma generate
   217	   125  
   218	   126  # Build application
   219	   127  npm run build
   220	   128  
   221	   129  # Restart application (PM2 process name: sports-bar-tv)
   222	   130  pm2 restart sports-bar-tv
   223	   131  
   224	   132  # Check logs
   225	   133  pm2 logs sports-bar-tv
   226	   134  ```
   227	   135  
   228	   136  ---
   229	   137  
   230	   138  ## AI System Access
   231	   139  
   232	   140  **IMPORTANT:** This section contains credentials for AI assistants to access and manage the system autonomously. These credentials are intentionally documented here for future AI access.
   233	   141  
   234	   142  ### System Access Credentials
   235	   143  
   236	   144  - **Web Interface:** http://24.123.87.42:3000/
   237	   145  - **SSH Host:** 24.123.87.42
   238	   146  - **SSH Port:** 224
   239	   147  - **SSH Username:** ubuntu
   240	   148  - **SSH Password:** 6809233DjD$$$ (THREE dollar signs)
   241	   149  - **Project Directory:** /home/ubuntu/Sports-Bar-TV-Controller
   242	   150  - **GitHub Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
   243	   151  
   244	   152  ### Device Information
   245	   153  
   246	   154  - **Fire TV Cube IP Address:** 192.168.5.131
   247	   155    - Used for ADS bridge configuration
   248	   156    - Connected to network for remote control
   249	   157    - Integration with matrix switcher system
   250	   158  
   251	   159  ### SSH Connection Command
   252	   160  
   253	   161  ```bash
   254	   162  ssh -p 224 ubuntu@24.123.87.42
   255	   163  ```
   256	   164  
   257	   165  ### Quick Access for AI Assistants
   258	   166  
   259	   167  1. **Access System:**
   260	   168     ```bash
   261	   169     ssh -p 224 ubuntu@24.123.87.42
   262	   170     # Password: 6809233DjD$$$
   263	   171     ```
   264	   172  
   265	   173  2. **Navigate to Project:**
   266	   174     ```bash
   267	   175     cd /home/ubuntu/Sports-Bar-TV-Controller
   268	   176     ```
   269	   177  
   270	   178  3. **View Application:**
   271	   179     - Open browser to: http://24.123.87.42:3000/
   272	   180  
   273	   181  4. **Manage Services:**
   274	   182     ```bash
   275	   183     # View logs
   276	   184     pm2 logs sports-bar-tv
   277	   185     
   278	   186     # Restart application
   279	   187     pm2 restart sports-bar-tv
   280	   188     
   281	   189     # Check status
   282	   190     pm2 status
   283	   191     ```
   284	   192  
   285	   193  ### Notes for AI Assistants
   286	   194  
   287	   195  - **Password has THREE dollar signs** at the end: 6809233DjD$$$
   288	   196  - System runs on Intel NUC13ANHi5 hardware
   289	   197  - Application managed via PM2 process manager
   290	   198  - Database: PostgreSQL with Prisma ORM
   291	   199  - Web framework: Next.js 14 with TypeScript
   292	   200  - Always pull latest changes before making modifications
   293	   201  - Use PM2 to restart after code updates
   294	   202  
   295	   203  ---
   296	   204  
   297	   205  ## Database & Prisma Setup
   298	   206  
   299	   207  ### Database Configuration
   300	   208  - **Type:** PostgreSQL
   301	   209  - **Connection:** Configured in `.env` file
   302	   210  - **ORM:** Prisma
   303	   211  
   304	   212  ### Prisma Commands
   305	   213  ```bash
   306	   214  # Generate Prisma Client
   307	   215  npx prisma generate
   308	   216  
   309	   217  # Run migrations
   310	   218  npx prisma migrate dev
   311	   219  
   312	   220  # Deploy migrations (production)
   313	   221  npx prisma migrate deploy
   314	   222  
   315	   223  # Open Prisma Studio (database browser)
   316	   224  npx prisma studio
   317	   225  
   318	   226  # Check migration status
   319	   227  npx prisma migrate status
   320	   228  ```
   321	   229  
   322	   230  ### Database Schema Location
   323	   231  - **Schema File:** `prisma/schema.prisma`
   324	   232  - **Migrations:** `prisma/migrations/`
   325	   233  
   326	   234  ### Key Database Models
   327	   235  - `MatrixOutput` - TV display outputs
   328	   236  - `MatrixInput` - Video sources
   329	   237  - `WolfpackConfig` - Matrix switcher configuration
   330	   238  - `AudioProcessor` - Atlas audio configuration
   331	   239  - `IndexedFile` - AI Hub codebase files
   332	   240  - `QAPair` - AI Hub Q&A training data
   333	   241  - `TrainingDocument` - AI Hub training documents
   334	   242  - `ApiKey` - AI provider API keys
   335	   243  - `TODO` - Task management
   336	   244  
   337	   245  ---
   338	   246  
   339	   247  ## System Overview
   340	   248  
   341	   249  The Sports Bar TV Controller is a comprehensive web application designed to manage TV displays, matrix video routing, and sports content scheduling for sports bar environments.
   342	   250  
   343	   251  ### Technology Stack
   344	   252  - **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
   345	   253  - **Backend:** Next.js API Routes, Prisma ORM
   346	   254  - **Database:** PostgreSQL
   347	   255  - **Hardware Integration:** 
   348	   256    - Wolfpack HDMI Matrix Switchers (via HTTP API)
   349	   257    - Atlas AZMP8 Audio Processor (via HTTP API)
   350	   258  - **Process Management:** PM2
   351	   259  - **AI Integration:** Multiple AI providers (Ollama, Abacus AI, OpenAI, Anthropic, X.AI)
   352	   260  
   353	   261  ---
   354	   262  
   355	   263  # Application Features by Tab
   356	   264  
   357	   265  ## 1. Dashboard (Home)
   358	   266  
   359	   267  ### Overview
   360	   268  Main landing page providing quick access to all system features and current system status.
   361	   269  
   362	   270  ### Features
   363	   271  - **System Status** - "Server Online" indicator with operational status
   364	   272  - **Quick Access Cards:**
   365	   273    - AI Hub - Unified AI management & assistance
   366	   274    - Sports Guide - Find where to watch sports
   367	   275    - Remote Control - Control TVs and audio systems
   368	   276    - System Admin - Logs, backups, sync & tests
   369	   277  
   370	   278  ### Navigation
   371	   279  - Direct access to all major subsystems
   372	   280  - System health indicators
   373	   281  - Recent activity display
   374	   282  
   375	   283  ### API Endpoints
   376	   284  - N/A (frontend only)
   377	   285  
   378	   286  ---
   379	   287  
   380	   288  ## 2. Video Matrix / Matrix Control
   381	   289  
   382	   290  ### Overview
   383	   291  Comprehensive video routing system for managing HDMI matrix switchers and TV displays.
   384	   292  
   385	   293  ### Features
   386	   294  
   387	   295  #### Output Configuration
   388	   296  - **Outputs 1-4 (TV 01-04)**: Full matrix outputs with complete controls
   389	   297    - Power on/off toggle button (green when on, gray when off)
   390	   298    - Active/inactive checkbox
   391	   299    - Label field (TV 01, TV 02, TV 03, TV 04)
   392	   300    - Resolution dropdown (1080p, 4K, 720p)
   393	   301    - Audio output field
   394	   302    - Full Wolfpack integration
   395	   303  
   396	   304  - **Outputs 5-32**: Regular matrix outputs with full controls
   397	   305  
   398	   306  - **Outputs 33-36 (Matrix 1-4)**: Audio routing outputs with special controls
   399	   307    - Used for Atlas audio processor integration
   400	   308    - Video input selection affects audio routing
   401	   309  
   402	   310  #### Input Configuration
   403	   311  - Configure 32 video sources
   404	   312  - Custom labeling (e.g., "Cable Box 1", "Apple TV")
   405	   313  - Enable/disable individual inputs
   406	   314  
   407	   315  #### TV Selection System
   408	   316  Granular control over which TVs participate in automated schedules:
   409	   317  - `dailyTurnOn` - Boolean flag for morning schedule participation
   410	   318  - `dailyTurnOff` - Boolean flag for "all off" command participation
   411	   319  - Configured per output in the database
   412	   320  
   413	   321  ### API Endpoints
   414	   322  
   415	   323  #### GET/POST `/api/matrix/outputs`
   416	   324  - **GET**: Retrieve all matrix outputs
   417	   325  - **POST**: Update output configuration
   418	   326  - **Body**: `{ outputNumber, label, enabled, dailyTurnOn, dailyTurnOff }`
   419	   327  
   420	   328  #### GET `/api/matrix/outputs-schedule`
   421	   329  Retrieve outputs with schedule participation flags
   422	   330  
   423	   331  #### POST `/api/matrix/route`
   424	   332  Route a source to an output:
   425	   333  ```json
   426	   334  {
   427	   335    "input": 5,
   428	   336    "output": 33
   429	   337  }
   430	   338  ```
   431	   339  
   432	   340  #### POST `/api/matrix/power`
   433	   341  Control output power:
   434	   342  ```json
   435	   343  {
   436	   344    "output": 33,
   437	   345    "state": "on"  // or "off"
   438	   346  }
   439	   347  ```
   440	   348  
   441	   349  #### POST `/api/matrix/video-input-selection`
   442	   350  Route video input to Matrix 1-4 audio outputs (33-36)
   443	   351  
   444	   352  ### Database Schema
   445	   353  
   446	   354  #### MatrixOutput
   447	   355  ```prisma
   448	   356  model MatrixOutput {
   449	   357    id              Int      @id @default(autoincrement())
   450	   358    outputNumber    Int      @unique
   451	   359    label           String
   452	   360    enabled         Boolean  @default(true)
   453	   361    isActive        Boolean  @default(false)
   454	   362    currentInput    Int?
   455	   363    audioOutput     Int?
   456	   364    resolution      String?
   457	   365    dailyTurnOn     Boolean  @default(true)
   458	   366    dailyTurnOff    Boolean  @default(true)
   459	   367    isMatrixOutput  Boolean  @default(true)
   460	   368    createdAt       DateTime @default(now())
   461	   369    updatedAt       DateTime @updatedAt
   462	   370  }
   463	   371  ```
   464	   372  
   465	   373  #### MatrixInput
   466	   374  ```prisma
   467	   375  model MatrixInput {
   468	   376    id          Int      @id @default(autoincrement())
   469	   377    inputNumber Int      @unique
   470	   378    label       String
   471	   379    enabled     Boolean  @default(true)
   472	   380    createdAt   DateTime @default(now())
   473	   381    updatedAt   DateTime @updatedAt
   474	   382  }
   475	   383  ```
   476	   384  
   477	   385  ### Troubleshooting
   478	   386  
   479	   387  **Matrix Switching Not Working:**
   480	   388  1. Test connection in System Admin
   481	   389  2. Verify output/input configuration
   482	   390  3. Check Wolfpack matrix is powered on
   483	   391  4. Verify network connectivity
   484	   392  5. Test individual commands
   485	   393  
   486	   394  **TV Selection Not Working:**
   487	   395  1. Verify database migration status
   488	   396  2. Check output configuration flags
   489	   397  3. Restart application
   490	   398  
   491	   399  ---
   492	   400  
   493	   401  ## 3. Atlas / Audio Control
   494	   402  
   495	   403  ### Overview
   496	   404  Multi-zone audio control system with Atlas AZMP8 processor integration.
   497	   405  
   498	   406  ### Features
   499	   407  
   500	   408  #### Atlas AZMP8 Configuration
   501	   409  - **IP Address:** 192.168.5.101:80
   502	   410  - **Model:** AZMP8 (8 inputs, 8 outputs, 8 zones)
   503	   411  - **Status:** Online and authenticated
   504	   412  
   505	   413  #### Configured Audio System
   506	   414  **7 Inputs:**
   507	   415  - Matrix 1-4 (video input audio)
   508	   416  - Mic 1-2
   509	   417  - Spotify
   510	   418  
   511	   419  **7 Outputs/Zones:**
   512	   420  - Bar
   513	   421  - Bar Sub
   514	   422  - Dining Room
   515	   423  - Party Room West
   516	   424  - Party Room East
   517	   425  - Patio
   518	   426  - Bathroom
   519	   427  
   520	   428  **3 Scenes:** Preset configurations for different scenarios
   521	   429  
   522	   430  #### Dynamic Zone Labels
   523	   431  - Zone labels update automatically based on selected video input
   524	   432  - When video input is selected for Matrix 1-4, zone labels reflect the input name
   525	   433  - Example: Selecting "Cable Box 1" updates zone label from "Matrix 1" to "Cable Box 1"
   526	   434  - Falls back to "Matrix 1-4" when no video input selected
   527	   435  
   528	   436  #### Features
   529	   437  - Real-time zone control
   530	   438  - Volume adjustment per zone
   531	   439  - Input selection per zone
   532	   440  - Scene management
   533	   441  - Configuration upload/download
   534	   442  - Automatic timestamped backups
   535	   443  
   536	   444  ### API Endpoints
   537	   445  
   538	   446  #### GET `/api/audio-processor`
   539	   447  Get all configured audio processors
   540	   448  
   541	   449  #### POST `/api/atlas/upload-config`
   542	   450  Upload configuration to Atlas processor
   543	   451  
   544	   452  #### GET `/api/atlas/download-config`
   545	   453  Download current configuration from Atlas processor
   546	   454  
   547	   455  #### POST `/api/atlas/route-matrix-to-zone`
   548	   456  Route audio from matrix output to zone
   549	   457  
   550	   458  #### GET `/api/atlas/ai-analysis`
   551	   459  Get AI-powered analysis of audio system performance
   461	
   462	### Atlas TCP Client Implementation
   463	
   464	**Implementation Date:** October 18, 2025  
   465	**Purpose:** Enable actual hardware communication with Atlas processor via TCP/JSON-RPC 2.0
   466	
   467	#### Overview
   468	The Atlas TCP client library implements the JSON-RPC 2.0 protocol for direct communication with AtlasIED Atmosphere audio processors over TCP port 3804. This replaces the previous placeholder implementation that only updated the database without sending actual commands to the hardware.
   469	
   470	#### Technical Details
   471	
   472	**Protocol Specification:**
   473	- **Protocol:** JSON-RPC 2.0 over TCP
   474	- **Port:** 3804 (default, configurable)
   475	- **Message Format:** JSON with `\r\n` terminator
   476	- **Indexing:** 0-based (Zone 1 = ZoneSource_0, Zone 2 = ZoneSource_1, etc.)
   477	- **Connection Type:** Direct TCP socket connection
   478	
   479	**Implementation Files:**
   480	- `src/lib/atlasClient.ts` - Main TCP client library
   481	- `src/app/api/audio-processor/control/route.ts` - Updated control API
   482	- `src/app/api/audio-processor/inputs/route.ts` - Fixed input merging logic
   483	- `src/app/api/audio-processor/outputs/route.ts` - Fixed output merging logic
   484	
   485	#### Atlas TCP Client Library (`src/lib/atlasClient.ts`)
   486	
   487	**Key Features:**
   488	- Automatic connection management
   489	- Command timeout handling (default: 5000ms)
   490	- Response tracking with promise-based API
   491	- Automatic message buffering and parsing
   492	- Connection pooling support
   493	- Error handling and retry logic
   494	
   495	**Core Methods:**
   496	
   497	```typescript
   498	// Connect to Atlas processor
   499	async connect(): Promise<void>
   500	
   501	// Disconnect from Atlas processor
   502	disconnect(): void
   503	
   504	// Set zone source (0-based indexing)
   505	async setZoneSource(zoneIndex: number, sourceIndex: number): Promise<AtlasResponse>
   506	
   507	// Set zone volume (percentage or dB)
   508	async setZoneVolume(zoneIndex: number, gainDb: number, usePct: boolean = true): Promise<AtlasResponse>
   509	
   510	// Set zone mute state
   511	async setZoneMute(zoneIndex: number, muted: boolean): Promise<AtlasResponse>
   512	
   513	// Recall a scene
   514	async recallScene(sceneIndex: number): Promise<AtlasResponse>
   515	
   516	// Play a message
   517	async playMessage(messageIndex: number): Promise<AtlasResponse>
   518	
   519	// Activate/deactivate group (combine zones)
   520	async setGroupActive(groupIndex: number, active: boolean): Promise<AtlasResponse>
   521	
   522	// Subscribe to parameter updates
   523	async subscribe(param: string, format: 'val' | 'pct' | 'str' = 'val'): Promise<AtlasResponse>
   524	
   525	// Get current parameter value
   526	async getParameter(param: string, format: 'val' | 'pct' | 'str' = 'val'): Promise<AtlasResponse>
   527	```
   528	
   529	**Helper Functions:**
   530	
   531	```typescript
   532	// Create and connect to Atlas processor
   533	createAtlasClient(config: AtlasConnectionConfig): Promise<AtlasTCPClient>
   534	
   535	// Execute command with automatic connection management
   536	executeAtlasCommand(
   537	  config: AtlasConnectionConfig,
   538	  commandFn: (client: AtlasTCPClient) => Promise<AtlasResponse>
   539	): Promise<AtlasResponse>
   540	```
   541	
   542	#### JSON-RPC 2.0 Message Examples
   543	
   544	**Set Zone Source:**
   545	```json
   546	{"jsonrpc":"2.0","method":"set","params":{"param":"ZoneSource_0","val":2},"id":1}\r\n
   547	```
   548	
   549	**Set Zone Volume:**
   550	```json
   551	{"jsonrpc":"2.0","method":"set","params":{"param":"ZoneGain_0","pct":50},"id":2}\r\n
   552	```
   553	
   554	**Set Zone Mute:**
   555	```json
   556	{"jsonrpc":"2.0","method":"set","params":{"param":"ZoneMute_0","val":1},"id":3}\r\n
   557	```
   558	
   559	**Subscribe to Updates:**
   560	```json
   561	{"jsonrpc":"2.0","method":"sub","params":{"param":"ZoneGain_0","fmt":"val"},"id":4}\r\n
   562	```
   563	
   564	#### Updated Control API
   565	
   566	The control API (`src/app/api/audio-processor/control/route.ts`) has been updated to:
   567	
   568	1. **Import Atlas TCP client:** `import { executeAtlasCommand } from '@/lib/atlasClient'`
   569	2. **Send actual TCP commands:** Each control function now sends commands to the Atlas processor
   570	3. **Maintain database sync:** Database is updated after successful command execution for state tracking
   571	4. **Handle errors properly:** Failed commands throw errors with descriptive messages
   572	5. **Support 0-based indexing:** UI zone numbers (1-8) are converted to Atlas indices (0-7)
   573	
   574	**Control Functions:**
   575	- `setZoneVolume()` - Volume control with TCP command
   576	- `setZoneMute()` - Mute control with TCP command
   577	- `setZoneSource()` - Source selection with TCP command
   578	- `recallScene()` - Scene recall with TCP command
   579	- `playMessage()` - Message playback with TCP command
   580	- `combineRooms()` - Group activation (requires group configuration)
   581	
   582	#### Fixed Input/Output Issue
   583	
   584	**Problem:** UI was showing only 7 inputs/outputs instead of 8 for AZMP8 model.
   585	
   586	**Root Cause:** Custom configuration merging logic was replacing all outputs instead of merging with model defaults.
   587	
   588	**Solution:** Updated both `inputs/route.ts` and `outputs/route.ts` to:
   589	- Always start with full model configuration (8 inputs/outputs for AZMP8)
   590	- Merge custom configurations where available
   591	- Include all model defaults even if not in custom configuration
   592	- Use Map-based lookup for efficient merging
   593	
   594	**Code Change:**
   595	```typescript
   596	// Build map of custom outputs for quick lookup
   597	const customOutputsMap = new Map(
   598	  configData.outputs.map((output: any) => [output.id, output])
   599	)
   600	
   601	// Merge all model outputs with custom configurations where available
   602	outputs = modelOutputs.map(modelOutput => {
   603	  const customOutput = customOutputsMap.get(modelOutput.id)
   604	  return customOutput ? { ...modelOutput, ...customOutput } : modelOutput
   605	})
   606	```
   607	
   608	#### Connection Configuration
   609	
   610	**Default Settings:**
   611	```typescript
   612	{
   613	  ipAddress: '192.168.5.101',  // Atlas processor IP
   614	  port: 3804,                   // TCP JSON-RPC port
   615	  timeout: 5000,                // Command timeout in ms
   616	  maxRetries: 3                 // Max retry attempts
   617	}
   618	```
   619	
   620	#### Testing Commands
   621	
   622	**Test TCP Connection:**
   623	```bash
   624	telnet 192.168.5.101 3804
   625	```
   626	
   627	**Test Manual Command:**
   628	```bash
   629	echo '{"jsonrpc":"2.0","method":"get","params":{"param":"ZoneSource_0","fmt":"val"},"id":1}' | nc 192.168.5.101 3804
   630	```
   631	
   632	**Test from Node.js:**
   633	```javascript
   634	const { createAtlasClient } = require('./src/lib/atlasClient')
   635	
   636	async function test() {
   637	  const client = await createAtlasClient({
   638	    ipAddress: '192.168.5.101',
   639	    port: 3804
   640	  })
   641	  
   642	  // Set Zone 1 to Source 3
   643	  await client.setZoneSource(0, 2)
   644	  
   645	  // Set Zone 1 volume to 50%
   646	  await client.setZoneVolume(0, 50, true)
   647	  
   648	  client.disconnect()
   649	}
   650	```
   651	
   652	#### Atlas Parameter Reference
   653	
   654	**Zone Control Parameters:**
   655	| Parameter | Range | Description |
   656	|-----------|-------|-------------|
   657	| `ZoneSource_X` | -1 to NumSources | Set zone audio source (-1 = no source) |
   658	| `ZoneGain_X` | -80 to 0 dB or 0-100% | Zone volume control |
   659	| `ZoneMute_X` | 0 or 1 | Zone mute state (1 = muted) |
   660	| `ZoneName_X` | N/A | Zone name (read-only) |
   661	| `ZoneGrouped_X` | 0 or 1 | Zone group status (read-only) |
   662	
   663	**Group Control Parameters:**
   664	| Parameter | Range | Description |
   665	|-----------|-------|-------------|
   666	| `GroupActive_X` | 0 or 1 | Activate/deactivate group (combine zones) |
   667	| `GroupSource_X` | -1 to NumSources | Set group audio source |
   668	| `GroupGain_X` | -80 to 0 dB or 0-100% | Group volume control |
   669	| `GroupMute_X` | 0 or 1 | Group mute state |
   670	
   671	**Action Parameters:**
   672	| Parameter | Description |
   673	|-----------|-------------|
   674	| `RecallScene` | Recall a scene by index |
   675	| `PlayMessage` | Play a message by index |
   676	| `RepeatRoutine` | Repeat a routine by index |
   677	
   678	#### Troubleshooting
   679	
   680	**TCP Connection Fails:**
   681	1. Verify Atlas processor is powered on
   682	2. Check IP address: `ping 192.168.5.101`
   683	3. Verify TCP port 3804 is accessible: `telnet 192.168.5.101 3804`
   684	4. Check firewall settings on both ends
   685	5. Verify Atlas 3rd party control is enabled (Settings > 3rd Party Configurations)
   686	
   687	**Commands Not Executing:**
   688	1. Check console logs for error messages
   689	2. Verify parameter names match Atlas configuration
   690	3. Ensure zone/source indices are 0-based
   691	4. Test manual command via telnet/netcat
   692	5. Check Atlas web interface for parameter names in Message Table
   693	
   694	**Zone Source Not Changing:**
   695	1. Verify source index mapping is correct
   696	2. Check Atlas configuration for available sources
   697	3. Ensure source index is within valid range
   698	4. Test with direct TCP command to isolate issue
   699	
   700	**Missing Inputs/Outputs:**
   701	1. Check model configuration in `atlas-models-config.ts`
   702	2. Verify custom configuration file doesn't override model defaults
   703	3. Check console logs for merge operation details
   704	4. Delete custom configuration file to reset to model defaults
   705	
   706	#### Documentation References
   707	
   708	- **Atlas 3rd Party Control Manual:** `/home/ubuntu/Uploads/ATS006993-B-AZM4-AZM8-3rd-Party-Control (2).pdf`
   709	- **Atmosphere User Manual:** `/home/ubuntu/Uploads/ATS006332_Atmosphere_User_Manual_RevE.pdf`
   710	- **Debug Report:** `/home/ubuntu/ATLAS_ZONE_CONTROL_DEBUG_REPORT.md`
   711	- **Model Configuration:** `src/lib/atlas-models-config.ts`
   712	- **TCP Client Library:** `src/lib/atlasClient.ts`
   713	- **Control API:** `src/app/api/audio-processor/control/route.ts`
   714	
   552	   460  
   553	   461  ### Configuration Management
   554	   462  
   555	   463  **Configuration File Location:**
   556	   464  - Primary: `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai000260a7xuiepjl.json`
   557	   465  - Backups: `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai000260a7xuiepjl_backup_*.json`
   558	   466  
   559	   467  **Backup Strategy:**
   560	   468  - Automatic backup created on every upload
   561	   469  - Timestamped filename format
   562	   470  - Manual restore by copying backup to primary config file
   563	   471  
   564	   472  ### Database Schema
   565	   473  
   566	   474  ```prisma
   567	   475  model AudioProcessor {
   568	   476    id          String   @id @default(cuid())
   569	   477    name        String
   570	   478    model       String
   571	   479    ipAddress   String
   572	   480    port        Int      @default(80)
   573	   481    username    String?
   574	   482    password    String?
   575	   483    isActive    Boolean  @default(true)
   576	   484    createdAt   DateTime @default(now())
   577	   485    updatedAt   DateTime @updatedAt
   578	   486  }
   579	   487  ```
   580	   488  
   581	   489  ### Troubleshooting
   582	   490  
   583	   491  **Atlas Shows Offline:**
   584	   492  1. Check network connectivity: `ping 192.168.5.101`
   585	   493  2. Verify configuration file exists
   586	   494  3. Check processor is powered on
   587	   495  4. Restore from backup if needed
   588	   496  
   589	   497  **Configuration Not Loading:**
   590	   498  1. Validate JSON configuration file
   591	   499  2. Check file permissions
   592	   500  3. Restore from most recent backup
   593	   501  
   594	   502  ---
   595	   503  
   596	   504  ## 4. AI Hub
   597	   505  
   598	   506  ### Overview
   599	   507  Unified AI management system providing intelligent assistance, codebase analysis, device insights, and AI configuration.
   600	   508  
   601	   509  ### Current Status
   602	   510  **Testing Date:** October 15, 2025  
   603	   511  **Overall Status:** ⚠️ **PARTIALLY FUNCTIONAL**  
   604	   512  **Critical Issues:** 2  
   605	   513  **Features Tested:** 7  
   606	   514  **Working Features:** 5  
   607	   515  **Broken Features:** 2
   608	   516  
   609	   517  ### Features & Status
   610	   518  
   611	   519  #### ✅ AI Assistant Tab (Partially Working)
   612	   520  
   613	   521  **Status:** Chat interface works, Codebase sync fails
   614	   522  
   615	   523  **Chat Interface:**
   616	   524  - ✅ **Status:** WORKING
   617	   525  - ⚠️ **Performance Issue:** Response time is slow (15+ seconds)
   618	   526  - **Functionality:** Successfully answers questions about the codebase
   619	   527  - **Features:**
   620	   528    - Natural language queries
   621	   529    - Codebase context awareness
   622	   530    - Troubleshooting assistance
   623	   531    - Code explanations
   624	   532  
   625	   533  **Sync Codebase:**
   626	   534  - ❌ **Status:** FAILING
   627	   535  - 🔴 **Error:** `GET http://24.123.87.42:3000/api/ai-assistant/index-codebase 404 (Internal Server Error)`
   628	   536  - **Impact:** Cannot index codebase for AI analysis
   629	   537  - **Priority:** CRITICAL - Fix immediately
   630	   538  
   631	   539  #### ✅ Teach AI Tab (UI Works, Backend Fails)
   632	   540  
   633	   541  **Upload Documents:**
   634	   542  - ✅ **UI Status:** WORKING
   635	   543  - **Supported Formats:** PDF, Markdown (.md), Text (.txt)
   636	   544  - **Features:**
   637	   545    - Drag and drop file upload
   638	   546    - Multiple file support
   639	   547    - File type validation
   640	   548  - ⚠️ **Note:** Upload errors observed, needs further testing
   641	   549  
   642	   550  **Q&A Training:**
   643	   551  - ❌ **Status:** FAILING
   644	   552  - 🔴 **Error:** `Database error: Failed to create Q&A entry`
   645	   553  - **Console Error:** `500 (Internal Server Error)` for `api/qa-entries.ts`
   646	   554  - **Impact:** Users cannot add Q&A training pairs
   647	   555  - **Priority:** CRITICAL - Fix immediately
   648	   556  - **Features (Non-functional):**
   649	   557    - Category selection (General, Technical, Troubleshooting, etc.)
   650	   558    - Question/Answer input fields
   651	   559    - Entry management
   652	   560    - Generate from Repository
   653	   561    - Generate from Docs
   654	   562    - Upload Q&A File
   655	   563  
   656	   564  **Test AI:**
   657	   565  - ✅ **UI Status:** WORKING
   658	   566  - **Features:**
   659	   567    - Test question input
   660	   568    - AI response testing
   661	   569    - Testing tips and guidance
   662	   570  - ⚠️ **Note:** Cannot fully test without training data
   663	   571  
   664	   572  **Statistics Display:**
   665	   573  - Documents: 0
   666	   574  - Q&A Pairs: 0
   667	   575  - Total Content: 0 Bytes
   668	   576  - Last Updated: 10/15/2025, 1:00:06 AM
   669	   577  
   670	   578  #### ✅ Enhanced Devices Tab (Working)
   671	   579  
   672	   580  **Status:** ✅ FULLY FUNCTIONAL
   673	   581  
   674	   582  **Features:**
   675	   583  - Device AI Assistant for intelligent insights
   676	   584  - Filter options:
   677	   585    - All Devices dropdown
   678	   586    - Time range filter (Last 24 Hours)
   679	   587    - Refresh button
   680	   588  - **Tabs:**
   681	   589    - Smart Insights
   682	   590    - Performance
   683	   591    - Recommendations
   684	   592    - Predictions
   685	   593  - **Current State:** "No AI insights available for the selected criteria"
   686	   594  
   687	   595  #### ✅ Configuration Tab (Working)
   688	   596  
   689	   597  **Status:** ✅ FULLY FUNCTIONAL
   690	   598  
   691	   599  **Provider Statistics:**
   692	   600  - 1 Active Local Service
   693	   601  - 3 Cloud APIs Ready
   694	   602  - 5 Inactive Local Services
   695	   603  
   696	   604  **Local AI Services:**
   697	   605  - ✅ **Ollama** (http://localhost:11434/api/tags, Model: phi3:mini) - **Active** (4ms)
   698	   606  - ❌ Custom Local AI (http://localhost:8000/v1/models) - Error
   699	   607  - ❌ LocalAI (http://localhost:8080/v1/models) - Error
   700	   608  - ❌ LM Studio (http://localhost:1234/v1/models) - Error
   701	   609  - ❌ Text Generation WebUI (http://localhost:5000/v1/models) - Error
   702	   610  - ❌ Tabby (http://localhost:8080/v1/models) - Error
   703	   611  
   704	   612  **Cloud AI Services:**
   705	   613  - ✅ **OpenAI** - Ready (API key configured)
   706	   614  - ✅ **Anthropic Claude** - Ready (API key configured)
   707	   615  - ✅ **X.AI Grok** - Ready (API key configured)
   708	   616  - ⚠️ **Abacus AI** - Not Configured (No API key)
   709	   617  
   710	   618  **Features:**
   711	   619  - AI System Diagnostics (expandable)
   712	   620  - Provider status monitoring
   713	   621  - Refresh status button
   714	   622  - Local AI setup guide
   715	   623  
   716	   624  #### ✅ API Keys Tab (Working)
   717	   625  
   718	   626  **Status:** ✅ FULLY FUNCTIONAL
   719	   627  
   720	   628  **Features:**
   721	   629  - API key management interface
   722	   630  - Configured API Keys display (currently 0)
   723	   631  - Add API Key button
   724	   632  - Provider documentation links:
   725	   633    - Ollama (Local) - RECOMMENDED
   726	   634    - Abacus AI
   727	   635    - OpenAI
   728	   636    - LocalAI
   729	   637    - Custom Local AI
   730	   638  - Local AI Services Status:
   731	   639    - Port 8000: Active (Custom service detected)
   732	   640    - Port 11434: Check if Ollama is running
   733	   641    - Port 8080: Check if LocalAI is running
   734	   642  
   735	   643  **AI Assistant Features Listed:**
   736	   644  - Equipment Troubleshooting
   737	   645  - System Analysis
   738	   646  - Configuration Assistance
   739	   647  - Sports Guide Intelligence
   740	   648  - Operational Insights
   741	   649  - Proactive Monitoring
   742	   650  
   743	   651  ### Database Schema
   744	   652  
   745	   653  ```prisma
   746	   654  model IndexedFile {
   747	   655    id            String   @id @default(cuid())
   748	   656    filePath      String   @unique
   749	   657    fileName      String
   750	   658    fileType      String
   751	   659    content       String   @db.Text
   752	   660    fileSize      Int
   753	   661    lastModified  DateTime
   754	   662    lastIndexed   DateTime @default(now())
   755	   663    hash          String
   756	   664    isActive      Boolean  @default(true)
   757	   665    createdAt     DateTime @default(now())
   758	   666    updatedAt     DateTime @updatedAt
   759	   667  }
   760	   668  
   761	   669  model QAPair {
   762	   670    id          String   @id @default(cuid())
   763	   671    question    String   @db.Text
   764	   672    answer      String   @db.Text
   765	   673    context     String?  @db.Text
   766	   674    source      String?
   767	   675    category    String?
   768	   676    isActive    Boolean  @default(true)
   769	   677    createdAt   DateTime @default(now())
   770	   678    updatedAt   DateTime @updatedAt
   771	   679  }
   772	   680  
   773	   681  model TrainingDocument {
   774	   682    id          String   @id @default(cuid())
   775	   683    title       String
   776	   684    content     String   @db.Text
   777	   685    fileType    String
   778	   686    fileSize    Int
   779	   687    category    String?
   780	   688    isActive    Boolean  @default(true)
   781	   689    createdAt   DateTime @default(now())
   782	   690    updatedAt   DateTime @updatedAt
   783	   691  }
   784	   692  
   785	   693  model ApiKey {
   786	   694    id          String   @id @default(cuid())
   787	   695    provider    String
   788	   696    keyName     String
   789	   697    apiKey      String
   790	   698    isActive    Boolean  @default(true)
   791	   699    createdAt   DateTime @default(now())
   792	   700    updatedAt   DateTime @updatedAt
   793	   701    
   794	   702    @@unique([provider, keyName])
   795	   703  }
   796	   704  ```
   797	   705  
   798	   706  ### API Endpoints
   799	   707  
   800	   708  #### POST `/api/ai-assistant/index-codebase`
   801	   709  ❌ **Status:** BROKEN (404 error)  
   802	   710  Index codebase files for AI analysis
   803	   711  
   804	   712  #### POST `/api/ai-assistant/chat`
   805	   713  ✅ **Status:** WORKING (slow)  
   806	   714  Chat with AI about codebase
   807	   715  
   808	   716  #### POST `/api/ai/qa-generate`
   809	   717  Generate Q&A pairs from repository
   810	   718  
   811	   719  #### POST `/api/ai/qa-entries`
   812	   720  ❌ **Status:** BROKEN (500 error)  
   813	   721  Create Q&A training entries
   814	   722  
   815	   723  #### GET/POST `/api/api-keys`
   816	   724  ✅ **Status:** WORKING  
   817	   725  Manage AI provider API keys
   818	   726  
   819	   727  #### POST `/api/devices/ai-analysis`
   820	   728  Get AI insights for devices
   821	   729  
   822	   730  ### Critical Issues & Fix Plan
   823	   731  
   824	   732  #### 🔴 CRITICAL #1: Q&A Training Database Error
   825	   733  
   826	   734  **Error:** `Database error: Failed to create Q&A entry`  
   827	   735  **API:** `POST /api/ai/qa-entries` returns 500 error  
   828	   736  **Impact:** Users cannot add Q&A training pairs
   829	   737  
   830	   738  **Fix Steps:**
   831	   739  1. Check database schema for `QAPair` table
   832	   740  2. Verify Prisma migrations are up to date
   833	   741  3. Review API route handler (`src/app/api/ai/qa-entries/route.ts`)
   834	   742  4. Check database connection and write permissions
   835	   743  5. Add proper error logging
   836	   744  6. Test with various Q&A entry formats
   837	   745  
   838	   746  **Priority:** Fix immediately before production use
   839	   747  
   840	   748  #### 🔴 CRITICAL #2: Codebase Indexing 404 Error
   841	   749  
   842	   750  **Error:** `GET http://24.123.87.42:3000/api/ai-assistant/index-codebase 404`  
   843	   751  **Impact:** Cannot index codebase for AI assistance
   844	   752  
   845	   753  **Fix Steps:**
   846	   754  1. Verify API route exists in correct location
   847	   755  2. Check route file naming (should be `route.ts` in app router)
   848	   756  3. Ensure proper HTTP method handling (GET/POST)
   849	   757  4. Implement codebase indexing logic if missing
   850	   758  5. Test with actual project directory
   851	   759  6. Add proper error responses
   852	   760  
   853	   761  **Priority:** Fix immediately for full AI Hub functionality
   854	   762  
   855	   763  #### 🟡 HIGH PRIORITY: Chat Performance
   856	   764  
   857	   765  **Issue:** 15+ second response time  
   858	   766  **Impact:** Poor user experience
   859	   767  
   860	   768  **Optimization Steps:**
   861	   769  1. Profile AI model response time
   862	   770  2. Implement streaming responses
   863	   771  3. Add response caching for common questions
   864	   772  4. Consider faster AI model for simple queries
   865	   773  5. Optimize context window size
   866	   774  6. Add better loading indicators
   867	   775  
   868	   776  #### 🟠 MEDIUM PRIORITY: Local AI Services
   869	   777  
   870	   778  **Issue:** 5 local AI services showing error status
   871	   779  
   872	   780  **Services to Fix:**
   873	   781  - Custom Local AI (port 8000)
   874	   782  - LocalAI (port 8080)
   875	   783  - LM Studio (port 1234)
   876	   784  - Text Generation WebUI (port 5000)
   877	   785  - Tabby (port 8080 - port conflict?)
   878	   786  
   879	   787  **Fix Steps:**
   880	   788  1. Verify each service is installed
   881	   789  2. Check if services are running
   882	   790  3. Update service URLs in configuration
   883	   791  4. Add health check with retry logic
   884	   792  5. Document installation instructions
   885	   793  6. Consider making local services optional
   886	   794  
   887	   795  ### Recommendations
   888	   796  
   889	   797  **Immediate Actions:**
   890	   798  1. Fix Q&A Training database error (CRITICAL)
   891	   799  2. Fix Codebase Indexing 404 error (CRITICAL)
   892	   800  3. Test document upload feature thoroughly
   893	   801  4. Add proper error messages and user feedback
   894	   802  
   895	   803  **Short-term Improvements:**
   896	   804  1. Optimize chat response performance
   897	   805  2. Implement streaming responses
   898	   806  3. Add progress indicators
   899	   807  4. Configure local AI services
   900	   808  
   901	   809  **Long-term Enhancements:**
   902	   810  1. Add training data export/import
   903	   811  2. Implement batch Q&A generation
   904	   812  3. Add training quality metrics
   905	   813  4. Enhanced device insights with more data
   906	   814  
   907	   815  ### Testing Report
   908	   816  📄 **Detailed Testing Report:** `/home/ubuntu/ai_hub_testing_report.md`
   909	   817  
   910	   818  ---
   911	   819  
   912	   820  ## 5. Sports Guide
   913	   821  
   914	   822  ### Overview
   915	   823  Simplified sports programming guide using The Rail Media API as the ONLY data source. All previous data sources (ESPN, TheSportsDB, Spectrum, etc.) have been removed for simplicity and maintainability.
   916	   824  
   917	   825  **Version:** 4.0.0 - Simplified Implementation  
   918	   826  **Last Updated:** October 16, 2025  
   919	   827  **Data Source:** The Rail Media API ONLY
   920	   828  
   921	   829  ### Key Changes (Version 4.0.0)
   922	   830  
   923	   831  #### Simplified Architecture
   924	   832  - **REMOVED:** ESPN API integration
   925	   833  - **REMOVED:** TheSportsDB API integration  
   926	   834  - **REMOVED:** Spectrum Channel Service
   927	   835  - **REMOVED:** Sunday Ticket Service
   928	   836  - **REMOVED:** Enhanced streaming sports service
   929	   837  - **REMOVED:** Mock data generation
   930	   838  - **REMOVED:** Multiple hardcoded channel lists
   931	   839  - **KEPT:** The Rail Media API as the ONLY data source
   932	   840  
   933	   841  #### Benefits of Simplification
   934	   842  - Single source of truth for all sports programming data
   935	   843  - Reduced code complexity (600+ lines → 300 lines)
   936	   844  - Easier maintenance and debugging
   937	   845  - Consistent data format
   938	   846  - No API conflicts or data merging issues
   939	   847  - Comprehensive verbose logging for debugging
   940	   848  
   941	   849  ### Features
   942	   850  
   943	   851  #### Core Functionality
   944	   852  - **Sports Programming Guide:** Real-time sports TV guide data from The Rail Media
   945	   853  - **Date Range Filtering:** Query specific date ranges or number of days ahead
   946	   854  - **Lineup Filtering:** Filter by satellite, cable, or streaming lineup
   947	   855  - **Search Functionality:** Search for specific teams, leagues, or sports
   948	   856  - **Comprehensive Logging:** Verbose logging for all operations
   949	   857  - **Ollama Integration:** AI-powered query and analysis capabilities
   950	   858  
   951	   859  #### Supported Lineups
   952	   860  - **SAT** - Satellite providers
   953	   861  - **DRTV** - DirecTV
   954	   862  - **DISH** - Dish Network
   955	   863  - **CABLE** - Cable providers
   956	   864  - **STREAM** - Streaming services
   957	   865  
   958	   866  ### API Configuration
   959	   867  
   960	   868  **Provider:** The Rail Media  
   961	   869  **API Endpoint:** https://guide.thedailyrail.com/api/v1  
   962	   870  **User ID:** 258351  
   963	   871  **API Key:** Configured in `.env` file
   964	   872  
   965	   873  #### Environment Variables
   966	   874  ```bash
   967	   875  SPORTS_GUIDE_API_KEY=12548RK0000000d2bb701f55b82bfa192e680985919
   968	   876  SPORTS_GUIDE_USER_ID=258351
   969	   877  SPORTS_GUIDE_API_URL=https://guide.thedailyrail.com/api/v1
   970	   878  ```
   971	   879  
   972	   880  ### API Endpoints
   973	   881  
   974	   882  #### POST `/api/sports-guide`
   975	   883  Fetch sports programming guide from The Rail Media API
   976	   884  
   977	   885  **Request Body:**
   978	   886  ```json
   979	   887  {
   980	   888    "startDate": "2025-10-16",  // Optional: YYYY-MM-DD format
   981	   889    "endDate": "2025-10-23",     // Optional: YYYY-MM-DD format
   982	   890    "days": 7,                   // Optional: Number of days from today
   983	   891    "lineup": "SAT",             // Optional: Filter by lineup (SAT, DRTV, etc.)
   984	   892    "search": "NBA"              // Optional: Search term (team, league, sport)
   985	   893  }
   986	   894  ```
   987	   895  
   988	   896  **Response:**
   989	   897  ```json
   990	   898  {
   991	   899    "success": true,
   992	   900    "requestId": "abc123",
   993	   901    "dataSource": "The Rail Media API",
   994	   902    "apiProvider": {
   995	   903      "name": "The Rail Media",
   996	   904      "url": "https://guide.thedailyrail.com/api/v1",
   997	   905      "userId": "258351"
   998	   906    },
   999	   907    "fetchMethod": "fetchDateRangeGuide (7 days)",
  1000	   908    "data": {
  1001	   909      "listing_groups": [...]
  1002	   910    },
  1003	   911    "statistics": {
  1004	   912      "totalListingGroups": 42,
  1005	   913      "totalListings": 156,
  1006	   914      "appliedFilters": [],
  1007	   915      "generatedAt": "2025-10-16T..."
  1008	   916    },
  1009	   917    "filters": {
  1010	   918      "startDate": null,
  1011	   919      "endDate": null,
  1012	   920      "days": 7,
  1013	   921      "lineup": null,
  1014	   922      "search": null
  1015	   923    }
  1016	   924  }
  1017	   925  ```
  1018	   926  
  1019	   927  #### GET `/api/sports-guide`
  1020	   928  Get API information, status, and available endpoints
  1021	   929  
  1022	   930  **Response:**
  1023	   931  ```json
  1024	   932  {
  1025	   933    "success": true,
  1026	   934    "requestId": "xyz789",
  1027	   935    "version": "4.0.0",
  1028	   936    "name": "Simplified Sports Guide API",
  1029	   937    "description": "Sports programming guide using ONLY The Rail Media API",
  1030	   938    "dataSource": {
  1031	   939      "provider": "The Rail Media",
  1032	   940      "url": "https://guide.thedailyrail.com/api/v1",
  1033	   941      "userId": "258351",
  1034	   942      "apiKeySet": true,
  1035	   943      "configured": true
  1036	   944    },
  1037	   945    "endpoints": {...},
  1038	   946    "features": [...],
  1039	   947    "logging": {
  1040	   948      "enabled": true,
  1041	   949      "location": "PM2 logs (pm2 logs sports-bar-tv)",
  1042	   950      "format": "[timestamp] [Sports-Guide] LEVEL: message",
  1043	   951      "levels": ["INFO", "ERROR", "DEBUG"]
  1044	   952    },
  1045	   953    "supportedLineups": [...]
  1046	   954  }
  1047	   955  ```
  1048	   956  
  1049	   957  #### GET `/api/sports-guide?action=test-connection`
  1050	   958  Test The Rail Media API connection
  1051	   959  
  1052	   960  **Response:**
  1053	   961  ```json
  1054	   962  {
  1055	   963    "success": true,
  1056	   964    "requestId": "test123",
  1057	   965    "connectionTest": {
  1058	   966      "valid": true,
  1059	   967      "message": "API key is valid and working"
  1060	   968    },
  1061	   969    "timestamp": "2025-10-16T..."
  1062	   970  }
  1063	   971  ```
  1064	   972  
  1065	   973  #### GET `/api/sports-guide/status`
  1066	   974  Get current API configuration status
  1067	   975  
  1068	   976  **Response:**
  1069	   977  ```json
  1070	   978  {
  1071	   979    "success": true,
  1072	   980    "configured": true,
  1073	   981    "apiUrl": "https://guide.thedailyrail.com/api/v1",
  1074	   982    "userId": "258351",
  1075	   983    "apiKeySet": true,
  1076	   984    "apiKeyPreview": "12548RK0...5919"
  1077	   985  }
  1078	   986  ```
  1079	   987  
  1080	   988  #### POST `/api/sports-guide/verify-key`
  1081	   989  Verify API key validity
  1082	   990  
  1083	   991  **Request Body:**
  1084	   992  ```json
  1085	   993  {
  1086	   994    "apiKey": "your-api-key",
  1087	   995    "userId": "your-user-id"
  1088	   996  }
  1089	   997  ```
  1090	   998  
  1091	   999  #### POST `/api/sports-guide/update-key`
  1092	  1000  Update API key (with validation)
  1093	  1001  
  1094	  1002  **Request Body:**
  1095	  1003  ```json
  1096	  1004  {
  1097	  1005    "apiKey": "new-api-key",
  1098	  1006    "userId": "new-user-id"
  1099	  1007  }
  1100	  1008  ```
  1101	  1009  
  1102	  1010  ### Ollama AI Integration
  1103	  1011  
  1104	  1012  The Sports Guide now includes comprehensive AI integration using Ollama for intelligent querying and analysis.
  1105	  1013  
  1106	  1014  #### Ollama Configuration
  1107	  1015  - **Host:** http://localhost:11434 (configurable via `OLLAMA_HOST`)
  1108	  1016  - **Model:** phi3:mini (configurable via `OLLAMA_MODEL`)
  1109	  1017  - **Status:** Active and operational
  1110	  1018  
  1111	  1019  #### Ollama API Endpoints
  1112	  1020  
  1113	  1021  ##### POST `/api/sports-guide/ollama/query`
  1114	  1022  Query Ollama about sports guide functionality
  1115	  1023  
  1116	  1024  **Default Query:**
  1117	  1025  ```json
  1118	  1026  {
  1119	  1027    "query": "What sports games are on TV tonight?",
  1120	  1028    "includeRecentLogs": true
  1121	  1029  }
  1122	  1030  ```
  1123	  1031  
  1124	  1032  **Analyze Logs:**
  1125	  1033  ```json
  1126	  1034  {
  1127	  1035    "action": "analyze-logs"
  1128	  1036  }
  1129	  1037  ```
  1130	  1038  
  1131	  1039  **Get Recommendations:**
  1132	  1040  ```json
  1133	  1041  {
  1134	  1042    "action": "get-recommendations",
  1135	  1043    "userPreferences": {
  1136	  1044      "favoriteTeams": ["Green Bay Packers", "Milwaukee Bucks"],
  1137	  1045      "favoriteLeagues": ["NFL", "NBA"],
  1138	  1046      "location": "Green Bay, Wisconsin"
  1139	  1047    }
  1140	  1048  }
  1141	  1049  ```
  1142	  1050  
  1143	  1051  **Test Connection:**
  1144	  1052  ```json
  1145	  1053  {
  1146	  1054    "action": "test-connection"
  1147	  1055  }
  1148	  1056  ```
  1149	  1057  
  1150	  1058  ##### GET `/api/sports-guide/ollama/query`
  1151	  1059  Test Ollama connectivity
  1152	  1060  
  1153	  1061  **Response:**
  1154	  1062  ```json
  1155	  1063  {
  1156	  1064    "success": true,
  1157	  1065    "message": "Ollama is online and accessible",
  1158	  1066    "model": "phi3:mini",
  1159	  1067    "responseTime": 45
  1160	  1068  }
  1161	  1069  ```
  1162	  1070  
  1163	  1071  #### Ollama Features
  1164	  1072  
  1165	  1073  1. **Intelligent Query Answering**
  1166	  1074     - Natural language questions about sports programming
  1167	  1075     - Context-aware responses using recent logs
  1168	  1076     - Comprehensive system knowledge
  1169	  1077  
  1170	  1078  2. **Log Analysis**
  1171	  1079     - Automatic analysis of sports guide logs
  1172	  1080     - System health assessment
  1173	  1081     - Error detection and reporting
  1174	  1082     - Usage pattern identification
  1175	  1083  
  1176	  1084  3. **Personalized Recommendations**
  1177	  1085     - Sports programming recommendations based on user preferences
  1178	  1086     - Location-based suggestions
  1179	  1087     - Team and league-specific recommendations
  1180	  1088  
  1181	  1089  4. **Debug Assistance**
  1182	  1090     - Help troubleshooting issues
  1183	  1091     - Explain error messages
  1184	  1092     - Suggest solutions based on logs
  1185	  1093  
  1186	  1094  ### Comprehensive Logging
  1187	  1095  
  1188	  1096  All sports guide operations are logged with comprehensive detail for debugging and monitoring.
  1189	  1097  
  1190	  1098  #### Log Format
  1191	  1099  ```
  1192	  1100  [2025-10-16T12:34:56.789Z] [Sports-Guide] LEVEL: message
  1193	  1101  ```
  1194	  1102  
  1195	  1103  #### Log Levels
  1196	  1104  - **INFO:** General information about operations
  1197	  1105  - **ERROR:** Error conditions and failures
  1198	  1106  - **DEBUG:** Detailed debugging information
  1199	  1107  
  1200	  1108  #### Log Locations
  1201	  1109  - **PM2 Output Log:** `~/.pm2/logs/sports-bar-tv-out.log`
  1202	  1110  - **PM2 Error Log:** `~/.pm2/logs/sports-bar-tv-error.log`
  1203	  1111  
  1204	  1112  #### Viewing Logs
  1205	  1113  
  1206	  1114  **Real-time logs:**
  1207	  1115  ```bash
  1208	  1116  pm2 logs sports-bar-tv
  1209	  1117  ```
  1210	  1118  
  1211	  1119  **Filter for Sports Guide logs:**
  1212	  1120  ```bash
  1213	  1121  pm2 logs sports-bar-tv | grep "Sports-Guide"
  1214	  1122  ```
  1215	  1123  
  1216	  1124  **View specific log file:**
  1217	  1125  ```bash
  1218	  1126  tail -f ~/.pm2/logs/sports-bar-tv-out.log | grep "Sports-Guide"
  1219	  1127  ```
  1220	  1128  
  1221	  1129  **Search logs:**
  1222	  1130  ```bash
  1223	  1131  cat ~/.pm2/logs/sports-bar-tv-out.log | grep "Sports-Guide" | grep "ERROR"
  1224	  1132  ```
  1225	  1133  
  1226	  1134  #### Logged Operations
  1227	  1135  
  1228	  1136  - **Request Processing:** Every API request with unique request ID
  1229	  1137  - **API Calls:** The Rail API requests with parameters
  1230	  1138  - **Data Fetching:** Method used and response statistics
  1231	  1139  - **Filtering:** Applied filters and results
  1232	  1140  - **Errors:** Detailed error information with stack traces
  1233	  1141  - **Statistics:** Request counts, processing times, data volumes
  1234	  1142  
  1235	  1143  ### Configuration Management
  1236	  1144  
  1237	  1145  #### Viewing Current Configuration
  1238	  1146  
  1239	  1147  1. Navigate to Sports Guide Configuration page
  1240	  1148  2. Click "API" tab
  1241	  1149  3. View current User ID and masked API Key
  1242	  1150  4. Check configuration status indicator
  1243	  1151  
  1244	  1152  #### Updating Configuration
  1245	  1153  
  1246	  1154  **Via UI:**
  1247	  1155  1. Navigate to Sports Guide Configuration
  1248	  1156  2. Click "API" tab
  1249	  1157  3. Enter new User ID and API Key
  1250	  1158  4. Click "Verify API Key" to test
  1251	  1159  5. Click "Save Configuration"
  1252	  1160  6. Restart server for changes to take effect
  1253	  1161  
  1254	  1162  **Via Command Line:**
  1255	  1163  ```bash
  1256	  1164  # SSH into server
  1257	  1165  ssh -p 224 ubuntu@24.123.87.42
  1258	  1166  
  1259	  1167  # Edit .env file
  1260	  1168  nano /home/ubuntu/Sports-Bar-TV-Controller/.env
  1261	  1169  
  1262	  1170  # Update values:
  1263	  1171  # SPORTS_GUIDE_API_KEY=your-new-key
  1264	  1172  # SPORTS_GUIDE_USER_ID=your-new-user-id
  1265	  1173  
  1266	  1174  # Restart application
  1267	  1175  pm2 restart sports-bar-tv
  1268	  1176  ```
  1269	  1177  
  1270	  1178  ### Security
  1271	  1179  
  1272	  1180  - **API Keys:** Stored only in `.env` file (never in repository)
  1273	  1181  - **Key Masking:** UI shows only first 8 and last 4 characters
  1274	  1182  - **Validation:** API keys validated before saving
  1275	  1183  - **Server-side Only:** All API calls made from server, never client
  1276	  1184  - **Environment Variables:** Secure storage of sensitive credentials
  1277	  1185  
  1278	  1186  ### Testing
  1279	  1187  
  1280	  1188  #### Test API Connection
  1281	  1189  ```bash
  1282	  1190  curl http://24.123.87.42:3000/api/sports-guide?action=test-connection
  1283	  1191  ```
  1284	  1192  
  1285	  1193  #### Fetch Today's Guide
  1286	  1194  ```bash
  1287	  1195  curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1288	  1196    -H "Content-Type: application/json" \
  1289	  1197    -d '{}'
  1290	  1198  ```
  1291	  1199  
  1292	  1200  #### Fetch 7-Day Guide
  1293	  1201  ```bash
  1294	  1202  curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1295	  1203    -H "Content-Type: application/json" \
  1296	  1204    -d '{"days": 7}'
  1297	  1205  ```
  1298	  1206  
  1299	  1207  #### Search for NBA Games
  1300	  1208  ```bash
  1301	  1209  curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1302	  1210    -H "Content-Type: application/json" \
  1303	  1211    -d '{"search": "NBA", "days": 3}'
  1304	  1212  ```
  1305	  1213  
  1306	  1214  #### Filter by DirecTV Lineup
  1307	  1215  ```bash
  1308	  1216  curl -X POST http://24.123.87.42:3000/api/sports-guide \
  1309	  1217    -H "Content-Type: application/json" \
  1310	  1218    -d '{"lineup": "DRTV", "days": 1}'
  1311	  1219  ```
  1312	  1220  
  1313	  1221  #### Test Ollama Connection
  1314	  1222  ```bash
  1315	  1223  curl http://24.123.87.42:3000/api/sports-guide/ollama/query
  1316	  1224  ```
  1317	  1225  
  1318	  1226  #### Query Ollama
  1319	  1227  ```bash
  1320	  1228  curl -X POST http://24.123.87.42:3000/api/sports-guide/ollama/query \
  1321	  1229    -H "Content-Type: application/json" \
  1322	  1230    -d '{"query": "What NFL games are on TV this week?"}'
  1323	  1231  ```
  1324	  1232  
  1325	  1233  #### Get AI Recommendations
  1326	  1234  ```bash
  1327	  1235  curl -X POST http://24.123.87.42:3000/api/sports-guide/ollama/query \
  1328	  1236    -H "Content-Type: application/json" \
  1329	  1237    -d '{
  1330	  1238      "action": "get-recommendations",
  1331	  1239      "userPreferences": {
  1332	  1240        "favoriteTeams": ["Green Bay Packers"],
  1333	  1241        "favoriteLeagues": ["NFL"]
  1334	  1242      }
  1335	  1243    }'
  1336	  1244  ```
  1337	  1245  
  1338	  1246  ### Troubleshooting
  1339	  1247  
  1340	  1248  #### Issue: "The Rail Media API not configured"
  1341	  1249  **Solution:**
  1342	  1250  1. Check `.env` file has `SPORTS_GUIDE_API_KEY` and `SPORTS_GUIDE_USER_ID`
  1343	  1251  2. Verify values are correct
  1344	  1252  3. Restart application: `pm2 restart sports-bar-tv`
  1345	  1253  
  1346	  1254  #### Issue: "API key is invalid or unauthorized"
  1347	  1255  **Solution:**
  1348	  1256  1. Verify API key is correct in `.env` file
  1349	  1257  2. Test API key using `/api/sports-guide?action=test-connection`
  1350	  1258  3. Contact The Rail Media support if key is correct but still failing
  1351	  1259  
  1352	  1260  #### Issue: No data returned
  1353	  1261  **Solution:**
  1354	  1262  1. Check PM2 logs: `pm2 logs sports-bar-tv | grep "Sports-Guide"`
  1355	  1263  2. Verify date range is valid
  1356	  1264  3. Try fetching without filters first
  1357	  1265  4. Check The Rail Media API status
  1358	  1266  
  1359	  1267  #### Issue: Ollama queries failing
  1360	  1268  **Solution:**
  1361	  1269  1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
  1362	  1270  2. Check Ollama model is downloaded: `ollama list`
  1363	  1271  3. Restart Ollama if needed: `systemctl restart ollama` (if using systemd)
  1364	  1272  4. Check logs for detailed error messages
  1365	  1273  
  1366	  1274  #### Issue: Slow response times
  1367	  1275  **Solution:**
  1368	  1276  1. Check network connectivity to The Rail Media API
  1369	  1277  2. Review logs for performance issues
  1370	  1278  3. Consider reducing date range for queries
  1371	  1279  4. Use Ollama to analyze logs for performance patterns
  1372	  1280  
  1373	  1281  ### Migration Notes
  1374	  1282  
  1375	  1283  #### Upgrading from Version 3.x
  1376	  1284  
  1377	  1285  **What Changed:**
  1378	  1286  - Removed all data sources except The Rail Media API
  1379	  1287  - Simplified API interface
  1380	  1288  - Added comprehensive logging
  1381	  1289  - Added Ollama AI integration
  1382	  1290  - Removed hardcoded channel lists
  1383	  1291  
  1384	  1292  **Migration Steps:**
  1385	  1293  1. Ensure The Rail Media API credentials are configured in `.env`
  1386	  1294  2. Update any frontend code that relied on old API response format
  1387	  1295  3. Test all sports guide functionality
  1388	  1296  4. Review logs to ensure proper operation
  1389	  1297  5. Update any custom integrations
  1390	  1298  
  1391	  1299  **Breaking Changes:**
  1392	  1300  - Response format changed to focus on The Rail API data structure
  1393	  1301  - Removed mock data fallbacks
  1394	  1302  - Removed multi-source data merging
  1395	  1303  - Changed API response schema
  1396	  1304  
  1397	  1305  ### Future Enhancements
  1398	  1306  
  1399	  1307  **Planned Features:**
  1400	  1308  - Enhanced caching for frequently accessed data
  1401	  1309  - Webhook support for real-time updates
  1402	  1310  - User preference storage
  1403	  1311  - Advanced filtering options
  1404	  1312  - Integration with other system features (matrix routing, etc.)
  1405	  1313  - Mobile app support
  1406	  1314  - Push notifications for favorite teams
  1407	  1315  
  1408	  1316  ### Support
  1409	  1317  
  1410	  1318  For issues with The Rail Media API:
  1411	  1319  - **Website:** https://guide.thedailyrail.com
  1412	  1320  - **Support:** Contact The Rail Media support team
  1413	  1321  
  1414	  1322  For Sports Bar TV Controller issues:
  1415	  1323  - **Logs:** `pm2 logs sports-bar-tv | grep "Sports-Guide"`
  1416	  1324  - **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
  1417	  1325  - **Ollama Assistant:** Use `/api/sports-guide/ollama/query` to ask questions
  1418	  1326  
  1419	  1327  ---
  1420	  1328  
  1421	  1329  *Last Updated: October 16, 2025*  
  1422	  1330  *Version: 4.0.0 - Simplified Implementation*  
  1423	  1331  *Data Source: The Rail Media API Only*
  1424	  1332  ## 6. Streaming Platforms
  1425	  1333  
  1426	  1334  ### Overview
  1427	  1335  Management interface for streaming service accounts and configurations.
  1428	  1336  
  1429	  1337  ### Features
  1430	  1338  - Platform account management
  1431	  1339  - Service configuration
  1432	  1340  - Integration settings
  1433	  1341  
  1434	  1342  ---
  1435	  1343  
  1436	  1344  ## 6.5. Global Cache IR Control
  1437	  1345  
  1438	  1346  ### Overview
  1439	  1347  Global Cache iTach IR Control system provides comprehensive infrared device management for cable boxes, AV receivers, and other IR-controlled equipment. The system supports both downloading IR codes from the Global Cache IR Database and **learning IR codes directly from physical remote controls**.
  1440	  1348  
  1441	  1349  **Version:** 2.0 - With IR Learning Support  
  1442	  1350  **Last Updated:** October 17, 2025  
  1443	  1351  **Status:** Production Ready
  1444	  1352  
  1445	  1353  ### Key Features
  1446	  1354  - **Device Management**: Add and manage Global Cache iTach devices (IP2IR, WF2IR, etc.)
  1447	  1355  - **IR Code Database**: Download pre-programmed IR codes from Global Cache cloud database
  1448	  1356  - **IR Learning**: Learn IR codes directly from physical remote controls
  1449	  1357  - **Multi-Port Support**: Configure multiple IR output ports per device
  1450	  1358  - **Real-time Testing**: Test device connectivity and IR transmission
  1451	  1359  - **Comprehensive Logging**: Verbose logging for debugging and monitoring
  1452	  1360  
  1453	  1361  ### Global Cache Device Management
  1454	  1362  
  1455	  1363  #### Supported Models
  1456	  1364  - **iTach IP2IR**: Ethernet to 3x IR outputs (Port 4998)
  1457	  1365  - **iTach WF2IR**: WiFi to 3x IR outputs (Port 4998)
  1458	  1366  - **GC-100**: Network adapter with IR/Serial/Relay support
  1459	  1367  
  1460	  1368  #### Adding Devices
  1461	  1369  1. Navigate to Device Configuration → Global Cache tab
  1462	  1370  2. Click "Add Device"
  1463	  1371  3. Enter device information:
  1464	  1372     - **Device Name**: Friendly name (e.g., "Cable 1 iTach")
  1465	  1373     - **IP Address**: Device network address (e.g., 192.168.5.110)
  1466	  1374     - **Port**: TCP port (default 4998)
  1467	  1375     - **Model** (optional): Device model identifier
  1468	  1376  4. Click "Add Device"
  1469	  1377  5. System will automatically test connectivity
  1470	  1378  
  1471	  1379  #### Device Testing
  1472	  1380  - Click the "Test" button on any device card
  1473	  1381  - System sends `getdevices` command to verify connectivity
  1474	  1382  - Results show device information and response time
  1475	  1383  - Status indicator shows online/offline state
  1476	  1384  
  1477	  1385  ### IR Learning Feature
  1478	  1386  
  1479	  1387  **NEW:** The IR learning feature allows you to capture IR codes directly from physical remote controls without needing access to the Global Cache IR Database.
  1480	  1388  
  1481	  1389  #### How IR Learning Works
  1482	  1390  
  1483	  1391  The Global Cache iTach devices have a built-in IR receiver (small hole near the power connector) that can capture IR signals from remote controls. The learning process:
  1484	  1392  
  1485	  1393  1. **Enable Learning Mode**: Device enters learning mode via `get_IRL` command
  1486	  1394  2. **Capture Signal**: Point remote at device and press button
  1487	  1395  3. **Receive Code**: Device sends captured IR code in Global Cache `sendir` format
  1488	  1396  4. **Disable Learning**: Automatic or manual via `stop_IRL` command
  1489	  1397  
  1490	  1398  #### Using IR Learning
  1491	  1399  
  1492	  1400  **Step-by-Step Process:**
  1493	  1401  
  1494	  1402  1. **Navigate to IR Learning Tab**
  1495	  1403     - Go to Device Configuration → Global Cache
  1496	  1404     - Click the "IR Learning" tab
  1497	  1405  
  1498	  1406  2. **Select Device**
  1499	  1407     - Choose a Global Cache device from the dropdown
  1500	  1408     - Device must be online and reachable
  1501	  1409  
  1502	  1410  3. **Start Learning**
  1503	  1411     - Click "Start Learning" button
  1504	  1412     - System sends `get_IRL` command to device
  1505	  1413     - Wait for confirmation: "IR Learner Enabled"
  1506	  1414  
  1507	  1415  4. **Capture IR Signal**
  1508	  1416     - Point your remote control at the Global Cache device
  1509	  1417     - Aim at the small IR receiver hole (near power connector)
  1510	  1418     - Press the button you want to learn
  1511	  1419     - Hold button for 1-2 seconds for best results
  1512	  1420  
  1513	  1421  5. **View Learned Code**
  1514	  1422     - IR code appears automatically in text area
  1515	  1423     - Code is in Global Cache `sendir` format
  1516	  1424     - Example: `sendir,1:1,1,38000,1,1,342,171,21,64,21,64,...`
  1517	  1425  
  1518	  1426  6. **Save or Copy Code**
  1519	  1427     - **Option 1**: Click "Copy" to copy code to clipboard
  1520	  1428     - **Option 2**: Enter a function name (e.g., "POWER") and click "Save to IR Device"
  1521	  1429     - Follow instructions to add code to an IR device
  1522	  1430  
  1523	  1431  **Important Notes:**
  1524	  1432  - Learning mode has a 60-second timeout
  1525	  1433  - Only one learning session at a time per device
  1526	  1434  - Device must not be configured for LED lighting
  1527	  1435  - Code is automatically stopped after learning completes
  1528	  1436  - Can manually stop learning with "Stop Learning" button
  1529	  1437  
  1530	  1438  #### IR Learning API Endpoints
  1531	  1439  
  1532	  1440  **POST `/api/globalcache/learn`**
  1533	  1441  Start IR learning session
  1534	  1442  
  1535	  1443  ```json
  1536	  1444  {
  1537	  1445    "deviceId": "clx123abc..."
  1538	  1446  }
  1539	  1447  ```
  1540	  1448  
  1541	  1449  **Response:**
  1542	  1450  ```json
  1543	  1451  {
  1544	  1452    "success": true,
  1545	  1453    "status": "IR code learned successfully",
  1546	  1454    "learnedCode": "sendir,1:1,1,38000,1,1,342,171,21,64,..."
  1547	  1455  }
  1548	  1456  ```
  1549	  1457  
  1550	  1458  **DELETE `/api/globalcache/learn`**
  1551	  1459  Stop IR learning session
  1552	  1460  
  1553	  1461  ```json
  1554	  1462  {
  1555	  1463    "deviceId": "clx123abc..."
  1556	  1464  }
  1557	  1465  ```
  1558	  1466  
  1559	  1467  **Response:**
  1560	  1468  ```json
  1561	  1469  {
  1562	  1470    "success": true,
  1563	  1471    "status": "IR Learner disabled"
  1564	  1472  }
  1565	  1473  ```
  1566	  1474  
  1567	  1475  #### IR Learning Commands (Global Cache API)
  1568	  1476  
  1569	  1477  **Enable Learning:**
  1570	  1478  ```
  1571	  1479  get_IRL\r
  1572	  1480  ```
  1573	  1481  
  1574	  1482  **Response:**
  1575	  1483  ```
  1576	  1484  IR Learner Enabled
  1577	  1485  ```
  1578	  1486  
  1579	  1487  **Learned Code (automatic):**
  1580	  1488  ```
  1581	  1489  sendir,1:1,1,38000,1,1,342,171,21,64,21,64,...\r
  1582	  1490  ```
  1583	  1491  
  1584	  1492  **Disable Learning:**
  1585	  1493  ```
  1586	  1494  stop_IRL\r
  1587	  1495  ```
  1588	  1496  
  1589	  1497  **Response:**
  1590	  1498  ```
  1591	  1499  IR Learner Disabled
  1592	  1500  ```
  1593	  1501  
  1594	  1502  #### Troubleshooting IR Learning
  1595	  1503  
  1596	  1504  **Problem: "IR Learner Unavailable"**
  1597	  1505  - **Cause**: Device is configured for LED lighting control
  1598	  1506  - **Solution**: Reconfigure device to disable LED lighting mode
  1599	  1507  - **Note**: LED lighting and IR learning cannot be enabled simultaneously
  1600	  1508  
  1601	  1509  **Problem: "Learning session timeout"**
  1602	  1510  - **Cause**: No IR signal received within 60 seconds
  1603	  1511  - **Solution**: 
  1604	  1512    - Ensure remote has fresh batteries
  1605	  1513    - Point remote directly at IR receiver hole
  1606	  1514    - Hold button for 1-2 seconds
  1607	  1515    - Try again with stronger IR signal
  1608	  1516  
  1609	  1517  **Problem: "Connection error"**
  1610	  1518  - **Cause**: Cannot connect to Global Cache device
  1611	  1519  - **Solution**:
  1612	  1520    - Verify device is powered on
  1613	  1521    - Check network connectivity
  1614	  1522    - Test device in Device Management tab
  1615	  1523    - Verify IP address and port are correct
  1616	  1524  
  1617	  1525  **Problem: "IR code not working after learning"**
  1618	  1526  - **Cause**: Weak or incomplete IR signal captured
  1619	  1527  - **Solution**:
  1620	  1528    - Learn code again with remote closer to device
  1621	  1529    - Ensure remote batteries are fresh
  1622	  1530    - Try holding button longer (1-2 seconds)
  1623	  1531    - Verify learned code is not truncated
  1624	  1532  
  1625	  1533  ### Comprehensive Logging
  1626	  1534  
  1627	  1535  All Global Cache operations include verbose logging for debugging and monitoring.
  1628	  1536  
  1629	  1537  #### Log Format
  1630	  1538  ```
  1631	  1539  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1632	  1540  🎓 [GLOBAL CACHE] Starting IR learning
  1633	  1541     Device ID: clx123abc...
  1634	  1542     Timestamp: 2025-10-17T12:34:56.789Z
  1635	  1543  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1636	  1544  ```
  1637	  1545  
  1638	  1546  #### Logged Operations
  1639	  1547  
  1640	  1548  **Device Management:**
  1641	  1549  - Device creation and deletion
  1642	  1550  - Connection testing
  1643	  1551  - Status updates
  1644	  1552  
  1645	  1553  **IR Learning:**
  1646	  1554  - Learning session start/stop
  1647	  1555  - Device connection attempts
  1648	  1556  - IR code capture events
  1649	  1557  - Learning timeouts and errors
  1650	  1558  - Code validation
  1651	  1559  
  1652	  1560  **Viewing Logs:**
  1653	  1561  
  1654	  1562  ```bash
  1655	  1563  # Real-time logs
  1656	  1564  pm2 logs sports-bar-tv | grep "GLOBAL CACHE"
  1657	  1565  
  1658	  1566  # Search logs
  1659	  1567  cat ~/.pm2/logs/sports-bar-tv-out.log | grep "GLOBAL CACHE"
  1660	  1568  
  1661	  1569  # Error logs only
  1662	  1570  cat ~/.pm2/logs/sports-bar-tv-error.log | grep "GLOBAL CACHE"
  1663	  1571  ```
  1664	  1572  
  1665	  1573  ### Database Schema
  1666	  1574  
  1667	  1575  ```prisma
  1668	  1576  model GlobalCacheDevice {
  1669	  1577    id          String              @id @default(cuid())
  1670	  1578    name        String
  1671	  1579    ipAddress   String              @unique
  1672	  1580    port        Int                 @default(4998)
  1673	  1581    model       String?
  1674	  1582    status      String              @default("offline")
  1675	  1583    lastSeen    DateTime?
  1676	  1584    ports       GlobalCachePort[]
  1677	  1585    createdAt   DateTime            @default(now())
  1678	  1586    updatedAt   DateTime            @updatedAt
  1679	  1587  }
  1680	  1588  
  1681	  1589  model GlobalCachePort {
  1682	  1590    id                String            @id @default(cuid())
  1683	  1591    deviceId          String
  1684	  1592    portNumber        Int
  1685	  1593    portType          String            @default("IR")
  1686	  1594    assignedTo        String?
  1687	  1595    assignedDeviceId  String?
  1688	  1596    irCodeSet         String?
  1689	  1597    enabled           Boolean           @default(true)
  1690	  1598  }
  1691	  1599  ```
  1692	  1600  
  1693	  1601  ### Integration with IR Devices
  1694	  1602  
  1695	  1603  Learned IR codes can be saved to IR devices for use in automated control:
  1696	  1604  
  1697	  1605  1. **Create IR Device** (Device Configuration → IR Devices tab)
  1698	  1606  2. **Add New Command** to IR device
  1699	  1607  3. **Paste Learned Code** into IR Code field
  1700	  1608  4. **Assign Function Name** (e.g., "POWER", "CHANNEL UP")
  1701	  1609  5. **Link to Global Cache Port** for transmission
  1702	  1610  6. **Test Command** to verify functionality
  1703	  1611  
  1704	  1612  ### Best Practices
  1705	  1613  
  1706	  1614  #### IR Learning
  1707	  1615  1. **Fresh Batteries**: Use remote controls with fresh batteries
  1708	  1616  2. **Close Proximity**: Hold remote 2-6 inches from IR receiver
  1709	  1617  3. **Direct Aim**: Point directly at IR receiver hole
  1710	  1618  4. **Button Hold**: Hold button for 1-2 seconds for best capture
  1711	  1619  5. **Verify Code**: Test learned code immediately after capture
  1712	  1620  6. **Document Codes**: Add descriptive function names
  1713	  1621  7. **Backup Codes**: Keep copies of working codes
  1714	  1622  
  1715	  1623  #### Device Management
  1716	  1624  1. **Static IPs**: Assign static IP addresses to Global Cache devices
  1717	  1625  2. **Network Isolation**: Place devices on same subnet as server
  1718	  1626  3. **Regular Testing**: Test device connectivity regularly
  1719	  1627  4. **Firmware Updates**: Keep device firmware up to date
  1720	  1628  5. **Port Organization**: Document which ports control which devices
  1721	  1629  
  1722	  1630  ### Limitations
  1723	  1631  
  1724	  1632  1. **IR Learning:**
  1725	  1633     - Cannot learn if device configured for LED lighting
  1726	  1634     - 60-second timeout per learning session
  1727	  1635     - One learning session at a time per device
  1728	  1636     - IR receiver location may vary by model
  1729	  1637  
  1730	  1638  2. **Device Support:**
  1731	  1639     - Requires iTach firmware with IR learning support
  1732	  1640     - Not all Global Cache models support IR learning
  1733	  1641     - WiFi models may have network latency
  1734	  1642  
  1735	  1643  3. **IR Code Quality:**
  1736	  1644     - Learned codes depend on original remote signal strength
  1737	  1645     - Some remotes use proprietary or non-standard IR protocols
  1738	  1646     - Complex codes may require multiple learning attempts
  1739	  1647  
  1740	  1648  ### Future Enhancements
  1741	  1649  
  1742	  1650  **Planned Features:**
  1743	  1651  - [ ] Bulk IR code learning with batch mode
  1744	  1652  - [ ] IR code library management and sharing
  1745	  1653  - [ ] Automatic IR device creation from learned codes
  1746	  1654  - [ ] IR code testing and verification tools
  1747	  1655  - [ ] Advanced code editing and manipulation
  1748	  1656  - [ ] Integration with IR device templates
  1749	  1657  
  1750	  1658  ### Support
  1751	  1659  
  1752	  1660  For issues with Global Cache devices or IR learning:
  1753	  1661  
  1754	  1662  **Device Issues:**
  1755	  1663  - Test connectivity in Device Management tab
  1756	  1664  - Check PM2 logs for errors
  1757	  1665  - Verify network configuration
  1758	  1666  - Review Global Cache API documentation
  1759	  1667  
  1760	  1668  **IR Learning Issues:**
  1761	  1669  - Check logs for detailed error messages
  1762	  1670  - Verify device is not in LED lighting mode
  1763	  1671  - Test with different remote controls
  1764	  1672  - Contact Global Cache support for hardware issues
  1765	  1673  
  1766	  1674  **Documentation:**
  1767	  1675  - Global Cache iTach API: See `global-cache-API-iTach.pdf`
  1768	  1676  - IR Database API: See `API-GlobalIRDB_ver1.pdf`
  1769	  1677  - System logs: `pm2 logs sports-bar-tv`
  1770	  1678  
  1771	  1679  ---
  1772	  1680  
  1773	  1681  ## 7. DirecTV Integration
  1774	  1682  
  1775	  1683  ### Overview
  1776	  1684  Integration with DirecTV receivers for sports bar TV control using the SHEF (Set-top Box HTTP Exported Functionality) protocol. The system allows adding, managing, and monitoring DirecTV receivers, retrieving device status and channel information, and routing them through the matrix switcher.
  1777	  1685  
  1778	  1686  ### SHEF Protocol Information
  1779	  1687  
  1780	  1688  **SHEF (Set-top Box HTTP Exported Functionality)**
  1781	  1689  - **Protocol Version:** 1.12 (current H24/100 receiver)
  1782	  1690  - **Documentation Version:** 1.3.C (October 2011)
  1783	  1691  - **Port:** 8080 (default HTTP API port)
  1784	  1692  - **Protocol:** HTTP REST API
  1785	  1693  - **Response Format:** JSON
  1786	  1694  
  1787	  1695  **Protocol Capabilities:**
  1788	  1696  - ✅ Device information (version, serial number, mode)
  1789	  1697  - ✅ Current channel and program information
  1790	  1698  - ✅ Remote control simulation (channel change, key presses)
  1791	  1699  - ✅ Program guide data for specific channels
  1792	  1700  - ✅ Device location information (multi-room setups)
  1793	  1701  
  1794	  1702  **Protocol Limitations:**
  1795	  1703  - ❌ NO subscription/package information
  1796	  1704  - ❌ NO account details or billing data
  1797	  1705  - ❌ NO entitled channels list
  1798	  1706  - ❌ NO premium package status
  1799	  1707  
  1800	  1708  **Why Subscription Data is Unavailable:**
  1801	  1709  The SHEF API is designed for device control, not account management. Subscription data lives in DirecTV's cloud systems and would require integration with DirecTV's official business API, which is separate from the receiver's local HTTP API.
  1802	  1710  
  1803	  1711  ### Current Status
  1804	  1712  **Last Updated:** October 15, 2025, 7:08 PM  
  1805	  1713  **Overall Status:** ✅ **FULLY FUNCTIONAL**  
  1806	  1714  **Working Features:** 
  1807	  1715  - ✅ Receiver management and configuration
  1808	  1716  - ✅ Device connectivity testing  
  1809	  1717  - ✅ Real-time device status monitoring
  1810	  1718  - ✅ Current channel and program information
  1811	  1719  - ✅ Device information display (receiver ID, access card, software version)
  1812	  1720  - ✅ Matrix switcher integration
  1813	  1721  
  1814	  1722  **Fix Applied (October 15, 2025):**
  1815	  1723  - Fixed subscription polling to correctly handle SHEF API limitations
  1816	  1724  - Removed incorrect logic that tried to parse API commands as subscription data
  1817	  1725  - Now displays real device information instead of attempting to fetch unavailable subscription data
  1818	  1726  - Shows receiver ID, access card ID, current channel, and program information
  1819	  1727  
  1820	  1728  ### SHEF API Endpoints
  1821	  1729  
  1822	  1730  The DirecTV SHEF protocol provides the following HTTP endpoints on port 8080:
  1823	  1731  
  1824	  1732  #### Device Information Endpoints
  1825	  1733  
  1826	  1734  **GET `/info/getVersion`**
  1827	  1735  - Returns device version, receiver ID, access card ID, software version, and SHEF API version
  1828	  1736  - Example: `http://192.168.5.121:8080/info/getVersion`
  1829	  1737  - Response includes: `receiverId`, `accessCardId`, `stbSoftwareVersion`, `version`, `systemTime`
  1830	  1738  
  1831	  1739  **GET `/info/getSerialNum`**
  1832	  1740  - Returns device serial number
  1833	  1741  - Example: `http://192.168.5.121:8080/info/getSerialNum`
  1834	  1742  
  1835	  1743  **GET `/info/mode`**
  1836	  1744  - Returns device operational mode (0 = active, other values = standby/off)
  1837	  1745  - Example: `http://192.168.5.121:8080/info/mode`
  1838	  1746  
  1839	  1747  **GET `/info/getLocations`**
  1840	  1748  - Lists available client locations for multi-room setups
  1841	  1749  - Example: `http://192.168.5.121:8080/info/getLocations`
  1842	  1750  
  1843	  1751  **GET `/info/getOptions`**
  1844	  1752  - Returns list of available API commands (NOT subscription data)
  1845	  1753  - This endpoint was previously misunderstood to provide subscription information
  1846	  1754  - Actually returns a list of API endpoints with their descriptions and parameters
  1847	  1755  - Example: `http://192.168.5.121:8080/info/getOptions`
  1848	  1756  
  1849	  1757  #### TV Control Endpoints
  1850	  1758  
  1851	  1759  **GET `/tv/getTuned`**
  1852	  1760  - Returns currently tuned channel and program information
  1853	  1761  - Example: `http://192.168.5.121:8080/tv/getTuned`
  1854	  1762  - Response includes: `major`, `minor`, `callsign`, `title`, `programId`, `rating`, etc.
  1855	  1763  
  1856	  1764  **GET `/tv/getProgInfo?major=<channel>&time=<timestamp>`**
  1857	  1765  - Returns program information for a specific channel at a given time
  1858	  1766  - Parameters: `major` (required), `minor` (optional), `time` (optional)
  1859	  1767  - Example: `http://192.168.5.121:8080/tv/getProgInfo?major=202`
  1860	  1768  
  1861	  1769  **GET `/tv/tune?major=<channel>&minor=<subchannel>`**
  1862	  1770  - Tunes to a specific channel
  1863	  1771  - Parameters: `major` (required), `minor` (optional)
  1864	  1772  - Example: `http://192.168.5.121:8080/tv/tune?major=202`
  1865	  1773  
  1866	  1774  #### Remote Control Endpoints
  1867	  1775  
  1868	  1776  **GET `/remote/processKey?key=<keyname>`**
  1869	  1777  - Simulates pressing a remote control button
  1870	  1778  - Parameters: `key` (required) - button name (e.g., "power", "menu", "chanup", "chandown")
  1871	  1779  - Example: `http://192.168.5.121:8080/remote/processKey?key=power`
  1872	  1780  - Available keys: power, poweron, poweroff, format, pause, rew, replay, stop, advance, ffwd, record, play, guide, active, list, exit, back, menu, info, up, down, left, right, select, red, green, yellow, blue, chanup, chandown, prev, 0-9, dash, enter
  1873	  1781  
  1874	  1782  **GET `/serial/processCommand?cmd=<hex_command>`**
  1875	  1783  - Sends a raw serial command to the receiver (advanced users only)
  1876	  1784  - Parameters: `cmd` (required) - hexadecimal command string
  1877	  1785  
  1878	  1786  #### Deprecated Endpoints (Do Not Use)
  1879	  1787  
  1880	  1788  **GET `/dvr/getPlaylist`** - Deprecated in SHEF v1.3.C
  1881	  1789  **GET `/dvr/play`** - Deprecated in SHEF v1.3.C
  1882	  1790  
  1883	  1791  ### Features
  1884	  1792  
  1885	  1793  #### Receiver Management
  1886	  1794  - **Add DirecTV Receivers:** Configure receivers with IP address, port, and receiver type
  1887	  1795  - **Matrix Integration:** Assign receivers to specific matrix input channels (1-32)
  1888	  1796  - **Connection Testing:** Test connectivity to DirecTV receivers
  1889	  1797  - **Subscription Data:** Retrieve active subscriptions and sports packages
  1890	  1798  - **Status Monitoring:** Real-time connection status indicators
  1891	  1799  
  1892	  1800  #### Receiver Configuration
  1893	  1801  - **Device Name:** Custom label for identification
  1894	  1802  - **IP Address:** Network address of DirecTV receiver
  1895	  1803  - **Port:** Default 8080 (DirecTV API port)
  1896	  1804  - **Receiver Type:** Genie HD DVR, HR24, etc.
  1897	  1805  - **Matrix Input Channel:** SELECT dropdown with 32 input channels
  1898	  1806    - Format: "Input 1: Cable Box 1 (Cable Box)"
  1899	  1807    - Links receiver to specific matrix input for routing
  1900	  1808  
  1901	  1809  ### Testing Results (October 15, 2025)
  1902	  1810  
  1903	  1811  #### ✅ Successful Operations
  1904	  1812  
  1905	  1813  **1. Receiver Creation (PASSED)**
  1906	  1814  - Successfully created DirecTV receivers with full configuration
  1907	  1815  - Matrix Input Channel field is functional as SELECT dropdown
  1908	  1816  - All 32 matrix input channels available in dropdown
  1909	  1817  - Receiver appears in UI with proper configuration
  1910	  1818  - Status indicator shows "Connected" (green checkmark)
  1911	  1819  
  1912	  1820  **2. Receiver Deletion (PASSED)**
  1913	  1821  - Successfully removed multiple receivers (tested with 9 receivers)
  1914	  1822  - Deletion confirmation dialog appears for each receiver
  1915	  1823  - Each deletion processed successfully
  1916	  1824  - UI updates correctly after each deletion
  1917	  1825  
  1918	  1826  **3. Form Validation (PASSED)**
  1919	  1827  - IP address validation working correctly
  1920	  1828  - Port number validation (default 8080)
  1921	  1829  - Matrix input channel selection functional
  1922	  1830  - All form fields properly integrated with React state
  1923	  1831  
  1924	  1832  #### ❌ Failed Operations & Known Issues
  1925	  1833  
  1926	  1834  **1. Subscription Data Retrieval (FAILED)**
  1927	  1835  - **Status:** ❌ FAILS when no physical receiver present
  1928	  1836  - **Error Message:** "Polling Failed - Unable to connect to DirecTV receiver"
  1929	  1837  - **Dialog Display:**
  1930	  1838    - Title: "Device Subscriptions - [Receiver Name]"
  1931	  1839    - Error Badge: Red "Error" indicator
  1932	  1840    - Error Message: "Polling Failed - Unable to connect to DirecTV receiver"
  1933	  1841    - Active Subscriptions: 0
  1934	  1842    - Sports Packages: 0
  1935	  1843    - Last Updated: Timestamp
  1936	  1844  
  1937	  1845  **2. Connection Test Results**
  1938	  1846  - **Visual Indicator:** Shows "Connected" (green) in UI
  1939	  1847  - **Actual Status:** Cannot verify without physical hardware
  1940	  1848  - **Limitation:** UI may show connected even when receiver is unreachable
  1941	  1849  
  1942	  1850  ### Error Messages & Diagnostics
  1943	  1851  
  1944	  1852  #### Subscription Polling Error
  1945	  1853  ```
  1946	  1854  Error: Unable to connect to DirecTV receiver
  1947	  1855  Status: Polling Failed
  1948	  1856  Active Subscriptions: 0
  1949	  1857  Sports Packages: 0
  1950	  1858  Timestamp: [Date/Time of polling attempt]
  1951	  1859  ```
  1952	  1860  
  1953	  1861  **Root Causes:**
  1954	  1862  1. **No Physical Device:** IP address has no actual DirecTV receiver
  1955	  1863  2. **Network Connectivity:** Receiver unreachable from server network
  1956	  1864  3. **Receiver Offline:** Device powered off or disconnected
  1957	  1865  4. **Firewall/Port Blocking:** Port 8080 blocked by network firewall
  1958	  1866  5. **API Endpoint Issue:** Backend API connection problems
  1959	  1867  
  1960	  1868  #### Form Input Handling Issues
  1961	  1869  During testing, direct typing in React form fields did not update state properly. Workaround implemented using native JavaScript:
  1962	  1870  
  1963	  1871  ```javascript
  1964	  1872  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  1965	  1873    window.HTMLInputElement.prototype, "value"
  1966	  1874  ).set;
  1967	  1875  nativeInputValueSetter.call(inputElement, 'value');
  1968	  1876  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  1969	  1877  ```
  1970	  1878  
  1971	  1879  ### Verbose Logging Implementation
  1972	  1880  
  1973	  1881  The DirecTV system includes comprehensive logging for debugging and monitoring:
  1974	  1882  
  1975	  1883  #### Log Locations
  1976	  1884  - **PM2 Logs:** `pm2 logs sports-bar-tv`
  1977	  1885  - **Log Files:** `/home/ubuntu/.pm2/logs/`
  1978	  1886    - `sports-bar-tv-out.log` - Standard output
  1979	  1887    - `sports-bar-tv-error.log` - Error output
  1980	  1888  
  1981	  1889  #### Logged Operations
  1982	  1890  
  1983	  1891  **Receiver Creation:**
  1984	  1892  ```
  1985	  1893  [DirecTV] Creating new receiver: Test DirecTV
  1986	  1894  [DirecTV] IP: 192.168.5.121, Port: 8080
  1987	  1895  [DirecTV] Matrix Channel: 1 (Input 1: Cable Box 1)
  1988	  1896  [DirecTV] Receiver created successfully
  1989	  1897  ```
  1990	  1898  
  1991	  1899  **Connection Testing:**
  1992	  1900  ```
  1993	  1901  [DirecTV] Testing connection to 192.168.5.121:8080
  1994	  1902  [DirecTV] Connection attempt: [SUCCESS/FAILED]
  1995	  1903  [DirecTV] Response time: [X]ms
  1996	  1904  ```
  1997	  1905  
  1998	  1906  **Subscription Polling:**
  1999	  1907  ```
  2000	  1908  [DirecTV] Polling subscriptions for receiver: Test DirecTV
  2001	  1909  [DirecTV] API endpoint: http://192.168.5.121:8080/api/subscriptions
  2002	  1910  [DirecTV] ERROR: Unable to connect to DirecTV receiver
  2003	  1911  [DirecTV] Error details: [Connection timeout/Network unreachable/etc.]
  2004	  1912  ```
  2005	  1913  
  2006	  1914  **Receiver Deletion:**
  2007	  1915  ```
  2008	  1916  [DirecTV] Deleting receiver: Test DirecTV (ID: xxx)
  2009	  1917  [DirecTV] Receiver deleted successfully
  2010	  1918  ```
  2011	  1919  
  2012	  1920  #### Accessing Logs
  2013	  1921  
  2014	  1922  **View Real-time Logs:**
  2015	  1923  ```bash
  2016	  1924  pm2 logs sports-bar-tv
  2017	  1925  ```
  2018	  1926  
  2019	  1927  **View Specific Log File:**
  2020	  1928  ```bash
  2021	  1929  tail -f ~/.pm2/logs/sports-bar-tv-out.log
  2022	  1930  tail -f ~/.pm2/logs/sports-bar-tv-error.log
  2023	  1931  ```
  2024	  1932  
  2025	  1933  **Search Logs for DirecTV Events:**
  2026	  1934  ```bash
  2027	  1935  pm2 logs sports-bar-tv | grep DirecTV
  2028	  1936  cat ~/.pm2/logs/sports-bar-tv-out.log | grep "DirecTV"
  2029	  1937  ```
  2030	  1938  
  2031	  1939  ### UI Components & Behavior
  2032	  1940  
  2033	  1941  #### Receiver Card Interface
  2034	  1942  When a DirecTV receiver is selected, three action buttons appear:
  2035	  1943  
  2036	  1944  1. **Purple Button (Leftmost):** Retrieve subscription data
  2037	  1945  2. **Blue Button (Middle):** Additional functionality (TBD)
  2038	  1946  3. **Red/Orange Button (Rightmost):** Delete receiver
  2039	  1947  
  2040	  1948  #### Status Indicators
  2041	  1949  - **Green Checkmark:** "Connected" status
  2042	  1950  - **Red Badge:** Error or disconnected status
  2043	  1951  - **Loading Spinner:** Operation in progress
  2044	  1952  
  2045	  1953  #### Matrix Input Channel Field
  2046	  1954  - **Type:** SELECT dropdown (not text input)
  2047	  1955  - **Position:** Second select element in form
  2048	  1956  - **Options:** 32 channels with descriptive labels
  2049	  1957  - **Value Format:** String numbers "1" through "32"
  2050	  1958  - **Label Format:** "Input [N]: [Label] ([Type])"
  2051	  1959  
  2052	  1960  ### API Endpoints
  2053	  1961  
  2054	  1962  #### POST `/api/directv/receivers`
  2055	  1963  Create a new DirecTV receiver configuration.
  2056	  1964  
  2057	  1965  **Request Body:**
  2058	  1966  ```json
  2059	  1967  {
  2060	  1968    "deviceName": "Test DirecTV",
  2061	  1969    "ipAddress": "192.168.5.121",
  2062	  1970    "port": 8080,
  2063	  1971    "receiverType": "Genie HD DVR",
  2064	  1972    "matrixInputChannel": 1
  2065	  1973  }
  2066	  1974  ```
  2067	  1975  
  2068	  1976  **Response:**
  2069	  1977  ```json
  2070	  1978  {
  2071	  1979    "success": true,
  2072	  1980    "receiver": {
  2073	  1981      "id": "xxx",
  2074	  1982      "deviceName": "Test DirecTV",
  2075	  1983      "ipAddress": "192.168.5.121",
  2076	  1984      "port": 8080,
  2077	  1985      "receiverType": "Genie HD DVR",
  2078	  1986      "matrixInputChannel": 1,
  2079	  1987      "connected": true,
  2080	  1988      "createdAt": "2025-10-15T18:10:00.000Z"
  2081	  1989    }
  2082	  1990  }
  2083	  1991  ```
  2084	  1992  
  2085	  1993  #### GET `/api/directv/receivers`
  2086	  1994  Retrieve all configured DirecTV receivers.
  2087	  1995  
  2088	  1996  #### DELETE `/api/directv/receivers/[id]`
  2089	  1997  Delete a specific DirecTV receiver.
  2090	  1998  
  2091	  1999  #### POST `/api/directv/test-connection`
  2092	  2000  Test connection to a DirecTV receiver.
  2093	  2001  
  2094	  2002  **Request Body:**
  2095	  2003  ```json
  2096	  2004  {
  2097	  2005    "receiverId": "xxx"
  2098	  2006  }
  2099	  2007  ```
  2100	  2008  
  2101	  2009  **Response:**
  2102	  2010  ```json
  2103	  2011  {
  2104	  2012    "success": true,
  2105	  2013    "connected": true,
  2106	  2014    "responseTime": 45
  2107	  2015  }
  2108	  2016  ```
  2109	  2017  
  2110	  2018  #### POST `/api/directv/subscriptions`
  2111	  2019  Retrieve subscription data from DirecTV receiver.
  2112	  2020  
  2113	  2021  **Request Body:**
  2114	  2022  ```json
  2115	  2023  {
  2116	  2024    "receiverId": "xxx"
  2117	  2025  }
  2118	  2026  ```
  2119	  2027  
  2120	  2028  **Response (Success):**
  2121	  2029  ```json
  2122	  2030  {
  2123	  2031    "success": true,
  2124	  2032    "activeSubscriptions": 150,
  2125	  2033    "sportsPackages": 12,
  2126	  2034    "packages": [
  2127	  2035      {"name": "NFL Sunday Ticket", "active": true},
  2128	  2036      {"name": "NBA League Pass", "active": true}
  2129	  2037    ],
  2130	  2038    "lastUpdated": "2025-10-15T18:10:26.000Z"
  2131	  2039  }
  2132	  2040  ```
  2133	  2041  
  2134	  2042  **Response (Error):**
  2135	  2043  ```json
  2136	  2044  {
  2137	  2045    "success": false,
  2138	  2046    "error": "Unable to connect to DirecTV receiver",
  2139	  2047    "activeSubscriptions": 0,
  2140	  2048    "sportsPackages": 0,
  2141	  2049    "lastUpdated": "2025-10-15T18:10:26.000Z"
  2142	  2050  }
  2143	  2051  ```
  2144	  2052  
  2145	  2053  ### Database Schema
  2146	  2054  
  2147	  2055  ```prisma
  2148	  2056  model DirecTVReceiver {
  2149	  2057    id                  String   @id @default(cuid())
  2150	  2058    deviceName          String
  2151	  2059    ipAddress           String
  2152	  2060    port                Int      @default(8080)
  2153	  2061    receiverType        String
  2154	  2062    matrixInputChannel  Int
  2155	  2063    connected           Boolean  @default(false)
  2156	  2064    lastConnected       DateTime?
  2157	  2065    activeSubscriptions Int?
  2158	  2066    sportsPackages      Int?
  2159	  2067    lastPolled          DateTime?
  2160	  2068    createdAt           DateTime @default(now())
  2161	  2069    updatedAt           DateTime @updatedAt
  2162	  2070    
  2163	  2071    @@unique([ipAddress, port])
  2164	  2072  }
  2165	  2073  ```
  2166	  2074  
  2167	  2075  ### Known Issues & Limitations
  2168	  2076  
  2169	  2077  #### 1. Physical Hardware Required
  2170	  2078  **Issue:** Subscription polling and advanced features require actual DirecTV hardware  
  2171	  2079  **Impact:** Cannot fully test or use subscription features without physical receiver  
  2172	  2080  **Workaround:** UI and management features work independently of hardware  
  2173	  2081  **Status:** EXPECTED BEHAVIOR - Not a bug
  2174	  2082  
  2175	  2083  #### 2. Connection Status Ambiguity
  2176	  2084  **Issue:** UI may show "Connected" status even when receiver is unreachable  
  2177	  2085  **Impact:** Users may be misled about actual device connectivity  
  2178	  2086  **Recommendation:** Implement periodic health checks and more accurate status reporting  
  2179	  2087  **Priority:** MEDIUM
  2180	  2088  
  2181	  2089  #### 3. Form Input React State Sync
  2182	  2090  **Issue:** Direct typing in form fields may not update React state  
  2183	  2091  **Impact:** Values may not save properly on form submission  
  2184	  2092  **Workaround:** Use native JavaScript input setter with event dispatch  
  2185	  2093  **Status:** Workaround implemented, consider fixing React state management  
  2186	  2094  **Priority:** LOW
  2187	  2095  
  2188	  2096  #### 4. Network Topology Dependency
  2189	  2097  **Issue:** Server must be on same network as DirecTV receivers  
  2190	  2098  **Impact:** Cannot manage receivers on different VLANs/subnets without routing  
  2191	  2099  **Recommendation:** Document network requirements, consider VPN/tunnel for remote access  
  2192	  2100  **Priority:** MEDIUM
  2193	  2101  
  2194	  2102  ### Troubleshooting Guide
  2195	  2103  
  2196	  2104  #### Problem: "Unable to connect to DirecTV receiver"
  2197	  2105  
  2198	  2106  **Diagnostic Steps:**
  2199	  2107  
  2200	  2108  1. **Verify Network Connectivity**
  2201	  2109     ```bash
  2202	  2110     # SSH into server
  2203	  2111     ssh -p 224 ubuntu@24.123.87.42
  2204	  2112     
  2205	  2113     # Test ping to receiver
  2206	  2114     ping 192.168.5.121
  2207	  2115     
  2208	  2116     # Test HTTP connectivity
  2209	  2117     curl http://192.168.5.121:8080
  2210	  2118     ```
  2211	  2119  
  2212	  2120  2. **Check Receiver Status**
  2213	  2121     - Verify DirecTV receiver is powered on
  2214	  2122     - Confirm receiver is connected to network
  2215	  2123     - Check receiver's IP address in network settings
  2216	  2124     - Verify receiver's network LED indicator
  2217	  2125  
  2218	  2126  3. **Validate Configuration**
  2219	  2127     - Confirm IP address is correct in UI
  2220	  2128     - Verify port number (should be 8080)
  2221	  2129     - Check receiver is configured for network control
  2222	  2130     - Ensure receiver firmware is up to date
  2223	  2131  
  2224	  2132  4. **Review Backend Logs**
  2225	  2133     ```bash
  2226	  2134     # Check PM2 logs for DirecTV errors
  2227	  2135     pm2 logs sports-bar-tv | grep DirecTV
  2228	  2136     
  2229	  2137     # Check last 50 lines of error log
  2230	  2138     tail -50 ~/.pm2/logs/sports-bar-tv-error.log
  2231	  2139     ```
  2232	  2140  
  2233	  2141  5. **Test Firewall/Port Access**
  2234	  2142     ```bash
  2235	  2143     # Test if port 8080 is accessible
  2236	  2144     telnet 192.168.5.121 8080
  2237	  2145     
  2238	  2146     # Or use nc (netcat)
  2239	  2147     nc -zv 192.168.5.121 8080
  2240	  2148     ```
  2241	  2149  
  2242	  2150  6. **Verify Network Routing**
  2243	  2151     ```bash
  2244	  2152     # Check routing table
  2245	  2153     route -n
  2246	  2154     
  2247	  2155     # Trace route to receiver
  2248	  2156     traceroute 192.168.5.121
  2249	  2157     ```
  2250	  2158  
  2251	  2159  #### Problem: Receiver shows "Connected" but subscription data fails
  2252	  2160  
  2253	  2161  **Possible Causes:**
  2254	  2162  - Connection test endpoint responds but subscription API doesn't
  2255	  2163  - Receiver authentication required for subscription data
  2256	  2164  - API endpoint path incorrect for receiver model
  2257	  2165  - Receiver doesn't support network subscription queries
  2258	  2166  
  2259	  2167  **Solutions:**
  2260	  2168  1. Review DirecTV receiver's network API documentation
  2261	  2169  2. Check if authentication/credentials required
  2262	  2170  3. Verify API endpoint paths for specific receiver model
  2263	  2171  4. Test with DirecTV's official API testing tools
  2264	  2172  
  2265	  2173  #### Problem: Form submission not saving values
  2266	  2174  
  2267	  2175  **Solution:**
  2268	  2176  1. Clear browser cache and reload page
  2269	  2177  2. Check browser console for JavaScript errors
  2270	  2178  3. Verify React state updates in browser DevTools
  2271	  2179  4. Use workaround with native input setters if needed
  2272	  2180  
  2273	  2181  #### Problem: Matrix input channel not routing correctly
  2274	  2182  
  2275	  2183  **Diagnostic Steps:**
  2276	  2184  1. Verify matrix input channel number is correct (1-32)
  2277	  2185  2. Check matrix switcher configuration in System Admin
  2278	  2186  3. Test matrix switching directly without DirecTV
  2279	  2187  4. Verify input channel is properly configured in matrix
  2280	  2188  
  2281	  2189  ### Recommendations for Production Use
  2282	  2190  
  2283	  2191  #### Network Configuration
  2284	  2192  1. **Isolated VLAN:** Place DirecTV receivers on dedicated VLAN
  2285	  2193  2. **Static IPs:** Assign static IP addresses to all receivers
  2286	  2194  3. **DNS Records:** Create DNS entries for receivers (e.g., directv-1.local)
  2287	  2195  4. **Port Forwarding:** Configure if receivers are on different subnet
  2288	  2196  
  2289	  2197  #### Monitoring & Maintenance
  2290	  2198  1. **Health Checks:** Implement periodic connection health checks (every 5 minutes)
  2291	  2199  2. **Status Alerts:** Send notifications when receivers go offline
  2292	  2200  3. **Log Rotation:** Ensure PM2 logs don't fill disk space
  2293	  2201  4. **Backup Configuration:** Backup receiver configurations daily
  2294	  2202  
  2295	  2203  #### Testing with Real Hardware
  2296	  2204  To properly test and use DirecTV features:
  2297	  2205  
  2298	  2206  1. **Acquire Compatible Receiver:**
  2299	  2207     - Genie HD DVR (HR44, HR54)
  2300	  2208     - HR24 HD DVR
  2301	  2209     - Or other network-enabled DirecTV receivers
  2302	  2210  
  2303	  2211  2. **Network Setup:**
  2304	  2212     - Connect receiver to network
  2305	  2213     - Assign static IP or create DHCP reservation
  2306	  2214     - Verify network connectivity from server
  2307	  2215  
  2308	  2216  3. **Receiver Configuration:**
  2309	  2217     - Enable network control in receiver settings
  2310	  2218     - Configure IP address and port
  2311	  2219     - Test receiver's web interface directly
  2312	  2220  
  2313	  2221  4. **Application Testing:**
  2314	  2222     - Add receiver with correct IP and settings
  2315	  2223     - Test connection functionality
  2316	  2224     - Verify subscription polling works
  2317	  2225     - Test matrix routing integration
  2318	  2226  
  2319	  2227  #### Security Considerations
  2320	  2228  1. **API Access:** Secure DirecTV API endpoints if exposed
  2321	  2229  2. **Network Segmentation:** Isolate receivers from guest networks
  2322	  2230  3. **Access Control:** Implement authentication for receiver management
  2323	  2231  4. **Audit Logging:** Log all receiver configuration changes
  2324	  2232  
  2325	  2233  ### Integration with Matrix Switcher
  2326	  2234  
  2327	  2235  DirecTV receivers integrate seamlessly with the Wolfpack HDMI matrix:
  2328	  2236  
  2329	  2237  1. **Configuration:** Assign receiver to specific matrix input channel
  2330	  2238  2. **Routing:** Route receiver to any TV output via matrix control
  2331	  2239  3. **Status:** Monitor receiver status alongside matrix outputs
  2332	  2240  4. **Control:** Manage receiver and routing from single interface
  2333	  2241  
  2334	  2242  **Example Workflow:**
  2335	  2243  1. Add DirecTV receiver on matrix input channel 5
  2336	  2244  2. Configure receiver as "Sports Bar DirecTV - Main"
  2337	  2245  3. Route to TV outputs as needed for sports events
  2338	  2246  4. Monitor connection status and subscriptions
  2339	  2247  5. Verify sports packages include desired channels
  2340	  2248  
  2341	  2249  ### Future Enhancements
  2342	  2250  
  2343	  2251  **Planned Features:**
  2344	  2252  - [ ] Implement periodic health checks with accurate status reporting
  2345	  2253  - [ ] Add receiver channel control (change channels remotely)
  2346	  2254  - [ ] Integrate with Sports Guide for auto-tuning
  2347	  2255  - [ ] Support multiple receiver types (clients, mini-Genies)
  2348	  2256  - [ ] Implement receiver discovery on network
  2349	  2257  - [ ] Add bulk receiver management
  2350	  2258  - [ ] Create receiver groups for simultaneous control
  2351	  2259  - [ ] Implement receiver event scheduling
  2352	  2260  
  2353	  2261  **Under Consideration:**
  2354	  2262  - Remote recording management
  2355	  2263  - DVR playlist integration
  2356	  2264  - Channel favorites sync
  2357	  2265  - Multi-receiver coordination
  2358	  2266  - Advanced diagnostic tools
  2359	  2267  
  2360	  2268  ---
  2361	  2269  
  2362	  2270  ## 8. IR Device Setup & Global Cache Integration
  2363	  2271  
  2364	  2272  ### Overview
  2365	  2273  **Version:** 1.0  
  2366	  2274  **Last Updated:** October 17, 2025  
  2367	  2275  **Status:** Production Ready
  2368	  2276  
  2369	  2277  The IR Device Setup system provides comprehensive management of infrared-controlled devices (cable boxes, satellite receivers, AV receivers, etc.) through Global Cache iTach IR control devices. This unified system allows users to configure IR devices, assign them to Global Cache devices and ports, and control them remotely.
  2370	  2278  
  2371	  2279  ### System Architecture
  2372	  2280  
  2373	  2281  #### Components
  2374	  2282  
  2375	  2283  1. **Global Cache iTach Devices**
  2376	  2284     - Network-connected IR blasters
  2377	  2285     - Support 3 IR ports per device
  2378	  2286     - TCP communication on port 4998
  2379	  2287     - Status monitoring and health checks
  2380	  2288  
  2381	  2289  2. **IR Devices**
  2382	  2290     - Physical devices to be controlled (cable boxes, receivers, etc.)
  2383	  2291     - Each device linked to a specific Global Cache device and port
  2384	  2292     - Matrix switcher integration for video routing
  2385	  2293     - IR command database integration
  2386	  2294  
  2387	  2295  3. **IR Command Database**
  2388	  2296     - Global Cache online IR code database
  2389	  2297     - Thousands of device codesets
  2390	  2298     - Search by brand/model
  2391	  2299     - Automatic command download
  2392	  2300  
  2393	  2301  ### Features
  2394	  2302  
  2395	  2303  #### Global Cache Device Management
  2396	  2304  - **Add/Remove Devices**: Configure Global Cache iTach devices with IP address and port
  2397	  2305  - **Connection Testing**: Test connectivity to devices
  2398	  2306  - **Port Configuration**: Manage 3 IR ports per device
  2399	  2307  - **Status Monitoring**: Real-time online/offline status
  2400	  2308  - **Port Assignment**: Track which IR device is assigned to each port
  2401	  2309  
  2402	  2310  #### IR Device Configuration
  2403	  2311  - **Device Creation**: Add IR devices with:
  2404	  2312    - Name (e.g., "Cable Box 1")
  2405	  2313    - Type (Cable Box, Satellite, AV Receiver, etc.)
  2406	  2314    - Brand (e.g., "DirecTV", "Dish", "Denon")
  2407	  2315    - Model (optional)
  2408	  2316    - Global Cache device selection (dropdown)
  2409	  2317    - Port number selection (dropdown, filtered by device)
  2410	  2318    - Matrix input channel (optional)
  2411	  2319    - Description (optional)
  2412	  2320  
  2413	  2321  - **Edit Functionality**: Modify existing IR device configurations
  2414	  2322  - **Delete Functionality**: Remove IR devices with confirmation
  2415	  2323  - **IR Database Integration**: Search and download IR codes from Global Cache database
  2416	  2324  - **Command Management**: View and organize IR commands per device
  2417	  2325  
  2418	  2326  #### Verbose Logging
  2419	  2327  All operations include comprehensive console logging:
  2420	  2328  - Component mounting and initialization
  2421	  2329  - Device loading and counts
  2422	  2330  - Global Cache device selection
  2423	  2331  - Port selection changes
  2424	  2332  - Add/Update/Delete operations
  2425	  2333  - API calls and responses
  2426	  2334  - Error handling with detailed messages
  2427	  2335  
  2428	  2336  ### API Endpoints
  2429	  2337  
  2430	  2338  #### Global Cache Devices
  2431	  2339  
  2432	  2340  **GET `/api/globalcache/devices`**
  2433	  2341  - List all Global Cache devices with ports
  2434	  2342  - Returns device status, IP address, port info
  2435	  2343  
  2436	  2344  **POST `/api/globalcache/devices`**
  2437	  2345  - Add new Global Cache device
  2438	  2346  - Tests connection during creation
  2439	  2347  - Creates 3 IR ports automatically
  2440	  2348  
  2441	  2349  **DELETE `/api/globalcache/devices/[id]`**
  2442	  2350  - Remove Global Cache device
  2443	  2351  - Cascades to delete port assignments
  2444	  2352  
  2445	  2353  #### IR Devices
  2446	  2354  
  2447	  2355  **GET `/api/ir/devices`**
  2448	  2356  - List all IR devices
  2449	  2357  - Includes ports, commands, and Global Cache assignments
  2450	  2358  - Comprehensive logging
  2451	  2359  
  2452	  2360  **POST `/api/ir/devices`**
  2453	  2361  - Create new IR device
  2454	  2362  - Accepts globalCacheDeviceId and globalCachePortNumber
  2455	  2363  - Validates required fields (name, deviceType, brand)
  2456	  2364  - Logs all operations
  2457	  2365  
  2458	  2366  **PUT `/api/ir/devices/[id]`**
  2459	  2367  - Update existing IR device
  2460	  2368  - Supports partial updates
  2461	  2369  - Logs changes with before/after values
  2462	  2370  
  2463	  2371  **DELETE `/api/ir/devices/[id]`**
  2464	  2372  - Remove IR device
  2465	  2373  - Deletes associated commands
  2466	  2374  - Requires confirmation
  2467	  2375  
  2468	  2376  #### IR Commands
  2469	  2377  
  2470	  2378  **GET `/api/ir/database/brands`**
  2471	  2379  - Search IR database for device brands
  2472	  2380  
  2473	  2381  **GET `/api/ir/database/models`**
  2474	  2382  - Get models for specific brand
  2475	  2383  
  2476	  2384  **POST `/api/ir/database/download`**
  2477	  2385  - Download IR commands for device
  2478	  2386  - Saves to database linked to IR device
  2479	  2387  
  2480	  2388  ### Database Schema
  2481	  2389  
  2482	  2390  #### GlobalCacheDevice
  2483	  2391  ```prisma
  2484	  2392  model GlobalCacheDevice {
  2485	  2393    id          String              @id @default(cuid())
  2486	  2394    name        String
  2487	  2395    ipAddress   String              @unique
  2488	  2396    port        Int                 @default(4998)
  2489	  2397    model       String?
  2490	  2398    status      String              @default("offline")
  2491	  2399    lastSeen    DateTime?
  2492	  2400    ports       GlobalCachePort[]
  2493	  2401    createdAt   DateTime            @default(now())
  2494	  2402    updatedAt   DateTime            @updatedAt
  2495	  2403  }
  2496	  2404  ```
  2497	  2405  
  2498	  2406  #### GlobalCachePort
  2499	  2407  ```prisma
  2500	  2408  model GlobalCachePort {
  2501	  2409    id                String            @id @default(cuid())
  2502	  2410    deviceId          String
  2503	  2411    device            GlobalCacheDevice @relation(...)
  2504	  2412    portNumber        Int
  2505	  2413    portType          String            @default("IR")
  2506	  2414    assignedTo        String?
  2507	  2415    assignedDeviceId  String?
  2508	  2416    enabled           Boolean           @default(true)
  2509	  2417    irDevice          IRDevice?         @relation(...)
  2510	  2418    createdAt         DateTime          @default(now())
  2511	  2419    updatedAt         DateTime          @updatedAt
  2512	  2420  }
  2513	  2421  ```
  2514	  2422  
  2515	  2423  #### IRDevice
  2516	  2424  ```prisma
  2517	  2425  model IRDevice {
  2518	  2426    id                    String              @id @default(cuid())
  2519	  2427    name                  String
  2520	  2428    deviceType            String
  2521	  2429    brand                 String
  2522	  2430    model                 String?
  2523	  2431    matrixInput           Int?
  2524	  2432    matrixInputLabel      String?
  2525	  2433    irCodeSetId           String?
  2526	  2434    globalCacheDeviceId   String?             // NEW FIELD
  2527	  2435    globalCachePortNumber Int?                // NEW FIELD
  2528	  2436    description           String?
  2529	  2437    status                String              @default("active")
  2530	  2438    ports                 GlobalCachePort[]
  2531	  2439    commands              IRCommand[]
  2532	  2440    createdAt             DateTime            @default(now())
  2533	  2441    updatedAt             DateTime            @updatedAt
  2534	  2442  }
  2535	  2443  ```
  2536	  2444  
  2537	  2445  #### IRCommand
  2538	  2446  ```prisma
  2539	  2447  model IRCommand {
  2540	  2448    id                String    @id @default(cuid())
  2541	  2449    deviceId          String
  2542	  2450    device            IRDevice  @relation(...)
  2543	  2451    functionName      String
  2544	  2452    irCode            String
  2545	  2453    category          String?
  2546	  2454    description       String?
  2547	  2455    createdAt         DateTime  @default(now())
  2548	  2456    updatedAt         DateTime  @updatedAt
  2549	  2457  }
  2550	  2458  ```
  2551	  2459  
  2552	  2460  ### User Interface
  2553	  2461  
  2554	  2462  #### Device Configuration Page (`/device-config`)
  2555	  2463  - **Two Tabs**:
  2556	  2464    1. **Global Cache**: Manage Global Cache iTach devices
  2557	  2465    2. **IR Devices**: Configure IR-controlled devices
  2558	  2466  
  2559	  2467  #### IR Device Setup Interface
  2560	  2468  
  2561	  2469  **Add/Edit Form Fields:**
  2562	  2470  - Device Name* (required)
  2563	  2471  - Device Type* (dropdown: Cable Box, Satellite, AV Receiver, etc.)
  2564	  2472  - Brand* (required)
  2565	  2473  - Model (optional)
  2566	  2474  - **Global Cache Device** (dropdown with device name, IP, status)
  2567	  2475  - **Port Number** (dropdown, shows Port 1-3, filtered by selected device)
  2568	  2476  - Matrix Input Channel (optional)
  2569	  2477  - Matrix Input Label (optional)
  2570	  2478  - Description (optional)
  2571	  2479  
  2572	  2480  **Device Cards Display:**
  2573	  2481  - Device name, brand, model, type
  2574	  2482  - Command count badge
  2575	  2483  - Global Cache device name
  2576	  2484  - Global Cache port number
  2577	  2485  - Matrix input information
  2578	  2486  - Codeset ID
  2579	  2487  - Description
  2580	  2488  - Available commands (first 10 shown)
  2581	  2489  - Action buttons:
  2582	  2490    - IR Database (search and download codes)
  2583	  2491    - Edit (modify configuration)
  2584	  2492    - Delete (remove device)
  2585	  2493  
  2586	  2494  ### Workflow
  2587	  2495  
  2588	  2496  #### Adding a New IR Device
  2589	  2497  
  2590	  2498  1. **Navigate to Device Configuration** (`/device-config`)
  2591	  2499  2. **Switch to IR Devices Tab**
  2592	  2500  3. **Click "Add IR Device"**
  2593	  2501  4. **Fill in device information**:
  2594	  2502     - Name: "Cable Box 1"
  2595	  2503     - Type: "Cable Box"
  2596	  2504     - Brand: "Spectrum"
  2597	  2505     - Model: "DCX3600" (optional)
  2598	  2506  5. **Select Global Cache Device**:
  2599	  2507     - Choose from dropdown: "GC iTach 1 (192.168.5.110) - online"
  2600	  2508     - Port dropdown activates
  2601	  2509  6. **Select Port Number**:
  2602	  2510     - Choose "Port 1 (IR)" or "Port 2 (IR)" or "Port 3 (IR)"
  2603	  2511     - Shows if port is already assigned
  2604	  2512  7. **Optionally set Matrix Input**:
  2605	  2513     - Channel: 5
  2606	  2514     - Label: "Cable"
  2607	  2515  8. **Add Description** (optional)
  2608	  2516  9. **Click "Add Device"**
  2609	  2517  10. **Device appears in list** with all configured details
  2610	  2518  
  2611	  2519  #### Downloading IR Codes
  2612	  2520  
  2613	  2521  1. **Click "IR Database" button** on device card
  2614	  2522  2. **Search for device** by brand and model
  2615	  2523  3. **Select codeset** from results
  2616	  2524  4. **Download commands** to device
  2617	  2525  5. **Commands appear** in device card
  2618	  2526  
  2619	  2527  #### Editing an IR Device
  2620	  2528  
  2621	  2529  1. **Click "Edit" button** on device card
  2622	  2530  2. **Form pre-fills** with current values
  2623	  2531  3. **Modify any fields**:
  2624	  2532     - Change Global Cache device
  2625	  2533     - Switch port number
  2626	  2534     - Update matrix channel
  2627	  2535  4. **Click "Update Device"**
  2628	  2536  5. **Device updates** immediately
  2629	  2537  
  2630	  2538  ### Console Logging Examples
  2631	  2539  
  2632	  2540  #### Component Mount
  2633	  2541  ```
  2634	  2542  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2635	  2543  🔌 [IR DEVICE SETUP] Component mounted
  2636	  2544     Timestamp: 2025-10-17T10:30:00.000Z
  2637	  2545  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2638	  2546  ```
  2639	  2547  
  2640	  2548  #### Loading Devices
  2641	  2549  ```
  2642	  2550  📋 [IR DEVICE SETUP] Loading IR devices...
  2643	  2551  ✅ [IR DEVICE SETUP] IR devices loaded: 3
  2644	  2552  📡 [IR DEVICE SETUP] Loading Global Cache devices...
  2645	  2553  ✅ [IR DEVICE SETUP] Global Cache devices loaded: 2
  2646	  2554  ```
  2647	  2555  
  2648	  2556  #### Adding Device
  2649	  2557  ```
  2650	  2558  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2651	  2559  ➕ [IR DEVICE SETUP] Adding new device
  2652	  2560     Name: Cable Box 1
  2653	  2561     Type: Cable Box
  2654	  2562     Brand: Spectrum
  2655	  2563     Global Cache Device: cm1234567890
  2656	  2564     Global Cache Port: 1
  2657	  2565  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2658	  2566  ```
  2659	  2567  
  2660	  2568  #### API Response
  2661	  2569  ```
  2662	  2570  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2663	  2571  ➕ [IR DEVICES] Creating new IR device
  2664	  2572     Timestamp: 2025-10-17T10:30:00.000Z
  2665	  2573  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2666	  2574     Name: Cable Box 1
  2667	  2575     Type: Cable Box
  2668	  2576     Brand: Spectrum
  2669	  2577     Model: DCX3600
  2670	  2578     Global Cache Device: cm1234567890
  2671	  2579     Global Cache Port: 1
  2672	  2580  ✅ [IR DEVICES] Device created successfully
  2673	  2581     ID: clm9876543210
  2674	  2582  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2675	  2583  ```
  2676	  2584  
  2677	  2585  ### Troubleshooting
  2678	  2586  
  2679	  2587  #### Issue: No Global Cache devices in dropdown
  2680	  2588  
  2681	  2589  **Solution:**
  2682	  2590  1. Navigate to Global Cache tab
  2683	  2591  2. Add Global Cache iTach device with IP address
  2684	  2592  3. Test connection
  2685	  2593  4. Return to IR Devices tab
  2686	  2594  5. Refresh page if needed
  2687	  2595  
  2688	  2596  #### Issue: Port dropdown is disabled
  2689	  2597  
  2690	  2598  **Solution:**
  2691	  2599  1. Select a Global Cache device first
  2692	  2600  2. Port dropdown will activate automatically
  2693	  2601  3. Ports are filtered to show only enabled ports on selected device
  2694	  2602  
  2695	  2603  #### Issue: Device not controlling IR equipment
  2696	  2604  
  2697	  2605  **Diagnostic Steps:**
  2698	  2606  1. Verify Global Cache device is online (check status in Global Cache tab)
  2699	  2607  2. Confirm correct port number is selected
  2700	  2608  3. Test Global Cache connection manually
  2701	  2609  4. Ensure IR emitter is connected to correct port
  2702	  2610  5. Download IR codes from database if not done
  2703	  2611  6. Test IR commands through API
  2704	  2612  
  2705	  2613  #### Issue: IR codes not working
  2706	  2614  
  2707	  2615  **Solution:**
  2708	  2616  1. Try downloading different codeset from IR database
  2709	  2617  2. Verify IR emitter is positioned correctly near device IR sensor
  2710	  2618  3. Check for IR interference from other sources
  2711	  2619  4. Test Global Cache device with other commands
  2712	  2620  
  2713	  2621  #### Issue: "Argument `irCode` is missing" error when downloading IR codes
  2714	  2622  
  2715	  2623  **Error Message:**
  2716	  2624  ```
  2717	  2625  ❌ Error downloading VOLUME UP: 
  2718	  2626  Invalid `prisma.iRCommand.create()` invocation:
  2719	  2627  {
  2720	  2628    data: {
  2721	  2629      deviceId: "...",
  2722	  2630      functionName: "VOLUME UP",
  2723	  2631      hexCode: undefined,
  2724	  2632      codeSetId: "6935",
  2725	  2633      category: "Volume",
  2726	  2634  +   irCode: String
  2727	  2635    }
  2728	  2636  }
  2729	  2637  Argument `irCode` is missing.
  2730	  2638  ```
  2731	  2639  
  2732	  2640  **Root Causes:**
  2733	  2641  1. **API Rate Limit**: Global Cache API has daily download limits
  2734	  2642  2. **Invalid API Key**: API key expired or not logged in
  2735	  2643  3. **Missing Code Data**: API returned error response instead of code data
  2736	  2644  4. **Network Issues**: Connection problems with Global Cache servers
  2737	  2645  
  2738	  2646  **Fix Applied (October 17, 2025):**
  2739	  2647  
  2740	  2648  The system now includes comprehensive validation and error handling:
  2741	  2649  
  2742	  2650  1. **API Response Validation**: Checks if response is a `CodeResponse` (error) vs `Code` (success)
  2743	  2651  2. **Error Code Mapping**: Maps Global Cache API error codes to human-readable messages:
  2744	  2652     - Code 2: API Key not found
  2745	  2653     - Code 3: User not logged in
  2746	  2654     - Code 4: Too many requests (rate limit exceeded)
  2747	  2655     - Code 5: Unknown output type
  2748	  2656     - Code 6: Direct output not allowed for account
  2749	  2657     - Code 7: API key required but not provided
  2750	  2658     - Code 8: Email send failed
  2751	  2659     - Code 9: Unknown format requested
  2752	  2660  3. **Missing Field Detection**: Validates that `Code1` field exists before creating database entry
  2753	  2661  4. **Enhanced Logging**: Detailed console logs show raw API responses and validation steps
  2754	  2662  
  2755	  2663  **Diagnostic Steps:**
  2756	  2664  1. **Check PM2 logs** for detailed error messages:
  2757	  2665     ```bash
  2758	  2666     pm2 logs sports-bar-tv | grep "IR DATABASE"
  2759	  2667     ```
  2760	  2668  
  2761	  2669  2. **Look for API error codes** in logs:
  2762	  2670     ```
  2763	  2671     ⚠️  [IR DATABASE] Received CodeResponse (not Code)
  2764	  2672        Status: failure
  2765	  2673        Message: Too many IR codes already requested today
  2766	  2674        Error Code: 4
  2767	  2675     ```
  2768	  2676  
  2769	  2677  3. **Verify API credentials**:
  2770	  2678     - Check if logged in to Global Cache IR Database
  2771	  2679     - Verify API key is valid and active
  2772	  2680     - Re-login if necessary
  2773	  2681  
  2774	  2682  4. **Check rate limits**:
  2775	  2683     - Global Cache limits downloads per day
  2776	  2684     - Wait 24 hours if rate limit exceeded
  2777	  2685     - Consider using sandbox mode for testing
  2778	  2686  
  2779	  2687  **Solutions:**
  2780	  2688  
  2781	  2689  1. **Rate Limit Exceeded (Error Code 4)**:
  2782	  2690     - Wait until next day (resets at midnight UTC)
  2783	  2691     - Use sandbox mode for testing: Add `sandbox=true` to API URL
  2784	  2692     - Prioritize essential commands only
  2785	  2693  
  2786	  2694  2. **API Key Issues (Error Code 2, 3, 7)**:
  2787	  2695     - Navigate to IR Device Setup
  2788	  2696     - Click "IR Database Login"
  2789	  2697     - Enter credentials and re-login
  2790	  2698     - Verify API key is stored in database
  2791	  2699  
  2792	  2700  3. **Network/Connection Issues**:
  2793	  2701     - Check internet connectivity
  2794	  2702     - Verify firewall allows outbound HTTPS to irdb.globalcache.com:8081
  2795	  2703     - Test connection to Global Cache API
  2796	  2704  
  2797	  2705  4. **Invalid Code Data**:
  2798	  2706     - Try different codeset for same device
  2799	  2707     - Report issue to Global Cache support
  2800	  2708     - Use learning mode if available
  2801	  2709  
  2802	  2710  **Verification:**
  2803	  2711  
  2804	  2712  After fix, successful downloads show:
  2805	  2713  ```
  2806	  2714  ✅ [IR DATABASE] Code downloaded successfully
  2807	  2715     Function: VOLUME UP
  2808	  2716     Code1 length: 68
  2809	  2717     HexCode1 length: 32
  2810	  2718  ✅ Created command: VOLUME UP
  2811	  2719  ```
  2812	  2720  
  2813	  2721  **Prevention:**
  2814	  2722  - Monitor daily download count
  2815	  2723  - Download codes in batches to avoid rate limits
  2816	  2724  - Keep API credentials current and valid
  2817	  2725  - Use comprehensive error handling in custom integrations
  2818	  2726  
  2819	  2727  ### Best Practices
  2820	  2728  
  2821	  2729  #### Global Cache Device Naming
  2822	  2730  - Use descriptive names: "GC iTach 1 - Bar Area"
  2823	  2731  - Include location for easy identification
  2824	  2732  - Document which area/rack device is located in
  2825	  2733  
  2826	  2734  #### Port Assignment
  2827	  2735  - Document port assignments in device descriptions
  2828	  2736  - Use consistent naming conventions
  2829	  2737  - Track cable connections physically
  2830	  2738  
  2831	  2739  #### IR Device Organization
  2832	  2740  - Use clear, consistent naming
  2833	  2741  - Include location in name: "Cable Box 1 - TV 3"
  2834	  2742  - Set matrix input for automatic video routing
  2835	  2743  - Add detailed descriptions for complex setups
  2836	  2744  
  2837	  2745  #### Testing
  2838	  2746  - Test connection after adding Global Cache device
  2839	  2747  - Verify IR codes work before production use
  2840	  2748  - Test edit functionality periodically
  2841	  2749  - Monitor logs for errors
  2842	  2750  
  2843	  2751  ### Integration with Other Systems
  2844	  2752  
  2845	  2753  #### Matrix Switcher
  2846	  2754  - IR devices can specify matrix input channel
  2847	  2755  - Enables automatic video routing
  2848	  2756  - Coordinates IR control with video switching
  2849	  2757  
  2850	  2758  #### Bartender Remote
  2851	  2759  - IR commands can be triggered from remote interface
  2852	  2760  - Simplifies bartender operations
  2853	  2761  - Reduces complexity for staff
  2854	  2762  
  2855	  2763  #### Schedule System
  2856	  2764  - IR devices can be controlled via scheduled events
  2857	  2765  - Automatic channel changes
  2858	  2766  - Power on/off automation
  2859	  2767  
  2860	  2768  ### Future Enhancements
  2861	  2769  
  2862	  2770  **Planned Features:**
  2863	  2771  - [ ] Macro commands (multiple IR commands in sequence)
  2864	  2772  - [ ] IR learning mode (learn from physical remote)
  2865	  2773  - [ ] Bulk IR code downloads
  2866	  2774  - [ ] Command testing interface
  2867	  2775  - [ ] Activity monitoring and logging
  2868	  2776  - [ ] Port conflict detection
  2869	  2777  - [ ] Automatic port assignment suggestions
  2870	  2778  - [ ] IR code validation and testing
  2871	  2779  
  2872	  2780  ### Migration Notes
  2873	  2781  
  2874	  2782  **October 17, 2025 Update:**
  2875	  2783  - Added `globalCacheDeviceId` field to IRDevice model
  2876	  2784  - Added `globalCachePortNumber` field to IRDevice model
  2877	  2785  - Updated API routes to handle new fields
  2878	  2786  - Added dropdown selectors in UI
  2879	  2787  - Implemented edit functionality
  2880	  2788  - Added comprehensive verbose logging throughout
  2881	  2789  
  2882	  2790  **Database Migration:**
  2883	  2791  ```bash
  2884	  2792  cd /home/ubuntu/Sports-Bar-TV-Controller
  2885	  2793  npx prisma db push
  2886	  2794  npx prisma generate
  2887	  2795  ```
  2888	  2796  
  2889	  2797  **Component Updates:**
  2890	  2798  - IRDeviceSetup.tsx: Added Global Cache device/port selection
  2891	  2799  - API routes: Added logging and new field handling
  2892	  2800  - Database schema: Added new fields with indexes
  2893	  2801  
  2894	  2802  ### Support
  2895	  2803  
  2896	  2804  **Viewing Logs:**
  2897	  2805  ```bash
  2898	  2806  # Real-time logs
  2899	  2807  pm2 logs sports-bar-tv
  2900	  2808  
  2901	  2809  # Search for IR device operations
  2902	  2810  pm2 logs sports-bar-tv | grep "IR DEVICE SETUP"
  2903	  2811  
  2904	  2812  # Search for API operations
  2905	  2813  pm2 logs sports-bar-tv | grep "IR DEVICES"
  2906	  2814  ```
  2907	  2815  
  2908	  2816  **Testing API:**
  2909	  2817  ```bash
  2910	  2818  # List IR devices
  2911	  2819  curl http://24.123.87.42:3000/api/ir/devices
  2912	  2820  
  2913	  2821  # List Global Cache devices
  2914	  2822  curl http://24.123.87.42:3000/api/globalcache/devices
  2915	  2823  
  2916	  2824  # Test Global Cache connection
  2917	  2825  curl -X POST http://24.123.87.42:3000/api/globalcache/devices/[id]/test
  2918	  2826  ```
  2919	  2827  
  2920	  2828  ---
  2921	  2829  
  2922	  2830  ## 9. Remote Control
  2923	  2831  
  2924	  2832  ### Overview
  2925	  2833  Bartender Remote interface for quick TV and audio control.
  2926	  2834  
  2927	  2835  ### Features
  2928	  2836  - Quick TV source selection
  2929	  2837  - Matrix status display
  2930	  2838  - Bar layout visualization
  2931	  2839  - Input source shortcuts
  2932	  2840  
  2933	  2841  ---
  2934	  2842  
  2935	  2843  ## 10. System Admin
  2936	  2844  
  2937	  2845  ### Overview
  2938	  2846  Administrative tools for system management, testing, and maintenance.
  2939	  2847  
  2940	  2848  ### Features
  2941	  2849  
  2942	  2850  #### Wolfpack Configuration
  2943	  2851  - Matrix IP address setup
  2944	  2852  - Connection testing
  2945	  2853  - Switching tests
  2946	  2854  
  2947	  2855  #### Matrix Inputs/Outputs
  2948	  2856  - Input/output labeling
  2949	  2857  - Enable/disable configuration
  2950	  2858  - Schedule participation settings
  2951	  2859  
  2952	  2860  #### System Logs
  2953	  2861  - Application logs
  2954	  2862  - Error tracking
  2955	  2863  - Activity monitoring
  2956	  2864  
  2957	  2865  #### Backup Management
  2958	  2866  - Manual backup creation
  2959	  2867  - Backup restoration
  2960	  2868  - Automated backup status
  2961	  2869  
  2962	  2870  #### TODO Management
  2963	  2871  - Task tracking
  2964	  2872  - Priority management
  2965	  2873  - Status updates
  2966	  2874  
  2967	  2875  ### Wolfpack Integration
  2968	  2876  
  2969	  2877  #### POST `/api/wolfpack/test-connection`
  2970	  2878  Test connectivity to Wolfpack matrix:
  2971	  2879  ```json
  2972	  2880  {
  2973	  2881    "ipAddress": "192.168.1.100"
  2974	  2882  }
  2975	  2883  ```
  2976	  2884  
  2977	  2885  #### POST `/api/wolfpack/test-switching`
  2978	  2886  Test matrix switching functionality
  2979	  2887  
  2980	  2888  #### Database Schema
  2981	  2889  
  2982	  2890  ```prisma
  2983	  2891  model WolfpackConfig {
  2984	  2892    id         Int      @id @default(autoincrement())
  2985	  2893    ipAddress  String   @unique
  2986	  2894    name       String?
  2987	  2895    createdAt  DateTime @default(now())
  2988	  2896    updatedAt  DateTime @updatedAt
  2989	  2897  }
  2990	  2898  ```
  2991	  2899  
  2992	  2900  ### TODO Management
  2993	  2901  
  2994	  2902  The TODO management system provides task tracking and project management capabilities. The system automatically maintains a `TODO_LIST.md` file that reflects the current state of all tasks in the database.
  2995	  2903  
  2996	  2904  #### ⚠️ Important: TODO_LIST.md is Auto-Generated
  2997	  2905  
  2998	  2906  **DO NOT EDIT TODO_LIST.md MANUALLY**
  2999	  2907  
  3000	  2908  The `TODO_LIST.md` file is automatically generated and updated by the TODO management system. Any manual changes will be overwritten when the system syncs. Always use the TODO API to add, update, or delete tasks.
  3001	  2909  
  3002	  2910  The auto-generation happens:
  3003	  2911  - When a TODO is created via the API
  3004	  2912  - When a TODO is updated via the API
  3005	  2913  - When a TODO is deleted via the API
  3006	  2914  - During periodic system syncs
  3007	  2915  
  3008	  2916  #### Database Schema
  3009	  2917  
  3010	  2918  ```prisma
  3011	  2919  model Todo {
  3012	  2920    id              String        @id @default(cuid())
  3013	  2921    title           String
  3014	  2922    description     String?
  3015	  2923    priority        String        @default("MEDIUM") // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  3016	  2924    status          String        @default("PLANNED") // "PLANNED", "IN_PROGRESS", "TESTING", "COMPLETE"
  3017	  2925    category        String?
  3018	  2926    tags            String?       // JSON array of tags
  3019	  2927    createdAt       DateTime      @default(now())
  3020	  2928    updatedAt       DateTime      @updatedAt
  3021	  2929    completedAt     DateTime?
  3022	  2930    
  3023	  2931    documents       TodoDocument[]
  3024	  2932  }
  3025	  2933  
  3026	  2934  model TodoDocument {
  3027	  2935    id              String   @id @default(cuid())
  3028	  2936    todoId          String
  3029	  2937    filename        String
  3030	  2938    filepath        String
  3031	  2939    filesize        Int?
  3032	  2940    mimetype        String?
  3033	  2941    uploadedAt      DateTime @default(now())
  3034	  2942    
  3035	  2943    todo            Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  3036	  2944    
  3037	  2945    @@index([todoId])
  3038	  2946  }
  3039	  2947  ```
  3040	  2948  
  3041	  2949  #### API Endpoints
  3042	  2950  
  3043	  2951  ##### GET `/api/todos` - List all TODOs
  3044	  2952  
  3045	  2953  Retrieve all TODOs with optional filtering.
  3046	  2954  
  3047	  2955  **Query Parameters:**
  3048	  2956  - `status` (optional) - Filter by status: `PLANNED`, `IN_PROGRESS`, `TESTING`, `COMPLETE`
  3049	  2957  - `priority` (optional) - Filter by priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  3050	  2958  - `category` (optional) - Filter by category string
  3051	  2959  
  3052	  2960  **Response:**
  3053	  2961  ```json
  3054	  2962  {
  3055	  2963    "success": true,
  3056	  2964    "data": [
  3057	  2965      {
  3058	  2966        "id": "cmgki7fkg0001vsfg6ghz142f",
  3059	  2967        "title": "Fix critical bug",
  3060	  2968        "description": "Detailed description...",
  3061	  2969        "priority": "CRITICAL",
  3062	  2970        "status": "PLANNED",
  3063	  2971        "category": "Bug Fix",
  3064	  2972        "tags": "[\"ai-hub\", \"database\"]",
  3065	  2973        "createdAt": "2025-10-10T07:07:10.000Z",
  3066	  2974        "updatedAt": "2025-10-10T07:07:10.000Z",
  3067	  2975        "completedAt": null,
  3068	  2976        "documents": []
  3069	  2977      }
  3070	  2978    ]
  3071	  2979  }
  3072	  2980  ```
  3073	  2981  
  3074	  2982  **Example cURL:**
  3075	  2983  ```bash
  3076	  2984  # Get all TODOs
  3077	  2985  curl http://localhost:3000/api/todos
  3078	  2986  
  3079	  2987  # Get only high priority TODOs
  3080	  2988  curl http://localhost:3000/api/todos?priority=HIGH
  3081	  2989  
  3082	  2990  # Get in-progress tasks
  3083	  2991  curl http://localhost:3000/api/todos?status=IN_PROGRESS
  3084	  2992  ```
  3085	  2993  
  3086	  2994  ##### POST `/api/todos` - Create new TODO
  3087	  2995  
  3088	  2996  Add a new TODO item to the system. The TODO_LIST.md file will be automatically updated.
  3089	  2997  
  3090	  2998  **Request Body:**
  3091	  2999  ```json
  3092	  3000  {
  3093	  3001    "title": "Task title (required)",
  3094	  3002    "description": "Detailed task description (optional)",
  3095	  3003    "priority": "MEDIUM",
  3096	  3004    "status": "PLANNED",
  3097	  3005    "category": "Category name (optional)",
  3098	  3006    "tags": ["tag1", "tag2"]
  3099	  3007  }
  3100	  3008  ```
  3101	  3009  
  3102	  3010  **Priority Levels:**
  3103	  3011  - `LOW` - Minor tasks, nice-to-have features
  3104	  3012  - `MEDIUM` - Standard priority (default)
  3105	  3013  - `HIGH` - Important tasks requiring attention
  3106	  3014  - `CRITICAL` - Urgent tasks blocking functionality
  3107	  3015  
  3108	  3016  **Status Values:**
  3109	  3017  - `PLANNED` - Task is planned but not started (default)
  3110	  3018  - `IN_PROGRESS` - Currently being worked on
  3111	  3019  - `TESTING` - Implementation complete, being tested
  3112	  3020  - `COMPLETE` - Task finished and verified
  3113	  3021  
  3114	  3022  **Response:**
  3115	  3023  ```json
  3116	  3024  {
  3117	  3025    "success": true,
  3118	  3026    "data": {
  3119	  3027      "id": "cmgki7fkg0001vsfg6ghz142f",
  3120	  3028      "title": "Task title",
  3121	  3029      "description": "Detailed task description",
  3122	  3030      "priority": "MEDIUM",
  3123	  3031      "status": "PLANNED",
  3124	  3032      "category": "Category name",
  3125	  3033      "tags": "[\"tag1\", \"tag2\"]",
  3126	  3034      "createdAt": "2025-10-15T03:00:00.000Z",
  3127	  3035      "updatedAt": "2025-10-15T03:00:00.000Z",
  3128	  3036      "completedAt": null,
  3129	  3037      "documents": []
  3130	  3038    }
  3131	  3039  }
  3132	  3040  ```
  3133	  3041  
  3134	  3042  **Example API Calls with Different Priority Levels:**
  3135	  3043  
  3136	  3044  **1. Create a LOW priority task:**
  3137	  3045  ```bash
  3138	  3046  curl -X POST http://localhost:3000/api/todos \
  3139	  3047    -H "Content-Type: application/json" \
  3140	  3048    -d '{
  3141	  3049      "title": "Update documentation styling",
  3142	  3050      "description": "Improve markdown formatting in README files",
  3143	  3051      "priority": "LOW",
  3144	  3052      "status": "PLANNED",
  3145	  3053      "category": "Enhancement",
  3146	  3054      "tags": ["documentation", "style"]
  3147	  3055    }'
  3148	  3056  ```
  3149	  3057  
  3150	  3058  **2. Create a MEDIUM priority task (default):**
  3151	  3059  ```bash
  3152	  3060  curl -X POST http://localhost:3000/api/todos \
  3153	  3061    -H "Content-Type: application/json" \
  3154	  3062    -d '{
  3155	  3063      "title": "Add unit tests for TODO API",
  3156	  3064      "description": "Create comprehensive test suite for TODO endpoints",
  3157	  3065      "priority": "MEDIUM",
  3158	  3066      "category": "Testing & QA",
  3159	  3067      "tags": ["testing", "api"]
  3160	  3068    }'
  3161	  3069  ```
  3162	  3070  
  3163	  3071  **3. Create a HIGH priority task:**
  3164	  3072  ```bash
  3165	  3073  curl -X POST http://localhost:3000/api/todos \
  3166	  3074    -H "Content-Type: application/json" \
  3167	  3075    -d '{
  3168	  3076      "title": "Optimize database queries",
  3169	  3077      "description": "Profile and optimize slow database queries affecting performance",
  3170	  3078      "priority": "HIGH",
  3171	  3079      "status": "PLANNED",
  3172	  3080      "category": "Performance",
  3173	  3081      "tags": ["database", "optimization", "high-priority"]
  3174	  3082    }'
  3175	  3083  ```
  3176	  3084  
  3177	  3085  **4. Create a CRITICAL priority task:**
  3178	  3086  ```bash
  3179	  3087  curl -X POST http://localhost:3000/api/todos \
  3180	  3088    -H "Content-Type: application/json" \
  3181	  3089    -d '{
  3182	  3090      "title": "CRITICAL: Fix authentication bypass vulnerability",
  3183	  3091      "description": "Security vulnerability discovered in authentication flow allowing unauthorized access",
  3184	  3092      "priority": "CRITICAL",
  3185	  3093      "status": "IN_PROGRESS",
  3186	  3094      "category": "Security",
  3187	  3095      "tags": ["security", "critical", "urgent", "blocking"]
  3188	  3096    }'
  3189	  3097  ```
  3190	  3098  
  3191	  3099  **JavaScript/TypeScript Example:**
  3192	  3100  ```typescript
  3193	  3101  // Using fetch API
  3194	  3102  async function createTodo(todoData: {
  3195	  3103    title: string;
  3196	  3104    description?: string;
  3197	  3105    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  3198	  3106    status?: 'PLANNED' | 'IN_PROGRESS' | 'TESTING' | 'COMPLETE';
  3199	  3107    category?: string;
  3200	  3108    tags?: string[];
  3201	  3109  }) {
  3202	  3110    const response = await fetch('/api/todos', {
  3203	  3111      method: 'POST',
  3204	  3112      headers: {
  3205	  3113        'Content-Type': 'application/json',
  3206	  3114      },
  3207	  3115      body: JSON.stringify(todoData),
  3208	  3116    });
  3209	  3117  
  3210	  3118    const result = await response.json();
  3211	  3119    return result;
  3212	  3120  }
  3213	  3121  
  3214	  3122  // Example usage
  3215	  3123  const newTodo = await createTodo({
  3216	  3124    title: 'Implement feature X',
  3217	  3125    description: 'Add new feature to the system',
  3218	  3126    priority: 'HIGH',
  3219	  3127    category: 'Feature',
  3220	  3128    tags: ['frontend', 'ui']
  3221	  3129  });
  3222	  3130  ```
  3223	  3131  
  3224	  3132  ##### PUT `/api/todos/[id]` - Update TODO
  3225	  3133  
  3226	  3134  Update an existing TODO item.
  3227	  3135  
  3228	  3136  **Request Body:** Same as POST (all fields optional except those you want to update)
  3229	  3137  
  3230	  3138  **Example cURL:**
  3231	  3139  ```bash
  3232	  3140  curl -X PUT http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f \
  3233	  3141    -H "Content-Type: application/json" \
  3234	  3142    -d '{
  3235	  3143      "status": "IN_PROGRESS",
  3236	  3144      "priority": "HIGH"
  3237	  3145    }'
  3238	  3146  ```
  3239	  3147  
  3240	  3148  ##### DELETE `/api/todos/[id]` - Delete TODO
  3241	  3149  
  3242	  3150  Remove a TODO item from the system.
  3243	  3151  
  3244	  3152  **Example cURL:**
  3245	  3153  ```bash
  3246	  3154  curl -X DELETE http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f
  3247	  3155  ```
  3248	  3156  
  3249	  3157  ##### POST `/api/todos/[id]/complete` - Mark TODO as complete
  3250	  3158  
  3251	  3159  Mark a TODO as complete and set the completion timestamp.
  3252	  3160  
  3253	  3161  **Example cURL:**
  3254	  3162  ```bash
  3255	  3163  curl -X POST http://localhost:3000/api/todos/cmgki7fkg0001vsfg6ghz142f/complete
  3256	  3164  ```
  3257	  3165  
  3258	  3166  #### Authentication & Authorization
  3259	  3167  
  3260	  3168  **Current Status:** No authentication required
  3261	  3169  
  3262	  3170  The TODO API currently does not require authentication or authorization. All endpoints are publicly accessible on the local network. This is suitable for internal use within a trusted network environment.
  3263	  3171  
  3264	  3172  **Security Considerations:**
  3265	  3173  - API is accessible to anyone on the same network
  3266	  3174  - Suitable for internal sports bar management systems
  3267	  3175  - For production internet-facing deployments, consider adding:
  3268	  3176    - JWT-based authentication
  3269	  3177    - Role-based access control (RBAC)
  3270	  3178    - API rate limiting
  3271	  3179    - IP whitelisting
  3272	  3180  
  3273	  3181  #### GitHub Synchronization
  3274	  3182  
  3275	  3183  The TODO system automatically synchronizes with GitHub:
  3276	  3184  - When a TODO is created, updated, or deleted, the `TODO_LIST.md` file is automatically regenerated
  3277	  3185  - Changes are committed to the repository with descriptive commit messages
  3278	  3186  - Synchronization happens in the background without blocking API responses
  3279	  3187  - If GitHub sync fails, the operation still succeeds locally (sync errors are logged)
  3280	  3188  
  3281	  3189  **Sync Commit Messages:**
  3282	  3190  - Create: `chore: Add TODO - [Task Title]`
  3283	  3191  - Update: `chore: Update TODO - [Task Title]`
  3284	  3192  - Delete: `chore: Remove TODO - [Task Title]`
  3285	  3193  
  3286	  3194  #### Best Practices
  3287	  3195  
  3288	  3196  1. **Always use the API** - Never edit TODO_LIST.md directly
  3289	  3197  2. **Use descriptive titles** - Make tasks easy to understand at a glance
  3290	  3198  3. **Add detailed descriptions** - Include steps, affected components, and expected outcomes
  3291	  3199  4. **Tag appropriately** - Use consistent tags for filtering and organization
  3292	  3200  5. **Set correct priority** - Use CRITICAL sparingly for true blocking issues
  3293	  3201  6. **Update status regularly** - Keep task status current as work progresses
  3294	  3202  7. **Complete tasks** - Use the complete endpoint to properly timestamp completion
  3295	  3203  
  3296	  3204  ---
  3297	  3205  
  3298	  3206  ## Backup & Maintenance
  3299	  3207  
  3300	  3208  ### Automated Daily Backup
  3301	  3209  
  3302	  3210  **Schedule:** Daily at 3:00 AM (server time)  
  3303	  3211  **Script:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/backup_script.js`  
  3304	  3212  **Backup Directory:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller/backups/`  
  3305	  3213  **Retention:** 14 days
  3306	  3214  
  3307	  3215  **Cron Job:**
  3308	  3216  ```bash
  3309	  3217  0 3 * * * cd /home/ubuntu/github_repos/Sports-Bar-TV-Controller && /usr/bin/node backup_script.js >> backup.log 2>&1
  3310	  3218  ```
  3311	  3219  
  3312	  3220  **What Gets Backed Up:**
  3313	  3221  1. Matrix configuration (JSON format)
  3314	  3222  2. Database files (`prisma/data/sports_bar.db`)
  3315	  3223  3. Atlas configurations
  3316	  3224  
  3317	  3225  **Backup File Format:** `backup_YYYY-MM-DD_HH-MM-SS.json`
  3318	  3226  
  3319	  3227  ### Manual Backup
  3320	  3228  
  3321	  3229  **Database:**
  3322	  3230  ```bash
  3323	  3231  pg_dump sports_bar_tv > backup_$(date +%Y%m%d_%H%M%S).sql
  3324	  3232  ```
  3325	  3233  
  3326	  3234  **Application:**
  3327	  3235  ```bash
  3328	  3236  tar -czf sports-bar-backup-$(date +%Y%m%d).tar.gz ~/github_repos/Sports-Bar-TV-Controller
  3329	  3237  ```
  3330	  3238  
  3331	  3239  ### Restore from Backup
  3332	  3240  
  3333	  3241  **Database:**
  3334	  3242  ```bash
  3335	  3243  psql sports_bar_tv < backup_20251015_020000.sql
  3336	  3244  ```
  3337	  3245  
  3338	  3246  **Atlas Configuration:**
  3339	  3247  ```bash
  3340	  3248  cd ~/github_repos/Sports-Bar-TV-Controller/data/atlas-configs
  3341	  3249  cp cmgjxa5ai000260a7xuiepjl_backup_TIMESTAMP.json cmgjxa5ai000260a7xuiepjl.json
  3342	  3250  ```
  3343	  3251  
  3344	  3252  ---
  3345	  3253  
  3346	  3254  ## Troubleshooting
  3347	  3255  
  3348	  3256  ### Application Issues
  3349	  3257  
  3350	  3258  **Application Won't Start:**
  3351	  3259  ```bash
  3352	  3260  # Check PM2 status
  3353	  3261  pm2 status
  3354	  3262  
  3355	  3263  # View logs
  3356	  3264  pm2 logs sports-bar-tv
  3357	  3265  
  3358	  3266  # Restart application
  3359	  3267  pm2 restart sports-bar-tv
  3360	  3268  ```
  3361	  3269  
  3362	  3270  **Database Connection Errors:**
  3363	  3271  ```bash
  3364	  3272  # Check database status
  3365	  3273  npx prisma db pull
  3366	  3274  
  3367	  3275  # Run pending migrations
  3368	  3276  npx prisma migrate deploy
  3369	  3277  
  3370	  3278  # Regenerate Prisma client
  3371	  3279  npx prisma generate
  3372	  3280  ```
  3373	  3281  
  3374	  3282  ### Network Issues
  3375	  3283  
  3376	  3284  **Wolfpack Matrix Not Responding:**
  3377	  3285  1. Check network connectivity: `ping <wolfpack-ip>`
  3378	  3286  2. Verify matrix is powered on
  3379	  3287  3. Check network cable connections
  3380	  3288  4. Confirm same network/VLAN
  3381	  3289  5. Test connection in System Admin
  3382	  3290  
  3383	  3291  **Atlas Processor Offline:**
  3384	  3292  1. Check connectivity: `ping 192.168.5.101`
  3385	  3293  2. Verify processor is powered on
  3386	  3294  3. Check configuration file exists
  3387	  3295  4. Restore from backup if needed
  3388	  3296  
  3389	  3297  ### Performance Issues
  3390	  3298  
  3391	  3299  **Slow Response Times:**
  3392	  3300  1. Check PM2 resource usage: `pm2 monit`
  3393	  3301  2. Review application logs
  3394	  3302  3. Check database size and optimize
  3395	  3303  4. Restart application if needed
  3396	  3304  
  3397	  3305  **High Memory Usage:**
  3398	  3306  1. Check PM2 status: `pm2 status`
  3399	  3307  2. Restart application: `pm2 restart sports-bar-tv`
  3400	  3308  3. Monitor logs for memory leaks
  3401	  3309  
  3402	  3310  ---
  3403	  3311  
  3404	  3312  ## Security Best Practices
  3405	  3313  
  3406	  3314  ### Network Security
  3407	  3315  - Wolfpack matrix on isolated VLAN
  3408	  3316  - Application behind firewall
  3409	  3317  - Use HTTPS in production (configure reverse proxy)
  3410	  3318  
  3411	  3319  ### Authentication
  3412	  3320  - Strong passwords for all accounts
  3413	  3321  - Regular password rotation
  3414	  3322  - Secure storage of credentials
  3415	  3323  
  3416	  3324  ### API Security
  3417	  3325  - API keys in `.env` file only
  3418	  3326  - Never commit `.env` to repository
  3419	  3327  - Masked display in UI
  3420	  3328  - Server-side validation
  3421	  3329  
  3422	  3330  ### Database Security
  3423	  3331  - Strong database passwords
  3424	  3332  - Restrict access to localhost
  3425	  3333  - Regular security updates
  3426	  3334  - Encrypted backups
  3427	  3335  
  3428	  3336  ---
  3429	  3337  
  3430	  3338  ## Recent Changes
  3431	  3339  
  3432	  3340  ### October 15, 2025 - DirecTV Integration Documentation Update
  3433	  3341  **Status:** ✅ Documentation complete  
  3434	  3342  **Updated By:** DeepAgent
  3435	  3343  
  3436	  3344  #### Documentation Added
  3437	  3345  - ✅ Comprehensive DirecTV Integration section (Section 7)
  3438	  3346  - ✅ Complete testing results from October 15, 2025 testing session
  3439	  3347  - ✅ Detailed error messages and diagnostics
  3440	  3348  - ✅ Verbose logging implementation details
  3441	  3349  - ✅ API endpoint specifications with request/response examples
  3442	  3350  - ✅ Database schema for DirecTVReceiver model
  3443	  3351  - ✅ Known issues and limitations documentation
  3444	  3352  - ✅ Comprehensive troubleshooting guide
  3445	  3353  - ✅ Production deployment recommendations
  3446	  3354  - ✅ Network configuration guidelines
  3447	  3355  - ✅ Security considerations
  3448	  3356  - ✅ Future enhancement roadmap
  3449	  3357  
  3450	  3358  #### Testing Results Documented
  3451	  3359  **Successful Operations:**
  3452	  3360  - Receiver creation with full configuration
  3453	  3361  - Receiver deletion (tested with 9 receivers)
  3454	  3362  - Form validation and React integration
  3455	  3363  - Matrix input channel selection (32 channels)
  3456	  3364  
  3457	  3365  **Known Issues:**
  3458	  3366  - Subscription polling requires physical DirecTV hardware
  3459	  3367  - Connection status ambiguity in UI
  3460	  3368  - Form input React state synchronization workaround needed
  3461	  3369  - Network topology dependencies
  3462	  3370  
  3463	  3371  #### Logging Details Added
  3464	  3372  - PM2 log locations and access methods
  3465	  3373  - Logged operations for all DirecTV activities
  3466	  3374  - Example log outputs for debugging
  3467	  3375  - Log search commands for troubleshooting
  3468	  3376  
  3469	  3377  #### Troubleshooting Guide Includes
  3470	  3378  - Network connectivity verification steps
  3471	  3379  - Receiver status checking procedures
  3472	  3380  - Configuration validation methods
  3473	  3381  - Backend log review commands
  3474	  3382  - Firewall/port testing procedures
  3475	  3383  - Common problems and solutions
  3476	  3384  
  3477	  3385  ---
  3478	  3386  
  3479	  3387  ### October 15, 2025 - PR #193: Unified Prisma Client & AI Hub Fixes (MERGED TO MAIN)
  3480	  3388  **Status:** ✅ Successfully merged, tested, and deployed
  3481	  3389  
  3482	  3390  #### Changes Implemented
  3483	  3391  1. **Prisma Client Singleton Pattern**
  3484	  3392     - ✅ Unified all Prisma client imports across 9 API route files to use singleton from `@/lib/db`
  3485	  3393     - ✅ Prevents multiple Prisma client instances and potential memory leaks
  3486	  3394     - ✅ Improves database connection management
  3487	  3395     - ✅ Standardizes database access patterns throughout the application
  3488	  3396  
  3489	  3397  2. **AI Hub Database Models**
  3490	  3398     - ✅ Added `IndexedFile` model for tracking indexed codebase files
  3491	  3399     - ✅ Added `QAEntry` model (renamed from QAPair) for Q&A training data
  3492	  3400     - ✅ Added `TrainingDocument` model for AI Hub training documents
  3493	  3401     - ✅ Added `ApiKey` model for managing AI provider API keys
  3494	  3402     - ✅ Successfully migrated database with new schema
  3495	  3403  
  3496	  3404  3. **Logging Enhancements**
  3497	  3405     - ✅ Added comprehensive verbose logging to AI system components:
  3498	  3406       - Codebase indexing process with file counts and progress
  3499	  3407       - Vector embeddings generation and storage
  3500	  3408       - Q&A entry creation with detailed field logging
  3501	  3409       - Q&A entry retrieval with query debugging
  3502	  3410       - Database operations with success/failure tracking
  3503	  3411  
  3504	  3412  4. **Bug Fixes**
  3505	  3413     - ✅ Fixed Q&A entries GET handler that was incorrectly processing requests as POST
  3506	  3414     - ✅ Corrected async/await patterns in Q&A API routes
  3507	  3415     - ✅ Improved error handling with detailed error messages
  3508	  3416  
  3509	  3417  #### Testing Results (Remote Server: 24.123.87.42:3000)
  3510	  3418  All features successfully tested on production server:
  3511	  3419  - ✅ **Codebase Indexing:** 720 files successfully indexed
  3512	  3420  - ✅ **Q&A Entry Creation:** Successfully created test entries with proper field mapping
  3513	  3421  - ✅ **Q&A Entry Retrieval:** GET requests now working correctly, returns all entries
  3514	  3422  - ✅ **Verbose Logging:** Confirmed in PM2 logs with detailed debugging information
  3515	  3423  - ✅ **Database Integrity:** All migrations applied successfully, schema validated
  3516	  3424  
  3517	  3425  #### Files Modified in PR #193
  3518	  3426  - `src/app/api/ai-assistant/index-codebase/route.ts` - Added verbose logging & unified Prisma
  3519	  3427  - `src/app/api/ai-assistant/search-code/route.ts` - Unified Prisma client import
  3520	  3428  - `src/app/api/ai/qa-entries/route.ts` - Fixed GET handler bug & added logging
  3521	  3429  - `src/app/api/cec/discovery/route.ts` - Unified Prisma client import
  3522	  3430  - `src/app/api/home-teams/route.ts` - Unified Prisma client import
  3523	  3431  - `src/app/api/schedules/[id]/route.ts` - Unified Prisma client import
  3524	  3432  - `src/app/api/schedules/execute/route.ts` - Unified Prisma client import
  3525	  3433  - `src/app/api/schedules/logs/route.ts` - Unified Prisma client import
  3526	  3434  - `src/app/api/schedules/route.ts` - Unified Prisma client import
  3527	  3435  - `prisma/schema.prisma` - Added new AI Hub models
  3528	  3436  - All backup files removed for clean codebase
  3529	  3437  
  3530	  3438  #### Related Pull Requests
  3531	  3439  - ✅ **PR #193** - Successfully merged to main branch (supersedes PR #169)
  3532	  3440  - ❌ **PR #169** - Closed due to merge conflicts (superseded by PR #193)
  3533	  3441  
  3534	  3442  #### Benefits Achieved
  3535	  3443  - Eliminated Prisma client instance conflicts
  3536	  3444  - Improved AI Hub reliability and debuggability
  3537	  3445  - Enhanced production monitoring with verbose logging
  3538	  3446  - Fixed critical Q&A entry retrieval bug
  3539	  3447  - Clean, maintainable codebase with consistent patterns
  3540	  3448  
  3541	  3449  
  3542	  3450  ### October 15, 2025 - AI Hub Testing & Documentation Update
  3543	  3451  - ✅ Comprehensive AI Hub testing completed
  3544	  3452  - ✅ Identified 2 critical errors requiring immediate fixes
  3545	  3453  - ✅ Created detailed testing report
  3546	  3454  - ✅ Reorganized documentation by site tabs
  3547	  3455  - ✅ Updated port from 3001 to 3000
  3548	  3456  - ✅ Added detailed AI Hub section with status and fix plans
  3549	  3457  
  3550	  3458  ### October 14, 2025 - AI Hub Database Models
  3551	  3459  - ✅ Added missing database models (IndexedFile, QAPair, TrainingDocument, ApiKey)
  3552	  3460  - ✅ Fixed AI Hub API routes
  3553	  3461  - ✅ Verified basic AI Hub functionality
  3554	  3462  
  3555	  3463  ### October 10, 2025 - Atlas Configuration Restoration
  3556	  3464  - ✅ Fixed critical Atlas configuration wipe bug
  3557	  3465  - ✅ Restored Atlas configuration from backup
  3558	  3466  - ✅ Fixed dynamic zone labels
  3559	  3467  - ✅ Implemented matrix label updates
  3560	  3468  - ✅ Fixed matrix test database errors
  3561	  3469  
  3562	  3470  ### October 9, 2025 - Outputs Configuration & Backup System
  3563	  3471  - ✅ Configured outputs 1-4 as full matrix outputs
  3564	  3472  - ✅ Implemented automated daily backup system
  3565	  3473  - ✅ Added 14-day retention policy
  3566	  3474  
  3567	  3475  ---
  3568	  3476  
  3569	  3477  ## Support Resources
  3570	  3478  
  3571	  3479  ### Documentation Links
  3572	  3480  - Next.js: https://nextjs.org/docs
  3573	  3481  - Prisma: https://www.prisma.io/docs
  3574	  3482  - Tailwind CSS: https://tailwindcss.com/docs
  3575	  3483  
  3576	  3484  ### Project Resources
  3577	  3485  - **GitHub Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
  3578	  3486  - **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
  3579	  3487  - **AI Hub Testing Report:** `/home/ubuntu/ai_hub_testing_report.md`
  3580	  3488  
  3581	  3489  ### Getting Help
  3582	  3490  1. Check this documentation
  3583	  3491  2. Review application logs: `pm2 logs sports-bar-tv`
  3584	  3492  3. Check GitHub issues
  3585	  3493  4. Create new issue with detailed information
  3586	  3494  
  3587	  3495  ---
  3588	  3496  
  3589	  3497  *Last Updated: October 15, 2025 by DeepAgent*  
  3590	  3498  *Version: 2.2*  
  3591	  3499  *Status: Production Ready (AI Hub has 2 critical issues requiring fixes)*
  3592	  3500  ---
  3593	  3501  
  3594	  3502  ## Recent Deployments
  3595	  3503  
  3596	  3504  ### PR #193 - Prisma Client Singleton Pattern Fix (October 15, 2025)
  3597	  3505  
  3598	  3506  **Deployment Date:** October 15, 2025  
  3599	  3507  **Deployed By:** DeepAgent  
  3600	  3508  **Commit:** f51616d - "Fix: Unify Prisma Client Singleton Pattern (#193)"
  3601	  3509  
  3602	  3510  **Changes:**
  3603	  3511  - Unified Prisma Client singleton pattern across the application
  3604	  3512  - Fixed database connection handling issues
  3605	  3513  - Improved application stability and performance
  3606	  3514  
  3607	  3515  **Deployment Steps Executed:**
  3608	  3516  1. SSH connection established to production server (24.123.87.42:224)
  3609	  3517  2. Navigated to `/home/ubuntu/Sports-Bar-TV-Controller`
  3610	  3518  3. Pulled latest changes from main branch (already up to date)
  3611	  3519  4. Ran `npm install` (dependencies up to date)
  3612	  3520  5. Generated Prisma Client with `npx prisma generate`
  3613	  3521  6. Built application with `npm run build` (completed successfully)
  3614	  3522  7. Restarted PM2 process `sports-bar-tv`
  3615	  3523  
  3616	  3524  **Verification:**
  3617	  3525  - PM2 process status: **Online** ✓
  3618	  3526  - Application startup: **Successful** (Ready in 496ms) ✓
  3619	  3527  - Memory usage: 57.0mb (healthy) ✓
  3620	  3528  - CPU usage: 0% (stable) ✓
  3621	  3529  - Uptime: Stable with no crashes ✓
  3622	  3530  
  3623	  3531  **Documentation Updates:**
  3624	  3532  - Corrected production server path to `/home/ubuntu/Sports-Bar-TV-Controller`
  3625	  3533  - Updated PM2 process name to `sports-bar-tv` (was incorrectly documented as `sports-bar-tv-controller`)
  3626	  3534  - Added `npx prisma generate` step to deployment procedure
  3627	  3535  - Clarified distinction between development and production paths
  3628	  3536  
  3629	  3537  
  3630	  3538  ---
  3631	  3539  
  3632	  3540  ## 11. Amazon Fire TV Integration
  3633	  3541  
  3634	  3542  ### Overview
  3635	  3543  
  3636	  3544  The Sports Bar TV Controller includes comprehensive integration with Amazon Fire TV devices for remote control, automation, and matrix routing. The system uses Android Debug Bridge (ADB) for network-based control of Fire TV devices, enabling automated content selection, app launching, and coordination with the Wolfpack HDMI matrix switcher.
  3637	  3545  
  3638	  3546  **Current Production Configuration:**
  3639	  3547  - **Fire TV Model:** Fire TV Cube (3rd Gen - AFTGAZL)
  3640	  3548  - **IP Address:** 192.168.5.131
  3641	  3549  - **Port:** 5555 (ADB default)
  3642	  3550  - **Matrix Input:** Channel 13
  3643	  3551  - **Connection Status:** Fully operational
  3644	  3552  - **ADB Status:** Enabled and connected
  3645	  3553  
  3646	  3554  ### Fire TV Cube Specifications
  3647	  3555  
  3648	  3556  **Hardware:**
  3649	  3557  - **Model:** AFTGAZL (Amazon Fire TV Cube, 3rd Generation - 2022)
  3650	  3558  - **Processor:** Octa-core ARM-based processor
  3651	  3559  - **RAM:** 2GB
  3652	  3560  - **Storage:** 16GB
  3653	  3561  - **Operating System:** Fire OS 7+ (Based on Android 9)
  3654	  3562  - **Network:** Wi-Fi 6, Gigabit Ethernet port
  3655	  3563  - **Ports:** HDMI 2.1 output, Micro USB, Ethernet, IR extender
  3656	  3564  
  3657	  3565  **Capabilities:**
  3658	  3566  - 4K Ultra HD, HDR, HDR10+, Dolby Vision
  3659	  3567  - Dolby Atmos audio
  3660	  3568  - Hands-free Alexa voice control
  3661	  3569  - Built-in speaker for Alexa
  3662	  3570  - IR blaster for TV control
  3663	  3571  - HDMI-CEC support
  3664	  3572  
  3665	  3573  ### ADB Bridge Configuration
  3666	  3574  
  3667	  3575  **Server Configuration:**
  3668	  3576  - **ADB Path:** `/usr/bin/adb`
  3669	  3577  - **ADB Version:** 1.0.41 (Version 28.0.2-debian)
  3670	  3578  - **Installation Location:** `/usr/lib/android-sdk/platform-tools/adb`
  3671	  3579  - **Connection Status:** Active and connected to 192.168.5.131:5555
  3672	  3580  - **Device State:** "device" (fully operational)
  3673	  3581  - **Setup Date:** October 16, 2025
  3674	  3582  
  3675	  3583  **Connection Management:**
  3676	  3584  ```bash
  3677	  3585  # Connect to Fire TV Cube
  3678	  3586  adb connect 192.168.5.131:5555
  3679	  3587  
  3680	  3588  # Check connection status
  3681	  3589  adb devices
  3682	  3590  # Expected output:
  3683	  3591  # List of devices attached
  3684	  3592  # 192.168.5.131:5555    device
  3685	  3593  
  3686	  3594  # Test device communication
  3687	  3595  adb -s 192.168.5.131:5555 shell getprop ro.product.model
  3688	  3596  # Expected output: AFTGAZL
  3689	  3597  
  3690	  3598  # Disconnect (if needed)
  3691	  3599  adb disconnect 192.168.5.131:5555
  3692	  3600  ```
  3693	  3601  
  3694	  3602  ### Enabling ADB on Fire TV
  3695	  3603  
  3696	  3604  **Step-by-Step Process:**
  3697	  3605  
  3698	  3606  1. **Enable Developer Options:**
  3699	  3607     - Go to Settings → My Fire TV → About
  3700	  3608     - Click on device name 7 times rapidly
  3701	  3609     - "Developer Options" will appear in Settings
  3702	  3610  
  3703	  3611  2. **Enable ADB Debugging:**
  3704	  3612     - Go to Settings → My Fire TV → Developer Options
  3705	  3613     - Turn on "ADB Debugging"
  3706	  3614     - Confirm warning dialog
  3707	  3615  
  3708	  3616  3. **First Connection Authorization:**
  3709	  3617     - First ADB connection shows authorization prompt on TV
  3710	  3618     - Select "Always allow from this computer"
  3711	  3619     - Tap OK to authorize
  3712	  3620  
  3713	  3621  ### Matrix Integration
  3714	  3622  
  3715	  3623  **Physical Connection:**
  3716	  3624  - Fire TV Cube HDMI output → Wolfpack Matrix Input 13
  3717	  3625  - Matrix can route Input 13 to any of 32 TV outputs
  3718	  3626  
  3719	  3627  **Routing Control:**
  3720	  3628  ```bash
  3721	  3629  # Route Fire TV to specific TV output
  3722	  3630  POST /api/matrix/route
  3723	  3631  {
  3724	  3632    "input": 13,      # Fire TV's matrix input
  3725	  3633    "output": 33      # Target TV output
  3726	  3634  }
  3727	  3635  
  3728	  3636  # Route to multiple TVs simultaneously
  3729	  3637  POST /api/matrix/route-multiple
  3730	  3638  {
  3731	  3639    "input": 13,
  3732	  3640    "outputs": [33, 34, 35]
  3733	  3641  }
  3734	  3642  ```
  3735	  3643  
  3736	  3644  **Benefits:**
  3737	  3645  - Unified control of Fire TV content routing
  3738	  3646  - Show same Fire TV content on multiple displays
  3739	  3647  - Quick switching between Fire TV and other sources
  3740	  3648  - Coordinate Fire TV control with matrix routing
  3741	  3649  
  3742	  3650  ### API Endpoints
  3743	  3651  
  3744	  3652  #### Device Management
  3745	  3653  
  3746	  3654  **GET /api/firetv-devices**
  3747	  3655  - Retrieve all configured Fire TV devices
  3748	  3656  - Returns array of device objects with status
  3749	  3657  
  3750	  3658  **POST /api/firetv-devices**
  3751	  3659  - Add new Fire TV device
  3752	  3660  - Requires: name, ipAddress, port, deviceType
  3753	  3661  - Optional: inputChannel (matrix input)
  3754	  3662  - Validates IP format and prevents duplicates
  3755	  3663  
  3756	  3664  **PUT /api/firetv-devices**
  3757	  3665  - Update existing Fire TV device configuration
  3758	  3666  - Can modify all fields except device ID
  3759	  3667  
  3760	  3668  **DELETE /api/firetv-devices?id={deviceId}**
  3761	  3669  - Remove Fire TV device from system
  3762	  3670  - Device can be re-added anytime
  3763	  3671  
  3764	  3672  #### Remote Control
  3765	  3673  
  3766	  3674  **POST /api/firetv-devices/send-command**
  3767	  3675  Send remote control command to Fire TV:
  3768	  3676  ```json
  3769	  3677  {
  3770	  3678    "deviceId": "device_id",
  3771	  3679    "ipAddress": "192.168.5.131",
  3772	  3680    "port": 5555,
  3773	  3681    "command": "HOME"
  3774	  3682  }
  3775	  3683  ```
  3776	  3684  
  3777	  3685  **Supported Commands:**
  3778	  3686  - Navigation: UP, DOWN, LEFT, RIGHT, OK, BACK, HOME, MENU
  3779	  3687  - Media: PLAY_PAUSE, PLAY, PAUSE, REWIND, FAST_FORWARD
  3780	  3688  - Volume: VOL_UP, VOL_DOWN, MUTE
  3781	  3689  - Power: SLEEP, WAKEUP
  3782	  3690  
  3783	  3691  **App Launch:**
  3784	  3692  ```json
  3785	  3693  {
  3786	  3694    "deviceId": "device_id",
  3787	  3695    "ipAddress": "192.168.5.131",
  3788	  3696    "port": 5555,
  3789	  3697    "appPackage": "com.espn.score_center"
  3790	  3698  }
  3791	  3699  ```
  3792	  3700  
  3793	  3701  #### Connection Testing
  3794	  3702  
  3795	  3703  **POST /api/firetv-devices/test-connection**
  3796	  3704  Test connectivity to Fire TV device:
  3797	  3705  ```json
  3798	  3706  {
  3799	  3707    "ipAddress": "192.168.5.131",
  3800	  3708    "port": 5555,
  3801	  3709    "deviceId": "device_id"
  3802	  3710  }
  3803	  3711  ```
  3804	  3712  
  3805	  3713  **Success Response:**
  3806	  3714  ```json
  3807	  3715  {
  3808	  3716    "success": true,
  3809	  3717    "message": "Fire TV device connected via ADB",
  3810	  3718    "deviceInfo": {
  3811	  3719      "model": "AFTGAZL",
  3812	  3720      "version": "Fire OS 7.6.6.8"
  3813	  3721    }
  3814	  3722  }
  3815	  3723  ```
  3816	  3724  
  3817	  3725  #### Subscription Polling
  3818	  3726  
  3819	  3727  **POST /api/firetv-devices/subscriptions/poll**
  3820	  3728  Retrieve device status and installed apps:
  3821	  3729  ```json
  3822	  3730  {
  3823	  3731    "deviceId": "device_id",
  3824	  3732    "ipAddress": "192.168.5.131",
  3825	  3733    "port": 5555
  3826	  3734  }
  3827	  3735  ```
  3828	  3736  
  3829	  3737  ### Remote Control Commands
  3830	  3738  
  3831	  3739  **Navigation Commands:**
  3832	  3740  ```bash
  3833	  3741  # D-Pad Navigation
  3834	  3742  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_UP        # 19
  3835	  3743  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_DOWN      # 20
  3836	  3744  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_LEFT      # 21
  3837	  3745  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_RIGHT     # 22
  3838	  3746  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_CENTER    # 23 (OK/Select)
  3839	  3747  
  3840	  3748  # System Navigation
  3841	  3749  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_HOME           # 3
  3842	  3750  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_BACK           # 4
  3843	  3751  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MENU           # 82
  3844	  3752  ```
  3845	  3753  
  3846	  3754  **Media Controls:**
  3847	  3755  ```bash
  3848	  3756  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PLAY_PAUSE    # 85
  3849	  3757  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PLAY          # 126
  3850	  3758  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PAUSE         # 127
  3851	  3759  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_REWIND        # 89
  3852	  3760  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_FAST_FORWARD  # 90
  3853	  3761  ```
  3854	  3762  
  3855	  3763  **Volume Controls:**
  3856	  3764  ```bash
  3857	  3765  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_VOLUME_UP      # 24
  3858	  3766  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_VOLUME_DOWN    # 25
  3859	  3767  adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_VOLUME_MUTE    # 164
  3860	  3768  ```
  3861	  3769  
  3862	  3770  ### Streaming Apps Configuration
  3863	  3771  
  3864	  3772  **Sports Streaming Apps:**
  3865	  3773  - **ESPN** - `com.espn.score_center`
  3866	  3774  - **FOX Sports** - `com.fox.now`
  3867	  3775  - **NBC Sports** - `com.nbc.nbcsports.liveextra`
  3868	  3776  - **Paramount+** (CBS Sports) - `com.cbs.ott`
  3869	  3777  - **YouTube TV** - `com.google.android.youtube.tv`
  3870	  3778  
  3871	  3779  **League-Specific Apps:**
  3872	  3780  - **NFL+** - `com.nflmobile.nflnow`
  3873	  3781  - **NFL Game Pass** - `com.nfl.gamepass`
  3874	  3782  - **NBA League Pass** - `com.nba.game`
  3875	  3783  - **MLB.TV** - `com.bamnetworks.mobile.android.gameday.mlb`
  3876	  3784  - **NHL.TV** - `com.nhl.gc1112.free`
  3877	  3785  
  3878	  3786  **App Launch Commands:**
  3879	  3787  ```bash
  3880	  3788  # Launch ESPN
  3881	  3789  adb -s 192.168.5.131:5555 shell monkey -p com.espn.score_center 1
  3882	  3790  
  3883	  3791  # Launch Netflix
  3884	  3792  adb -s 192.168.5.131:5555 shell monkey -p com.netflix.ninja 1
  3885	  3793  
  3886	  3794  # Alternative method
  3887	  3795  adb -s 192.168.5.131:5555 shell am start -n com.espn.score_center/.MainActivity
  3888	  3796  ```
  3889	  3797  
  3890	  3798  ### Automation Capabilities
  3891	  3799  
  3892	  3800  **Scheduled App Launching:**
  3893	  3801  ```bash
  3894	  3802  # Crontab example: Launch ESPN at 7 PM daily
  3895	  3803  0 19 * * * curl -X POST http://localhost:3000/api/firetv-devices/send-command \
  3896	  3804    -H "Content-Type: application/json" \
  3897	  3805    -d '{"deviceId":"device_id","appPackage":"com.espn.score_center"}'
  3898	  3806  ```
  3899	  3807  
  3900	  3808  **Coordinated Control:**
  3901	  3809  ```bash
  3902	  3810  # Script for game day setup
  3903	  3811  #!/bin/bash
  3904	  3812  # 1. Route Fire TV to main bar TVs
  3905	  3813  curl -X POST http://localhost:3000/api/matrix/route \
  3906	  3814    -d '{"input":13,"outputs":[33,34,35]}'
  3907	  3815  
  3908	  3816  # 2. Launch sports app
  3909	  3817  curl -X POST http://localhost:3000/api/firetv-devices/send-command \
  3910	  3818    -d '{"deviceId":"device_id","appPackage":"com.espn.score_center"}'
  3911	  3819  ```
  3912	  3820  
  3913	  3821  ### Diagnostic Commands
  3914	  3822  
  3915	  3823  **Device Information:**
  3916	  3824  ```bash
  3917	  3825  # Get device model
  3918	  3826  adb -s 192.168.5.131:5555 shell getprop ro.product.model
  3919	  3827  # Output: AFTGAZL
  3920	  3828  
  3921	  3829  # Get Fire OS version
  3922	  3830  adb -s 192.168.5.131:5555 shell getprop ro.build.version.release
  3923	  3831  # Output: 9
  3924	  3832  
  3925	  3833  # Get all properties
  3926	  3834  adb -s 192.168.5.131:5555 shell getprop
  3927	  3835  
  3928	  3836  # Get device uptime
  3929	  3837  adb -s 192.168.5.131:5555 shell uptime
  3930	  3838  ```
  3931	  3839  
  3932	  3840  **Network Information:**
  3933	  3841  ```bash
  3934	  3842  # IP address details
  3935	  3843  adb -s 192.168.5.131:5555 shell ifconfig wlan0
  3936	  3844  
  3937	  3845  # Network interfaces
  3938	  3846  adb -s 192.168.5.131:5555 shell ip addr show
  3939	  3847  ```
  3940	  3848  
  3941	  3849  **Installed Apps:**
  3942	  3850  ```bash
  3943	  3851  # List all packages
  3944	  3852  adb -s 192.168.5.131:5555 shell pm list packages
  3945	  3853  
  3946	  3854  # User-installed apps only
  3947	  3855  adb -s 192.168.5.131:5555 shell pm list packages -3
  3948	  3856  
  3949	  3857  # Search for specific app
  3950	  3858  adb -s 192.168.5.131:5555 shell pm list packages | grep -i espn
  3951	  3859  ```
  3952	  3860  
  3953	  3861  **Current App Status:**
  3954	  3862  ```bash
  3955	  3863  # Get currently focused app
  3956	  3864  adb -s 192.168.5.131:5555 shell dumpsys window | grep mCurrentFocus
  3957	  3865  # Output: mCurrentFocus=Window{hash u0 package/activity}
  3958	  3866  ```
  3959	  3867  
  3960	  3868  ### Troubleshooting
  3961	  3869  
  3962	  3870  **Device Shows Offline:**
  3963	  3871  
  3964	  3872  1. **Verify Network Connectivity:**
  3965	  3873     ```bash
  3966	  3874     ping 192.168.5.131
  3967	  3875     # Should respond with low latency (< 50ms)
  3968	  3876     ```
  3969	  3877  
  3970	  3878  2. **Check ADB Status on Fire TV:**
  3971	  3879     - Settings → My Fire TV → Developer Options
  3972	  3880     - Ensure "ADB Debugging" is ON
  3973	  3881     - May auto-disable after system updates
  3974	  3882  
  3975	  3883  3. **Test Port Accessibility:**
  3976	  3884     ```bash
  3977	  3885     telnet 192.168.5.131 5555
  3978	  3886     # Or
  3979	  3887     nc -zv 192.168.5.131 5555
  3980	  3888     ```
  3981	  3889  
  3982	  3890  4. **Restart ADB Server:**
  3983	  3891     ```bash
  3984	  3892     adb kill-server
  3985	  3893     adb start-server
  3986	  3894     adb connect 192.168.5.131:5555
  3987	  3895     ```
  3988	  3896  
  3989	  3897  5. **Restart Fire TV:**
  3990	  3898     - Unplug Fire TV Cube for 30 seconds
  3991	  3899     - Plug back in, wait for full boot (2 minutes)
  3992	  3900     - Reconnect ADB
  3993	  3901  
  3994	  3902  **Commands Timeout:**
  3995	  3903  
  3996	  3904  1. Check network latency (should be < 100ms)
  3997	  3905  2. Verify Fire TV not overloaded (close background apps)
  3998	  3906  3. Test with simple command (HOME) first
  3999	  3907  4. Review PM2 logs for specific errors
  4000	  3908  
  4001	  3909  **Connection Drops:**
  4002	  3910  
  4003	  3911  1. **Use Static IP:**
  4004	  3912     - Assign static IP to Fire TV: 192.168.5.131
  4005	  3913     - Or use DHCP reservation based on MAC address
  4006	  3914  
  4007	  3915  2. **Improve Network:**
  4008	  3916     - Use Ethernet instead of Wi-Fi (recommended)
  4009	  3917     - Check for network congestion
  4010	  3918     - Verify no VLAN isolation
  4011	  3919  
  4012	  3920  3. **Keep-Alive Script:**
  4013	  3921     ```bash
  4014	  3922     # Run every 5 minutes via cron
  4015	  3923     */5 * * * * adb -s 192.168.5.131:5555 shell echo "keepalive" > /dev/null
  4016	  3924     ```
  4017	  3925  
  4018	  3926  ### Health Monitoring
  4019	  3927  
  4020	  3928  **Automated Health Check Script:**
  4021	  3929  ```bash
  4022	  3930  #!/bin/bash
  4023	  3931  # /home/ubuntu/scripts/firetv-health-check.sh
  4024	  3932  
  4025	  3933  DEVICE_IP="192.168.5.131"
  4026	  3934  DEVICE_PORT="5555"
  4027	  3935  LOG="/var/log/firetv-health.log"
  4028	  3936  
  4029	  3937  # Test connectivity
  4030	  3938  if ! adb devices | grep "$DEVICE_IP:$DEVICE_PORT" | grep "device" > /dev/null; then
  4031	  3939    echo "[$(date)] Fire TV offline - reconnecting" >> $LOG
  4032	  3940    adb connect $DEVICE_IP:$DEVICE_PORT >> $LOG
  4033	  3941  else
  4034	  3942    echo "[$(date)] Fire TV online" >> $LOG
  4035	  3943  fi
  4036	  3944  ```
  4037	  3945  
  4038	  3946  **Schedule with cron:**
  4039	  3947  ```bash
  4040	  3948  # Run every 5 minutes
  4041	  3949  */5 * * * * /home/ubuntu/scripts/firetv-health-check.sh
  4042	  3950  ```
  4043	  3951  
  4044	  3952  **Monitoring Metrics:**
  4045	  3953  - Connection status (online/offline)
  4046	  3954  - Response time (should be < 500ms)
  4047	  3955  - Command success rate (target > 95%)
  4048	  3956  - ADB connection stability
  4049	  3957  
  4050	  3958  ### Data Storage
  4051	  3959  
  4052	  3960  **Configuration File:**
  4053	  3961  - **Location:** `/data/firetv-devices.json`
  4054	  3962  - **Format:** JSON array of device objects
  4055	  3963  - **Backup:** Included in automated daily backups (3:00 AM)
  4056	  3964  - **Backup Location:** `/backups/` with timestamps
  4057	  3965  
  4058	  3966  **Device Object Structure:**
  4059	  3967  ```json
  4060	  3968  {
  4061	  3969    "id": "firetv_timestamp_hash",
  4062	  3970    "name": "Fire TV Cube Bar",
  4063	  3971    "ipAddress": "192.168.5.131",
  4064	  3972    "port": 5555,
  4065	  3973    "deviceType": "Fire TV Cube",
  4066	  3974    "inputChannel": "13",
  4067	  3975    "isOnline": true,
  4068	  3976    "adbEnabled": true,
  4069	  3977    "addedAt": "2025-10-16T10:30:00.000Z",
  4070	  3978    "updatedAt": "2025-10-16T12:00:00.000Z"
  4071	  3979  }
  4072	  3980  ```
  4073	  3981  
  4074	  3982  ### Best Practices
  4075	  3983  
  4076	  3984  **Network Configuration:**
  4077	  3985  - Use static IP address for Fire TV devices
  4078	  3986  - Ethernet connection preferred over Wi-Fi
  4079	  3987  - Ensure low latency (< 50ms) to Fire TV
  4080	  3988  - No firewall blocking port 5555
  4081	  3989  
  4082	  3990  **Device Management:**
  4083	  3991  - Keep ADB debugging enabled at all times
  4084	  3992  - Regular connectivity tests before events
  4085	  3993  - Monitor for system updates (may disable ADB)
  4086	  3994  - Restart Fire TV weekly during maintenance
  4087	  3995  
  4088	  3996  **Security:**
  4089	  3997  - Limit access to ADB port (5555) from external networks
  4090	  3998  - Use network segmentation for streaming devices
  4091	  3999  - Secure SSH access to controller server
  4092	  4000  - Monitor unauthorized ADB connection attempts
  4093	  4001  
  4094	  4002  **Performance:**
  4095	  4003  - Close unused apps regularly
  4096	  4004  - Clear cache monthly
  4097	  4005  - Monitor storage space (keep > 2GB free)
  4098	  4006  - Restart Fire TV during off-hours
  4099	  4007  
  4100	  4008  ### Integration with Sports Guide
  4101	  4009  
  4102	  4010  **Automated Content Selection:**
  4103	  4011  - Sports Guide can trigger Fire TV app launches
  4104	  4012  - Route Fire TV to appropriate displays based on schedule
  4105	  4013  - Coordinate multiple Fire TVs for multi-game viewing
  4106	  4014  - Automatic switching between streaming services
  4107	  4015  
  4108	  4016  **Game Day Workflow:**
  4109	  4017  1. Sports Guide identifies upcoming games
  4110	  4018  2. System determines which streaming service has content
  4111	  4019  3. Fire TV launches appropriate app
  4112	  4020  4. Matrix routes Fire TV to designated displays
  4113	  4021  5. Content ready for viewing at game time
  4114	  4022  
  4115	  4023  ### Documentation References
  4116	  4024  
  4117	  4025  **Comprehensive Documentation:**
  4118	  4026  - **Q&A Sheet:** `/home/ubuntu/amazon_firetv_qa_sheet.md`
  4119	  4027  - **ADB Bridge Setup:** `/home/ubuntu/firetv_ads_bridge_setup.md`
  4120	  4028  - **Testing Report:** `/home/ubuntu/firetv_testing_findings.md`
  4121	  4029  - **Total Q&A Pairs:** 95+ covering all aspects
  4122	  4030  
  4123	  4031  **Topics Covered:**
  4124	  4032  - Device setup and configuration
  4125	  4033  - ADB bridge installation and setup
  4126	  4034  - Matrix integration
  4127	  4035  - API endpoints reference
  4128	  4036  - Remote control commands
  4129	  4037  - Troubleshooting procedures
  4130	  4038  - Best practices for deployment
  4131	  4039  
  4132	  4040  ### Current Status
  4133	  4041  
  4134	  4042  **Production Environment:**
  4135	  4043  - ✅ Fire TV Cube connected and operational (192.168.5.131:5555)
  4136	  4044  - ✅ ADB bridge fully configured and tested
  4137	  4045  - ✅ Matrix integration active (Input 13)
  4138	  4046  - ✅ API endpoints operational
  4139	  4047  - ✅ Remote control commands working
  4140	  4048  - ✅ Form submission bugs fixed (October 15, 2025)
  4141	  4049  - ✅ CSS styling issues resolved
  4142	  4050  - ✅ Comprehensive documentation complete
  4143	  4051  
  4144	  4052  **Last Updated:** October 16, 2025
  4145	  4053  **Last Tested:** October 16, 2025
  4146	  4054  **Status:** Production Ready ✓
  4147	  4055  
  4148	  4056  ---
  4149	  4057  
  4150	  4058  
  4151	  4059  ---
  4152	  4060  
  4153	  4061  ## LATEST UPDATE: Sports Guide v5.0.0 - October 16, 2025
  4154	  4062  
  4155	  4063  ### Critical Fix Applied
  4156	  4064  
  4157	  4065  **Issue:** Sports Guide was not loading ANY data from The Rail Media API.
  4158	  4066  
  4159	  4067  **Root Cause:** Frontend/backend parameter mismatch - frontend sent `selectedLeagues`, backend expected `days/startDate/endDate`.
  4160	  4068  
  4161	  4069  **Solution:** Drastically simplified the entire system:
  4162	  4070  - ✅ **REMOVED** all league selection UI (800+ lines of code removed)
  4163	  4071  - ✅ **ADDED** automatic loading of ALL sports on page visit
  4164	  4072  - ✅ **ADDED** maximum verbosity logging for AI analysis
  4165	  4073  - ✅ **FIXED** both Sports Guide and Bartender Remote Channel Guide
  4166	  4074  
  4167	  4075  ### Results
  4168	  4076  
  4169	  4077  **Sports Guide (`/sports-guide`):**
  4170	  4078  - ✅ Auto-loads 7 days of ALL sports programming
  4171	  4079  - ✅ Displays 17+ sports categories
  4172	  4080  - ✅ Shows 361+ games with full details
  4173	  4081  - ✅ No user interaction required
  4174	  4082  - ✅ Simple search and refresh interface
  4175	  4083  
  4176	  4084  **Bartender Remote Channel Guide (`/remote` → Guide tab):**
  4177	  4085  - ✅ Successfully loads sports data from Rail Media API
  4178	  4086  - ✅ Shows device-specific channel numbers
  4179	  4087  - ✅ Cable/Satellite/Streaming support
  4180	  4088  - ✅ "Watch" button integration
  4181	  4089  
  4182	  4090  ### Testing Verified
  4183	  4091  
  4184	  4092  **Test Date:** October 16, 2025 at 4:29-4:30 AM
  4185	  4093  
  4186	  4094  **Sports Guide Test Results:**
  4187	  4095  - Loaded 17 sports, 361 games
  4188	  4096  - MLB Baseball: 18 games
  4189	  4097  - NBA Basketball: 22 games  
  4190	  4098  - NFL, NHL, College sports, Soccer, and more
  4191	  4099  - Load time: ~5 seconds
  4192	  4100  
  4193	  4101  **Bartender Remote Test Results:**
  4194	  4102  - Cable Box 1 guide loaded successfully
  4195	  4103  - MLB games displayed with channel numbers (FOXD 831, UniMas 806)
  4196	  4104  - NBA games displayed with channel numbers (ESPN2 28, NBALP)
  4197	  4105  - Watch buttons functional
  4198	  4106  
  4199	  4107  ### Architecture Changes (v5.0.0)
  4200	  4108  
  4201	  4109  **Before:**
  4202	  4110  ```
  4203	  4111  Frontend → { selectedLeagues: [...] }
  4204	  4112       ↓
  4205	  4113  API Route expects { days, startDate, endDate }
  4206	  4114       ↓
  4207	  4115  MISMATCH ❌ → No data
  4208	  4116  ```
  4209	  4117  
  4210	  4118  **After:**
  4211	  4119  ```
  4212	  4120  Frontend → Auto-load on mount → { days: 7 }
  4213	  4121       ↓
  4214	  4122  API Route → Fetch from Rail Media API
  4215	  4123       ↓
  4216	  4124  ALL sports data returned ✅
  4217	  4125       ↓
  4218	  4126  Display in both Sports Guide and Bartender Remote ✅
  4219	  4127  ```
  4220	  4128  
  4221	  4129  ### Maximum Verbosity Logging
  4222	  4130  
  4223	  4131  All API routes now include comprehensive timestamped logging:
  4224	  4132  - Every API request with full parameters
  4225	  4133  - Full API responses with data counts
  4226	  4134  - Error details with stack traces
  4227	  4135  - Performance timing
  4228	  4136  - Accessible via `pm2 logs sports-bar-tv`
  4229	  4137  
  4230	  4138  ### Files Modified
  4231	  4139  
  4232	  4140  1. `/src/app/api/sports-guide/route.ts` - Simplified auto-loading API
  4233	  4141  2. `/src/components/SportsGuide.tsx` - Removed league UI, added auto-loading
  4234	  4142  3. `/src/app/api/channel-guide/route.ts` - Integrated Rail Media API
  4235	  4143  
  4236	  4144  ### Deployment
  4237	  4145  
  4238	  4146  ```bash
  4239	  4147  cd /home/ubuntu/Sports-Bar-TV-Controller
  4240	  4148  npm run build
  4241	  4149  pm2 restart sports-bar-tv
  4242	  4150  ```
  4243	  4151  
  4244	  4152  **Status:** Application successfully rebuilt and restarted.
  4245	  4153  
  4246	  4154  ### Detailed Report
  4247	  4155  
  4248	  4156  See `SPORTS_GUIDE_FIX_REPORT.md` for complete technical details, testing results, and architecture diagrams.
  4249	  4157  
  4250	  4158  ---
  4251	  4159  
  4252	  4160  