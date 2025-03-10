export interface Item {
    path: string[]
    key: string
    shortKey: string
    displayShortKey: string
    value: string
    displayValue: string
    prefix: string
    children: Item[]
    nextItemKey: string | null

    isEditing?: boolean
    valueChanges?: string
};

// Checks to see if an item either has the requested key
// (e.g. gradebook.errors.not_allowed), or one of its
// children/descendants matches that key.
//
// keys are given as an array.  An item is returned if it
// matches one or more of the given keys.
export function checkItemContainsAnyKey(itm: Item, keys: string[]) {
    if (itm.children.length) {
        // const isMatch = keys.includes(itm.key);
        const children = itm.children.filter((child) =>
            checkItemContainsAnyKey(child, keys)
        );

        if (children.length === 0) {
            return false;
        }

        return true;
    } else {
        return keys.includes(itm.key);
    }
};

export function checkItemMatchesFilterText(itm: Item, filterText: string) {
    console.log("inside check filter match", [itm.key, itm.value, filterText, itm]);    
    const ft = filterText.toLowerCase();
    if (itm.children.length) {
        const isMatch = itm.key.toLowerCase().includes(ft);

        if (isMatch) {
            const rx = new RegExp(`(${ft})`, "gi");

            // Have to do this explicitly to make typescript happy now
            itm.displayShortKey = itm.displayShortKey.replace(rx, "<span class='highlighter'>$1</span>");
            itm.prefix = itm.prefix.replace(rx, "<span class='highlighter'>$1</span>");
            // for (const prop of ["displayShortKey", "prefix"]) {
            //     item[prop] = item[prop].replace(
            //         rx,
            //         "<span class='highlighter'>$1</span>"
            //     );
            // }
        }

        const children = itm.children.filter((child) =>
            checkItemMatchesFilterText(child, ft)
        );

        if (children.length === 0) {
            console.log("[ ] no children", itm.key, filterText);
            return false;
        }

        console.log("[x] children", itm.key, filterText);
        return true;
    } else {
        const isMatch =
            itm.key.toLowerCase().includes(ft) ||
            itm.value.toLowerCase().includes(ft);

        if (isMatch) {
            const rx = new RegExp(`(${ft})`, "gi");

            // Have to do this explicitly to make typescript happy now
            itm.displayShortKey = itm.displayShortKey.replace(rx, "<span class='highlighter'>$1</span>");
            itm.prefix = itm.prefix.replace(rx, "<span class='highlighter'>$1</span>");
            itm.displayValue = itm.displayValue.replace(rx, "<span class='highlighter'>$1</span>");
            // for (const prop of ["displayShortKey", "prefix", "displayValue"]) {
            //     itm[prop] = itm[prop].replace(
            //         rx,
            //         "<span class='highlighter'>$1</span>"
            //     );
            // }
        }

        console.log(`[${isMatch ? "x" : " "}] match`, itm.key, filterText);
        return isMatch;
    }
};