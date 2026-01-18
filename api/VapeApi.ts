import fetch                from 'node-fetch';
import * as Config          from '../Config';
import { server }           from '../Server';

const makeApiCall = async (
    apiUrl      : string,
    payload     : Record<string, any>,
    logContext  : Record<string, any>
): Promise<Record<string, any>> => {
    const init = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Config.get().vapeApiToken}`
        },
        body: JSON.stringify(payload)
    };
    server.module_log(
        module.filename,
        3,
        `Calling ${apiUrl} with`,
        logContext
    );
    const response = await fetch(apiUrl, init);
    if (!response.ok)
        throw Error(`API Error (${response.status} ${response.statusText}): ${apiUrl}`);
    return (await response.json()) as Record<string, any>;
};

export const getUserFromPhone = async (sessionId: string, phoneNumber: string): Promise<Record<string, any>> => {
    const apiUrl= `https://api.insynergyapp.com/ai-voice-chat-user`;
    const resp  = await makeApiCall(
        apiUrl,
        {
            session_id  : sessionId,
            phone       : Config.get().simulatedPhoneNumber || phoneNumber.replace(/^\+1/, '')
        },
        { sessionId, phoneNumber }
    );
    if (resp.error || !resp.data || !resp.data.user || !resp.data.verified)
        throw Error(`User not found or not verified for phone number '${phoneNumber}': ${JSON.stringify(resp)}`);
    return resp.data;
};

export const getFAQAnswer = async (sessionId: string, question: string): Promise<Record<string, any>> => {
    const apiUrl = `https://api.insynergyapp.com/ai-voice-chat-message`;
    const resp = await makeApiCall(
        apiUrl,
        {
            session_id  : sessionId,
            text        : question
        },
        { sessionId, question }
    );
    if (resp.error || !resp.data || !resp.data.user || !resp.data.verified || !resp.data.reply)
        throw Error(`Cannot get reply for session '${sessionId}' on question '${question}': ${JSON.stringify(resp)}`);
    return resp.data;
};
