import { describe, it, expect, beforeEach } from "vitest";

// Mock Clarity contract interaction
class MockClarityContract {
  constructor() {
    this.wallets = new Map();
    this.nextWalletId = 1;
    this.blockHeight = 1000;
    this.balances = new Map(); // Track STX balances
  }

  // Simulate block height progression
  mineBlocks(count) {
    this.blockHeight += count;
  }

  // Helper to get current block height
  getCurrentHeight() {
    return this.blockHeight;
  }

  // Create wallet function
  createWallet(caller, beneficiary, unlockHeight) {
    const currentHeight = this.blockHeight;

    if (unlockHeight <= currentHeight) {
      return { type: "error", value: 104 }; // ERR-INVALID-UNLOCK-HEIGHT
    }

    const walletId = this.nextWalletId++;
    const wallet = {
      owner: caller,
      beneficiary: beneficiary,
      balance: 0,
      unlockHeight: unlockHeight,
      createdAt: currentHeight,
    };

    this.wallets.set(walletId, wallet);
    return { type: "ok", value: walletId };
  }

  // Get wallet function
  getWallet(walletId) {
    const wallet = this.wallets.get(walletId);
    return wallet ? { type: "some", value: wallet } : { type: "none" };
  }

  // Check if wallet is unlocked
  isUnlocked(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return false;
    return this.blockHeight >= wallet.unlockHeight;
  }

  // Deposit function
  deposit(caller, walletId, amount) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      return { type: "error", value: 103 }; // ERR-WALLET-NOT-EXISTS
    }

    if (caller !== wallet.owner) {
      return { type: "error", value: 100 }; // ERR-NOT-AUTHORIZED
    }

    // Simulate STX transfer
    const callerBalance = this.balances.get(caller) || 1000000000; // 1000 STX default
    if (callerBalance < amount) {
      return { type: "error", value: 1 }; // Insufficient funds
    }

    this.balances.set(caller, callerBalance - amount);
    wallet.balance += amount;
    return { type: "ok", value: amount };
  }

  // Withdraw function
  withdraw(caller, walletId, amount) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      return { type: "error", value: 103 }; // ERR-WALLET-NOT-EXISTS
    }

    if (caller !== wallet.beneficiary) {
      return { type: "error", value: 100 }; // ERR-NOT-AUTHORIZED
    }

    if (!this.isUnlocked(walletId)) {
      return { type: "error", value: 101 }; // ERR-FUNDS-LOCKED
    }

    if (wallet.balance < amount) {
      return { type: "error", value: 102 }; // ERR-INSUFFICIENT-BALANCE
    }

    wallet.balance -= amount;
    const beneficiaryBalance = this.balances.get(caller) || 0;
    this.balances.set(caller, beneficiaryBalance + amount);
    return { type: "ok", value: amount };
  }

  // Withdraw all function
  withdrawAll(caller, walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      return { type: "error", value: 103 }; // ERR-WALLET-NOT-EXISTS
    }

    if (caller !== wallet.beneficiary) {
      return { type: "error", value: 100 }; // ERR-NOT-AUTHORIZED
    }

    if (!this.isUnlocked(walletId)) {
      return { type: "error", value: 101 }; // ERR-FUNDS-LOCKED
    }

    const amount = wallet.balance;
    wallet.balance = 0;
    const beneficiaryBalance = this.balances.get(caller) || 0;
    this.balances.set(caller, beneficiaryBalance + amount);
    return { type: "ok", value: amount };
  }

  // Get next wallet ID
  getNextWalletId() {
    return this.nextWalletId;
  }
}

