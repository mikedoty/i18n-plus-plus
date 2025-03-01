const http = require("http");
const axios = require("axios");
const fs = require("fs");
const { start } = require("repl");
const exec = require("child_process").exec;

const sendResponse = (res, statusCode, data, isJSON) => {
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-method": "*",
    "access-control-allow-headers": "*",
  };

  if (isJSON) {
    headers["content-type"] = "application/json";
  }
  res.writeHead(200, headers);

  res.write(data);
  res.end();
};

const sendJSON = (res, statusCode, data) => {
  sendResponse(res, statusCode, data, true);
};

const startProxyApi = (relativeRoot, port) => {
  relativeRoot = relativeRoot || ".";
  if (!relativeRoot.endsWith("/")) {
    relativeRoot += "/";
  }

  // If port is in use, try next port
  const maxAttempts = 10;
  let server;
  let success = false;
  for (let i = 0; i < maxAttempts; i++) {
    console.log("Trying port", port);
    try {
      server = _startProxyApi(relativeRoot, port);
      success = true;
      break;
    } catch (ex) {
      console.log(ex);
      port++;
    }
  }

  if (success) {
    console.log(`Proxy api listening on port ${port}...`);
    return {
      server,
      port,
      error: null,
    };
  } else {
    console.error("Unable to start proxy api");
    return {
      server: null,
      port: null,
      error: "Unable to start proxy api",
    };
  }
};

const _startProxyApi = (relativeRoot, port) => {
  const server = http
    .createServer(async (req, res) => {
      if (req.method === "POST" && req.url === "/translate") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          const json = JSON.parse(body);
          console.log(json);

          const { apiKey, payload } = json;

          const useMock = false;
          if (useMock) {
            const mockResult = {
              data: {
                translations: [
                  {
                    translatedText: "Hola",
                  },
                ],
              },
            };

            // So far, it appears although "the child" in google.com browser
            // returns a masculine and feminine, through google api it's always
            // only a single result
            const mockResultMascFem = {
              data: {
                translations: [
                  {
                    translatedText: "el niño",
                  },
                ],
              },
            };

            sendJSON(
              res,
              200,
              JSON.stringify({ ...mockResult, isMocked: true })
            );
            return;
          }

          axios
            .post(
              "https://translation.googleapis.com/language/translate/v2",
              payload,
              {
                headers: {
                  "x-goog-api-key": apiKey,
                  "content-type": "application/json",
                },
              }
            )
            .then((res) => res.data)
            .then((json) => {
              //
              sendJSON(
                res,
                200,
                JSON.stringify({ ...json, processed: true }, null, 2)
              );
            })
            .catch((err) => {
              console.log(err);
              sendJSON(res, 500, JSON.stringify({ error: err.message }));
            });
        });
      } else if (req.method === "GET" && req.url === "/fix-en") {
        const filename = `${relativeRoot}src/v2/services/i18n/lang/en.json`;

        const data = safeReadFileSync(filename, "utf-8");
        const obj = JSON.parse(data);
        const alphaObj = alphabetize(obj);

        safeWriteFileSync(filename, JSON.stringify(alphaObj, null, 2), "utf-8");

        sendJSON(res, 200, JSON.stringify({ success: true }));
      } else if (req.method === "POST" && req.url === "/save") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          const json = JSON.parse(body);
          console.log(json);

          const { langCode, key, value } = json;

          const filename = `${relativeRoot}src/v2/services/i18n/lang/${langCode}.json`;

          const data = safeReadFileSync(filename, "utf-8");
          let obj = JSON.parse(data);

          let ref = obj;
          let parent = null;
          const pieces = key.split(".");

          // If parent "folders" don't yet exist, add them in a loop
          let prevPiece;
          while (pieces.length > 1) {
            const piece = pieces.splice(0, 1)[0];

            if (!ref[piece]) {
              if (ref === obj) {
                obj = insertAlphabetically(obj, piece, {});
                ref = obj;
              } else {
                // console.log(prevPiece, piece);
                parent[prevPiece] = insertAlphabetically(parent[prevPiece], piece, {});
                ref = parent[prevPiece];
              }
            }

            parent = ref;
            prevPiece = piece;

            ref = ref[piece];
          }

          if (parent) {
            parent[prevPiece] = insertAlphabetically(parent[prevPiece], pieces[0], value);
          } else {
            obj = insertAlphabetically(obj, pieces[0], value);
          }

          // Keep some stuff as-is, but always format to correct indentation.
          const objAsJSON = JSON.stringify(obj, null, 2);
          const preservedObjAsJSON = preserveOrderAndFormatting(data, objAsJSON);//alphabetize(obj);

          safeWriteFileSync(
            filename,
            preservedObjAsJSON, // JSON.stringify(alphaObj, null, 2),
            "utf-8"
          );

          sendJSON(res, 200, JSON.stringify({ success: true }));
        });
      } else if (req.method === "GET" && req.url.startsWith("/lang/")) {
        const langCode = req.url.substring(6);

        console.log("hmmmm", process.cwd());
        const data = safeReadFileSync(
          `${relativeRoot}src/v2/services/i18n/lang/${langCode}.json`,
          "utf-8"
        );

        sendJSON(res, 200, data);
      } else if (req.method === "GET" && req.url === "/diff") {
        const promise1 = new Promise((resolve) => {
          let result;
          let workaroundRelativeRoot = relativeRoot;
          // More hackery for windows users (like... mee..... :/)
          if (relativeRoot.startsWith("/c/")) {
            workaroundRelativeRoot = "c:/" + relativeRoot.substring(3);
          }
          const cmd = exec(
            `cd ${workaroundRelativeRoot} && git show development:src/v2/services/i18n/lang/en.json`,
            (err, stdout, stderr) => {
              console.log(stdout, stderr, err);
              const data = stdout;
              const json = JSON.parse(data);

              const keys = [];
              const walk = (obj, path) => {
                for (const key in obj) {
                  keys.push([...path, key].join("."));
                  if (obj[key] instanceof Object) {
                    walk(obj[key], [...path, key]);
                  }
                }
              };

              walk(json, []);
              resolve({ keys });
            }
          );
        });

        const promise2 = new Promise((resolve) => {
          let result;

          // For some reason `cat` command it's not working now, even though
          // it was working before.  But reading file contents should be fine.
          const data = safeReadFileSync(
            `${relativeRoot}src/v2/services/i18n/lang/en.json`,
            "utf-8"
          );

          const json = JSON.parse(data);

          const keys = [];
          const walk = (obj, path) => {
            for (const key in obj) {
              keys.push([...path, key].join("."));
              if (obj[key] instanceof Object) {
                walk(obj[key], [...path, key]);
              }
            }
          };

          walk(json, []);
          resolve({ keys });
        });

        const existing = await promise1;
        const current = await promise2;

        const newKeys = current.keys.filter((x) => !existing.keys.includes(x));

        sendJSON(res, 200, JSON.stringify({ new: newKeys }));
      } else if (req.method === "GET" && req.url === "/quit") {
        sendResponse(res, 200, "Shutting down proxy server in response to manual quit request!");
        server.close();
        process.exit(0);
      } else {
        sendResponse(res, 500, "Unknown endpoint");
      }
    })
    .listen(port);

  return server;
};

