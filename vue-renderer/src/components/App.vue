<script setup lang="ts">
import { useColorMode, type BaseButtonVariant } from 'bootstrap-vue-next'
const mode = useColorMode({
    // @ts-ignore
    selector: "body",
});
mode.value = "dark";

import { onMounted, ref, reactive, computed, watch } from 'vue';

import { checkItemContainsAnyKey, checkItemMatchesFilterText } from '@/item';
import type { Item } from '@/item';

import { expandedKeys, checkIsItemExpanded, toggleExpanded } from "./hooks/expandedItems";

import {
    getLang,
    getLangCodeTitle,
    getLangTranslation,
    refreshLangCodeItems,
    untranslatedKeys,
    untranslatedLangCodeFocus,
    checkIsValueTranslated,
} from "@/components/hooks/useLang";

import * as api from "@/api";

export interface Options {
    apiKey: string
    foldersFirst: boolean
    onlyNew: boolean
    onlyUntranslated: boolean
    langCodeFocus: string
};

const options = reactive<Options>({
    apiKey: "",
    foldersFirst: false,
    onlyNew: false,
    onlyUntranslated: false,
    langCodeFocus: "",
});

// Get the existing prefs once, before settings up
// the watcher (because we're using Object.assign to
// import existing prefs, which would otherwise trigger
// the watch)
(async () => {
    // await api.savePrefs(options);
    const prefs = await api.getPrefs();
    console.log("yo got prefs", prefs);
    Object.assign(options, prefs);
    console.log("options now = ", options);

    watch(options, () => {
        api.savePrefs(options);
    });

    watch(() => options.langCodeFocus, (val) => {
        untranslatedLangCodeFocus.value = val;
    });
})();

function handleError(err: any) {
    console.log("An error occurred", err);
    console.error(err);
};

const clickCount = ref(0);

const filterText = ref("");
watch(filterText, (val) => {
    // If user clears search filter, then wipe out all expanded keys
    // state data.  If they do a new search, they start from square one.
    if (!val) {
        expandedKeys.filtered = {};
    }
});

const expandedKeysSource = computed(() => {
    if (filterText.value || options.onlyNew) {
        return "filtered";
    } else {
        return "default";
    }
});

const allItems = reactive<Item[]>([]);
const filteredItems = computed(() => {
    let results: Item[] = [];

    // As we apply filters (literal text filter, or "only new," or
    // "only untranslated" etc.) we want to apply them recursively,
    // so here's a little local walk function to do that.
    const walkAndSplice = (items: Item[], filterFunc: (item: Item) => Boolean) => {
        let i = 0;
        while (i < items.length) {
            const isMatch = filterFunc(items[i]);
            if (!isMatch) {
                items.splice(i, 1);
            } else {
                items[i].children = walkAndSplice(items[i].children, filterFunc);
                i++;
            }
        }

        return items;
    };

    if (filterText.value) {
        // We're going to savagely mutate an items array, and it's deeply
        // nested cuz it's a tree, so let's make a complete clone so we
        // don't mess up the existing items data.
        results = JSON.parse(JSON.stringify(allItems)) as Item[];

        walkAndSplice(results, (item: Item) => checkItemMatchesFilterText(item, filterText.value));
    } else {
        // Let's clone it here too, cause we may do sorting and we
        // prefer not to mutate the original source data
        results = JSON.parse(JSON.stringify(allItems));
    }

    if (options.foldersFirst) {
        const localWalk = (items: Item[]) => {
            items.sort((a, b) => {
                const isFolderA = a.children.length;
                const isFolderB = b.children.length;

                if (isFolderA && !isFolderB) {
                    return -1;
                } else if (!isFolderA && isFolderB) {
                    return 1;
                } else {
                    return 0;
                }
            });

            for (const itm of items) {
                if (itm.children.length) {
                    localWalk(itm.children);
                }
            }
        };

        localWalk(results);
    }

    if (options.onlyNew) {
        // results = results.filter((itm) =>
        //     checkItemContainsAnyKey(itm, newTranslationKeys)
        // );

        walkAndSplice(results, (item: Item) => checkItemContainsAnyKey(item, newTranslationKeys));
    }

    if (options.onlyUntranslated) {
        // results = results.filter((itm) =>
        //     checkItemContainsAnyKey(itm, untranslatedKeys.value)
        // );

        // walkAndSplice(results, (item: Item) => checkItemMatchesFilterText(item, filterText.value));
        walkAndSplice(results, (item: Item) => checkItemContainsAnyKey(item, untranslatedKeys.value));
    }

    return results;
});

