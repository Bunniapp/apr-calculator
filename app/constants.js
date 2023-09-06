require('dotenv').config();
const { ethers } = require("ethers");

const lens = "0xb73F303472C4fD4FF3B9f59ce0F9b13E47fbfD19";
const provider = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.alchemy_api_key}`);
const subgraph = "https://api.thegraph.com/subgraphs/name/bunniapp/bunni-mainnet-development";
const blocks_subgraph = "https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks";
const gauge_controller = '0x901c8aA6A61f74aC95E7f397E22A0Ac7c1242218';
const LIT = '0xfd0205066521550D7d7AB19DA8F72bb004b4C341';

const thisPeriodTimestamp = () => {
  const week = 604800 * 1000;
  return (Math.floor(Date.now() / week) * week) / 1000;
};

module.exports = { lens, provider, subgraph, blocks_subgraph, gauge_controller, LIT, thisPeriodTimestamp };