# ParkEase – Thunder Client Testing Guide (Phase 1)

This guide walks you through importing and running the Phase 1 API test collection using **Thunder Client** in VS Code / Antigravity.

---

## 1. Importing the Collection & Environment

1. Open the **Thunder Client** tab in your editor.
2. Go to **Collections** -> Click the **Burger Menu (⋮)** -> Click **Import**.
3. Select `thunder-client/thunder-collection_phase1.json`.
4. Go to **Env** -> Click **Import** -> Select `thunder-client/thunder-environment_parkease.json`.
5. Ensure the active environment is set to `ParkEase Local Environment` (`base_url: http://localhost:5000`).

---

## 2. Testing Execution Flow

### Step 1: Health Check
- Request: `GET {{base_url}}/api/health`
- Expected Status: `200 OK`
- Verifies Express server and MongoDB connection are healthy.

### Step 2: Seed Demo Users
Run the seeder from terminal:
```bash
cd backend
npm run seed
```
This prepares:
- Admin: `admin@parkease.com` / `Admin@123`
- Staff: `staff@parkease.com` / `Staff@123`
- User: `user@parkease.com` / `User@123`
- Inactive User: `inactive@parkease.com` / `User@123`

### Step 3: Test Authentication & Capture Tokens
1. Run **Login Admin Role**:
   - `POST {{base_url}}/api/auth/login`
   - Copy the `token` from `data.token` into the environment variable `admin_token`.
2. Run **Login Customer (User Role)**:
   - `POST {{base_url}}/api/auth/login`
   - Copy `data.token` into the environment variable `user_token`.
3. Run **Login Staff Role**:
   - `POST {{base_url}}/api/auth/login`
   - Copy `data.token` into the environment variable `staff_token`.

### Step 4: Test Profile & Protected Endpoints
1. Run `GET {{base_url}}/api/auth/me` with `Bearer {{user_token}}` -> Returns 200 with user profile.
2. Run `GET {{base_url}}/api/auth/me` without Bearer token -> Returns 401 Unauthorized.
3. Run `PUT {{base_url}}/api/auth/profile` with updated name and phone -> Returns 200 with updated fields.

### Step 5: Test Role-Based Access Control (RBAC)
1. Run `GET {{base_url}}/api/auth/admin-only` with `Bearer {{admin_token}}` -> Returns `200 OK`.
2. Run `GET {{base_url}}/api/auth/admin-only` with `Bearer {{user_token}}` -> Returns `403 Forbidden` with:
   `"Your role (USER) is not authorized for this resource. Required: [ADMIN]."`

### Step 6: Test Validation & Edge Cases
1. Run **Duplicate Email Registration**:
   - Registers an already existing email -> Returns `409 Conflict`.
2. Run **Login Deactivated User**:
   - Attempts login with `inactive@parkease.com` -> Returns `403 Forbidden` ("Account deactivated").
3. Run **Login Invalid Password**:
   - Attempts login with wrong password -> Returns `401 Unauthorized`.
