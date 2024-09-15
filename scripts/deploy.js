// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the max number of slots
  const MAX_SLOT = process.env.MAX_SLOT;
  const MAX_NFTS_PER_SLOT = process.env.MAX_NFTS_PER_SLOT;
  const ROYALTY_FEE_BPS = process.env.ROYALTY_FEE_BPS;
  const DAO_ADDRESS = process.env.DAO_ADDRESS;
  const SUPPORTED_BID_TOKENS = process.env.SUPPORTED_BID_TOKENS.split(",");

  // We get the contract to deploy
  const UniverseAuctionHouse = await hre.ethers.getContractFactory("UniverseAuctionHouse");
  const universeAuctionHouse = await UniverseAuctionHouse.deploy(MAX_SLOT, MAX_NFTS_PER_SLOT, ROYALTY_FEE_BPS, DAO_ADDRESS, SUPPORTED_BID_TOKENS);

  await universeAuctionHouse.deployed();

  console.log("UniverseAuctionHouse deployed to:", universeAuctionHouse.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
