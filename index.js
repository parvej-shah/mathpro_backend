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

server.listen(port, () => {
  console.log(`Server listening at port: ${port}`);
});
