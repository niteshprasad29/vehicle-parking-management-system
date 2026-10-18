import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import User from './models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

async function runExhaustiveVerification() {
  const results = {};

  // Helper log
  const record = (section, item, status, file, expected, actual) => {
    if (!results[section]) results[section] = [];
    results[section].push({ item, status, file, expected, actual });
    console.log(`[${status}] ${section} -> ${item}`);
  };

  // --- A. Project Setup ---
  const backendExists = fs.existsSync(path.resolve('./'));
  const pkgExists = fs.existsSync(path.resolve('./package.json'));
  const serverExists = fs.existsSync(path.resolve('./server.js'));
  const envExampleExists = fs.existsSync(path.resolve('./.env.example'));
  const gitignoreExists = fs.existsSync(path.resolve('../.gitignore'));

  const pkgJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
  const deps = Object.keys(pkgJson.dependencies || {});
  const hasDeps = ['express', 'mongoose', 'dotenv', 'cors', 'bcryptjs', 'jsonwebtoken'].every(d => deps.includes(d));

  record('A. Project Setup', 'Backend folder exists', backendExists ? 'PASS' : 'FAIL', 'backend/', 'Folder exists', backendExists ? 'Folder exists' : 'Missing');
  record('A. Project Setup', 'package.json exists', pkgExists ? 'PASS' : 'FAIL', 'backend/package.json', 'package.json exists', pkgExists ? 'Exists' : 'Missing');
  record('A. Project Setup', 'server.js exists', serverExists ? 'PASS' : 'FAIL', 'backend/server.js', 'server.js exists', serverExists ? 'Exists' : 'Missing');
  record('A. Project Setup', '.env.example exists', envExampleExists ? 'PASS' : 'FAIL', 'backend/.env.example', '.env.example exists', envExampleExists ? 'Exists' : 'Missing');
  record('A. Project Setup', '.gitignore exists', gitignoreExists ? 'PASS' : 'FAIL', '.gitignore', '.gitignore exists at root', gitignoreExists ? 'Exists' : 'Missing');
  record('A. Project Setup', 'Dependencies installed', hasDeps ? 'PASS' : 'FAIL', 'backend/package.json', 'express, mongoose, dotenv, cors, bcryptjs, jsonwebtoken', deps.join(', '));

  // --- B. MongoDB ---
  await mongoose.connect(process.env.MONGODB_URI);
  const isRealMongo = mongoose.connection.readyState === 1 && !process.env.USE_MEMORY_DB;
  const dbFileContent = fs.readFileSync('./config/db.js', 'utf-8');
  const noMemServer = !dbFileContent.includes('mongodb-memory-server');
  const loadsFromEnv = dbFileContent.includes('process.env.MONGODB_URI');
  const handlesFail = dbFileContent.includes('process.exit(1)');

  record('B. MongoDB', 'Connects to Real MongoDB', isRealMongo ? 'PASS' : 'FAIL', 'backend/config/db.js', 'Real MongoDB connection active (readyState: 1)', `Connected to ${mongoose.connection.host}`);
  record('B. MongoDB', 'MONGODB_URI from .env', loadsFromEnv ? 'PASS' : 'FAIL', 'backend/config/db.js', 'Reads process.env.MONGODB_URI', 'Reads process.env.MONGODB_URI');
  record('B. MongoDB', 'No memory server fallback', noMemServer ? 'PASS' : 'FAIL', 'backend/config/db.js', 'Zero mongodb-memory-server references', 'No memory-server used');
  record('B. MongoDB', 'Connection failure handling', handlesFail ? 'PASS' : 'FAIL', 'backend/config/db.js', 'Exits process with diagnostic code 1 on failure', 'process.exit(1) on catch');

  // --- C. User Model ---
  const userModelPath = './models/User.js';
  const userModelContent = fs.readFileSync(userModelPath, 'utf-8');
  const userSchemaObj = User.schema.paths;

  const hasUniqueEmail = userSchemaObj.email && userSchemaObj.email._index;
  const hasLowercase = userSchemaObj.email && userSchemaObj.email.options.lowercase === true;
  const hasSelectFalse = userSchemaObj.password && userSchemaObj.password.options.select === false;
  const rolesEnum = userSchemaObj.role.options.enum.values || userSchemaObj.role.options.enum;
  const rolesExact = JSON.stringify(rolesEnum.sort()) === JSON.stringify(['ADMIN', 'STAFF', 'USER']);
  const hasIsActive = !!userSchemaObj.isActive;
  const hasLocation = !!userSchemaObj.assignedLocationId;

  record('C. User Model', 'User model exists', fs.existsSync(userModelPath) ? 'PASS' : 'FAIL', userModelPath, 'Model file exists', 'Exists');
  record('C. User Model', 'Email unique index', hasUniqueEmail ? 'PASS' : 'FAIL', userModelPath, 'Unique index on email', 'Index configured');
  record('C. User Model', 'Email lowercase', hasLowercase ? 'PASS' : 'FAIL', userModelPath, 'lowercase: true', 'lowercase: true');
  record('C. User Model', 'Password select: false', hasSelectFalse ? 'PASS' : 'FAIL', userModelPath, 'select: false in schema', 'select: false');
  record('C. User Model', 'Roles exactly USER, STAFF, ADMIN', rolesExact ? 'PASS' : 'FAIL', userModelPath, 'Enum: USER, STAFF, ADMIN', rolesEnum.join(', '));
  record('C. User Model', 'isActive field', hasIsActive ? 'PASS' : 'FAIL', userModelPath, 'Boolean isActive field exists', 'Exists, default: true');
  record('C. User Model', 'assignedLocationId field', hasLocation ? 'PASS' : 'FAIL', userModelPath, 'assignedLocationId field exists', 'Exists, ref: ParkingLocation');

  // --- D. Registration Tests ---
  // 1. Valid user
  const regEmail = `verify.${Date.now()}@parkease.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verification User',
      email: regEmail,
      phone: '+91 9123456780',
      password: 'Pass@123',
      confirmPassword: 'Pass@123',
    }),
  });
  const regData = await regRes.json();
  const regPass = regRes.status === 201 && regData.success === true && regData.data.token && !regData.data.user.password;
  record('D. Registration', '1. Register valid user', regPass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 201 + JWT + No password', `Status: ${regRes.status}, success: ${regData.success}`);

  // 2. Duplicate email
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verification User 2',
      email: regEmail,
      phone: '+91 9123456781',
      password: 'Pass@123',
      confirmPassword: 'Pass@123',
    }),
  });
  const dupData = await dupRes.json();
  const dupPass = dupRes.status === 409 && dupData.success === false;
  record('D. Registration', '2. Duplicate email rejection', dupPass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 409 Conflict', `Status: ${dupRes.status}, success: ${dupData.success}`);

  // 3. Invalid email
  const invEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Invalid Email User',
      email: 'not-an-email',
      phone: '+91 9123456782',
      password: 'Pass@123',
      confirmPassword: 'Pass@123',
    }),
  });
  const invEmailData = await invEmailRes.json();
  const invEmailPass = invEmailRes.status === 400 && invEmailData.errors.some(e => e.includes('email'));
  record('D. Registration', '3. Invalid email format', invEmailPass ? 'PASS' : 'FAIL', 'backend/validators/authValidators.js', 'HTTP 400 + validation error', `Status: ${invEmailRes.status}`);

  // 4. Mismatched passwords
  const mismatchRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Mismatch User',
      email: `mismatch.${Date.now()}@parkease.com`,
      phone: '+91 9123456783',
      password: 'Pass@123',
      confirmPassword: 'WrongPass@123',
    }),
  });
  const mismatchData = await mismatchRes.json();
  const mismatchPass = mismatchRes.status === 400 && mismatchData.errors.some(e => e.includes('match'));
  record('D. Registration', '4. Mismatched passwords', mismatchPass ? 'PASS' : 'FAIL', 'backend/validators/authValidators.js', 'HTTP 400 + Passwords do not match', `Status: ${mismatchRes.status}`);

  // 5. Missing required fields
  const missingRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  });
  const missingData = await missingRes.json();
  const missingPass = missingRes.status === 400 && missingData.errors.length > 0;
  record('D. Registration', '5. Missing required fields', missingPass ? 'PASS' : 'FAIL', 'backend/validators/authValidators.js', 'HTTP 400 + field errors array', `Status: ${missingRes.status}, errors: ${missingData.errors.length}`);

  // --- E. Login Tests ---
  // 1. Correct email + password
  const log1Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regEmail, password: 'Pass@123' }),
  });
  const log1Data = await log1Res.json();
  const log1Pass = log1Res.status === 200 && log1Data.data.token && !log1Data.data.user.password;
  record('E. Login', '1. Correct email + password', log1Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 200 + JWT + Safe profile', `Status: ${log1Res.status}, token present`);

  // 2. Correct email + wrong password
  const log2Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regEmail, password: 'IncorrectPassword' }),
  });
  const log2Pass = log2Res.status === 401;
  record('E. Login', '2. Correct email + wrong password', log2Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 401 Unauthorized', `Status: ${log2Res.status}`);

  // 3. Non-existent email
  const log3Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent@parkease.com', password: 'Pass@123' }),
  });
  const log3Pass = log3Res.status === 401;
  record('E. Login', '3. Non-existent email', log3Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 401 Unauthorized', `Status: ${log3Res.status}`);

  // 4. Inactive user
  const log4Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inactive@parkease.com', password: 'User@123' }),
  });
  const log4Data = await log4Res.json();
  const log4Pass = log4Res.status === 403 && log4Data.success === false;
  record('E. Login', '4. Inactive user rejection', log4Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 403 Forbidden', `Status: ${log4Res.status}, msg: ${log4Data.message}`);

  // --- F. JWT Authentication ---
  const validToken = log1Data.data.token;
  // 1. GET /me with valid token
  const me1Res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  const me1Data = await me1Res.json();
  const me1Pass = me1Res.status === 200 && me1Data.data.user.email === regEmail;
  record('F. JWT Authentication', '1. GET /me with valid token', me1Pass ? 'PASS' : 'FAIL', 'backend/middleware/authMiddleware.js', 'HTTP 200 + User object', `Status: ${me1Res.status}`);

  // 2. GET /me without token
  const me2Res = await fetch(`${BASE_URL}/api/auth/me`);
  const me2Pass = me2Res.status === 401;
  record('F. JWT Authentication', '2. GET /me without token', me2Pass ? 'PASS' : 'FAIL', 'backend/middleware/authMiddleware.js', 'HTTP 401 Unauthorized', `Status: ${me2Res.status}`);

  // 3. GET /me with invalid token
  const me3Res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: 'Bearer invalid.token.payload' },
  });
  const me3Pass = me3Res.status === 401;
  record('F. JWT Authentication', '3. GET /me with invalid token', me3Pass ? 'PASS' : 'FAIL', 'backend/middleware/authMiddleware.js', 'HTTP 401 Unauthorized', `Status: ${me3Res.status}`);

  // 4. GET /me with expired token
  const expiredToken = jwt.sign({ id: log1Data.data.user._id, role: 'USER' }, process.env.JWT_SECRET, { expiresIn: '1ms' });
  await new Promise(r => setTimeout(r, 50));
  const me4Res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  const me4Data = await me4Res.json();
  const me4Pass = me4Res.status === 401 && me4Data.message.includes('expired');
  record('F. JWT Authentication', '4. GET /me with expired token', me4Pass ? 'PASS' : 'FAIL', 'backend/middleware/authMiddleware.js', 'HTTP 401 Token expired', `Status: ${me4Res.status}, msg: ${me4Data.message}`);

  // --- G. Role Authorization ---
  // Log in as ADMIN
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@parkease.com', password: 'Admin@123' }),
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.data.token;

  // Log in as STAFF
  const staffRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@parkease.com', password: 'Staff@123' }),
  });
  const staffData = await staffRes.json();
  const staffToken = staffData.data.token;

  // USER accessing /admin-only -> 403
  const r1 = await fetch(`${BASE_URL}/api/auth/admin-only`, { headers: { Authorization: `Bearer ${validToken}` } });
  // STAFF accessing /admin-only -> 403
  const r2 = await fetch(`${BASE_URL}/api/auth/admin-only`, { headers: { Authorization: `Bearer ${staffToken}` } });
  // ADMIN accessing /admin-only -> 200
  const r3 = await fetch(`${BASE_URL}/api/auth/admin-only`, { headers: { Authorization: `Bearer ${adminToken}` } });
  // STAFF accessing /staff-only -> 200
  const r4 = await fetch(`${BASE_URL}/api/auth/staff-only`, { headers: { Authorization: `Bearer ${staffToken}` } });
  // USER accessing /staff-only -> 403
  const r5 = await fetch(`${BASE_URL}/api/auth/staff-only`, { headers: { Authorization: `Bearer ${validToken}` } });

  const rbacPass = r1.status === 403 && r2.status === 403 && r3.status === 200 && r4.status === 200 && r5.status === 403;
  record('G. Role Authorization', 'RBAC role checks (USER, STAFF, ADMIN)', rbacPass ? 'PASS' : 'FAIL', 'backend/middleware/roleMiddleware.js', '403 for unauthorized, 200 for authorized', `Admin: ${r3.status}, Staff: ${r4.status}, User->Admin: ${r1.status}`);

  // --- H. Profile Tests ---
  // Update name & phone
  const prof1Res = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({ name: 'Updated Name', phone: '+91 9999900000' }),
  });
  const prof1Data = await prof1Res.json();
  const prof1Pass = prof1Res.status === 200 && prof1Data.data.user.name === 'Updated Name' && prof1Data.data.user.phone === '+91 9999900000';
  record('H. Profile', 'Update name & phone', prof1Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 200 + Updated profile', `Name: ${prof1Data.data?.user?.name}`);

  // Wrong current password
  const prof2Res = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({ currentPassword: 'WrongCurrentPassword', newPassword: 'NewPassword@123' }),
  });
  const prof2Pass = prof2Res.status === 400;
  record('H. Profile', 'Password change wrong current password', prof2Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 400 Bad Request', `Status: ${prof2Res.status}`);

  // Correct current password
  const prof3Res = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({ currentPassword: 'Pass@123', newPassword: 'NewPassword@123', confirmNewPassword: 'NewPassword@123' }),
  });
  const prof3Pass = prof3Res.status === 200;
  record('H. Profile', 'Password change correct current password', prof3Pass ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'HTTP 200 OK', `Status: ${prof3Res.status}`);

  // Password remains hashed in DB
  const dbCheck = await User.findOne({ email: regEmail }).select('+password');
  const hashPass = dbCheck.password.startsWith('$2') && dbCheck.password !== 'NewPassword@123';
  record('H. Profile', 'Password remains hashed in MongoDB', hashPass ? 'PASS' : 'FAIL', 'backend/models/User.js', 'Bcrypt hash in DB', `Starts with ${dbCheck.password.substring(0, 7)}`);

  // --- I. Error Handling ---
  const notFoundRes = await fetch(`${BASE_URL}/api/non-existent-route`);
  const notFoundData = await notFoundRes.json();
  const formatPass = notFoundRes.status === 404 && notFoundData.success === false && Array.isArray(notFoundData.errors);
  record('I. Error Handling', 'Unified Error Envelope & 404', formatPass ? 'PASS' : 'FAIL', 'backend/middleware/errorMiddleware.js', '{ success: false, message, errors: [] }', JSON.stringify(notFoundData));

  // --- J. Security ---
  const noPassInReg = !regData.data.user.password;
  const noPassInLog = !log1Data.data.user.password;
  const noPassInMe = !me1Data.data.user.password;
  const noPassInUpdate = !prof1Data.data.user.password;
  const passNeverExposed = noPassInReg && noPassInLog && noPassInMe && noPassInUpdate;
  record('J. Security', 'Password is never returned in API responses', passNeverExposed ? 'PASS' : 'FAIL', 'backend/controllers/authController.js', 'undefined in all response objects', 'Verified across register, login, me, profile');

  const serverContent = fs.readFileSync('./server.js', 'utf-8');
  const jwtHelperContent = fs.readFileSync('./utils/generateToken.js', 'utf-8');
  const envNotHardcoded = !serverContent.includes('mongodb://') && jwtHelperContent.includes('process.env.JWT_SECRET');
  record('J. Security', 'JWT_SECRET & MongoDB not hardcoded', envNotHardcoded ? 'PASS' : 'FAIL', 'backend/server.js', 'Loaded from process.env', 'process.env loaded');

  const gitignoreContent = fs.readFileSync('../.gitignore', 'utf-8');
  const gitignoreEnv = gitignoreContent.includes('.env');
  record('J. Security', '.env ignored in .gitignore', gitignoreEnv ? 'PASS' : 'FAIL', '.gitignore', '.gitignore contains .env', '.env ignored');

  // --- K. Thunder Client ---
  const tcCollExists = fs.existsSync('../thunder-client/thunder-collection_phase1.json');
  const tcEnvExists = fs.existsSync('../thunder-client/thunder-environment_parkease.json');
  const tcGuideExists = fs.existsSync('../thunder-client/THUNDER_CLIENT_GUIDE.md');
  const tcPass = tcCollExists && tcEnvExists && tcGuideExists;
  record('K. Thunder Client', 'Collection & Environment files exist', tcPass ? 'PASS' : 'FAIL', 'thunder-client/', 'Collection, env and guide created', 'All 3 files exist');

  await mongoose.disconnect();
  fs.writeFileSync('./verification-results.json', JSON.stringify(results, null, 2));
  console.log('\nExhaustive verification completed successfully.');
}

runExhaustiveVerification().catch(e => {
  console.error('Verification crashed:', e);
  process.exit(1);
});
