const fetch = require('node-fetch');

async function fetchPrices(tokens) {
  const root = `https://coins.llama.fi/prices/current/`;
  const charLimit = 2000;

  let coins = {};
  let endpoint = root;
  let calls = [];

  for (let token of tokens) {
    const path = `ethereum:${token},`;
    if (endpoint.concat(path).length > charLimit) {
      calls = calls.concat(endpoint);
      endpoint = root;
    }
    endpoint = endpoint.concat(path);
  }
  calls = calls.concat(endpoint);

  await Promise.all(
    calls.map((call) => httpsGet(call).then((result) => coins = {...coins, ...result.coins}))
  );
  
  return coins;
}

async function httpsGet(endpoint) {
  const request = await fetch(endpoint);
  return await request.json();
}

module.exports = { fetchPrices };