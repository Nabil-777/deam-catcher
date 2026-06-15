import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import helmet from 'helmet'
import { initDatabase } from './config/database-init.js';
import pool from './config/database.js';
import dreamsRouter from './routes/dreams.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Add securiy headers
if (process.env.NODE_ENV === 'production') {
  app.use(helmet()); 
}

const PORT = process.env.PORT || 3001;
 
// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/health', async (_req, res) => {
 try {
   await pool.query('SELECT 1');
   res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
 }  catch (err) {
  console.error('Health check failed:', err.message); // <-- add this
  res.status(503).json({ status: 'error', db: 'disconnected', message: err.message, uptime: process.uptime() });
}
});

app.get('/shutdown', (req, res) => {
  console.log('=== MANUAL SHUTDOWN TRIGGERED ===');
  res.send('Shutting down...');
  
  setTimeout(() => {
    process.kill(process.pid, 'SIGTERM');
  }, 100);
});


// API Routes
app.use('/api/dreams', dreamsRouter);

// Store the server reference
let server;

initDatabase().then(() => {
  server = app.listen(PORT, () => {  // ← Store server
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);  // ← Add this
});

process.on('SIGTERM', gracefulShutdown);
console.log('✓ SIGTERM handler registered'); 

async function gracefulShutdown() {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close the server first (stop accepting new connections)
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Then close database pool
  try {
    await pool.end();
    console.log('Database pool closed');
    process.exit(0);
  } catch (error) {
    console.error('Error closing database pool:', error);
    process.exit(1);
  }
}
