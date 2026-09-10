// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract MockModule {
    mapping(bytes32 => uint256) public qid;
    mapping(bytes32 => address) public poolOf;
    mapping(bytes32 => address) public marketOf;
    mapping(bytes32 => address) public colOf;
    mapping(bytes32 => uint64) public nonceOf;
    uint256 public redeemCalls;

    function set(bytes32 m, uint256 q, address pool, address market, address col, uint64 nonce) external {
        qid[m] = q;
        poolOf[m] = pool;
        marketOf[m] = market;
        colOf[m] = col;
        nonceOf[m] = nonce;
    }

    function markets(bytes32 m)
        external
        view
        returns (
            uint256,
            uint8,
            uint8,
            address,
            uint32,
            bytes32,
            address,
            address,
            address,
            address,
            uint256,
            uint256,
            uint64,
            uint64
        )
    {
        return (qid[m], 2, 0, colOf[m], 0, bytes32(0), address(0), address(0), marketOf[m], poolOf[m], 0, 0, 0, 0);
    }

    function marketNonce(bytes32 m) external view returns (uint64) {
        return nonceOf[m];
    }

    function redeem(uint32, bytes32, bytes32, uint8, uint256) external {
        redeemCalls++;
    }
}

contract MockPool {
    uint256 public calls;
    bool public accept = true;
    bool public revertPlace;
    uint8 public lastKind;
    uint256 public lastPrice;
    uint256 public lastQty;
    uint128 public lastCancel;

    function setAccept(bool v) external {
        accept = v;
    }

    function setRevertPlace(bool v) external {
        revertPlace = v;
    }

    function placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64, uint8, uint8, address, uint96, uint64)
        external
        payable
        returns (bool, uint128)
    {
        if (revertPlace) revert("QuantityBelowMinimum");
        calls++;
        lastKind = kind;
        lastPrice = price;
        lastQty = quantity;
        return (accept, uint128(calls));
    }

    function cancelOrder(uint128 orderId) external {
        lastCancel = orderId;
    }

    uint256 public minted;
    uint256 public burned;

    function mintSet(address, address, uint256 amount) external {
        minted += amount;
    }

    function burnSet(uint256 amount) external {
        burned += amount;
    }
}

contract MockMarket {
    bool public resolved;
    bool public voided;
    uint256[] public nums;
    address public ot;

    function setOutcomeToken(address a) external {
        ot = a;
    }

    function set(bool resolved_, bool voided_, uint256 n0, uint256 n1) external {
        resolved = resolved_;
        voided = voided_;
        delete nums;
        nums.push(n0);
        nums.push(n1);
    }

    function isResolved() external view returns (bool) {
        return resolved;
    }

    function isVoided() external view returns (bool) {
        return voided;
    }

    function payoutNumerators() external view returns (uint256[] memory) {
        return nums;
    }

    function status() external view returns (uint8) {
        if (voided) return 5;
        if (resolved) return 4;
        return 1;
    }

    function expiry() external view returns (uint64) {
        return 0;
    }

    function outcomeToken() external view returns (address) {
        return ot;
    }
}

contract Mock6909 {
    mapping(address => mapping(address => bool)) public isOperator;

    function setOperator(address spender, bool approved) external returns (bool) {
        isOperator[msg.sender][spender] = approved;
        return true;
    }

    function balanceOf(address, uint256) external pure returns (uint256) {
        return 0;
    }
}

contract MockERC20 {
    string public name = "tUSDC";
    string public symbol = "tUSDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        if (from != msg.sender) {
            uint256 a = allowance[from][msg.sender];
            require(a >= amount, "allow");
            allowance[from][msg.sender] = a - amount;
        }
        require(balanceOf[from] >= amount, "bal");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
