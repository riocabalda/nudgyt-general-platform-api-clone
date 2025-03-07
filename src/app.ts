import express from 'express';
import cors, { CorsOptions } from 'cors';
import serverConfig from './config/server.config';
import routes from './routes/index.route';
import { errorHandler } from './middlewares/error-handler';
import cookieParser from 'cookie-parser';
import { createSocketServer } from './websocket/socket-server';
import { setupSocketHandlers } from './websocket/socket-handlers';
import http from 'http';

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// // Rate Limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per `window`
//   standardHeaders: true,
//   legacyHeaders: false
// });

// app.use(limiter);

const allowedOrigins = serverConfig.allowedOrigins
  ? serverConfig.allowedOrigins.split(',')
  : ['http://localhost:3000'];

const corsOptions: CorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void
  ) => {
    if (allowedOrigins.includes(origin || '') || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

const server = http.createServer(app);

// Websocket
const io = createSocketServer(server);
setupSocketHandlers(io);

// ROUTES
routes(app);

// ERROR HANDLER
app.use(errorHandler);

export default app;
