import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware: Request body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      const configuredOrigins = [
        process.env.CLIENT_URL,
        process.env.RENDER_EXTERNAL_URL,
        process.env.RENDER_EXTERNAL_HOSTNAME && `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`,
      ].filter(Boolean);
      const isLocalFrontend = !origin || /^https?:\/\/(?:localhost|127\.0\.0\.1|[::1])(?::\d+)?$/.test(origin);

      if (!origin || configuredOrigins.includes(origin) || isLocalFrontend) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by ParkEase CORS policy.'));
    },
    credentials: true,
  })
);

// Middleware: HTTP logging in development mode
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? 'ParkEase API server is healthy and operational.'
      : 'ParkEase API server cannot reach its database.',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: databaseConnected ? 'Connected' : 'Disconnected',
    },
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/parking-locations', locationRoutes);
app.use('/api/parking-slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shop', shopRoutes);

// ==========================================
// SERVE FRONTEND STATIC FILES IN PRODUCTION
// ==========================================
const frontendBuildPath = path.resolve(__dirname, '../frontend/dist');

console.log(`[PARKEASE] Serving static files from: ${frontendBuildPath}`);
console.log(`[PARKEASE] Directory exists: ${fs.existsSync(frontendBuildPath)}`);

app.use(express.static(frontendBuildPath));

// Fallback route to serve frontend's index.html for Single Page Application routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build files not found.');
  }
});

// 404 handler for undefined routes
app.use(notFound);

// Centralized error handling middleware
app.use(errorHandler);

// Start server strictly after real MongoDB connects successfully
const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be configured before starting the server.');
    }

    await connectDB();

    const listenOnPort = (port) => {
      const server = app.listen(port, '0.0.0.0', () => {
        console.log(`================================================================`);
        console.log(` [PARKEASE BACKEND READY]`);
        console.log(` Server listening on port: ${port}`);
        console.log(` Health check path: /api/health`);
        console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`================================================================`);
      });

      server.on('error', (error) => {
        console.error(`Failed to start server: ${error.message}`);
        process.exit(1);
      });
    };

    listenOnPort(PORT);
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export default app;