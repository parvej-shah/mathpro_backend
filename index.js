const app = require("./app");
const http = require("http");

const port = process.env.PORT || 8000;
const server = http.createServer(app);

// Set timeout to 60 seconds (60000 ms)
server.timeout = 60000;

// Catch unhandled promise rejections and uncaught exceptions to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const shutdown = (signal) => {
  console.log(`${signal} received: closing HTTP server gracefully...`);
  server.close(() => {
    console.log('HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });
  // Force exit if hanging connections remain after 15 seconds
  setTimeout(() => {
    console.error('Forced shutdown: connections did not close in time.');
    process.exit(1);
  }, 15000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(port, () => {
  console.log(`Server listening at port: ${port}`);
});
