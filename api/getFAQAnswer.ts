import fetch                from 'node-fetch';
import * as Config          from '../Config';
import { server }           from '../Server';

export const getFAQAnswer = async ( sessionId:string, question:string ) : Promise<Record<string,any>> => {
    const apiUrl = `https://api.insynergyapp.com/ai-voice-chat-message`;
    const init   = {
        method  : 'POST',
        headers : {
            'Content-Type'  : 'application/json',
            'Authorization' : `Bearer ${Config.get().vapeAiDevtoken}`
        },
        body    : JSON.stringify({
            session_id : sessionId,
            text       : question
        })
    }
    server.module_log(
        module.filename,3,`Calling ${apiUrl} with`,{
            sessionId, 
            question,
            init
        }
    );    
    const response = await fetch(apiUrl, init);
    if( !response.ok )
        throw Error(`Error fetching answer from session '${sessionId}': ${response.status} ${response.statusText}`);
    const resp = (await response.json()) as Record<string,any>;
    if( resp.error || !resp.data || !resp.data.user || !resp.data.verified || !resp.data.reply )
        throw Error(`Cannot get reply for session '${sessionId}' on question '${question}': ${JSON.stringify(resp)}`);
    return resp.data/*.reply*/;
}

export default getFAQAnswer;