watch(() => filteredItems.value, () => {
    // If user is filtering and has received new results by entering
    // or changing filter text, then default expanded to true for
    // all tree branches.  (The idea here is that the result set should
    // be fairly small, and we probably want to see all expanded results.)
    if (filterText.value || options.onlyNew) {
        // We'll update this via scope
        const obj: { [key: string]: boolean } = {};
        // local walk to go through all items and set expanded=true on each
        const localWalk = (itm: Item) => {
            if (itm.children.length > 0) {
                obj[itm.key] = true;
                for (const child of itm.children) {
                    localWalk(child);
                }
            }
        };

        for (const itm of filteredItems.value) {
            localWalk(itm);
        }

        expandedKeys.filtered = obj;
    }
});

const showApiKey = ref(false);
const newTranslationKeys = reactive<string[]>([]);

const langCodes = reactive<string[]>(["es", "fr"]);

const isSelectedItemPluralizable = computed(() => {
    if (!selection.item?.value) {
        return false;
    }

    // Format for singular, plural is separated by a pipe, e.g.
    // 1 point | {n} points
    //
    // So, just check if removing all non-pipes leaves one character...
    if (selection.item?.value.replace(/[^|]/g, "").length === 1) {
        return true;
    }

    return false;
});


//         selectedItemTranslations: { },
// selectedItemTranslationsChanges: { },
const selection: {
    item: Item | null
    translations: { [key: string]: string }
    translationsChanges: { [key: string]: string }
} = reactive({
    item: null,
    translations: {},
    translationsChanges: {},
})

function onSelectItem(itm: Item) {
    selection.item = {
        ...itm,
        isEditing: false,
        valueChanges: itm.value,
    };

    const translations: { [key: string]: string } = {};
    for (const langCode of ["en", ...langCodes]) {
        translations[langCode] = getLangTranslation(
            langCode,
            itm.path,
            itm.shortKey
        );

        // Fallback to default base language translation
        if (!translations[langCode].trim()) {
            translations[langCode] = getLangTranslation(
                "en",
                itm.path,
                itm.shortKey
            );
        }
    }

    // Store any v-model changes in a separate object so
    // we can do "is it changed" diffs
    selection.translations = translations;
    selection.translationsChanges = { ...translations };
}

function getSingularSelectedItemTranslation(langCode: string) {
    const value = selection.translationsChanges[langCode];
    const pieces = value.split("|");
    return (pieces[0] || "").trim();
}

function getPluralSelectedItemTranslation(langCode: string) {
    const value = selection.translationsChanges[langCode];
    const pieces = value.split("|");

    if (pieces.length > 1) {
        return (pieces[1] || "").trim();
    } else {
        return "";
    }
}

function onUpdateSingularSelectedItemTranslation(langCode: string, val: string) {
    const s = val;
    const p = getPluralSelectedItemTranslation(langCode);

    selection.translationsChanges[langCode] = `${s.trim()} | ${p.trim()}`;
}

function onUpdatePluralSelectedItemTranslation(langCode: string, val: string) {
    const s = getSingularSelectedItemTranslation(langCode);
    const p = val;

    selection.translationsChanges[langCode] = `${s.trim()} | ${p.trim()}`;
}

const addNewModal = reactive<{
    isBusy: boolean
    show: boolean
    key: string
    value: string
}>({
    isBusy: false,
    show: false,
    key: "",
    value: "",
});

