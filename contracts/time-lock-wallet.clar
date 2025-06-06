;; Time-Locked Wallet Contract
;; A wallet that restricts access to funds until a specific block height or timestamp

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-FUNDS-LOCKED (err u101))
(define-constant ERR-INSUFFICIENT-BALANCE (err u102))
(define-constant ERR-WALLET-NOT-EXISTS (err u103))
(define-constant ERR-INVALID-UNLOCK-HEIGHT (err u104))

;; Data structures
(define-map wallets 
  { wallet-id: uint }
  {
    owner: principal,
    beneficiary: principal,
    balance: uint,
    unlock-height: uint,
    created-at: uint
  }
)

(define-data-var next-wallet-id uint u1)

;; Read-only functions
(define-read-only (get-wallet (wallet-id uint))
  (map-get? wallets { wallet-id: wallet-id })
)

(define-read-only (get-current-height)
  burn-block-height
)

(define-read-only (is-unlocked (wallet-id uint))
  (match (get-wallet wallet-id)
    wallet-data (>= burn-block-height (get unlock-height wallet-data))
    false
  )
)

(define-read-only (get-next-wallet-id)
  (var-get next-wallet-id)
)

;; Public functions
(define-public (create-wallet (beneficiary principal) (unlock-height uint))
  (let
    (
      (wallet-id (var-get next-wallet-id))
      (current-height burn-block-height)
    )
    ;; Validate unlock height is in the future
    (asserts! (> unlock-height current-height) ERR-INVALID-UNLOCK-HEIGHT)
    
    ;; Create the wallet
    (map-set wallets
      { wallet-id: wallet-id }
      {
        owner: tx-sender,
        beneficiary: beneficiary,
        balance: u0,
        unlock-height: unlock-height,
        created-at: current-height
      }
    )
    
    ;; Increment wallet ID for next wallet
    (var-set next-wallet-id (+ wallet-id u1))
    
    (ok wallet-id)
  )
)

(define-public (deposit (wallet-id uint) (amount uint))
  (let
    (
      (wallet-data (unwrap! (get-wallet wallet-id) ERR-WALLET-NOT-EXISTS))
      (current-balance (get balance wallet-data))
    )
    ;; Only owner can deposit
    (asserts! (is-eq tx-sender (get owner wallet-data)) ERR-NOT-AUTHORIZED)
    
    ;; Transfer STX from sender to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    ;; Update wallet balance
    (map-set wallets
      { wallet-id: wallet-id }
      (merge wallet-data { balance: (+ current-balance amount) })
    )
    
    (ok amount)
  )
)

(define-public (withdraw (wallet-id uint) (amount uint))
  (let
    (
      (wallet-data (unwrap! (get-wallet wallet-id) ERR-WALLET-NOT-EXISTS))
      (current-balance (get balance wallet-data))
    )
    ;; Only beneficiary can withdraw
    (asserts! (is-eq tx-sender (get beneficiary wallet-data)) ERR-NOT-AUTHORIZED)
    
    ;; Check if funds are unlocked
    (asserts! (is-unlocked wallet-id) ERR-FUNDS-LOCKED)
    
    ;; Check sufficient balance
    (asserts! (>= current-balance amount) ERR-INSUFFICIENT-BALANCE)
    
    ;; Transfer STX from contract to beneficiary
    (try! (as-contract (stx-transfer? amount tx-sender (get beneficiary wallet-data))))
    
    ;; Update wallet balance
    (map-set wallets
      { wallet-id: wallet-id }
      (merge wallet-data { balance: (- current-balance amount) })
    )
    
    (ok amount)
  )
)

(define-public (withdraw-all (wallet-id uint))
  (let
    (
      (wallet-data (unwrap! (get-wallet wallet-id) ERR-WALLET-NOT-EXISTS))
      (current-balance (get balance wallet-data))
    )
    ;; Only beneficiary can withdraw
    (asserts! (is-eq tx-sender (get beneficiary wallet-data)) ERR-NOT-AUTHORIZED)
    
    ;; Check if funds are unlocked
    (asserts! (is-unlocked wallet-id) ERR-FUNDS-LOCKED)
    
    ;; Transfer all STX from contract to beneficiary
    (try! (as-contract (stx-transfer? current-balance tx-sender (get beneficiary wallet-data))))
    
    ;; Update wallet balance to zero
    (map-set wallets
      { wallet-id: wallet-id }
      (merge wallet-data { balance: u0 })
    )
    
    (ok current-balance)
  )
)