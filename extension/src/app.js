document.addEventListener("DOMContentLoaded", async () => {
  new Vue({
    el: "#app",
    data: () => ({

    }),
    template: markup,
    async created() {


      // When user presses ctrl+f, put focus on the "filter" input area
      window.addEventListener("keydown", (e) => {
        console.log("keydown", e);
        if (e.key === "f" || e.key === "F") {
          if (e.ctrlKey) {
            document.querySelector("#filter-by-text").focus();
          }
        }
      });



      this.untranslatedKeys = this.getUntranslatedKeys();

      console.log("Ready to go?");
    },
    methods: {
      // Get a flat list of keys that have only been added on current
      // branch - have not been merged into development
      fetchNewTranslationKeys() {
        return (
          this.callApi("getDiff")
            .then((json) => json.new)
        );
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
    },
    watch: {
    },
  });
});

let gWalkPrevRef = null;

