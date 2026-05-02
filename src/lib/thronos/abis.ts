export const ROADSIDE_ESCROW_ABI = [
  "function createEscrow(bytes32 requestId,address technician) external payable",
  "function completeEscrow(bytes32 requestId) external",
  "function refundEscrow(bytes32 requestId) external",
  "function escrows(bytes32 requestId) external view returns (address customer,address technician,uint256 amount,uint8 status)",
  "event EscrowCreated(bytes32 indexed requestId,address indexed customer,address indexed technician,uint256 amount)",
  "event EscrowCompleted(bytes32 indexed requestId,address indexed technician,uint256 amount)",
  "event EscrowRefunded(bytes32 indexed requestId,address indexed customer,uint256 amount)",
] as const;

export const SERVICE_BOOK_ABI = [
  "function recordService(bytes32 requestId,bytes32 vehicleHash,uint8 serviceType,string calldata metadataUri) external",
  "function records(bytes32 requestId) external view returns (bytes32 requestId,bytes32 vehicleHash,uint8 serviceType,string metadataUri,uint256 createdAt)",
  "event ServiceRecorded(bytes32 indexed requestId,bytes32 indexed vehicleHash,uint8 serviceType,string metadataUri)",
] as const;

export const REWARD_VAULT_ABI = [
  "function reward(address to,uint256 amount,string calldata reason) external",
  "event Rewarded(address indexed to,uint256 amount,string reason)",
] as const;
