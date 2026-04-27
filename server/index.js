import express  from 'express';
import cors     from 'cors';
import helmet   from 'helmet';
import morgan   from 'morgan';
import 'dotenv/config';
import puzzleRoutes from './routes/puzzle.js';
import runRoutes    from './routes/run.js';
 
const app  = express();
const PORT = process.env.PORT || 3001;
 
app.use(helmet());
app.use(cors({
  origin:  process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH'],
}));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(express.json());
 
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/run',    runRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
 
// 4-argument middleware = Express error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
 
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
