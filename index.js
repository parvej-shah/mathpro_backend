const app = require("./app");
const http = require("http");

const port = process.env.PORT || 8000;
const server = http.createServer(app);

// Set timeout to 60 seconds (60000 ms)
server.timeout = 60000;

const logger = require("./util/logger");
const { pool } = require("./service/base");

let shuttingDown = false;
const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: closing HTTP server gracefully...`);
  server.close(() => {
    pool.end().catch(() => {}).finally(() => {
      console.log('HTTP server and DB pool closed cleanly. Exiting process.');
      process.exit(exitCode);
    });
  });
  // Force exit if hanging connections remain after 15 seconds
  setTimeout(() => {
    console.error('Forced shutdown: connections did not close in time.');
    process.exit(1);
  }, 15000).unref();
};

// A rejected promise nobody awaited (e.g. a fire-and-forget SMS/email send) is logged, not
// fatal: exiting would drop every in-flight request for one failed side effect.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', reason);
});

// After an uncaught exception the process state is unknown, so finish in-flight requests,
// then exit non-zero. Coolify runs the container with restart=unless-stopped.
process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', err);
  shutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(port, () => {
  console.log(`Server listening at port: ${port}`);
});
