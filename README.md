# ParkEase – Vehicle Parking Management System

> **A modern, full-stack vehicle parking management platform.**

---

## Phase 1: Project Setup, Real MongoDB & Authentication System

Phase 1 establishes the complete backend architectural foundation, real MongoDB database integration, User entity schema, secure password hashing (`bcryptjs`), stateless JWT token authentication, role-based access control (`USER`, `STAFF`, `ADMIN`), request validation, centralized error handling, demo seeding, and Thunder Client API testing collections.

---

## 1. Project Architecture (Phase 1)

```
Vehicle Parking Management System/
├── backend/
│   ├── config/
│   │   └── db.js                 # Real MongoDB connection with diagnostic reporting
│   ├── controllers/
│   │   └── authController.js     # Register, Login, Me, Profile update
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT Bearer token authentication & user attachment
│   │   ├── roleMiddleware.js     # Role-based access control (USER, STAFF, ADMIN)
│   │   ├── errorMiddleware.js    # Centralized standard JSON error handler
│   │   └── validateMiddleware.js # Input validation runner
│   ├── models/
│   │   └── User.js               # Mongoose User model with pre-save bcrypt hashing
│   ├── routes/
│   │   └── authRoutes.js         # /api/auth routes & RBAC test endpoints
│   ├── utils/
│   │   └── generateToken.js      # JWT token generator
│   ├── validators/
│   │   └── authValidators.js     # Input validators for registration & login
│   ├── .env.example              # Environment variables template
│   ├── .env                      # Local environment configuration
│   ├── package.json              # Backend dependencies and scripts
│   ├── seed.js                   # Demo users seeder script
│   └── server.js                 # Express server entry point
├── thunder-client/
│   ├── thunder-collection_phase1.json # Thunder Client test collection
│   ├── thunder-environment_parkease.json # Environment variables for Thunder Client
│   └── THUNDER_CLIENT_GUIDE.md   # Step-by-step test execution guide
├── .gitignore                    # Git ignore file
└── README.md                     # Documentation
```

## 2. Where Node.js and React Are Used

ParkEase uses Node.js for the backend runtime and React for the browser interface. The root `package.json` provides commands that run or build these two parts together.

### Node.js backend

The Node.js application is in `backend/`. It runs on the server, exposes the REST API, and accesses MongoDB through Mongoose.

| Location | Purpose |
|---|---|
| `backend/server.js` | Node.js/Express entry point; configures middleware, connects to MongoDB, and mounts API routes. |
| `backend/routes/` | Defines API endpoints for authentication, vehicles, parking locations and slots, bookings, pricing, payments, notifications, and the shop. |
| `backend/controllers/` | Implements endpoint behavior and business rules, such as booking creation and payment handling. |
| `backend/models/` | Defines Mongoose data models persisted in MongoDB. |
| `backend/middleware/` | Handles authentication, role authorization, request validation, and errors. |
| `backend/config/`, `backend/utils/`, `backend/validators/` | Holds database setup, shared helpers, and request validation rules. |
| `backend/seed.js`, `backend/seedParkingLocations.js` | Node.js scripts for creating demo users and parking data. |

Backend dependencies and commands are declared in `backend/package.json`. `npm start` runs `node server.js`; `npm run dev` currently runs the same server command.

### React frontend

The React application is in `frontend/`. It runs in the user's browser and provides the ParkEase interface, stores and updates screen state, and calls the backend API using `fetch`.

| Location | Purpose |
|---|---|
| `frontend/index.html` | Browser HTML shell; its `#root` element is where React is mounted. |
| `frontend/src/main.jsx` | React entry point and main application; renders the UI, manages application state, and sends API requests. |
| `frontend/src/styles.css` | Main interface styles. |
| `frontend/src/shop.css`, `frontend/src/payments.css` | Shop and payment interface styles. |
| `frontend/package.json` | Declares React, React DOM, Vite, and the frontend development/build commands. |

Vite serves the frontend during development and builds its production assets. The frontend defaults to `http://localhost:5000/api` for API calls; set `VITE_API_URL` to override it.

### How they work together

1. React is mounted into `#root` by `frontend/src/main.jsx` and displays the parking-management interface.
2. The frontend sends HTTP requests to the Node.js/Express API, including authentication tokens when available.
3. Express routes pass requests to controllers, which apply business rules and read or write MongoDB through Mongoose models.
4. The API returns JSON responses, and React updates the displayed data and state.

Run both during development from the project root with `npm run dev`. This starts the backend and Vite frontend together. Run `npm run build` from the root to build the frontend.

---

## 3. Prerequisites

