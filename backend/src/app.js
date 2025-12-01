import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/logger.js';
import routes from './routes/index.js';
import { getTokenHandler } from './controllers/authController.js';

const app = express();

// Middlewares básicos
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logger
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// Fallback simples para evitar 404 no root
app.get(['/', '/index.htm'], (req, res) => {
  res.json({
    service: 'estoqueuni-backend',
    message: 'API disponível. Utilize /health ou /api/*',
  });
});

// Rota pública para obter token (usada pelo backend-ai)
app.post('/getToken', getTokenHandler);

// API routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
