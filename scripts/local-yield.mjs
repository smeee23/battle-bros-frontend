import {pathToFileURL} from 'node:url';

export async function addLocalYield(origin='http://127.0.0.1:3012',fetcher=fetch){
  const url=new URL(origin);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use the HTTP origin of the running local:dev frontend.');
  const response=await fetcher(new URL('/api/local-dev',url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'addYield'}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Local test yield update failed.');
  if(!/^0x[0-9a-fA-F]{64}$/.test(result.transactionHash??''))throw Error('Unexpected response from the local development server.');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--url'))throw Error('Usage: npm run local:yield -- [--url http://127.0.0.1:3012]');
    const result=await addLocalYield(args[1]);
    console.log('Added 1% test yield to existing deposits. New mints need another yield update.');
    console.log('Transaction: '+result.transactionHash+' · Block '+result.blockNumber);
    console.log('Wait for the publication to update, then refresh the Territory dashboard to hatch.');
  }catch(error){console.error(error.cause?.code==='ECONNREFUSED'?'Start npm run local:dev before adding test yield.':error.message);process.exitCode=1;}
}