- **Node.js**: `v18.x` or higher (`v24.x` recommended)
- **npm**: `v9.x` or higher
- **MongoDB**: A running instance of **Real MongoDB**:
  - **Local MongoDB**: `mongodb://127.0.0.1:27017/parkease` (MongoDB Community Server), OR
  - **MongoDB Atlas**: Cloud cluster connection string (`mongodb+srv://...`)
  - *(Note: In-memory/fake databases are strictly disabled to ensure production realism)*

---

## 4. Installation & Setup

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` (or configure existing `.env`):
```env
PORT=5000
NODE_ENV=development

# Real MongoDB connection string (Local or Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/parkease

# JWT Configuration
JWT_SECRET=parkease_super_secret_jwt_key_2026_secure_college_project
JWT_EXPIRES_IN=7d

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173

# Razorpay test or live keys
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Online checkout uses Razorpay. Add your test keys to `backend/.env` and restart the backend to enable it. Keep the key secret server-side and out of source control. Without configured keys, pay-in-person remains available and payment status stays `PENDING` until collected.

---

## 5. Database Setup & Seeding

### Seeding Demo Accounts
Run the seed script to create initial demo users for all three roles:
```bash
npm run seed
```

To add the demo parking locations, slots, and any missing pricing rules without resetting existing users or parking data, run:
```bash
npm run seed:locations
```

### Demo Credentials:
| Role | Email | Password | Phone | Permissions |
|---|---|---|---|---|
| **ADMIN** | `admin@parkease.com` | `Admin@123` | `+91 9876543210` | Full administrative control |
| **STAFF** | `staff@parkease.com` | `Staff@123` | `+91 9876543211` | Gate verification & entry/exit |
| **USER** | `user@parkease.com` | `User@123` | `+91 9876543212` | Customer slot bookings |
| **INACTIVE** | `inactive@parkease.com` | `User@123` | `+91 9876543213` | Deactivated (for 403 test) |

---

## 6. Starting the Server

### Development Mode (with automatic reload via nodemon):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

Upon successful connection, you will observe:
```
[MongoDB Connected] Host: 127.0.0.1, Database: parkease
================================================================
 [PARKEASE BACKEND READY]
 Server running on: http://localhost:5000
 Health check URL: http://localhost:5000/api/health
 Environment: development
================================================================
```

---

## 7. Phase 1 API Endpoints

### Standard Response Formats

#### Success (200 / 201):
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

#### Error (400 / 401 / 403 / 404 / 409 / 500):
```json
{
  "success": false,
  "message": "Detailed error description.",
  "errors": ["Specific validation or business rule violation."]
}
```

---

### Endpoint Reference Table

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/health` | Public | Checks API and database health status |
| `POST` | `/api/auth/register` | Public | Register new customer account |
| `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT token |
| `GET` | `/api/auth/me` | Private | Get profile of logged-in user |
| `PUT` | `/api/auth/profile` | Private | Update name, phone, or password |
| `GET` | `/api/auth/staff-only` | Private (STAFF, ADMIN) | Role verification endpoint |
| `GET` | `/api/auth/admin-only` | Private (ADMIN) | Role verification endpoint |

---

## 8. Thunder Client API Testing

A complete Thunder Client collection with environment configuration is provided in `thunder-client/`:
- **Collection**: `thunder-client/thunder-collection_phase1.json`
- **Environment**: `thunder-client/thunder-environment_parkease.json`
- **Guide**: `thunder-client/THUNDER_CLIENT_GUIDE.md`

### Test Scenarios Covered:
1. **Health Check**: `GET /api/health` -> `200 OK`
2. **Customer Registration**: `POST /api/auth/register` -> `201 Created`
3. **Duplicate Email Prevention**: `POST /api/auth/register` -> `409 Conflict`
4. **Validation Mismatch**: Missing/mismatched fields -> `400 Bad Request`
5. **Login (Customer, Staff, Admin)**: `POST /api/auth/login` -> `200 OK` + JWT Token
6. **Invalid Password Login**: `POST /api/auth/login` -> `401 Unauthorized`
7. **Deactivated User Login**: `POST /api/auth/login` -> `403 Forbidden`
8. **Protected Profile (`/me`)**: With valid Bearer token -> `200 OK`
9. **Unauthorized Profile Access**: Without Bearer token -> `401 Unauthorized`
10. **Profile & Password Update**: `PUT /api/auth/profile` -> `200 OK`
11. **RBAC Guard**: Admin route with User token -> `403 Forbidden`; with Admin token -> `200 OK`

---

## 9. Next Phase
- **Phase 2**: Vehicles + Parking Locations + Parking Slots Management.
