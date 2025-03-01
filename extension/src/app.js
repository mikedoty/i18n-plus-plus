// const api = require("./api.js");

document.addEventListener("DOMContentLoaded", async () => {
  // Don't do it this way.  Use `template` prop instead - this
  // allows us to check existing innerHTML if we need to use
  // querySelector for any reason on data passed in...
  // document.querySelector("#app").innerHTML = markup;

  // Grab these attributes from the supplied html before
  // instantiating the vue component, which will overwrite the
  // entire document with the `template` html data.
  const providedPort = document.body.getAttribute("data-port");

  const markup = await fetch(
    document.querySelector("#app").getAttribute("data-uri")
  ).then((resp) => resp.text());

  Vue.component("Row", {
    props: {
      applyMargin: { type: Boolean, default: false },
      items: { type: Array, required: true },
      checkIsKeyExpanded: { type: Function, required: true },
    },
    data: () => ({}),
    template: `
      <div class="tree-parent" :class="{
        'ps-3': applyMargin,
        'ms-3': applyMargin,
      }">
        <div v-for="itm in items" class="tree-row py-2">
          <div v-if="itm.value" class="item" @click="$emit('select-item', itm)">
            <div rel="item" class="d-flex align-items-center">
              <div>
                <i class="fa fa-file fa-fw"/>
              </div>
              <div class="d-flex flex-column flex-fill ps-1">
                <div class="d-flex align-items-center">
                  <label><span class="prefix" v-html="itm.prefix"/><span v-html="itm.displayShortKey"/></label>
                  <div class="hover-icon ps-2" @click.stop="$emit('find-in-files', itm.key)" title="Search via Find in Files">
                    <i class="fa fa-search fa-fw"/>
                  </div>
                  <div class="hover-icon ps-1" @click.stop="$emit('copy-to-clipboard', itm.key)" title="Copy key to clipboard">
                    <i class="fa fa-copy fa-fw"/>
                  </div>
                </div>
                <div class="fake-form-input" v-html="itm.displayValue"/>
                <!--<b-form-input type="text" readonly="readonly" :value="itm.value"/>-->
              </div>
            </div>
          </div>
          <div v-else class="parent">
            <div rel="item" @click="$emit('toggle-expand', itm)" :class="{ 'pb-2': checkIsKeyExpanded(itm) }">
              <div v-if="checkIsKeyExpanded(itm)" key="tree-open" class="d-flex align-items-center">
                <i class="fa fa-chevron-down fa-fw"/>
                <span class="ps-1">
                  <label><span class="prefix" v-html="itm.prefix"/><span v-html="itm.displayShortKey"/></label>
                </span>
                <div class="hover-icon px-2" @click.stop="$emit('find-in-files', itm.key)" title="Search via Find in Files">
                  <i class="fa fa-search fa-fw"/>
                </div>
                <div class="flex-fill"/>
                <div class="hover-icon d-flex align-items-center" @click.stop="$emit('show-add-new', itm.key + '.')">
                  <i class="fa fa-plus"/>
                  <span class="ms-2">{{ itm.key }}.[...]</span>
                </div>
              </div>
              <div v-else key="tree-closed" class="d-flex align-items-center">
                <i class="fa fa-chevron-right fa-fw"/>
                <span class="ps-1">
                  <label><span class="prefix" v-html="itm.prefix"/><span v-html="itm.displayShortKey"/></label>
                </span>
                <div class="hover-icon px-2" @click.stop="$emit('find-in-files', itm.key)" title="Search via Find in Files">
                  <i class="fa fa-search fa-fw"/>
                </div>
                <div class="flex-fill"/>
                <div class="hover-icon d-flex align-items-center" @click.stop="$emit('show-add-new', itm.key + '.')">
                  <i class="fa fa-plus"/>
                  <span class="ms-2">{{ itm.key }}.[...]</span>
                </div>
              </div>
            </div>
            <Row
              v-if="checkIsKeyExpanded(itm)"
              :items="itm.children"
              apply-margin
              :check-is-key-expanded="checkIsKeyExpanded"
              @toggle-expand="$emit('toggle-expand', $event)"
              @select-item="$emit('select-item', $event)"
              @show-add-new="$emit('show-add-new', $event)"
              @find-in-files="$emit('find-in-files', $event)"
              @copy-to-clipboard="$emit('copy-to-clipboard', $event)"
            />
          </div>
        </div>
      </div>
    `,
    methods: {},
  });

  new Vue({
    el: "#app",
    data: () => ({
      vscode: null,
      port: providedPort,
      showPortAlert: false,
      deferredPromiseResolves: {},
      clickCount: 0,
      filterText: "",
      options: {
        apiKey: "",
        foldersFirst: false,
        onlyNew: false,
        onlyUntranslated: false,
        langCodeFocus: "",
      },
      showApiKey: false,
      newTranslationKeys: [],
      untranslatedKeys: [],
      langs: {},
      // langCodes: ["es", "fr", "fi", "sv"],
      langCodes: ["es", "fr"],
      selectedItem: null,
      selectedItemTranslations: {},
      selectedItemTranslationsChanges: {},
      allItems: [],
      expandedKeys: {},
      expandedKeysFilteredView: {},
      addNewModal: {
        isBusy: false,
        show: false,
        key: "",
        value: "",
      },
    }),
    template: markup,
    async created() {
      this.vscode = acquireVsCodeApi();

      window.addEventListener("message", (e) => {
        console.log("app recv", e);
        const message = e.data;
        switch (message.command) {
          case "api-response":
            const { id, json } = JSON.parse(message.text);
            if (this.deferredPromiseResolves[id]) {
              this.deferredPromiseResolves[id](json);
            } else {
              console.error("Unexpected api response for msg id:", id);
            }
            break;

          case "load-prefs":
            if (!message.text) {
              return; // nothing previously saved
            }
            const json2 = JSON.parse(message.text);
            this.options = {
              ...this.options,
              ...json2,
            };
            break;
          default:
            console.warn("Received unknown command:", message.command);
        }
      });

      this.vscode.postMessage({
        command: "get-prefs",
      });

      // When user presses ctrl+f, put focus on the "filter" input area
      window.addEventListener("keydown", (e) => {
        console.log("keydown", e);
        if (e.key === "f" || e.key === "F") {
          if (e.ctrlKey) {
            document.querySelector("#filter-by-text").focus();
          }
        }
      });

      const promises = [];
      for (const langCode of ["en", ...this.langCodes]) {
        const uri = `http://localhost:${this.getPort()}/lang/${langCode}`;

        console.log("ASKING FOR", uri);
        // const promise = fetch(uri)
        // const promise = api.getLangFile(langCode)
        const promise = this.callApi("getLangFile", langCode)
          .then((x) => {
            console.log("ok we got x back", x);
            return Promise.resolve(x);
          })
          // .then((resp) => resp.json())
          .then((json) => {
            if (langCode === "en") {
              // Share with actual extension
              const msg = {
                command: "translation-literals",
                text: JSON.stringify(this.flatten(json)),
              };

              this.vscode.postMessage(msg);
            }

            // Forced alphabetization
            json = this.alphabetize(json);

            // global hack for adding a "nextItemKey" value
            gWalkPrevRef = null;
            this.langs = {
              ...this.langs,
              [langCode]: walk(json, [], ""),
            };
            gWalkPrevRef = null; // important to put this here to prevent last item in one language from pointing to another language

            // console.log("get lang result", langCode, json, uri);
            if (langCode === "en") {
              this.allItems = this.langs[langCode];
            }

            // this.$bvToast.toast("really?", {
            //   title: "title here",
            //   autoHideDelay: 5000,
            //   appendToast: true,
            // });
          })
          .catch(handleError);

        promises.push(promise);
      }

      promises.push(
        this.fetchNewTranslationKeys().then((keys) => {
          this.newTranslationKeys = keys;
        })
      );

      await Promise.all(promises).catch(handleError);

      this.untranslatedKeys = this.getUntranslatedKeys();

      console.log("Ready to go?");
    },
    computed: {
      filteredItems() {
        let filteredItems;
        if (this.filterText) {
          // We're going to savagely mutate an items array, and it's deeply
          // nested cuz it's a tree, so let's make a complete clone so we
          // don't mess up the existing items data.
          filteredItems = JSON.parse(JSON.stringify(this.allItems));
          console.log("recalc filtereed items");

          filteredItems = filteredItems.filter((itm) =>
            this.checkItemMatchesFilterText(itm, this.filterText)
          );
        } else {
          // Let's clone it here too, cause we may do sorting and we
          // prefer not to mutate the original source data
          filteredItems = JSON.parse(JSON.stringify(this.allItems));
        }

        if (this.options.foldersFirst) {
          const localWalk = (items) => {
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

          localWalk(filteredItems);
        }

        if (this.options.onlyNew) {
          filteredItems = filteredItems.filter((itm) =>
            this.checkItemMatchesKey(itm, this.newTranslationKeys)
          );
        }

        if (this.options.onlyUntranslated) {
          filteredItems = filteredItems.filter((itm) =>
            this.checkItemMatchesKey(itm, this.untranslatedKeys)
          );
        }

        return filteredItems;
      },
      isSelectedItemPluralizable() {
        if (!this.selectedItem) {
          return false;
        }

        // Format for singular, plural is separated by a pipe, e.g.
        // 1 point | {n} points
        //
        // So, just check if removing all non-pipes leaves one character...
        if (this.selectedItem.value.replace(/[^|]/g, "").length === 1) {
          return true;
        }

        return false;
      },
    },
    methods: {
      // Not an http server api anymore, but just using postMessage to pretend
      // like it's an http api
      callApi() {
        const method = arguments[0];
        const args = [...arguments].slice(1);

        const id = `${Math.random()}-${new Date().getTime()}`;
        const msg = {
          command: `api/${method}`,
          text: JSON.stringify({ id, args }),
        };

        // let deferredResolve;
        const promise = new Promise((resolve) => {
          this.deferredPromiseResolves[id] = resolve;
        });

        this.vscode.postMessage(msg);

        return promise;
      },
      getPort() {
        if (this.port) {
          return this.port;
        }

        // May not be mounted yet or something
        return document.body.getAttribute("data-port");
      },
      // Takes a nested translation literals file and converts it into a flat list.
      // Currently only used to postMessage to parent to share translation data
      // for extra translation functionality (splitview stuff).
      flatten(obj, prefix) {
        prefix = prefix || "";
        let result = {};

        for (const key of Object.keys(obj)) {
          if (obj[key] instanceof Object) {
            result = {
              ...result,
              ...this.flatten(obj[key], prefix + key + "."),
            };
          } else {
            result[prefix + key] = obj[key];
          }
        }

        return result;
      },
      // Takes a given object and alphabetizes it by key.
      // This is used because it's hard to enforce a requirement that
      // keys are always added in alphabetical order to the language
      // files.
      //
      // Returns a new object.
      alphabetize(obj) {
        const result = {};

        const alphaKeys = Object.keys(obj).sort();
        // console.log("grr", alphaKeys);
        for (const key of alphaKeys) {
          if (obj[key] instanceof Object) {
            result[key] = this.alphabetize(obj[key]);
          } else {
            result[key] = obj[key];
          }
        }

        return result;
      },
      // Will call this after adding new to update display
      // Prefer doing this instead of "smartly" inserting into
      // allItems, just clean the slate and make sure all data
      // is up-to-date
      refreshLangCodeItems(langCode) {
        const uri = `http://localhost:${this.getPort()}/lang/${langCode}`;
        // return fetch(uri)
        return (
          this.callApi("getLangFile", langCode)
            // .then((resp) => resp.json())
            .then((json) => {
              // Forced alphabetization
              json = this.alphabetize(json);

              this.langs = {
                ...this.langs,
                [langCode]: walk(json, [], ""),
              };

              if (langCode === "en") {
                this.allItems = this.langs.en;
              }
            })
        );
      },
      // Get a flat list of keys that have only been added on current
      // branch - have not been merged into development
      fetchNewTranslationKeys() {
        const uri = `http://localhost:${this.getPort()}/diff`;
        // return fetch(uri)
        return (
          this.callApi("getDiff")
            // .then((resp) => resp.json())
            .then((json) => json.new)
        );
      },
      getLangCodeTitle(langCode) {
        switch (langCode) {
          case "es":
            return "Spanish";
          case "fr":
            return "French";
          case "fi":
            return "Finnish";
          case "sv":
            return "Swedish";
          default:
            return `${langCode})`;
        }
      },
      getLangTranslation(langCode, path, key) {
        // I think I'm sending direct ref to the item object, so let's
        // just clone the array so we don't mutate it in-place
        path = [...path];

        let obj = this.langs[langCode];
        while (path.length > 0) {
          const piece = path.splice(0, 1)[0];
          obj = obj.find((x) => x.shortKey === piece);
          if (!obj) {
            return "";
          } else {
            obj = obj.children;
          }
        }

        obj = obj.find((x) => x.shortKey === key);
        if (!obj) {
          return "";
        } else {
          return obj.value;
        }
      },
      checkIsKeyExpanded(itm) {
        if (this.filterText || this.options.onlyNew) {
          return this.expandedKeysFilteredView[itm.key];
        } else {
          return this.expandedKeys[itm.key];
        }
      },
      toggleExpanded(itm) {
        if (this.filterText || this.options.onlyNew) {
          this.expandedKeysFilteredView = {
            ...this.expandedKeysFilteredView,
            [itm.key]: !this.expandedKeysFilteredView[itm.key],
          };
        } else {
          this.expandedKeys = {
            ...this.expandedKeys,
            [itm.key]: !this.expandedKeys[itm.key],
          };
        }
      },
      // Find an item in the tree hierarchy by its full key
      findItem(fromItems, key) {
        let result;
        for (const item of fromItems) {
          if (item.key === key) {
            return item;
          } else if (item.children.length > 0) {
            result = this.findItem(item.children, key);
            if (result) {
              return result;
            }
          }
        }

        return null;
      },
      onSelectItem(itm) {
        this.selectedItem = {
          ...itm,
          isEditing: false,
          valueChanges: itm.value,
        };

        const translations = {};
        for (const langCode of ["en", ...this.langCodes]) {
          translations[langCode] = this.getLangTranslation(
            langCode,
            itm.path,
            itm.shortKey
          );
        }

        // Store any v-model changes in a separate object so
        // we can do "is it changed" diffs
        this.selectedItemTranslations = translations;
        this.selectedItemTranslationsChanges = { ...translations };
      },
      // Checks if the english value of the string is "long."  If it is
      // long, we may prefer a <textarea> style input over an <input>...
      checkIsLongValue(langCode) {
        const itm = this.selectedItem;
        const en = this.getLangTranslation("en", itm.path, itm.shortKey);

        if (!en) {
          return false;
        }

        // This is obviously completely arbitrary.  In theory an intrepid
        // developer could make this a user preference.  That's not me,
        // not for this.  haahahahahahaha
        return en.length > 160;
      },
      checkIsValueTranslated(item, langCode) {
        const en = this.getLangTranslation("en", item.path, item.shortKey);
        const translated = this.getLangTranslation(
          langCode,
          item.path,
          item.shortKey
        );

        // Sometimes we have a translation file where it has the english word
        // with an asterisk after it, which seems to mean "I put a translation here
        // but we didn't actually translate it yet."
        if (!translated || translated === en || translated === `${en}*`) {
          return false;
        }

        return true;
      },
      checkIsValueModified(langCode) {
        const a = this.selectedItemTranslations[langCode];
        const b = this.selectedItemTranslationsChanges[langCode];

        return a !== b;
      },
      checkItemMatchesFilterText(item, filterText) {
        const ft = filterText.toLowerCase();
        if (item.children.length) {
          const isMatch = item.key.toLowerCase().includes(ft);

          if (isMatch) {
            const rx = new RegExp(`(${ft})`, "gi");
            for (const prop of ["displayShortKey", "prefix"]) {
              item[prop] = item[prop].replace(
                rx,
                "<span class='highlighter'>$1</span>"
              );
            }
          }

          item.children = item.children.filter((child) =>
            this.checkItemMatchesFilterText(child, ft)
          );

          if (item.children.length === 0) {
            return false;
          }

          return true;
        } else {
          const isMatch =
            item.key.toLowerCase().includes(ft) ||
            item.value.toLowerCase().includes(ft);

          if (isMatch) {
            const rx = new RegExp(`(${ft})`, "gi");
            for (const prop of ["displayShortKey", "prefix", "displayValue"]) {
              item[prop] = item[prop].replace(
                rx,
                "<span class='highlighter'>$1</span>"
              );
            }
          }

          return isMatch;
        }
      },
      checkItemMatchesKey(item, keys) {
        if (item.children.length) {
          // const isMatch = keys.includes(item.key);
          item.children = item.children.filter((child) =>
            this.checkItemMatchesKey(child, keys)
          );

          if (item.children.length === 0) {
            return false;
          }

          return true;
        } else {
          return keys.includes(item.key);
        }
      },
      // Returns a flat array of keys that have one or more missing translations
      getUntranslatedKeys() {
        const keys = [];
        const walk = (items) => {
          for (const item of items) {
            // Only consider end-of-tree nodes, the actual strings
            // This will ignore parents/folders
            if (item.value) {
              let untranslatedLangCount = 0;
              for (const langCode of this.langCodes) {
                if (
                  this.options.langCodeFocus &&
                  langCode !== this.options.langCodeFocus
                ) {
                  // Ignore it if the user is focusing on missing translations
                  // for a specific language
                  continue;
                }

                if (!this.checkIsValueTranslated(item, langCode)) {
                  untranslatedLangCount++;
                }
              }

              if (untranslatedLangCount > 0) {
                keys.push(item.key);
              }
            } else if (item.children.length) {
              walk(item.children);
            }
          }
        };

        walk(this.allItems, []);

        return keys;
      },
      onToggleEditEnglish() {
        if (this.selectedItem.isEditing) {
          if (this.selectedItem.value === this.selectedItem.valueChanges) {
            // No change was made
            return;
          }

          this.selectedItem.value = this.selectedItem.valueChanges;
          this.selectedItemTranslationsChanges["en"] = this.selectedItem.value;

          // This will end up auto-refetching the english dict data
          // to update UI everywhere
          this.onSaveChanges("en");
          this.selectedItem.isEditing = false;
        } else {
          this.selectedItem.isEditing = true;
        }
      },
      getTranslateButtonVariant(langCode) {
        return this.checkIsValueTranslated(this.selectedItem, langCode)
          ? "secondary"
          : "primary";
      },
      getTranslateButtonText(langCode) {
        return this.checkIsValueTranslated(this.selectedItem, langCode)
          ? "Re-translate"
          : "Translate";
      },
      getSingularSelectedItemTranslation(langCode) {
        const value = this.selectedItemTranslationsChanges[langCode];
        const pieces = value.split("|");
        return (pieces[0] || "").trim();
      },
      getPluralSelectedItemTranslation(langCode) {
        const value = this.selectedItemTranslationsChanges[langCode];
        const pieces = value.split("|");

        if (pieces.length > 1) {
          return (pieces[1] || "").trim();
        } else {
          return "";
        }
      },
      onUpdateSingularSelectedItemTranslation(langCode, val) {
        const s = val;
        const p = this.getPluralSelectedItemTranslation(langCode);

        this.selectedItemTranslationsChanges[
          langCode
        ] = `${s.trim()} | ${p.trim()}`;
      },
      onUpdatePluralSelectedItemTranslation(langCode, val) {
        const s = this.getSingularSelectedItemTranslation(langCode);
        const p = val;

        this.selectedItemTranslationsChanges[
          langCode
        ] = `${s.trim()} | ${p.trim()}`;
      },
      async onTranslate(langCode) {
        if (this.isSelectedItemPluralizable) {
          // Grab english sing/plural to use as translation source
          const s = this.getSingularSelectedItemTranslation("en");
          let p = this.getPluralSelectedItemTranslation("en");

          // To try to get more reliable translations, when the string
          // looks like "You have selected {n} items" we prefer to send
          // a mock amount e.g. "You have selected 50 items"
          let replacedN = false;
          if (p.indexOf("50") < 0 && p.indexOf("{n}") >= 0) {
            replacedN = true;
            // 50 is completely arbitrary.  We only attempt this if the
            // phrase itself doesn't already have a "50" in it (this seems
            // like it probably won't ever be the case...)
            p = p.replace("{n}", 50);
          }

          const ts = await this.translateString(s, langCode);
          let tp = await this.translateString(p, langCode);

          if (replacedN) {
            // Final translation should revert to the {n} now
            tp = tp.replace("50", "{n}");
          }

          this.selectedItemTranslationsChanges[
            langCode
          ] = `${ts.trim()} | ${tp.trim()}`;
        } else {
          this.translateString(
            this.selectedItemTranslations["en"],
            langCode
          ).then((value) => {
            if (value) {
              this.selectedItemTranslationsChanges[langCode] = value;
            }
          });
        }
      },
      translateString(val, toLang) {
        const googleTranslateApiCodes = {
          fin: "fi",
          swe: "sv",
        };

        // We don't use the "traditional" (or at least, the google-preferred)
        // lang codes, so some of them need to be overwritten here.
        if (googleTranslateApiCodes[toLang]) {
          toLang = googleTranslateApiCodes[toLang];
        }

        // return fetch(`http://localhost:${this.getPort()}/translate`, {
        return (
          this.callApi("translate", {
            apiKey: this.options.apiKey,
            payload: {
              q: val,
              source: "en",
              target: toLang,
              format: "text",
            },
          })
            // .then((res) => res.json())
            .then((json) => {
              const value =
                (json &&
                  json.data &&
                  json.data.translations &&
                  json.data.translations.length > 0 &&
                  json.data.translations[0].translatedText) ||
                "";

              return value;
            })
            .catch((err) => {
              console.error(err);
            })
        );
      },
      onSkipItem() {
        let nextItem = this.findItem(
          this.allItems,
          this.selectedItem.nextItemKey
        );

        if (!nextItem) {
          return;
        }

        // If we found the next item but it's (a) not matching the filter text, or
        // (b) not untranslated, then keep going forward until we find such a match
        // (or until we run out of items to check)
        let loopsRemaining = 9999; // infinite loop guard/prevention
        while (loopsRemaining > 0) {
          loopsRemaining--;

          if (
            this.findItem(this.filteredItems, nextItem.key) &&
            this.untranslatedKeys.includes(nextItem.key)
          ) {
            break;
          }

          nextItem = this.findItem(this.allItems, nextItem.nextItemKey);
          if (!nextItem) {
            return;
          }
        }

        if (nextItem) {
          this.onSelectItem(nextItem);
        }
      },
      onSaveChanges(langCode, continueToNextAfterSave) {
        // fetch(`http://localhost:${this.getPort()}/save`, {
        //   method: "POST",
        //   headers: {
        //     "content-type": "application/json",
        //   },
        //   body: JSON.stringify({
        //     langCode,
        //     key: this.selectedItem.key,
        //     value: this.selectedItemTranslationsChanges[langCode],
        //   }),
        // })
        this.callApi("save", {
          langCode: langCode,
          key: this.selectedItem.key,
          value: this.selectedItemTranslationsChanges[langCode],
        })
          // .then((res) => res.json())
          .then((json) => {
            this.selectedItemTranslations[langCode] =
              this.selectedItemTranslationsChanges[langCode];

            return this.refreshLangCodeItems(langCode);
          })
          .then(() => {
            this.untranslatedKeys = this.getUntranslatedKeys();

            if (continueToNextAfterSave) {
              this.onSkipItem();
            }
          })
          .catch(handleError);
      },
      onShowAddNew(prefix) {
        this.addNewModal = {
          ...this.addNewModal,
          show: true,
          key: prefix || "",
          value: "",
        };
      },
      onFindInFiles(key) {
        const msg = {
          command: "find-in-files",
          text: key,
        };

        this.vscode.postMessage(msg);
      },
      onCopyToClipboard(key) {
        const msg = {
          command: "copy-text-to-clipboard",
          text: key,
        };

        this.vscode.postMessage(msg);
      },
      onAddTranslation() {
        this.addNewModal.isBusy = true;
        // fetch(`http://localhost:${this.getPort()}/save`, {
        this.callApi("save", {
          langCode: "en",
          key: this.addNewModal.key,
          value: this.addNewModal.value,
        })
          // .then((res) => res.json())
          .then((json) => {
            this.refreshLangCodeItems("en").then(() => {
              this.addNewModal.show = false;

              this.fetchNewTranslationKeys().then((keys) => {
                this.newTranslationKeys = keys;
              });
            });
          })
          .catch(handleError)
          .finally(() => {
            this.addNewModal.isBusy = false;
          });
      },
    },
    watch: {
      port(val) {
        console.log("Port found in body attr:", val);
      },
      filterText(val) {
        // If user clears search filter, then wipe out all expanded keys
        // state data.  If they do a new search, they start from square one.
        if (!val) {
          this.expandedKeysFilteredView = {};
        }
      },
      filteredItems(val) {
        // If user is filtering and has received new results by entering
        // or changing filter text, then default expanded to true for
        // all tree branches.  (The idea here is that the result set should
        // be fairly small, and we probably want to see all expanded results.)
        if (this.filterText || this.options.onlyNew) {
          // We'll update this via scope
          const obj = {};
          // local walk to go through all items and set expanded=true on each
          const localWalk = (itm) => {
            if (itm.children.length > 0) {
              obj[itm.key] = true;
              for (const child of itm.children) {
                localWalk(child);
              }
            }
          };

          for (const itm of this.filteredItems) {
            localWalk(itm);
          }

          this.expandedKeysFilteredView = obj;
        }
      },
      "options.onlyUntranslated"(val) {
        if (!val) {
          return;
        }

        this.untranslatedKeys = this.getUntranslatedKeys();
      },
      "options.langCodeFocus"() {
        this.untranslatedKeys = this.getUntranslatedKeys();
      },
      options: {
        handler(val) {
          console.log("what is this", this);
          if (!this.vscode) {
            return; // shouldn't ever happen
          }

          const msg = {
            command: "save-prefs",
            text: JSON.stringify(this.options),
          };
          console.log("sending msg", msg);
          this.vscode.postMessage(msg);
        },
        deep: true,
      },
    },
  });
});

let gWalkPrevRef = null;
function walk(obj, path, prefix) {
  const results = [];

  for (const key of Object.keys(obj)) {
    if (obj[key] instanceof Object) {
      results.push({
        path,
        shortKey: key,
        displayShortKey: key,
        key: [...path, key].join("."),
        value: "",
        displayValue: "",
        prefix,
        children: walk(obj[key], [...path, key], prefix + key + "."),
        nextItemKey: null,
      });
    } else {
      results.push({
        path: path,
        shortKey: key,
        displayShortKey: key,
        key: [...path, key].join("."),
        value: obj[key],
        // displayValue is used in v-html, and may be overwritten with
        // <span highlighter> if filter is active.
        //
        // In contrast, `value` will always have the pure text value
        // that can be sent to google translate api without such highlighter markup
        displayValue: obj[key],
        prefix,
        children: [],
        nextItemKey: null,
      });

      const ref = results[results.length - 1];
      if (gWalkPrevRef) {
        gWalkPrevRef.nextItemKey = ref.key;
      }

      gWalkPrevRef = ref;
    }
  }

  return results;
}

function handleError(err) {
  console.log("An error occurred", err);
  console.error(err);

  // this.$bvToast.toast(err.message, {
  //   title: "An error occurred",
  //   autoHideDelay: 5000,
  //   appendToast: true,
  // });
}
