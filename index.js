const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const { BigNumber } = require("bignumber.js");
const { LIT } = require('./app/constants');
const { getPricePerFullShare, getGaugeData, getGaugeControllerData } = require('./app/functions');
const { fetchPrices } = require('./app/price');
const { subgraphQuery } = require('./app/subgraph');

function calculateAPR(bunniToken_address) {
  subgraphQuery(bunniToken_address).then(async (result) => {
    if (result.bunniTokens.length == 0) {
      console.log('~~~~~ No Bunni Token Found ~~~~~');
      return;
    }

    const bunniToken = result.bunniTokens[0];

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

    console.log(`lowerAPR: ${lowerAPR.toFixed(2)}%`);
    console.log(`upperAPR: ${upperAPR.toFixed(2)}%`);

    return [lowerAPR, upperAPR];
  });
}

readline.question('Enter a Bunni token address: ', bunniToken => {
  calculateAPR(bunniToken);
  readline.close();
});

