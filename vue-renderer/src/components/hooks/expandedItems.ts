import { reactive } from "vue";

import type { Item } from "@/item";

export const expandedKeys = reactive<{
    default: { [key: string]: boolean }
    filtered: { [key: string]: boolean }
}>({
    default: {},
    filtered: {},
});

export type Source = "default" | "filtered";

export function checkIsItemExpanded(itm: Item, source: Source) {
    // if (this.filterText || this.options.onlyNew) {
    //   return this.expandedKeys.filtered[itm.key];
    // } else {
    //   return this.expandedKeys.default[itm.key];
    // }
    return !!expandedKeys[source][itm.key];
}

export function toggleExpanded(itm: Item, source: Source) {
    expandedKeys[source] = {
        ...expandedKeys[source],
        [itm.key]: !expandedKeys[source][itm.key],
    };
    // if (this.filterText || this.options.onlyNew) {
    //     this.expandedKeys.filtered = {
    //         ...this.expandedKeys.filtered,
    //         [itm.key]: !this.expandedKeys.filtered[itm.key],
    //     };
    // } else {
    //     this.expandedKeys.default = {
    //         ...this.expandedKeys.default,
    //         [itm.key]: !this.expandedKeys.default[itm.key],
    //     };
    // }
};