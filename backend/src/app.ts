import cors from 'cors';
import 'dotenv/config.js';
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import applicationsRouter from './routes/applications.js';
import adminSessionRouter from './routes/adminSession.js';
import googleAuthRouter from './routes/googleAuth.js';

const app = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/admin-session', adminSessionRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/auth', googleAuthRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'All file size must not exceed 10 MB' });
    return;
  }
  if (error instanceof multer.MulterError || (error instanceof Error && error.message === 'Unexpected field')) {
    response.status(400).json({ error: 'Invalid upload or file limit exceeded' });
    return;
  }
  response.status(500).json({ error: 'Internal server error' });
});

export default app;
