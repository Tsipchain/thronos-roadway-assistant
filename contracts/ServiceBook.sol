// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ServiceBook {
    address public owner;

    struct ServiceRecord {
        bytes32 requestId;
        bytes32 vehicleHash;
        uint8 serviceType;
        string metadataUri;
        uint256 createdAt;
    }

    mapping(bytes32 => ServiceRecord) public records;

    event ServiceRecorded(bytes32 indexed requestId, bytes32 indexed vehicleHash, uint8 serviceType, string metadataUri);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordService(
        bytes32 requestId,
        bytes32 vehicleHash,
        uint8 serviceType,
        string calldata metadataUri
    ) external onlyOwner {
        require(records[requestId].createdAt == 0, "Record exists");

        records[requestId] = ServiceRecord({
            requestId: requestId,
            vehicleHash: vehicleHash,
            serviceType: serviceType,
            metadataUri: metadataUri,
            createdAt: block.timestamp
        });

        emit ServiceRecorded(requestId, vehicleHash, serviceType, metadataUri);
    }
}
