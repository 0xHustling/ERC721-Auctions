const { expect } = require('chai');
const { waffle, ethers, network, upgrades } = require('hardhat');
const { loadFixture } = waffle;

describe('Test royalty fee functionality', () => {
  const deployContracts = async () => {
    const [owner, addr1] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory('UniverseAuctionHouse');
    const MockNFT = await ethers.getContractFactory('MockNFT');
    const MockToken = await ethers.getContractFactory('MockToken');
    const mockNFT = await MockNFT.deploy();
    const mockToken = await MockToken.deploy('1000000000000000000');

    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        5, 100, 0, owner.address, [mockToken.address], mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
    });

    return { universeAuctionHouse, mockNFT, mockToken };
  };

  it('should revert if not the contract owner try to set it', async () => {
    const { universeAuctionHouse } = await loadFixture(deployContracts);

    const [signer, signer2] = await ethers.getSigners();

    await expect(universeAuctionHouse.connect(signer2).setRoyaltyFeeBps('9000')).revertedWith(
      'E07'
    );
  });

  it('should withdraw royaltee with eth successfully', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContracts);
    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10000;
    const endTime = startTime + 1500;
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

    const [signer] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 'tokenURI');

    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await universeAuctionHouse.setRoyaltyFeeBps('5000');

    expect(await universeAuctionHouse.royaltyFeeBps()).to.equal('5000');

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 700]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '1000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1000]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    expect(await universeAuctionHouse.royaltiesReserve(ethAddress)).to.equal("500000000000000000");

    await expect(universeAuctionHouse.distributeRoyalties(ethAddress)).emit(
      universeAuctionHouse,
      'LogRoyaltiesWithdrawal'
    );

    expect(await universeAuctionHouse.royaltiesReserve(ethAddress)).to.equal('0');
  });

  it('should withdraw royaltee with ERC20 successfully', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContracts);
    const currentTime = Math.round((new Date()).getTime() / 1000);

    const [signer] = await ethers.getSigners();

    const balance = await signer.getBalance();

    await mockToken.approve(universeAuctionHouse.address, balance.toString());

    const startTime = currentTime + 10000;
    const endTime = startTime + 1500;
    const resetTimer = 1;
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

    await mockNFT.mint(signer.address, 'tokenURI');

    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await universeAuctionHouse.setRoyaltyFeeBps('5000');

    expect(await universeAuctionHouse.royaltyFeeBps()).to.equal('5000');

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 700]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, '1000000000000000000');

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1500]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    expect(await universeAuctionHouse.royaltiesReserve(tokenAddress)).to.equal('500000000000000000');

    await expect(universeAuctionHouse.distributeRoyalties(tokenAddress)).emit(
      universeAuctionHouse,
      'LogRoyaltiesWithdrawal'
    );

    expect(await universeAuctionHouse.royaltiesReserve(tokenAddress)).to.equal('0');
  });

  it('should revert if amount is zero', async () => {
    const { universeAuctionHouse } = await loadFixture(deployContracts);

    const [signer] = await ethers.getSigners();

    await expect(
      universeAuctionHouse.distributeRoyalties('0x0000000000000000000000000000000000000000')
    ).revertedWith('E30');
  });
});
