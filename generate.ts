import { promises as fs }   from 'node:fs';
import * as tools           from './tools';

export const generate = async () => {
    const {json,prompt,warns} = await tools.getTransferCallPayload();
    await Promise.all([
        fs.writeFile('./updated_transfer_call_function.json',JSON.stringify(json,null,4)),
        fs.writeFile('./system_prompt.txt',prompt.join("\n"))
    ]);
    return warns;
}

export default generate;
