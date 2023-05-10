import { inspect } from 'util'
import WebSdk from '@holo-host/web-sdk'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import useIsLoadingStore from './useIsLoadingStore'
import useSignalStore from './useSignalStore'

const makeUseHoloStore = ({ connectionArgs, MockWebSdk }) => defineStore('holo', {
  state: () => ({
    client: null,
    agentState: {},
    happId: null,
    connectionError: null,
    isAuthFormOpen: false,
    // These two values are subscribed to by clientStore
    isReady: false,
    appInfo: null
  }),
  getters: {
    isAnonymous: state => state.agentState.isAnonymous,
    isAvailable: state => state.agentState.isAvailable,
    isLoggedIn: state => state.agentState.isAnonymous === false && state.agentState.isAvailable === true,
    error: state => !state.agentState.isAvailable && (state.connectionError || state.agentState.unrecoverableError),
    agentKey: (state) => state.appInfo?.agent_pub_key,
    agentId: state => state.agentState.id
  },
  actions: {
    async initialize() {
      try {
        if (MockWebSdk) {
          this.client = await MockWebSdk.connect(connectionArgs)
        } else {
          this.client = await WebSdk.connect(connectionArgs)
        }
      } catch (e) {
        console.error('Holo connection error ', e)
        throw e
      }

      const onAgentState = agentState => {
        if (agentState.unrecoverableError) {
          console.error('unrecoverable agent state', agentState.unrecoverableError)
        }

        // This is a temporary addition, until chaperone is updated to include app info as part of agent state
        this.client.appInfo().then((appInfo) => {
          this.appInfo = appInfo
        })

        this.agentState = agentState

        this.isReady = this.isLoggedIn
      }

      this.client.on('agent-state', onAgentState)
      this.client.on('signal', payload => useSignalStore().handleSignal(payload))

      this.happId = this.client.happId

      // Set agent state in case `agent-state` event is never emitted. This is the case with Mock Web SDK because it never emits events
      onAgentState(this.client.agent)

      return toRaw(this.client)
    },

    signIn() {
      this.isAuthFormOpen = true
      return this.client.signIn({ cancellable: false })
    },

    signUp() {
      this.isAuthFormOpen = true
      this.client.signUp({ cancellable: false })
    },

    signOut() {
      this.client.signOut()
    },

    async callZome(args) {
      const { role_name, zome_name, fn_name, payload } = args

      useIsLoadingStore().callIsLoading({ zome_name, fn_name })

      let result

      try {
        result = await this.client.callZome({
          role_name,
          zome_name,
          fn_name,
          payload
        })
      } catch (e) {
        console.error('callZome() returned error.', inspect(e))
        throw e
      } finally {
        useIsLoadingStore().callIsNotLoading({ zome_name, fn_name })
      }

      return result
    },

    async loadAppInfo() {
      try {
        const appInfo = await this.client.appInfo()
        this.appInfo = appInfo
      } catch (e) {
        console.error('appInfo() returned error.', inspect(e))
        throw e
      }

      return this.appInfo
    }
  }
})

export default makeUseHoloStore
