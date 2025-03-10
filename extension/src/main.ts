// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import * as fs from "fs";
import * as path from "path";

const api2 = require("../src/api");

// Typically key and value are both string, but conceivably
// the value could be an array.  (It will never be an object,
// as the list we receive is flattened.)
var translationLiterals: { [key: string]: any } = {};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log(
  //   'Congratulations, your extension "helloworld-sample" is now active!'
  // );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  console.log("HI>>>>");
  const disposable = vscode.commands.registerCommand(
    "main.i18nplusplus",
    () => {
      // vscode.window.showInformationMessage("hey there! welcome!");
      // The code you place here will be executed every time your command is executed
      const extensionConfig = vscode.workspace.getConfiguration(
        "i18n-plus-plus"
      );

      console.log("quick test", vscode.workspace.asRelativePath("./"));

      let workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.path;
      // Fix/workaround for windows putting lame C: in path
      workspaceFolder = workspaceFolder?.replace("c:", "c");
      // let f = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      console.log(
        "Using workspace folder as default relative root: ",
        workspaceFolder
      );

      // let port = 8089;
      // let configValue: string | undefined = extensionConfig.get("proxyPort");
      // if (configValue && !isNaN(parseInt(configValue))) {
      //   port = parseInt(configValue);
      // }

      let relativeRoot = workspaceFolder;
      let configValue: string | undefined = extensionConfig.get("languageFilesPath");
      if (configValue) {
        relativeRoot = configValue;
      }

      // User must configure the path where we'll find the language files
      if (!configValue) {
        vscode.window.showErrorMessage(
          "No config value set for languageFilesPath.  Please set this value in the extension's settings."
        );
        return;
      }

      if (configValue.endsWith("/")) {
        configValue = configValue.substring(0, configValue.length - 1);
      }

      // Validate that the configured path ultimately leads to the language files
      const enVerificationPath = `${configValue}/en.json`;
      if (!fs.statSync(enVerificationPath)) {
        vscode.window.showErrorMessage(
          `The config value set for languageFilesPath is invalid.\n\nFile does not exist: ${enVerificationPath}\n\nPlease update the value in the extension's settings.`
        );
        return;
      }

      api2.setRelativeRoot(context, relativeRoot);

      let developmentBranch = "";
      configValue = extensionConfig.get("mainBranch");
      if (configValue) {
        developmentBranch = configValue;
      }

      api2.setDevelopmentBranch(context, developmentBranch);

      const panel = vscode.window.createWebviewPanel(
        "i18n-plus-plus-panel",
        "i18n++",
        vscode.ViewColumn.One,
        {
          retainContextWhenHidden: true,
        }
      );

      panel.webview.options = {
        enableScripts: true,
      };

      const onDiskPath = vscode.Uri.joinPath(
        context.extensionUri,
        "src",
        "app.js"
      );
      const appSourceFile = panel.webview.asWebviewUri(onDiskPath);

      const markupPath = vscode.Uri.joinPath(
        context.extensionUri,
        "public",
        "app.html"
      );
      const markupUri = panel.webview.asWebviewUri(markupPath);

      const langUris: { [key: string]: vscode.Uri } = {};
      for (const langCode of ["en", "es", "fr", "fin", "swe"]) {
        langUris[langCode] = panel.webview.asWebviewUri(
          vscode.Uri.joinPath(
            context.extensionUri,
            "public",
            `${langCode}.json`
          )
        );
      }
      const enPath = vscode.Uri.joinPath(
        context.extensionUri,
        "public",
        "en.json"
      );
      const enUri = panel.webview.asWebviewUri(enPath);

      panel.webview.onDidReceiveMessage(async (message) => {
        console.log("recv", message);

        let apiMethod = "";
        if (message.command.startsWith("api/")) {
          apiMethod = message.command.substring(4);
          message.command = "api-call";
        }

        switch (message.command) {
          case "api-call":
            if (api2[apiMethod]) {
              const { id, args } = JSON.parse(message.text);

              // Always supply context as the first arg
              // Then supply all given args.  No, this is not very
              // "typescript-y."  No, I don't care.
              // Then supply vscode as a final arg.  Most functions ignore this.
              api2[apiMethod].apply(null, [context, ...args, vscode]).then((json: any) => {
                //
                panel.webview.postMessage({
                  command: "api-response",
                  text: JSON.stringify({ id, json }),
                });
              });
            } else {
              console.error("Unknown api method:", apiMethod);
            }
            break;
          case "translation-literals":
            translationLiterals = JSON.parse(message.text);
            break;
          case "save-prefs":
            await context.workspaceState.update(
              "i18n-plus-plus-prefs",
              message.text
            );
            console.log(
              "did it save?",
              context.workspaceState.get("i18n-plus-plus-prefs")
            );
            break;
          // Once vue has mounted, it'll reach out to request prefs.
          // We'll post a message back to it with the data.
          case "get-prefs":
            const prefs = context.workspaceState.get(
              "i18n-plus-plus-prefs"
            );
            panel.webview.postMessage({
              command: "load-prefs",
              text: prefs || "",
            });
            break;
          case "find-in-files":
            vscode.commands.executeCommand("workbench.action.findInFiles", {
              query: message.text,
              triggerSearch: true,
              matchWholeWord: true,
              isCaseSensitive: true,
            });

            break;
          case "copy-text-to-clipboard":
            vscode.env.clipboard.writeText(message.text);
            break;
          default:
            console.log("Unknown message type from webview:", message.command);
        }
      });

      const diskPaths: { [key: string]: vscode.Uri } = {
        js: panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "assets", "vue-renderer.js")),
        css: panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "assets", "vue-renderer.css")),
      };

      panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <link rel="icon" href="/favicon.ico">

        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-vue-next@0.15.5/dist/bootstrap-vue-next.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vite App</title>
        <script type="module" crossorigin src="${diskPaths.js}"></script>
        <link rel="stylesheet" crossorigin href="${diskPaths.css}">
      </head>
      <body class="h-100">
        <div id="app" class="h-100"></div>
      </body>
      </html>
      `;

      panel.onDidDispose(() => {
        // bye
      });
    }
  );

  context.subscriptions.push(disposable);

  let isHoverInitialized = false;

  class HoverProvider implements vscode.HoverProvider {
    public getDocumentSelector(): vscode.DocumentSelector {
      return { pattern: "**" };
    }

    public provideHover(
      document: vscode.TextDocument,
      position: vscode.Position
    ): Promise<vscode.Hover> | undefined {
      if (!translationLiterals) {
        console.log(
          "Cannot perform i18n++ hover logic because translations have not been loaded.  Activate the core extension first to trigger fetching of translation file data."
        );
        return;
      }

      let range = document.getWordRangeAtPosition(position);
      if (!range) {
        return;
      }

      let hasLeadingPeriod =
        range.start.character > 1 &&
        document
          .getText(
            range.with(
              new vscode.Position(range.start.line, range.start.character - 2),
              range.start
            )
          )
          .endsWith(".");

      // Infinite loop protection
      let loopsRemaining = 10;
      while (hasLeadingPeriod && loopsRemaining > 0) {
        loopsRemaining--;

        const prevWordRange = document.getWordRangeAtPosition(
          range.with(
            new vscode.Position(range.start.line, range.start.character - 2),
            range.start
          ).start
        );

        range = range?.with(prevWordRange?.start, range.end);

        hasLeadingPeriod =
          range.start.character > 1 &&
          document
            .getText(
              range.with(
                new vscode.Position(
                  range.start.line,
                  range.start.character - 2
                ),
                range.start
              )
            )
            .endsWith(".");
      }

      let hasTrailingPeriod = document
        .getText(
          range.with(
            range.end,
            new vscode.Position(range.end.line, range.end.character + 2)
          )
        )
        .startsWith(".");

      loopsRemaining = 10;
      while (hasTrailingPeriod && loopsRemaining > 0) {
        loopsRemaining--;

        const nextWordRange = document.getWordRangeAtPosition(
          range.with(
            range.start,
            new vscode.Position(range.end.line, range.end.character + 2)
          ).end
        );

        range = range?.with(range.start, nextWordRange?.end);

        hasTrailingPeriod = document
          .getText(
            range.with(
              range.end,
              new vscode.Position(range.end.line, range.end.character + 2)
            )
          )
          .startsWith(".");
      }

      if (loopsRemaining <= 0) {
        // If we hit some sort of unexpected infinite loop bug, just exit
        // without any hover tooltip
        console.log("Unexpected infinite loop issue with hover text from i18n++");
        return;
      }

      const hoveredWord = document.getText(range);
      // if (!hoveredWord.startsWith(DATA_BOUNDARY) || !hoveredWord.endsWith(DATA_BOUNDARY)) {
      //     return;
      // }

      console.log("HOVER FOR: ", hoveredWord);

      if (translationLiterals[hoveredWord]) {
        return Promise.resolve(
          new vscode.Hover(translationLiterals[hoveredWord])
        );
      }
    }
  }

  const quickSearchDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "#893101",
  });

  let lastSearchText = "";
  const disposable3 = vscode.commands.registerCommand(
    "main.i18nplusplus.quickSearch",
    () => {
      class Thing implements vscode.QuickPickItem {
        label: string
        description: string
        detail: string
        alwaysShow: boolean

        range: vscode.Range

        // constructor(public base: vscode.Uri, public uri: vscode.Uri) {
        constructor(label: string, description: string, detail: string, range: vscode.Range) {
          this.label = label;
          this.description = description;
          this.detail = detail;
          this.alwaysShow = true;

          this.range = range;
        }
      }

      const extensionConfig = vscode.workspace.getConfiguration(
        "i18n-plus-plus"
      );

      let relativeRoot = "";
      let configValue: string | undefined = extensionConfig.get("languageFilesPath");
      if (configValue) {
        relativeRoot = configValue;
      }

      // If the main extension hasn't been loaded up (which triggers
      // a message to provide translationLiterals its content), just
      // manually loop through the en.json file here and grab them
      //
      // This way we don't have to have a hard requirement to
      // "please launch the actual extension" to do the quick search
      if (Object.keys(translationLiterals).length === 0) {
        const data = fs.readFileSync(path.join(relativeRoot, "en.json"), "utf-8");
        const json = JSON.parse(data);

        const localWalk = (obj: any, prefix: string) => {
          for (let key in obj) {
            if (obj[key] instanceof Object) {
              localWalk(obj[key], (prefix ? prefix + "." : "") + key + ".");
            } else {
              translationLiterals[prefix + key] = obj[key];
            }
          }
        };

        localWalk(json, "");
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      let data = editor?.document.getText();
      if (!data) {
        return;
      }

      if (!isHoverInitialized) {
        vscode.languages.registerHoverProvider(
          { pattern: "**" },
          new HoverProvider()
        );
        isHoverInitialized = true;
      }

      const lines = data.split("\n");
      const findMatches = (searchTerm: string) => {
        const results: Thing[] = [];

        const matchingKeys: string[] = [];
        for (const key in translationLiterals) {
          if (
            translationLiterals[key]
              .toLowerCase()
              .includes(searchTerm.toLowerCase())
          ) {
            matchingKeys.push(key);
          }
        }

        const ranges: Array<vscode.Range> = [];
        const currentLineIdx = editor.selection.active.line || 0;

        for (const key of matchingKeys) {
          const searchTerms = [
            `$t("${key}")`,
            `$t('${key}')`,
            `$tc("${key}")`,
            `$tc('${key}')`,
            `"${key}"`,
            `'${key}'`,
          ];

          // Loop through lines first - cuz if we match one search term,
          // that's good enough and we'll skip the others
          for (let i = 0; i < lines.length; i++) {
            for (let j = 0; j < searchTerms.length; j++) {
              const term = searchTerms[j];
              let pos = lines[i].indexOf(term);
              if (pos >= 0) {
                const range = new vscode.Range(
                  new vscode.Position(i, pos),
                  new vscode.Position(i, pos + term.length)
                );
                ranges.push(range);

                results.push(new Thing(searchTerms[j], `Line ${i + 1}`, lines[i], range));

                // pos = lines[i].indexOf(term, pos + term.length);

                // Break outer loop too
                j = lines.length + 1;
                break;
              }
            }
          }
        }

        // Sort by line order, and then we'll be able to determine
        // the "next" item
        results.sort((a, b) => {
          return a.range.start.line < b.range.start.line ? -1 : a.range.start.line > b.range.start.line ? 1 : 0;
        });

        // Prefer to jump forward to the next line that matches
        // Ignore current line even if it has a match
        const bestMatch = results.find(r => r.range.start.line > currentLineIdx);

        // If there's a "next" item then it's the best match, and we want
        // to show this as the first item (so the user can type in a phrase,
        // then hit enter immediately without "actually selecting" anything
        // and just go right away to the nearest result.
        results.sort((a, b) => {
          return a === bestMatch ? -1 : b === bestMatch ? 1 : 0;
        });

        /*
        if (ranges.length > 0) {
          editor?.setDecorations(quickSearchDecoration, ranges);

          if (bestMatch) {
            editor.revealRange(bestMatch, vscode.TextEditorRevealType.Default);
            // editor.revealRange(ranges[0], vscode.TextEditorRevealType.
            // vscode.commands.executeCommand(`:${bestMatch.start.line}`);
            // executeCommand "cursorMove"

            // Come on vscode, there really should be an easier way
            // to go to a line, shouldn't there?
            vscode.commands.executeCommand("cursorMove", {
              to: "down",
              by: "line",
              value: bestMatch.start.line - currentLineIdx,
            });
          } else {
            editor.revealRange(ranges[0], vscode.TextEditorRevealType.Default);
          }
        } else {
          editor?.setDecorations(quickSearchDecoration, []);
        }
          */

        return results;
      };

      let x = 5;
      if (x > 0) {
        const qp = vscode.window.createQuickPick<Thing>();

        qp.placeholder = "Search for a translation literal...";
        qp.items = [];

        qp.value = lastSearchText;
        if (lastSearchText) {
          qp.items = findMatches(lastSearchText);
          editor?.setDecorations(quickSearchDecoration, qp.items.map(x => x.range));
        }

        qp.onDidChangeValue((val: string) => {
          qp.items = findMatches(val);
          editor?.setDecorations(quickSearchDecoration, qp.items.map(x => x.range));

          lastSearchText = val;
        });

        qp.onDidChangeSelection((values: readonly Thing[]) => {
          console.log("hey", values);
          const choice = values[0];

          const currentLineIdx = editor.selection.active.line || 0;

          const dy = choice.range.start.line - currentLineIdx;
          vscode.commands.executeCommand("cursorMove", {
            to: dy >= 0 ? "down" : "up",
            by: "line",
            value: Math.abs(dy),//choice.range.start.line - currentLineIdx,
          });
        });

        qp.onDidHide(() => {
          qp.dispose();
          editor?.setDecorations(quickSearchDecoration, []);
        });
        // vscode.window.showQuickPick(["abc", "def", "ghi"], { canPickMany: false });
        qp.show();
        return;
      }

      vscode.window
        .showInputBox({
          prompt: "Find translations keys matching literal text:",
          title: "i18n++ - Key Search by Text",
        })
        .then((searchTerm) => {
          if (!searchTerm) {
            editor?.setDecorations(quickSearchDecoration, []);
            return;
          }
        });
    }
  );

  context.subscriptions.push(disposable3);
}

