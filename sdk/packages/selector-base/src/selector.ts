import '@nightlylabs/wallet-selector-modal'
import { NightlyMainPage } from '@nightlylabs/wallet-selector-modal'
import { modalStyle, triggerConnect, isMobileBrowser } from './utils'
import { getWallet, getWalletsList } from './detection'
import { Adapter, AppInitData, MetadataWallet, NetworkData } from './types'
import { Wallet } from '@wallet-standard/core'

export class NCBaseSelector<A extends Adapter> {
  _modal: NightlyMainPage | undefined
  _modalRoot: HTMLDivElement | undefined
  _metadataWallets: MetadataWallet[]
  _adapterCreator: (wallet: Wallet) => A
  _walletsFilterCb: (wallet: Wallet) => boolean
  _networkData: NetworkData
  _appInitData: AppInitData
  _sessionId: string
  _connectDeeplink: (walletName: string, url: string) => void

  onConnected: ((adapter: A) => void) | undefined
  onOpen: (() => void) | undefined
  onClose: (() => void) | undefined

  constructor(
    appInitData: AppInitData,
    metadataWallets: MetadataWallet[],
    adapterCreator: (wallet: Wallet) => A,
    walletsFilterCb: (wallet: Wallet) => boolean,
    networkData: NetworkData,
    sessionId: string,
    connectDeeplink: (name: string, url: string) => void
  ) {
    this._appInitData = appInitData
    this._metadataWallets = metadataWallets
    this._adapterCreator = adapterCreator
    this._walletsFilterCb = walletsFilterCb
    this._networkData = networkData
    this._sessionId = sessionId
    this._connectDeeplink = connectDeeplink
  }

  public openModal = () => {
    if (!this._modalRoot) {
      this._modal = document.createElement('nightly-main-page')
      this._modal.onClose = this.closeModal

      this._modal.network = this._networkData.network
      this._modal.sessionId = this._sessionId
      this._modal.relay = this._appInitData.url ?? 'https://nc2.nightly.app'
      this._modal.chainIcon = this._networkData.icon
      this._modal.chainName = this._networkData.name
      this._modal.selectorItems = getWalletsList(this._metadataWallets, this._walletsFilterCb).map(
        (w) => ({
          name: w.name,
          icon: w.icon,
          status: w.recent ? 'Recent' : w.detected ? 'Detected' : '',
          link: w.link ?? ''
        })
      )
      this._modal.onWalletClick = (name) => {
        if (isMobileBrowser()) {
          const walletData = this._metadataWallets.find((w) => w.name === name)

          if (
            typeof walletData === 'undefined' ||
            walletData.deeplink === null ||
            (walletData.deeplink.universal === null && walletData.deeplink.native === null)
          ) {
            return
          }

          this._connectDeeplink(
            walletData.name,
            walletData.deeplink.universal ?? walletData.deeplink.native!
          )

          triggerConnect(
            walletData.deeplink.universal ?? walletData.deeplink.native!,
            this._sessionId,
            this._appInitData.url ?? 'https://nc2.nightly.app'
          )

          this._modal!.connecting = true
        } else {
          const wallet = getWallet(name)
          if (typeof wallet === 'undefined') {
            return
          }

          const adapter = this._adapterCreator(wallet)
          this._modal!.connecting = true
          adapter
            .connect()
            .then(() => {
              this.onConnected?.(adapter)
              this.closeModal()
            })
            .catch(() => {
              this._modal!.connecting = false
            })
        }
      }

      const style = document.createElement('style')
      style.textContent = modalStyle
      document.head.appendChild(style)

      this._modalRoot = document.createElement('div')
      this._modalRoot.classList.add('nightlyConnectSelectorOverlay')

      this._modal.classList.add('nightlyConnectSelector')
      this._modalRoot.appendChild(this._modal)

      document.body.appendChild(this._modalRoot)
    } else {
      this._modalRoot.style.display = 'block'
    }
    this.onOpen?.()
  }

  public closeModal = () => {
    if (this._modalRoot) {
      this._modalRoot.style.display = 'none'
      this.onClose?.()
    }
  }
}
