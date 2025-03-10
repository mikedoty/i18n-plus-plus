import { ref, reactive, computed } from "vue";

import type { KeyValueTree } from "@/utils";
import type { Item } from "@/item";

import * as api from "@/api";
import { postMessage } from "./communication";

import { flatten } from "@/utils";

export interface Lang {
};

// const langs = reactive<{ [langCode: string]: KeyValueTree }>({});
const langs = reactive<{ [langCode: string]: Item[] }>({});

export const untranslatedLangCodeFocus = ref("");

export const untranslatedKeys = computed(() => {
    const keys: string[] = [];

    console.log("yo1", langs);
    const localWalk = (items: Item[]) => {
        for (const item of items) {
            // Only consider end-of-tree nodes, the actual strings
            // This will ignore parents/folders
            if (item.value) {
                let untranslatedLangCount = 0;
                for (const langCode in langs) {
                    if (langCode === "en") {
                        // Currently using en as base language, so don't check it
                        // as "untranslated"
                        //
                        // TODO: Allow customization of the "base" language, instead of hard-coding "en"?
                        continue;
                    }

                    if (untranslatedLangCodeFocus.value && langCode !== untranslatedLangCodeFocus.value) {
                        // Ignore it if the user is focusing on missing translations
                        // for a specific language
                        continue;
                    }

                    if (!checkIsValueTranslated(item, langCode)) {
                        untranslatedLangCount++;
                    }
                }

                if (untranslatedLangCount > 0) {
                    keys.push(item.key);
                }
            } else if (item.children.length) {
                localWalk(item.children);
            }
        }
    };

    // localWalk(this.allItems);
    if (langs["en"]) {
        localWalk(langs["en"]);
    }

    console.log("yo2", keys);
    return keys;
});

export function checkIsValueTranslated(itm: Item, langCode: string) {
    const en = getLangTranslation("en", itm.path, itm.shortKey);
    const translated = getLangTranslation(
        langCode,
        itm.path,
        itm.shortKey
    );

    // console.log("checking", [itm.key, en, translated]);

    // Sometimes we have a translation file where it has the english word
    // with an asterisk after it, which seems to mean "I put a translation here
    // but we didn't actually translate it yet."
    if (!translated || translated === en || translated === `${en}*`) {
        return false;
    }

    return true;
};

export function getLang(langCode: string) {
    return langs[langCode];
}

export function getLangCodeTitle(langCode: string) {
    const map: { [key: string]: string } = {
        es: "Spanish",
        fr: "French",
        fi: "Finnish",
        sv: "Swedish",
    };

    if (langCode in map) {
        return map[langCode];
    }

    // Can't find human readable language title
    return `(${langCode})`;
};

export function getLangTranslation(langCode: string, path: string[], key: string) {
    // I think I'm sending direct ref to the item object, so let's
    // just clone the array so we don't mutate it in-place
    path = [...path];

    let obj: Item[] | undefined = langs[langCode];
    while (path.length > 0) {
        const piece = path.splice(0, 1)[0];

        //   obj = obj.find((x) => x.shortKey === piece);
        const treeNode: Item | undefined = obj?.find((x) => x.shortKey === piece);
        if (!treeNode) {
            return "";
        } else {
            // obj = obj.children;
            obj = treeNode.children;
        }
    }

    // obj = obj.find((x) => x.shortKey === key);
    const lastNode: Item | undefined = obj?.find((x) => x.shortKey === key);
    if (!lastNode) {
        return "";
    } else {
        return lastNode.value;
    }
};

// Will call this after adding new to update display
// Prefer doing this instead of "smartly" inserting into
// allItems, just clean the slate and make sure all data
// is up-to-date
export async function refreshLangCodeItems(langCode: string) {
    langs[langCode] = await api.fetchLangCode(langCode);

    if (langCode === "en") {
        postMessage({
            command: "translation-literals",
            text: JSON.stringify(flatten(langs[langCode])),
        });
    }
};