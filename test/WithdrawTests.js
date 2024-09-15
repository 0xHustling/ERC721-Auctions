const { waffle, network, upgrades } = require('hardhat');
const { loadFixture } = waffle;
const { expect } = require('chai');

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

describe('Withdraw functionalities', () => {
  async function deployContract() {
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
  }

  it('should withdraw ERC721 from non winning slot', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContract);

    const NFT_TOKEN_COUNT = 100;
    const NFT_CHUNK_SIZE = 40;

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10000;
    const endTime = startTime + 1500;
    const resetTimer = 1;
    const numberOfSlots = 3;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = ['100000000000000000000', '100000000000000000000', '100000000000000000000'];
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

    const [signer, signer2, signer3] = await ethers.getSigners();

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

    // const res = await universeAuctionHouse.getDepositedNftsInSlot(1, 1);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 750]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    const reserveForFirstSlot = await universeAuctionHouse.getMinimumReservePriceForSlot(1, 1);

    expect(reserveForFirstSlot.toString()).to.equal('100000000000000000000');

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 40)).emit(
      universeAuctionHouse,
      "LogERC721Withdrawal"
    );
    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 40)).emit(
      universeAuctionHouse,
      "LogERC721Withdrawal"
    );
    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 30)).revertedWith(
      "E26"
    );
    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 41)).revertedWith(
      "E25"
    );
    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 20)).emit(
      universeAuctionHouse,
      "LogERC721Withdrawal"
    );
  });

  it('should revert with E41', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);
  
    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 2;
    const numberOfSlots = 3;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = ['100000000000000000000', '100000000000000000000', '100000000000000000000'];
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

    const [signer, signer2, signer3] = await ethers.getSigners();
    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 1200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.connect(signer2).withdrawERC721FromNonWinningSlot(1, 1, 1)).revertedWith(
      'E41'
    );
  });

  it('should revert with E24', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);
  
    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 2;
    const numberOfSlots = 3;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = ['100000000000000000000', '100000000000000000000', '100000000000000000000'];
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

    const [signer, signer2, signer3] = await ethers.getSigners();
    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '10000000000000000000'
    });

    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 1)).revertedWith('E24');
  });

  it('should revert with Can withdraw only if reserve price is not met', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);
  
    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 2;
    const numberOfSlots = 3;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = ['1000000000000000000', '1000000000000000000', '1000000000000000000'];
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

    const [signer, signer2, signer3] = await ethers.getSigners();
    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);
    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.connect(signer).functions['ethBid(uint256)'](1, {
      value: '1000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '1000000000000000000'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '1000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.withdrawERC721FromNonWinningSlot(1, 1, 1)).revertedWith(
      'E23'
    );
  });

  it('should revert with You have 0 deposited', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);
  
    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 2;
    const numberOfSlots = 3;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = ['100000000000000000000', '100000000000000000000', '100000000000000000000'];
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

    const [signer, signer2, signer3, signer4, signer5] = await ethers.getSigners();
    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '100000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '100000000000000000001'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '100000000000000000002'
    });

    await universeAuctionHouse.connect(signer4).functions['ethBid(uint256)'](1, {
      value: '100000000000000000003'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.connect(signer5).withdrawEthBid(1)).revertedWith("E43");
  });

  it('should revert with E24', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);
  
    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 5;
    const numberOfSlots = 4;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = ['100000000000000000000', '100000000000000000000', '100000000000000000000', '100000000000000000000'];
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

    const [signer, signer2, signer3, signer4] = await ethers.getSigners();
    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine')

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '100000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '200000000000000000000'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '300000000000000000000'
    });

    await universeAuctionHouse.connect(signer4).functions['ethBid(uint256)'](1, {
      value: '500000000000000000000'
    });

    await expect(universeAuctionHouse.withdrawEthBid(1)).revertedWith("E22");
  });

  it('should withdraw erc20', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 1;
    const numberOfSlots = 2;
    const minimumReserveValues = ['200', '200']
    const paymentSplits = [];
  
    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      mockToken.address,
      minimumReserveValues,
      paymentSplits
    ]);

    const [signer, signer2, signer3] = await ethers.getSigners();

    await mockToken.transfer(signer.address, 100);

    await mockToken.transfer(signer2.address, 110);

    await mockToken.transfer(signer3.address, 120);

    await mockToken.approve(universeAuctionHouse.address, 100);

    await mockToken.connect(signer2).approve(universeAuctionHouse.address, 110);

    await mockToken.connect(signer3).approve(universeAuctionHouse.address, 120);

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine')

    await universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, 100);

    await universeAuctionHouse.connect(signer2).functions['erc20Bid(uint256,uint256)'](1, 110);

    await universeAuctionHouse.connect(signer3).functions['erc20Bid(uint256,uint256)'](1, 120);

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1200]); 
    await ethers.provider.send('evm_mine')

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.withdrawERC20Bid(1)).emit(universeAuctionHouse, 'LogBidWithdrawal');

    const balance = await universeAuctionHouse.getBidderBalance(1, signer.address);

    expect(balance.toString()).equal('0');
  });

  it('should revert with You have 0 deposited', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 1;
    const numberOfSlots = 3;
    const minimumReserveValues = ['200', '200', '200'];
    const paymentSplits = [];
  
    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      mockToken.address,
      minimumReserveValues,
      paymentSplits
    ]);

    const [signer, signer2, signer3, signer4] = await ethers.getSigners();

    await mockToken.transfer(signer.address, 100);

    await mockToken.transfer(signer2.address, 110);

    await mockToken.transfer(signer3.address, 120);

    await mockToken.approve(universeAuctionHouse.address, 100);

    await mockToken.connect(signer2).approve(universeAuctionHouse.address, 110);

    await mockToken.connect(signer3).approve(universeAuctionHouse.address, 120);

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine')

    await universeAuctionHouse.connect(signer).functions['erc20Bid(uint256,uint256)'](1, 100);

    await universeAuctionHouse.connect(signer2).functions['erc20Bid(uint256,uint256)'](1, 110);

    await universeAuctionHouse.connect(signer3).functions['erc20Bid(uint256,uint256)'](1, 120);

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1200]); 
    await ethers.provider.send('evm_mine')

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.connect(signer4).withdrawERC20Bid(1)).revertedWith("E22");
  });

  it('should revert with E24', async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployContract);
    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 10000;
    const endTime = startTime + 500;
    const resetTimer = 1;
    const numberOfSlots = 3;
    const minimumReserveValues = ['200', '200', '200'];
    const paymentSplits = [];
  
    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      mockToken.address,
      minimumReserveValues,
      paymentSplits
    ]);

    const [signer, signer2, signer3, signer4] = await ethers.getSigners();

    await mockToken.transfer(signer.address, 100);

    await mockToken.transfer(signer2.address, 110);

    await mockToken.transfer(signer3.address, 120);

    await mockToken.approve(universeAuctionHouse.address, 100);

    await mockToken.connect(signer2).approve(universeAuctionHouse.address, 110);

    await mockToken.connect(signer3).approve(universeAuctionHouse.address, 120);

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(signer.address, 'NFT_URI');

    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 400]); 
    await ethers.provider.send('evm_mine')

    await universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, 100);

    await universeAuctionHouse.connect(signer2).functions['erc20Bid(uint256,uint256)'](1, 110);

    await universeAuctionHouse.connect(signer3).functions['erc20Bid(uint256,uint256)'](1, 120);

    await expect(universeAuctionHouse.withdrawERC20Bid(1)).revertedWith("E22");
  });
});

const createAuction = async (universeAuctionHouse) => {
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 10000;
  const endTime = startTime + 500;
  const resetTimer = 2;
  const numberOfSlots = 3;
  const ethAddress = '0x0000000000000000000000000000000000000000';

  await universeAuctionHouse.createAuction(
    startTime,
    endTime,
    resetTimer,
    numberOfSlots,
    ethAddress,
  );
};

const createERC20Auction = async (universeAuctionHouse, tokenAddress) => {
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 10000;
  const endTime = startTime + 500;
  const resetTimer = 1;
  const numberOfSlots = 3;

  await universeAuctionHouse.createAuction(
    startTime,
    endTime,
    resetTimer,
    numberOfSlots,
    tokenAddress
  );
};
