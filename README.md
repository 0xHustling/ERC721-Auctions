# ERC721 Auctions

The repository contains ERC721 Auctions smart contracts written for UniverseXYZ. Credit to [UniverseXYZ](https://universe.xyz).

### Build the project

Run:

```
$ yarn
$ cp .envrc.example .envrc
$ source .envrc
$ yarn compile
```

### Run Tests

```
$ npx hardhat test
```

### Deploy to Ganache

```
$ ./start_ganache.sh
$ yarn deploy ganache
```

### Deploy to live networks

Edit .envrc.example then copy it to .envrc

```
$ cp .envrc.example .envrc
$ source .envrc
```

Make sure to update the enviroment variables with suitable values.

Now enable the env vars using [direnv](https://direnv.net/docs/installation.html)

```
$ eval "$(direnv hook bash)"
$ direnv allow
```

Deploy to a network:

```
$ yarn deploy rinkeby
```

### Verify smart contract on etherscan

To verify the deployed contract run:

```
$ yarn etherscan-verify rinkeby --address
```

### Gas cost estimation

To get a gas estimation for deployment of contracts and functions calls, the `REPORT_GAS` env variable must be set to true. To estimate with certaing gas price update the hardhat.config.js file. Gas estimation happens during test, only functions specified in tests will get an estimation. run with:

```
$ yarn test
```

### Rinkeby deployments

UniverseAuctionHouse - https://rinkeby.etherscan.io/address/0x2345164eFfE24EA125ECD0ec9C7539D5422c367f

UniverseERC721Factory - https://rinkeby.etherscan.io/address/0x26E84797880B6435861E8730171B75e6257bCBa0

UniverseERC721 - https://rinkeby.etherscan.io/address/0xF7B12892699D6c94E83d864805A381548cfB2A29

UniverseERC721Core - https://rinkeby.etherscan.io/address/0xfD7D165344a04241AB3Cd07d021eEC17F03ADc51
