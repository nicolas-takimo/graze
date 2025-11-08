// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockBridgeBase
 * @dev "Trava" ativos na Base para serem "espelhados" no Zama.
 * Em um hackathon, o "backend" (você) assiste a esses eventos.
 */
contract MockBridgeBase is Ownable {
    IERC20 public stableToken;
    IERC721 public agroAsset;

    event TokenLocked(address indexed user, uint256 amount);
    event NFTLocked(address indexed user, uint256 tokenId);

    // Eventos para o admin (você) liberar os fundos de volta
    event TokenReleased(address indexed to, uint256 amount);
    event NFTReleased(address indexed to, uint256 tokenId);

    constructor(address _stableToken, address _agroAsset) {
        stableToken = IERC20(_stableToken);
        agroAsset = IERC721(_agroAsset);
    }

    function lockToken(uint256 amount) external {
        stableToken.transferFrom(msg.sender, address(this), amount);
        emit TokenLocked(msg.sender, amount);
    }

    function lockNFT(uint256 tokenId) external {
        agroAsset.transferFrom(msg.sender, address(this), tokenId);
        emit NFTLocked(msg.sender, tokenId);
    }

    // --- Funções de Admin (para o "backend" da ponte falsa) ---
    function releaseToken(address to, uint256 amount) external onlyOwner {
        stableToken.transfer(to, amount);
        emit TokenReleased(to, amount);
    }

    function releaseNFT(address to, uint256 tokenId) external onlyOwner {
        agroAsset.transferFrom(address(this), to, tokenId);
        emit NFTReleased(to, tokenId);
    }
}
