const http = require("http");
const axios = require("axios");

function main() {
  const server = http
    .createServer((req, res) => {
      res.writeHead(200, {"content-type": "application/json"});
      res.write(`{"msg": "Great!", "method": "${req.method}"}`);
      res.end();

      console.log("exit server");
      server.close();
    })
    .listen(8085);

  axios
    .get("http://localhost:8085/whatever")
    .then((resp) => {
      console.log("recv:  ", resp.data);
    });
}

console.log("Will begin server...");
main();
