const { expect } = require('chai');
const { waffle, upgrades } = require('hardhat');
const { loadFixture } = waffle;

describe('DEPOSIT ERC721 Functionality', () => {
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

  it('deposit nft successfully', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    expect(await universeAuctionHouse.totalAuctions()).to.equal(1);

    const [owner] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    expect(await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]])).to.be.emit(
      universeAuctionHouse,
      'LogERC721Deposit'
    );
  });

  it('should withdrawDepositedERC721 deposited nft', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 10;
    const bidToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      bidToken,
      minimumReserveValues,
      paymentSplits
    ]);

    expect(await universeAuctionHouse.totalAuctions()).to.equal(1);

    const [owner] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI1');
    await mockNFT.mint(owner.address, 'nftURI2');
    await mockNFT.mint(owner.address, 'nftURI3');
    await mockNFT.mint(owner.address, 'nftURI4');
    await mockNFT.mint(owner.address, 'nftURI5');
    await mockNFT.mint(owner.address, 'nftURI6');
    await mockNFT.mint(owner.address, 'nftURI7');
    await mockNFT.mint(owner.address, 'nftURI8');
    await mockNFT.mint(owner.address, 'nftURI9');
    await mockNFT.mint(owner.address, 'nftURI10');

    await mockNFT.approve(universeAuctionHouse.address, 1);
    await mockNFT.approve(universeAuctionHouse.address, 2);
    await mockNFT.approve(universeAuctionHouse.address, 3);
    await mockNFT.approve(universeAuctionHouse.address, 4);
    await mockNFT.approve(universeAuctionHouse.address, 5);
    await mockNFT.approve(universeAuctionHouse.address, 6);
    await mockNFT.approve(universeAuctionHouse.address, 7);
    await mockNFT.approve(universeAuctionHouse.address, 8);
    await mockNFT.approve(universeAuctionHouse.address, 9);
    await mockNFT.approve(universeAuctionHouse.address, 10);

    await universeAuctionHouse.depositERC721(auctionId, slotIdx, [[1, mockNFT.address],[2, mockNFT.address],[3, mockNFT.address],[4, mockNFT.address],[5, mockNFT.address],[6, mockNFT.address],[7, mockNFT.address],[8, mockNFT.address],[9, mockNFT.address],[10, mockNFT.address]]);
    await universeAuctionHouse.cancelAuction(auctionId);

    await expect(universeAuctionHouse.withdrawDepositedERC721(1, 1, 11)).revertedWith("E26")
    await expect(universeAuctionHouse.withdrawDepositedERC721(1, 1, 41)).revertedWith("E25")
    await expect(universeAuctionHouse.withdrawDepositedERC721(1, 1, 5)).to.be.emit(universeAuctionHouse, 'LogERC721Withdrawal');
    await expect(universeAuctionHouse.withdrawDepositedERC721(1, 1, 6)).revertedWith("E26")
    await expect(universeAuctionHouse.withdrawDepositedERC721(1, 1, 5)).to.be.emit(universeAuctionHouse, 'LogERC721Withdrawal');
    await expect(universeAuctionHouse.withdrawDepositedERC721(1, 1, 1)).revertedWith("E26")

    const ownerOfToken1 = await mockNFT.ownerOf(1);
    const ownerOfToken5 = await mockNFT.ownerOf(5);
    const ownerOfToken10 = await mockNFT.ownerOf(10);
    
    expect(ownerOfToken1).to.equal(owner.address)
    expect(ownerOfToken5).to.equal(owner.address)
    expect(ownerOfToken10).to.equal(owner.address)
  });

  it('should revert if auctionId do not exists', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    const [owner] = await ethers.getSigners();

    const auctionId = 2;
    const slotIdx = 0;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]])).to.be.reverted;
  });

  it('should revert if auctionId do not exists', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    const [owner] = await ethers.getSigners();

    const auctionId = 2;
    const slotIdx = 0;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]])).to.be.reverted;
  });

  it('should revert if auction slot > 2000', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    const [owner] = await ethers.getSigners();

    const auctionId = 2;
    const slotIdx = 2001;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]])).to.be.reverted;
  });

  it('should revert if tokenAddress is zero address', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    const [owner] = await ethers.getSigners();

    const auctionId = 2;
    const slotIdx = 2001;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(
      universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, '0x0000000000000000000000000000000000000000']])
    ).to.be.reverted;
  });

  it('should revert if tokenAddress is 0', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    const [owner] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 0;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(
      universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, '0x0000000000000000000000000000000000000000']])
    ).to.be.reverted;
  });

  it('should deposit only if part of whitelist', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);
    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 10;
    const bidToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      bidToken,
      minimumReserveValues,
      paymentSplits
    ]);

    const [owner] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 0;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]])).to.be.reverted;
  });

  it('should revert if user try to deposit in no existing slot', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    expect(await universeAuctionHouse.totalAuctions()).to.equal(1);

    const [owner] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 11;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI');
    await mockNFT.approve(universeAuctionHouse.address, tokenId);

    await expect(universeAuctionHouse.depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]])).to.be.reverted;
  });

  it('should revert if previous slot is empty', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    await createAuction(deployedContracts);

    expect(await universeAuctionHouse.totalAuctions()).to.equal(1);

    const [owner] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 11;
    const tokenId = 1;

    await mockNFT.mint(owner.address, 'nftURI1');
    await mockNFT.mint(owner.address, 'nftURI2');
    await mockNFT.mint(owner.address, 'nftURI3');

    await mockNFT.approve(universeAuctionHouse.address, 1);
    await mockNFT.approve(universeAuctionHouse.address, 2);
    await mockNFT.approve(universeAuctionHouse.address, 3);

    await universeAuctionHouse.depositERC721(auctionId, 1, [[1, mockNFT.address]])

    await expect(universeAuctionHouse.depositERC721(auctionId, 3, [[2, mockNFT.address]])).revertedWith("E39");

    await universeAuctionHouse.depositERC721(auctionId, 2, [[2, mockNFT.address]])

    await universeAuctionHouse.depositERC721(auctionId, 3, [[3, mockNFT.address]])
  });

  it('should revert cuz E41', async () => {
    const { universeAuctionHouse, mockNFT } = await loadFixture(deployedContracts);

    const currentTime = Math.round((new Date()).getTime() / 1000);

    const startTime = currentTime + 1500;
    const endTime = startTime + 500;
    const resetTimer = 3;
    const numberOfSlots = 10;
    const bidToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const minimumReserveValues = [];
    const paymentSplits = [];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      bidToken,
      minimumReserveValues,
      paymentSplits
    ]);
    const [signer1, signer2] = await ethers.getSigners();

    const auctionId = 1;
    const slotIdx = 1;
    const tokenId = 1;

    await mockNFT.connect(signer1).mint(signer1.address, 'nftURI');
    await mockNFT.connect(signer1).approve(universeAuctionHouse.address, tokenId);

    await universeAuctionHouse.connect(signer1).depositERC721(auctionId, slotIdx, [[tokenId, mockNFT.address]]);

    await expect(universeAuctionHouse.connect(signer2).withdrawDepositedERC721(1, 0, 1)).to.be.reverted;
  });
});

const createAuction = async (deployedContracts) => {
  const { universeAuctionHouse, mockNft } = await loadFixture(deployedContracts);
  const currentTime = Math.round((new Date()).getTime() / 1000);

  const startTime = currentTime + 1500;
  const endTime = startTime + 500;
  const resetTimer = 3;
  const numberOfSlots = 10;
  const bidToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const minimumReserveValues = [];
  const paymentSplits = [];

  await universeAuctionHouse.createAuction([
    startTime,
    endTime,
    resetTimer,
    numberOfSlots,
    bidToken,
    minimumReserveValues,
    paymentSplits
  ]);
};
