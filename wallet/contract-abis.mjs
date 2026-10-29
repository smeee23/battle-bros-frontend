// Full release ABIs: keep outputs, errors, events and state mutability for Viem.
import bros from '../../battle-bros-contracts/abis/territory/TerritoryBro.json' with {type:'json'};
import combat from '../../battle-bros-contracts/abis/territory/TerritoryCombat.json' with {type:'json'};
import vault from '../../battle-bros-contracts/abis/territory/TerritoryVault.json' with {type:'json'};
import needs from '../../battle-bros-contracts/abis/territory/NeedsOracle.json' with {type:'json'};
import randomness from '../../battle-bros-contracts/abis/territory/TerritoryRandomness.json' with {type:'json'};
import matchmaker from '../../battle-bros-contracts/abis/territory/TerritoryMatchmaker.json' with {type:'json'};
import stETH from '../../battle-bros-backend/packages/contracts/abi/StETH.json' with {type:'json'};
export const contractAbis={bros,combat,vault,needs,randomness,matchmaker,stETH:stETH.abi};
