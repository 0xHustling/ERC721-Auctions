const { expect } = require("chai");

const { waffle, ethers, network, upgrades } = require("hardhat");
const { loadFixture } = waffle;

function chunkifyArray(nftsArr, chunkSize) {
  let chunkifiedArray = [];
  let tokenStartIndex = 0;
  let tokenEndIndex = nftsArr.length % chunkSize;

  do {
    if (tokenEndIndex != 0) chunkifiedArray.push(nftsArr.slice(tokenStartIndex, tokenEndIndex));

    tokenStartIndex = tokenEndIndex;
    tokenEndIndex = tokenStartIndex + chunkSize;
  } while (tokenStartIndex < nftsArr.length);

  return chunkifiedArray;
}

describe("End to End Auction Universe House Tests", () => {
  const deployedContracts = async () => {
    const [owner, signer] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory("UniverseAuctionHouse");

    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        100,
        100,
        0,
        owner.address,
        [],
        mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
    });

    const UniverseERC721 = await ethers.getContractFactory("UniverseERC721");
    const universeERC721 = await UniverseERC721.deploy("Non Fungible Universe", "NFU");

    const UniverseERC721Core = await ethers.getContractFactory("UniverseERC721Core");
    const universeERC721Core = await UniverseERC721Core.deploy(
      "Non Fungible Universe Core",
      "NFUC"
    );

    return { universeAuctionHouse, universeERC721, universeERC721Core };
  };

  it("should finalize successfully - captureSlotRevenue", async () => {
    const { universeAuctionHouse, universeERC721, universeERC721Core } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    let randomWallet1 = ethers.Wallet.createRandom();
    let randomWallet2 = ethers.Wallet.createRandom();
    let randomWallet3 = ethers.Wallet.createRandom();
    let randomWallet4 = ethers.Wallet.createRandom();
    let randomWallet5 = ethers.Wallet.createRandom();

    const NFT_TOKEN_COUNT = 100;
    const NFT_CHUNK_SIZE = 25;

    // create auction
    const currentTime = Math.round(new Date().getTime() / 1000);
    const startTime = currentTime + 50000;
    const endTime = startTime + 10000;

    const resetTimer = 1;
    const numberOfSlots = 50;
    const ethAddress = "0x0000000000000000000000000000000000000000";
    const minimumReserveValues = [];

    for (let i = 0; i < numberOfSlots; i++) {
      minimumReserveValues.push("1000000000000000000");
    }

    const paymentSplits = [
      [randomWallet1.address, "400"],
      [randomWallet2.address, "400"],
      [randomWallet3.address, "400"],
      [randomWallet4.address, "400"],
      [randomWallet5.address, "400"],
    ];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      ethAddress,
      minimumReserveValues,
      paymentSplits,
    ]);

    const multipleMockNFTs = new Array(numberOfSlots * NFT_TOKEN_COUNT);

    for (let i = 0; i < numberOfSlots * NFT_TOKEN_COUNT; i++) {
      await universeERC721Core.mint(accounts[0].address, i + 1, [
        [randomWallet1.address, "400"],
        [randomWallet2.address, "400"],
        [randomWallet3.address, "400"],
        [randomWallet4.address, "400"],
        [randomWallet5.address, "400"],
      ]);
      await universeERC721Core.approve(universeAuctionHouse.address, i + 1);
      multipleMockNFTs[i] = [i + 1, universeERC721Core.address];
    }

    const chunksOfNfts = chunkifyArray(multipleMockNFTs, NFT_CHUNK_SIZE);

    let slot = 1;
    for (let chunk = 1; chunk <= chunksOfNfts.length; chunk++) {
      await universeAuctionHouse.depositERC721(1, slot, chunksOfNfts[chunk - 1]);
      if (chunk % 4 == 0) {
        slot++;
      }
    }

    await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 100]);
    await ethers.provider.send("evm_mine");

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.connect(accounts[i]).functions["ethBid(uint256)"](1, {
        value: `${i + 1}000000000000000000`,
      });
    }

    for (let i = 0; i< numberOfSlots; i++) {
      const bidderBalance = await universeAuctionHouse.getBidderBalance(1, accounts[i].address);
      const balance = Number(ethers.utils.formatEther(bidderBalance).toString());
      expect(balance).to.equal(i+1);
    }

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 500]);
    await ethers.provider.send("evm_mine");

    await universeAuctionHouse.finalizeAuction(1);
    await universeAuctionHouse.captureSlotRevenue(1, 1);

    const auction = await universeAuctionHouse.auctions(1);

    expect(auction.isFinalized).to.be.true;

    const slot50Winner = await universeAuctionHouse.getSlotWinner(1, 50);
    const slot1Winner = await universeAuctionHouse.getSlotWinner(1, 1);
    const slot25Winner = await universeAuctionHouse.getSlotWinner(1, 25);

    expect(slot50Winner).to.equal(accounts[0].address);
    expect(slot1Winner).to.equal(accounts[49].address);
    expect(slot25Winner).to.equal(accounts[25].address);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1000]);
    await ethers.provider.send("evm_mine");

    await expect(
      universeAuctionHouse.connect(accounts[49]).distributeCapturedAuctionRevenue(1)
    ).to.be.emit(universeAuctionHouse, "LogAuctionRevenueWithdrawal");

    for (let i = 0; i < 100; i++) {
      await universeAuctionHouse.distributeSecondarySaleFees(1, 1, (i + 1));
    }

    const balance1 = await ethers.provider.getBalance(randomWallet1.address);
    const balance2 = await ethers.provider.getBalance(randomWallet2.address);
    const balance3 = await ethers.provider.getBalance(randomWallet3.address);
    const balance4 = await ethers.provider.getBalance(randomWallet4.address);
    const balance5 = await ethers.provider.getBalance(randomWallet5.address);

    expect(Number(ethers.utils.formatEther(balance1).toString())).to.equal(3.6);
    expect(Number(ethers.utils.formatEther(balance2).toString())).to.equal(3.6);
    expect(Number(ethers.utils.formatEther(balance3).toString())).to.equal(3.6);
    expect(Number(ethers.utils.formatEther(balance4).toString())).to.equal(3.6);
    expect(Number(ethers.utils.formatEther(balance5).toString())).to.equal(3.6);

    await expect(universeAuctionHouse.connect(accounts[49]).claimERC721Rewards(1, 1, 40)).to.be.emit(
      universeAuctionHouse,
      "LogERC721RewardsClaim"
    );

    await expect(universeAuctionHouse.connect(accounts[49]).claimERC721Rewards(1, 1, 40)).to.be.emit(
      universeAuctionHouse,
      "LogERC721RewardsClaim"
    );

    await expect(universeAuctionHouse.connect(accounts[49]).claimERC721Rewards(1, 1, 30)).revertedWith(
      "E33"
    );

    await expect(universeAuctionHouse.connect(accounts[49]).claimERC721Rewards(1, 1, 41)).revertedWith(
      "E25"
    );

    await expect(universeAuctionHouse.connect(accounts[49]).claimERC721Rewards(1, 1, 20)).to.be.emit(
      universeAuctionHouse,
      "LogERC721RewardsClaim"
    );
  }).timeout(720000);

  it("should finalize successfully - captureSlotRevenueRange", async () => {
    const { universeAuctionHouse, universeERC721, universeERC721Core } = await loadFixture(
      deployedContracts
    );

    const accounts = await ethers.getSigners();

    let randomWallet1 = ethers.Wallet.createRandom();
    let randomWallet2 = ethers.Wallet.createRandom();
    let randomWallet3 = ethers.Wallet.createRandom();
    let randomWallet4 = ethers.Wallet.createRandom();
    let randomWallet5 = ethers.Wallet.createRandom();

    const NFT_TOKEN_COUNT = 1;
    const NFT_CHUNK_SIZE = 25;

    // create auction
    const currentTime = Math.round(new Date().getTime() / 1000);
    const startTime = currentTime + 50000;
    const endTime = startTime + 10000;

    const resetTimer = 1;
    const numberOfSlots = 100;
    const ethAddress = "0x0000000000000000000000000000000000000000";
    const minimumReserveValues = [];

    for (let i = 0; i < numberOfSlots; i++) {
      minimumReserveValues.push("1000000000000000000");
    }

    const paymentSplits = [
      [randomWallet1.address, "400"],
      [randomWallet2.address, "400"],
      [randomWallet3.address, "400"],
      [randomWallet4.address, "400"],
      [randomWallet5.address, "400"],
    ];

    await universeAuctionHouse.createAuction([
      startTime,
      endTime,
      resetTimer,
      numberOfSlots,
      ethAddress,
      minimumReserveValues,
      paymentSplits,
    ]);

    const multipleMockNFTs = new Array(numberOfSlots * NFT_TOKEN_COUNT);

    for (let i = 0; i < numberOfSlots * NFT_TOKEN_COUNT; i++) {
      await universeERC721Core.mint(accounts[0].address, i + 1, [
        [randomWallet1.address, "400"],
        [randomWallet2.address, "400"],
        [randomWallet3.address, "400"],
        [randomWallet4.address, "400"],
        [randomWallet5.address, "400"],
      ]);
      await universeERC721Core.approve(universeAuctionHouse.address, i + 1);
      multipleMockNFTs[i] = [i + 1, universeERC721Core.address];
    }

    for (let i = 1; i <= multipleMockNFTs.length; i++) {
      await universeAuctionHouse.depositERC721(1, i, [multipleMockNFTs[i - 1]]);
    }

    await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 100]);
    await ethers.provider.send("evm_mine");

    for (let i = 0; i < numberOfSlots; i++) {
      await universeAuctionHouse.connect(accounts[i]).functions["ethBid(uint256)"](1, {
        value: `${i + 1}000000000000000000`,
      });
    }

    for (let i = 0; i< numberOfSlots; i++) {
      const bidderBalance = await universeAuctionHouse.getBidderBalance(1, accounts[i].address);
      const balance = Number(ethers.utils.formatEther(bidderBalance).toString());
      expect(balance).to.equal(i+1);
    }

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 500]);
    await ethers.provider.send("evm_mine");

    await universeAuctionHouse.finalizeAuction(1);

    await universeAuctionHouse.captureSlotRevenueRange(1, 1, 100);

    const auction = await universeAuctionHouse.auctions(1);

    expect(auction.isFinalized).to.be.true;

    const slot100Winner = await universeAuctionHouse.getSlotWinner(1, 100);
    const slot1Winner = await universeAuctionHouse.getSlotWinner(1, 1);
    const slot50Winner = await universeAuctionHouse.getSlotWinner(1, 50);

    expect(slot50Winner).to.equal(accounts[50].address);
    expect(slot1Winner).to.equal(accounts[99].address);
    expect(slot100Winner).to.equal(accounts[0].address);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1000]);
    await ethers.provider.send("evm_mine");

    await expect(
      universeAuctionHouse.connect(accounts[49]).distributeCapturedAuctionRevenue(1)
    ).to.be.emit(universeAuctionHouse, "LogAuctionRevenueWithdrawal");

    for (let i = 0; i < 100; i++) {
      await universeAuctionHouse.distributeSecondarySaleFees(1, (i + 1), 1);
    }

    const balance1 = await ethers.provider.getBalance(randomWallet1.address);
    const balance2 = await ethers.provider.getBalance(randomWallet2.address);
    const balance3 = await ethers.provider.getBalance(randomWallet3.address);
    const balance4 = await ethers.provider.getBalance(randomWallet4.address);
    const balance5 = await ethers.provider.getBalance(randomWallet5.address);

    expect(Number(ethers.utils.formatEther(balance1).toString())).to.equal(363.6);
    expect(Number(ethers.utils.formatEther(balance2).toString())).to.equal(363.6);
    expect(Number(ethers.utils.formatEther(balance3).toString())).to.equal(363.6);
    expect(Number(ethers.utils.formatEther(balance4).toString())).to.equal(363.6);
    expect(Number(ethers.utils.formatEther(balance5).toString())).to.equal(363.6);

    await expect(universeAuctionHouse.connect(accounts[99]).claimERC721Rewards(1, 1, 1)).to.be.emit(
      universeAuctionHouse,
      "LogERC721RewardsClaim"
    );

    await expect(universeAuctionHouse.connect(accounts[99]).claimERC721Rewards(1, 1, 30)).revertedWith(
      "E33"
    );

    await expect(universeAuctionHouse.connect(accounts[99]).claimERC721Rewards(1, 1, 41)).revertedWith(
      "E25"
    );

  }).timeout(720000);
});
