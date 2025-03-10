import type { Item } from "./item";

export interface KeyValueTree {
  [key: string]: string | KeyValueTree
}

// Takes a nested translation literals file and converts it into a flat list.
// Currently only used to postMessage to parent to share translation data
// for extra translation functionality (splitview stuff).
// export const flatten = (obj: KeyValueTree, prefix?: string) => {
//   prefix = prefix || "";
//   let result: { [key: string]: string } = {};

//   for (const key of Object.keys(obj)) {
//     if (obj[key] instanceof Object) {
//       result = {
//         ...result,
//         ...flatten(obj[key], prefix + key + "."),
//       };
//     } else {
//       result[prefix + key] = obj[key];
//     }
//   }

//   return result;
// };

export const flatten = (items: Item[], prefix?: string) => {
  prefix = prefix || "";
  let result: { [key: string]: string } = {};

  for (const item of items) {
    if (item.children.length) {
      result = {
        ...result,
        ...flatten(item.children, ""),
      };
    } else {
      result[item.key] = item.value;
    }
  }
  // for (const key of Object.keys(obj)) {
  //   if (obj[key] instanceof Object) {
  //     result = {
  //       ...result,
  //       ...flatten(obj[key], prefix + key + "."),
  //     };
  //   } else {
  //     result[prefix + key] = obj[key];
  //   }
  // }

  return result;
};

// Takes a given object and alphabetizes it by key.
// This is used because it's hard to enforce a requirement that
// keys are always added in alphabetical order to the language
// files.
//
// Returns a new object.
export const alphabetize = (obj: KeyValueTree) => {
  const result: KeyValueTree = {};

  const alphaKeys = Object.keys(obj).sort();
  // console.log("grr", alphaKeys);
  for (const key of alphaKeys) {
    if (obj[key] instanceof Object) {
      result[key] = alphabetize(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }

  return result;
};

export function walk(obj: KeyValueTree, path: string[], prefix: string) {
  const results: Item[] = [];

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

      // TODO: Reimplement gWalkPrevRef logic
      // if (gWalkPrevRef) {
      //   gWalkPrevRef.nextItemKey = ref.key;
      // }

      // gWalkPrevRef = ref;
    }
  }

  return results;
}
