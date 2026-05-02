// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
}

contract RewardVault {
    address public owner;
    IERC20Mintable public rewardToken;

    event Rewarded(address indexed to, uint256 amount, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address rewardTokenAddress) {
        owner = msg.sender;
        rewardToken = IERC20Mintable(rewardTokenAddress);
    }

    function reward(address to, uint256 amount, string calldata reason) external onlyOwner {
        require(to != address(0), "Bad wallet");
        require(amount > 0, "Bad amount");
        rewardToken.mint(to, amount);
        emit Rewarded(to, amount, reason);
    }
}
