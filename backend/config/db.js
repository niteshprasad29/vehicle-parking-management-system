import mongoose from 'mongoose';

/**
 * Connect to Real MongoDB (Local MongoDB or MongoDB Atlas).
 * Exits process with code 1 if connection fails.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('================================================================');
    console.error(' [DB ERROR] MONGODB_URI is not defined in backend/.env');
    console.error(' Please configure a valid MongoDB connection string.');
    console.error(' Example Local: mongodb://127.0.0.1:27017/parkease');
    console.error(' Example Atlas: mongodb+srv://<user>:<pass>@cluster.mongodb.net/parkease');
    console.error('================================================================');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast if server unreachable
    });

    console.log(`[MongoDB Connected] Host: ${conn.connection.host}, Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('================================================================');
    console.error(' [DATABASE CONNECTION FAILED]');
    console.error(` Error: ${error.message}`);
    console.error(' Ensure that:');
    console.error(' 1. Local MongoDB service is running (e.g. net start MongoDB), OR');
    console.error(' 2. MongoDB Atlas URI is valid and IP address is whitelisted (0.0.0.0/0).');
    console.error('================================================================');
    process.exit(1);
  }
};
