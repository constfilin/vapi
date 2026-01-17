import fetch                from 'node-fetch';
import * as Config          from '../Config';
import { server }           from '../Server';

export const getUserFromPhone = async ( sessionId:string, phoneNumber:string ) : Promise<Record<string,any>> => {
    const apiUrl = `https://api.insynergyapp.com/ai-voice-chat-user`;
    const formattedPhone = phoneNumber.replace(/^\+1/, '');
    const init   = {
        method  : 'POST',
        headers : {
            'Content-Type'  : 'application/json',
            'Authorization' : `Bearer ${Config.get().vapeAiDevtoken}`
        },
        body    : JSON.stringify({
            session_id  : sessionId,
            phone       : Config.get().simulatedPhoneNumber || formattedPhone
        })
    };
    server.module_log(
        module.filename,3,`Calling ${apiUrl} with`,{
            sessionId, 
            phoneNumber,
            init
        }
    );
    const response = await fetch(apiUrl,init);
    if( !response.ok )
        throw Error(`Error fetching user from phone: ${response.status} ${response.statusText}`);
    const resp = (await response.json()) as Record<string,any>;
    if( resp.error || !resp.data || !resp.data.user || !resp.data.verified )
        throw Error(`User not found or not verified for phone number '${phoneNumber}': ${JSON.stringify(resp)}`);
    return resp.data;
}

export default getUserFromPhone;

