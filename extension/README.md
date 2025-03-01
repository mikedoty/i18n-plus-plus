# i18n++

## How to build for release

The "build tools" (i.e. `vsce`) can be installed based on the instructions
on this page:

https://code.visualstudio.com/api/working-with-extensions/publishing-extension

Once those are installed, `cd` to the extension source code folder
and just run

```
vsce package
```

This will generate a .vsix file.

## How to install into vscode

In the Extensions panel, you can use the 3dot menu to "Install from vsix..."
and just pick the .vsix file generated via the `vsce package` command.

## How to use

Use Ctrl+Shift+P to open command palette, then choose "i18n++"
to open the extension.

You will need a valid Google Translate API token to perform translations.

## How to "fix" an old file if needed, to alphabetize

This extension uses JSON.stringify to save an alphabetized version of the file, meaning
that when you add a new translation key, if you add `name` then `name` will be placed
between `median_income` and `old_address`.

> Background:  Previously, translation files were not fully alphabetized.  When correcting
> this, we introduced a significant diff in a PR to alphabetize the files.
>
> If you are on an older branch that doesn't have the latest changes, you might have
> outdated (unalphabetized) copies of the file and want a way to alphabetize them.

* The `jq` program is required to run this command.

```
cat es.json | jq -S | sed -e 's/\r//g' > temp.json && mv temp.json es.json
```

> Note:  This step probably won't ever be needed, but I'm recording this as
> a note in case of problems during initial transition.

> Note:  This may introduce a trailing newline, which may or may not be desired.