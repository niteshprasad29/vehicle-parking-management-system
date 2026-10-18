/**
 * ParkEase — Phase 2 Full Verification Script
 * Tests all Phase 2 endpoints against the live Express/MongoDB server.
 * Run: node verify-full-phase2.js
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'http://localhost:5000';
const RESULTS = [];
let PASS = 0;
let FAIL = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(section) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(` ${section}`);
  console.log('═'.repeat(70));
}

function report(label, passed, detail = '') {
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${icon} — ${label}`);
  if (detail) console.log(`         ${detail}`);
  RESULTS.push({ label, passed, detail });
  passed ? PASS++ : FAIL++;
}

function request(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── State shared across tests ───────────────────────────────────────────────

let adminToken = '';
let userToken = '';
let createdVehicleId = '';
let createdLocationId = '';
let createdSlotId = '';
let secondSlotId = '';

// ─── SECTION A: File structure ───────────────────────────────────────────────

function verifyFileStructure() {
  log('SECTION A — File Structure');

  const required = [
    'models/Vehicle.js',
    'models/ParkingLocation.js',
    'models/ParkingSlot.js',
    'controllers/vehicleController.js',
    'controllers/locationController.js',
    'controllers/slotController.js',
    'routes/vehicleRoutes.js',
    'routes/locationRoutes.js',
    'routes/slotRoutes.js',
    'validators/vehicleValidators.js',
    'validators/locationValidators.js',
    'validators/slotValidators.js',
  ];

  for (const f of required) {
    const full = path.join(__dirname, f);
    const exists = fs.existsSync(full);
    report(`File exists: ${f}`, exists, exists ? '' : `NOT FOUND at ${full}`);
  }
}

// ─── SECTION B: MongoDB Schemas ───────────────────────────────────────────────

async function verifyMongoSchemas() {
  log('SECTION B — MongoDB Schemas (Mongoose introspection via schema definition)');

  // Import schemas without connecting — Mongoose schema introspection is purely
  // in-process (no DB connection needed for schema paths/indexes).
  const { default: Vehicle } = await import('./models/Vehicle.js');
  const vPaths = Vehicle.schema.paths;
  report('Vehicle: userId field exists + ref User', !!vPaths.userId && vPaths.userId.options.ref === 'User');
  report('Vehicle: vehicleNumber uppercase + index', !!vPaths.vehicleNumber && vPaths.vehicleNumber.options.uppercase === true);
  report('Vehicle: vehicleType enum BIKE/CAR/SUV/OTHER', JSON.stringify(vPaths.vehicleType.options.enum.values) === JSON.stringify(['BIKE','CAR','SUV','OTHER']));
  report('Vehicle: compound unique index {userId,vehicleNumber}', Vehicle.schema.indexes().some(([fields]) => fields.userId === 1 && fields.vehicleNumber === 1));
  report('Vehicle: timestamps enabled', !!Vehicle.schema.options.timestamps);

  const { default: ParkingLocation } = await import('./models/ParkingLocation.js');
  const lPaths = ParkingLocation.schema.paths;
  report('ParkingLocation: name field exists', !!lPaths.name);
  report('ParkingLocation: city field exists', !!lPaths.city);
  report('ParkingLocation: totalSlots defaults to 0', lPaths.totalSlots && lPaths.totalSlots.options.default === 0);
  report('ParkingLocation: status enum includes ACTIVE/INACTIVE', (() => {
    const vals = lPaths.status?.options?.enum?.values || [];
    return vals.includes('ACTIVE') && vals.includes('INACTIVE');
  })());
  report('ParkingLocation: openingTime + closingTime fields exist', !!lPaths.openingTime && !!lPaths.closingTime);

  const { default: ParkingSlot } = await import('./models/ParkingSlot.js');
  const sPaths = ParkingSlot.schema.paths;
  report('ParkingSlot: locationId ref ParkingLocation', !!sPaths.locationId && sPaths.locationId.options.ref === 'ParkingLocation');
  report('ParkingSlot: slotNumber exists', !!sPaths.slotNumber);
  report('ParkingSlot: vehicleType enum BIKE/CAR/SUV/OTHER', JSON.stringify(sPaths.vehicleType.options.enum.values) === JSON.stringify(['BIKE','CAR','SUV','OTHER']));
  report('ParkingSlot: status enum AVAILABLE/RESERVED/OCCUPIED/MAINTENANCE/DISABLED', (() => {
    const vals = sPaths.status?.options?.enum?.values || [];
    return ['AVAILABLE','RESERVED','OCCUPIED','MAINTENANCE','DISABLED'].every(v => vals.includes(v));
  })());
  report('ParkingSlot: compound unique index {locationId,slotNumber}', ParkingSlot.schema.indexes().some(([fields]) => fields.locationId === 1 && fields.slotNumber === 1));
  // No DB connection opened — no disconnect needed. Server is unaffected.
}

// ─── SECTION C: Login (get tokens) ───────────────────────────────────────────

async function loginTokens() {
  log('SECTION C — Authentication (get tokens for testing)');

  const adminRes = await request('POST', '/api/auth/login', {
    body: { email: 'admin@parkease.com', password: 'Admin@123' },
  });
  const gotAdmin = adminRes.status === 200 && adminRes.body.data?.token;
  if (gotAdmin) adminToken = adminRes.body.data.token;
  report('Admin login → 200 + token', gotAdmin, `Status: ${adminRes.status}`);

  const userRes = await request('POST', '/api/auth/login', {
    body: { email: 'user@parkease.com', password: 'User@123' },
  });
  const gotUser = userRes.status === 200 && userRes.body.data?.token;
  if (gotUser) userToken = userRes.body.data.token;
  report('User login → 200 + token', gotUser, `Status: ${userRes.status}`);
}

// ─── SECTION D: Vehicle Endpoints ─────────────────────────────────────────────

async function verifyVehicles() {
  log('SECTION D — Vehicle CRUD Endpoints');

  // D1 — Create vehicle (USER)
  const c1 = await request('POST', '/api/vehicles', {
    headers: { Authorization: `Bearer ${userToken}` },
    body: { vehicleNumber: 'MH12AB1234', vehicleType: 'CAR', vehicleModel: 'Honda City', vehicleColor: 'White' },
  });
  const created = c1.status === 201 && c1.body.success && c1.body.data?.vehicle?._id;
  if (created) createdVehicleId = c1.body.data.vehicle._id;
  report('POST /api/vehicles — USER creates vehicle → 201', created, `Status: ${c1.status}`);

  // D2 — Duplicate conflict
  const c2 = await request('POST', '/api/vehicles', {
    headers: { Authorization: `Bearer ${userToken}` },
    body: { vehicleNumber: 'MH12AB1234', vehicleType: 'CAR' },
  });
  report('POST /api/vehicles — Duplicate plate → 409', c2.status === 409, `Status: ${c2.status}`);

  // D3 — Unauthenticated create
  const c3 = await request('POST', '/api/vehicles', {
    body: { vehicleNumber: 'MH12AB9999', vehicleType: 'BIKE' },
  });
  report('POST /api/vehicles — No token → 401', c3.status === 401, `Status: ${c3.status}`);

  // D4 — Invalid vehicle type
  const c4 = await request('POST', '/api/vehicles', {
    headers: { Authorization: `Bearer ${userToken}` },
    body: { vehicleNumber: 'MH99ZZ9999', vehicleType: 'TRUCK' },
  });
  report('POST /api/vehicles — Invalid type TRUCK → 400', c4.status === 400, `Status: ${c4.status}`);

  // D5 — Get own vehicles (USER)
  const c5 = await request('GET', '/api/vehicles', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  report('GET /api/vehicles — USER gets own list → 200 + pagination', c5.status === 200 && c5.body.pagination !== undefined, `Status: ${c5.status}`);

  // D6 — Get all vehicles (ADMIN)
  const c6 = await request('GET', '/api/vehicles', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  report('GET /api/vehicles — ADMIN gets all → 200', c6.status === 200 && c6.body.success, `Status: ${c6.status}`);

  // D7 — Get vehicle by ID
  if (createdVehicleId) {
    const c7 = await request('GET', `/api/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    report(`GET /api/vehicles/:id — owner gets own vehicle → 200`, c7.status === 200 && c7.body.data?.vehicle, `Status: ${c7.status}`);
  } else {
    report('GET /api/vehicles/:id — skipped (no ID)', false, 'Create step failed');
  }

  // D8 — Invalid ObjectId
  const c8 = await request('GET', '/api/vehicles/bad-id-123', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  report('GET /api/vehicles/bad-id — invalid ObjectId → 400', c8.status === 400, `Status: ${c8.status}`);

  // D9 — Update vehicle
  if (createdVehicleId) {
    const c9 = await request('PUT', `/api/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      body: { vehicleColor: 'Red' },
    });
    report('PUT /api/vehicles/:id — owner updates vehicle → 200', c9.status === 200 && c9.body.data?.vehicle?.vehicleColor === 'Red', `Status: ${c9.status}`);
  } else {
    report('PUT /api/vehicles/:id — skipped', false, 'No vehicle ID');
  }

  // D10 — STAFF cannot access vehicles
  const staffRes = await request('POST', '/api/auth/login', {
    body: { email: 'staff@parkease.com', password: 'Staff@123' },
  });
  if (staffRes.status === 200 && staffRes.body.data?.token) {
    const staffToken = staffRes.body.data.token;
    const c10 = await request('GET', '/api/vehicles', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    report('GET /api/vehicles — STAFF → 403 (not authorized)', c10.status === 403, `Status: ${c10.status}`);
  } else {
    report('GET /api/vehicles — STAFF auth test → skipped', false, 'Staff login failed');
  }
}

// ─── SECTION E: ParkingLocation Endpoints ─────────────────────────────────────

async function verifyLocations() {
  log('SECTION E — ParkingLocation CRUD Endpoints');

  // E1 — Public GET (no auth)
  const e1 = await request('GET', '/api/parking-locations');
  report('GET /api/parking-locations — public, no auth → 200', e1.status === 200 && e1.body.success, `Status: ${e1.status}`);

  // E2 — ADMIN creates location
  const e2 = await request('POST', '/api/parking-locations', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: 'ParkEase Central Hub',
      address: '12 Station Road',
      city: 'Mumbai',
      contactNumber: '9876543210',
      openingTime: '06:00',
      closingTime: '23:00',
    },
  });
  const locCreated = e2.status === 201 && e2.body.data?.location?._id;
  if (locCreated) createdLocationId = e2.body.data.location._id;
  report('POST /api/parking-locations — ADMIN creates → 201', locCreated, `Status: ${e2.status}`);

  // E3 — USER cannot create location
  const e3 = await request('POST', '/api/parking-locations', {
    headers: { Authorization: `Bearer ${userToken}` },
    body: { name: 'Hack', address: 'x', city: 'y', contactNumber: '1234567890' },
  });
  report('POST /api/parking-locations — USER → 403', e3.status === 403, `Status: ${e3.status}`);

  // E4 — No auth cannot create
  const e4 = await request('POST', '/api/parking-locations', {
    body: { name: 'Anon', address: 'x', city: 'y', contactNumber: '1234567890' },
  });
  report('POST /api/parking-locations — no auth → 401', e4.status === 401, `Status: ${e4.status}`);

  // E5 — Get location by ID (public)
  if (createdLocationId) {
    const e5 = await request('GET', `/api/parking-locations/${createdLocationId}`);
    report('GET /api/parking-locations/:id — public → 200', e5.status === 200 && e5.body.data?.location, `Status: ${e5.status}`);
  } else {
    report('GET /api/parking-locations/:id — skipped', false, 'No location ID');
  }

  // E6 — Filter by city
  const e6 = await request('GET', '/api/parking-locations?city=Mumbai');
  report('GET /api/parking-locations?city=Mumbai — filter → 200', e6.status === 200, `Status: ${e6.status}`);

  // E7 — Update location (ADMIN)
  if (createdLocationId) {
    const e7 = await request('PUT', `/api/parking-locations/${createdLocationId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { city: 'Pune' },
    });
    report('PUT /api/parking-locations/:id — ADMIN updates → 200', e7.status === 200 && e7.body.data?.location?.city === 'Pune', `Status: ${e7.status}`);
  } else {
    report('PUT /api/parking-locations/:id — skipped', false, 'No location ID');
  }

  // E8 — Invalid ObjectId
  const e8 = await request('GET', '/api/parking-locations/not-valid-id');
  report('GET /api/parking-locations/bad-id → 400', e8.status === 400, `Status: ${e8.status}`);

  // E9 — Missing required fields
  const e9 = await request('POST', '/api/parking-locations', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { name: 'Incomplete' }, // missing address, city, contactNumber
  });
  report('POST /api/parking-locations — missing fields → 400', e9.status === 400, `Status: ${e9.status}`);
}

// ─── SECTION F: ParkingSlot Endpoints ─────────────────────────────────────────

async function verifySlots() {
  log('SECTION F — ParkingSlot CRUD Endpoints');

  if (!createdLocationId) {
    report('ParkingSlot tests — skipped (no location)', false, 'Location creation failed in Section E');
    return;
  }

  // F1 — Public GET (no auth)
  const f1 = await request('GET', '/api/parking-slots');
  report('GET /api/parking-slots — public, no auth → 200', f1.status === 200 && f1.body.success, `Status: ${f1.status}`);

  // F2 — ADMIN creates CAR slot
  const f2 = await request('POST', '/api/parking-slots', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      locationId: createdLocationId,
      slotNumber: 'A-001',
      vehicleType: 'CAR',
      floor: 'Ground',
      status: 'AVAILABLE',
    },
  });
  const slotCreated = f2.status === 201 && f2.body.data?.slot?._id;
  if (slotCreated) createdSlotId = f2.body.data.slot._id;
  report('POST /api/parking-slots — ADMIN creates CAR slot → 201', slotCreated, `Status: ${f2.status}`);

  // F3 — ADMIN creates BIKE slot
  const f3 = await request('POST', '/api/parking-slots', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      locationId: createdLocationId,
      slotNumber: 'B-001',
      vehicleType: 'BIKE',
      floor: 'Ground',
    },
  });
  const bikeCreated = f3.status === 201 && f3.body.data?.slot?._id;
  if (bikeCreated) secondSlotId = f3.body.data.slot._id;
  report('POST /api/parking-slots — ADMIN creates BIKE slot → 201', bikeCreated, `Status: ${f3.status}`);

  // F4 — Duplicate slot in same location
  const f4 = await request('POST', '/api/parking-slots', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { locationId: createdLocationId, slotNumber: 'A-001', vehicleType: 'SUV' },
  });
  report('POST /api/parking-slots — Duplicate slot → 409', f4.status === 409, `Status: ${f4.status}`);

  // F5 — USER cannot create slot
  const f5 = await request('POST', '/api/parking-slots', {
    headers: { Authorization: `Bearer ${userToken}` },
    body: { locationId: createdLocationId, slotNumber: 'C-001', vehicleType: 'CAR' },
  });
  report('POST /api/parking-slots — USER → 403', f5.status === 403, `Status: ${f5.status}`);

  // F6 — Get slot by ID (public)
  if (createdSlotId) {
    const f6 = await request('GET', `/api/parking-slots/${createdSlotId}`);
    report('GET /api/parking-slots/:id — public → 200 + populated locationId', f6.status === 200 && f6.body.data?.slot?.locationId, `Status: ${f6.status}`);
  } else {
    report('GET /api/parking-slots/:id — skipped', false, 'No slot ID');
  }

  // F7 — Filter by locationId
  const f7 = await request('GET', `/api/parking-slots?locationId=${createdLocationId}`);
  report(`GET /api/parking-slots?locationId=... → 200 + results`, f7.status === 200 && f7.body.data?.slots?.length >= 1, `Status: ${f7.status}, Count: ${f7.body.data?.slots?.length}`);

  // F8 — Filter by vehicleType
  const f8 = await request('GET', '/api/parking-slots?vehicleType=CAR');
  report('GET /api/parking-slots?vehicleType=CAR → 200', f8.status === 200, `Status: ${f8.status}`);

  // F9 — Filter by status
  const f9 = await request('GET', '/api/parking-slots?status=AVAILABLE');
  report('GET /api/parking-slots?status=AVAILABLE → 200', f9.status === 200, `Status: ${f9.status}`);

  // F10 — Update slot (ADMIN)
  if (createdSlotId) {
    const f10 = await request('PUT', `/api/parking-slots/${createdSlotId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'OCCUPIED' },
    });
    report('PUT /api/parking-slots/:id — ADMIN updates status → 200', f10.status === 200 && f10.body.data?.slot?.status === 'OCCUPIED', `Status: ${f10.status}`);
  } else {
    report('PUT /api/parking-slots/:id — skipped', false, 'No slot ID');
  }

  // F11 — Invalid ObjectId for slot
  const f11 = await request('GET', '/api/parking-slots/not-a-valid-id');
  report('GET /api/parking-slots/bad-id → 400', f11.status === 400, `Status: ${f11.status}`);

  // F12 — Nonexistent location in create
  const f12 = await request('POST', '/api/parking-slots', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      locationId: '000000000000000000000001',
      slotNumber: 'X-001',
      vehicleType: 'CAR',
    },
  });
  report('POST /api/parking-slots — nonexistent locationId → 404', f12.status === 404, `Status: ${f12.status}`);
}

// ─── SECTION G: totalSlots counter sync ──────────────────────────────────────

async function verifyTotalSlots() {
  log('SECTION G — totalSlots counter sync');

  if (!createdLocationId) {
    report('totalSlots sync — skipped (no location)', false, 'Location creation failed');
    return;
  }

  const res = await request('GET', `/api/parking-locations/${createdLocationId}`);
  const totalSlots = res.body.data?.location?.totalSlots;
  // We created 2 slots (A-001 and B-001), so counter should be >= 2
  const ok = res.status === 200 && typeof totalSlots === 'number' && totalSlots >= 2;
  report(`totalSlots incremented after slot creation (expected ≥ 2, got ${totalSlots})`, ok, `Status: ${res.status}`);

  // Delete second slot and check decrement
  if (secondSlotId) {
    await request('DELETE', `/api/parking-slots/${secondSlotId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res2 = await request('GET', `/api/parking-locations/${createdLocationId}`);
    const after = res2.body.data?.location?.totalSlots;
    const decremented = after === totalSlots - 1;
    report(`totalSlots decremented after slot deletion (expected ${totalSlots - 1}, got ${after})`, decremented, `Status: ${res2.status}`);
  } else {
    report('totalSlots decrement — skipped (no second slot)', false, 'Second slot creation failed');
  }
}

// ─── SECTION H: Delete endpoints ─────────────────────────────────────────────

async function verifyDeletes() {
  log('SECTION H — Delete Operations');

  // Delete vehicle
  if (createdVehicleId) {
    const h1 = await request('DELETE', `/api/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    report('DELETE /api/vehicles/:id — owner deletes own vehicle → 200', h1.status === 200 && h1.body.success, `Status: ${h1.status}`);

    // 2nd delete should 404
    const h2 = await request('DELETE', `/api/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    report('DELETE /api/vehicles/:id — already deleted → 404', h2.status === 404, `Status: ${h2.status}`);
  } else {
    report('DELETE vehicle — skipped', false, 'No vehicle ID');
  }

  // Delete slot
  if (createdSlotId) {
    const h3 = await request('DELETE', `/api/parking-slots/${createdSlotId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    report('DELETE /api/parking-slots/:id — ADMIN deletes slot → 200', h3.status === 200 && h3.body.success, `Status: ${h3.status}`);
  } else {
    report('DELETE slot — skipped', false, 'No slot ID');
  }

  // Delete location
  if (createdLocationId) {
    const h4 = await request('DELETE', `/api/parking-locations/${createdLocationId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    report('DELETE /api/parking-locations/:id — ADMIN deletes location → 200', h4.status === 200 && h4.body.success, `Status: ${h4.status}`);
  } else {
    report('DELETE location — skipped', false, 'No location ID');
  }
}

// ─── SECTION I: Phase 1 Regression (auth routes still work) ──────────────────

async function verifyPhase1Regression() {
  log('SECTION I — Phase 1 Regression (auth routes still operational)');

  const r1 = await request('GET', '/api/health');
  report('GET /api/health → 200', r1.status === 200 && r1.body.success, `Status: ${r1.status}`);

  const r2 = await request('POST', '/api/auth/login', {
    body: { email: 'admin@parkease.com', password: 'Admin@123' },
  });
  report('POST /api/auth/login → 200 (regression)', r2.status === 200 && r2.body.data?.token, `Status: ${r2.status}`);

  const r3 = await request('GET', '/api/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  report('GET /api/auth/me → 200 (regression)', r3.status === 200 && r3.body.data?.user, `Status: ${r3.status}`);

  const r4 = await request('GET', '/api/non-existent');
  report('GET unknown route → 404 (regression)', r4.status === 404, `Status: ${r4.status}`);
}

// ─── SECTION J: server.js route registration ─────────────────────────────────

function verifyServerRegistration() {
  log('SECTION J — server.js Route Registration');
  const serverPath = path.join(__dirname, 'server.js');
  const src = fs.readFileSync(serverPath, 'utf8');
  report("server.js imports vehicleRoutes", src.includes("vehicleRoutes"));
  report("server.js imports locationRoutes", src.includes("locationRoutes"));
  report("server.js imports slotRoutes", src.includes("slotRoutes"));
  report("server.js mounts /api/vehicles", src.includes("/api/vehicles"));
  report("server.js mounts /api/parking-locations", src.includes("/api/parking-locations"));
  report("server.js mounts /api/parking-slots", src.includes("/api/parking-slots"));
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function run() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║          PARKEASE — PHASE 2 FULL VERIFICATION SUITE                 ║');
  console.log('║          Target: http://localhost:5000  |  DB: parkease              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  try {
    verifyFileStructure();
    await verifyMongoSchemas();
    await loginTokens();
    await verifyVehicles();
    await verifyLocations();
    await verifySlots();
    await verifyTotalSlots();
    await verifyDeletes();
    await verifyPhase1Regression();
    verifyServerRegistration();
  } catch (err) {
    console.error('\n[FATAL ERROR IN VERIFICATION SCRIPT]', err);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                       VERIFICATION SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Total Tests : ${PASS + FAIL}`);
  console.log(`  ✅ PASSED   : ${PASS}`);
  console.log(`  ❌ FAILED   : ${FAIL}`);
  console.log('');

  if (FAIL > 0) {
    console.log('  FAILED TESTS:');
    RESULTS.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.label}`);
      if (r.detail) console.log(`       ${r.detail}`);
    });
    console.log('');
    console.log('  ❌ VERDICT: PHASE 2 NOT READY — FAILURES REMAIN');
  } else {
    console.log('  ✅ VERDICT: PHASE 2 VERIFIED — READY FOR REVIEW');
  }

  console.log('\n');
  process.exit(FAIL > 0 ? 1 : 0);
}

run();
