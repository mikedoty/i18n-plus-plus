// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import * as fs from "fs";
import * as path from "path";
import { relative } from "path";

// import * as api2 from "../src/api";

// import startProxyApi from "../src/proxy";
const api = require("../src/proxy");
const api2 = require("../src/api");

// Typically key and value are both string, but conceivably
// the value could be an array.  (It will never be an object,
// as the list we receive is flattened.)
var translationLiterals: { [key: string]: any };

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
      vscode.window.showInformationMessage("hey there! welcome!");
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

      // vscode.window.showInformationMessage(configValue);

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

      api2.setRelativeRoot(relativeRoot);

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
              api2[apiMethod].apply(null, args).then((json: any) => {
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

      panel.webview.html = getHtml(
        appSourceFile,
        enUri,
        markupUri,
        langUris
      );

      panel.onDidDispose(() => {
        // if (proxyApi) {
        //   proxyApi.close(() => {
        //     console.log(
        //       "Webview disposed.  Proxy api server has been shut down."
        //     );
        //   });
        // }
      });
    }
  );

  context.subscriptions.push(disposable);

  const disposable2 = vscode.commands.registerCommand(
    "main.i18nplusplus.comparisonView",
    () => {
      const currentDocument = vscode.window.activeTextEditor?.document;
      if (!currentDocument) {
        return;
      }

      let data = currentDocument.getText();
      if (!data) {
        return;
      }

      let data2 = data;

      const editor = vscode.window.activeTextEditor;

      const ranges1: Array<vscode.Range> = [];
      const ranges2: Array<vscode.Range> = [];

      const lines1 = data.split("\n");
      const lines2 = data2.split("\n");

      for (const key in translationLiterals) {
        const searchTerms = [
          `$t("${key}")`,
          `$t('${key}')`,
          `"${key}"`,
          `'${key}'`,
        ];
        for (const term of searchTerms) {
          for (let i = 0; i < lines1.length; i++) {
            let pos = lines1[i].indexOf(term);
            while (pos >= 0) {
              // lines1[i] =
              //   lines1[i].substring(0, pos) +
              //   translationLiterals[key] +
              //   lines1[i].substring(pos + term.length);

              ranges1.push(
                new vscode.Range(
                  new vscode.Position(i, pos),
                  new vscode.Position(i, pos + term.length)
                )
              );

              pos = lines1[i].indexOf(term, pos + term.length);
            }

            pos = lines2[i].indexOf(term);
            while (pos >= 0) {
              lines2[i] =
                lines2[i].substring(0, pos) +
                translationLiterals[key] +
                lines2[i].substring(pos + term.length);

              ranges2.push(
                new vscode.Range(
                  new vscode.Position(i, pos),
                  new vscode.Position(i, pos + translationLiterals[key].length)
                )
              );

              pos = lines2[i].indexOf(
                term,
                pos + translationLiterals[key].length
              );
            }
          }
        }
        // data = data?.replace(`$t("${key}")`, translationLiterals[key]);
        // data = data?.replace(`$t('${key}')`, translationLiterals[key]);
        // data = data?.replace(`"${key}"`, translationLiterals[key]);
        // data = data?.replace(`'${key}'`, translationLiterals[key]);
      }

      data2 = lines2.join("\n");

      const decorationTest = vscode.window.createTextEditorDecorationType({
        backgroundColor: "green",
      });

      let tmpFilename = currentDocument.fileName;
      tmpFilename = path.basename(tmpFilename.replace(/\\/g, "/"));
      tmpFilename = `__tmp_${new Date().getTime()}_${tmpFilename}`;

      tmpFilename = `c:/Users/UDOTYM1/AppData/Local/Temp/${tmpFilename}`;

      fs.writeFileSync(tmpFilename, data2, "utf-8");

      // vscode.workspace.openTextDocument({
      //   language: editor?.document.languageId,
      //   content: data,
      // }).then((document) => {
      vscode.workspace
        .openTextDocument(vscode.Uri.file(tmpFilename))
        .then((document) => {
          vscode.window
            .showTextDocument(document, {
              viewColumn: vscode.ViewColumn.Beside,
              preserveFocus: true,
              preview: true,
            })
            .then((newEditor) => {
              //
              editor?.setDecorations(decorationTest, ranges1);
              newEditor.setDecorations(decorationTest, ranges2);
            });

          let ignoreNext = false;
          vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
            if (ignoreNext) {
              // Trying to avoid stupid loop where in the process of adjusting
              // the scroll for the "other" editor, it in turn fires off a
              // "scroll changed" event.
              ignoreNext = false;
              return;
            }

            const newEditor = vscode.window.visibleTextEditors.find(
              (editor) => editor.document === document
            );

            console.log(e.visibleRanges[0].start, e.visibleRanges[0]);
            if (e.textEditor === newEditor) {
              const range = new vscode.Range(
                e.visibleRanges[0].start,
                e.visibleRanges[0].start
              );
              // editor?.revealRange(e.visibleRanges[0]);//, vscode.TextEditorRevealType.AtTop);
              ignoreNext = true;
              editor?.revealRange(range, vscode.TextEditorRevealType.AtTop);
            } else {
              const range = new vscode.Range(
                e.visibleRanges[0].start,
                e.visibleRanges[0].start
              );
              // newEditor?.revealRange(e.visibleRanges[0]);//, vscode.TextEditorRevealType.AtTop);
              ignoreNext = true;
              newEditor?.revealRange(range, vscode.TextEditorRevealType.AtTop);
            }
          });
        });

      // vscode.window.activeTextEditor?.document.
    }
  );

  context.subscriptions.push(disposable2);

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

  const disposable3 = vscode.commands.registerCommand(
    "main.i18nplusplus.quickSearch",
    () => {
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

          const lines = data.split("\n");

          const matchingKeys: Array<string> = [];
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

          for (const key of matchingKeys) {
            const searchTerms = [
              `$t("${key}")`,
              `$t('${key}')`,
              `$tc("${key}")`,
              `$tc('${key}')`,
              `"${key}"`,
              `'${key}'`,
            ];

            for (const term of searchTerms) {
              for (let i = 0; i < lines.length; i++) {
                let pos = lines[i].indexOf(term);
                while (pos >= 0) {
                  ranges.push(
                    new vscode.Range(
                      new vscode.Position(i, pos),
                      new vscode.Position(i, pos + term.length)
                    )
                  );

                  pos = lines[i].indexOf(term, pos + term.length);
                }
              }
            }
          }

          if (ranges.length > 0) {
            editor?.setDecorations(quickSearchDecoration, ranges);

            editor.revealRange(ranges[0], vscode.TextEditorRevealType.Default);
          } else {
            editor?.setDecorations(quickSearchDecoration, []);
          }
        });
    }
  );

  context.subscriptions.push(disposable3);
}

