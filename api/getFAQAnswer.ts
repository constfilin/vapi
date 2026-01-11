import fetch                from 'node-fetch';
import * as Config          from '../Config';

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
    const response = await fetch(apiUrl, init);
    if( !response.ok )
        throw Error(`Error fetching answer from session '${sessionId}': ${response.status} ${response.statusText}`);
    const resp = (await response.json()) as Record<string,any>;
    //console.log({
    //  init,
    //  data
    //});
    if( resp.error || !resp.data || !resp.data.user || !resp.data.verified || !resp.data.reply )
        throw Error(`Cannot get reply for session '${sessionId}' on question '${question}': ${JSON.stringify(resp)}`);
    // TODO:
    // Test if VAPI understands the JSON format of this answer
    // or we need to just return the simple text reply
    return resp.data/*.reply*/;
}

export default getFAQAnswer;
