import { inspect } from 'util'
import { AppWebsocket } from '@holochain/client'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { presentHcSignal } from '../utils'
import useIsLoadingStore from './useIsLoadingStore'
import useSignalStore from './useSignalStore'

const HC_APP_TIMEOUT = 35_000

const makeUseHolochainStore = ({ installed_app_id, app_ws_url }) => defineStore('holochain', {
  state: () => ({
    client: null,
    // These two values are subscribed to by clientStore
    appInfo: null,
    isReady: false
  }),
  actions: {
    async initialize() {
      try {
        const holochainClient = await AppWebsocket.connect(
          app_ws_url,
          HC_APP_TIMEOUT,
          signal => useSignalStore().handleSignal(presentHcSignal(signal))
        )

        this.client = holochainClient

        holochainClient.client.socket.onclose = function(e) {
          console.log(
            'Socket to Holochain App Interface has closed.',
            inspect(e)
          )
          this.client = null
          this.isReady = false
        }

        this.loadAppInfo()
      } catch (e) {
        console.error('Holochain connection error ', e)
        this.isReady = false
        throw e
      }

      return toRaw(this.client)
    },

    async loadAppInfo() {
      try {
        const appInfo = await this.client.appInfo({
          installed_app_id
        })
        this.appInfo = appInfo
        this.isReady = true
      } catch (e) {
        console.error('appInfo() returned error.', inspect(e))
        throw e
      }

      return this.appInfo
    },

    async callZome(args) {
      const { role_name, zome_name, fn_name, payload } = args
      if (!this.appInfo) {
        throw new Error('Tried to make a zome call before storing appInfo')
      }

      const role_names = Object.keys(this.appInfo.cell_info)
      if (role_names.length === 0) {
        throw new Error('No cells found in appInfo')
      }

      const roleName = role_names.find(roleName => roleName === role_name)

      if (!roleName) {
        throw new Error(`Couldn't find cell with role_name ${role_name}`)
      }

      useIsLoadingStore().callIsLoading({ zome_name, fn_name })

      try {
        const result = await this.client.callZome(
          {
            cap_secret: null,
            role_name,
            zome_name,
            fn_name,
            payload,
            provenance: this.client.agent_pub_key
          },
          HC_APP_TIMEOUT
        )

        return result
      } catch (e) {
        console.error('callZome() returned error.', inspect(e))
        throw e
      } finally {
        useIsLoadingStore().callIsNotLoading({ zome_name, fn_name })
      }
    }
  }
})

export default makeUseHolochainStore
