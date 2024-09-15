const { expect } = require('chai');
const { waffle, upgrades } = require('hardhat');
const { loadFixture } = waffle;

describe('Test cancel functionality', () => {
  const deployContracts = async () => {
    const [owner, addr1] = await ethers.getSigners();
    const [UniverseAuctionHouse, MockNFT] = await Promise.all([
      ethers.getContractFactory('UniverseAuctionHouse'),
      ethers.getContractFactory('MockNFT')
    ]);

    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const [universeAuctionHouse, mockNft] = await Promise.all([upgrades.deployProxy(UniverseAuctionHouse,
      [
        2000, 
        100, 
        0, 
        owner.address, 
        [], 
        mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
      }), MockNFT.deploy()]);

    return {
      universeAuctionHouse,
      mockNft
    };
  };

  it('should be successfully canceled', async () => {
    const { universeAuctionHouse, mockNft } = await loadFixture(deployContracts);

    await createAuction(universeAuctionHouse);

    await universeAuctionHouse.cancelAuction(1);

    const auction = await universeAuctionHouse.auctions(1);

    expect(auction.isCanceled).to.be.true;
  });

  it('should not be reverted if auction has not started', async () => {
    const { universeAuctionHouse } = await loadFixture(deployContracts);

    await createAuction(universeAuctionHouse);

    await expect(universeAuctionHouse.cancelAuction(1));
  });

  it('should be reverted if other than auction owner try to cancel it', async () => {
    const { universeAuctionHouse } = await loadFixture(deployContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const [signer1, signer2] = await ethers.getSigners();

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse
      .connect(signer1)
      .createAuction([startTime, endTime, resetTimer, numberOfSlots, ethAddress, minimumReserveValues, paymentSplits]);

    await expect(universeAuctionHouse.connect(signer2).cancelAuction(1)).to.be.reverted;
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

const depositNFT = async (universeAuctionHouse, mockNFT) => {
  const [owner] = await ethers.getSigners();

  const auctionId = 1;
  const slotIdx = 0;
  const tokenId = 1;

  await mockNFT.mint(owner.address, 'nftURI');
  await mockNFT.approve(universeAuctionHouse.address, tokenId);

  await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);
};
