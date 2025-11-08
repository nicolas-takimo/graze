// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgroAsset is ERC721, Ownable {
    uint256 public nextTokenId;

    struct AssetMetadata {
        string assetType;
        uint256 quantity;
        string location;
    }

    mapping(uint256 => AssetMetadata) public assetInfo;

    event AssetMinted(uint256 indexed tokenId, address indexed to, string assetType, uint256 quantity, string location);

    constructor() ERC721("AgroAsset", "AGRO") {}

    function mint(address to, string memory assetType, uint256 quantity, string memory location) external {
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        assetInfo[tokenId] = AssetMetadata(assetType, quantity, location);
        emit AssetMinted(tokenId, to, assetType, quantity, location);
    }

    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
        delete assetInfo[tokenId];
    }
}