function alphabetize(obj) {
  const keys = Object.keys(obj);
  keys.sort();

  const newObj = {};
  for (const key of keys) {
    if (obj[key] instanceof Object) {
      newObj[key] = alphabetize(obj[key]);
    } else {
      newObj[key] = obj[key];
    }
  }

  return newObj;
}

function preserveOrderAndFormatting(existingJSON, newJSON) {
  const firstLine = existingJSON.split("\n")[0] + "\n";
  const lineEnding = firstLine.match(/\s+$/)[0];

  return newJSON
    .split("\n")
    .map(x => x.replace(/\s+$/, ""))
    .map(x => x + lineEnding)
    .join("");

  // return newJSON;
  // const linesBefore = existingJSON.split("\n");
  // const linesAfter = newJSON.split("\n");

  // for (let i = 0; i < linesAfter.length; i++) {
  //   // For now, even preserve bad indentation
  //   const before = linesBefore.find(x => x.replace(/\s/g, "") === linesAfter[i].replace(/\s/g, ""));
  //   if (before) {
  //     // linesAfter[i] = before;
  //   }
  // }

  // return linesAfter.join("\n");
}

function insertAlphabetically(obj, key, value) {
  const tuples = Object.entries(obj);

  // Clear existing object keys so we can re-add
  // while preserving existing order, except we are
  // alphabetically inserting the newest key
  let newObj = {};

  let isAdded = false;
  // [k, v] are the existing key and value
  for (const [k, v] of tuples) {
    // key is the new key; if it's <= alphabetically, then insert
    // now and flag as inserted so we don't duplicate it over and over
    if (!isAdded && key < k) {
      newObj[key] = value;
      isAdded = true;
    }

    // Re-add the previous existing k/v pairs in the order they
    // originally appeared, even if that order is alphabetically incorrect
    newObj[k] = v;
  }

  // Must be the last alphabetically if we didn't add it yet
  if (!isAdded) {
    newObj[key] = value;
  }

  return newObj;
}

// Workaround fs functions for crappy windows users
function safeReadFileSync(filename, encType) {
  try {
    const data1 = fs.readFileSync(filename, encType);
    return data1;
  } catch (ex) {
    // Probably a /c/Users/USERNAME/ path that needs a small "fix"
    // to placate the sadist who decided (a) windows would use backslashes
    // to separate folders, and (b) there would be a "C:" in the path
    //
    // Fixes bug where readFileSync("/c/Users/...") failed, but
    // using readFileSync("c:/users/...") will work (the slashes are
    // actually fine here...)
    filename = filename.replace("/c/", "c:/");
    const data2 = fs.readFileSync(filename, encType);
    return data2;
  }
}

function safeWriteFileSync(filename, data, encType) {
  try {
    const data1 = fs.writeFileSync(filename, data, encType);
    return data1;
  } catch (ex) {
    // Same as in safeRead...
    filename = filename.replace("/c/", "c:/");
    const data2 = fs.writeFileSync(filename, data, encType);
    return data2;
  }
}

module.exports.startProxyApi = startProxyApi;
