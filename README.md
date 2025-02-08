## INSTALLATION
1. Install Node
1. `git clone [this repo]`
1. `cd [this repo]`
1. `npm i`

## RUNNING
`VAPI_ORG_ID=... VAPI_PRIVATE_KEY=... npx tsx index.ts --cmd=... [--(id|name)=...] [--stringify]`
1. `--cmd`:
    1. `reconcileFile` - reads files `./system_prompt.txt` and `./updated_transfer_call_function.json` and reports about their differences with contacts listed in [Contacts Google Sheet](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893)
    1. `generateFile` - creates files `./system_prompt.txt` and `./updated_transfer_call_function.json` based on the contacts in [Contacts Google Sheet](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893)
    1. `listTools` - lists tools in VAPI org defined by `VAPI_ORG_ID` environment variable
    1. `getToolById` - dumps information about VAPI tool identified by `--id` cmd param
    1. `getToolByName` - dumps information about VAPI tool identified by `--name` cmd param
    1. `createDispatchCallTool` - registers `dispatchCall` tool. Creates a new `dispatchCall` tool even if a tool with this name exists
    1. `createRedirectCallTool` - reads [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893) and registers customized `redirectCall` VAPI tool. Creates a new `redirectCall` tool even if a VAPI tool with this name exists
    1. `updateDispatchCallTool` - updates registration of an existing VAPI tool with name `dispatchCall`
    1. `updateRedirectCallTool` - updates registration of an existing VAPI tool with name `redirectCall` based on [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893)
    1. `listAssistants` - lists assistants in VAPI org defined by `VAPI_ORG_ID` environment variable
    1. `getAssistantById` - dumps information about VAPI assistant identified by `--id` cmd param
    1. `getAssistantByName` - dumps information about VAPI assistant identified by `--name` cmd param
    1. `createIntempusAssistant` - reads [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893) and registers customized VAPI assistant with Intempus functionality. Creates a new assistant if an assistant with name `Vasa` already exists. Fails if necessary tools are not yet registered.
    1. `updateIntempusAssistant` - updates registration of an existing VAPI assistant with name `Vasa` based on [Contacts](https://docs.google.com/spreadsheets/d/1SI3C0QGShrE1kTbxgPwldIi12MnKXM1wq42SiOmibyI/edit?gid=907085893#gid=907085893). Fails if necessary tools are not yet registered.
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
