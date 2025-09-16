=== TESTING SPORTS BAR TV CONTROLLER ENDPOINTS ===

## Main Dashboard Endpoints

### GET / (Main Dashboard)
Status: 200, Time: 0.005697s

### GET /api/status
{
  "available_inputs": {},
  "available_outputs": {},

### GET /api/inputs
{
  "error": "[Errno 2] No such file or directory: '/home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui/logs/sportsbar_av.log'"
}

### GET /api/outputs
{
  "error": "[Errno 2] No such file or directory: '/home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui/logs/sportsbar_av.log'"
}

## AI Agent Dashboard Endpoints

### GET /ai/ (AI Dashboard)
Status: 404, Time: 0.001268s

### GET /ai/api/status
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

### GET /ai/api/metrics
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

### GET /ai/api/events
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

## Sports Content Dashboard Endpoints

### GET /sports/ (Sports Dashboard)
Status: 404, Time: 0.001497s

### GET /sports/api/live
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

### GET /sports/api/upcoming
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

### GET /sports/api/stats
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

## Backend API Endpoints (FastAPI)

### GET /layout
<!doctype html>
<html lang=en>
<title>404 Not Found</title>

### GET /docs (FastAPI Documentation)
Status: 404, Time: 0.001129s

### GET /openapi.json (OpenAPI Schema)
Status: 404, Time: 0.001272s

## Service Health Check

### Running Services:
```
COMMAND   PID   USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
python  13256 ubuntu    5u  IPv4 11373273      0t0  TCP *:5000 (LISTEN)
python  13278 ubuntu    5u  IPv4 11373273      0t0  TCP *:5000 (LISTEN)
python  13278 ubuntu    6u  IPv4 11373273      0t0  TCP *:5000 (LISTEN)
python  13278 ubuntu   16u  IPv4 11525615      0t0  TCP localhost:5000->localhost:49076 (ESTABLISHED)
chrome  14511 ubuntu   23u  IPv4 11525056      0t0  TCP localhost:49076->localhost:5000 (ESTABLISHED)
```

### Additional Endpoint Tests:

#### GET /toggle_sync
Status: 500, Time: 0.004106s

#### GET /preset/big_game
Status: 500, Time: 0.003181s