function onShowAddNew(initialPrefix: string) {
    addNewModal.show = true;
    addNewModal.key = initialPrefix || "";
    addNewModal.value = "";
    // Object.assign(addNewModal, {
    //     show: true,
    //     key: initialPrefix || "",
    //     value: "",
    // });
}

async function onAddTranslation() {
    addNewModal.isBusy = true;
    await api.saveTranslation("en", addNewModal.key, addNewModal.value).catch(handleError);

    // .catch(handleError)
    // .finally(() => {
    //     this.addNewModal.isBusy = false;
    // });

    addNewModal.isBusy = false;

    for (const langCode of ["en", ...langCodes]) {
        await refreshLangCodeItems(langCode).catch(handleError);

        if (langCode === "en") {
            allItems.splice(0, allItems.length, ...getLang("en"));
        }
    }
}

// TODO: IMPLEMENT THESE
function onFindInFiles(key: string) {
    api.findKeyInFiles(key);
}

function onCopyToClipboard(key: string) {
    api.copyKeyToClipboard(key);
}

async function onToggleEditEnglish() {
    if (!selection.item) {
        return console.error("Cannot toggle edit when no item is selected.");
    }

    if (selection.item.isEditing) {
        if (selection.item.value === selection.item.valueChanges) {
            // No change was made
            selection.item.isEditing = false;
            return;
        }

        selection.item.value = selection.item.valueChanges || "";
        selection.translationsChanges["en"] = selection.item.value;

        // This will end up auto-refetching the english dict data
        // to update UI everywhere
        await onSaveChanges("en").catch(handleError);
        selection.item.isEditing = false;
    } else {
        selection.item.isEditing = true;
    }
}

// Long value is based on the default en text.
function checkIsLongValue(/*langCode: string*/) {
    const itm = selection.item;
    if (!itm) {
        return false;
    }

    const en = getLangTranslation("en", itm.path, itm.shortKey);
    if (!en) {
        return false;
    }

    // This is obviously completely arbitrary.  In theory an intrepid
    // developer could make this a user preference.  That's not me,
    // not for this.  haahahahahahaha
    return en.length > 160;
}

function checkIsValueModified(langCode: string) {
    const a = selection.translations[langCode];
    const b = selection.translationsChanges[langCode];

    return a !== b;
}

async function onSaveChanges(langCode: string, saveAndContinue?: boolean) {
    if (!selection.item) {
        return console.error("Unable to save changes because no item is selected.");
    }

    await api.saveTranslation(langCode, selection.item.key, selection.translationsChanges[langCode]).catch(handleError);

    selection.translations[langCode] = selection.translationsChanges[langCode];

    await refreshLangCodeItems(langCode).catch(handleError);

    // TODO: Support skip item stuff
    // if (continueToNextAfterSave) {
    //   this.onSkipItem();
    // }
}

function getTranslateButtonVariant(langCode: string): keyof BaseButtonVariant {
    if (!selection.item) {
        return "primary";
    }

    return checkIsValueTranslated(selection.item, langCode)
        ? "secondary"
        : "primary";
}

function getTranslateButtonText(langCode: string) {
    if (!selection.item) {
        return "Translate";
    }

    if (checkIsValueTranslated(selection.item, langCode)) {
        return "Re-translate";
    }

    return "Translate";
}

function onSkipItem() {
}

async function onTranslate(langCode: string) {
    if (isSelectedItemPluralizable.value) {
        // Grab english sing/plural to use as translation source
        const s = getSingularSelectedItemTranslation("en");
        let p = getPluralSelectedItemTranslation("en");

        // To try to get more reliable translations, when the string
        // looks like "You have selected {n} items" we prefer to send
        // a mock amount e.g. "You have selected 50 items"
        let replacedN = false;
        if (p.indexOf("50") < 0 && p.indexOf("{n}") >= 0) {
            replacedN = true;
            // 50 is completely arbitrary.  We only attempt this if the
            // phrase itself doesn't already have a "50" in it (this seems
            // like it probably won't ever be the case...)
            p = p.replace("{n}", "50");
        }

        const ts = await translateString(s, langCode);
        let tp = await translateString(p, langCode);

        // If failure to convert singular (ts) or plural (tp),
        // do no further action.
        if (!ts || !tp) {
            return console.error("Error attempting to translate pluralizable value.", [ts, tp]);
        }

        if (replacedN) {
            // Final translation should revert to the {n} now
            tp = tp.replace("50", "{n}");
        }

        selection.translationsChanges[
            langCode
        ] = `${ts.trim()} | ${tp.trim()}`;
    } else {
        translateString(
            selection.translationsChanges["en"],
            langCode
        ).then((value: string | void) => {
            if (value) {
                selection.translationsChanges[langCode] = value;
            }
        });
    }
}

