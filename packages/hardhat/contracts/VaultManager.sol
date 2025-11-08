// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./StableToken.sol";

contract VaultManager is ReentrancyGuard, Ownable {
    using SafeERC20 for StableToken;

    StableToken public stable;
    AggregatorV3Interface public priceFeed;

    mapping(address => Vault) public vaults;

    struct Vault {
        uint256 ethCollateral;
        uint256 stableDebt;
    }

    // 110% - A posição será liquidável abaixo disso.
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 11_000;
    // 150% - Mínimo para mintar/retirar (para ter uma margem)
    uint256 public constant MIN_COLLATERAL_RATIO_BPS = 15_000;

    uint256 public constant liquidationBonusBps = 500; // 5%
    uint256 public constant BPS = 10_000;
    uint256 public constant PRECISION = 1e18;

    event VaultUpdated(address indexed owner, uint256 ethCollateral, uint256 stableDebt);
    event VaultLiquidated(address indexed liquidator, address indexed owner, uint256 stablePaid, uint256 ethSeized);

    constructor(address _priceFeed, address _stableAddr) {
        require(_priceFeed != address(0), "price feed required");
        priceFeed = AggregatorV3Interface(_priceFeed);
        stable = StableToken(_stableAddr);
    }

    // --- Funções Principais ---

    function depositAndMint(uint256 _stableToMint) external payable nonReentrant {
        Vault storage vault = vaults[msg.sender];

        if (msg.value > 0) {
            vault.ethCollateral += msg.value;
        }

        if (_stableToMint > 0) {
            vault.stableDebt += _stableToMint;

            uint256 collateralValueUSD = getCollateralValueUSD(vault.ethCollateral);
            uint256 debtValueUSD = vault.stableDebt;
            // Evita divisão por zero se o cofre estiver zerado mas tentar mintar
            require(debtValueUSD > 0, "No debt");
            uint256 collateralRatio = (collateralValueUSD * PRECISION) / debtValueUSD;
            uint256 collateralRatioBPS = (collateralRatio * BPS) / PRECISION;

            // Agora checa contra 150% (sua lógica)
            require(collateralRatioBPS >= MIN_COLLATERAL_RATIO_BPS, "Vault health too low after mint");

            stable.mint(msg.sender, _stableToMint);
        }

        emit VaultUpdated(msg.sender, vault.ethCollateral, vault.stableDebt);
    }

    function repayAndWithdraw(uint256 _stableToRepay, uint256 _ethToWithdraw) external nonReentrant {
        Vault storage vault = vaults[msg.sender];

        if (_stableToRepay > 0) {
            require(vault.stableDebt >= _stableToRepay, "repay amount too high");
            vault.stableDebt -= _stableToRepay;
            stable.transferFrom(msg.sender, address(this), _stableToRepay);
            stable.burn(address(this), _stableToRepay);
        }

        if (_ethToWithdraw > 0) {
            require(vault.ethCollateral >= _ethToWithdraw, "withdraw amount too high");
            vault.ethCollateral -= _ethToWithdraw;

            if (vault.stableDebt > 0) {
                uint256 collateralValueUSD = getCollateralValueUSD(vault.ethCollateral);
                uint256 debtValueUSD = vault.stableDebt;
                uint256 collateralRatio = (collateralValueUSD * PRECISION) / debtValueUSD;
                uint256 collateralRatioBPS = (collateralRatio * BPS) / PRECISION;

                // Agora checa contra 150% (sua lógica)
                require(collateralRatioBPS >= MIN_COLLATERAL_RATIO_BPS, "Vault health too low after withdraw");
            }

            (bool sent, ) = msg.sender.call{ value: _ethToWithdraw }("");
            require(sent, "ETH transfer failed");
        }

        emit VaultUpdated(msg.sender, vault.ethCollateral, vault.stableDebt);
    }

    function liquidate(address _owner) external nonReentrant {
        Vault storage vault = vaults[_owner];
        uint256 stableDebt = vault.stableDebt;

        require(stableDebt > 0, "No debt");

        require(getHealthFactor(_owner) <= PRECISION, "Vault not liquidatable");

        uint256 collateralToSeizeUSD = (stableDebt * (BPS + liquidationBonusBps)) / BPS;
        uint256 ethToSeizeWei = (collateralToSeizeUSD * PRECISION) / getNormalizedPrice();

        require(vault.ethCollateral >= ethToSeizeWei, "Not enough collateral in vault for bonus");
        // (Removida a checagem de 'address(this).balance', pois o colateral do cofre está no vault.ethCollateral)
        // O ETH do Vault está no 'vault.ethCollateral', mas é o 'receive()' que o armazena no contrato.
        // O ETH enviado para depositAndMint é armazenado no saldo do contrato. A checagem está correta.
        require(address(this).balance >= ethToSeizeWei, "Insufficient ETH reserves in contract");

        stable.transferFrom(msg.sender, address(this), stableDebt);
        stable.burn(address(this), stableDebt);
        (bool sent, ) = msg.sender.call{ value: ethToSeizeWei }("");
        require(sent, "ETH transfer failed");

        vault.stableDebt = 0;
        vault.ethCollateral -= ethToSeizeWei;

        emit VaultLiquidated(msg.sender, _owner, stableDebt, ethToSeizeWei);
        emit VaultUpdated(_owner, vault.ethCollateral, vault.stableDebt);
    }

    // --- Funções de Leitura (View) ---

    function getHealthFactor(address _owner) public view returns (uint256) {
        Vault memory vault = vaults[_owner];
        if (vault.stableDebt == 0) return type(uint256).max;

        uint256 collateralValueUSD = getCollateralValueUSD(vault.ethCollateral);
        uint256 debtValueUSD = vault.stableDebt;
        if (debtValueUSD == 0) return type(uint256).max;

        uint256 collateralRatio = (collateralValueUSD * PRECISION) / debtValueUSD;
        // HF = (Razão Atual / Razão Mínima de Liquidação)
        // Ex: (1.5e18 * 10000) / 11000 = 1.36e18
        return (collateralRatio * BPS) / LIQUIDATION_THRESHOLD_BPS;
    }

    function getCollateralValueUSD(uint256 _ethAmount) public view returns (uint256) {
        uint256 ethPrice = getNormalizedPrice();
        return (_ethAmount * ethPrice) / PRECISION;
    }

    function getNormalizedPrice() public view returns (uint256) {
        (, int256 p, , , ) = priceFeed.latestRoundData();
        require(p > 0, "invalid price");
        uint8 d = priceFeed.decimals();
        uint256 up = uint256(p);
        if (d == 18) return up;
        if (d < 18) return up * (10 ** (18 - d));
        return up / (10 ** (d - 18));
    }

    receive() external payable {}
}
