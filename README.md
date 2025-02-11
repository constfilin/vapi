## INSTALLATION
1. Install Node
1. `git clone [this repo]`
1. `cd [this repo]`
1. `npm i`

## RUNNING
`VAPI_ORG_ID=... VAPI_PRIVATE_KEY=... npx tsx index.ts --cmd=... [--(id|name)=...] [--stringify]`
1. `--cmd`:
    1. `listTools` - lists tools in VAPI org defined by `VAPI_ORG_ID` environment variable
    1. `getToolById` - dumps information about VAPI tool identified by `--id` cmd param
    1. `getToolByName` - dumps information about VAPI tool identified by `--name` cmd param
    1. `createToolByName` - registers a new tool identified by `--name` cmd param. The known tools are:
        * `redirectCall` - used to redirect call to various departments and persons depending on [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893) 
        * `dispatchCall`- decided what to do with a call (redirect or send an email) depending on business hours of a person per [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893)
        * `sendEmail` - sends email
    1. `updateToolByName - updates registration of a tool identified by `--name` cmd param
    1. `listAssistants` - lists assistants in VAPI org defined by `VAPI_ORG_ID` environment variable
    1. `getAssistantById` - dumps information about VAPI assistant identified by `--id` cmd param
    1. `getAssistantByName` - dumps information about VAPI assistant identified by `--name` cmd param
    1. `createTooByName` - registers a new assistant identified by `--name` cmd param. The known assistants are:
        * `IntempusBot` - reads [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893) and registers customized VAPI assistant with Intempus functionality. Fails if necessary tools are not yet registered.
    1. `updateAssitantByName` - updates registration of an assistant identified by `-name` cmd param. Fails if necessary tools are not yet registered.
    1. `udpateAll` - updates registrations all the known tools and assitants.
1. `--id` - gives an id of tool or an assistant for commands `getToolById` or `getAssistantById`
1. `--name` - gives a name of tool or an assistant for commands `getToolByName` or `getAssistantByName`
1. `--stringify` - if provided then the outout of the program is sent through `JSON.stringify` before being dumped on stdout

## ENVIRONMENT
Several environament variables affect the work of the program
1. `SPREADSHEETID` - id of [Contacts Spreadsheet](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893)
1. `APIKEY` - Google API key to access the spreadsheet with
1. `VAPI_ORG_ID`- VAPI org Id accessed by the program
1. `VAPI_PRIVATE_KEY` - VAPI secret key to access VAPI org defined by `VAPI_ORG_ID`
1. `ASSISTANT_NAME` - Name of Intempus assistant. Default is `Vasa`
