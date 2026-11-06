// Development fixtures use real contract calls; only time, ETH funding and VRF are mocked.
export async function seedEstablishedGame({provider,ethers,admin,bros,combat,needs,stETH,vrf,playerAddress}) {
  const player=playerAddress??await (await provider.getSigner(1)).getAddress();
  if(!ethers.isAddress(player)||player===ethers.ZeroAddress)throw Error('Valid nonzero player address required');
  const opponent=await provider.getSigner(2),opponentAddress=await opponent.getAddress();
  if([admin.address,opponentAddress].some(a=>a.toLowerCase()===player.toLowerCase()))throw Error('Choose a player wallet different from local admin/account 2');
  await provider.send('hardhat_setBalance',[player,'0x'+(100n*10n**18n).toString(16)]);
  await provider.send('hardhat_impersonateAccount',[player]);
  const owner=new ethers.JsonRpcSigner(provider,player),tx=async promise=>(await promise).wait();
  const training=[0,0,10000],defense=[10000,0,0];
  const advance=async seconds=>{await provider.send('evm_increaseTime',[seconds]);await provider.send('evm_mine',[]);};
  const boost=async()=>tx(stETH.rebase((await stETH.totalPooledEther())*101n/100n));
  try {
    for(let token=1;token<=8;token++)await tx(bros.connect(token<=6?owner:opponent).mintWithETH({value:10n**18n}));
    await boost();
    for(const token of [1,2,3,4,7,8])await tx(bros.connect(token<=6?owner:opponent).hatch(token,(token-1)%4,training,defense,`Local Bro ${token}`));
    await advance(86400);
    await tx(combat.connect(opponent).claim(1,7,(await combat.locations(1)).nonce,defense));
    const coder=ethers.AbiCoder.defaultAbiCoder(),domain=ethers.keccak256(ethers.toUtf8Bytes('BATTLE_RESULT'));
    // Level 2 requires 250 XP. Sixteen full-stake attacker wins earn 256 XP.
    for(const token of [3,4])for(let battle=0;battle<16;battle++) {
      await advance(86400);await boost();
      const location=await combat.locations(1),defender=await bros.broState(7),id=await combat.nextChallengeId();
      await tx(combat.connect(owner).challenge(1,token,2,10,location.nonce,defender.defenseNonce,(await provider.getBlock('latest')).timestamp+120,defense));
      const registration=await combat.registrations(id);
      await provider.send('evm_setNextBlockTimestamp',[Number(registration.closesAt)]);
      await tx(combat.advanceRegistration(id));
      const challenge=await combat.challengeState(id);
      const aw=20n+(10n*100n/challenge.attackerCapacity)*6n;
      const dw=20n*challenge.config.defenderBps/10000n;
      // Choose a reproducible mock fulfillment before submission; never reroll an accepted seed.
      let seed=1n;
      while(BigInt(ethers.keccak256(coder.encode(['uint256','uint256','address','uint256','bytes32'],[seed,31337,combat.target,id,domain])))%(aw+dw)>=aw)seed++;
      await tx(vrf.fulfill(challenge.requestId,seed));
      if((await combat.challengeState(id)).status===1n)await tx(combat.resolve(id));
      if((await combat.locations(1)).occupant!==BigInt(token))throw Error('Scenario battle did not resolve as expected');
      await tx(combat.connect(owner).vacate(token));
      await tx(combat.connect(opponent).claim(1,7,(await combat.locations(1)).nonce,defense));
    }
    await advance(86400);await boost();
    await tx(combat.connect(owner).claim(2,3,(await combat.locations(2)).nonce,defense));
    await tx(needs.scheduleProbability(10000));
    const dailyNeed=async()=>{
      await advance(86400);await tx(needs.requestNeeds());
      const day=await needs.daysByEpoch(await needs.epoch());await tx(vrf.fulfill(day.requestId,99));
      for(const token of [1,2,4,8])await tx(bros.syncNeeds(token,32));
    };
    await dailyNeed();
    for(const token of [1,2,4])await tx(bros.connect(owner).care(token));
    await tx(bros.connect(opponent).care(8));
    await dailyNeed();await tx(bros.connect(owner).care(4));await tx(bros.connect(opponent).care(8));
    await advance(86400);await boost();
    await tx(bros.settle(4));
    return {name:'established-v1',playerAddress:player,opponentAddress,roster:[
      {tokenId:'1',role:'Open Need; previous care completed'},
      {tokenId:'2',role:'Open Need; previous care completed'},
      {tokenId:'3',role:'Level 2 veteran; defends territory 2'},
      {tokenId:'4',role:'Level 2 veteran; cared for; ready to claim'},
      {tokenId:'5',role:'Unhatched'}, {tokenId:'6',role:'Unhatched'},
      {tokenId:'7',role:'Opponent; defends territory 1'}, {tokenId:'8',role:'Opponent; cared for; free'}],openLocationIds:['3','4']};
  } finally {await provider.send('hardhat_stopImpersonatingAccount',[player]);}
}
