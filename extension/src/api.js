// const http = require("http");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;

let relativeRoot = "";

module.exports.setRelativeRoot = (value) => {
  relativeRoot = value;
  if (!relativeRoot.endsWith("/")) {
    relativeRoot += "/";
  }
};

let developmentBranch = "";

module.exports.setDevelopmentBranch = (value) => {
  developmentBranch = value;
};

module.exports.translate = async (json) => {
  const { apiKey, payload } = json;

  return axios
    .post("https://translation.googleapis.com/language/translate/v2", payload, {
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
      },
    })
    .then((res) => res.data)
    .then((json) => {
      return { ...json, processed: true };
    });
};

module.exports.save = async (json) => {
  const { langCode, key, value } = json;

  // const filename = `${relativeRoot}src/v2/services/i18n/lang/${langCode}.json`;
  const filename = path.join(relativeRoot, `${langCode}.json`);

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
    parent[prevPiece] = insertAlphabetically(
      parent[prevPiece],
      pieces[0],
      value
    );
  } else {
    obj = insertAlphabetically(obj, pieces[0], value);
  }

  // Keep some stuff as-is, but always format to correct indentation.
  const objAsJSON = JSON.stringify(obj, null, 2);
  const preservedObjAsJSON = preserveOrderAndFormatting(data, objAsJSON); //alphabetize(obj);

  // Write the fully-reformatted file to a "temp" file
  const tmpFilename = `${filename}.tmp`;
  safeWriteFileSync(
    tmpFilename,
    preservedObjAsJSON, // JSON.stringify(alphaObj, null, 2),
    "utf-8"
  );

  const diffFilename = `${filename}.diff`;

  // Because sometimes we push new translations that don't follow the
  // desired formatting, using JSON.stringify can cause whitespace-only
  // changes.  Let's generate a diff of the previous translation file contents
  // and the new stringified version, but choose to exclude whitespace changes.
  let workaroundRelativeRoot = relativeRoot;
  // More hackery for windows users (like... mee..... :/)
  if (relativeRoot.startsWith("/c/")) {
    workaroundRelativeRoot = "c:/" + relativeRoot.substring(3);
  }

  const diffPromise = new Promise((resolve) => {
    const cmd = exec(
      `cd ${workaroundRelativeRoot} && diff -w --strip-trailing-cr ${filename} ${tmpFilename} > ${diffFilename}`,
      (err, stdout, stderr) => {
        console.log(stdout, stderr, err);
        resolve();
      }
    );
  });
  await diffPromise;

  // Now let's apply just the non-whitespace diff changes to the translation
  // file, then clean up our junk files before concluding
  const patchPromise = new Promise((resolve) => {
    const cmd = exec(
      `cd ${workaroundRelativeRoot} && patch ${filename} ${diffFilename} && rm ${tmpFilename} ${diffFilename}`,
      (err, stdout, stderr) => {
        console.log(stdout, stderr, err);
        resolve();
      }
    );
  });
  await patchPromise;

//   safeWriteFileSync(
//     filename,
//     preservedObjAsJSON, // JSON.stringify(alphaObj, null, 2),
//     "utf-8"
//   );

  return { success: true };
};

module.exports.getLangFile = async (langCode) => {
  // const langCode = req.url.substring(6);
  const data = safeReadFileSync(
    // `${relativeRoot}src/v2/services/i18n/lang/${langCode}.json`,
    path.join(relativeRoot, `${langCode}.json`),
    "utf-8"
  );

  return JSON.parse(data);
};

module.exports.getDiff = async () => {
  // Use en.json file to check for which translation keys
  // are new.
  const langCode = "en";

  const promise1 = new Promise((resolve) => {
    let result;
    let workaroundRelativeRoot = relativeRoot;
    // More hackery for windows users (like... mee..... :/)
    if (relativeRoot.startsWith("/c/")) {
      workaroundRelativeRoot = "c:/" + relativeRoot.substring(3);
    }

    console.log("wrr", workaroundRelativeRoot);
    const cmd = exec(
      `cd ${workaroundRelativeRoot} && git show ${developmentBranch}:${langCode}.json`,
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
      // `${relativeRoot}src/v2/services/i18n/lang/en.json`,
      path.join(relativeRoot, `${langCode}.json`),
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

  return { new: newKeys };
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
    .map((x) => x.replace(/\s+$/, ""))
    .map((x) => x + lineEnding)
    .join("");
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

// Workaround fs functions for windows users
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
