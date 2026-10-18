import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
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
      const configuredOrigin = process.env.CLIENT_URL;
      const isLocalFrontend = !origin || /^https?:\/\/(?:localhost|127\.0\.0\.1|[::1])(?::\d+)?$/.test(origin);

      if (!origin || origin === configuredOrigin || isLocalFrontend) {
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
  res.status(200).json({
    success: true,
    message: 'ParkEase API server is healthy and operational.',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'Connected',
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
const frontendBuildPath = path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendBuildPath));

// Fallback route to serve frontend's index.html for Single Page Application routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// 404 handler for undefined routes
app.use(notFound);

// Centralized error handling middleware
app.use(errorHandler);

// Start server strictly after real MongoDB connects successfully
const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const listenOnPort = (port) => {
      const server = app.listen(port, () => {
        console.log(`================================================================`);
        console.log(` [PARKEASE BACKEND READY]`);
        console.log(` Server running on: http://localhost:${port}`);
        console.log(` Health check URL: http://localhost:${port}/api/health`);
        console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`================================================================`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          const nextPort = port + 1;
          console.warn(`Port ${port} is busy. Retrying on port ${nextPort}...`);
          listenOnPort(nextPort);
          return;
        }

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