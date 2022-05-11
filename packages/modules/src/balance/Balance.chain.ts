/**
 * Balance provides the accounts and balances of the CORD protocol.
 *
 *  * Checking Balances between accounts
 *  * Transfer of assets between accounts.
 *
 * @packageDocumentation
 * @module Balance
 */

import type { UnsubscribePromise } from '@polkadot/api/types'
import { BN } from '@polkadot/util'
import type {
  Balances,
  IPublicIdentity,
  SubmittableExtrinsic,
} from '@cord.network/api-types'
import { ChainApiConnection } from '@cord.network/network'

import BalanceUtils from './Balance.utils.js'

/**
 * Fetches the current balances of the account with [accountAddress].
 * <B>Note that the balance amounts are in Femto-Cord (1e-15)and must be translated to Cord-Coin</B>.
 *
 * @param accountAddress Address of the account for which to get the balances.
 * @returns A promise containing the current balances of the account.
 *
 * @example
 * <BR>
 *
 * ```javascript
 *
 * const address = ...
 * sdk.Balance.getBalances(address)
 *   .then((balanceData: AccountData) => {
 *     console.log(`free balances is ${balanceData.free.toNumber()}`)
 *   })
 * ```
 */
export async function getBalances(
  accountAddress: IPublicIdentity['address']
): Promise<Balances> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()

  return (await blockchain.api.query.system.account(accountAddress)).data
}

/**
 * Attaches the given [listener] for balance changes on the account with [accountAddress].
 * <B>Note that the balance amounts are in Femto-Cord (1e-15) and must be translated to Cord-Coin</B>.
 *
 * @param accountAddress Address of the account on which to listen for all balance changes.
 * @param listener Listener to receive all balance change updates.
 * @returns A promise containing a function that let's you unsubscribe from all balance changes.
 *
 * @example
 * <BR>
 *
 * ```javascript
 * const address = ...
 * const unsubscribe = await sdk.Balance.listenToBalanceChanges(address,
 *   (account: IPublicIdentity['address'], balances: Balances, changes: Balances) => {
 *     console.log(`Balance has changed by ${changes.free.toNumber()} to ${balances.free.toNumber()}`)
 *   });
 * // later
 * unsubscribe();
 * ```
 */
export async function listenToBalanceChanges(
  accountAddress: IPublicIdentity['address'],
  listener: (
    account: IPublicIdentity['address'],
    balances: Balances,
    changes: Balances
  ) => void
): Promise<UnsubscribePromise> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()
  let previousBalances = await getBalances(accountAddress)

  return blockchain.api.query.system.account(
    accountAddress,
    ({ data: { free, reserved, miscFrozen, feeFrozen } }) => {
      const balancesChange = {
        free: free.sub(previousBalances.free),
        reserved: reserved.sub(previousBalances.reserved),
        miscFrozen: miscFrozen.sub(previousBalances.miscFrozen),
        feeFrozen: feeFrozen.sub(previousBalances.feeFrozen),
      }

      const current = {
        free: new BN(free),
        reserved: new BN(reserved),
        miscFrozen: new BN(miscFrozen),
        feeFrozen: new BN(feeFrozen),
      }
      previousBalances = current

      listener(accountAddress, current, balancesChange)
    }
  )
}

/**
 * Transfer Cord [amount] tokens to [toAccountAddress].
 * <B>Note that the value of the transferred currency and the balance amount reported by the chain is in Femto-Cord (1e-15), and must be translated to Cord-Coin</B>.
 *
 * @param accountAddressTo Address of the receiver account.
 * @param amount Amount of Units to transfer.
 * @param exponent Magnitude of the amount. Default magnitude of Femto-Cord.
 * @returns Promise containing unsigned SubmittableExtrinsic.
 *
 * @example
 * <BR>
 *
 * ```javascript
 * const identity = ...
 * const address = ...
 * const amount: BN = new BN(42)
 * const blockchain = await sdk.getConnectionOrConnect()
 * sdk.Balance.makeTransfer(address, amount, 0) //
 *   .then(tx => ChainUtils.signAndSendTx(tx, identity))
 *   .then(() => console.log('Successfully transferred ${amount.toNumber()} tokens'))
 *   .catch(err => {
 *     console.log('Transfer failed')
 *   })
 * ```
 */
export async function makeTransfer(
  accountAddressTo: IPublicIdentity['address'],
  amount: BN,
  exponent = -12
): Promise<SubmittableExtrinsic> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()
  const cleanExponent =
    (exponent >= 0 ? 1 : -1) * Math.floor(Math.abs(exponent))
  const transfer = blockchain.api.tx.balances.transfer(
    accountAddressTo,
    cleanExponent === -12
      ? amount
      : BalanceUtils.convertToWayUnit(amount, cleanExponent)
  )
  return transfer
}