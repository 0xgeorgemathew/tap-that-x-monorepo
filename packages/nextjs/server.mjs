import fs from "fs";
import { createServer as createHttpsServer } from "https";
import next from "next";
import path from "path";
import { parse } from "url";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Use single IP-based certificate
const certsDir = path.join(__dirname, "certs");
const certPath = path.join(certsDir, "172.16.100.186.pem");
const keyPath = path.join(certsDir, "172.16.100.186-key.pem");
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const requestHandler = async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  };

  const server = hasCerts
    ? createHttpsServer(
        {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        },
        requestHandler,
      )
    : (() => {
        throw new Error("SSL certificates not found in " + certsDir);
      })();

  server.listen(port, "localhost", err => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
    console.log(`> Tunnel: cloudflared tunnel run`);
    console.log(`> Access: https://local.tapthatx.xyz`);
  });
});
