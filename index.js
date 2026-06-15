const app = require("./app");
const http = require("http");

const port = process.env.PORT || 8000;
const server = http.createServer(app);

// Set timeout to 60 seconds (60000 ms)
server.timeout = 60000;


server.listen(port, () => {
  console.log(`Server listening at port: ${port}`);
});
