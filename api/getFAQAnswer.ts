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
    //console.log({
    //    init,
    //});
    const response = await fetch(apiUrl, init);
    if( !response.ok )
        throw Error(`Error fetching answer from session '${sessionId}': ${response.status} ${response.statusText}`);
    const data = (await response.json()) as Record<string,any>;
    if( !data.user || !data.verified || !data.reply )
        throw Error(`User not found or not verified for session ${sessionId}`);
    return data;
}

export default getFAQAnswer;
