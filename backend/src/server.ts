import 'dotenv/config';
import app from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`API server running on http://localhost:${config.port}`);
});