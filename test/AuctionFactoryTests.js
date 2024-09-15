const { expect } = require('chai');
const { waffle, ethers, upgrades } = require('hardhat');
const { loadFixture } = waffle;

describe('UniverseAuctionHouse', () => {
  async function deployContract() {
    const [owner, addr1] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory('UniverseAuctionHouse');
    const MockNFT = await ethers.getContractFactory('MockNFT');
    const MockToken = await ethers.getContractFactory('MockToken');
    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});
    const mockNFT = await MockNFT.deploy();
    const mockToken = await MockToken.deploy(1000);
    await mockToken.transfer(addr1.address, 600);

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        2000, 
        100, 
        0, 
        owner.address, 
        [mockToken.address], 
        mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
      });

    return { universeAuctionHouse, mockNFT, mockToken };
  }

  async function launchAuction() {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10;
    const endTime = currentTime + 50;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const bidToken = mockToken.address;
    const minimumReserveValues = [];
    const paymentSplits = [];

    auction = await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      bidToken,
      minimumReserveValues,
      paymentSplits,
    ]);
    return { universeAuctionHouse, mockNFT, mockToken };
  }
  async function depositERC721() {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(launchAuction);
    const [owner] = await ethers.getSigners();

    await mockNFT.mint(owner.address, 'testURI');
    mockNFT.approve(universeAuctionHouse.address, 1);
    depositData = await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    return { universeAuctionHouse, mockNFT, mockToken };
  }
  async function bid() {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(depositERC721);
    const [owner, addr1] = await ethers.getSigners();

    const currentTime = Math.round((new Date()).getTime() / 1000);
    await ethers.provider.send('evm_setNextBlockTimestamp', [currentTime + 20]); 
    await ethers.provider.send('evm_mine');

    const balanceOwner = await mockToken.balanceOf(owner.address);
    await mockToken.approve(universeAuctionHouse.address, balanceOwner.toString());
    await universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, balanceOwner.toString());

    const balanceAddr1 = await mockToken.balanceOf(addr1.address);
    await mockToken.connect(addr1).approve(universeAuctionHouse.address, balanceAddr1.toString());
    await universeAuctionHouse.connect(addr1).functions['erc20Bid(uint256,uint256)'](1, balanceAddr1.toString());

    return { universeAuctionHouse, mockNFT, mockToken };
  }

  it('Deploy the UniverseAuctionHouse and MockNFT', async function () {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);

    expect(universeAuctionHouse.address).to.have.string('0x');
  });
  it('Launch an Auction', async function () {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(launchAuction);
    const auctionData = await universeAuctionHouse.auctions(1);

    expect(auctionData['numberOfSlots'].toString()).to.equal('1');
  });
  it('Deposit NFT into Auction', async function () {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(depositERC721);
    const deposited = await universeAuctionHouse.getDepositedNftsInSlot(1, 1);

    expect(deposited[0]['tokenId'].toString()).to.equal('1');
  });
  it('Bid on Auction', async function () {
    var { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(depositERC721);
    const [owner] = await ethers.getSigners();
    const balance = await mockToken.balanceOf(owner.address);

    var { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(bid);
    const newBalance = await mockToken.balanceOf(owner.address);

    const bidderBalance = await universeAuctionHouse.getBidderBalance(1, owner.address);
    expect(bidderBalance).to.equal(balance.toString());
    expect('0').to.equal(newBalance);
  });

  it('should revert if allowance is too small', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10;
    const endTime = currentTime + 15;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const tokenAddress = mockToken.address;
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      tokenAddress,
      minimumReserveValues,
      paymentSplits
    ]);

    const [signer] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    mockToken.connect(signer).approve(universeAuctionHouse.address, 100);

    await expect(universeAuctionHouse.connect(signer).functions['erc20Bid(uint256,uint256)'](1, '101')).to.be.reverted;
  });

  it('should revert if some one try to bid with ETH', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const tokenAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      tokenAddress,
      minimumReserveValues,
      paymentSplits
    ]);

    const [signer] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    mockToken.connect(signer).approve(universeAuctionHouse.address, 100);

    await expect(universeAuctionHouse.connect(signer).functions['erc20Bid(uint256,uint256)'](1, 10)).to.be.reverted;
  });
});
