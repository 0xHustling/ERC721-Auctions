const { expect } = require('chai');

const { waffle, ethers, network, upgrades } = require('hardhat');
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

describe('Finalize auction ERC721 Tests', () => {
  const deployedContracts = async () => {
    const [owner, signer] = await ethers.getSigners();
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

    await mockToken.transfer(signer.address, 600);

    return { universeAuctionHouse, mockNFT, mockToken };
  };

  it('should finalize successfully', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);  
    const [signer, signer2] = await ethers.getSigners();

    let randomWallet1 = ethers.Wallet.createRandom();
    let randomWallet2= ethers.Wallet.createRandom();

    const NFT_TOKEN_COUNT = 100;
    const NFT_CHUNK_SIZE = 40;

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 1;
    const ethAddress = '0x0000000000000000000000000000000000000000';
    const minimumReserveValues = [];
    const paymentSplits = [[randomWallet1.address, "2000"], [randomWallet2.address, "1000"]];
  
    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      ethAddress,
      minimumReserveValues,
      paymentSplits
    ]);

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

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '200000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');

    const bidderBalance = await universeAuctionHouse.getBidderBalance(1, signer.address);

    const balance = Number(ethers.utils.formatEther(bidderBalance).toString());

    expect(balance).to.equal(200);

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);
    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    const auction = await universeAuctionHouse.auctions(1);

    expect(auction.isFinalized).to.be.true;

    const slotWinner = await universeAuctionHouse.getSlotWinner(1, 1);

    expect(slotWinner).to.equal(signer.address);

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 1000]); 
    await ethers.provider.send('evm_mine');


    const balanceSignerBefore = await ethers.provider.getBalance(signer.address);

    await expect(universeAuctionHouse.connect(signer2).distributeCapturedAuctionRevenue(1)).to.be.emit(universeAuctionHouse, "LogAuctionRevenueWithdrawal");

    const balance1 = await ethers.provider.getBalance(randomWallet1.address);
    const balance2 = await ethers.provider.getBalance(randomWallet2.address);
    const balance3 = await ethers.provider.getBalance(signer.address);
    
    expect(Number(ethers.utils.formatEther(balance1).toString())).to.equal(40);
    expect(Number(ethers.utils.formatEther(balance2).toString())).to.equal(20);
    expect(Number(ethers.utils.formatEther(balance3).toString())).to.equal(parseFloat(ethers.utils.formatEther(balanceSignerBefore)) + 140);

    await expect(universeAuctionHouse.claimERC721Rewards(1, 1, 40)).to.be.emit(universeAuctionHouse, "LogERC721RewardsClaim");

    await expect(universeAuctionHouse.claimERC721Rewards(1, 1, 40)).to.be.emit(universeAuctionHouse, "LogERC721RewardsClaim");

    await expect(universeAuctionHouse.claimERC721Rewards(1, 1, 30)).revertedWith(
      "E33"
    );

    await expect(universeAuctionHouse.claimERC721Rewards(1, 1, 41)).revertedWith(
      "E25"
    );

    await expect(universeAuctionHouse.claimERC721Rewards(1, 1, 20)).to.be.emit(universeAuctionHouse, "LogERC721RewardsClaim");
  });

  it('should revert invalid number of winners', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
    const resetTimer = 1;
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

    const [signer, signer2] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);

    await mockNFT.approve(universeAuctionHouse.address, 1);
    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine')

    await expect(
      universeAuctionHouse.functions['ethBid(uint256)'](1, {
        value: '200000000000000000000'
      })
    ).to.be.emit(universeAuctionHouse, 'LogBidSubmitted');

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await expect(universeAuctionHouse.finalizeAuction(1, [signer.address, signer2.address])).to.be.reverted;
  });

  it('should revert if auction not finished', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
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

    const [signer] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);

    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '200000000000000000000'
    });

    await expect(universeAuctionHouse.finalizeAuction(1, [signer.address])).to.be.reverted;
  });

  it('should revert if first address do not have the highest bid', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);
    const currentTime = Math.round((new Date()).getTime() / 1000);
  
    const startTime = currentTime + 2500;
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

    const [signer, signer2] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);

    await mockNFT.approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['ethBid(uint256)'](1, {
      value: '200000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await expect(universeAuctionHouse.finalizeAuction(1, [signer2.address, signer.address])).to.be.reverted;
  });

  it('should revert if auction is not ended', async () => {
    const { universeAuctionHouse } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    await expect(universeAuctionHouse.distributeCapturedAuctionRevenue(1)).to.be.reverted;
  });

  it("should transfer erc20 when it's supported by auction", async () => {
    const { universeAuctionHouse, mockNFT, mockToken } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
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

    const [signer] = await ethers.getSigners();

    await mockNFT.mint(signer.address, 1);

    await mockNFT.approve(universeAuctionHouse.address, 1);

    await mockToken.approve(universeAuctionHouse.address, 100);
    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.functions['erc20Bid(uint256,uint256)'](1, '100');

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await universeAuctionHouse.distributeCapturedAuctionRevenue(1);
  });

  it('should revert when is not finalized and user try to claim erc721', async () => {
    const { universeAuctionHouse } = await loadFixture(deployedContracts);

    await createAuction(universeAuctionHouse);

    await expect(universeAuctionHouse.claimERC721Rewards(1, 1)).to.be.reverted;
  });

  it('should revert if some who is not the winner try to claim', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
    const resetTimer = 1;
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

    const [signer, signer2] = await ethers.getSigners();

    await mockNFT.connect(signer).mint(signer.address, 1);

    await mockNFT.connect(signer).approve(universeAuctionHouse.address, 1);
    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.connect(signer).functions['ethBid(uint256)'](1, {
      value: '200000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);
    
    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await expect(universeAuctionHouse.connect(signer2).claimERC721Rewards(1, 1)).to.be.reverted;
  });

  it('should set isValid to false if addr1 bid is lower than addr2 bid', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
    const resetTimer = 1;
    const numberOfSlots = 4;
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

    const [signer, signer2, signer3, signer4] = await ethers.getSigners();

    await mockNFT.connect(signer).mint(signer.address, 1);

    await mockNFT.connect(signer).approve(universeAuctionHouse.address, 1);
    await universeAuctionHouse.connect(signer).depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.connect(signer).functions['ethBid(uint256)'](1, {
      value: '200000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '300000000000000000000'
    });

    await universeAuctionHouse.connect(signer3).functions['ethBid(uint256)'](1, {
      value: '400000000000000000000'
    });

    await universeAuctionHouse.connect(signer4).functions['ethBid(uint256)'](1, {
      value: '500000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }
  });

  it('should have 0 id for nft', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
    const resetTimer = 1;
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

    await mockNFT.connect(signer).mint(signer.address, 1);
    await mockNFT.connect(signer).mint(signer.address, 2);

    await mockNFT.connect(signer).approve(universeAuctionHouse.address, 1);
    await mockNFT.connect(signer).approve(universeAuctionHouse.address, 2);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);
    await universeAuctionHouse.depositERC721(1, 1, [[2, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.connect(signer).functions['ethBid(uint256)'](1, {
      value: '500000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 200]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.finalizeAuction(1);

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.captureSlotRevenue(1, (i + 1));
    }

    await universeAuctionHouse.connect(signer).claimERC721Rewards(1, 1, 2);
  });

  it('should revert if last address do not have lowest bid', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 2500;
    const endTime = startTime + 500;
    const resetTimer = 6;
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

    const [signer, signer2] = await ethers.getSigners();

    await mockNFT.connect(signer).mint(signer.address, 'TOKEN_URI');

    await mockNFT.connect(signer).approve(universeAuctionHouse.address, 1);

    await universeAuctionHouse.depositERC721(1, 1, [[1, mockNFT.address]]);

    await ethers.provider.send('evm_setNextBlockTimestamp', [startTime + 100]); 
    await ethers.provider.send('evm_mine');

    await universeAuctionHouse.connect(signer).functions['ethBid(uint256)'](1, {
      value: '100000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '200000000000000000000'
    });

    await universeAuctionHouse.connect(signer2).functions['ethBid(uint256)'](1, {
      value: '300000000000000000000'
    });

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime + 500]); 
    await ethers.provider.send('evm_mine');

    await expect(universeAuctionHouse.finalizeAuction(1)).to.be.not.reverted;
  });
});

const createAuction = async (universeAuctionHouse) => {
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 2500;
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
