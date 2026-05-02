// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RoadsideEscrow {
    enum Status { None, Funded, Completed, Refunded }

    struct Escrow {
        address customer;
        address technician;
        uint256 amount;
        Status status;
    }

    address public owner;
    mapping(bytes32 => Escrow) public escrows;

    event EscrowCreated(bytes32 indexed requestId, address indexed customer, address indexed technician, uint256 amount);
    event EscrowCompleted(bytes32 indexed requestId, address indexed technician, uint256 amount);
    event EscrowRefunded(bytes32 indexed requestId, address indexed customer, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createEscrow(bytes32 requestId, address technician) external payable {
        require(msg.value > 0, "No funds");
        require(technician != address(0), "Bad technician");
        require(escrows[requestId].status == Status.None, "Escrow exists");

        escrows[requestId] = Escrow({
            customer: msg.sender,
            technician: technician,
            amount: msg.value,
            status: Status.Funded
        });

        emit EscrowCreated(requestId, msg.sender, technician, msg.value);
    }

    function completeEscrow(bytes32 requestId) external onlyOwner {
        Escrow storage escrow = escrows[requestId];
        require(escrow.status == Status.Funded, "Not funded");

        escrow.status = Status.Completed;
        payable(escrow.technician).transfer(escrow.amount);

        emit EscrowCompleted(requestId, escrow.technician, escrow.amount);
    }

    function refundEscrow(bytes32 requestId) external onlyOwner {
        Escrow storage escrow = escrows[requestId];
        require(escrow.status == Status.Funded, "Not funded");

        escrow.status = Status.Refunded;
        payable(escrow.customer).transfer(escrow.amount);

        emit EscrowRefunded(requestId, escrow.customer, escrow.amount);
    }
}
