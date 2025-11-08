// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WStableToken
 * @dev Versão "embrulhada" (Wrapped) do aUSD para rodar na rede Zama.
 * Apenas o "owner" (a ponte/admin) pode mintar e queimar.
 */
contract WStableToken is ERC20, Ownable {
    constructor() ERC20("Wrapped AgroUSD", "waUSD") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Permite que o 'owner' queime o token de um usuário (para a ponte de volta)
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
