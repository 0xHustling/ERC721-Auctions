const { expect } = require('chai');
const { waffle, upgrades } = require('hardhat');
const { loadFixture } = waffle;


describe('UniverseERC721', () => {
  const deployContracts = async () => {
    const [owner, addr1] = await ethers.getSigners();
    const UniverseAuctionHouse = await ethers.getContractFactory('UniverseAuctionHouse');

    const MockRoyaltiesRegistry =  await ethers.getContractFactory('MockRoyaltiesRegistry');
    const mockRoyaltiesRegistry = await upgrades.deployProxy(MockRoyaltiesRegistry, [], {initializer: "__RoyaltiesRegistry_init"});

    const universeAuctionHouse = await upgrades.deployProxy(UniverseAuctionHouse,
      [
        2000, 100, 0, owner.address, [], mockRoyaltiesRegistry.address
      ], 
      {
        initializer: "__UniverseAuctionHouse_init",
    });

    const UniverseERC721 = await ethers.getContractFactory('UniverseERC721');
    const universeERC721 = await UniverseERC721.deploy("Non Fungible Universe", "NFU");

    const UniverseERC721Core = await ethers.getContractFactory('UniverseERC721Core');
    const universeERC721Core = await UniverseERC721Core.deploy("Non Fungible Universe Core", "NFUC");

    return { universeAuctionHouse, universeERC721, universeERC721Core };
  };

  it('should mint successfully', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer] = await ethers.getSigners();

    await universeERC721.mint(signer.address, 'TestURI', [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
    await universeERC721Core.mint(signer.address, 'TestURI', [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
  });

  it('should batchMint successfully', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer] = await ethers.getSigners();

    await universeERC721.batchMint(signer.address, ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
    await universeERC721Core.batchMint(signer.address, ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
  });

  it('should batchMint differentFees successfully', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer] = await ethers.getSigners();

    await universeERC721.batchMintWithDifferentFees(signer.address, ['TestURI', 'TestURI2'], [[["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]],[["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]]);
    await universeERC721Core.batchMintWithDifferentFees(signer.address, ['TestURI', 'TestURI2'], [[["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]],[["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]]);
  });

  it('should revert with Cannot mint more than 40 ERC721 tokens in a single call', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer] = await ethers.getSigners();

    const uris = new Array(41).fill('asd');

    await expect(universeERC721.batchMint(signer.address, uris, [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]])).revertedWith(
      'Cannot mint more than 40'
    );

    await expect(universeERC721Core.batchMint(signer.address, uris, [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]])).revertedWith(
      'Cannot mint more than 40'
    );
  });

  it('should batchMint multiple successfully', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer, signer1] = await ethers.getSigners();

    await universeERC721.batchMintMultipleReceivers([signer.address, signer1.address], ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
    await universeERC721Core.batchMintMultipleReceivers([signer.address, signer1.address], ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
  });

  it('should set torrent magnet link successfully', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer, signer1] = await ethers.getSigners();

    await universeERC721.batchMintMultipleReceivers([signer.address, signer1.address], ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
    await universeERC721Core.batchMintMultipleReceivers([signer.address, signer1.address], ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
    await universeERC721Core.updateTorrentMagnetLink(1, "TestMagnetLink");
    await expect(universeERC721Core.connect(signer1).updateTorrentMagnetLink(1, "TestMagnetLink2")).revertedWith("Not called from the creator");
  });

  it('should set and update consumer successfully', async () => {
    const { universeERC721, universeERC721Core } = await loadFixture(deployContracts);

    const [signer, signer1] = await ethers.getSigners();

    await universeERC721Core.batchMintMultipleReceivers([signer.address, signer1.address], ['TestURI', 'TestURI2'], [["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1000]]);
    await universeERC721Core.connect(signer).changeConsumer(signer1.address, 1);
    await expect(universeERC721Core.connect(signer1).changeConsumer(signer1.address, 1)).revertedWith("ERC721Consumable: changeConsumer caller is not owner nor approved");
    await universeERC721Core.connect(signer1).changeConsumer(signer1.address, 2);
  });
});