describe("Time-Locked Wallet Contract", () => {
  let contract;
  let owner;
  let beneficiary;
  let other;

  beforeEach(() => {
    contract = new MockClarityContract();
    owner = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";
    beneficiary = "SP2HJCPZ7GFXDJH9QQFZ6EZZJ7JZQNVZ7XWMQKJ8";
    other = "SP2ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
  });

  describe("Wallet Creation", () => {
    it("should create a new wallet with valid parameters", () => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);

      expect(result.type).toBe("ok");
      expect(result.value).toBe(1);

      const wallet = contract.getWallet(1);
      expect(wallet.type).toBe("some");
      expect(wallet.value.owner).toBe(owner);
      expect(wallet.value.beneficiary).toBe(beneficiary);
      expect(wallet.value.balance).toBe(0);
      expect(wallet.value.unlockHeight).toBe(unlockHeight);
    });

    it("should reject wallet creation with unlock height in the past", () => {
      const unlockHeight = contract.getCurrentHeight() - 10;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);

      expect(result.type).toBe("error");
      expect(result.value).toBe(104); // ERR-INVALID-UNLOCK-HEIGHT
    });

    it("should reject wallet creation with current block height", () => {
      const unlockHeight = contract.getCurrentHeight();
      const result = contract.createWallet(owner, beneficiary, unlockHeight);

      expect(result.type).toBe("error");
      expect(result.value).toBe(104); // ERR-INVALID-UNLOCK-HEIGHT
    });

    it("should increment wallet IDs correctly", () => {
      const unlockHeight = contract.getCurrentHeight() + 100;

      const result1 = contract.createWallet(owner, beneficiary, unlockHeight);
      const result2 = contract.createWallet(owner, beneficiary, unlockHeight);

      expect(result1.value).toBe(1);
      expect(result2.value).toBe(2);
      expect(contract.getNextWalletId()).toBe(3);
    });
  });

  describe("Deposits", () => {
    let walletId;

    beforeEach(() => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      walletId = result.value;
    });

    it("should allow owner to deposit funds", () => {
      const amount = 500000000; // 500 STX
      const result = contract.deposit(owner, walletId, amount);

      expect(result.type).toBe("ok");
      expect(result.value).toBe(amount);

      const wallet = contract.getWallet(walletId);
      expect(wallet.value.balance).toBe(amount);
    });

    it("should reject deposits from non-owners", () => {
      const amount = 500000000;
      const result = contract.deposit(beneficiary, walletId, amount);

      expect(result.type).toBe("error");
      expect(result.value).toBe(100); // ERR-NOT-AUTHORIZED
    });

    it("should reject deposits to non-existent wallets", () => {
      const amount = 500000000;
      const result = contract.deposit(owner, 999, amount);

      expect(result.type).toBe("error");
      expect(result.value).toBe(103); // ERR-WALLET-NOT-EXISTS
    });

    it("should accumulate multiple deposits", () => {
      const amount1 = 300000000;
      const amount2 = 200000000;

      contract.deposit(owner, walletId, amount1);
      contract.deposit(owner, walletId, amount2);

      const wallet = contract.getWallet(walletId);
      expect(wallet.value.balance).toBe(amount1 + amount2);
    });
  });

  describe("Lock Status", () => {
    let walletId;

    beforeEach(() => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      walletId = result.value;
    });

    it("should return false for locked wallets", () => {
      expect(contract.isUnlocked(walletId)).toBe(false);
    });

    it("should return true after unlock height is reached", () => {
      contract.mineBlocks(100);
      expect(contract.isUnlocked(walletId)).toBe(true);
    });

    it("should return false for non-existent wallets", () => {
      expect(contract.isUnlocked(999)).toBe(false);
    });
  });

  describe("Withdrawals", () => {
    let walletId;
    const depositAmount = 1000000000; // 1000 STX

    beforeEach(() => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      walletId = result.value;
      contract.deposit(owner, walletId, depositAmount);
    });

    it("should reject withdrawals before unlock height", () => {
      const result = contract.withdraw(beneficiary, walletId, 500000000);

      expect(result.type).toBe("error");
      expect(result.value).toBe(101); // ERR-FUNDS-LOCKED
    });

    it("should allow withdrawals after unlock height", () => {
      contract.mineBlocks(100);
      const withdrawAmount = 500000000;
      const result = contract.withdraw(beneficiary, walletId, withdrawAmount);

      expect(result.type).toBe("ok");
      expect(result.value).toBe(withdrawAmount);

      const wallet = contract.getWallet(walletId);
      expect(wallet.value.balance).toBe(depositAmount - withdrawAmount);
    });

    it("should reject withdrawals from non-beneficiaries", () => {
      contract.mineBlocks(100);
      const result = contract.withdraw(owner, walletId, 500000000);

      expect(result.type).toBe("error");
      expect(result.value).toBe(100); // ERR-NOT-AUTHORIZED
    });

    it("should reject withdrawals exceeding balance", () => {
      contract.mineBlocks(100);
      const result = contract.withdraw(
        beneficiary,
        walletId,
        depositAmount + 1
      );

      expect(result.type).toBe("error");
      expect(result.value).toBe(102); // ERR-INSUFFICIENT-BALANCE
    });

    it("should reject withdrawals from non-existent wallets", () => {
      const result = contract.withdraw(beneficiary, 999, 500000000);

      expect(result.type).toBe("error");
      expect(result.value).toBe(103); // ERR-WALLET-NOT-EXISTS
    });
  });

  describe("Withdraw All", () => {
    let walletId;
    const depositAmount = 1000000000; // 1000 STX

    beforeEach(() => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      walletId = result.value;
      contract.deposit(owner, walletId, depositAmount);
    });

    it("should withdraw all funds when unlocked", () => {
      contract.mineBlocks(100);
      const result = contract.withdrawAll(beneficiary, walletId);

      expect(result.type).toBe("ok");
      expect(result.value).toBe(depositAmount);

      const wallet = contract.getWallet(walletId);
      expect(wallet.value.balance).toBe(0);
    });

    it("should reject withdraw all before unlock height", () => {
      const result = contract.withdrawAll(beneficiary, walletId);

      expect(result.type).toBe("error");
      expect(result.value).toBe(101); // ERR-FUNDS-LOCKED
    });

    it("should reject withdraw all from non-beneficiaries", () => {
      contract.mineBlocks(100);
      const result = contract.withdrawAll(owner, walletId);

      expect(result.type).toBe("error");
      expect(result.value).toBe(100); // ERR-NOT-AUTHORIZED
    });
  });

  describe("Multiple Wallets", () => {
    it("should handle multiple wallets independently", () => {
      const unlockHeight1 = contract.getCurrentHeight() + 50;
      const unlockHeight2 = contract.getCurrentHeight() + 150;

      const wallet1 = contract.createWallet(owner, beneficiary, unlockHeight1);
      const wallet2 = contract.createWallet(owner, beneficiary, unlockHeight2);

      contract.deposit(owner, wallet1.value, 500000000);
      contract.deposit(owner, wallet2.value, 800000000);

      // After 50 blocks, only wallet1 should be unlocked
      contract.mineBlocks(50);
      expect(contract.isUnlocked(wallet1.value)).toBe(true);
      expect(contract.isUnlocked(wallet2.value)).toBe(false);

      // After 150 blocks total, both should be unlocked
      contract.mineBlocks(100);
      expect(contract.isUnlocked(wallet1.value)).toBe(true);
      expect(contract.isUnlocked(wallet2.value)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero amount deposits", () => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      const walletId = result.value;

      const depositResult = contract.deposit(owner, walletId, 0);
      expect(depositResult.type).toBe("ok");
      expect(depositResult.value).toBe(0);
    });

    it("should handle zero amount withdrawals", () => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      const walletId = result.value;

      contract.deposit(owner, walletId, 1000000000);
      contract.mineBlocks(100);

      const withdrawResult = contract.withdraw(beneficiary, walletId, 0);
      expect(withdrawResult.type).toBe("ok");
      expect(withdrawResult.value).toBe(0);
    });

    it("should handle empty wallet withdraw all", () => {
      const unlockHeight = contract.getCurrentHeight() + 100;
      const result = contract.createWallet(owner, beneficiary, unlockHeight);
      const walletId = result.value;

      contract.mineBlocks(100);

      const withdrawResult = contract.withdrawAll(beneficiary, walletId);
      expect(withdrawResult.type).toBe("ok");
      expect(withdrawResult.value).toBe(0);
    });
  });
});
