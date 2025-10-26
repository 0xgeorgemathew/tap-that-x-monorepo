// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/core/TapThatXRegistry.sol";
import "../contracts/core/TapThatXProtocol.sol";
import "../contracts/extensions/TapThatXPaymentTerminal.sol";
import "../contracts/MockUSDC.sol";

contract TapThatXPaymentTerminalTest is Test {
    TapThatXRegistry public registry;
    TapThatXProtocol public protocol;
    TapThatXPaymentTerminal public terminal;
    MockUSDC public pyusd;

    // Test accounts
    address public merchant = vm.addr(1);
    address public customer = vm.addr(2);

    // Chip private keys and addresses
    uint256 public merchantChipPrivateKey = 0x1111;
    address public merchantChip = vm.addr(merchantChipPrivateKey);

    uint256 public customerChipPrivateKey = 0x2222;
    address public customerChip = vm.addr(customerChipPrivateKey);

    function setUp() public {
        // Deploy contracts
        registry = new TapThatXRegistry();
        protocol = new TapThatXProtocol(address(registry));
        terminal = new TapThatXPaymentTerminal(address(registry), address(protocol));
        pyusd = new MockUSDC();

        // Register merchant chip
        bytes32 structHash1 = keccak256(
            abi.encode(
                keccak256("ChipRegistration(address owner,address chipAddress)"),
                merchant,
                merchantChip
            )
        );
        bytes32 digest1 = keccak256(
            abi.encodePacked("\x19\x01", registry.getChainAgnosticDomainSeparator(), structHash1)
        );
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(merchantChipPrivateKey, digest1);
        bytes memory sig1 = abi.encodePacked(r1, s1, v1);

        vm.prank(merchant);
        registry.registerChip(merchantChip, sig1);

        // Register customer chip
        bytes32 structHash2 = keccak256(
            abi.encode(
                keccak256("ChipRegistration(address owner,address chipAddress)"),
                customer,
                customerChip
            )
        );
        bytes32 digest2 = keccak256(
            abi.encodePacked("\x19\x01", registry.getChainAgnosticDomainSeparator(), structHash2)
        );
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(customerChipPrivateKey, digest2);
        bytes memory sig2 = abi.encodePacked(r2, s2, v2);

        vm.prank(customer);
        registry.registerChip(customerChip, sig2);

        // Fund customer with PYUSD
        pyusd.transfer(customer, 10000 * 10 ** 6); // 10k PYUSD

        // Customer approves terminal to spend PYUSD
        vm.prank(customer);
        pyusd.approve(address(terminal), type(uint256).max);
    }

    /// @notice Helper to register chip
    function _registerChip(address owner, address chip, uint256 chipPk) internal {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("ChipRegistration(address owner,address chipAddress)"),
                owner,
                chip
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", registry.getChainAgnosticDomainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPk, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        registry.registerChip(chip, signature);
    }

    /// @notice Helper to create payment authorization signature
    function _createPaymentSignature(
        address payer,
        address payerChip,
        address payee,
        address payeeChip,
        address token,
        uint256 amount,
        uint256 timestamp,
        bytes32 nonce,
        uint256 chipPk
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "PaymentAuthorization(address payer,address payerChip,address payee,address payeeChip,address token,uint256 amount,uint256 timestamp,bytes32 nonce)"
                ),
                payer,
                payerChip,
                payee,
                payeeChip,
                token,
                amount,
                timestamp,
                nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", terminal.getChainAgnosticDomainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @notice Test successful payment execution
    function testExecutePayment() public {
        uint256 amount = 100 * 10 ** 6; // 100 PYUSD
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce1"));
        uint256 timestamp = block.timestamp;

        // Create payment authorization
        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            customerChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            customerChipPrivateKey
        );

        // Check balances before
        uint256 merchantBalanceBefore = pyusd.balanceOf(merchant);
        uint256 customerBalanceBefore = pyusd.balanceOf(customer);

        // Execute payment
        terminal.executePayment(auth, signature);

        // Verify balances after
        assertEq(pyusd.balanceOf(merchant), merchantBalanceBefore + amount);
        assertEq(pyusd.balanceOf(customer), customerBalanceBefore - amount);

        // Verify nonce is used
        assertTrue(terminal.usedNonces(nonce));
    }

    /// @notice Test cannot replay same nonce
    function testCannotReplayNonce() public {
        // Execute first payment
        testExecutePayment();

        uint256 amount = 100 * 10 ** 6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce1")); // Same nonce
        uint256 timestamp = block.timestamp;

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            customerChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            customerChipPrivateKey
        );

        // Should revert with "Nonce already used"
        vm.expectRevert("Nonce already used");
        terminal.executePayment(auth, signature);
    }

    /// @notice Test expired timestamp rejection
    function testCannotUseExpiredTimestamp() public {
        // Warp forward to avoid underflow
        vm.warp(block.timestamp + 1000);

        uint256 amount = 100 * 10 ** 6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce2"));
        uint256 timestamp = block.timestamp - 400; // 400 seconds ago (expired, window is 300s)

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            customerChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            customerChipPrivateKey
        );

        // Should revert with "Authorization expired"
        vm.expectRevert("Authorization expired");
        terminal.executePayment(auth, signature);
    }

    /// @notice Test invalid payer chip signature
    function testRejectInvalidPayerSignature() public {
        uint256 amount = 100 * 10 ** 6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce3"));
        uint256 timestamp = block.timestamp;

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        // Sign with wrong key (merchant chip instead of customer chip)
        bytes memory wrongSignature = _createPaymentSignature(
            customer,
            customerChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            merchantChipPrivateKey // Wrong key!
        );

        // Should revert with "Invalid payer signature"
        vm.expectRevert("Invalid payer signature");
        terminal.executePayment(auth, wrongSignature);
    }

    /// @notice Test unregistered payer chip rejection
    function testRejectUnregisteredPayerChip() public {
        // Create new unregistered chip
        uint256 unregisteredChipPk = 0x9999;
        address unregisteredChip = vm.addr(unregisteredChipPk);

        uint256 amount = 100 * 10 ** 6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce4"));
        uint256 timestamp = block.timestamp;

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: unregisteredChip, // Unregistered chip
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            unregisteredChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            unregisteredChipPk
        );

        // Should revert with "Payer does not own chip"
        vm.expectRevert("Payer does not own chip");
        terminal.executePayment(auth, signature);
    }

    /// @notice Test unregistered payee chip rejection
    function testRejectUnregisteredPayeeChip() public {
        // Create new unregistered merchant
        address newMerchant = vm.addr(5);
        uint256 unregisteredMerchantChipPk = 0x5555;
        address unregisteredMerchantChip = vm.addr(unregisteredMerchantChipPk);

        uint256 amount = 100 * 10 ** 6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce5"));
        uint256 timestamp = block.timestamp;

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: newMerchant,
            payeeChip: unregisteredMerchantChip, // Unregistered chip
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            customerChip,
            newMerchant,
            unregisteredMerchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            customerChipPrivateKey
        );

        // Should revert with "Payee does not own chip"
        vm.expectRevert("Payee does not own chip");
        terminal.executePayment(auth, signature);
    }

    /// @notice Test zero amount rejection
    function testRejectZeroAmount() public {
        uint256 amount = 0; // Zero amount
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce6"));
        uint256 timestamp = block.timestamp;

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            customerChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            customerChipPrivateKey
        );

        // Should revert with "Amount must be greater than 0"
        vm.expectRevert("Amount must be greater than 0");
        terminal.executePayment(auth, signature);
    }

    /// @notice Test verify payment auth function
    function testVerifyPaymentAuth() public {
        uint256 amount = 100 * 10 ** 6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "nonce7"));
        uint256 timestamp = block.timestamp;

        TapThatXPaymentTerminal.PaymentAuthorization memory auth = TapThatXPaymentTerminal
            .PaymentAuthorization({
            payer: customer,
            payerChip: customerChip,
            payee: merchant,
            payeeChip: merchantChip,
            token: address(pyusd),
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        bytes memory signature = _createPaymentSignature(
            customer,
            customerChip,
            merchant,
            merchantChip,
            address(pyusd),
            amount,
            timestamp,
            nonce,
            customerChipPrivateKey
        );

        // Verify signature recovery
        address recovered = terminal.verifyPaymentAuth(auth, signature);
        assertEq(recovered, customerChip);
    }
}