async function translateString(val: string, langCode: string): Promise<string | void> {
    if (!selection.item) {
        return console.error("Unable to translate when no selection is made");
    }

    const translatedValue = await api.translateString(val, langCode, options).catch(handleError);

    // If we failed to translate (got back empty), do not
    // save the changes.
    if (!translatedValue) {
        return console.error("Unable to translate, or received empty translation value.");
    }

    return translatedValue;
}

onMounted(async () => {
    const promises = [];

    const result = await api.getAvailableLangCodes();
    langCodes.splice(0, langCodes.length, ...result);

    // TODO: Fetch en file and share with extension via postMessage
    for (const langCode of ["en", ...langCodes]) {
        await refreshLangCodeItems(langCode).catch(handleError);
        // if (langCode === "en") {
        //     // Share with actual extension
        //     const msg = {
        //         command: "translation-literals",
        //         text: JSON.stringify(flatten(json)),
        //     };

        //     vscode.postMessage(msg);
        // }

        // // Forced alphabetization
        // json = alphabetize(json);

        // // global hack for adding a "nextItemKey" value
        // gWalkPrevRef = null;
        // langs[langCode] = walk(json, [], "");
        // gWalkPrevRef = null; // important to put this here to prevent last item in one language from pointing to another language

        // TODO: Clean up "allItems" logic.  Has to use .pop() approach for reactive...
        if (langCode === "en") {
            allItems.splice(0, allItems.length, ...getLang("en"));
        }
    }

    // TODO: Re-enable "only new" translation keys
    // promises.push(
    //     this.fetchNewTranslationKeys().then((keys) => {
    //         this.newTranslationKeys = keys;
    //     })
    // );
});

</script>

