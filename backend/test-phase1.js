import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

const runTests = async () => {
  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  console.log('================================================================');
  console.log(' STARTING PHASE 1 AUTOMATED VERIFICATION TESTS');
  console.log('================================================================\n');

  try {
    // 1. Health Check
    console.log('TEST 1: Health Check Endpoint');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthData.success === true, 'Health check returns success: true');
    assert(healthData.data.database === 'Connected', 'Database reports Connected');

    // 2. User Registration
    console.log('\nTEST 2: Customer Registration');
    const uniqueEmail = `test.user.${Date.now()}@parkease.com`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Verification User',
        email: uniqueEmail,
        phone: '+91 9123456780',
        password: 'Pass@123',
        confirmPassword: 'Pass@123',
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'Registration returns HTTP 201 Created');
    assert(regData.success === true, 'Registration success is true');
    assert(typeof regData.data.token === 'string', 'JWT token is returned on register');
    assert(regData.data.user.email === uniqueEmail, 'Correct user email returned');
    assert(regData.data.user.password === undefined, 'Password is NOT exposed in response');

    // 3. Direct DB Check: Password Hashing Verification
    console.log('\nTEST 3: Database Verification (Bcrypt Hashing)');
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const dbUser = await User.findOne({ email: uniqueEmail }).select('+password');
    assert(dbUser !== null, 'User found in real MongoDB');
    assert(dbUser.password.startsWith('$2'), 'Password is encrypted using bcrypt ($2a/b hash)');
    assert(dbUser.password !== 'Pass@123', 'Password is not stored in plain text');
    await mongoose.disconnect();

    // 4. Duplicate Registration
    console.log('\nTEST 4: Duplicate Email Rejection');
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: uniqueEmail,
        phone: '+91 9123456789',
        password: 'Pass@123',
        confirmPassword: 'Pass@123',
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, 'Duplicate registration returns HTTP 409 Conflict');
    assert(dupData.success === false, 'Duplicate response success is false');

    // 5. Validation Failure: Password Mismatch
    console.log('\nTEST 5: Registration Validation (Password Mismatch)');
    const valRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mismatch User',
        email: `mismatch.${Date.now()}@parkease.com`,
        phone: '+91 9123456789',
        password: 'Pass@123',
        confirmPassword: 'DifferentPass@123',
      }),
    });
    assert(valRes.status === 400, 'Validation mismatch returns HTTP 400 Bad Request');

    // 6. Login with Correct Credentials
    console.log('\nTEST 6: Login with Correct Credentials');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Pass@123',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Login returns HTTP 200 OK');
    assert(loginData.success === true, 'Login success is true');
    assert(typeof loginData.data.token === 'string', 'JWT token returned on login');
    assert(loginData.data.user.password === undefined, 'Password is NOT exposed in login response');
    const userToken = loginData.data.token;

    // 7. Login with Wrong Password
    console.log('\nTEST 7: Login with Incorrect Password');
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'WrongPassword!',
      }),
    });
    assert(wrongPassRes.status === 401, 'Wrong password returns HTTP 401 Unauthorized');

    // 8. Login with Inactive User
    console.log('\nTEST 8: Login with Inactive Account');
    const inactiveRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'inactive@parkease.com',
        password: 'User@123',
      }),
    });
    const inactiveData = await inactiveRes.json();
    assert(inactiveRes.status === 403, 'Inactive user login returns HTTP 403 Forbidden');
    assert(inactiveData.message.includes('disabled'), 'Clear account disabled message returned');

    // 9. Profile /me with Valid Token
    console.log('\nTEST 9: GET /api/auth/me with Valid JWT');
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /me returns HTTP 200 OK');
    assert(meData.data.user.email === uniqueEmail, 'Returns correct user email');
    assert(meData.data.user.password === undefined, 'Password is NOT in /me response');

    // 10. Profile /me with Missing Token
    console.log('\nTEST 10: GET /api/auth/me with Missing Token');
    const noTokenRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(noTokenRes.status === 401, 'Missing token returns HTTP 401 Unauthorized');

    // 11. Profile /me with Invalid Token
    console.log('\nTEST 11: GET /api/auth/me with Invalid Token');
    const invalidTokenRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.fake.token' },
    });
    assert(invalidTokenRes.status === 401, 'Invalid token returns HTTP 401 Unauthorized');

    // 12. Update Profile Name & Phone
    console.log('\nTEST 12: PUT /api/auth/profile (Update Details)');
    const updateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Verification User Updated',
        phone: '+91 9999911111',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'Profile update returns HTTP 200 OK');
    assert(updateData.data.user.name === 'Verification User Updated', 'Name successfully updated');
    assert(updateData.data.user.phone === '+91 9999911111', 'Phone successfully updated');

    // 13. Password Change via Profile Update
    console.log('\nTEST 13: Password Change Flow');
    const passChangeRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'Pass@123',
        newPassword: 'NewPassword@456',
        confirmNewPassword: 'NewPassword@456',
      }),
    });
    assert(passChangeRes.status === 200, 'Password change returns HTTP 200 OK');

    // Verify login with old password fails
    const oldLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'Pass@123' }),
    });
    assert(oldLogin.status === 401, 'Login with old password now returns HTTP 401 Unauthorized');

    // Verify login with new password succeeds
    const newLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'NewPassword@456' }),
    });
    assert(newLogin.status === 200, 'Login with new password succeeds HTTP 200 OK');

    // 14. RBAC Authorization
    console.log('\nTEST 14: Role-Based Access Control (RBAC)');
    // Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@parkease.com', password: 'Admin@123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.token;

    // Staff login
    const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@parkease.com', password: 'Staff@123' }),
    });
    const staffLoginData = await staffLoginRes.json();
    const staffToken = staffLoginData.data.token;

    // Customer tries to access admin-only route -> 403
    const userToAdminRes = await fetch(`${BASE_URL}/api/auth/admin-only`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userToAdminRes.status === 403, 'Customer accessing /admin-only returns HTTP 403 Forbidden');

    // Staff tries to access admin-only route -> 403
    const staffToAdminRes = await fetch(`${BASE_URL}/api/auth/admin-only`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffToAdminRes.status === 403, 'Staff accessing /admin-only returns HTTP 403 Forbidden');

    // Admin accesses admin-only route -> 200
    const adminToAdminRes = await fetch(`${BASE_URL}/api/auth/admin-only`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminToAdminRes.status === 200, 'Admin accessing /admin-only returns HTTP 200 OK');

    // Staff accesses staff-only route -> 200
    const staffToStaffRes = await fetch(`${BASE_URL}/api/auth/staff-only`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffToStaffRes.status === 200, 'Staff accessing /staff-only returns HTTP 200 OK');

    // Customer tries to access staff-only route -> 403
    const userToStaffRes = await fetch(`${BASE_URL}/api/auth/staff-only`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userToStaffRes.status === 403, 'Customer accessing /staff-only returns HTTP 403 Forbidden');

    console.log('\n================================================================');
    console.log(` VERIFICATION COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error(`Verification error: ${err.message}`);
    process.exit(1);
  }
};

runTests();
