// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/core/TapThatXRegistry.sol";
import "../contracts/core/TapThatXProtocol.sol";
import "../contracts/core/TapThatXAuth.sol";
import "../contracts/examples/USDCTapPayment.sol";
import "../contracts/MockUSDC.sol";

contract TapThatXTest is Test {
    TapThatXRegistry public registry;
    TapThatXProtocol public protocol;
    MockUSDC public usdc;
    USDCTapPayment public usdcPayment;

    // Test accounts
    address public owner = vm.addr(1);
    address public merchant = vm.addr(2);
    uint256 public chipPrivateKey = 0x1234;
    address public chipAddress = vm.addr(chipPrivateKey);

    function setUp() public {
        // Deploy contracts
        registry = new TapThatXRegistry();
        protocol = new TapThatXProtocol(address(registry));
        usdc = new MockUSDC();
        usdcPayment = new USDCTapPayment(address(usdc), address(protocol), address(registry));

        // Fund test accounts
        usdc.transfer(owner, 10000 * 10 ** 6); // 10k USDC
        vm.deal(owner, 10 ether);
    }

    /// @notice Test chip registration
    function testRegisterChip() public {
        // Create registration signature
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("ChipRegistration(address owner,address chipAddress)"),
                owner,
                chipAddress
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Register chip
        vm.prank(owner);
        registry.registerChip(chipAddress, signature);

        // Verify registration
        assertEq(registry.getOwner(chipAddress), owner);
        assertTrue(registry.isChipRegistered(chipAddress));
    }

    /// @notice Test chip can be re-registered (for hackathon flexibility)
    function testCanReregisterChip() public {
        // Register chip first time
        testRegisterChip();

        // Register again with different owner
        address newOwner = vm.addr(2);

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("ChipRegistration(address owner,address chipAddress)"),
                newOwner,
                chipAddress
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(newOwner);
        registry.registerChip(chipAddress, signature);

        // Verify new ownership
        assertEq(registry.getOwner(chipAddress), newOwner);
    }

    /// @notice Test generic protocol execution
    function testExecuteAuthorizedCall() public {
        // Register chip
        testRegisterChip();

        // Approve USDC to protocol
        vm.prank(owner);
        usdc.approve(address(protocol), 1000 * 10 ** 6);

        // Create USDC transfer call data
        bytes memory callData = abi.encodeWithSelector(
            usdc.transferFrom.selector,
            owner,
            merchant,
            100 * 10 ** 6 // 100 USDC
        );

        // Create chip authorization
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, owner, merchant));
        uint256 timestamp = block.timestamp;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
                ),
                owner,
                address(usdc),
                keccak256(callData),
                0,
                timestamp,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", protocol.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory chipSignature = abi.encodePacked(r, s, v);

        // Execute via protocol
        uint256 merchantBalanceBefore = usdc.balanceOf(merchant);

        protocol.executeAuthorizedCall(owner, address(usdc), callData, 0, chipSignature, timestamp, nonce);

        // Verify transfer succeeded
        assertEq(usdc.balanceOf(merchant), merchantBalanceBefore + 100 * 10 ** 6);
    }

    /// @notice Test cannot replay same nonce
    function testCannotReplayNonce() public {
        // Execute first call
        testExecuteAuthorizedCall();

        // Try to replay with same nonce
        bytes memory callData = abi.encodeWithSelector(
            usdc.transferFrom.selector,
            owner,
            merchant,
            100 * 10 ** 6
        );
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, owner, merchant));
        uint256 timestamp = block.timestamp;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
                ),
                owner,
                address(usdc),
                keccak256(callData),
                0,
                timestamp,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", protocol.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory chipSignature = abi.encodePacked(r, s, v);

        vm.expectRevert("Nonce already used");
        protocol.executeAuthorizedCall(owner, address(usdc), callData, 0, chipSignature, timestamp, nonce);
    }

    /// @notice Test expired timestamp is rejected
    function testExpiredTimestamp() public {
        testRegisterChip();

        // Warp time forward to ensure we have enough room for subtraction
        vm.warp(1000);

        vm.prank(owner);
        usdc.approve(address(protocol), 1000 * 10 ** 6);

        bytes memory callData = abi.encodeWithSelector(
            usdc.transferFrom.selector,
            owner,
            merchant,
            100 * 10 ** 6
        );

        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, owner, merchant));
        uint256 timestamp = block.timestamp - 301; // 301 seconds ago (expired)

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
                ),
                owner,
                address(usdc),
                keccak256(callData),
                0,
                timestamp,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", protocol.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory chipSignature = abi.encodePacked(r, s, v);

        vm.expectRevert("Authorization expired");
        protocol.executeAuthorizedCall(owner, address(usdc), callData, 0, chipSignature, timestamp, nonce);
    }

    /// @notice Test unregistered chip is rejected
    function testUnregisteredChipRejected() public {
        // Don't register chip
        vm.prank(owner);
        usdc.approve(address(protocol), 1000 * 10 ** 6);

        bytes memory callData = abi.encodeWithSelector(
            usdc.transferFrom.selector,
            owner,
            merchant,
            100 * 10 ** 6
        );

        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, owner, merchant));
        uint256 timestamp = block.timestamp;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
                ),
                owner,
                address(usdc),
                keccak256(callData),
                0,
                timestamp,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", protocol.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory chipSignature = abi.encodePacked(r, s, v);

        vm.expectRevert("Chip not registered");
        protocol.executeAuthorizedCall(owner, address(usdc), callData, 0, chipSignature, timestamp, nonce);
    }

    /// @notice Test USDC payment example with allowance
    function testUSDCTapPayment() public {
        // Register chip
        testRegisterChip();

        // Approve USDC to protocol (note: protocol, not usdcPayment)
        vm.prank(owner);
        usdc.approve(address(protocol), 1000 * 10 ** 6);

        // Create payment authorization (sends to USDCTapPayment contract)
        bytes memory transferCallData = abi.encodeWithSelector(
            usdc.transferFrom.selector,
            owner,
            address(usdcPayment), // Contract receives USDC
            100 * 10 ** 6
        );

        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, "payment"));
        uint256 timestamp = block.timestamp;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
                ),
                owner,
                address(usdc),
                keccak256(transferCallData),
                0,
                timestamp,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", protocol.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(chipPrivateKey, digest);
        bytes memory chipSignature = abi.encodePacked(r, s, v);

        // Execute payment via example contract
        uint256 contractBalanceBefore = usdc.balanceOf(address(usdcPayment));

        usdcPayment.tapToPay(owner, merchant, 100 * 10 ** 6, chipSignature, timestamp, nonce);

        // Verify payment went to contract (not merchant)
        assertEq(usdc.balanceOf(address(usdcPayment)), contractBalanceBefore + 100 * 10 ** 6);
    }
}
