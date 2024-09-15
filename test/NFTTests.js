const { expect } = require('chai');
const { waffle } = require('hardhat');
const { loadFixture } = waffle;

describe('MockNFT', () => {
  async function deployContract() {
    const MockNFT = await ethers.getContractFactory('MockNFT');
    const mockNFT = await MockNFT.deploy();

    return mockNFT;
  }

  async function mint() {
    const mockNFT = await loadFixture(deployContract);
    const [owner, addr1] = await ethers.getSigners();

    await mockNFT.mint(addr1.address, 'testURI');

    return { mockNFT, addr1 };
  }

  it('Deploy the MockNFT', async function () {
    const universeAuctionHouse = await loadFixture(deployContract);

    expect(universeAuctionHouse.address).to.have.string('0x');
  });
  it('Mint an NFT', async function () {
    const { mockNFT, addr1 } = await loadFixture(mint);
    const balance = await mockNFT.balanceOf(addr1.address);
    expect(balance.toString()).to.equal('1');
  });
});
