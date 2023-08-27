const { ethers } = require("ethers");
const { BigNumber } = require("bignumber.js");
const { lens, provider, gauge_controller, thisPeriodTimestamp } = require('./constants');
const { Contract, Provider } = require('ethers-multicall');

async function getPool(_bunniToken) {
  const interface = new ethers.utils.Interface(require('./abis/BunniToken.json'));

  try {
    const encodedFunctionData = interface.encodeFunctionData("pool", []);
    const encodedFunctionResult = await provider.call({ to: _bunniToken, data: encodedFunctionData });
    const decodedFunctionResult = new ethers.utils.AbiCoder().decode(["address"], encodedFunctionResult);
    return decodedFunctionResult[0];
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function getTickLower(_bunniToken) {
  const interface = new ethers.utils.Interface(require('./abis/BunniToken.json'));

  try {
    const encodedFunctionData = interface.encodeFunctionData("tickLower", []);
    const encodedFunctionResult = await provider.call({ to: _bunniToken, data: encodedFunctionData });
    const decodedFunctionResult = new ethers.utils.AbiCoder().decode(["int24"], encodedFunctionResult);
    return decodedFunctionResult[0];
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function getTickUpper(_bunniToken) {
  const interface = new ethers.utils.Interface(require('./abis/BunniToken.json'));

  try {
    const encodedFunctionData = interface.encodeFunctionData("tickUpper", []);
    const encodedFunctionResult = await provider.call({ to: _bunniToken, data: encodedFunctionData });
    const decodedFunctionResult = new ethers.utils.AbiCoder().decode(["int24"], encodedFunctionResult);
    return decodedFunctionResult[0];
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function getBunniKey(_bunniToken) {
  const [pool, tickLower, tickUpper] = await Promise.all([
    getPool(_bunniToken),
    getTickLower(_bunniToken),
    getTickUpper(_bunniToken)
  ]);

  return {
    pool: pool,
    tickLower: tickLower,
    tickUpper: tickUpper
  };
}

async function getPricePerFullShare(_bunniKey) {
  const interface = new ethers.utils.Interface(require('./abis/BunniLens.json'));

  let amount0 = new BigNumber(0);
  let amount1 = new BigNumber(0);

  try {
    const encodedFunctionData = interface.encodeFunctionData("pricePerFullShare", [_bunniKey]);
    const encodedFunctionResult = await provider.call({ to: lens, data: encodedFunctionData });
    const decodedFunctionResult = new ethers.utils.AbiCoder().decode(["uint128", "uint256", "uint256"], encodedFunctionResult);

    amount0 = new BigNumber(decodedFunctionResult[1]._hex);
    amount1 = new BigNumber(decodedFunctionResult[2]._hex);
  } catch (error) {
    console.log(error);
  }

  return [amount0, amount1];
}

async function getGaugeData(_gauge) {
  const ethcallProvider = new Provider(provider);
  await ethcallProvider.init();

  const gaugeContract = new Contract(_gauge, require('./abis/LiquidityGauge.json'));

  const is_killed_call = gaugeContract.is_killed();
  const inflation_rate_call = gaugeContract.inflation_rate();
  const relative_weight_call = gaugeContract.getCappedRelativeWeight(thisPeriodTimestamp());
  const tokenless_production_call = gaugeContract.tokenless_production();
  const working_supply_call = gaugeContract.working_supply();

  const [
    is_killed_result, 
    inflation_rate_result, 
    relative_weight_result, 
    tokenless_production_result, 
    working_supply_result
  ] = await ethcallProvider.all([
    is_killed_call, 
    inflation_rate_call, 
    relative_weight_call, 
    tokenless_production_call, 
    working_supply_call
  ]);
  
  const is_killed = is_killed_result;
  const inflation_rate = new BigNumber(inflation_rate_result._hex).div(1e18);
  const relative_weight = new BigNumber(relative_weight_result._hex).div(1e18);
  const tokenless_production = new BigNumber(tokenless_production_result);
  const working_supply = new BigNumber(working_supply_result._hex).div(1e18);

  return [is_killed, inflation_rate, relative_weight, tokenless_production, working_supply];
}

async function getGaugeControllerData(_gauge) {
  const ethcallProvider = new Provider(provider);
  await ethcallProvider.init();

  const gaugeControllerContract = new Contract(gauge_controller, require('./abis/GaugeController.json'));
  
  const gauge_exists_call = gaugeControllerContract.gauge_exists(_gauge);
  const [gauge_exists_result] = await ethcallProvider.all([gauge_exists_call]);

  const gauge_exists = gauge_exists_result;

  return [gauge_exists];
}

module.exports = { getBunniKey, getPricePerFullShare, getGaugeData, getGaugeControllerData };