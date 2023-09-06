const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const { BigNumber } = require("bignumber.js");
const { LIT } = require('./app/constants');
const { getPricePerFullShare, getGaugeData, getGaugeControllerData, getReserves } = require('./app/functions');
const { fetchPrices } = require('./app/price');
const { subgraphQuery, blockSubgraphQuery } = require('./app/subgraph');

async function calculateAPR(bunniToken_address) {
  /// fetch the block number from 24h ago
  const timestamp_24h_ago = Math.floor(Date.now() / 1e3 - 86400);
  const block_24h_ago = (await blockSubgraphQuery(timestamp_24h_ago)).blocks[0].number;

  subgraphQuery(bunniToken_address, block_24h_ago).then(async (result) => {
    if (result.bunniTokens.length == 0) {
      console.log('~~~~~ No Bunni Token Found ~~~~~');
      return;
    }

    const protocol = result.bunni;
    const bunniToken = result.bunniTokens[0];
    const block = result.block[0];

    /// fetch the BunniKey
    const bunniKey = {
      pool: bunniToken.pool.address,
      tickLower: parseInt(bunniToken.tickLower),
      tickUpper: parseInt(bunniToken.tickUpper),
    };

    /// fetch the price of token0, token1 and LIT in USD
    const tokenPrices = await fetchPrices([bunniToken.pool.token0.address, bunniToken.pool.token1.address, LIT]);
    const token0PriceUSD = new BigNumber(tokenPrices[`ethereum:${bunniToken.pool.token0.address}`].price);
    const token1PriceUSD = new BigNumber(tokenPrices[`ethereum:${bunniToken.pool.token1.address}`].price);
    const litPriceUSD = new BigNumber(tokenPrices[`ethereum:${LIT}`].price);

    /// calculate the price of the BunniToken in USD
    const [amount0, amount1] = await getPricePerFullShare(bunniKey);
    const bunniTokenPriceUSD = amount0.div(Math.pow(10, bunniToken.pool.token0.decimals)).times(token0PriceUSD)
      .plus(amount1.div(Math.pow(10, bunniToken.pool.token1.decimals)).times(token1PriceUSD));

    /// calculate the BunniToken reserve (TVL) in USD
    const [reserve0, reserve1] = await getReserves(bunniKey);
    const reserve = reserve0.div(Math.pow(10, bunniToken.pool.token0.decimals)).times(token0PriceUSD)
      .plus(reserve1.div(Math.pow(10, bunniToken.pool.token1.decimals)).times(token1PriceUSD));

    /// calculate the swapAPR
    let swapAPR = new BigNumber(0);

    if (protocol && block) {
      const token0Fees = new BigNumber(bunniToken.token0Volume).minus(block.token0Volume).times(bunniToken.pool.fee).div(1e6).times(token0PriceUSD);
      const token1Fees = new BigNumber(bunniToken.token1Volume).minus(block.token1Volume).times(bunniToken.pool.fee).div(1e6).times(token1PriceUSD);
      const fees_24h = BigNumber.min(token0Fees, token1Fees);
      const after_protocol_fee = new BigNumber(1).minus(protocol.protocolFee); 
      swapAPR = fees_24h.times(365).times(after_protocol_fee).div(reserve).times(100);
    }

    /// calculate the lowerAPR and upperAPR
    let lowerAPR = new BigNumber(0);
    let upperAPR = new BigNumber(0);

    if (bunniToken.gauge) {
      const gauge = bunniToken.gauge.address;
      const [is_killed, inflation_rate, relative_weight, tokenless_production, working_supply] = await getGaugeData(gauge);
      const [gauge_exists] = await getGaugeControllerData(gauge);
  
      /// @dev the price of oLIT is determined by applying the discount factor to the LIT price.
      /// as of this writing, the discount factor of 50% but is subject to change. Additional dev
      /// work is needed to programmatically apply the discount factor at any given point in time.
      const olitPriceUSD = litPriceUSD.times(0.5);

      if (gauge_exists == true && is_killed == false) {
        const relative_inflation = inflation_rate.times(relative_weight);
        if (relative_inflation.gt(0)) {
          const annualRewardUSD = relative_inflation.times(86400).times(365).times(olitPriceUSD);
          const effectiveSupply = working_supply.gt(0) ? working_supply : new BigNumber(1e-18); 
          const workingSupplyUSD = effectiveSupply.times(bunniTokenPriceUSD);

          lowerAPR = annualRewardUSD.times(tokenless_production).div(100).div(workingSupplyUSD).times(100);
          upperAPR = annualRewardUSD.div(workingSupplyUSD).times(100);
        }
      }    
    } else {
      console.log('~~~~~ No Gauge Found ~~~~~');
      return;
    }

    console.log(`swapAPR: ${swapAPR.toFixed(2)}%`);
    console.log(`lowerAPR: ${lowerAPR.toFixed(2)}%`);
    console.log(`upperAPR: ${upperAPR.toFixed(2)}%`);

    return [swapAPR, lowerAPR, upperAPR];
  });
}

readline.question('Enter a Bunni token address: ', bunniToken => {
  calculateAPR(bunniToken);
  readline.close();
});

