# DirecTV Quick Fix Guide

## TL;DR - What's Wrong?

Only **2 out of 8** DirecTV boxes are working (25%). Here's why and how to fix:

### Quick Status
- **TV 1 & TV 2** ✅ WORKING (192.168.5.121, 192.168.5.122)
- **TV 5 & TV 8** ⚠️ ONLINE but API disabled - **EASY FIX**
- **TV 3, 4, 6, 7** ❌ OFFLINE - need investigation

---

## 🔥 IMMEDIATE FIXES (10 minutes total)

### Fix #1: Enable SHEF API on TV 5 (192.168.1.125)
**Impact:** +1 box online (25% → 37% operational)

**Steps:**
1. Navigate to receiver menu
2. Go to: **Settings → Network → Network Remote Control**
3. **Enable** the option
4. Exit menu and wait 10 seconds
5. Test: `curl http://192.168.1.125:8080/info/getVersion`

**Alternative path:**
- **Menu → Settings → Whole-Home → External Device → SHEF → Enable**

---

### Fix #2: Enable SHEF API on TV 8 (192.168.1.128)
**Impact:** +1 box online (37% → 50% operational)

**Steps:** Same as Fix #1, but for TV 8
- Test: `curl http://192.168.1.128:8080/info/getVersion`

---

### Fix #3: Check TV 3 Power (192.168.5.123)
**Impact:** Potentially +1 box online (50% → 62% operational)

**Steps:**
1. Physically check if receiver is powered on
2. Look for lights on front panel
3. If off, power on and wait 2 minutes for boot
4. Test: `ping 192.168.5.123`

---

## 🔍 INVESTIGATION NEEDED (15-30 minutes)

### TV 4, 6, 7 - Not Responding to Network

**Problem:** These Genie DVRs are not reachable on network

**Possible Causes:**
1. IP addresses have changed (most likely)
2. Receivers are powered off
3. Network cables disconnected

**How to Fix:**

#### Step 1: Check IP Address on Each Receiver
1. Press **MENU** on DirecTV remote
2. Navigate to: **Settings → Info & Test → Network**
3. Write down the **IP Address** shown
4. Note if it's different from expected:
   - TV 4 expected: 192.168.1.124
   - TV 6 expected: 192.168.1.126
   - TV 7 expected: 192.168.1.127

#### Step 2: Update Configuration File
If IPs are different, update this file:
```
/home/ubuntu/Sports-Bar-TV-Controller/data/directv-devices.json
```

Find each device entry and update the `ipAddress` field.

#### Step 3: Re-test
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/test-all-directv-boxes.ts
```

---

## 📊 Expected Results After Fixes

| Stage | Boxes Online | Percentage | Status |
|-------|--------------|------------|--------|
| **Current** | 2/8 | 25% | ⚠️ Critical |
| **After SHEF fixes** | 4/8 | 50% | ⚠️ Needs work |
| **After IP fixes** | 7-8/8 | 87-100% | ✅ Operational |

---

## 🧪 Testing Commands

### Test a specific box:
```bash
# Test ping
ping -c 1 192.168.5.121

# Test port 8080
nc -zv 192.168.5.121 8080

# Test SHEF API
curl http://192.168.5.121:8080/info/getVersion
```

### Run full diagnostic:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/test-all-directv-boxes.ts
```

### Query online boxes for details:
```bash
npx tsx scripts/query-online-directv.ts
```

---

## 📋 Checklist

**Priority 1 - Immediate (Today):**
- [ ] Enable SHEF API on TV 5 (192.168.1.125)
- [ ] Enable SHEF API on TV 8 (192.168.1.128)
- [ ] Check if TV 3 is powered on (192.168.5.123)
- [ ] Run diagnostic script to verify improvements

**Priority 2 - This Week:**
- [ ] Check IP address on TV 4 (expected 192.168.1.124)
- [ ] Check IP address on TV 6 (expected 192.168.1.126)
- [ ] Check IP address on TV 7 (expected 192.168.1.127)
- [ ] Update directv-devices.json with correct IPs
- [ ] Enable SHEF API on all boxes if not already enabled
- [ ] Run final diagnostic to confirm 100% operational

**Priority 3 - Long Term:**
- [ ] Consider moving all boxes to 192.168.5.x subnet
- [ ] Set up DHCP reservations (static IPs)
- [ ] Implement automated health monitoring

---

## 🆘 Troubleshooting

### "Connection Refused" error
- **Cause:** Port 8080 is closed
- **Fix:** Enable SHEF API in receiver settings

### "Network Unreachable" or "Timeout" error
- **Cause:** Device is offline or wrong IP
- **Fix:** Check power, verify IP address on receiver

### "Port already in use" error
- **Cause:** Another service using port 8080
- **Fix:** Not applicable for DirecTV boxes

---

## 📞 Support Information

**DirecTV SHEF API Version:** 1.12
**Software Version (TV 1 & 2):** 0xf3e
**Server IP:** 192.168.5.99

**Working Boxes:**
- Direct TV 1: 192.168.5.121 (h24/100)
- Direct TV 2: 192.168.5.122 (h24/100)

**Non-Working Boxes:**
- Direct TV 3: 192.168.5.123 (h24/100) - OFFLINE
- Direct TV 4: 192.168.1.124 (Genie) - OFFLINE
- Direct TV 5: 192.168.1.125 (Genie) - **SHEF DISABLED**
- Direct TV 6: 192.168.1.126 (Genie) - OFFLINE
- Direct TV 7: 192.168.1.127 (Genie) - OFFLINE
- Direct TV 8: 192.168.1.128 (Genie) - **SHEF DISABLED**

---

## 📁 Related Files

- **Full Report:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/final-directv-report.md`
- **Summary:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/directv-status-summary.txt`
- **Test Script:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/test-all-directv-boxes.ts`
- **Query Script:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/query-online-directv.ts`
- **Config File:** `/home/ubuntu/Sports-Bar-TV-Controller/data/directv-devices.json`

---

**Last Updated:** November 19, 2025
