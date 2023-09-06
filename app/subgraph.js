const { gql, request } = require('graphql-request');

const { subgraph, blocks_subgraph } = require('./constants');

const blockQuery = (timestamp) => {
  return gql`
    {
      blocks(
        first: 1,
        orderBy: timestamp,
        orderDirection: asc,
        where: {
          timestamp_gt: ${timestamp},
          timestamp_lt: ${timestamp + 600}
        }
      ) {
        number
      }
    }
  `;
}

const bunniTokenQuery = (bunniToken_address, block_number) => {
  let queryString = `{`;
  queryString += `
    bunni(id: "0xb5087f95643a9a4069471a28d32c569d9bd57fe4") {
      protocolFee
    }`;
  queryString += `
    bunniTokens(where: { address: "${ bunniToken_address.toLowerCase() }" }) {
      tickLower
      tickUpper
      token0Volume
      token1Volume
      pool {
        address
        fee
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
    block: bunniTokens(block: { number: ${block_number} }, where: { address: "${ bunniToken_address.toLowerCase() }" }) {
      token0Volume
      token1Volume
    }`;
  queryString += `
  }`;
  return gql`${queryString}`;
};

async function subgraphQuery(bunniToken_address, block_number) {
  return await request(subgraph, bunniTokenQuery(bunniToken_address, block_number));
}

async function blockSubgraphQuery(timestamp) {
  return await request(blocks_subgraph, blockQuery(timestamp));
}

module.exports = { subgraphQuery, blockSubgraphQuery };