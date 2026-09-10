// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Verified} from "./Verified.sol";
import {
    IBinaryMarketsModule,
    IBinaryPool,
    IBinaryMarket,
    IOutcomeToken6909
} from "./interfaces/IDreamDEX.sol";

/// @title RunnerVault
/// @notice User-owned bounded vault. Operator may place/cancel/redeem on an armed market only.
/// @dev v1 Reactivity callback records settlement; it does not place the next order.
contract RunnerVault is ReentrancyGuard, SomniaEventHandler {
    using SafeERC20 for IERC20;

    error NotOwner();
    error NotOperator();
    error Killed();
    error TradingPaused();
    error ZeroAddress();
    error InvalidDecimals();
    error CapExceeded(uint256 requested, uint256 cap);
    error DailyLossExceeded(uint256 loss, uint256 cap);
    error NotArmed();
    error PoolMismatch(address expected, address actual);
    error NonceMismatch(uint64 expected, uint64 actual);
    error MarketMismatch(bytes32 expected, bytes32 actual);
    error UnexpectedEmitter(address got);
    error BadTopics();
    error WrongTopic0();
    error NothingToRedeem();
    error NotSettled();
    error OperatorLocked();
    error UnsupportedKind(uint8 kind);

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event OperatorProposed(address indexed proposed, uint64 unlockAt);
    event OperatorSet(address indexed operator);
    event KilledByOwner(address indexed owner);
    event TradingPauseSet(bool paused);
    event CapsSet(uint256 budget, uint256 perWindowCap, uint256 maxDailyLoss, uint256 maxOutstanding);
    event Armed(bytes32 indexed marketId, address pool, uint64 nonce, uint8 kind, uint256 price, uint256 quantity);
    event Placed(bytes32 indexed marketId, uint128 orderId, bool accepted, uint256 notional);
    event PlacementRejected(bytes32 indexed marketId, string reason);
    event Cancelled(uint128 orderId);
    event LapSettled(bytes32 indexed marketId, uint256 questionId, bool voided, uint8 winningOutcome, bool fromCallback);
    event Redeemed(bytes32 indexed marketId, uint8 outcomeIdx, uint256 amount);
    event Minted(bytes32 indexed marketId, uint256 amount);
    event Burned(bytes32 indexed marketId, uint256 amount);
    event ShieldAbsorbed(bytes32 indexed marketId, uint8 remaining);
    event ShieldRefilled(uint8 charges);

    address public immutable owner;
    IERC20 public immutable collateral;
    IBinaryMarketsModule public immutable module;
    address public immutable oracleHub;
    uint8 public immutable priceDecimals;

    address public operator;
    address public proposedOperator;
    uint64 public operatorUnlockAt;
    uint64 public constant OPERATOR_DELAY = 48 hours;

    bool public killed;
    bool public tradingPaused;

    uint256 public budget;
    uint256 public perWindowCap;
    uint256 public maxDailyLoss;
    uint256 public maxOutstandingNotional;
    uint256 public outstandingNotional;
    uint256 public dayStart;
    uint256 public realizedLossToday;
    uint8 public shieldsMax;
    uint8 public shieldCharges;
    uint256 public lastMintAmount;

    struct Arm {
        bytes32 marketId;
        address pool;
        address market;
        uint64 nonce;
        uint8 kind;
        uint256 price;
        uint256 quantity;
        uint64 expireNs;
        uint8 orderType;
        bool active;
        uint128 lastOrderId;
    }

    Arm public armed;
    mapping(bytes32 => bool) public consumed;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    modifier notKilled() {
        if (killed) revert Killed();
        _;
    }

    constructor(
        address owner_,
        address collateral_,
        address module_,
        address oracleHub_,
        uint8 priceDecimals_,
        uint256 budget_,
        uint256 perWindowCap_,
        uint256 maxDailyLoss_,
        uint256 maxOutstandingNotional_
    ) {
        if (owner_ == address(0) || collateral_ == address(0) || module_ == address(0) || oracleHub_ == address(0)) {
            revert ZeroAddress();
        }
        if (priceDecimals_ < 6 || priceDecimals_ > 18) revert InvalidDecimals();
        owner = owner_;
        collateral = IERC20(collateral_);
        module = IBinaryMarketsModule(module_);
        oracleHub = oracleHub_;
        priceDecimals = priceDecimals_;
        budget = budget_;
        perWindowCap = perWindowCap_;
        maxDailyLoss = maxDailyLoss_;
        maxOutstandingNotional = maxOutstandingNotional_;
        dayStart = _dayStart(block.timestamp);
    }

    receive() external payable {}

    /// @notice Collateral escrow for BUY_YES using SDK ceil: (price*qty + unit-1)/unit.
    function costOf(uint256 price, uint256 quantity) public view returns (uint256) {
        return collateralCost(0, price, quantity);
    }

    /// @notice BUY_YES=0 / BUY_NO=2 match writer.ts escrow. SELL_YES=1 / SELL_NO=3 escrow outcome tokens (0 collateral).
    function collateralCost(uint8 kind, uint256 price, uint256 quantity) public view returns (uint256) {
        uint256 unit = 10 ** uint256(priceDecimals);
        if (kind == 0) {
            return (price * quantity + unit - 1) / unit;
        }
        if (kind == 2) {
            if (price >= unit) revert CapExceeded(price, unit);
            return (quantity * (unit - price) + unit - 1) / unit;
        }
        if (kind == 1 || kind == 3) {
            return 0;
        }
        revert UnsupportedKind(kind);
    }

    function deposit(uint256 amount) external nonReentrant notKilled {
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Always available, including pause and after kill.
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        collateral.safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }

    function kill() external onlyOwner {
        killed = true;
        operator = address(0);
        armed.active = false;
        emit KilledByOwner(owner);
    }

    function setTradingPaused(bool paused) external onlyOwner {
        tradingPaused = paused;
        emit TradingPauseSet(paused);
    }

    function setCaps(uint256 budget_, uint256 perWindowCap_, uint256 maxDailyLoss_, uint256 maxOutstanding_)
        external
        onlyOwner
    {
        budget = budget_;
        perWindowCap = perWindowCap_;
        maxDailyLoss = maxDailyLoss_;
        maxOutstandingNotional = maxOutstanding_;
        emit CapsSet(budget_, perWindowCap_, maxDailyLoss_, maxOutstanding_);
    }

    function setShieldsMax(uint8 max_) external onlyOwner {
        if (max_ > 3) max_ = 3;
        uint8 prev = shieldsMax;
        shieldsMax = max_;
        if (prev == 0 && max_ > 0) {
            // First enable pre-funds the configured charges (concept: one loss-sized buffer).
            shieldCharges = max_;
        } else if (shieldCharges > shieldsMax) {
            shieldCharges = shieldsMax;
        }
    }

    function refillShield() external onlyOperator notKilled {
        if (shieldsMax == 0) return;
        if (shieldCharges >= shieldsMax) return;
        shieldCharges += 1;
        emit ShieldRefilled(shieldCharges);
    }

    function proposeOperator(address next) external onlyOwner {
        proposedOperator = next;
        operatorUnlockAt = uint64(block.timestamp) + OPERATOR_DELAY;
        emit OperatorProposed(next, operatorUnlockAt);
    }

    function acceptOperator() external onlyOwner {
        if (block.timestamp < operatorUnlockAt) revert OperatorLocked();
        operator = proposedOperator;
        proposedOperator = address(0);
        emit OperatorSet(operator);
    }

    /// @notice Immediate operator set used only in tests / first bootstrap. Production owner should prefer propose/accept.
    function setOperatorNow(address next) external onlyOwner {
        operator = next;
        emit OperatorSet(next);
    }

    function arm(
        bytes32 marketId,
        uint8 kind,
        uint256 price,
        uint256 quantity,
        uint64 expireNs,
        uint8 orderType
    ) external notKilled {
        if (msg.sender != owner && msg.sender != operator) revert NotOperator();
        if (tradingPaused && msg.sender == operator) revert TradingPaused();
        (
            uint256 qid,
            ,
            ,
            address col,
            ,
            ,
            ,
            ,
            address marketAddr,
            address pool,
            ,
            ,
            ,
        ) = module.markets(marketId);
        qid;
        if (col != address(collateral)) revert PoolMismatch(address(collateral), col);
        if (pool == address(0) || marketAddr == address(0)) revert NotArmed();
        uint64 nonce = module.marketNonce(marketId);
        uint256 notional = collateralCost(kind, price, quantity);
        if (notional > perWindowCap) revert CapExceeded(notional, perWindowCap);
        if (notional > budget) revert CapExceeded(notional, budget);
        if (outstandingNotional + notional > maxOutstandingNotional) {
            revert CapExceeded(outstandingNotional + notional, maxOutstandingNotional);
        }
        _rollDay();
        if (realizedLossToday > maxDailyLoss) revert DailyLossExceeded(realizedLossToday, maxDailyLoss);

        armed = Arm({
            marketId: marketId,
            pool: pool,
            market: marketAddr,
            nonce: nonce,
            kind: kind,
            price: price,
            quantity: quantity,
            expireNs: expireNs,
            orderType: orderType,
            active: true,
            lastOrderId: 0
        });
        emit Armed(marketId, pool, nonce, kind, price, quantity);
    }

    function placeArmed() external onlyOperator notKilled nonReentrant returns (bool accepted, uint128 orderId) {
        if (tradingPaused) revert TradingPaused();
        Arm memory a = armed;
        if (!a.active) revert NotArmed();
        uint64 nonceNow = module.marketNonce(a.marketId);
        if (nonceNow != a.nonce) revert NonceMismatch(a.nonce, nonceNow);
        (, , , , , , , , address marketAddr, address pool, , , , ) = module.markets(a.marketId);
        if (pool != a.pool) revert PoolMismatch(a.pool, pool);
        if (marketAddr != a.market) revert PoolMismatch(a.market, marketAddr);

        uint256 notional = collateralCost(a.kind, a.price, a.quantity);
        _grantModuleOutcomeOperator(a.market);
        if (a.kind == 1 || a.kind == 3) {
            address ot = IBinaryMarket(a.market).outcomeToken();
            IOutcomeToken6909(ot).setOperator(a.pool, true);
        } else {
            collateral.forceApprove(a.pool, notional);
        }

        try IBinaryPool(a.pool).placeBinaryOrder(
            a.kind, a.price, a.quantity, a.expireNs, a.orderType, 0, address(0), 0, 0
        ) returns (bool ok, uint128 id) {
            accepted = ok;
            orderId = id;
            if (ok) {
                armed.lastOrderId = id;
                outstandingNotional += notional;
                emit Placed(a.marketId, id, true, notional);
            } else {
                emit PlacementRejected(a.marketId, "not-accepted");
            }
        } catch {
            emit PlacementRejected(a.marketId, "revert");
        }
    }

    function cancelLast() external notKilled {
        if (msg.sender != owner && msg.sender != operator) revert NotOperator();
        uint128 id = armed.lastOrderId;
        if (id == 0) revert NotArmed();
        uint256 committed = collateralCost(armed.kind, armed.price, armed.quantity);
        IBinaryPool(armed.pool).cancelOrder(id);
        if (outstandingNotional >= committed) outstandingNotional -= committed;
        else outstandingNotional = 0;
        armed.lastOrderId = 0;
        emit Cancelled(id);
    }

    /// @notice Mint a complete YES+NO set against the pool (empty-book fallback).
    function mintSet(bytes32 marketId, uint256 amount) external onlyOperator notKilled nonReentrant {
        if (amount == 0) revert NothingToRedeem();
        if (amount > perWindowCap) revert CapExceeded(amount, perWindowCap);
        if (amount > budget) revert CapExceeded(amount, budget);
        _rollDay();
        if (realizedLossToday > maxDailyLoss) revert DailyLossExceeded(realizedLossToday, maxDailyLoss);
        (, , , address col, , , , , address marketAddr, address pool, , , , ) = module.markets(marketId);
        if (col != address(collateral)) revert PoolMismatch(address(collateral), col);
        if (pool == address(0) || marketAddr == address(0)) revert NotArmed();
        collateral.forceApprove(pool, amount);
        IBinaryPool(pool).mintSet(address(this), address(this), amount);
        _grantModuleOutcomeOperator(marketAddr);
        lastMintAmount = amount;
        emit Minted(marketId, amount);
    }

    /// @notice Merge leftover YES+NO back to collateral when a mint-path dump does not fill.
    function burnSet(bytes32 marketId, uint256 amount) external onlyOperator notKilled nonReentrant {
        if (amount == 0) revert NothingToRedeem();
        (, , , address col, , , , , address marketAddr, address pool, , , , ) = module.markets(marketId);
        if (col != address(collateral)) revert PoolMismatch(address(collateral), col);
        if (pool == address(0) || marketAddr == address(0)) revert NotArmed();
        address ot = IBinaryMarket(marketAddr).outcomeToken();
        IOutcomeToken6909(ot).setOperator(pool, true);
        IBinaryPool(pool).burnSet(amount);
        if (lastMintAmount >= amount) lastMintAmount -= amount;
        else lastMintAmount = 0;
        emit Burned(marketId, amount);
    }

    function syncResolution(bytes32 marketId) external {
        IBinaryMarket mkt = IBinaryMarket(_marketAddress(marketId));
        if (!mkt.isResolved() && !mkt.isVoided()) revert NotSettled();
        uint256[] memory nums = mkt.payoutNumerators();
        (uint256 qid, , , , , , , , , , , , , ) = module.markets(marketId);
        _applyResolution(qid, marketId, nums, mkt.isVoided(), false);
    }

    function redeemPosition(bytes32 marketId, uint8 outcomeIdx, uint256 amount) external nonReentrant {
        if (amount == 0) revert NothingToRedeem();
        _grantModuleOutcomeOperator(_marketAddress(marketId));
        module.redeem(0, bytes32(0), marketId, outcomeIdx, amount);
        emit Redeemed(marketId, outcomeIdx, amount);
    }

    function approveOutcomeOperator(address token, bool approved) external {
        if (msg.sender != owner && msg.sender != operator) revert NotOperator();
        IOutcomeToken6909(token).setOperator(address(module), approved);
    }

    function _onEvent(address emitter, bytes32[] calldata topics, bytes calldata data) internal override {
        if (emitter != oracleHub) revert UnexpectedEmitter(emitter);
        if (topics.length < 3) revert BadTopics();
        if (topics[0] != Verified.ANSWER_DELIVERED_TOPIC0) revert WrongTopic0();
        (, uint256[] memory nums, bool voided) = abi.decode(data, (uint32, uint256[], bool));
        bytes32 marketId = topics[2];
        uint256 questionId = uint256(topics[1]);
        _applyResolution(questionId, marketId, nums, voided, true);
    }

    function _applyResolution(
        uint256 questionId,
        bytes32 marketId,
        uint256[] memory nums,
        bool voided,
        bool fromCallback
    ) internal {
        bytes32 ck = keccak256(abi.encodePacked(marketId, questionId));
        if (consumed[ck]) return;
        if (armed.marketId != marketId || !armed.active) return;

        (uint256 modQ, , , , , , , , , , , , , ) = module.markets(marketId);
        if (modQ != questionId) return;

        consumed[ck] = true;
        uint256 committed = collateralCost(armed.kind, armed.price, armed.quantity);
        if (outstandingNotional >= committed) outstandingNotional -= committed;
        else outstandingNotional = 0;

        uint8 win = _winner(nums, voided);
        armed.active = false;
        if (!voided && win != type(uint8).max) {
            // BUY_YES / SELL_NO keep YES; BUY_NO / SELL_YES keep NO.
            bool boughtYes = armed.kind == 0 || armed.kind == 3;
            bool boughtNo = armed.kind == 2 || armed.kind == 1;
            bool lost = (boughtYes && win == 1) || (boughtNo && win == 0);
            if (lost) {
                _rollDay();
                uint256 lossNotional = committed;
                if (lossNotional == 0 && lastMintAmount > 0) lossNotional = lastMintAmount;
                lastMintAmount = 0;
                if (shieldCharges > 0) {
                    shieldCharges -= 1;
                    emit ShieldAbsorbed(marketId, shieldCharges);
                } else {
                    realizedLossToday += lossNotional;
                }
            }
        }
        emit LapSettled(marketId, questionId, voided, win, fromCallback);
    }

    function _winner(uint256[] memory nums, bool voided) internal pure returns (uint8) {
        if (voided || nums.length == 0) return type(uint8).max;
        uint8 w = 0;
        for (uint8 i = 1; i < nums.length; i++) {
            if (nums[i] > nums[w]) w = i;
        }
        return w;
    }

    function _marketAddress(bytes32 marketId) internal view returns (address) {
        (, , , , , , , , address marketAddr, , , , , ) = module.markets(marketId);
        if (marketAddr == address(0)) revert NotArmed();
        return marketAddr;
    }

    function _grantModuleOutcomeOperator(address marketAddr) internal {
        address ot = IBinaryMarket(marketAddr).outcomeToken();
        IOutcomeToken6909(ot).setOperator(address(module), true);
    }

    function _dayStart(uint256 ts) internal pure returns (uint256) {
        return ts - (ts % 1 days);
    }

    function _rollDay() internal {
        uint256 start = _dayStart(block.timestamp);
        if (start != dayStart) {
            dayStart = start;
            realizedLossToday = 0;
        }
    }
}
