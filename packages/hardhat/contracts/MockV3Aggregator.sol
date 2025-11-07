// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

// Usado para testes locais
contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public immutable decimals;
    int256 public latestAnswer;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        latestAnswer = _initialAnswer;
    }

    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, latestAnswer, block.timestamp, block.timestamp, 1);
    }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, latestAnswer, block.timestamp, block.timestamp, 1);
    }
    function description() external pure returns (string memory) { return "Mock"; }
    function version() external pure returns (uint256) { return 1; }
    // Funções set (para o teste poder mudar o preço)
    function setLatestAnswer(int256 _newAnswer) public {
        latestAnswer = _newAnswer;
    }
}