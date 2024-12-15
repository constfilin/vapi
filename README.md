## INSTALLATION
1. Install Node
1. `git clone [this repo]`
1. `cd [this repo]`
1. `npm i`

## RUNNING
`npx tsx index.ts [reconcile|generate]`

## DESCRIPTION

If `reconcile` argument is given to the script, then the script will read the contents of files `./updated_transfer_call_function.json` and `./system_prompt.txt` 
and compare their content with that of [this spreadsheet](https://docs.google.com/spreadsheets/d/1m1nzQ1TBnx9HS1uIv3zMqkAdn2ZbQo9YLceeKzVgVWA/edit?gid=2091052116#gid=2091052116).
The spreadsheet is the source of truth. If there are any discrepancies between the source of truth and the above files then the script will print out them on the stdout.

In case of any other argument to the script, the script will read [the source of truth](https://docs.google.com/spreadsheets/d/1m1nzQ1TBnx9HS1uIv3zMqkAdn2ZbQo9YLceeKzVgVWA/edit?gid=2091052116#gid=2091052116) and write files `./updated_transfer_call_function.json` and `./system_prompt.txt`

## ENVIRONMENT

The Id of the screadsheet to read the truth from is given in `consts.ts` but can also be specificed in `SPREADSHEETID` environment variable.
Google API key to read [the source of truth](https://docs.google.com/spreadsheets/d/1m1nzQ1TBnx9HS1uIv3zMqkAdn2ZbQo9YLceeKzVgVWA/edit?gid=2091052116#gid=2091052116) can be specified through `APIKEY` variable. E.g.:

`SPREADSHEETID=... npx tsx index.ts generate`
