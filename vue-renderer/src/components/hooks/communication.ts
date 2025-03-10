import { onMounted, reactive } from "vue";

let vscode: any = null;

export const deferredPromiseResolves = reactive<{ [key: string]: any }>({});

// @ts-ignore
vscode = acquireVsCodeApi();

window.addEventListener("message", (e) => {
    console.log("app recv", e);
    const message = e.data;
    switch (message.command) {
        case "api-response":
            const { id, json } = JSON.parse(message.text) as { id: string, json: unknown };
            if (id in deferredPromiseResolves) {
                deferredPromiseResolves[id](json);
            } else {
                console.error("Unexpected api response for msg id:", id);
            }
            break;

        // case "load-prefs":
        //     if (!message.text) {
        //         return; // nothing previously saved
        //     }
        //     const json2 = JSON.parse(message.text);
        //     this.options = {
        //         ...this.options,
        //         ...json2,
        //     };
        //     break;
        default:
            console.warn("Received unknown command:", message.command);
    }
});

// vscode.postMessage({
//     command: "get-prefs",
// });

export function postMessage(obj: any) {
    vscode.postMessage(obj);
};