<template>
    <div class="row g-0 h-100">
        <div class="col-8 h-100 overflow-auto">
            <div class="d-flex flex-column h-100">
                <div class="d-flex align-items-center px-4 py-2"
                    style="background-color: #111519; border-bottom: 2px #222 solid">
                    <div>
                        <BInputGroup>
                            <BButton variant="secondary">
                                <i class="fa fa-search" />
                            </BButton>
                            <BFormInput id="filter-by-text" type="search" placeholder="Filter by key or English text..."
                                v-model="filterText" style="min-width: 300px; max-width: 300px" :debounce="500" />
                        </BInputGroup>
                    </div>

                    <div class="flex-fill" />

                    <BPopover>
                        <template #target>
                            <div class="mx-4">
                                <i class="fa fa-filter" />
                            </div>
                        </template>
                        <ul>
                            <li>
                                <BFormCheckbox v-model="options.foldersFirst" class="nowrap">
                                    <span class="ps-2">Folders First</span>
                                </BFormCheckbox>
                            </li>

                            <li>
                                <BFormCheckbox v-model="options.onlyNew" class="nowrap">
                                    <span class="ps-2">Only New</span>
                                </BFormCheckbox>
                            </li>

                            <li>
                                <BFormCheckbox v-model="options.onlyUntranslated" class="nowrap">
                                    <span class="ps-2">Only Untranslated</span>
                                </BFormCheckbox>
                            </li>


                            <li v-if="options.onlyUntranslated" class="ms-4">
                                <select class="px-4 py-2" v-model="options.langCodeFocus">
                                    <option value="">(All Languages)</option>
                                    <option value="es">es (Spanish)</option>
                                    <option value="fr">fr (French)</option>
                                    <option value="fi">fi (Finnish)</option>
                                    <option value="sv">sv (Swedish)</option>
                                </select>
                            </li>
                        </ul>
                    </BPopover>

                    <!-- <div class="mx-2" style="white-space: nowrap">Folders First:</div>
                <BInputGroup>
                  <BButton
                    :active="!options.foldersFirst"
                    active-class="active"
                    @click="options.foldersFirst = false"
                  >
                    Off
                  </BButton>
                  <BButton
                    :active="options.foldersFirst"
                    active-class="active"
                    @click="options.foldersFirst = true"
                  >
                    On
                  </BButton>
                </BInputGroup> -->

                    <div>
                        <BButton variant="primary" style="white-space: nowrap" @click="onShowAddNew('')"
                            @ok="onAddTranslation">
                            <i class="fa fa-plus" /> Add Key...
                        </BButton>
                    </div>
                </div>
                <div class="flex-fill px-4 py-4 overflow-auto" style="border-right: 2px #222 solid">
                    <Row :items="filteredItems" :current-source="expandedKeysSource" @select-item="onSelectItem"
                        :check-is-key-expanded="checkIsItemExpanded"
                        @toggle-expand="toggleExpanded($event, expandedKeysSource)" @show-add-new="onShowAddNew($event)"
                        @find-in-files="onFindInFiles($event)" @copy-to-clipboard="onCopyToClipboard($event)" />
                </div>
            </div>
        </div>
        <div class="col-4 h-100 px-4 py-4 overflow-auto" style="background-color: #111519">
            <div class="row" style="filter: brightness(75%)">
                <div class="col-12 d-flex align-items-center">
                    <div class="flex-fill">
                        <label>Google Translate API Key</label>
                        <div class="d-flex align-items-center">
                            <BFormInput :type="showApiKey ? 'text' : 'password'" v-model="options.apiKey" />
                            <div class="mx-2" style="cursor: pointer" @click="showApiKey = !showApiKey">
                                <span v-if="showApiKey" key="show-api-key-on">
                                    <i class="fa fa-eye" />
                                </span>
                                <span v-else key="show-api-key-off">
                                    <i class="fa fa-eye-slash" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <hr />

            <template v-if="selection.item">
                <div class="d-flex align-items-center">
                    <div>
                        <i class="fa fa-file fa-fw" />
                    </div>
                    <div class="d-flex flex-column flex-fill ps-1">
                        <label>
                            <span class="prefix" v-html="selection.item.prefix" /><span
                                v-html="selection.item.displayShortKey" />
                        </label>
                        <div class="d-flex align-items-center">
                            <BFormInput type="text" :readonly="!selection.item.isEditing"
                                v-model="selection.item.valueChanges" :class="{
                                    disabled: !selection.item.isEditing,
                                }" />
                            <div class="mx-2" @click="onToggleEditEnglish" style="cursor: pointer">
                                <span v-if="selection.item.isEditing" key="selected-item-edit-on">
                                    <i class="fa fa-save" />
                                </span>
                                <span v-else key="selected-item-edit-off">
                                    <i class="fa fa-pencil" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <hr />
            </template>

            <div class="row">
                <div class="col-12">
                    <template v-if="selection.item">
                        <div v-for="langCode in langCodes" :key="langCode" class="mb-2">
                            <label>{{ getLangCodeTitle(langCode) }}</label>

                            <!-- Pluralizable items require 2 inputs! -->
                            <template v-if="isSelectedItemPluralizable">
                                <div class="row">
                                    <div class="col-6">
                                        <label style="filter: brightness(0.75)">Singular</label>
                                        <!-- Typescript getting mad about $event claiming numberish, don't know why - it works fine... -->
                                         <!-- @vue-ignore -->
                                        <BFormInput type="text" :value="getSingularSelectedItemTranslation(langCode)"
                                            @update:model-value="onUpdateSingularSelectedItemTranslation(langCode, $event)" />
                                    </div>
                                    <div class="col-6">
                                        <label style="filter: brightness(0.75)">Plural</label>
                                        <!-- Typescript mad here too, same deal.  I don't care.  gfy typescript... -->
                                         <!-- @vue-ignore -->
                                        <BFormInput type="text" :value="getPluralSelectedItemTranslation(langCode)"
                                            @update:model-value="onUpdatePluralSelectedItemTranslation(langCode, $event)" />
                                    </div>
                                </div>
                                <!--
                                If translation exists, render a readonly fake-form-looking
                                input below for a visual confirmation that we'll be saving
                                the right singular | plural value
                                -->
                                <div v-if="selection.translationsChanges[langCode]"
                                    class="fake-form-input mt-2 disabled"
                                    v-html="selection.translationsChanges[langCode]" />
                            </template>
                            <!-- Items with "long" values will use a textarea -->
                            <template v-else-if="checkIsLongValue()">
                                <BFormTextarea rows="2" v-model="selection.translationsChanges[langCode]" />
                            </template>
                            <template v-else>
                                <BFormInput type="text" v-model="selection.translationsChanges[langCode]" />
                            </template>
                            <div class="d-flex mt-2">
                                <div class="flex-fill" />

                                <template v-if="checkIsValueModified(langCode)">
                                    <BButton variant="primary" @click="onSaveChanges(langCode)" class="me-2">
                                        Save Changes
                                    </BButton>
                                    <BButton v-if="options.langCodeFocus === langCode" variant="primary"
                                        @click="onSaveChanges(langCode, true)" class="me-2">
                                        Save and Continue
                                    </BButton>
                                </template>
                                <template v-else>
                                    <BButton v-if="options.onlyUntranslated && options.langCodeFocus === langCode"
                                        variant="secondary" @click="onSkipItem()" class="me-2">
                                        Skip
                                    </BButton>
                                </template>

                                <!-- @ts-ignore -->
                                <BButton :variant="getTranslateButtonVariant(langCode)" @click="onTranslate(langCode)">
                                    {{ getTranslateButtonText(langCode) }}
                                </BButton>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- <div> wtf {{ selection }}</div> -->
    </div>

    <BModal v-model="addNewModal.show" centered hide-header ok-title="Add Translation"
        :ok-disabled="addNewModal.isBusy || !addNewModal.key || !addNewModal.value"
        :cancel-disabled="addNewModal.isBusy" :no-close-on-esc="addNewModal.isBusy" no-close-on-backdrop
        @ok="onAddTranslation">
        <div>
            <label>Key</label>
            <BFormInput type="text" v-model="addNewModal.key" />

            <br />

            <label>Value</label>
            <BFormInput type="text" v-model="addNewModal.value" />
        </div>
    </BModal>
</template>

<style scoped>
ul,
li {
    list-style-type: none;
}
</style>

<!-- global style at least for now, it was this way in original js version -->
<style>
.xyzzy {
    color: blue;
}

html,
body {
    height: 100%;
}

body {
    padding: 0 !important;
}

input[type='checkbox'] {
    transform: scale(1.5);
}

.modal-backdrop {
    opacity: 0.5 !important;
}

.tree-parent>.tree-row:nth-child(even) {
    background-color: rgb(26, 30, 34);
}

/* Want to force the default body-bg color for odd rows,
         even when they're nested inside of an even child (expanded folder) */
.tree-parent>.tree-row:nth-child(odd) {
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
    background-color: #111;
    /*var(--bs-body-bg);*/
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
/* .parent:hover>[rel="item"] .hover-icon,
.item:hover>[rel="item"] .hover-icon {
    display: block !important;
} */

.parent:hover,
.item:hover {
    >[rel="item"] .hover-icon {
        display: block !important;
    }

    /* Don't show the hover icon if a child "folder" is being hovered */
    /* (In this case, the hover icons for only the child folder should show) */
    &:has(.tree-row:hover) {
        >[rel="item"] .hover-icon {
            display: none !important;
        }
    }
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