function getHtml(
  appSourceFile: vscode.Uri,
  enUri: vscode.Uri,
  markupUri: vscode.Uri,
  langUris: { [key: string]: vscode.Uri }
) {
  const hiddenInputs = Object.keys(langUris)
    .map((langCode) =>
      `
      <input type="hidden" rel="lang-code" data-lang-code="${langCode}" value="${langUris[langCode]}"/>
    `.trim()
    )
    .join("");

  return `
		<html data-bs-theme="dark">
		<head>
			<meta http-equiv="Content-Security-Policy" content="connect-src 'self' http: https:">

			<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

			<script src="https://unpkg.com/vue@2.5.17/dist/vue.min.js"></script>
			<!--<script src="https://unpkg.com/bootstrap-vue@2.0.0-rc.11/dist/bootstrap-vue.min.js"></script>-->
			<script src="https://unpkg.com/bootstrap-vue@2.23.1/dist/bootstrap-vue.min.js"></script>

			<script type="text/javascript" src="${appSourceFile}"></script>

			<style type="text/css">
      .xyzzy { color: blue; }
			html, body {
				height: 100%;
			}
			body {
				padding: 0 !important;
			}

			input[type='checkbox'] {
				transform: scale(1.5);
			}

      .modal-backdrop
      {
        opacity:0.5 !important;
      }

      .tree-parent > .tree-row:nth-child(even) {
        background-color: rgb(26, 30, 34);
      }
      /* Want to force the default body-bg color for odd rows,
         even when they're nested inside of an even child (expanded folder) */
      .tree-parent > .tree-row:nth-child(odd) {
        background-color: rgb(33, 37, 41);
      }

      .tree-row {
				cursor: pointer;
        border-bottom: 1px #383838 solid;
			}
			.tree-row .item,
			.tree-row .parent {
				border-top: 1px transparent solid;
				border-bottom: 1px transparent solid;
        padding: 4px 8px;
			}
			.tree-row .item:hover,
			.tree-row .parent:hover [rel="item"] {
				/*border-top-color: #555;
				border-bottom-color: #555;*/
				filter: brightness(120%);
			}

			label .prefix {
				filter: brightness(50%);
			}

			/* Copy (most?) styles from b-form-input, but we want to use
			   a contenteditable div so we can highlight filter text matches */
			.fake-form-input {
				font-size: 1.0rem;
				line-height: 1.5;
				color: var(--bs-body-color);
				background-color: #111; /*var(--bs-body-bg);*/
				border: var(--bs-border-width) solid var(--bs-border-color);
				border-radius: var(--bs-border-radius);
				padding: 4px 8px;
			}

			.highlighter {
				background-color: #efcaa4;
				color: #111;
			}

			.hover-icon {
				display: none !important;
			}

      /* make sure hover doesn't also trigger the hover on all of the child folders */
			.parent:hover > [rel="item"] .hover-icon,
      .item:hover > [rel="item"] .hover-icon {
				display: block !important;
			}

			.nowrap {
				white-space: nowrap !important;
			}

      .disabled {
        cursor: not-allowed;
      }

      /* css looks bad by default on b-alerts, so just hide the button styling */
      .alert-dismissible button {
        background: transparent !important;
        border-width: 0 !important;
      }
		  </style>
		</head>
		<body>
			${hiddenInputs}
			<div id="app" data-uri="${markupUri}">
				<!-- Will replace with data from app.html! -->
			</div>
		</body>
		</html>
	`;
}
