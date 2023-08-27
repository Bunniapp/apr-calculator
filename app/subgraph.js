const { gql, request } = require('graphql-request');

const { subgraph } = require('./constants');

const bunniTokenQuery = (bunniToken_address) => {
  let queryString = `{`;
  queryString += `
    bunniTokens(where: { address: "${ bunniToken_address.toLowerCase() }" }) {
      tickLower
      tickUpper
      pool {
        address
        token0 {
          address
          decimals
        }
        token1 {
          address
          decimals
        }
      }
      gauge {
        address
        exists
        relativeWeightCap
        tokenlessProduction
        workingSupply
      }
    }`;
  queryString += `
  }`;
  return gql`${queryString}`;
};

async function subgraphQuery(bunniToken_address) {
  return await request(subgraph, bunniTokenQuery(bunniToken_address));
}

module.exports = { subgraphQuery };