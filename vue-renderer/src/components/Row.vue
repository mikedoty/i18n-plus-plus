<script setup lang="ts">

import type { Item } from '@/item';
import type { Source } from "@/components/hooks/expandedItems";

const props = defineProps<{
    applyMargin?: boolean,
    items: Array<Item>,
    currentSource: Source,
    checkIsKeyExpanded: (itm: Item, source: Source) => boolean,
}>();

const emit = defineEmits({
    selectItem(itm: Item) { return true; },
    findInFiles(key: string) { return true; },
    copyToClipboard(key: string) { return true; },
    toggleExpand(itm: Item) { return true; },
    showAddNew(defaultKeyValue: string) { return true; },
});

</script>

<template>
    <div class="tree-parent" :class="{
        'ps-3': props.applyMargin,
        'ms-3': props.applyMargin,
    }">
        <div v-for="itm in props.items" class="tree-row py-2">
            <div v-if="itm.value" class="item" @click="emit('selectItem', itm)">
                <div rel="item" class="d-flex align-items-center">
                    <div>
                        <i class="fa fa-file fa-fw" />
                    </div>
                    <div class="d-flex flex-column flex-fill ps-1">
                        <div class="d-flex align-items-center">
                            <label><span class="prefix" v-html="itm.prefix" /><span
                                    v-html="itm.displayShortKey" /></label>
                            <div class="hover-icon ps-2" @click.stop="emit('findInFiles', itm.key)"
                                title="Search via Find in Files">
                                <i class="fa fa-search fa-fw" />
                            </div>
                            <div class="hover-icon ps-1" @click.stop="emit('copyToClipboard', itm.key)"
                                title="Copy key to clipboard">
                                <i class="fa fa-copy fa-fw" />
                            </div>
                        </div>
                        <div class="fake-form-input" v-html="itm.displayValue" />
                        <!--<b-form-input type="text" readonly="readonly" :value="itm.value"/>-->
                    </div>
                </div>
            </div>
            <div v-else class="parent">
                <div rel="item" @click="emit('toggleExpand', itm)"
                    :class="{ 'pb-2': props.checkIsKeyExpanded(itm, currentSource) }">
                    <div v-if="props.checkIsKeyExpanded(itm, currentSource)" key="tree-open"
                        class="d-flex align-items-center">
                        <i class="fa fa-chevron-down fa-fw" />
                        <span class="ps-1">
                            <label><span class="prefix" v-html="itm.prefix" /><span
                                    v-html="itm.displayShortKey" /></label>
                        </span>
                        <div class="hover-icon px-2" @click.stop="emit('findInFiles', itm.key)"
                            title="Search via Find in Files">
                            <i class="fa fa-search fa-fw" />
                        </div>
                        <div class="flex-fill" />
                        <div class="hover-icon d-flex align-items-center"
                            @click.stop="emit('showAddNew', itm.key + '.')">
                            <i class="fa fa-plus" />
                            <span class="ms-2">{{ itm.key }}.[...]</span>
                        </div>
                    </div>
                    <div v-else key="tree-closed" class="d-flex align-items-center">
                        <i class="fa fa-chevron-right fa-fw" />
                        <span class="ps-1">
                            <label><span class="prefix" v-html="itm.prefix" /><span
                                    v-html="itm.displayShortKey" /></label>
                        </span>
                        <div class="hover-icon px-2" @click.stop="emit('findInFiles', itm.key)"
                            title="Search via Find in Files">
                            <i class="fa fa-search fa-fw" />
                        </div>
                        <div class="flex-fill" />
                        <div class="hover-icon d-flex align-items-center"
                            @click.stop="emit('showAddNew', itm.key + '.')">
                            <i class="fa fa-plus" />
                            <span class="ms-2">{{ itm.key }}.[...]</span>
                        </div>
                    </div>
                </div>
                <Row v-if="props.checkIsKeyExpanded(itm, currentSource)" :items="itm.children" :current-source="currentSource"
                    :check-is-key-expanded="props.checkIsKeyExpanded" @toggle-expand="emit('toggleExpand', $event)"
                    @select-item="emit('selectItem', $event)" @show-add-new="emit('showAddNew', $event)"
                    @find-in-files="emit('findInFiles', $event)" @copy-to-clipboard="emit('copyToClipboard', $event)" />
            </div>
        </div>
    </div>
</template>