// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WAgroAsset
 * @dev Versão "embrulhada" (Wrapped) do AgroAsset para rodar na rede Zama.
 * Armazena a mesma metadata do original.
 */
contract WAgroAsset is ERC721, Ownable {
    // Copiado do AgroAsset.sol original
    struct AssetMetadata {
        string assetType;
        uint256 quantity;
        string location;
    }
    mapping(uint256 => AssetMetadata) public assetInfo;

    constructor() ERC721("Wrapped AgroAsset", "wAGRO") {}

    /**
     * @dev Apenas o 'owner' (ponte/admin) pode mintar um NFT,
     * espelhando o Token ID e os dados do contrato original.
     */
    function mint(
        address to,
        uint256 tokenId, // O ID original da Base
        string memory assetType,
        uint256 quantity,
        string memory location
    ) external onlyOwner {
        _safeMint(to, tokenId);
        assetInfo[tokenId] = AssetMetadata(assetType, quantity, location);
    }

    // Apenas o 'owner' (ponte/admin) pode queimar
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
        delete assetInfo[tokenId];
    }
}
