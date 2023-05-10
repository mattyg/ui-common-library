import { inspect } from 'util'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { encodeAgentId } from '../utils/agent'

const makeUseClientStore = ({ useInterfaceStore, onInit }) => defineStore('client', {
  state: () => ({
    agentKey: null, // the Uint8Array of raw bytes. See also agentId in getters, below
    isReady: false
  }),
  getters: {
    agentId: state => state.agentKey && encodeAgentId(state.agentKey),
    appInfo: () => toRaw(useInterfaceStore().appInfo)
  },
  actions: {
    initialize() {
      // onInit is a hack, see stores/index.js for details
      onInit?.()

      useInterfaceStore().$subscribe((_, state) => {
        // This could be more efficient by inspecting the contents of mutation
        this.isReady = state.isReady

        if (state.appInfo?.agent_pub_key) {
          this.agentKey = state.appInfo.agent_pub_key
        }
      })

      return useInterfaceStore().initialize()
    },

    loadAppInfo() {
      return useInterfaceStore().loadAppInfo()
    },

    callZome({ role_name, zome_name, fn_name, payload = null }) {
      const zomePath = `${zome_name}.${fn_name}`
      console.log(`calling ${zomePath} with ${inspect(payload)}`)

      if (!this.isReady) {
        throw new Error('Tried to make zome call while client is not ready')
      }

      return useInterfaceStore().callZome({ role_name, zome_name, fn_name, payload })
    }
  }
})

export default makeUseClientStore
