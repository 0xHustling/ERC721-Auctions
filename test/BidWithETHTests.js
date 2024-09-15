const { expect } = require('chai');
const { waffle, ethers, network, upgrades } = require('hardhat');
const { loadFixture } = waffle;

describe('Test bidding with ETH', () => {
  const deployedContracts = async () => {
    const [owner, addr1] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory('UniverseAuctionHouse');
    const MockNFT = await ethers.getContractFactory('MockNFT');
    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        2000, 100, 0, owner.address, ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'], mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
      });
    const mockNFT = await MockNFT.deploy();

    return { universeAuctionHouse, mockNFT };
  };

  it('should bid, withdraw and check lowestEligibleBid with ETH successfully', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
    const endTime = startTime + 500;
    const resetTimer = 10;
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    expect(
      await universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '100000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');

    const [owner, addr1] = await ethers.getSigners();

    expect(
      await universeAuctionHouse.connect(addr1).functions['ethBid(uint256)'](1, {
        value: '200000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');
  });

  it('should revert if auction do not exists', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    await depositNFT(universeAuctionHouse, mockNFT);

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](3, {
        value: '100000000000000000000'
      })
    ).to.be.reverted;
  });

  it('should revert if amount is 0', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '0'
      })
    ).to.be.reverted;
  });

  it('should revert if auction is not started', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    await depositNFT(universeAuctionHouse, mockNFT);

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '0'
      })
    ).to.be.reverted;
  });

  it('should revert if auction accept only ERC20', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '100000000000000000000'
      })
    ).to.be.reverted;
  });

  it('should revert if auction canceled', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await universeAuctionHouse.cancelAuction(1);

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '100000000000000000000'
      })
    ).to.be.reverted;
  });

  it('should revert if there is no bid on all slots and user try to withdrawal', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 10]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '100000000000000000000'
    });

    await expect(universeAuctionHouse.withdrawEthBid(1)).to.be.reverted;
  });

  it('should revert if there is no bid on all slots and user try to withdrawal', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 10]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '100000000000000000000'
    });

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '110000000000000000000'
    });

    await expect(universeAuctionHouse.withdrawEthBid(1)).to.be.reverted;
  });

  it('should revert if sender have 0 deposited', async () => {
    let { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1000;
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

    await depositNFT(universeAuctionHouse, mockNFT);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    const [signer, signer2, signer3] = await ethers.getSigners();

    universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '100000000000000000000'
    });

    universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '110000000000000000000'
    });

    await expect(universeAuctionHouse.connect(signer).withdrawEthBid(1)).to.be.reverted;
  });
});

const createAuction = async (universeAuctionHouse) => {
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 1000;
  const endTime = startTime + 500;
  const resetTimer = 10;
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
  const slotIdx = 1;
  const tokenId = 1;

  await mockNFT.mint(owner.address, 'nftURI');
  await mockNFT.approve(universeAuctionHouse.address, tokenId);

  await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);
};
