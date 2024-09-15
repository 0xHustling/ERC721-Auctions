## Auctions specs/stages

### 1. Create an auction with specified configuration

- The auction is opened for deposits until the *startTime* timestamp is reached
- The depositor can deposit NFTs into each defined slot, up to the slot limit
- The depositor can withdraw NFTs before the auction has started
- The auction can be cancelled before the *startTime* timestamp
- If the auction has started and there are no deposited NFTs, the auction becomes void and does not accept deposits

### 2. Auction start

- Users are allowed to to bid to the auction (with ERC20 token or ETH)
- There is no restriction on the bid amount until all slots have been filled
- Once there are more bids than slots, every next bid should be higher than the next winning bid
- Each user is allowed to withdraw his bid if it is a non winning bid
- Users are allowed to bid until the *endTime* timestamp is reached

### 3. Auction end

- When the *endTime* timestamp is reached, the *finalizeAuction* function should be called. It will check which slots have been won, assign the winners and the bid amounts
- Once the auction is finalized, the revenue for each slot should be captured. Without this step, the auctioneer wouldn’t be able to collect his winnings and the bidders wouldn’t be able to withdraw their NFTs
- In the case of auction with little amount of slots, all slots revenue can be captured in a batch transaction *captureSlotRevenueRange*

### 4. Capture revenue

- When the revenue has been captured, the winners are allowed to withdraw the NFTs they’ve won. This is done by calling the *claimERC721Rewards*. There could be a case, where there are more NFTs in a slot and one transaction could not be enough (due to gas limitations). In this case the function should be called multiple times with the remaining amounts.
- In the case there is a slot which hasn’t been won by anyone (either because the reserve price hasn't been met or there weren't enough bids), the depositor can withdraw his NFTs with the *withdrawERC721FromNonWinningSlot* function. It has the same mechanics as *claimERC721Rewards*
- To collect the revenue from the auctions, *distributeCapturedAuctionRevenue* should be called for each slot.

### Functions related to each stage:

- **Create** - *createAuction*
- **Cancel** - *cancelAuction*, *withdrawDepositedERC721*
- **Deposit** - *depositERC721*, *batchDepositToAuction*
- **Bidding** - *ethBid*, *erc20Bid*, *withdrawEthBid*, *withdrawERC20Bid*
- **Finalize** - *finalizeAuction*, *captureSlotRevenue*, *captureSlotRevenueRange*, *claimERC721Rewards*, *withdrawERC721FromNonWinningSlot*
- **Revenue distribution** - *distributeCapturedAuctionRevenue*, *distributeSecondarySaleFees*, *distributeRoyalties*