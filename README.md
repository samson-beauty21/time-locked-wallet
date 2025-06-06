# Time-Locked Wallet

A Clarity smart contract that implements a time-locked wallet system, restricting access to funds until a specific block height is reached. Perfect for trust funds, delayed payments, vesting schedules, and other time-based financial arrangements.

## Features

- **Time-based Restrictions**: Funds are locked until a specified block height
- **Multi-wallet Support**: Create multiple independent time-locked wallets
- **Owner/Beneficiary Model**: Separate roles for depositing and withdrawing funds
- **Flexible Withdrawals**: Support for partial and full withdrawals
- **Real-time Status**: Check lock status and wallet details at any time

## Contract Functions

### Read-Only Functions

#### `get-wallet(wallet-id)`

Returns wallet details including owner, beneficiary, balance, unlock height, and creation time.

#### `is-unlocked(wallet-id)`

Checks if a wallet is currently unlocked based on current block height.

#### `get-current-height()`

Returns the current block height.

#### `get-next-wallet-id()`

Returns the ID that will be assigned to the next created wallet.

### Public Functions

#### `create-wallet(beneficiary, unlock-height)`

Creates a new time-locked wallet.

- **beneficiary**: Principal who can withdraw funds when unlocked
- **unlock-height**: Block height when funds become available
- **Returns**: Wallet ID

#### `deposit(wallet-id, amount)`

Deposits STX into a specific wallet. Only the wallet owner can deposit.

- **wallet-id**: Target wallet identifier
- **amount**: Amount of STX to deposit (in microSTX)

#### `withdraw(wallet-id, amount)`

Withdraws a specific amount from an unlocked wallet. Only the beneficiary can withdraw.

- **wallet-id**: Source wallet identifier
- **amount**: Amount of STX to withdraw (in microSTX)

#### `withdraw-all(wallet-id)`

Withdraws all available funds from an unlocked wallet. Only the beneficiary can withdraw.

- **wallet-id**: Source wallet identifier

## Usage Examples

### Creating a Trust Fund

```clarity
;; Create a wallet that unlocks in 1000 blocks (~1 week)
(contract-call? .timelock-wallet create-wallet 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7 (+ block-height u1000))
```

### Depositing Funds

```clarity
;; Deposit 1000 STX into wallet ID 1
(contract-call? .timelock-wallet deposit u1 u1000000000)
```

### Checking Status

```clarity
;; Check if wallet 1 is unlocked
(contract-call? .timelock-wallet is-unlocked u1)

;; Get wallet details
(contract-call? .timelock-wallet get-wallet u1)
```

### Withdrawing Funds

```clarity
;; Withdraw 500 STX from wallet 1 (only after unlock height)
(contract-call? .timelock-wallet withdraw u1 u500000000)

;; Withdraw all remaining funds
(contract-call? .timelock-wallet withdraw-all u1)
```

## Error Codes

- `u100`: Not authorized (wrong principal for operation)
- `u101`: Funds are still locked (unlock height not reached)
- `u102`: Insufficient balance in wallet
- `u103`: Wallet does not exist
- `u104`: Invalid unlock height (must be in the future)

## Use Cases

1. **Trust Funds**: Lock funds for minors until they reach a certain age
2. **Vesting Schedules**: Employee compensation that unlocks over time
3. **Delayed Payments**: Business payments with built-in delay periods
4. **Savings Goals**: Personal savings that can't be accessed early
5. **Estate Planning**: Timed distribution of assets

## Security Considerations

- The contract owner and beneficiary are separate roles - ensure you understand who can perform which actions
- Unlock heights are based on block heights, not timestamps - plan accordingly
- Once created, unlock heights cannot be modified
- Only the beneficiary can withdraw funds, even if the owner deposited them

## Development

### Building

The contract is written in Clarity and can be deployed to any Stacks blockchain network.

### Testing

Run the included Vitest test suite to verify contract functionality:

```bash
npm test
```

## License

MIT License - feel free to use this contract in your own projects.
