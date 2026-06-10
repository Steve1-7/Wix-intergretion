import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { validateEnv } from './utils/envValidator.js';
import { errorHandler } from './utils/errors.js';
import app from './app.js';
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, trying ${PORT + 1}`);
    app.listen(PORT + 1, () => {
      console.log(`Server running on port ${PORT + 1}`);
    });
  } else {
    throw err;
  }
});

// export the configured app for testing/imports
export default app;
