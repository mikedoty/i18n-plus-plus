// import { reactive } from "vue";

import { deferredPromiseResolves, postMessage } from "@/components/hooks/communication";
import { alphabetize, walk } from "./utils";

import type { KeyValueTree } from "./utils";
import type { Options } from "./components/App.vue";

// Not an http server api anymore, but just using postMessage to pretend
// like it's an http api
function callApi<T>(method: string, ...aargs: any[]) {
    const args = [...aargs].slice(0);

    const id = `${Math.random()}-${new Date().getTime()}`;
    const msg = {
        command: `api/${method}`,
        text: JSON.stringify({ id, args }),
    };

    // let deferredResolve;
    const promise = new Promise<T>((resolve) => {
        deferredPromiseResolves[id] = resolve;
    });

    postMessage(msg);

    return promise;
}

export function getPrefs() {
    return callApi<Options>("getPrefs");
}

export function savePrefs(prefs: Options) {
    return callApi<{
        success: Boolean
    }>("savePrefs", prefs);
}

export function getAvailableLangCodes() {
    return callApi<{
        langCodes: string[]
    }>("getAvailableLangCodes")
        .then((json) => json.langCodes);
}

export function fetchLangCode(langCode: string) {
    return callApi<KeyValueTree>("getLangFile", langCode)
        .then((json) => {
            // Forced alphabetization
            json = alphabetize(json);

            return walk(json, [], "");

            // TODO: allItems logic update
            // if (langCode === "en") {
            //     allItems = this.langs.en;
            // }
        });
};

export function getNewTranslationKeys() {
    return (
        callApi<{
            new: string[]
            error?: string
        }>("getDiff")
    );
}

export function translateString(val: string, toLang: string, options: Options) {
    return callApi("translate", {
        apiKey: options.apiKey,
        payload: {
            q: val,
            source: "en",
            target: toLang,
            format: "text",
        },
    })
        .then((json: any) => {
            const data: any = json.data;
            return data?.translations[0]?.translatedText || "";
        })
        .catch((err) => {
            console.error(err);
        });
}

export function saveTranslation(langCode: string, key: string, value: string) {
    return callApi<{
        success: boolean
    }>("save", {
        langCode,
        key,
        value,
    })
    // .then((json) => {
    //     this.refreshLangCodeItems("en").then(() => {
    //         this.addNewModal.show = false;

    //         this.fetchNewTranslationKeys().then((keys) => {
    //             this.newTranslationKeys = keys;
    //         });
    //     });
    // })

}

export function copyKeyToClipboard(key: string) {
    return callApi<{
        success: boolean
    }>("copyKeyToClipboard", key);
    // copyKeyToClipboard(key);
}

export function findKeyInFiles(key: string) {
    return callApi<{
        success: boolean
    }>("findKeyInFiles", key);
}