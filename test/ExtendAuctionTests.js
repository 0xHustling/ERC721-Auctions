const { expect } = require('chai');
const { waffle, ethers, network, upgrades } = require('hardhat');
const { loadFixture } = waffle;

describe('Extend auction ERC721 Tests', () => {
  const deployedContracts = async () => {
    const [owner, addr1] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory('UniverseAuctionHouse');
    const MockNFT = await ethers.getContractFactory('MockNFT');
    const MockToken = await ethers.getContractFactory('MockToken');
    const mockNFT = await MockNFT.deploy();
    const mockToken = await MockToken.deploy(1000);

    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        2000, 100, 0, owner.address, [mockToken.address], mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
      });

    return { universeAuctionHouse, mockNFT, mockToken };
  };

  it('should extend auction bid with ETH', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 500;
    const numberOfSlots = 2;
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

    const [singer, signer2] = await ethers.getSigners();

    await mockNFT.mint(singer.address, 'NFT_URI');
    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '100000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogAuctionExtended');

    await expect(
      universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
        value: '200000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '300000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');

    await expect(
      universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
        value: '500000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');
  });

  it('should extend auction bid with ERC20', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 600;
    const resetTimer = 600;
    const numberOfSlots = 2;
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

    const [singer, signer2] = await ethers.getSigners();

    await mockNFT.mint(singer.address, 'NFT_URI');
    await mockNFT.approve(universeAuctionHouse.address, 1);
    await mockToken.transfer(signer2.address, 100);

    await mockToken.approve(universeAuctionHouse.address, 100);

    await mockToken.connect(signer2).approve(universeAuctionHouse.address, 100);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await expect(universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, 1)).to.be.emit(universeAuctionHouse, 'LogAuctionExtended');

    await expect(universeAuctionHouse.connect(signer2).functions['erc20Bid(uint256,uint256)'](1, 2)).to.be.emit(
      universeAuctionHouse,
      'LogBidSubmitted'
    );

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 500]); 
    await ethers.provider.send('evm_mine');

    await expect(universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, 10)).to.be.emit(
      universeAuctionHouse,
      'LogBidSubmitted'
    );

  });

  it('should revert if auction is ended', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 30;
    const numberOfSlots = 3;
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

    const [singer] = await ethers.getSigners();

    await mockNFT.mint(singer.address, 'NFT_URI');
    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '100000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 50]); 
    await ethers.provider.send('evm_mine');

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '200000000000000000000'
      })
    ).to.be.reverted;
  });
});

const createAuction = async (universeAuctionHouse) => {
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 1500;
  const endTime = startTime + 500;
  const resetTimer = 30;
  const numberOfSlots = 2;
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
