import fs from "fs";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import next from "next";
import path from "path";
import { parse } from "url";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Check for mkcert certificates (relative to server.mjs location)
const certsDir = path.join(__dirname, "certs");

// Find certificate files (mkcert generates localhost+N.pem based on number of domains)
let certPath = null;
let keyPath = null;

if (fs.existsSync(certsDir)) {
  const files = fs.readdirSync(certsDir);
  const certFile = files.find(f => f.startsWith("localhost+") && f.endsWith(".pem") && !f.includes("-key"));
  const keyFile = files.find(f => f.startsWith("localhost+") && f.endsWith("-key.pem"));

  if (certFile && keyFile) {
    certPath = path.join(certsDir, certFile);
    keyPath = path.join(certsDir, keyFile);
  }
}

const hasCerts = certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath);

const app = next({ dev, hostname, port });
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
    : createHttpServer(requestHandler);

  server.listen(port, err => {
    if (err) throw err;
    const protocol = hasCerts ? "https" : "http";
    console.log(`> Ready on ${protocol}://${hostname}:${port}`);
    if (!hasCerts) {
      console.log("> Running in HTTP mode. To enable HTTPS:");
      console.log("  1. Install mkcert: brew install mkcert");
      console.log("  2. Setup CA: mkcert -install");
      console.log(`  3. Generate certs: cd ${certsDir} && mkcert localhost 127.0.0.1 ::1`);
    }
  });
});
