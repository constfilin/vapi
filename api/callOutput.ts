import { VapiClient } from '@vapi-ai/server-sdk';
import dotenv from 'dotenv'
dotenv.config();

const vapiClient = new VapiClient({ token: process.env.VAPI_PRIVATE_KEY});

export const getCallList = async ( limit: number = 10) => {
    const calls = await vapiClient.calls.list({limit: limit});
    return calls.map( c => {
        return {
            id : c.id,
            createdAt : c.createdAt,
        }
    });
};

export const getCallStructuredOutputs = async ( callId:string ) => {
    const call = await vapiClient.calls.get({id: callId});
    const structuredOutputs = call?.artifact?.structuredOutputs;
    if( !structuredOutputs || typeof structuredOutputs !== 'object' )
        throw Error(`No structured outputs found for call ${callId}`);
    return structuredOutputs;
};

export const getCallSuccessRate = async ( callId:string ) => {
    const structuredOutputs = await getCallStructuredOutputs(callId);
    const outputs: Record<string, any> = structuredOutputs && typeof structuredOutputs === 'object'
        ? Object.values(structuredOutputs)
        : null;
    return outputs?.find( o => o.name === 'CallSuccessRating' )?.result?.successRating;
}

export const getAverageCallSuccessRate = async ( limit:number = 10 ) => {
    const calls = await getCallList(limit);
    const settledRates = await Promise.allSettled( calls.map( c => getCallSuccessRate(c.id) ) );
    const validSuccessRates = settledRates
        .filter( s => s.status === 'fulfilled' && typeof s.value === 'number' && !Number.isNaN(s.value) )
        .map( s => (s as PromiseFulfilledResult<number>).value );
    if( validSuccessRates.length === 0 )
        throw Error(`No valid CallSuccessRating structured outputs found for the last ${limit} calls`);
    const averageSuccessRate = validSuccessRates.reduce( (acc,r) => acc + r, 0 ) / validSuccessRates.length;
    return averageSuccessRate;
};