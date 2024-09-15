const { expect } = require('chai');
const { waffle, ethers, upgrades } = require('hardhat');
const { loadFixture } = waffle;

function chunkifyArray(
  nftsArr,
  chunkSize,
) {
  let chunkifiedArray = [];
  let tokenStartIndex = 0;
  let tokenEndIndex = nftsArr.length % chunkSize;

  do {
    if(tokenEndIndex != 0) chunkifiedArray.push(
      nftsArr.slice(tokenStartIndex, (tokenEndIndex))
    )

    tokenStartIndex = tokenEndIndex
    tokenEndIndex = tokenStartIndex + chunkSize
  } while (tokenStartIndex < nftsArr.length);

  return chunkifiedArray;
}

describe('Deposit multiple ERC721 Tests', () => {
  const deployedContracts = async () => {
    const [owner, addr1] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory('UniverseAuctionHouse');
    const MockNFT = await ethers.getContractFactory('MockNFT');

    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        2000, 100, 0, owner.address, [], mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
      });
    const mockNFT = await MockNFT.deploy();

    return { universeAuctionHouse, mockNFT };
  };

  it('should deposit multiple nft', async () => {
    const NFT_TOKEN_COUNT = 100;
    const NFT_CHUNK_SIZE = 20;

    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    const [signer] = await ethers.getSigners();

    const multipleMockNFTs = new Array(NFT_TOKEN_COUNT);

    // mint required nfts
    for (let i = 1; i <= NFT_TOKEN_COUNT; i++) {
      await mockNFT.mint(signer.address, i);
      await mockNFT.approve(universeAuctionHouse.address, i);

      multipleMockNFTs[i - 1] = [i, mockNFT.address];
    }

    // get matrix of nft chunks [ [nft, nft], [nft, nft] ]
    const chunksOfNfts = chunkifyArray(multipleMockNFTs, NFT_CHUNK_SIZE)

    // iterate chunks and deposit each one
    for (let chunk = 0; chunk < chunksOfNfts.length; chunk++) {
      await universeAuctionHouse.depositERC721(1, 1, chunksOfNfts[chunk]);
    }

    const res = await universeAuctionHouse.getDepositedNftsInSlot(1, 1);

    expect(res.length).to.equal(NFT_TOKEN_COUNT);
  });

  it('should not be reverted if auction has not started', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    const [signer] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);
    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);
  });

  it('should revert if token address is 0', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    const [signer] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);
    await mockNFT.approve(universeAuctionHouse.address, 1);

    await expect(universeAuctionHouse.depositERC721(1, 1, [[1, '0x0000000000000000000000000000000000000000']])).to.be
      .reverted;
  });

  it('should revert if whitelist is supported', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);
    const [signer, signer2] = await ethers.getSigners();

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      ethAddress,
      minimumReserveValues,
      paymentSplits
    ]);

    await mockNFT.mint(signer2.address, 1);
    await mockNFT.connect(signer2).approve(universeAuctionHouse.address, 1);

    await expect(universeAuctionHouse.connect(signer2).depositERC721(1, 1, [[1, mockNFT.address]])).to.be.reverted;
  });

  it('should deposit if user is part of the whitelist', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);    
    const [signer] = await ethers.getSigners();

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      ethAddress,
      minimumReserveValues,
      paymentSplits
    ]);

    await mockNFT.mint(signer.address, 1);
    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);
  });

  it('should revert if try to deposit in no existing slot', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    const [signer] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);
    await mockNFT.approve(universeAuctionHouse.address, 1);

    await expect(universeAuctionHouse.depositERC721(1, 2, [[1, mockNFT.address]])).to.be.reverted;
  });
});

const createAuction = async (universeAuctionHouse) => {
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 1500;
  const endTime = startTime + 500;
  const resetTimer = 3;
  const numberOfSlots = 1;
  const ethAddress = '0x0000000000000000000000000000000000000000';
  const minimumReserveValues = [];
  const paymentSplits = [];

  await universeAuctionHouse.createAuction([
    startTime,
    endTime,
    resetTimer,
    numberOfSlots,
    ethAddress,
    minimumReserveValues,
    paymentSplits
  ]);
};
